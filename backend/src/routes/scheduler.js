const express = require('express');
const {
  getSchedulerStatus,
  triggerEmailProcessing,
  getPendingEmailsCount,
  getSchedulerStats
} = require('../jobs/scheduler');
const { sendTestEmail, verifyConnection } = require('../mailer/sendEmail');
const prisma = require('../db/prismaClient');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Apply auth middleware to all scheduler routes since it manages user settings
router.use(authenticateToken);

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

router.post('/test-email', async (req, res) => {
  try {
    const { to, subject, body, smtpHost, smtpPort, smtpSecure, smtpUser, smtpPassword, fromEmail, fromName } = req.body;

    if (!to) {
      return res.status(400).json({ error: 'Recipient email is required' });
    }

    // Validate email format with trimming
    const trimmedTo = String(to || '').trim();
    const emailRegex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

    if (process.env.NODE_ENV === 'development') {
      console.log('📝 Validating test email recipient:', `"${trimmedTo}"`, 'Length:', trimmedTo.length);
    }

    if (!emailRegex.test(trimmedTo)) {
      console.log('❌ Email validation failed for:', `"${trimmedTo}"`);
      return res.status(400).json({ error: `Invalid email format: "${trimmedTo}"` });
    }

    // Determine config: prefer body config for real-time testing, fallback to DB
    let userConfig = null;
    if (smtpHost && smtpUser && smtpPassword) {
      userConfig = {
        smtpHost,
        smtpPort: smtpPort ? (typeof smtpPort === 'string' ? parseInt(smtpPort) : smtpPort) : 465,
        smtpSecure: smtpSecure !== undefined ? smtpSecure : true,
        smtpUser,
        smtpPassword,
        fromEmail: fromEmail || smtpUser,
        fromName: fromName || req.user.firstName || 'User'
      };
    } else {
      userConfig = await prisma.emailConfig.findUnique({
        where: { userId: req.user.id }
      });
    }

    const { sendTestEmail } = require('../mailer/sendEmail');
    const result = await sendTestEmail(
      trimmedTo,
      subject || 'Test Email from Email Sequencing System',
      body || 'This is a test email to verify SMTP configuration.',
      userConfig
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
        error: result.error || 'Failed to send test email',
        code: result.code
      });
    }
  } catch (error) {
    console.error('Error sending test email:', error);
    res.status(500).json({ error: 'Failed to send test email' });
  }
});

// POST /api/scheduler/imap-test - Test IMAP connection
router.post('/imap-test', async (req, res) => {
  try {
    const { imapHost, imapPort, imapTls, imapUser, imapPassword } = req.body;

    // Check if we have enough to test
    const hasBodyConfig = !!(imapHost && imapUser && imapPassword);

    let config = null;
    if (hasBodyConfig) {
      config = {
        imapHost,
        imapPort: imapPort ? parseInt(imapPort) : 993,
        imapTls: imapTls !== undefined ? imapTls : true,
        imapUser,
        imapPassword
      };
    } else {
      config = await prisma.emailConfig.findUnique({
        where: { userId: req.user.id }
      });
    }

    if (!config || (!config.imapHost && !hasBodyConfig)) {
      return res.status(400).json({
        success: false,
        error: 'Missing IMAP configuration. Please fill in Host, User, and Password.'
      });
    }

    const EmailMonitorService = require('../services/emailMonitor');
    const monitor = new EmailMonitorService(config);
    const isConnected = await monitor.testConnection();

    if (isConnected) {
      res.json({
        success: true,
        message: 'IMAP connection successful'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'IMAP connection failed. Please check your host, port, and credentials.'
      });
    }
  } catch (error) {
    console.error('IMAP test endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error testing IMAP connection'
    });
  }
});

