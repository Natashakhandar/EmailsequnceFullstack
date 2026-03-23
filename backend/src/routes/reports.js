const express = require('express');
const prisma = require('../db/prismaClient');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();
router.use(authenticateToken);

function getSqlDate(dateParam) {
  if (!dateParam) return null;
  const d = new Date(dateParam);
  return isNaN(d) ? null : d;
}

/**
 * GET /api/reports/analytics
 * Get comprehensive real-time analytics for Reports page
 */
router.get('/analytics', async (req, res) => {
  try {
    const { startDate, endDate, sequenceId, campaignId } = req.query;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Fetching reports analytics with filters:', { startDate, endDate, sequenceId, campaignId });
    }

    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPERADMIN';
    const sDate = getSqlDate(startDate);
    const eDate = getSqlDate(endDate);

    // 1. Fetch Event Stats (Categorized by Campaign and Uncategorized)
    let eventQueryBase = `
      SELECT e.type, e.campaignId IS NULL as isUncategorized, COUNT(*) as count 
      FROM events e
      LEFT JOIN contacts c ON e.contactId = c.id
      LEFT JOIN enrollments en ON e.enrollmentId = en.id
      WHERE 1=1
    `;
    const eventParams = [];
    if (!isAdmin) {
      eventQueryBase += ` AND c.userId = ?`;
      eventParams.push(req.user.id);
    }
    if (sDate) {
      eventQueryBase += ` AND e.timestamp >= ?`;
      eventParams.push(sDate);
    }
    if (eDate) {
      eventQueryBase += ` AND e.timestamp <= ?`;
      eventParams.push(eDate);
    }
    if (sequenceId) {
      eventQueryBase += ` AND en.sequenceId = ?`;
      eventParams.push(sequenceId);
    }
    if (campaignId) {
      eventQueryBase += ` AND e.campaignId = ?`;
      eventParams.push(campaignId);
    }
    eventQueryBase += ` GROUP BY e.type, e.campaignId IS NULL`;

    const rawEventStats = await prisma.query(eventQueryBase, eventParams);
    
    const eventCounts = {};
    const uncategorizedEventCounts = {};
    rawEventStats.forEach(stat => {
      const type = stat.type.toLowerCase();
      if (stat.isUncategorized) {
        uncategorizedEventCounts[type] = (uncategorizedEventCounts[type] || 0) + stat.count;
      } else {
        eventCounts[type] = (eventCounts[type] || 0) + stat.count;
      }
    });

    const totalEmailsSent = eventCounts.sent || 0;
    const totalOpened = eventCounts.opened || 0;
    const totalReplied = eventCounts.replied || 0;
    const totalBounced = eventCounts.bounced || 0;
    const totalClicked = eventCounts.clicked || 0;
    const totalDelivered = eventCounts.delivered || 0;

    const avgOpenRate = totalEmailsSent > 0 ? ((totalOpened / totalEmailsSent) * 100) : 0;
    const avgResponseRate = totalEmailsSent > 0 ? ((totalReplied / totalEmailsSent) * 100) : 0;
    const bounceRate = totalEmailsSent > 0 ? ((totalBounced / totalEmailsSent) * 100) : 0;

    // 2. Get Campaign Basic Info
    let campQuery = `
      SELECT c.id, c.campaignName, c.description, c.startDate, c.endDate, s.name as sequenceName
      FROM campaigns c
      LEFT JOIN sequences s ON c.sequenceId = s.id
      WHERE 1=1
    `;
    const campParams = [];
    if (!isAdmin) {
      campQuery += ` AND c.userId = ?`;
      campParams.push(req.user.id);
    }
    if (campaignId) {
      campQuery += ` AND c.id = ?`;
      campParams.push(campaignId);
    }
    if (sDate || eDate) {
      campQuery += ` AND EXISTS (SELECT 1 FROM events e2 WHERE e2.campaignId = c.id`;
      if (sDate) {
        campQuery += ` AND e2.timestamp >= ?`;
        campParams.push(sDate);
      }
      if (eDate) {
        campQuery += ` AND e2.timestamp <= ?`;
        campParams.push(eDate);
      }
      campQuery += `)`;
    }
    const campaignBreakdown = await prisma.query(campQuery, campParams);

    // 3. Campaign Event Stats
    let campEvtQuery = `
      SELECT e.campaignId, e.type, COUNT(*) as count
      FROM events e
      LEFT JOIN enrollments en ON e.enrollmentId = en.id
      LEFT JOIN sequences s ON en.sequenceId = s.id
      WHERE e.campaignId IS NOT NULL 
        AND s.userId = ?
    `;
    const campEvtParams = [req.user.id];
    
    if (campaignBreakdown.length > 0) {
      const ids = campaignBreakdown.map(c => '"' + c.id + '"').join(',');
      campEvtQuery += ` AND e.campaignId IN (${ids})`;
    } else {
      campEvtQuery += ` AND 1=0`; // Don't fetch if no campaigns
    }
    
    if (sDate) { campEvtQuery += ` AND e.timestamp >= ?`; campEvtParams.push(sDate); }
    if (eDate) { campEvtQuery += ` AND e.timestamp <= ?`; campEvtParams.push(eDate); }
    if (sequenceId) { campEvtQuery += ` AND en.sequenceId = ?`; campEvtParams.push(sequenceId); }
    
    campEvtQuery += ` GROUP BY e.campaignId, e.type`;
    
    const rawCampEvtStats = await prisma.query(campEvtQuery, campEvtParams);

    // Combine Campaign Stats
    const campaignStats = campaignBreakdown.map(campaign => {
      const campEvts = rawCampEvtStats.filter(stat => stat.campaignId === campaign.id);
      const counts = campEvts.reduce((acc, stat) => {
        acc[stat.type.toLowerCase()] = stat.count;
        return acc;
      }, {});

      const sent = counts.sent || 0;
      const opened = counts.opened || 0;
      const replied = counts.replied || 0;
      const bounced = counts.bounced || 0;
      const cName = campaign.campaignName?.trim() || `Campaign ${campaign.id.slice(-8)}`;

      return {
        id: campaign.id,
        campaignName: cName,
        name: cName,
        sequenceName: campaign.sequenceName || 'Unknown Sequence',
        description: campaign.description || '',
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        emailsSent: sent,
        emailsOpened: opened,
        emailsReplied: replied,
        emailsBounced: bounced,
        sent, opened, replied, bounced,
        openRate: sent > 0 ? parseFloat(((opened / sent) * 100).toFixed(2)) : 0,
        replyRate: sent > 0 ? parseFloat(((replied / sent) * 100).toFixed(2)) : 0,
        bounceRate: sent > 0 ? parseFloat(((bounced / sent) * 100).toFixed(2)) : 0
      };
    });

    const totalCampaigns = campaignBreakdown.length;

    // 4. Contact and Enrollment Counts
    let leadsQuery = `SELECT COUNT(*) as cnt FROM contacts WHERE status = 'ACTIVE'`;
    let leadsParams = [];
    if (!isAdmin) { leadsQuery += ` AND userId = ?`; leadsParams.push(req.user.id); }
    const [{ cnt: totalLeads }] = await prisma.query(leadsQuery, leadsParams);

    let enrollQuery = `SELECT COUNT(*) as cnt FROM enrollments en LEFT JOIN contacts c ON en.contactId = c.id WHERE en.status = 'ACTIVE'`;
    let enrollParams = [];
    if (!isAdmin) { enrollQuery += ` AND c.userId = ?`; enrollParams.push(req.user.id); }
    const [{ cnt: activeEnrollments }] = await prisma.query(enrollQuery, enrollParams);

    // 5. Monthly Summary
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    let monthQuery = `
      SELECT e.type, COUNT(*) as count 
      FROM events e 
      LEFT JOIN contacts c ON e.contactId = c.id 
      WHERE e.timestamp >= ?
    `;
    let monthParams = [thirtyDaysAgo];
    if (!isAdmin) { monthQuery += ` AND c.userId = ?`; monthParams.push(req.user.id); }
    monthQuery += ` GROUP BY e.type`;
    
    const rawMonthStats = await prisma.query(monthQuery, monthParams);
    const monthCounts = rawMonthStats.reduce((acc, stat) => {
      acc[stat.type.toLowerCase()] = stat.count;
      return acc;
    }, {});

    const monthlySummary = {
      totalEmailsSent: monthCounts.sent || 0,
      emailsOpened: monthCounts.opened || 0,
      repliesReceived: monthCounts.replied || 0,
      period: 'Last 30 days'
    };

    const response = {
      totalCampaigns, totalLeads,
      avgResponseRate: Math.round(avgResponseRate * 100) / 100,
      bounceRate: Math.round(bounceRate * 100) / 100,
      avgOpenRate: Math.round(avgOpenRate * 100) / 100,
      totalEmailsSent,
      emailStatusDistribution: { sent: totalEmailsSent, opened: totalOpened, replied: totalReplied, bounced: totalBounced, clicked: totalClicked, delivered: totalDelivered },
      leadPerformance: { totalLeads, repliedLeads: totalReplied, replyRate: totalLeads > 0 ? ((totalReplied / totalLeads) * 100) : 0, activeEnrollments },
      monthlySummary,
      campaignBreakdown: campaignStats,
      dateRange: { startDate: startDate || 'All time', endDate: endDate || 'All time', sequenceId: sequenceId || 'All sequences', campaignId: campaignId || 'All campaigns' },
      eventBreakdown: eventCounts,
      uncategorizedEvents: {
        sent: uncategorizedEventCounts.sent || 0, opened: uncategorizedEventCounts.opened || 0, replied: uncategorizedEventCounts.replied || 0,
        bounced: uncategorizedEventCounts.bounced || 0, clicked: uncategorizedEventCounts.clicked || 0, delivered: uncategorizedEventCounts.delivered || 0
      },
      lastUpdated: new Date().toISOString()
    };

    res.json(response);

  } catch (error) {
    console.error('❌ Error fetching reports analytics:', error);
    res.status(500).json({ error: 'Failed to fetch reports analytics', details: error.message });
  }
});

