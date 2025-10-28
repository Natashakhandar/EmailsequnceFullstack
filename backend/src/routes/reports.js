const express = require('express');
const prisma = require('../db/prismaClient');
const router = express.Router();

/**
 * GET /api/reports/analytics
 * Get comprehensive real-time analytics for Reports page
 */
router.get('/analytics', async (req, res) => {
  try {
    const { startDate, endDate, sequenceId, campaignId } = req.query;

    // Log analytics request (production-safe)
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Fetching reports analytics with filters:', {
        startDate,
        endDate,
        sequenceId,
        campaignId
      });
    }

    // Build where clause for filtering events
    const eventWhere = {};
    if (startDate || endDate) {
      eventWhere.timestamp = {};
      if (startDate) eventWhere.timestamp.gte = new Date(startDate);
      if (endDate) eventWhere.timestamp.lte = new Date(endDate);
    }

    if (sequenceId) {
      eventWhere.enrollment = {
        sequenceId
      };
    }

    if (campaignId) {
      eventWhere.campaignId = campaignId;
    }

    // Get event counts grouped by type (only events with campaignId for consistency)
    const eventStats = await prisma.event.groupBy({
      by: ['type'],
      where: {
        ...eventWhere,
        campaignId: { not: null } // Only count events associated with campaigns
      },
      _count: {
        type: true
      }
    });

    // Also get uncategorized events (without campaignId) for transparency
    const uncategorizedEventStats = await prisma.event.groupBy({
      by: ['type'],
      where: {
        ...eventWhere,
        campaignId: null
      },
      _count: {
        type: true
      }
    });

    // Convert to object for easier access
    const eventCounts = eventStats.reduce((acc, stat) => {
      acc[stat.type.toLowerCase()] = stat._count.type;
      return acc;
    }, {});

    const uncategorizedEventCounts = uncategorizedEventStats.reduce((acc, stat) => {
      acc[stat.type.toLowerCase()] = stat._count.type;
      return acc;
    }, {});

    // Calculate basic metrics
    const totalEmailsSent = eventCounts.sent || 0;
    const totalOpened = eventCounts.opened || 0;
    const totalReplied = eventCounts.replied || 0;
    const totalBounced = eventCounts.bounced || 0;
    const totalClicked = eventCounts.clicked || 0;
    const totalDelivered = eventCounts.delivered || 0;

    // Calculate rates
    const avgOpenRate = totalEmailsSent > 0 ? ((totalOpened / totalEmailsSent) * 100) : 0;
    const avgResponseRate = totalEmailsSent > 0 ? ((totalReplied / totalEmailsSent) * 100) : 0;
    const bounceRate = totalEmailsSent > 0 ? ((totalBounced / totalEmailsSent) * 100) : 0;

    // Step 1: Get campaign basic info
    const campaignBreakdown = await prisma.campaign.findMany({
      where: { 
        isActive: true,
        ...(campaignId ? { id: campaignId } : {})
      },
      select: {
        id: true,
        campaignName: true,
        description: true,
        startDate: true,
        endDate: true,
        sequence: {
          select: {
            name: true
          }
        }
      }
    });

    // Log campaign data retrieval for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log('📋 Campaign data retrieved:', {
        totalCampaigns: campaignBreakdown.length,
        campaignsWithNames: campaignBreakdown.filter(c => c.campaignName && c.campaignName.trim()).length,
        campaignsWithoutNames: campaignBreakdown.filter(c => !c.campaignName || !c.campaignName.trim()).length,
        sampleCampaigns: campaignBreakdown.slice(0, 3).map(c => ({
          id: c.id.slice(-8),
          campaignName: c.campaignName,
          hasSequence: !!c.sequence?.name,
          sequenceName: c.sequence?.name
        }))
      });
    }

    // Step 2: Aggregate events by campaign_id and type with proper filtering
    const campaignEventStats = await prisma.event.groupBy({
      by: ['campaignId', 'type'],
      where: {
        campaignId: { in: campaignBreakdown.map(c => c.id) },
        ...eventWhere
      },
      _count: {
        type: true
      }
    });

    // Log campaign event aggregation (development only)
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Campaign event aggregation:', {
        totalCampaigns: campaignBreakdown.length,
        eventStatsCount: campaignEventStats.length,
        sampleEventStats: campaignEventStats.slice(0, 3)
      });
    }

    // Step 3: Build campaign stats with proper event counts
    const campaignStats = campaignBreakdown.map(campaign => {
      // Get events for this specific campaign
      const campaignEvents = campaignEventStats.filter(stat => stat.campaignId === campaign.id);
      
      const eventCounts = campaignEvents.reduce((acc, stat) => {
        const type = stat.type.toLowerCase();
        acc[type] = stat._count.type;
        return acc;
      }, {});

      const sent = eventCounts.sent || 0;
      const opened = eventCounts.opened || 0;
      const replied = eventCounts.replied || 0;
      const bounced = eventCounts.bounced || 0;

      // Ensure campaign name is never empty or null
      const campaignName = campaign.campaignName?.trim() || `Campaign ${campaign.id.slice(-8)}`;

      return {
        id: campaign.id,
        campaignName: campaignName,
        name: campaignName, // Frontend-friendly alias
        sequenceName: campaign.sequence?.name || 'Unknown Sequence',
        description: campaign.description || '',
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        emailsSent: sent,
        emailsOpened: opened,
        emailsReplied: replied,
        emailsBounced: bounced,
        sent: sent, // Frontend-friendly alias
        opened: opened, // Frontend-friendly alias
        replied: replied, // Frontend-friendly alias
        bounced: bounced, // Frontend-friendly alias
        openRate: sent > 0 ? parseFloat(((opened / sent) * 100).toFixed(2)) : 0,
        replyRate: sent > 0 ? parseFloat(((replied / sent) * 100).toFixed(2)) : 0,
        bounceRate: sent > 0 ? parseFloat(((bounced / sent) * 100).toFixed(2)) : 0
      };
    });

    const totalCampaigns = campaignBreakdown.length;

    // Step 4: Verify totals match (sum of campaign stats should equal overall totals)
    const campaignTotals = campaignStats.reduce((acc, campaign) => {
      acc.sent += campaign.emailsSent;
      acc.opened += campaign.emailsOpened;
      acc.replied += campaign.emailsReplied;
      acc.bounced += campaign.emailsBounced;
      return acc;
    }, { sent: 0, opened: 0, replied: 0, bounced: 0 });

    // Log verification results (development only)
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 Campaign Analytics Verification:', {
        overallTotals: { sent: totalEmailsSent, opened: totalOpened, replied: totalReplied, bounced: totalBounced },
        campaignTotals,
        match: {
          sent: campaignTotals.sent === totalEmailsSent,
          opened: campaignTotals.opened === totalOpened,
          replied: campaignTotals.replied === totalReplied,
          bounced: campaignTotals.bounced === totalBounced
        },
        campaignAnalytics: campaignStats.map(c => ({
          name: c.campaignName,
          sent: c.emailsSent,
          opened: c.emailsOpened,
          replied: c.emailsReplied,
          openRate: c.openRate,
          replyRate: c.replyRate
        }))
      });
    }

    // Get total leads (contacts)
    const totalLeads = await prisma.contact.count({
      where: { status: 'ACTIVE' }
    });

    // Email Status Distribution
    const emailStatusDistribution = {
      sent: totalEmailsSent,
      opened: totalOpened,
      replied: totalReplied,
      bounced: totalBounced,
      clicked: totalClicked,
      delivered: totalDelivered
    };

    // Lead Performance (using replied instead of converted)
    const leadPerformance = {
      totalLeads,
      repliedLeads: totalReplied,
      replyRate: totalLeads > 0 ? ((totalReplied / totalLeads) * 100) : 0,
      activeEnrollments: await prisma.enrollment.count({
        where: { status: 'ACTIVE' }
      })
    };

    // Monthly Summary (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const monthlyEvents = await prisma.event.groupBy({
      by: ['type'],
      where: {
        timestamp: {
          gte: thirtyDaysAgo
        }
      },
      _count: {
        type: true
      }
    });

    const monthlyEventCounts = monthlyEvents.reduce((acc, stat) => {
      acc[stat.type.toLowerCase()] = stat._count.type;
      return acc;
    }, {});

    const monthlySummary = {
      totalEmailsSent: monthlyEventCounts.sent || 0,
      emailsOpened: monthlyEventCounts.opened || 0,
      repliesReceived: monthlyEventCounts.replied || 0,
      period: 'Last 30 days'
    };

    // Response object
    const response = {
      // Main metrics
      totalCampaigns,
      totalLeads,
      avgResponseRate: Math.round(avgResponseRate * 100) / 100,
      bounceRate: Math.round(bounceRate * 100) / 100,
      
      // Additional metrics
      avgOpenRate: Math.round(avgOpenRate * 100) / 100,
      totalEmailsSent,
      
      // Email Status Distribution
      emailStatusDistribution,
      
      // Lead Performance (replaced "Converted" with "Replied")
      leadPerformance,
      
      // Monthly Summary
      monthlySummary,
      
      // Campaign breakdown with actual names
      campaignBreakdown: campaignStats,
      
      // Metadata
      dateRange: {
        startDate: startDate || 'All time',
        endDate: endDate || 'All time',
        sequenceId: sequenceId || 'All sequences',
        campaignId: campaignId || 'All campaigns'
      },
      
      // Raw event breakdown for debugging
      eventBreakdown: eventCounts,
      
      // Uncategorized events (without campaignId)
      uncategorizedEvents: {
        sent: uncategorizedEventCounts.sent || 0,
        opened: uncategorizedEventCounts.opened || 0,
        replied: uncategorizedEventCounts.replied || 0,
        bounced: uncategorizedEventCounts.bounced || 0,
        clicked: uncategorizedEventCounts.clicked || 0,
        delivered: uncategorizedEventCounts.delivered || 0
      },
      
      // Timestamp for real-time updates
      lastUpdated: new Date().toISOString()
    };

    // Enhanced analytics data logging
    console.log('✅ Analytics data generated:', {
      totalCampaigns,
      totalLeads,
      avgResponseRate: response.avgResponseRate,
      bounceRate: response.bounceRate,
      totalEmailsSent,
      monthlyEmailsSent: monthlySummary.totalEmailsSent,
      campaignsWithValidNames: campaignStats.filter(c => !c.campaignName.startsWith('Campaign ')).length,
      campaignBreakdown: campaignStats.map(c => ({
        name: c.name,
        sent: c.sent,
        opened: c.opened,
        replied: c.replied,
        bounced: c.bounced,
        openRate: c.openRate,
        replyRate: c.replyRate,
        bounceRate: c.bounceRate
      }))
    });

    // Additional detailed logging for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 Detailed Campaign Analytics:', {
        rawCampaignCount: campaignBreakdown.length,
        processedCampaignCount: campaignStats.length,
        sampleCampaignData: campaignStats.slice(0, 2).map(c => ({
          id: c.id,
          originalName: campaignBreakdown.find(orig => orig.id === c.id)?.campaignName,
          processedName: c.name,
          hasSequence: !!c.sequenceName,
          sequenceName: c.sequenceName,
          metrics: {
            sent: c.sent,
            opened: c.opened,
            replied: c.replied,
            bounced: c.bounced,
            openRate: c.openRate,
            replyRate: c.replyRate,
            bounceRate: c.bounceRate
          }
        }))
      });
    }

    res.json(response);

  } catch (error) {
    console.error('❌ Error fetching reports analytics:', {
      error: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });

    res.status(500).json({
      error: 'Failed to fetch reports analytics',
      ...(process.env.NODE_ENV !== 'production' && { details: error.message })
    });
  }
});

