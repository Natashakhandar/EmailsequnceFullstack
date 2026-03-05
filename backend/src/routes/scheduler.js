const express = require('express');
const {
  getSchedulerStatus,
  triggerEmailProcessing,
  getPendingEmailsCount,
  getSchedulerStats
} = require('../jobs/scheduler');
const { sendTestEmail, verifyConnection } = require('../mailer/sendEmail');
const router = express.Router();

// GET /api/scheduler/status - Get scheduler status
router.get('/status', async (req, res) => {
  try {
    const status = getSchedulerStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting scheduler status:', error);
    res.status(500).json({ error: 'Failed to get scheduler status' });
  }
});

// GET /api/scheduler/stats - Get detailed scheduler statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await getSchedulerStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting scheduler stats:', error);
    res.status(500).json({ error: 'Failed to get scheduler statistics' });
  }
});

// GET /api/scheduler/pending - Get pending emails count
router.get('/pending', async (req, res) => {
  try {
    const count = await getPendingEmailsCount();
    res.json({ pendingEmails: count });
  } catch (error) {
    console.error('Error getting pending emails count:', error);
    res.status(500).json({ error: 'Failed to get pending emails count' });
  }
});

// POST /api/scheduler/trigger - Manually trigger email processing
router.post('/trigger', async (req, res) => {
  try {
    console.log('Manual email processing triggered via API');

    // Run in background to avoid timeout
    triggerEmailProcessing().catch(error => {
      console.error('Error in manual email processing:', error);
    });

    res.json({
      success: true,
      message: 'Email processing triggered successfully'
    });
  } catch (error) {
    console.error('Error triggering email processing:', error);
    res.status(500).json({ error: 'Failed to trigger email processing' });
  }
});

// POST /api/scheduler/test-email - Send test email
router.post('/test-email', async (req, res) => {
  try {
    const { to, subject, body } = req.body;

    if (!to) {
      return res.status(400).json({ error: 'Recipient email is required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const result = await sendTestEmail(
      to,
      subject || 'Test Email from Email Sequencing System',
      body || 'This is a test email to verify SMTP configuration.'
    );

    if (result.success) {
      res.json({
        success: true,
        message: 'Test email sent successfully',
        messageId: result.messageId
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        code: result.code
      });
    }
  } catch (error) {
    console.error('Error sending test email:', error);
    res.status(500).json({ error: 'Failed to send test email' });
  }
});

// GET /api/scheduler/smtp-status - Check SMTP connection
router.get('/smtp-status', async (req, res) => {
  try {
    const isConnected = await verifyConnection();

    res.json({
      connected: isConnected,
      timestamp: new Date().toISOString(),
      smtp: {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_SECURE === 'true',
        user: process.env.SMTP_USER,
        fromEmail: process.env.FROM_EMAIL,
        fromName: process.env.FROM_NAME
      },
      imap: {
        host: process.env.IMAP_HOST || '',
        port: process.env.IMAP_PORT || '993',
        tls: process.env.IMAP_TLS !== 'false',
        user: process.env.IMAP_USER || process.env.SMTP_USER || '',
        configured: !!(process.env.IMAP_HOST && process.env.IMAP_USER && process.env.IMAP_PASSWORD)
      }
    });
  } catch (error) {
    console.error('Error checking SMTP status:', error);
    res.status(500).json({
      connected: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