// GET /api/scheduler/imap-test-get (Legacy compatibility)
router.get('/imap-test', async (req, res) => {
  try {
    const userConfig = await prisma.emailConfig.findUnique({
      where: { userId: req.user.id }
    });

    if (!userConfig) {
      return res.status(400).json({ success: false, message: 'Settings not found' });
    }

    const EmailMonitorService = require('../services/emailMonitor');
    const monitor = new EmailMonitorService(userConfig);
    const isConnected = await monitor.testConnection();

    if (isConnected) {
      res.json({ success: true, message: 'IMAP connection successful' });
    } else {
      res.status(500).json({ success: false, message: 'IMAP connection failed' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/scheduler/smtp-config - Save user-specific SMTP/IMAP configuration
router.post('/smtp-config', async (req, res) => {
  try {
    const {
      smtpHost, smtpPort, smtpSecure, smtpUser, smtpPassword, fromEmail, fromName,
      imapHost, imapPort, imapTls, imapUser, imapPassword
    } = req.body;

    const data = {
      smtpHost: smtpHost || null,
      smtpPort: smtpPort ? parseInt(smtpPort) : null,
      smtpSecure: !!smtpSecure,
      smtpUser: smtpUser || null,
      smtpPassword: smtpPassword || null,
      fromEmail: fromEmail || null,
      fromName: fromName || null,

      imapHost: imapHost || null,
      imapPort: imapPort ? parseInt(imapPort) : null,
      imapTls: !!imapTls,
      imapUser: imapUser || null,
      imapPassword: imapPassword || null,
    };

    const config = await prisma.emailConfig.upsert({
      where: { userId: req.user.id },
      update: data,
      create: {
        userId: req.user.id,
        ...data
      }
    });

    res.json({ success: true, message: 'Email configuration saved successfully', config });
  } catch (error) {
    console.error('Error saving email config:', error);
    res.status(500).json({ success: false, error: 'Failed to save email configuration' });
  }
});

// GET /api/scheduler/smtp-status - Check SMTP connection & fetch config
router.get('/smtp-status', async (req, res) => {
  try {
    // 1. Fetch user-specific config
    const userConfig = await prisma.emailConfig.findUnique({
      where: { userId: req.user.id }
    });

    let isConnected = false;
    let isImapConnected = false;
    const isConfigured = !!userConfig;

    if (userConfig) {
      // 2. Verify connection specifically using user credentials
      try {
        isConnected = await verifyConnection(userConfig);
      } catch (e) {
        console.error('SMTP Verification failed', e.message);
      }

      // 3. Verify IMAP connection as well
      try {
        if (userConfig.imapHost && userConfig.imapUser && userConfig.imapPassword) {
          const EmailMonitorService = require('../services/emailMonitor');
          const monitor = new EmailMonitorService(userConfig);
          isImapConnected = await monitor.testConnection();
        }
      } catch (e) {
        console.error('IMAP Verification failed', e.message);
      }
    }

    // Determine values: Preference for User settings. 
    // Return empty strings for blank fields to avoid confusion with placeholders.
    const smtp = {
      host: userConfig?.smtpHost || '',
      port: userConfig?.smtpPort || '',
      secure: userConfig?.smtpSecure !== undefined ? userConfig?.smtpSecure : true,
      user: userConfig?.smtpUser || '',
      password: userConfig?.smtpPassword || '',
      fromEmail: userConfig?.fromEmail || '',
      fromName: userConfig?.fromName || ''
    };

    const imap = {
      host: userConfig?.imapHost || '',
      port: userConfig?.imapPort || '993',
      tls: userConfig?.imapTls !== undefined ? userConfig?.imapTls : true,
      user: userConfig?.imapUser || '',
      password: userConfig?.imapPassword || '',
      configured: !!(userConfig?.imapHost && userConfig?.imapUser && userConfig?.imapPassword)
    };

    res.json({
      connected: isConnected,
      imapConnected: isImapConnected,
      isConfigured: isConfigured,
      timestamp: new Date().toISOString(),
      smtp,
      imap
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

// POST /api/scheduler/smtp-test - Test SMTP from body
router.post('/smtp-test', async (req, res) => {
  try {
    const { smtpHost, smtpPort, smtpSecure, smtpUser, smtpPassword } = req.body;

    if (!smtpHost || !smtpUser || !smtpPassword) {
      return res.status(400).json({
        success: false,
        error: 'Missing SMTP details. Please fill in Host, Username, and Password.'
      });
    }

    const testConfig = {
      smtpHost,
      smtpPort: smtpPort ? parseInt(smtpPort) : 465,
      smtpSecure: smtpSecure !== undefined ? smtpSecure : true,
      smtpUser,
      smtpPassword
    };

    const { verifyConnectionDetailed } = require('../mailer/sendEmail');
    const result = await verifyConnectionDetailed(testConfig);

    if (result.success) {
      res.json({ success: true, message: 'SMTP connection successful' });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'SMTP connection failed'
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
