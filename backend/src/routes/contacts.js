const express = require('express');
const prisma = require('../db/prismaClient');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Apply authentication middleware to all contact routes
router.use(authenticateToken);

// GET /api/contacts - Get all contacts with pagination
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 50, status, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPERADMIN';
    const where = isAdmin ? {} : {
      userId: req.user.id
    };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          enrollments: {
            include: {
              sequence: true
            }
          },
          _count: {
            select: { events: true }
          }
        }
      }),
      prisma.contact.count({ where })
    ]);

    res.json({
      contacts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

// GET /api/contacts/:id - Get single contact
router.get('/:id', async (req, res) => {
  try {
    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPERADMIN';
    const contact = await prisma.contact.findFirst({
      where: {
        id: req.params.id,
        ...(isAdmin ? {} : { userId: req.user.id })
      },
      include: {
        enrollments: {
          include: {
            sequence: true,
            events: {
              orderBy: { timestamp: 'desc' },
              take: 10
            }
          }
        },
        events: {
          orderBy: { timestamp: 'desc' },
          take: 20
        }
      }
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json(contact);
  } catch (error) {
    console.error('Error fetching contact:', error);
    res.status(500).json({ error: 'Failed to fetch contact' });
  }
});

// POST /api/contacts - Create new contact
router.post('/', async (req, res) => {
  try {
    const { email, firstName, lastName, company, timezone = 'UTC' } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if contact already exists for this user
    const existingContact = await prisma.contact.findFirst({
      where: {
        email,
        userId: req.user.id
      }
    });

    if (existingContact) {
      return res.status(409).json({ error: 'Contact with this email already exists' });
    }

    const contact = await prisma.contact.create({
      data: {
        userId: req.user.id,
        email: email.toLowerCase().trim(),
        firstName: firstName?.trim(),
        lastName: lastName?.trim(),
        company: company?.trim(),
        timezone
      }
    });

    res.status(201).json(contact);
  } catch (error) {
    console.error('Error creating contact:', error);
    res.status(500).json({ error: 'Failed to create contact' });
  }
});

// PUT /api/contacts/:id - Update contact
router.put('/:id', async (req, res) => {
  try {
    const { firstName, lastName, company, timezone, status } = req.body;

    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPERADMIN';
    // First verify ownership or admin role
    const existing = await prisma.contact.findFirst({
      where: {
        id: req.params.id,
        ...(isAdmin ? {} : { userId: req.user.id })
      }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const contact = await prisma.contact.update({
      where: { id: req.params.id },
      data: {
        ...(firstName !== undefined && { firstName: firstName?.trim() }),
        ...(lastName !== undefined && { lastName: lastName?.trim() }),
        ...(company !== undefined && { company: company?.trim() }),
        ...(timezone && { timezone }),
        ...(status && { status })
      }
    });

    res.json(contact);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Contact not found' });
    }
    console.error('Error updating contact:', error);
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

// DELETE /api/contacts/:id - Delete lead/contact and all related data safely
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    console.log('🗑️ Deleting lead/contact:', { contactId: id });

    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPERADMIN';
    // Verify contact exists and belongs to user (or user is admin)
    const existingContact = await prisma.contact.findFirst({
      where: {
        id,
        ...(isAdmin ? {} : { userId: req.user.id })
      },
      include: {
        _count: {
          select: {
            enrollments: true,
            events: true,
            campaignLeads: true
          }
        }
      }
    });

    if (!existingContact) {
      return res.status(404).json({
        error: 'Lead not found',
        contactId: id
      });
    }

    // Get detailed breakdown before deletion
    const relatedData = {
      enrollments: await prisma.enrollment.count({ where: { contactId: id } }),
      events: await prisma.event.count({ where: { enrollmentId: { in: (await prisma.enrollment.findMany({ where: { contactId: id }, select: { id: true } })).map(e => e.id) } } }),
      campaignLeads: await prisma.campaignLead.count({ where: { contactId: id } }),
      directEvents: await prisma.event.count({ where: { contactId: id } })
    };

    console.log('📊 Lead deletion impact:', {
      contactId: id,
      email: existingContact.email,
      name: `${existingContact.firstName || ''} ${existingContact.lastName || ''}`.trim(),
      relatedData
    });

    // Delete contact with comprehensive transaction
    const deletionResult = await prisma.$transaction(async (tx) => {
      // Step 1: Get all enrollments for this contact to find related events
      const enrollments = await tx.enrollment.findMany({
        where: { contactId: id },
        select: { id: true }
      });
      const enrollmentIds = enrollments.map(e => e.id);

      // Step 2: Delete all events related to this contact's enrollments
      const deletedEnrollmentEvents = await tx.event.deleteMany({
        where: { enrollmentId: { in: enrollmentIds } }
      });

      // Step 3: Delete any direct events for this contact
      const deletedDirectEvents = await tx.event.deleteMany({
        where: { contactId: id }
      });

      // Step 4: Delete all enrollments for this contact
      const deletedEnrollments = await tx.enrollment.deleteMany({
        where: { contactId: id }
      });

      // Step 5: Delete campaign lead relationships
      const deletedCampaignLeads = await tx.campaignLead.deleteMany({
        where: { contactId: id }
      });

      // Step 6: Delete the contact itself
      const deletedContact = await tx.contact.delete({
        where: { id }
      });

      return {
        contact: deletedContact,
        enrollmentEventsDeleted: deletedEnrollmentEvents.count,
        directEventsDeleted: deletedDirectEvents.count,
        enrollmentsDeleted: deletedEnrollments.count,
        campaignLeadsDeleted: deletedCampaignLeads.count
      };
    });

    console.log('✅ Lead deleted successfully:', {
      contactId: id,
      email: existingContact.email,
      deletionStats: {
        enrollmentEventsDeleted: deletionResult.enrollmentEventsDeleted,
        directEventsDeleted: deletionResult.directEventsDeleted,
        enrollmentsDeleted: deletionResult.enrollmentsDeleted,
        campaignLeadsDeleted: deletionResult.campaignLeadsDeleted
      }
    });

    res.json({
      success: true,
      message: 'Lead deleted successfully',
      deletedLead: {
        id,
        email: existingContact.email,
        name: `${existingContact.firstName || ''} ${existingContact.lastName || ''}`.trim() || 'Unknown',
        company: existingContact.company,
        deletionStats: {
          totalEventsDeleted: deletionResult.enrollmentEventsDeleted + deletionResult.directEventsDeleted,
          enrollmentsDeleted: deletionResult.enrollmentsDeleted,
          campaignAssociationsRemoved: deletionResult.campaignLeadsDeleted
        }
      }
    });

  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: 'Lead not found',
        contactId: req.params.id
      });
    }
    console.error('❌ Error deleting lead:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete lead',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/contacts/bulk - Bulk import contacts
router.post('/bulk', async (req, res) => {
  try {
    const { contacts } = req.body;

    if (!Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ error: 'Contacts array is required' });
    }

    const results = {
      created: 0,
      skipped: 0,
      errors: []
    };

    for (const contactData of contacts) {
      try {
        if (!contactData.email) {
          results.errors.push({ data: contactData, error: 'Email is required' });
          continue;
        }

        // Check if contact exists for this user
        const existing = await prisma.contact.findFirst({
          where: {
            email: contactData.email.toLowerCase().trim(),
            userId: req.user.id
          }
        });

        if (existing) {
          results.skipped++;
          continue;
        }

        await prisma.contact.create({
          data: {
            userId: req.user.id,
            email: contactData.email.toLowerCase().trim(),
            firstName: contactData.firstName?.trim(),
            lastName: contactData.lastName?.trim(),
            company: contactData.company?.trim(),
            timezone: contactData.timezone || 'UTC'
          }
        });

        results.created++;
      } catch (error) {
        results.errors.push({ data: contactData, error: error.message });
      }
    }

    res.json(results);
  } catch (error) {
    console.error('Error bulk importing contacts:', error);
    res.status(500).json({ error: 'Failed to import contacts' });
  }
});

// POST /api/contacts/bulk-delete - Bulk delete contacts
router.post('/bulk-delete', async (req, res) => {
  try {
    const { ids } = req.body;

    // Validate ids array
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'No contact IDs provided' });
    }

    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPERADMIN';
    // Verify contacts belong to user before deleting (unless admin)
    const existingContacts = await prisma.contact.findMany({
      where: {
        id: { in: ids },
        ...(isAdmin ? {} : { userId: req.user.id })
      },
      select: { id: true }
    });

    const validIds = existingContacts.map(c => c.id);

    if (validIds.length === 0) {
      return res.status(404).json({ message: 'No valid contacts found to delete' });
    }

    // Delete contacts using deleteMany
    const result = await prisma.contact.deleteMany({
      where: {
        id: {
          in: validIds
        }
      }
    });

    res.status(200).json({
      message: 'Contacts deleted successfully',
      deleted: result.count
    });
  } catch (error) {
    console.error('Error bulk deleting contacts:', error);
    res.status(500).json({ message: 'Failed to delete contacts' });
  }
});

module.exports = router;
