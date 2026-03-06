const express = require('express');
const prisma = require('../db/prismaClient');
const router = express.Router();

// Create a 1x1 transparent PNG buffer
const transparentPixel = Buffer.from([
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
  0x0B, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
]);

/**
 * GET /api/track/open
 * Track email opens using a 1x1 tracking pixel
 */
router.get('/track/open', async (req, res) => {
  try {
    const { emailId } = req.query;

    if (!emailId) {
      console.log('❌ Open tracking: Missing emailId parameter');
      // Still return the pixel even if tracking fails
      res.set({
        'Content-Type': 'image/png',
        'Content-Length': transparentPixel.length,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      return res.send(transparentPixel);
    }

    console.log(`📧 Open tracking: Processing open for emailId: ${emailId}`);

    // Find the event with this emailId
    const existingEvent = await prisma.event.findFirst({
      where: {
        emailId: emailId,
        type: 'SENT'
      },
      include: {
        enrollment: true,
        contact: true
      }
    });

    if (!existingEvent) {
      console.log(`❌ Open tracking: No sent event found for emailId: "${emailId}"`);
      // Log all sent events to see if we have a near-match (case sensitivity etc)
      const allSent = await prisma.event.findMany({
        where: { type: 'SENT' },
        take: 5,
        select: { emailId: true }
      });
      console.log('Sample sent emailIds in DB:', allSent.map(s => s.emailId));

      // Still return the pixel
      res.set({
        'Content-Type': 'image/png',
        'Content-Length': transparentPixel.length,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      return res.send(transparentPixel);
    }

    // Check if this email was already marked as opened
    const alreadyOpened = await prisma.event.findFirst({
      where: {
        emailId: emailId,
        type: 'OPENED'
      }
    });

    if (!alreadyOpened) {
      // Create OPENED event
      await prisma.event.create({
        data: {
          enrollmentId: existingEvent.enrollmentId,
          contactId: existingEvent.contactId,
          campaignId: existingEvent.campaignId,
          type: 'OPENED',
          emailId: emailId,
          details: JSON.stringify({
            openedAt: new Date().toISOString(),
            userAgent: req.get('User-Agent') || '',
            ip: req.ip || req.connection.remoteAddress || '',
            referer: req.get('Referer') || ''
          })
        }
      });

      console.log(`✅ Open tracking: Marked email as opened for contact ${existingEvent.contact.email}`);
    } else {
      console.log(`📧 Open tracking: Email already marked as opened for emailId: ${emailId}`);
    }

    // Return the 1x1 transparent PNG
    res.set({
      'Content-Type': 'image/png',
      'Content-Length': transparentPixel.length,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.send(transparentPixel);

  } catch (error) {
    console.error('❌ Open tracking error:', error);

    // Always return the pixel, even on error
    res.set({
      'Content-Type': 'image/png',
      'Content-Length': transparentPixel.length,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.send(transparentPixel);
  }
});

/**
 * POST /api/track/reply
 * Track email replies with content
 */
router.post('/track/reply', async (req, res) => {
  try {
    const { emailId, replySubject, replyBody, replyFrom } = req.body;

    if (!emailId) {
      return res.status(400).json({ error: 'Missing emailId parameter' });
    }

    // Find the event with this emailId
    const existingEvent = await prisma.event.findFirst({
      where: {
        emailId: emailId,
        type: 'SENT'
      }
    });

    if (!existingEvent) {
      return res.status(404).json({ error: 'Email not found' });
    }

    // Check if this email was already marked as replied
    const alreadyReplied = await prisma.event.findFirst({
      where: {
        emailId: emailId,
        type: 'REPLIED'
      }
    });

    if (!alreadyReplied) {
      // Create REPLIED event with content
      await prisma.event.create({
        data: {
          enrollmentId: existingEvent.enrollmentId,
          contactId: existingEvent.contactId,
          campaignId: existingEvent.campaignId,
          type: 'REPLIED',
          emailId: emailId,
          details: JSON.stringify({
            repliedAt: new Date().toISOString(),
            replySubject: replySubject || 'Re: Your Email',
            replyBody: replyBody || 'Thank you for your email. I am interested in learning more.',
            replyFrom: replyFrom || existingEvent.contact?.email || 'client@example.com',
            source: 'manual_tracking'
          })
        }
      });

      console.log(`✅ Reply tracking: Marked email as replied with content for emailId: ${emailId}`);
    }

    res.json({
      success: true,
      message: 'Reply tracked successfully with content',
      emailId: emailId
    });

  } catch (error) {
    console.error('❌ Reply tracking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/track/reply (Legacy endpoint for backward compatibility)
 * Placeholder for future Gmail/IMAP integration
 */
router.get('/track/reply', async (req, res) => {
  try {
    const { emailId } = req.query;

    if (!emailId) {
      return res.status(400).json({ error: 'Missing emailId parameter' });
    }

    // Find the event with this emailId
    const existingEvent = await prisma.event.findFirst({
      where: {
        emailId: emailId,
        type: 'SENT'
      }
    });

    if (!existingEvent) {
      return res.status(404).json({ error: 'Email not found' });
    }

    // Check if this email was already marked as replied
    const alreadyReplied = await prisma.event.findFirst({
      where: {
        emailId: emailId,
        type: 'REPLIED'
      }
    });

    if (!alreadyReplied) {
      // Create REPLIED event
      await prisma.event.create({
        data: {
          enrollmentId: existingEvent.enrollmentId,
          contactId: existingEvent.contactId,
          campaignId: existingEvent.campaignId,
          type: 'REPLIED',
          emailId: emailId,
          details: JSON.stringify({
            repliedAt: new Date().toISOString(),
            source: 'manual_tracking'
          })
        }
      });

      console.log(`✅ Reply tracking: Marked email as replied for emailId: ${emailId}`);
    }

    res.json({
      success: true,
      message: 'Reply tracked successfully',
      emailId: emailId
    });

  } catch (error) {
    console.error('❌ Reply tracking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/track/stats/:emailId
 * Get tracking statistics for a specific email
 */
router.get('/track/stats/:emailId', async (req, res) => {
  try {
    const { emailId } = req.params;

    const events = await prisma.event.findMany({
      where: {
        emailId: emailId
      },
      orderBy: {
        timestamp: 'asc'
      },
      include: {
        contact: {
          select: {
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    if (events.length === 0) {
      return res.status(404).json({ error: 'Email not found' });
    }

    const stats = {
      emailId,
      contact: events[0].contact,
      events: events.map(event => ({
        type: event.type,
        timestamp: event.timestamp,
        details: event.details ? JSON.parse(event.details) : null
      })),
      summary: {
        sent: events.some(e => e.type === 'SENT'),
        delivered: events.some(e => e.type === 'DELIVERED'),
        opened: events.some(e => e.type === 'OPENED'),
        clicked: events.some(e => e.type === 'CLICKED'),
        replied: events.some(e => e.type === 'REPLIED'),
        bounced: events.some(e => e.type === 'BOUNCED'),
        failed: events.some(e => e.type === 'FAILED')
      }
    };

    res.json(stats);

  } catch (error) {
    console.error('❌ Stats tracking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
