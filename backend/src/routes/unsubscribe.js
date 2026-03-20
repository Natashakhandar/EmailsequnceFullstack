const express = require('express');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../db/prismaClient');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// GET /api/unsubscribe/info/:token - Public: get contact email for unsubscribe form
router.get('/info/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const unsubscribeToken = await prisma.unsubscribeToken.findUnique({
      where: { token },
      include: { contact: { select: { email: true, status: true } } }
    });

    if (!unsubscribeToken) {
      return res.status(404).json({ error: 'Invalid unsubscribe link' });
    }

    if (unsubscribeToken.usedAt || unsubscribeToken.contact?.status === 'UNSUBSCRIBED') {
      return res.status(400).json({ error: 'Already unsubscribed', alreadyUnsubscribed: true });
    }

    const tokenAge = Date.now() - unsubscribeToken.createdAt.getTime();
    if (tokenAge > 30 * 24 * 60 * 60 * 1000) {
      return res.status(400).json({ error: 'Unsubscribe link has expired' });
    }

    res.json({ email: unsubscribeToken.contact.email });
  } catch (error) {
    console.error('Error fetching unsubscribe info:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/unsubscribe/complete - Public: complete unsubscribe with reason
router.post('/complete', async (req, res) => {
  try {
    const { token, reason } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const unsubscribeToken = await prisma.unsubscribeToken.findUnique({
      where: { token },
      include: { contact: true }
    });

    if (!unsubscribeToken) {
      return res.status(404).json({ error: 'Invalid unsubscribe link' });
    }

    if (unsubscribeToken.usedAt || unsubscribeToken.contact?.status === 'UNSUBSCRIBED') {
      return res.status(400).json({ error: 'Already unsubscribed', alreadyUnsubscribed: true });
    }

    const tokenAge = Date.now() - unsubscribeToken.createdAt.getTime();
    if (tokenAge > 30 * 24 * 60 * 60 * 1000) {
      return res.status(400).json({ error: 'Unsubscribe link has expired' });
    }

    const now = new Date();

    // Update contact: mark unsubscribed with reason and date
    const contact = await prisma.contact.update({
      where: { id: unsubscribeToken.contactId },
      data: {
        status: 'UNSUBSCRIBED',
        unsubscribeReason: reason || null,
        unsubscribedAt: now
      }
    });

    // Stop all active enrollments
    await prisma.enrollment.updateMany({
      where: { contactId: unsubscribeToken.contactId, status: 'ACTIVE' },
      data: { status: 'UNSUBSCRIBED', completedAt: now, nextSendAt: null }
    });

    // Mark token as used
    await prisma.unsubscribeToken.update({
      where: { id: unsubscribeToken.id },
      data: { usedAt: now }
    });

    // Log unsubscribe event for each affected enrollment
    const enrollments = await prisma.enrollment.findMany({
      where: { contactId: unsubscribeToken.contactId, status: 'UNSUBSCRIBED' }
    });

    for (const enrollment of enrollments) {
      await prisma.event.create({
        data: {
          enrollmentId: enrollment.id,
          contactId: unsubscribeToken.contactId,
          type: 'UNSUBSCRIBED',
          details: JSON.stringify({
            method: 'form',
            reason: reason || null,
            userAgent: req.get('User-Agent'),
            ip: req.ip
          })
        }
      });
    }

    res.json({ success: true, message: 'Successfully unsubscribed', email: contact.email });
  } catch (error) {
    console.error('Error completing unsubscribe:', error);
    res.status(500).json({ error: 'Failed to process unsubscribe request' });
  }
});

// GET /api/unsubscribe/admin/list - SUPERADMIN/MANAGER: list all unsubscribed contacts
router.get('/admin/list', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPERADMIN' && req.user.role !== 'MANAGER') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const [contacts, total] = await prisma.$transaction([
      prisma.contact.findMany({
        where: { status: 'UNSUBSCRIBED' },
        orderBy: { unsubscribedAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          company: true,
          unsubscribeReason: true,
          unsubscribedAt: true,
          updatedAt: true
        }
      }),
      prisma.contact.count({ where: { status: 'UNSUBSCRIBED' } })
    ]);

    res.json({
      contacts,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Error fetching unsubscribed list:', error);
    res.status(500).json({ error: 'Failed to fetch unsubscribed users' });
  }
});

