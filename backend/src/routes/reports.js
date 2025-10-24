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

    console.log('📊 Fetching reports analytics with filters:', {
      startDate,
      endDate,
      sequenceId,
      campaignId
    });

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

    // Get event counts grouped by type
    const eventStats = await prisma.event.groupBy({
      by: ['type'],
      where: eventWhere,
      _count: {
        type: true
      }
    });

    // Convert to object for easier access
    const eventCounts = eventStats.reduce((acc, stat) => {
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

    // Get total campaigns (actual campaigns, not sequences)
    const totalCampaigns = await prisma.campaign.count({
      where: { isActive: true }
    });

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
      
      // Metadata
      dateRange: {
        startDate: startDate || 'All time',
        endDate: endDate || 'All time',
        sequenceId: sequenceId || 'All sequences',
        campaignId: campaignId || 'All campaigns'
      },
      
      // Raw event breakdown for debugging
      eventBreakdown: eventCounts,
      
      // Timestamp for real-time updates
      lastUpdated: new Date().toISOString()
    };

    console.log('✅ Reports analytics compiled:', {
      totalCampaigns,
      totalLeads,
      avgResponseRate: response.avgResponseRate,
      bounceRate: response.bounceRate,
      totalEmailsSent,
      monthlyEmailsSent: monthlySummary.totalEmailsSent
    });

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
 * Get performance metrics for individual campaigns/sequences
 */
router.get('/campaign-performance', async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    // Get all active sequences with their performance metrics
    const sequences = await prisma.sequence.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        enrollments: {
          select: {
            id: true,
            status: true,
            events: {
              select: {
                type: true
              }
            }
          }
        }
      },
      take: parseInt(limit)
    });

    // Calculate performance for each sequence
    const campaignPerformance = sequences.map(sequence => {
      const events = sequence.enrollments.flatMap(enrollment => enrollment.events);
      
      const eventCounts = events.reduce((acc, event) => {
        const type = event.type.toLowerCase();
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {});

      const sent = eventCounts.sent || 0;
      const opened = eventCounts.opened || 0;
      const replied = eventCounts.replied || 0;
      const bounced = eventCounts.bounced || 0;

      return {
        id: sequence.id,
        name: sequence.name,
        description: sequence.description,
        createdAt: sequence.createdAt,
        totalEnrollments: sequence.enrollments.length,
        activeEnrollments: sequence.enrollments.filter(e => e.status === 'ACTIVE').length,
        emailsSent: sent,
        emailsOpened: opened,
        repliesReceived: replied,
        emailsBounced: bounced,
        openRate: sent > 0 ? parseFloat(((opened / sent) * 100).toFixed(2)) : 0,
        responseRate: sent > 0 ? parseFloat(((replied / sent) * 100).toFixed(2)) : 0,
        bounceRate: sent > 0 ? parseFloat(((bounced / sent) * 100).toFixed(2)) : 0
      };
    });

    // Sort by response rate (best performing first)
    campaignPerformance.sort((a, b) => b.responseRate - a.responseRate);

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

    console.log('📊 Fetching campaign analytics with filters:', {
      startDate,
      endDate
    });

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

        return {
          id: campaign.id,
          name: campaign.campaignName,
          sequenceName: campaign.sequence.name,
          description: campaign.description,
          startDate: campaign.startDate,
          endDate: campaign.endDate,
          createdAt: campaign.createdAt,
          totalLeads: campaign._count.campaignLeads,
          totalEnrollments: campaign._count.enrollments,
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
      avgReplyRate: response.summary.avgReplyRate
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
