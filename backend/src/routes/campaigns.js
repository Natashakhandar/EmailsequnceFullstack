const express = require('express');
const prisma = require('../db/prismaClient');
const { authenticateToken } = require('../middleware/auth');
const { broadcastCampaignStats, broadcastGeneralStats } = require('../services/socketService');
const router = express.Router();

// Apply authentication middleware to all campaign routes
router.use(authenticateToken);

/**
 * POST /api/campaigns - Create a new campaign
 * Body: { campaign_name, description, sequence_id, start_date, end_date, lead_ids[] }
 */
router.post('/', async (req, res) => {
  try {
    // Log complete incoming request body for debugging
    console.log('📊 Campaign Creation Request - Full Body:', {
      body: req.body,
      bodyKeys: Object.keys(req.body || {}),
      bodyTypes: Object.entries(req.body || {}).reduce((acc, [key, value]) => {
        acc[key] = { type: typeof value, value: value, isEmpty: value === '' || value === null || value === undefined };
        return acc;
      }, {})
    });

    // Handle both snake_case and camelCase field names for backward compatibility
    const campaign_name = req.body.campaign_name || req.body.campaignName;
    const sequence_id = req.body.sequence_id || req.body.sequenceId;
    const description = req.body.description;
    const start_date = req.body.start_date || req.body.startDate;
    const end_date = req.body.end_date || req.body.endDate;
    const lead_ids = req.body.lead_ids || req.body.leadIds || [];

    // Log warnings for old camelCase payloads for debugging
    if (req.body.campaignName && !req.body.campaign_name) {
      console.warn('⚠️ Deprecated: Received camelCase "campaignName" field. Please use snake_case "campaign_name" for consistency.');
    }
    if (req.body.sequenceId && !req.body.sequence_id) {
      console.warn('⚠️ Deprecated: Received camelCase "sequenceId" field. Please use snake_case "sequence_id" for consistency.');
    }
    if (req.body.startDate && !req.body.start_date) {
      console.warn('⚠️ Deprecated: Received camelCase "startDate" field. Please use snake_case "start_date" for consistency.');
    }
    if (req.body.endDate && !req.body.end_date) {
      console.warn('⚠️ Deprecated: Received camelCase "endDate" field. Please use snake_case "end_date" for consistency.');
    }
    if (req.body.leadIds && !req.body.lead_ids) {
      console.warn('⚠️ Deprecated: Received camelCase "leadIds" field. Please use snake_case "lead_ids" for consistency.');
    }

    console.log('📊 Normalized Field Values:', {
      campaign_name,
      sequence_id,
      description,
      start_date,
      end_date,
      lead_ids: Array.isArray(lead_ids) ? lead_ids.length : 'invalid'
    });

    // Comprehensive validation for required fields
    const validationErrors = [];

    // Validate campaign_name (required) - accepts both snake_case and camelCase
    if (!campaign_name) {
      validationErrors.push('campaign_name (or campaignName) is required');
    } else if (typeof campaign_name !== 'string') {
      validationErrors.push('campaign_name (or campaignName) must be a string');
    } else if (campaign_name.trim().length === 0) {
      validationErrors.push('campaign_name (or campaignName) cannot be empty or only whitespace');
    }

    // Validate sequence_id (required) - accepts both snake_case and camelCase
    if (!sequence_id) {
      validationErrors.push('sequence_id (or sequenceId) is required');
    } else if (typeof sequence_id !== 'string') {
      validationErrors.push('sequence_id (or sequenceId) must be a string');
    } else if (sequence_id.trim().length === 0) {
      validationErrors.push('sequence_id (or sequenceId) cannot be empty or only whitespace');
    }

    // Validate optional fields
    if (description !== undefined && description !== null && typeof description !== 'string') {
      validationErrors.push('description must be a string when provided');
    }

    if (start_date !== undefined && start_date !== null && start_date !== '') {
      const startDateObj = new Date(start_date);
      if (isNaN(startDateObj.getTime())) {
        validationErrors.push('start_date must be a valid date when provided');
      }
    }

    if (end_date !== undefined && end_date !== null && end_date !== '') {
      const endDateObj = new Date(end_date);
      if (isNaN(endDateObj.getTime())) {
        validationErrors.push('end_date must be a valid date when provided');
      }
    }

    if (!Array.isArray(lead_ids)) {
      validationErrors.push('lead_ids must be an array');
    }

    // Return detailed validation errors if any
    if (validationErrors.length > 0) {
      console.error('❌ Campaign validation failed:', {
        errors: validationErrors,
        receivedData: { campaign_name, sequence_id, description, start_date, end_date, lead_ids }
      });
      return res.status(400).json({
        error: 'Validation failed',
        details: validationErrors,
        receivedFields: {
          campaign_name: { value: campaign_name, type: typeof campaign_name },
          sequence_id: { value: sequence_id, type: typeof sequence_id },
          description: { value: description, type: typeof description },
          start_date: { value: start_date, type: typeof start_date },
          end_date: { value: end_date, type: typeof end_date },
          lead_ids: { value: lead_ids, type: typeof lead_ids, length: Array.isArray(lead_ids) ? lead_ids.length : 'N/A' }
        }
      });
    }

    console.log('✅ Campaign validation passed:', {
      campaign_name: campaign_name.trim(),
      sequence_id: sequence_id.trim(),
      description: description || null,
      start_date: start_date || null,
      end_date: end_date || null,
      lead_count: lead_ids.length
    });

    // Verify sequence exists and belongs to user
    const sequence = await prisma.sequence.findFirst({
      where: { id: sequence_id.trim(), userId: req.user.id },
      include: { steps: true }
    });

    if (!sequence) {
      return res.status(404).json({
        error: 'Sequence not found',
        sequenceId: sequence_id.trim()
      });
    }

    // Verify all lead IDs exist
    if (lead_ids.length > 0) {
      const existingContacts = await prisma.contact.findMany({
        where: { id: { in: lead_ids } },
        select: { id: true }
      });

      const existingContactIds = existingContacts.map(c => c.id);
      const missingContactIds = lead_ids.filter(id => !existingContactIds.includes(id));

      if (missingContactIds.length > 0) {
        return res.status(400).json({
          error: 'Some contact IDs not found',
          missingContactIds,
          providedIds: lead_ids,
          existingIds: existingContactIds
        });
      }
    }

    // Create campaign with transaction
    const result = await prisma.$transaction(async (tx) => {
      // Prepare data with proper null defaults for dates
      const campaignData = {
        campaignName: campaign_name.trim(),
        description: description && description.trim() ? description.trim() : null,
        sequenceId: sequence_id.trim(),
        startDate: (start_date && start_date !== '') ? new Date(start_date) : null,
        endDate: (end_date && end_date !== '') ? new Date(end_date) : null,
        userId: req.user.id
      };

      console.log('📊 Creating campaign with Prisma data:', {
        campaignData,
        dateHandling: {
          start_date_input: start_date,
          end_date_input: end_date,
          start_date_processed: campaignData.startDate,
          end_date_processed: campaignData.endDate
        }
      });

      // Create campaign with enhanced data validation
      const campaign = await tx.campaign.create({
        data: {
          ...campaignData,
          userId: req.user.id // Link campaign to the logged-in user
        },
        include: {
          sequence: {
            include: { steps: true }
          }
        }
      });

      // Add leads to campaign
      if (lead_ids.length > 0) {
        await tx.campaignLead.createMany({
          data: lead_ids.map(contactId => ({
            campaignId: campaign.id,
            contactId
          }))
        });

        // Delete any existing enrollments for these contacts in this sequence 
        // to allow them to re-start the sequence in the new campaign.
        // This solves the issue where leads wouldn't send if they were previously enrolled.
        const contactIds = lead_ids;
        await tx.enrollment.deleteMany({
          where: {
            contactId: { in: contactIds },
            sequenceId: sequence_id
          }
        });

        console.log(`📊 Cleared ${contactIds.length} potentially existing enrollments for sequence ${sequence_id}`);

        // Create enrollments for all leads in this campaign
        const enrollmentData = lead_ids.map(contactId => ({
          contactId,
          sequenceId: sequence_id,
          campaignId: campaign.id,
          currentStep: 1,
          nextSendAt: campaign.startDate || new Date()
        }));

        const resultEnrollments = await tx.enrollment.createMany({
          data: enrollmentData,
          skipDuplicates: true // Extra safety
        });

        console.log(`✅ Created ${resultEnrollments.count} new enrollments for campaign: ${campaign.id}`);
      }

      return campaign;
    });

    console.log('✅ Campaign created successfully:', {
      campaignId: result.id,
      campaignName: result.campaignName,
      leadsAdded: lead_ids.length
    });

    // Fetch complete campaign data with stats
    const campaignWithStats = await getCampaignWithStats(result.id, req.user);

    // Broadcast campaign stats update via socket
    broadcastCampaignStats(result.id, campaignWithStats.stats);

    // Broadcast general stats update
    broadcastGeneralStats({
      totalCampaigns: await prisma.campaign.count({ where: { userId: req.user.id, isActive: true } }),
      totalLeads: await prisma.contact.count({ where: { userId: req.user.id, status: 'ACTIVE' } }),
      event: 'campaign_created'
    });

    res.status(201).json({
      message: 'Campaign created successfully',
      campaign: campaignWithStats
    });

  } catch (error) {
    console.error('❌ Error creating campaign:', error);
    res.status(500).json({
      error: 'Failed to create campaign',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/campaigns - Fetch all campaigns with summary stats
 */
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, isActive, sequenceId } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    console.log('📊 Fetching campaigns with filters:', {
      page: parseInt(page),
      limit: parseInt(limit),
      isActive,
      sequenceId
    });

    // Build where clause
    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPERADMIN';
    const where = isAdmin ? {} : {
      userId: req.user.id
    };
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (sequenceId) where.sequenceId = sequenceId;

    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          sequence: {
            select: { id: true, name: true }
          },
          _count: {
            select: {
              campaignLeads: true,
              enrollments: true,
              events: true
            }
          }
        }
      }),
      prisma.campaign.count({ where })
    ]);

    // Get stats for each campaign
    const campaignsWithStats = await Promise.all(
      campaigns.map(async (campaign) => {
        const stats = await getCampaignStats(campaign.id, req.user.id);
        return {
          ...campaign,
          stats
        };
      })
    );

    res.json({
      campaigns: campaignsWithStats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('❌ Error fetching campaigns:', error);
    res.status(500).json({
      error: 'Failed to fetch campaigns',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/campaigns/:id - Fetch specific campaign with leads, sequence, and stats
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID parameter exists
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      console.error('❌ Invalid campaign ID parameter:', { id, type: typeof id });
      return res.status(400).json({
        error: 'Invalid campaign ID parameter',
        details: 'Campaign ID must be a non-empty string'
      });
    }

    console.log('📊 Fetching campaign details:', { campaignId: id, userId: req.user.id });

    const campaign = await getCampaignWithStats(id, req.user);

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Format response to match exact specification
    const response = {
      id: campaign.id,
      campaignName: campaign.campaignName,
      description: campaign.description || '',
      isActive: campaign.isActive,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      sequence: {
        id: campaign.sequence?.id,
        name: campaign.sequence?.name
      },
      leads: (campaign.leads || []).map(lead => ({
        id: lead.id,
        firstName: lead.firstName || '',
        lastName: lead.lastName || '',
        email: lead.email
      })),
      stats: {
        totalEmailsSent: campaign.stats?.emails?.sent || 0,
        totalOpened: campaign.stats?.emails?.opened || 0,
        totalReplied: campaign.stats?.emails?.replied || 0,
        totalBounced: campaign.stats?.emails?.bounced || 0
      }
    };

    console.log('✅ Campaign details response formatted:', {
      campaignId: response.id,
      campaignName: response.campaignName,
      leadsCount: response.leads.length,
      sequenceName: response.sequence.name,
      totalEmailsSent: response.stats.totalEmailsSent
    });

    res.json(response);

  } catch (error) {
    console.error('❌ Error fetching campaign:', error);
    res.status(500).json({
      error: 'Failed to fetch campaign',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * PATCH /api/campaigns/:id - Edit campaign details or add/remove leads
 */
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { campaign_name, description, start_date, end_date, isActive, add_lead_ids = [], remove_lead_ids = [] } = req.body;

    console.log('📊 Updating campaign:', {
      campaignId: id,
      updates: { campaign_name, description, start_date, end_date, isActive },
      add_lead_ids: add_lead_ids.length,
      remove_lead_ids: remove_lead_ids.length
    });

    // Verify campaign exists and belongs to user
    const existingCampaign = await prisma.campaign.findFirst({
      where: { id, userId: req.user.id },
      include: { sequence: true }
    });

    if (!existingCampaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Verify contacts exist if adding leads and belong to user
    if (add_lead_ids.length > 0) {
      const existingContacts = await prisma.contact.findMany({
        where: { id: { in: add_lead_ids }, userId: req.user.id },
        select: { id: true }
      });

      const existingContactIds = existingContacts.map(c => c.id);
      const missingContactIds = add_lead_ids.filter(id => !existingContactIds.includes(id));

      if (missingContactIds.length > 0) {
        return res.status(400).json({
          error: 'Some contact IDs not found',
          missingContactIds
        });
      }
    }

    // Update campaign with transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update campaign basic info
      const updateData = {};
      if (campaign_name !== undefined) updateData.campaignName = campaign_name;
      if (description !== undefined) updateData.description = description;
      if (start_date !== undefined) updateData.startDate = start_date ? new Date(start_date) : null;
      if (end_date !== undefined) updateData.endDate = end_date ? new Date(end_date) : null;
      if (isActive !== undefined) updateData.isActive = isActive;

      const campaign = await tx.campaign.update({
        where: { id },
        data: updateData
      });

      // Remove leads
      if (remove_lead_ids.length > 0) {
        // Remove from campaign_leads
        await tx.campaignLead.deleteMany({
          where: {
            campaignId: id,
            contactId: { in: remove_lead_ids }
          }
        });

        // Update enrollments to remove campaign association
        await tx.enrollment.updateMany({
          where: {
            campaignId: id,
            contactId: { in: remove_lead_ids }
          },
          data: { campaignId: null }
        });
      }

      // Add new leads
      if (add_lead_ids.length > 0) {
        // Add to campaign_leads (skip duplicates)
        await tx.campaignLead.createMany({
          data: add_lead_ids.map(contactId => ({
            campaignId: id,
            contactId
          })),
          skipDuplicates: true
        });

        // Create enrollments for new leads
        const enrollmentData = add_lead_ids.map(contactId => ({
          contactId,
          sequenceId: existingCampaign.sequenceId,
          campaignId: id,
          currentStep: 1,
          nextSendAt: campaign.startDate || new Date()
        }));

        await tx.enrollment.createMany({
          data: enrollmentData,
          skipDuplicates: true
        });
      }

      return campaign;
    });

    console.log('✅ Campaign updated successfully:', {
      campaignId: result.id,
      leadsAdded: add_lead_ids.length,
      leadsRemoved: remove_lead_ids.length
    });

    // Fetch updated campaign with stats
    const updatedCampaign = await getCampaignWithStats(id, req.user);

    // Broadcast campaign stats update via socket
    broadcastCampaignStats(id, updatedCampaign.stats);

    res.json({
      message: 'Campaign updated successfully',
      campaign: updatedCampaign
    });

  } catch (error) {
    console.error('❌ Error updating campaign:', error);
    res.status(500).json({
      error: 'Failed to update campaign',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * DELETE /api/campaigns/:id - Delete campaign and all related data safely
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID parameter exists
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      console.error('❌ Invalid campaign ID parameter:', { id, type: typeof id });
      return res.status(400).json({
        success: false,
        error: 'Invalid campaign ID parameter',
        details: 'Campaign ID must be a non-empty string'
      });
    }

    console.log('🗑️ Deleting campaign:', { campaignId: id });

    // Verify campaign exists and get detailed counts
    const existingCampaign = await prisma.campaign.findFirst({
      where: { id, userId: req.user.id },
      include: {
        sequence: { select: { id: true, name: true } },
        _count: {
          select: {
            campaignLeads: true,
            enrollments: true,
            events: true
          }
        }
      }
    });

    if (!existingCampaign) {
      return res.status(404).json({
        error: 'Campaign not found',
        campaignId: id
      });
    }

    // Get detailed breakdown before deletion
    const relatedData = {
      campaignLeads: await prisma.campaignLead.count({ where: { campaignId: id } }),
      enrollments: await prisma.enrollment.count({ where: { campaignId: id } }),
      events: await prisma.event.count({ where: { campaignId: id } })
    };

    console.log('📊 Campaign deletion impact:', {
      campaignId: id,
      campaignName: existingCampaign.campaignName,
      sequenceName: existingCampaign.sequence?.name,
      relatedData
    });

    // Delete campaign with comprehensive transaction
    const deletionResult = await prisma.$transaction(async (tx) => {
      // Step 1: Delete all events associated with this campaign
      const deletedEvents = await tx.event.deleteMany({
        where: { campaignId: id }
      });

      // Step 2: Update enrollments to remove campaign association (preserve enrollments)
      const updatedEnrollments = await tx.enrollment.updateMany({
        where: { campaignId: id },
        data: { campaignId: null }
      });

      // Step 3: Delete campaign leads relationships
      const deletedCampaignLeads = await tx.campaignLead.deleteMany({
        where: { campaignId: id }
      });

      // Step 4: Delete the campaign itself
      const deletedCampaign = await tx.campaign.delete({
        where: { id }
      });

      return {
        campaign: deletedCampaign,
        eventsDeleted: deletedEvents.count,
        enrollmentsUpdated: updatedEnrollments.count,
        campaignLeadsDeleted: deletedCampaignLeads.count
      };
    });

    console.log('✅ Campaign deleted successfully:', {
      campaignId: id,
      campaignName: existingCampaign.campaignName,
      deletionStats: {
        eventsDeleted: deletionResult.eventsDeleted,
        enrollmentsUpdated: deletionResult.enrollmentsUpdated,
        campaignLeadsDeleted: deletionResult.campaignLeadsDeleted
      }
    });

    // Broadcast stats update
    broadcastGeneralStats({
      totalCampaigns: await prisma.campaign.count({ where: { userId: req.user.id, isActive: true } }),
      totalLeads: await prisma.contact.count({ where: { userId: req.user.id, status: 'ACTIVE' } }),
      event: 'campaign_deleted'
    });

    res.json({
      success: true,
      message: 'Campaign deleted successfully',
      deletedId: id
    });

  } catch (error) {
    console.error('❌ Error deleting campaign:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete campaign',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Helper function to get campaign with complete stats
 */
async function getCampaignWithStats(campaignId, user) {
  const isAdmin = user.role === 'ADMIN' || user.role === 'SUPERADMIN';
  const campaign = await prisma.campaign.findFirst({
    where: {
      id: campaignId,
      ...(isAdmin ? {} : { userId: user.id })
    },
    include: {
      sequence: {
        include: { steps: true }
      },
      campaignLeads: {
        include: {
          contact: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              company: true,
              status: true
            }
          }
        }
      },
      enrollments: {
        include: {
          contact: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          }
        }
      }
    }
  });

  if (!campaign) return null;

  const stats = await getCampaignStats(campaignId, user.id);

  return {
    ...campaign,
    stats,
    leads: campaign.campaignLeads.map(cl => cl.contact),
    // Add status calculation for frontend
    status: calculateCampaignStatus(campaign)
  };
}

/**
 * Helper function to calculate campaign status
 */
function calculateCampaignStatus(campaign) {
  const now = new Date();

  if (!campaign.isActive) {
    return 'Inactive';
  } else if (campaign.endDate && now > new Date(campaign.endDate)) {
    return 'Completed';
  } else if (campaign.startDate && now < new Date(campaign.startDate)) {
    return 'Upcoming';
  } else {
    return 'Active';
  }
}

/**
 * Helper function to get campaign statistics
 */
async function getCampaignStats(campaignId, userId) {
  // Get event counts for this campaign
  const eventStats = await prisma.event.groupBy({
    by: ['type'],
    where: { campaignId, campaign: { userId } },
    _count: { type: true }
  });

  const eventCounts = eventStats.reduce((acc, stat) => {
    acc[stat.type.toLowerCase()] = stat._count.type;
    return acc;
  }, {});

  // Get enrollment stats
  const enrollmentStats = await prisma.enrollment.groupBy({
    by: ['status'],
    where: { campaignId, campaign: { userId } },
    _count: { status: true }
  });

  const enrollmentCounts = enrollmentStats.reduce((acc, stat) => {
    acc[stat.status.toLowerCase()] = stat._count.status;
    return acc;
  }, {});

  // Calculate rates
  const totalSent = eventCounts.sent || 0;
  const totalOpened = eventCounts.opened || 0;
  const totalReplied = eventCounts.replied || 0;
  const totalBounced = eventCounts.bounced || 0;

  const openRate = totalSent > 0 ? ((totalOpened / totalSent) * 100).toFixed(2) : '0.00';
  const replyRate = totalSent > 0 ? ((totalReplied / totalSent) * 100).toFixed(2) : '0.00';
  const bounceRate = totalSent > 0 ? ((totalBounced / totalSent) * 100).toFixed(2) : '0.00';

  return {
    emails: {
      sent: totalSent,
      opened: totalOpened,
      replied: totalReplied,
      bounced: totalBounced,
      clicked: eventCounts.clicked || 0,
      delivered: eventCounts.delivered || 0,
      failed: eventCounts.failed || 0
    },
    rates: {
      openRate: parseFloat(openRate),
      replyRate: parseFloat(replyRate),
      bounceRate: parseFloat(bounceRate)
    },
    enrollments: {
      active: enrollmentCounts.active || 0,
      completed: enrollmentCounts.completed || 0,
      paused: enrollmentCounts.paused || 0,
      stopped: enrollmentCounts.stopped || 0,
      unsubscribed: enrollmentCounts.unsubscribed || 0
    }
  };
}

module.exports = router;
