const express = require('express');
const EmailMonitorService = require('../services/emailMonitor');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/email-monitoring/test
 * Test IMAP connection
 */
router.get('/test', authenticateToken, async (req, res) => {
  try {
    const monitor = new EmailMonitorService();
    const isConnected = await monitor.testConnection();

    if (isConnected) {
      res.json({
        success: true,
        message: 'IMAP connection successful',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'IMAP connection failed',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('IMAP test error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/email-monitoring/check-replies
 * Manually check for new email replies
 */
router.post('/check-replies', authenticateToken, async (req, res) => {
  try {
    console.log('📧 Manual reply check triggered by user');

    const monitor = new EmailMonitorService();
    const processedCount = await monitor.processReplyEmails();

    res.json({
      success: true,
      message: `Successfully processed ${processedCount} new replies`,
      processedCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Reply check error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/email-monitoring/status
 * Get email monitoring status and configuration
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const config = {
      imapHost: process.env.IMAP_HOST || process.env.SMTP_HOST || 'Not configured',
      imapPort: process.env.IMAP_PORT || '993',
      imapUser: process.env.IMAP_USER || process.env.SMTP_USER || 'Not configured',
      isConfigured: !!(process.env.IMAP_HOST || process.env.SMTP_HOST) &&
        !!(process.env.IMAP_USER || process.env.SMTP_USER) &&
        !!(process.env.IMAP_PASSWORD || process.env.SMTP_PASS)
    };

    res.json({
      success: true,
      config,
      message: config.isConfigured ? 'Email monitoring is configured' : 'Email monitoring needs configuration',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/email-monitoring/recent-emails
 * Fetch recent emails from inbox (for debugging)
 */
router.get('/recent-emails', authenticateToken, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const monitor = new EmailMonitorService();

    const emails = await monitor.fetchRecentEmails(days);

    // Return sanitized email data (no full content for security)
    const sanitizedEmails = emails.map(email => ({
      seqno: email.seqno,
      subject: email.parsed?.subject || 'No Subject',
      from: email.parsed?.from?.text || 'Unknown Sender',
      date: email.parsed?.date || 'Unknown Date',
      messageId: email.parsed?.messageId,
      hasAttachments: (email.parsed?.attachments?.length || 0) > 0
    }));

    res.json({
      success: true,
      emails: sanitizedEmails,
      count: sanitizedEmails.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Recent emails fetch error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
