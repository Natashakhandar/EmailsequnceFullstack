const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const prisma = require('../db/prismaClient');
const router = express.Router();

router.use(authenticateToken);

/**
 * GET /api/dashboard/stats
 * Get comprehensive dashboard statistics for email campaigns
 */
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.id;
    const pool = await prisma.getPool();

    // 1. Get base counts
    const [[{ totalSequences }]] = await pool.query('SELECT COUNT(*) as totalSequences FROM sequences WHERE userId = ?', [userId]);
    const [[{ totalContacts }]] = await pool.query('SELECT COUNT(*) as totalContacts FROM contacts WHERE userId = ?', [userId]);

    // 2. Get active enrollments 
    const [[{ activeEnrollments }]] = await pool.query(`
      SELECT COUNT(*) as activeEnrollments 
      FROM enrollments e 
      JOIN sequences s ON e.sequenceId = s.id 
      WHERE s.userId = ? AND e.status = 'ACTIVE'
    `, [userId]);

    // 3. Get event breakdown
    const [eventCounts] = await pool.query(`
      SELECT e.type, COUNT(*) as count 
      FROM events e 
      JOIN contacts c ON e.contactId = c.id 
      WHERE c.userId = ?
      GROUP BY e.type
    `, [userId]);

    const eventBreakdown = {
      sent: 0, delivered: 0, opened: 0, clicked: 0, 
      replied: 0, bounced: 0, unsubscribed: 0, failed: 0
    };

    eventCounts.forEach(row => {
      const type = row.type.toLowerCase();
      if (typeof eventBreakdown[type] !== 'undefined') {
        eventBreakdown[type] = row.count;
      }
    });

    // 4. Calculate daily activity (current week, Sunday to Saturday)
    const [dailyQuery] = await pool.query(`
      SELECT CAST(DAYOFWEEK(e.timestamp) AS UNSIGNED) as dayOfWeek, COUNT(*) as count 
      FROM events e 
      JOIN contacts c ON e.contactId = c.id 
      WHERE c.userId = ? 
        AND e.type = 'SENT'
        AND e.timestamp >= DATE_SUB(CURDATE(), INTERVAL DAYOFWEEK(CURDATE())-1 DAY)
      GROUP BY DAYOFWEEK(e.timestamp)
    `, [userId]);

    const dailyActivity = [0, 0, 0, 0, 0, 0, 0];
    dailyQuery.forEach(row => {
      // DAYOFWEEK returns 1 for Sunday, 2 for Monday
      if (row.dayOfWeek >= 1 && row.dayOfWeek <= 7) {
        dailyActivity[row.dayOfWeek - 1] = Number(row.count);
      }
    });

    // 5. Calculate weekly performance (current month, weeks 1 to 4)
    const [weeklyQuery] = await pool.query(`
      SELECT CAST(CEIL(DAY(e.timestamp)/7) AS UNSIGNED) as weekOfMonth, COUNT(*) as count 
      FROM events e 
      JOIN contacts c ON e.contactId = c.id 
      WHERE c.userId = ? 
        AND e.type = 'SENT'
        AND YEAR(e.timestamp) = YEAR(CURDATE()) AND MONTH(e.timestamp) = MONTH(CURDATE())
      GROUP BY CEIL(DAY(e.timestamp)/7)
    `, [userId]);

    const weeklyPerformance = [0, 0, 0, 0];
    weeklyQuery.forEach(row => {
      // Map week 1-5 to array index 0-3 (cap 5th week into 4th)
      const index = Math.min(row.weekOfMonth - 1, 3);
      if (index >= 0) {
        weeklyPerformance[index] += Number(row.count);
      }
    });

    const totalSentCount = eventBreakdown.sent || 0;
    const calculateRate = (count, total) => total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0;

    const response = {
      totalEmailsSent: totalSentCount,
      openRate: {
        percentage: calculateRate(eventBreakdown.opened, totalSentCount),
        count: eventBreakdown.opened
      },
      replyRate: {
        percentage: calculateRate(eventBreakdown.replied, totalSentCount),
        count: eventBreakdown.replied
      },
      bounceRate: {
        percentage: calculateRate(eventBreakdown.bounced, totalSentCount),
        count: eventBreakdown.bounced
      },
      dailyActivity,
      weeklyPerformance,
      additionalMetrics: {
        totalSequences: Number(totalSequences) || 0,
        totalContacts: Number(totalContacts) || 0,
        activeEnrollments: Number(activeEnrollments) || 0,
        totalDelivered: eventBreakdown.delivered,
        totalClicked: eventBreakdown.clicked,
        totalUnsubscribed: eventBreakdown.unsubscribed,
        totalFailed: eventBreakdown.failed
      },
      eventBreakdown,
      dateRange: {
        startDate: 'All time',
        endDate: 'All time',
        sequenceId: 'All sequences'
      }
    };

    console.log('✅ Dashboard statistics successfully generated for user:', userId);
    res.json(response);

  } catch (error) {
    console.error('❌ Error fetching dashboard statistics:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

/**
 * GET /api/dashboard/recent-activity
 */
router.get('/recent-activity', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 10;
    const pool = await prisma.getPool();

    const [recentActivity] = await pool.query(`
      SELECT e.id, e.type, e.timestamp, 
             c.email as contactEmail, c.firstName as contactFirstName, c.lastName as contactLastName,
             s.name as sequenceName
      FROM events e
      JOIN contacts c ON e.contactId = c.id
      LEFT JOIN enrollments en ON e.enrollmentId = en.id
      LEFT JOIN sequences s ON en.sequenceId = s.id
      WHERE c.userId = ?
      ORDER BY e.timestamp DESC
      LIMIT ?
    `, [userId, limit]);

    const formattedActivity = recentActivity.map(row => ({
      id: row.id,
      type: row.type,
      timestamp: row.timestamp,
      contact: {
        email: row.contactEmail,
        name: `${row.contactFirstName || ''} ${row.contactLastName || ''}`.trim() || 'Unknown'
      },
      sequence: row.sequenceName || 'Unknown Sequence'
    }));

    res.json({ recentActivity: formattedActivity, count: formattedActivity.length });
  } catch (error) {
    console.error('❌ Error in recent activity:', error);
    res.status(500).json({ error: 'Failed to fetch recent activity' });
  }
});