/**
 * GET /api/reports/performance-trends
 * Get detailed performance trends over time for charts
 */
router.get('/performance-trends', async (req, res) => {
  try {
    const { days = 30, sequenceId } = req.query;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const where = {
      timestamp: {
        gte: startDate
      }
    };

    if (sequenceId) {
      where.enrollment = {
        sequenceId
      };
    }

    const events = await prisma.event.findMany({
      where,
      select: {
        type: true,
        timestamp: true
      },
      orderBy: {
        timestamp: 'asc'
      }
    });

    // Group by date
    const dailyStats = {};
    events.forEach(event => {
      const date = event.timestamp.toISOString().split('T')[0];
      if (!dailyStats[date]) {
        dailyStats[date] = {
          sent: 0,
          opened: 0,
          replied: 0,
          bounced: 0,
          clicked: 0,
          delivered: 0
        };
      }
      const type = event.type.toLowerCase();
      if (dailyStats[date][type] !== undefined) {
        dailyStats[date][type]++;
      }
    });

    // Convert to array and calculate rates
    const trends = Object.entries(dailyStats).map(([date, stats]) => ({
      date,
      ...stats,
      openRate: stats.sent > 0 ? parseFloat(((stats.opened / stats.sent) * 100).toFixed(2)) : 0,
      responseRate: stats.sent > 0 ? parseFloat(((stats.replied / stats.sent) * 100).toFixed(2)) : 0,
      bounceRate: stats.sent > 0 ? parseFloat(((stats.bounced / stats.sent) * 100).toFixed(2)) : 0
    }));

    // Sort by date
    trends.sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json({
      trends,
      period: `${days} days`,
      totalDays: trends.length,
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error fetching performance trends:', error);
    res.status(500).json({
      error: 'Failed to fetch performance trends',
      ...(process.env.NODE_ENV !== 'production' && { details: error.message })
    });
  }
});

/**
 * GET /api/reports/campaign-performance
 * Get performance metrics for individual campaigns (not sequences)
 */
router.get('/campaign-performance', async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    // Log performance request (development only)
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Fetching campaign performance data with limit:', limit);
    }

    // Get all active campaigns with their performance metrics
    const campaigns = await prisma.campaign.findMany({
      where: { isActive: true },
      select: {
        id: true,
        campaignName: true,
        description: true,
        startDate: true,
        endDate: true,
        createdAt: true,
        sequence: {
          select: {
            id: true,
            name: true,
            description: true
          }
        },
        _count: {
          select: {
            enrollments: true,
            events: true
          }
        },
        events: {
          select: {
            type: true
          }
        }
      },
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' }
    });

    // Log campaign count (development only)
    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 Found ${campaigns.length} campaigns for performance analysis`);
    }

    // Calculate performance for each campaign using optimized approach
    const campaignPerformance = await Promise.all(campaigns.map(async campaign => {
      // Get event stats for this specific campaign
      const eventStats = await prisma.event.groupBy({
        by: ['type'],
        where: { campaignId: campaign.id },
        _count: { type: true }
      });

      const eventCounts = eventStats.reduce((acc, stat) => {
        acc[stat.type.toLowerCase()] = stat._count.type;
        return acc;
      }, {});

      const sent = eventCounts.sent || 0;
      const opened = eventCounts.opened || 0;
      const replied = eventCounts.replied || 0;
      const bounced = eventCounts.bounced || 0;
      const clicked = eventCounts.clicked || 0;
      const delivered = eventCounts.delivered || 0;

      // Get active enrollments count for this campaign
      const activeEnrollments = await prisma.enrollment.count({
        where: { 
          campaignId: campaign.id,
          status: 'ACTIVE'
        }
      });

      // Calculate status based on dates
      const now = new Date();
      let status = 'Active';
      if (!campaign.isActive) {
        status = 'Inactive';
      } else if (campaign.endDate && now > new Date(campaign.endDate)) {
        status = 'Completed';
      } else if (campaign.startDate && now < new Date(campaign.startDate)) {
        status = 'Upcoming';
      }

      return {
        id: campaign.id,
        campaignName: campaign.campaignName || 'Unknown Campaign',
        name: campaign.campaignName || 'Unknown Campaign', // Alias for backward compatibility
        description: campaign.description || '',
        sequenceName: campaign.sequence?.name || 'Unknown Sequence',
        sequenceId: campaign.sequence?.id || null,
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        status: status,
        createdAt: campaign.createdAt,
        totalEnrollments: campaign._count?.enrollments || 0,
        activeEnrollments: activeEnrollments,
        emailsSent: sent,
        emailsOpened: opened,
        repliesReceived: replied,
        emailsBounced: bounced,
        emailsClicked: clicked,
        emailsDelivered: delivered,
        openRate: sent > 0 ? parseFloat(((opened / sent) * 100).toFixed(2)) : 0,
        responseRate: sent > 0 ? parseFloat(((replied / sent) * 100).toFixed(2)) : 0,
        bounceRate: sent > 0 ? parseFloat(((bounced / sent) * 100).toFixed(2)) : 0,
        clickRate: sent > 0 ? parseFloat(((clicked / sent) * 100).toFixed(2)) : 0
      };
    }));

    // Sort by response rate (best performing first)
    campaignPerformance.sort((a, b) => b.responseRate - a.responseRate);

    // Log compilation results (development only)
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Campaign performance data compiled:', {
        totalCampaigns: campaignPerformance.length,
        campaignsWithNames: campaignPerformance.filter(c => c.campaignName !== 'Unknown Campaign').length,
        topCampaign: campaignPerformance[0]?.campaignName || 'None'
      });
    }

    res.json({
      campaigns: campaignPerformance,
      totalCampaigns: campaignPerformance.length,
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error fetching campaign performance:', error);
    res.status(500).json({
      error: 'Failed to fetch campaign performance',
      ...(process.env.NODE_ENV !== 'production' && { details: error.message })
    });
  }
});

/**
 * GET /api/reports/real-time-stats
 * Get real-time statistics for live updates
 */
router.get('/real-time-stats', async (req, res) => {
  try {
    // Get stats for the last 24 hours
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const recentEvents = await prisma.event.groupBy({
      by: ['type'],
      where: {
        timestamp: {
          gte: twentyFourHoursAgo
        }
      },
      _count: {
        type: true
      }
    });

    const recentEventCounts = recentEvents.reduce((acc, stat) => {
      acc[stat.type.toLowerCase()] = stat._count.type;
      return acc;
    }, {});

    // Get active enrollments count
    const activeEnrollments = await prisma.enrollment.count({
      where: { status: 'ACTIVE' }
    });

    // Get recent activity (last 10 events)
    const recentActivity = await prisma.event.findMany({
      take: 10,
      orderBy: {
        timestamp: 'desc'
      },
      include: {
        contact: {
          select: {
            email: true,
            firstName: true,
            lastName: true
          }
        },
        enrollment: {
          include: {
            sequence: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });

    const formattedActivity = recentActivity.map(event => ({
      id: event.id,
      type: event.type,
      timestamp: event.timestamp,
      contact: {
        email: event.contact.email,
        name: `${event.contact.firstName || ''} ${event.contact.lastName || ''}`.trim() || 'Unknown'
      },
      sequence: event.enrollment.sequence.name
    }));

    res.json({
      last24Hours: {
        emailsSent: recentEventCounts.sent || 0,
        emailsOpened: recentEventCounts.opened || 0,
        repliesReceived: recentEventCounts.replied || 0,
        emailsBounced: recentEventCounts.bounced || 0
      },
      activeEnrollments,
      recentActivity: formattedActivity,
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error fetching real-time stats:', error);
    res.status(500).json({
      error: 'Failed to fetch real-time stats',
      ...(process.env.NODE_ENV !== 'production' && { details: error.message })
    });
  }
});

/**
 * GET /api/reports/campaign-analytics
 * Get campaign-specific analytics with pie chart data
 */
router.get('/campaign-analytics', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Log campaign analytics request (development only)
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Fetching campaign analytics with filters:', {
        startDate,
        endDate
      });
    }

    // Build where clause for filtering
    const where = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    // Get all campaigns with their stats
    const campaigns = await prisma.campaign.findMany({
      where: {
        ...where,
        isActive: true
      },
      include: {
        sequence: {
          select: { name: true }
        },
        _count: {
          select: {
            campaignLeads: true,
            enrollments: true,
            events: true
          }
        }
      }
    });

    // Get detailed stats for each campaign
    const campaignStats = await Promise.all(
      campaigns.map(async (campaign) => {
        // Get event stats for this campaign
        const eventStats = await prisma.event.groupBy({
          by: ['type'],
          where: { 
            campaignId: campaign.id,
            ...(startDate || endDate ? {
              timestamp: {
                ...(startDate && { gte: new Date(startDate) }),
                ...(endDate && { lte: new Date(endDate) })
              }
            } : {})
          },
          _count: { type: true }
        });

        const eventCounts = eventStats.reduce((acc, stat) => {
          acc[stat.type.toLowerCase()] = stat._count.type;
          return acc;
        }, {});

        const sent = eventCounts.sent || 0;
        const opened = eventCounts.opened || 0;
        const replied = eventCounts.replied || 0;
        const bounced = eventCounts.bounced || 0;

        // Calculate status based on dates and isActive flag
        const now = new Date();
        let status = 'Active';
        if (!campaign.isActive) {
          status = 'Inactive';
        } else if (campaign.endDate && now > new Date(campaign.endDate)) {
          status = 'Completed';
        } else if (campaign.startDate && now < new Date(campaign.startDate)) {
          status = 'Upcoming';
        }

        return {
          id: campaign.id,
          campaignName: campaign.campaignName || 'Unknown Campaign',
          name: campaign.campaignName || 'Unknown Campaign', // Alias for backward compatibility
          sequenceName: campaign.sequence?.name || 'Unknown Sequence',
          sequenceId: campaign.sequence?.id || null,
          description: campaign.description || '',
          startDate: campaign.startDate,
          endDate: campaign.endDate,
          status: status,
          isActive: campaign.isActive,
          createdAt: campaign.createdAt,
          totalLeads: campaign._count?.campaignLeads || 0,
          totalEnrollments: campaign._count?.enrollments || 0,
          stats: {
            totalSent: sent,
            opened: opened,
            replied: replied,
            bounced: bounced,
            clicked: eventCounts.clicked || 0,
            delivered: eventCounts.delivered || 0,
            failed: eventCounts.failed || 0,
            openRate: sent > 0 ? parseFloat(((opened / sent) * 100).toFixed(2)) : 0,
            replyRate: sent > 0 ? parseFloat(((replied / sent) * 100).toFixed(2)) : 0,
            bounceRate: sent > 0 ? parseFloat(((bounced / sent) * 100).toFixed(2)) : 0
          }
        };
      })
    );

    // Prepare pie chart data for email status distribution across all campaigns
    const totalStats = campaignStats.reduce((acc, campaign) => {
      acc.sent += campaign.stats.totalSent;
      acc.opened += campaign.stats.opened;
      acc.replied += campaign.stats.replied;
      acc.bounced += campaign.stats.bounced;
      acc.clicked += campaign.stats.clicked;
      acc.delivered += campaign.stats.delivered;
      acc.failed += campaign.stats.failed;
      return acc;
    }, {
      sent: 0,
      opened: 0,
      replied: 0,
      bounced: 0,
      clicked: 0,
      delivered: 0,
      failed: 0
    });

    // Pie chart data for frontend
    const pieChartData = [
      { name: 'Sent', value: totalStats.sent, color: '#3B82F6' },
      { name: 'Opened', value: totalStats.opened, color: '#10B981' },
      { name: 'Replied', value: totalStats.replied, color: '#F59E0B' },
      { name: 'Bounced', value: totalStats.bounced, color: '#EF4444' },
      { name: 'Clicked', value: totalStats.clicked, color: '#8B5CF6' },
      { name: 'Delivered', value: totalStats.delivered, color: '#06B6D4' }
    ].filter(item => item.value > 0); // Only include non-zero values

    // Campaign performance ranking
    const topPerformingCampaigns = [...campaignStats]
      .sort((a, b) => b.stats.replyRate - a.stats.replyRate)
      .slice(0, 10);

    const response = {
      campaigns: campaignStats,
      totalCampaigns: campaignStats.length,
      summary: {
        totalLeads: campaignStats.reduce((sum, c) => sum + c.totalLeads, 0),
        totalEnrollments: campaignStats.reduce((sum, c) => sum + c.totalEnrollments, 0),
        totalEmailsSent: totalStats.sent,
        totalOpened: totalStats.opened,
        totalReplied: totalStats.replied,
        totalBounced: totalStats.bounced,
        avgOpenRate: totalStats.sent > 0 ? parseFloat(((totalStats.opened / totalStats.sent) * 100).toFixed(2)) : 0,
        avgReplyRate: totalStats.sent > 0 ? parseFloat(((totalStats.replied / totalStats.sent) * 100).toFixed(2)) : 0,
        avgBounceRate: totalStats.sent > 0 ? parseFloat(((totalStats.bounced / totalStats.sent) * 100).toFixed(2)) : 0
      },
      pieChartData,
      topPerformingCampaigns,
      dateRange: {
        startDate: startDate || 'All time',
        endDate: endDate || 'All time'
      },
      lastUpdated: new Date().toISOString()
    };

    console.log('✅ Campaign analytics compiled:', {
      totalCampaigns: response.totalCampaigns,
      totalLeads: response.summary.totalLeads,
      totalEmailsSent: response.summary.totalEmailsSent,
      avgReplyRate: response.summary.avgReplyRate,
      campaignsWithNames: campaignStats.filter(c => c.campaignName !== 'Unknown Campaign').length,
      topCampaigns: campaignStats.slice(0, 3).map(c => ({ 
        name: c.campaignName, 
        sent: c.stats.totalSent,
        replyRate: c.stats.replyRate 
      }))
    });

    res.json(response);

  } catch (error) {
    console.error('❌ Error fetching campaign analytics:', error);
    res.status(500).json({
      error: 'Failed to fetch campaign analytics',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