/**
 * GET /api/reports/performance-trends
 */
router.get('/performance-trends', async (req, res) => {
  try {
    const { days = 30, sequenceId } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPERADMIN';

    let query = `
      SELECT DATE(e.timestamp) as date, e.type, COUNT(*) as count 
      FROM events e
      LEFT JOIN contacts c ON e.contactId = c.id
      LEFT JOIN enrollments en ON e.enrollmentId = en.id
      WHERE e.timestamp >= ?
    `;
    const params = [startDate];
    if (!isAdmin) { query += ` AND c.userId = ?`; params.push(req.user.id); }
    if (sequenceId) { query += ` AND en.sequenceId = ?`; params.push(sequenceId); }
    
    query += ` GROUP BY DATE(e.timestamp), e.type ORDER BY date ASC`;
    const rawEvents = await prisma.query(query, params);

    const dailyStats = {};
    rawEvents.forEach(evt => {
      const date = evt.date; // assuming formatting is 'YYYY-MM-DD' natively or object
      const dStr = typeof date === 'string' ? date : new Date(date).toISOString().split('T')[0];
      if (!dailyStats[dStr]) dailyStats[dStr] = { sent: 0, opened: 0, replied: 0, bounced: 0, clicked: 0, delivered: 0 };
      dailyStats[dStr][evt.type.toLowerCase()] += evt.count;
    });

    const trends = Object.entries(dailyStats).map(([date, stats]) => ({
      date, ...stats,
      openRate: stats.sent > 0 ? parseFloat(((stats.opened / stats.sent) * 100).toFixed(2)) : 0,
      responseRate: stats.sent > 0 ? parseFloat(((stats.replied / stats.sent) * 100).toFixed(2)) : 0,
      bounceRate: stats.sent > 0 ? parseFloat(((stats.bounced / stats.sent) * 100).toFixed(2)) : 0
    })).sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json({ trends, period: `${days} days`, totalDays: trends.length, lastUpdated: new Date().toISOString() });
  } catch (error) {
    console.error('❌ Error fetching performance trends:', error);
    res.status(500).json({ error: 'Failed to fetch performance trends', details: error.message });
  }
});