// GET /api/unsubscribe/:token - Handle unsubscribe via token
router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // Find the unsubscribe token
    const unsubscribeToken = await prisma.unsubscribeToken.findUnique({
      where: { token },
      include: {
        contact: true
      }
    });

    if (!unsubscribeToken) {
      return res.status(404).json({ error: 'Invalid unsubscribe token' });
    }

    // Check if token was already used
    if (unsubscribeToken.usedAt) {
      return res.status(400).json({
        error: 'This unsubscribe link has already been used',
        contact: unsubscribeToken.contact
      });
    }

    // Check if token is expired (optional - you can set expiration logic)
    const tokenAge = Date.now() - unsubscribeToken.createdAt.getTime();
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

    if (tokenAge > maxAge) {
      return res.status(400).json({ error: 'Unsubscribe token has expired' });
    }

    // Update contact status to unsubscribed
    const contact = await prisma.contact.update({
      where: { id: unsubscribeToken.contactId },
      data: { status: 'UNSUBSCRIBED' }
    });

    // Stop all active enrollments for this contact
    await prisma.enrollment.updateMany({
      where: {
        contactId: unsubscribeToken.contactId,
        status: 'ACTIVE'
      },
      data: {
        status: 'UNSUBSCRIBED',
        completedAt: new Date(),
        nextSendAt: null
      }
    });

    // Mark token as used
    await prisma.unsubscribeToken.update({
      where: { id: unsubscribeToken.id },
      data: { usedAt: new Date() }
    });

    // Log unsubscribe events for all enrollments
    const enrollments = await prisma.enrollment.findMany({
      where: {
        contactId: unsubscribeToken.contactId,
        status: 'UNSUBSCRIBED'
      }
    });

    for (const enrollment of enrollments) {
      await prisma.event.create({
        data: {
          enrollmentId: enrollment.id,
          contactId: unsubscribeToken.contactId,
          type: 'UNSUBSCRIBED',
          details: JSON.stringify({
            method: 'token',
            token: token,
            userAgent: req.get('User-Agent'),
            ip: req.ip
          })
        }
      });
    }

    // Return success response (you might want to redirect to a page instead)
    res.json({
      success: true,
      message: 'Successfully unsubscribed',
      contact: {
        email: contact.email,
        firstName: contact.firstName,
        lastName: contact.lastName
      }
    });

  } catch (error) {
    console.error('Error processing unsubscribe:', error);
    res.status(500).json({ error: 'Failed to process unsubscribe request' });
  }
});

// POST /api/unsubscribe/email - Handle unsubscribe via email
router.post('/email', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find contact by email
    const contact = await prisma.contact.findUnique({
      where: { email: email.toLowerCase().trim() }
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    if (contact.status === 'UNSUBSCRIBED') {
      return res.status(400).json({
        error: 'Contact is already unsubscribed',
        contact
      });
    }

    // Update contact status
    const updatedContact = await prisma.contact.update({
      where: { id: contact.id },
      data: { status: 'UNSUBSCRIBED' }
    });

    // Stop all active enrollments
    await prisma.enrollment.updateMany({
      where: {
        contactId: contact.id,
        status: 'ACTIVE'
      },
      data: {
        status: 'UNSUBSCRIBED',
        completedAt: new Date(),
        nextSendAt: null
      }
    });

    // Log unsubscribe events
    const enrollments = await prisma.enrollment.findMany({
      where: {
        contactId: contact.id,
        status: 'UNSUBSCRIBED'
      }
    });

    for (const enrollment of enrollments) {
      await prisma.event.create({
        data: {
          enrollmentId: enrollment.id,
          contactId: contact.id,
          type: 'UNSUBSCRIBED',
          details: JSON.stringify({
            method: 'email',
            userAgent: req.get('User-Agent'),
            ip: req.ip
          })
        }
      });
    }

    res.json({
      success: true,
      message: 'Successfully unsubscribed',
      contact: {
        email: updatedContact.email,
        firstName: updatedContact.firstName,
        lastName: updatedContact.lastName
      }
    });

  } catch (error) {
    console.error('Error processing email unsubscribe:', error);
    res.status(500).json({ error: 'Failed to process unsubscribe request' });
  }
});

// POST /api/unsubscribe/generate-token - Generate unsubscribe token for contact
router.post('/generate-token', authenticateToken, async (req, res) => {
  try {
    const { contactId } = req.body;

    if (!contactId) {
      return res.status(400).json({ error: 'contactId is required' });
    }

    // Check if contact exists and belongs to user
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, userId: req.user.id }
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // Generate unique token
    const token = uuidv4();

    // Create unsubscribe token
    const unsubscribeToken = await prisma.unsubscribeToken.create({
      data: {
        token,
        contactId
      }
    });

    // Generate unsubscribe URL
    const unsubscribeUrl = `${process.env.APP_URL}/api/unsubscribe/${token}`;

    res.json({
      token: unsubscribeToken.token,
      url: unsubscribeUrl,
      contactId
    });

  } catch (error) {
    console.error('Error generating unsubscribe token:', error);
    res.status(500).json({ error: 'Failed to generate unsubscribe token' });
  }
});