/**
 * GET /api/dashboard/performance-trends
 */
router.get('/performance-trends', async (req, res) => {
  try {
    const userId = req.user.id;
    const days = parseInt(req.query.days) || 30;
    const pool = await prisma.getPool();

    // Generate dates for the last N days
    const trendsMap = new Map();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      trendsMap.set(dateStr, { date: dateStr, sent: 0, opened: 0, clicked: 0, replied: 0 });
    }

    // Query events grouped by date and type
    const [eventTrends] = await pool.query(`
      SELECT DATE(e.timestamp) as dateStr, e.type, COUNT(*) as count
      FROM events e
      JOIN contacts c ON e.contactId = c.id
      WHERE c.userId = ? 
        AND e.timestamp >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        AND e.type IN ('SENT', 'OPENED', 'CLICKED', 'REPLIED')
      GROUP BY DATE(e.timestamp), e.type
    `, [userId, days]);

    eventTrends.forEach(row => {
      // row.dateStr might be a Date object depending on mysql2 driver settings, we format it to YYYY-MM-DD
      const dateKey = row.dateStr instanceof Date 
         ? row.dateStr.toISOString().split('T')[0] 
         : String(row.dateStr).split('T')[0];
         
      if (trendsMap.has(dateKey)) {
        const type = row.type.toLowerCase();
        trendsMap.get(dateKey)[type] = Number(row.count);
      }
    });

    res.json({
      trends: Array.from(trendsMap.values()),
      period: `${days} days`,
      totalDays: days
    });

  } catch (error) {
    console.error('❌ Error fetching performance trends:', error);
    res.status(500).json({ error: 'Failed to fetch performance trends' });
  }
});

module.exports = router;
