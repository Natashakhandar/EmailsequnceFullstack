const express = require('express');
const prisma = require('../db/prismaClient');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// GET /api/email-config - Get user's email configuration
router.get('/', authenticateToken, async (req, res) => {
  try {
    const emailConfig = await prisma.emailConfig.findUnique({
      where: { userId: req.user.id },
      select: {
        id: true,
        smtpHost: true,
        smtpPort: true,
        smtpSecure: true,
        smtpUser: true,
        fromEmail: true,
        fromName: true,
        imapHost: true,
        imapPort: true,
        imapTls: true,
        imapUser: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!emailConfig) {
      return res.status(404).json({ error: 'Email configuration not found' });
    }

    res.json(emailConfig);
  } catch (error) {
    console.error('Error fetching email config:', error);
    res.status(500).json({ error: 'Failed to fetch email configuration' });
  }
});

// POST /api/email-config - Create or update user's email configuration
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      smtpHost,
      smtpPort,
      smtpSecure,
      smtpUser,
      smtpPassword,
      fromEmail,
      fromName,
      imapHost,
      imapPort,
      imapTls,
      imapUser,
      imapPassword,
    } = req.body;

    // Validate required SMTP fields
    if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword || !fromEmail) {
      return res.status(400).json({
        error: 'Missing required fields: smtpHost, smtpPort, smtpUser, smtpPassword, fromEmail',
      });
    }

    // Check if config exists
    const existingConfig = await prisma.emailConfig.findUnique({
      where: { userId: req.user.id },
    });

    let emailConfig;

    if (existingConfig) {
      // Update existing config
      emailConfig = await prisma.emailConfig.update({
        where: { userId: req.user.id },
        data: {
          smtpHost,
          smtpPort: parseInt(smtpPort),
          smtpSecure: Boolean(smtpSecure),
          smtpUser,
          smtpPassword,
          fromEmail,
          fromName: fromName || 'Email Sequencing System',
          imapHost,
          imapPort: imapPort ? parseInt(imapPort) : 993,
          imapTls: imapTls !== false,
          imapUser,
          imapPassword,
        },
        select: {
          id: true,
          smtpHost: true,
          smtpPort: true,
          smtpSecure: true,
          smtpUser: true,
          fromEmail: true,
          fromName: true,
          imapHost: true,
          imapPort: true,
          imapTls: true,
          imapUser: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } else {
      // Create new config
      emailConfig = await prisma.emailConfig.create({
        data: {
          userId: req.user.id,
          smtpHost,
          smtpPort: parseInt(smtpPort),
          smtpSecure: Boolean(smtpSecure),
          smtpUser,
          smtpPassword,
          fromEmail,
          fromName: fromName || 'Email Sequencing System',
          imapHost,
          imapPort: imapPort ? parseInt(imapPort) : 993,
          imapTls: imapTls !== false,
          imapUser,
          imapPassword,
        },
        select: {
          id: true,
          smtpHost: true,
          smtpPort: true,
          smtpSecure: true,
          smtpUser: true,
          fromEmail: true,
          fromName: true,
          imapHost: true,
          imapPort: true,
          imapTls: true,
          imapUser: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }

    res.json({
      success: true,
      message: existingConfig ? 'Email configuration updated' : 'Email configuration created',
      emailConfig,
    });
  } catch (error) {
    console.error('Error saving email config:', error);
    res.status(500).json({ error: 'Failed to save email configuration' });
  }
});

// POST /api/email-config/verify-smtp - Verify SMTP connection
router.post('/verify-smtp', authenticateToken, async (req, res) => {
  try {
    const { smtpHost, smtpPort, smtpSecure, smtpUser, smtpPassword } = req.body;

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword) {
      return res.status(400).json({ error: 'Missing required SMTP fields' });
    }

    const nodemailer = require('nodemailer');

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort),
      secure: Boolean(smtpSecure),
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 10000,
      socketTimeout: 10000,
    });

    // Test the connection with timeout
    const verifyPromise = transporter.verify();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Connection timeout - server took too long to respond')), 15000)
    );

    await Promise.race([verifyPromise, timeoutPromise]);

    res.json({
      success: true,
      message: 'SMTP connection verified successfully',
    });
  } catch (error) {
    console.error('SMTP verification error:', error);
    
    let errorMessage = error.message || 'Failed to verify SMTP connection';
    if (error.message.includes('Auth') || error.message.includes('username') || error.message.includes('password')) {
      errorMessage = 'Authentication failed. Please check your username and password.';
    } else if (error.message.includes('ECONNREFUSED')) {
      errorMessage = 'Connection refused. Please check your host and port.';
    } else if (error.message.includes('timeout')) {
      errorMessage = 'Connection timeout. Please check your host, port, and network.';
    } else if (error.message.includes('EHOSTUNREACH')) {
      errorMessage = 'Host unreachable. Please verify the SMTP host is correct.';
    }
    
    res.status(400).json({
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// POST /api/email-config/verify-imap - Verify IMAP connection
router.post('/verify-imap', authenticateToken, async (req, res) => {
  try {
    const { imapHost, imapPort, imapTls, imapUser, imapPassword } = req.body;

    if (!imapHost || !imapPort || !imapUser || !imapPassword) {
      return res.status(400).json({ error: 'Missing required IMAP fields' });
    }

    const Imap = require('imap');

    const imap = new Imap({
      user: imapUser,
      password: imapPassword,
      host: imapHost,
      port: parseInt(imapPort),
      tls: Boolean(imapTls),
      tlsOptions: { rejectUnauthorized: false },
      connTimeout: 10000,
      authTimeout: 5000,
    });

    // Test the connection
    const connectPromise = new Promise((resolve, reject) => {
      imap.on('error', reject);
      imap.on('ready', () => {
        imap.closeBox(() => imap.end());
        resolve();
      });
      imap.connect();
    });

    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Connection timeout - server took too long to respond')), 15000)
    );

    await Promise.race([connectPromise, timeoutPromise]);

    res.json({
      success: true,
      message: 'IMAP connection verified successfully',
    });
  } catch (error) {
    console.error('IMAP verification error:', error);
    
    let errorMessage = error.message || 'Failed to verify IMAP connection';
    if (error.message.includes('authentication') || error.message.includes('AUTH')) {
      errorMessage = 'Authentication failed. Please check your username and password.';
    } else if (error.message.includes('ECONNREFUSED')) {
      errorMessage = 'Connection refused. Please check your host and port.';
    } else if (error.message.includes('timeout')) {
      errorMessage = 'Connection timeout. Please check your host, port, and network.';
    } else if (error.message.includes('EHOSTUNREACH')) {
      errorMessage = 'Host unreachable. Please verify the IMAP host is correct.';
    }
    
    res.status(400).json({
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

module.exports = router;
