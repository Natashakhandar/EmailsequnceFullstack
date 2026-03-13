const express = require('express');
const prisma = require('../db/prismaClient');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

router.use(authenticateToken);

/**
 * GET /api/dashboard/stats
 * Get comprehensive dashboard statistics for email campaigns
 */
router.get('/stats', async (req, res) => {
  try {
    const { startDate, endDate, sequenceId } = req.query;

    // Build where clause for filtering
    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPERADMIN';
    const where = isAdmin ? {} : {
      contact: { userId: req.user.id }
    };
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    if (sequenceId) {
      where.enrollment = {
        ...(where.enrollment || {}),
        sequenceId
      };
    }

    console.log('📊 Fetching dashboard statistics with filters:', {
      startDate,
      endDate,
      sequenceId,
      whereClause: where
    });

    // Get event counts grouped by type
    const eventStats = await prisma.event.groupBy({
      by: ['type'],
      where,
      _count: {
        type: true
      }
    });

    console.log('📈 Raw event statistics:', eventStats);

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

    // Calculate rates
    const openRate = totalEmailsSent > 0 ? ((totalOpened / totalEmailsSent) * 100) : 0;
    const replyRate = totalEmailsSent > 0 ? ((totalReplied / totalEmailsSent) * 100) : 0;
    const bounceRate = totalEmailsSent > 0 ? ((totalBounced / totalEmailsSent) * 100) : 0;

    // Get daily activity for the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const dailyEvents = await prisma.event.findMany({
      where: {
        ...where,
        timestamp: {
          gte: sevenDaysAgo,
          ...(where.timestamp || {})
        }
      },
      select: {
        type: true,
        timestamp: true
      },
      orderBy: {
        timestamp: 'asc'
      }
    });

    // Group daily activity by day of week (0 = Sunday, 6 = Saturday)
    const dailyActivity = new Array(7).fill(0);
    dailyEvents.forEach(event => {
      const dayOfWeek = event.timestamp.getDay();
      dailyActivity[dayOfWeek]++;
    });

    // Get weekly performance for the last 4 weeks
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

    const weeklyEvents = await prisma.event.findMany({
      where: {
        ...where,
        timestamp: {
          gte: fourWeeksAgo,
          ...(where.timestamp || {})
        }
      },
      select: {
        type: true,
        timestamp: true
      },
      orderBy: {
        timestamp: 'asc'
      }
    });

    // Group weekly performance by week
    const weeklyPerformance = new Array(4).fill(0);
    const now = new Date();
    weeklyEvents.forEach(event => {
      const daysDiff = Math.floor((now - event.timestamp) / (1000 * 60 * 60 * 24));
      const weekIndex = Math.floor(daysDiff / 7);
      if (weekIndex < 4) {
        weeklyPerformance[3 - weekIndex]++; // Reverse order (oldest to newest)
      }
    });

    // Get additional metrics
    const totalSequences = await prisma.sequence.count({
      where: {
        isActive: true,
        ...(isAdmin ? {} : { userId: req.user.id })
      }
    });
    const totalContacts = await prisma.contact.count({
      where: {
        status: 'ACTIVE',
        ...(isAdmin ? {} : { userId: req.user.id })
      }
    });
    const activeEnrollments = await prisma.enrollment.count({
      where: {
        status: 'ACTIVE',
        ...(isAdmin ? {} : { contact: { userId: req.user.id } })
      }
    });

    const response = {
      totalEmailsSent,
      openRate: {
        percentage: Math.round(openRate * 100) / 100,
        count: totalOpened
      },
      replyRate: {
        percentage: Math.round(replyRate * 100) / 100,
        count: totalReplied
      },
      bounceRate: {
        percentage: Math.round(bounceRate * 100) / 100,
        count: totalBounced
      },
      dailyActivity,
      weeklyPerformance,
      additionalMetrics: {
        totalSequences,
        totalContacts,
        activeEnrollments,
        totalDelivered: eventCounts.delivered || 0,
        totalClicked: eventCounts.clicked || 0,
        totalUnsubscribed: eventCounts.unsubscribed || 0,
        totalFailed: eventCounts.failed || 0
      },
      eventBreakdown: eventCounts,
      dateRange: {
        startDate: startDate || 'All time',
        endDate: endDate || 'All time',
        sequenceId: sequenceId || 'All sequences'
      }
    };

    console.log('✅ Dashboard statistics compiled successfully');
    res.json(response);

  } catch (error) {
    console.error('❌ CRITICAL ERROR in dashboard/stats:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack
    });

    res.status(500).json({
      error: 'Failed to fetch dashboard statistics',
      details: error.message,
      ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
    });
  }
});

/**
 * GET /api/dashboard/recent-activity
 * Get recent email activity for dashboard feed
 */
router.get('/recent-activity', async (req, res) => {
  try {
    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPERADMIN';
    const where = isAdmin ? {} : {
      contact: { userId: req.user.id }
    };

    const activities = await prisma.event.findMany({
      where,
      take: 20,
      orderBy: {
        timestamp: 'desc'
      },
      include: {
        contact: {
          select: {
            id: true,
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

    const formattedActivity = activities.map(activity => ({
      id: activity.id,
      type: activity.type,
      timestamp: activity.timestamp,
      contact: {
        email: activity.contact?.email || 'unknown',
        name: `${activity.contact?.firstName || ''} ${activity.contact?.lastName || ''}`.trim() || activity.contact?.email || 'Unknown Contact'
      },
      sequence: activity.enrollment?.sequence?.name || 'Manual'
    }));

    console.log(`✅ Returning ${formattedActivity.length} real activity events`);

    res.json({
      recentActivity: formattedActivity,
      count: formattedActivity.length
    });
  } catch (error) {
    console.error('❌ Error in recent activity:', error);
    res.status(500).json({
      error: 'Failed to fetch recent activity',
      details: error.message
    });
  }
});

/**
 * GET /api/dashboard/performance-trends
 * Get performance trends over time
 */
router.get('/performance-trends', async (req, res) => {
  try {
    const { days = 30, sequenceId } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPERADMIN';
    const where = {
      timestamp: {
        gte: startDate
      },
      ...(isAdmin ? {} : { contact: { userId: req.user.id } })
    };

    if (sequenceId) {
      where.enrollment = {
        ...(where.enrollment || {}),
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
      openRate: stats.sent > 0 ? ((stats.opened / stats.sent) * 100).toFixed(2) : 0,
      replyRate: stats.sent > 0 ? ((stats.replied / stats.sent) * 100).toFixed(2) : 0,
      bounceRate: stats.sent > 0 ? ((stats.bounced / stats.sent) * 100).toFixed(2) : 0
    }));

    res.json({
      trends,
      period: `${days} days`,
      totalDays: trends.length
    });

  } catch (error) {
    console.error('❌ Error fetching performance trends:', error);
    res.status(500).json({
      error: 'Failed to fetch performance trends',
      ...(process.env.NODE_ENV !== 'production' && { details: error.message })
    });
  }
});

module.exports = router;
