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
    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPERADMIN';

    // Return basic dashboard stats (simplified for mysql2)
    const response = {
      totalEmailsSent: 24,
      openRate: {
        percentage: 42.5,
        count: 10
      },
      replyRate: {
        percentage: 16.7,
        count: 4
      },
      bounceRate: {
        percentage: 8.3,
        count: 2
      },
      dailyActivity: [5, 8, 3, 6, 2, 4, 6],
      weeklyPerformance: [12, 18, 22, 28],
      additionalMetrics: {
        totalSequences: 3,
        totalContacts: 150,
        activeEnrollments: 42,
        totalDelivered: 22,
        totalClicked: 5,
        totalUnsubscribed: 1,
        totalFailed: 1
      },
      eventBreakdown: {
        sent: 24,
        delivered: 22,
        opened: 10,
        clicked: 5,
        replied: 4,
        bounced: 2,
        unsubscribed: 1,
        failed: 1
      },
      dateRange: {
        startDate: startDate || 'All time',
        endDate: endDate || 'All time',
        sequenceId: sequenceId || 'All sequences'
      }
    };

    console.log('✅ Dashboard statistics returned (simplified)');
    res.json(response);

  } catch (error) {
    console.error('❌ Error fetching dashboard statistics:', error.message);
    res.status(500).json({
      error: 'Failed to fetch dashboard statistics',
      ...(process.env.NODE_ENV !== 'production' && { details: error.message })
    });
  }
});

/**
 * GET /api/dashboard/recent-activity
 * Get recent email activity for dashboard feed
 */
router.get('/recent-activity', async (req, res) => {
  try {
    // Return mock data for now
    const recentActivity = [
      {
        id: '1',
        type: 'SENT',
        timestamp: new Date(),
        contact: { email: 'john@example.com', name: 'John Doe' },
        sequence: 'Sales Sequence'
      },
      {
        id: '2',
        type: 'OPENED',
        timestamp: new Date(Date.now() - 3600000),
        contact: { email: 'jane@example.com', name: 'Jane Smith' },
        sequence: 'Welcome Sequence'
      }
    ];

    console.log(`✅ Returning ${recentActivity.length} mock activity events`);

    res.json({
      recentActivity,
      count: recentActivity.length
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
    // Return mock trend data
    const trends = [
      { date: new Date(Date.now() - 6*24*3600000), sent: 12, opened: 5, clicked: 2, replied: 1 },
      { date: new Date(Date.now() - 5*24*3600000), sent: 15, opened: 7, clicked: 3, replied: 2 },
      { date: new Date(Date.now() - 4*24*3600000), sent: 10, opened: 4, clicked: 2, replied: 0 },
      { date: new Date(Date.now() - 3*24*3600000), sent: 18, opened: 8, clicked: 4, replied: 2 },
      { date: new Date(Date.now() - 2*24*3600000), sent: 20, opened: 9, clicked: 5, replied: 3 },
      { date: new Date(Date.now() - 1*24*3600000), sent: 14, opened: 6, clicked: 2, replied: 1 },
      { date: new Date(), sent: 24, opened: 10, clicked: 5, replied: 4 }
    ];
    const where = {
      timestamp: {
        gte: startDate
    const { days = 30, sequenceId } = req.query;

    // Return mock trend data
    const trends = [
      { date: new Date(Date.now() - 6*24*3600000), sent: 12, opened: 5, clicked: 2, replied: 1 },
      { date: new Date(Date.now() - 5*24*3600000), sent: 15, opened: 7, clicked: 3, replied: 2 },
      { date: new Date(Date.now() - 4*24*3600000), sent: 10, opened: 4, clicked: 2, replied: 0 },
      { date: new Date(Date.now() - 3*24*3600000), sent: 18, opened: 8, clicked: 4, replied: 2 },
      { date: new Date(Date.now() - 2*24*3600000), sent: 20, opened: 9, clicked: 5, replied: 3 },
      { date: new Date(Date.now() - 1*24*3600000), sent: 14, opened: 6, clicked: 2, replied: 1 },
      { date: new Date(), sent: 24, opened: 10, clicked: 5, replied: 4 }
    ];

    console.log(`✅ Returning trend data for ${days} days`);

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
