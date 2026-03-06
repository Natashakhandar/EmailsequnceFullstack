const express = require('express');
const prisma = require('../db/prismaClient');
const { broadcastRealTimeEvent } = require('../services/socketService');
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

    // Helper to send the transparent pixel response
    const sendPixel = () => {
      res.set({
        'Content-Type': 'image/png',
        'Content-Length': transparentPixel.length,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      return res.send(transparentPixel);
    };

    if (!emailId) {
      // console.log('❌ Open tracking: Missing emailId parameter');
      return sendPixel();
    }

    // Find the original SENT event with this emailId
    const existingEvent = await prisma.event.findFirst({
      where: {
        emailId: emailId,
        type: 'SENT'
      },
      include: {
        contact: true
      }
    });

    if (!existingEvent) {
      // console.log(`❌ Open tracking: No sent event found for emailId: "${emailId}"`);
      return sendPixel();
    }

    // UNIQUE OPEN CHECK: Check if this specific email was already marked as opened
    const alreadyOpened = await prisma.event.findFirst({
      where: {
        emailId: emailId,
        type: 'OPENED'
      }
    });

    if (!alreadyOpened) {
      // Create OPENED event - ONLY ONCE per emailId
      const newEvent = await prisma.event.create({
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

      console.log(`✅ UNIQUE OPEN: Email ${emailId} opened by ${existingEvent.contact.email}. Counted in stats.`);

      // Broadcast real-time event via socket so dashboard/activity log update instantly
      broadcastRealTimeEvent({
        type: 'OPENED',
        campaignId: existingEvent.campaignId,
        contactId: existingEvent.contactId,
        enrollmentId: existingEvent.enrollmentId,
        to: existingEvent.contact.email,
        timestamp: new Date().toISOString()
      });
    } else {
      // console.log(`📧 REPEAT OPEN: Email ${emailId} already opened. Skipping stat recording.`);
    }

    return sendPixel();

  } catch (error) {
    console.error('❌ Open tracking error:', error);
    // Return pixel anyway
    res.set({
      'Content-Type': 'image/png',
      'Content-Length': transparentPixel.length,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    return res.send(transparentPixel);
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