// GET /api/unsubscribe/page/:token - Serve unsubscribe confirmation page
router.get('/page/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // Find the unsubscribe token
    const unsubscribeToken = await prisma.unsubscribeToken.findUnique({
      where: { token }
    });

    if (!unsubscribeToken) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Invalid Unsubscribe Link</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            .error { color: #d32f2f; }
          </style>
        </head>
        <body>
          <h1 class="error">Invalid Unsubscribe Link</h1>
          <p>This unsubscribe link is invalid or has expired.</p>
        </body>
        </html>
      `);
    }

    // Check if already used
    if (unsubscribeToken.usedAt) {
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Already Unsubscribed</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            .success { color: #2e7d32; }
          </style>
        </head>
        <body>
          <h1 class="success">Already Unsubscribed</h1>
          <p>You have already been unsubscribed from our emails.</p>
        </body>
        </html>
      `);
    }

    // Serve confirmation page
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Unsubscribe Confirmation</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
          .button { 
            background-color: #d32f2f; 
            color: white; 
            padding: 12px 24px; 
            border: none; 
            border-radius: 4px; 
            cursor: pointer; 
            font-size: 16px;
            text-decoration: none;
            display: inline-block;
          }
          .button:hover { background-color: #b71c1c; }
          .cancel { 
            background-color: #757575; 
            margin-left: 10px; 
          }
          .cancel:hover { background-color: #424242; }
        </style>
      </head>
      <body>
        <h1>Confirm Unsubscribe</h1>
        <p>Are you sure you want to unsubscribe from our emails?</p>
        <p>You will no longer receive any emails from our sequences.</p>
        
        <a href="/api/unsubscribe/${token}" class="button">Yes, Unsubscribe Me</a>
        <a href="#" onclick="window.close()" class="button cancel">Cancel</a>
        
        <script>
          // Auto-redirect after confirmation
          document.querySelector('a[href*="/api/unsubscribe/"]').addEventListener('click', function(e) {
            e.preventDefault();
            fetch('/api/unsubscribe/${token}')
              .then(response => response.json())
              .then(data => {
                if (data.success) {
                  document.body.innerHTML = \`
                    <h1 style="color: #2e7d32;">Successfully Unsubscribed</h1>
                    <p>You have been unsubscribed from all email sequences.</p>
                    <p>Email: \${data.contact.email}</p>
                  \`;
                } else {
                  document.body.innerHTML = \`
                    <h1 style="color: #d32f2f;">Error</h1>
                    <p>\${data.error || 'An error occurred while processing your request.'}</p>
                  \`;
                }
              })
              .catch(error => {
                document.body.innerHTML = \`
                  <h1 style="color: #d32f2f;">Error</h1>
                  <p>An error occurred while processing your request.</p>
                \`;
              });
          });
        </script>
      </body>
      </html>
    `);

  } catch (error) {
    console.error('Error serving unsubscribe page:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Error</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
          .error { color: #d32f2f; }
        </style>
      </head>
      <body>
        <h1 class="error">Error</h1>
        <p>An error occurred while processing your request.</p>
      </body>
      </html>
    `);
  }
});

// GET /api/unsubscribe/contacts/list - Get authenticated user's unsubscribed contacts
router.get('/contacts/list', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const skip = (page - 1) * limit;

    // Get unsubscribed contacts for the authenticated user
    const [contacts, total] = await prisma.$transaction([
      prisma.contact.findMany({
        where: {
          userId: userId,
          status: 'UNSUBSCRIBED'
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          unsubscribeReason: true,
          unsubscribedAt: true,
          updatedAt: true
        }
      }),
      prisma.contact.count({
        where: {
          userId: userId,
          status: 'UNSUBSCRIBED'
        }
      })
    ]);

    // Format response with combined name field
    const formattedContacts = contacts.map((contact) => ({
      id: contact.id,
      name: [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.email.split('@')[0],
      email: contact.email,
      reason: contact.unsubscribeReason || 'Not specified',
      unsubscribedAt: contact.unsubscribedAt || contact.updatedAt
    }));

    res.json({
      contacts: formattedContacts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching unsubscribed contacts:', error);
    res.status(500).json({ error: 'Failed to fetch unsubscribed contacts' });
  }
});

module.exports = router;