/**
 * GET /api/reports/campaign-performance
 */
router.get('/campaign-performance', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPERADMIN';
    
    let query = `
      SELECT c.*, s.name as sequenceName, s.id as sequenceId,
        (SELECT COUNT(*) FROM enrollments en WHERE en.campaignId = c.id AND en.status = 'ACTIVE') as activeEnrollments,
        (SELECT COUNT(*) FROM enrollments en WHERE en.campaignId = c.id) as totalEnrollments,
        (SELECT COUNT(*) FROM events e WHERE e.campaignId = c.id AND e.type = 'SENT') as emailsSent,
        (SELECT COUNT(*) FROM events e WHERE e.campaignId = c.id AND e.type = 'OPENED') as emailsOpened,
        (SELECT COUNT(*) FROM events e WHERE e.campaignId = c.id AND e.type = 'REPLIED') as emailsReplied,
        (SELECT COUNT(*) FROM events e WHERE e.campaignId = c.id AND e.type = 'BOUNCED') as emailsBounced,
        (SELECT COUNT(*) FROM events e WHERE e.campaignId = c.id AND e.type = 'CLICKED') as emailsClicked,
        (SELECT COUNT(*) FROM events e WHERE e.campaignId = c.id AND e.type = 'DELIVERED') as emailsDelivered
      FROM campaigns c
      LEFT JOIN sequences s ON c.sequenceId = s.id
      WHERE c.isActive = 1
    `;
    const params = [];
    if (!isAdmin) { query += ` AND c.userId = ?`; params.push(req.user.id); }
    query += ` ORDER BY c.createdAt DESC LIMIT ?`;
    params.push(parseInt(limit));
    
    const campaigns = await prisma.query(query, params);
    
    const campaignPerformance = campaigns.map(campaign => {
      const sent = campaign.emailsSent || 0;
      const opened = campaign.emailsOpened || 0;
      const replied = campaign.emailsReplied || 0;
      const bounced = campaign.emailsBounced || 0;
      const clicked = campaign.emailsClicked || 0;
      const delivered = campaign.emailsDelivered || 0;

      const now = new Date();
      let status = 'Active';
      if (!campaign.isActive) status = 'Inactive';
      else if (campaign.endDate && now > new Date(campaign.endDate)) status = 'Completed';
      else if (campaign.startDate && now < new Date(campaign.startDate)) status = 'Upcoming';

      return {
        id: campaign.id,
        campaignName: campaign.campaignName || 'Unknown Campaign',
        name: campaign.campaignName || 'Unknown Campaign',
        description: campaign.description || '',
        sequenceName: campaign.sequenceName || 'Unknown Sequence',
        sequenceId: campaign.sequenceId || null,
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        status,
        createdAt: campaign.createdAt,
        totalEnrollments: campaign.totalEnrollments || 0,
        activeEnrollments: campaign.activeEnrollments || 0,
        emailsSent: sent, emailsOpened: opened, repliesReceived: replied,
        emailsBounced: bounced, emailsClicked: clicked, emailsDelivered: delivered,
        openRate: sent > 0 ? parseFloat(((opened / sent) * 100).toFixed(2)) : 0,
        responseRate: sent > 0 ? parseFloat(((replied / sent) * 100).toFixed(2)) : 0,
        bounceRate: sent > 0 ? parseFloat(((bounced / sent) * 100).toFixed(2)) : 0,
        clickRate: sent > 0 ? parseFloat(((clicked / sent) * 100).toFixed(2)) : 0
      };
    });

    campaignPerformance.sort((a, b) => b.responseRate - a.responseRate);

    res.json({ campaigns: campaignPerformance, totalCampaigns: campaignPerformance.length, lastUpdated: new Date().toISOString() });
  } catch (error) {
    console.error('❌ Error fetching campaign performance:', error);
    res.status(500).json({ error: 'Failed to fetch campaign performance', details: error.message });
  }
});

/**
 * GET /api/reports/real-time-stats
 */
router.get('/real-time-stats', async (req, res) => {
  try {
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPERADMIN';

    let evQuery = `SELECT type, COUNT(*) as count FROM events e LEFT JOIN contacts c ON e.contactId = c.id WHERE e.timestamp >= ?`;
    const evParams = [twentyFourHoursAgo];
    if (!isAdmin) { evQuery += ` AND c.userId = ?`; evParams.push(req.user.id); }
    evQuery += ` GROUP BY type`;
    
    const recentEvents = await prisma.query(evQuery, evParams);
    const recentEventCounts = recentEvents.reduce((acc, stat) => {
      acc[stat.type.toLowerCase()] = stat.count;
      return acc;
    }, {});

    let enQuery = `SELECT COUNT(*) as count FROM enrollments en LEFT JOIN contacts c ON en.contactId = c.id WHERE en.status = 'ACTIVE'`;
    const enParams = [];
    if (!isAdmin) { enQuery += ` AND c.userId = ?`; enParams.push(req.user.id); }
    const [{ count: activeEnrollments }] = await prisma.query(enQuery, enParams);

    let actQuery = `
      SELECT e.id, e.type, e.timestamp, c.email, c.firstName, c.lastName, s.name as sequenceName
      FROM events e
      LEFT JOIN contacts c ON e.contactId = c.id
      LEFT JOIN enrollments en ON e.enrollmentId = en.id
      LEFT JOIN sequences s ON en.sequenceId = s.id
      WHERE 1=1
    `;
    const actParams = [];
    if (!isAdmin) { actQuery += ` AND c.userId = ?`; actParams.push(req.user.id); }
    actQuery += ` ORDER BY e.timestamp DESC LIMIT 10`;
    
    const recentActivityRaw = await prisma.query(actQuery, actParams);
    const recentActivity = recentActivityRaw.map(event => ({
      id: event.id, type: event.type, timestamp: event.timestamp,
      contact: {
        email: event.email,
        name: `\${event.firstName || ''} \${event.lastName || ''}`.trim() || 'Unknown'
      },
      sequence: event.sequenceName || 'Unknown'
    }));

    res.json({
      last24Hours: {
        emailsSent: recentEventCounts.sent || 0,
        emailsOpened: recentEventCounts.opened || 0,
        repliesReceived: recentEventCounts.replied || 0,
        emailsBounced: recentEventCounts.bounced || 0
      },
      activeEnrollments,
      recentActivity,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error fetching real-time stats:', error);
    res.status(500).json({ error: 'Failed to fetch real-time stats', details: error.message });
  }
});

/**
 * GET /api/reports/campaign-analytics
 */
router.get('/campaign-analytics', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPERADMIN';
    const sDate = getSqlDate(startDate);
    const eDate = getSqlDate(endDate);

    let campQuery = `
      SELECT c.*, s.name as sequenceName,
      (SELECT COUNT(*) FROM campaign_leads cl WHERE cl.campaignId = c.id) as totalLeads,
      (SELECT COUNT(*) FROM enrollments en WHERE en.campaignId = c.id) as totalEnrollments,
      (SELECT COUNT(*) FROM events e WHERE e.campaignId = c.id AND e.type = 'SENT') as emailsSent,
      (SELECT COUNT(*) FROM events e WHERE e.campaignId = c.id AND e.type = 'OPENED') as emailsOpened,
      (SELECT COUNT(*) FROM events e WHERE e.campaignId = c.id AND e.type = 'REPLIED') as emailsReplied,
      (SELECT COUNT(*) FROM events e WHERE e.campaignId = c.id AND e.type = 'BOUNCED') as emailsBounced,
      (SELECT COUNT(*) FROM events e WHERE e.campaignId = c.id AND e.type = 'CLICKED') as emailsClicked,
      (SELECT COUNT(*) FROM events e WHERE e.campaignId = c.id AND e.type = 'DELIVERED') as emailsDelivered,
      (SELECT COUNT(*) FROM events e WHERE e.campaignId = c.id AND e.type = 'FAILED') as emailsFailed
      FROM campaigns c
      LEFT JOIN sequences s ON c.sequenceId = s.id
      WHERE 1=1
    `;
    
    // NOTE: For /campaign-analytics, the existing code forces filtering by user:
    // where = req.user.role === 'SUPERADMIN' ? {} : { userId: req.user.id }
    // but the old code explicitly says `userId: req.user.id` in the base where clause.
    // We will do standard admin check:
    const campParams = [];
    if (!isAdmin) {
      campQuery += ` AND c.userId = ?`;
      campParams.push(req.user.id);
    }
    
    if (sDate) { campQuery += ` AND c.createdAt >= ?`; campParams.push(sDate); }
    if (eDate) { campQuery += ` AND c.createdAt <= ?`; campParams.push(eDate); }

    const campaignsRaw = await prisma.query(campQuery, campParams);

    const campaignStats = campaignsRaw.map(campaign => {
      const sent = campaign.emailsSent || 0;
      const opened = campaign.emailsOpened || 0;
      const replied = campaign.emailsReplied || 0;
      const bounced = campaign.emailsBounced || 0;
      const clicked = campaign.emailsClicked || 0;
      const delivered = campaign.emailsDelivered || 0;
      const failed = campaign.emailsFailed || 0;

      const now = new Date();
      let status = 'Active';
      if (!campaign.isActive) status = 'Inactive';
      else if (campaign.endDate && now > new Date(campaign.endDate)) status = 'Completed';
      else if (campaign.startDate && now < new Date(campaign.startDate)) status = 'Upcoming';

      return {
        id: campaign.id,
        campaignName: campaign.campaignName || 'Unknown Campaign',
        name: campaign.campaignName || 'Unknown Campaign',
        sequenceName: campaign.sequenceName || 'Unknown Sequence',
        sequenceId: campaign.sequenceId || null,
        description: campaign.description || '',
        startDate: campaign.startDate, endDate: campaign.endDate,
        status, isActive: !!campaign.isActive, createdAt: campaign.createdAt,
        totalLeads: campaign.totalLeads || 0,
        totalEnrollments: campaign.totalEnrollments || 0,
        stats: {
          totalSent: sent, opened, replied, bounced, clicked, delivered, failed,
          openRate: sent > 0 ? parseFloat(((opened / sent) * 100).toFixed(2)) : 0,
          replyRate: sent > 0 ? parseFloat(((replied / sent) * 100).toFixed(2)) : 0,
          bounceRate: sent > 0 ? parseFloat(((bounced / sent) * 100).toFixed(2)) : 0
        }
      };
    });

    const totalStats = campaignStats.reduce((acc, campaign) => {
      acc.sent += campaign.stats.totalSent;
      acc.opened += campaign.stats.opened;
      acc.replied += campaign.stats.replied;
      acc.bounced += campaign.stats.bounced;
      acc.clicked += campaign.stats.clicked;
      acc.delivered += campaign.stats.delivered;
      acc.failed += campaign.stats.failed;
      return acc;
    }, { sent: 0, opened: 0, replied: 0, bounced: 0, clicked: 0, delivered: 0, failed: 0 });

    const pieChartData = [
      { name: 'Sent', value: totalStats.sent, color: '#3B82F6' },
      { name: 'Opened', value: totalStats.opened, color: '#10B981' },
      { name: 'Replied', value: totalStats.replied, color: '#F59E0B' },
      { name: 'Bounced', value: totalStats.bounced, color: '#EF4444' },
      { name: 'Clicked', value: totalStats.clicked, color: '#8B5CF6' },
      { name: 'Delivered', value: totalStats.delivered, color: '#06B6D4' }
    ].filter(item => item.value > 0);

    const topPerformingCampaigns = [...campaignStats].sort((a, b) => b.stats.replyRate - a.stats.replyRate).slice(0, 10);

    res.json({
      campaigns: campaignStats,
      totalCampaigns: campaignStats.length,
      summary: {
        totalLeads: campaignStats.reduce((sum, c) => sum + c.totalLeads, 0),
        totalEnrollments: campaignStats.reduce((sum, c) => sum + c.totalEnrollments, 0),
        totalEmailsSent: totalStats.sent, totalOpened: totalStats.opened, totalReplied: totalStats.replied, totalBounced: totalStats.bounced,
        avgOpenRate: totalStats.sent > 0 ? parseFloat(((totalStats.opened / totalStats.sent) * 100).toFixed(2)) : 0,
        avgReplyRate: totalStats.sent > 0 ? parseFloat(((totalStats.replied / totalStats.sent) * 100).toFixed(2)) : 0,
        avgBounceRate: totalStats.sent > 0 ? parseFloat(((totalStats.bounced / totalStats.sent) * 100).toFixed(2)) : 0
      },
      pieChartData,
      topPerformingCampaigns,
      dateRange: { startDate: startDate || 'All time', endDate: endDate || 'All time' },
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error fetching campaign analytics:', error);
    res.status(500).json({ error: 'Failed to fetch campaign analytics', details: error.message });
  }
});

module.exports = router;
