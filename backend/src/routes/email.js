const express = require('express');
const prisma = require('../db/prismaClient');
const { broadcastRealTimeEvent } = require('../services/socketService');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Create a 1x1 transparent PNG buffer
const transparentPixel = Buffer.from([
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
  0x0B, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
]);

function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(value);
  } catch (error) {
    return value;
  }
}

function buildEmailIdCandidates(rawEmailId) {
  const raw = String(rawEmailId || '').trim();
  if (!raw) return [];

  const decodedOnce = safeDecodeURIComponent(raw);
  const decodedTwice = safeDecodeURIComponent(decodedOnce);

  const variants = [raw, decodedOnce, decodedTwice]
    .map((id) => id.trim().replace(/^"+|"+$/g, ''))
    .filter(Boolean);

  const expanded = new Set();
  variants.forEach((id) => {
    const noBrackets = id.replace(/[<>]/g, '');
    expanded.add(id);
    expanded.add(noBrackets);
    if (noBrackets) {
      expanded.add(`<${noBrackets}>`);
    }
  });

  return Array.from(expanded).filter(Boolean);
}

router.get('/track/open', async (req, res) => {
  try {
    const { emailId } = req.query;
    
    // Better IP detection for proxied environments (Hostinger/Cloudflare)
    const ip = req.headers['x-forwarded-for'] || req.ip || req.connection.remoteAddress || '0.0.0.0';
    console.log(`📩 [TRACKER] Open request for ID: "${emailId}" from IP: ${ip}`);

    // Helper to send the transparent pixel response as fast as possible
    const sendPixel = () => {
      res.set({
        'Content-Type': 'image/png',
        'Content-Length': transparentPixel.length,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Access-Control-Allow-Origin': '*' // Allow tracking from anywhere
      });
      return res.status(200).send(transparentPixel);
    };

    if (!emailId) {
      return sendPixel();
    }

    // FUZZY MATCHING: Handle encoded IDs from mail proxies + bracket/no-bracket variants
    const emailIdCandidates = buildEmailIdCandidates(emailId);
    if (emailIdCandidates.length === 0) {
      return sendPixel();
    }

    // Search for the original SENT event
    const sentEvent = await prisma.event.findFirst({
      where: {
        type: 'SENT',
        emailId: { in: emailIdCandidates }
      },
      include: {
        contact: true
      }
    });

    if (!sentEvent) {
      console.log(`⚠️ [TRACKER] No 'SENT' event found matching ID: "${emailId}"`);
      return sendPixel();
    }

    // Use a transaction to ensure we don't create duplicate open events during race conditions
    await prisma.$transaction(async (tx) => {
      // UNIQUE OPEN CHECK: Check if already opened (using fuzzy search as well)
      const alreadyOpened = await tx.event.findFirst({
        where: {
          type: 'OPENED',
          emailId: { in: emailIdCandidates }
        }
      });

      if (!alreadyOpened) {
        // Record the NEW open event
        const newEvent = await tx.event.create({
          data: {
            enrollmentId: sentEvent.enrollmentId,
            contactId: sentEvent.contactId,
            campaignId: sentEvent.campaignId,
            type: 'OPENED',
            emailId: sentEvent.emailId, // Use the ID from the database for consistency
            details: JSON.stringify({
              openedAt: new Date().toISOString(),
              userAgent: req.get('User-Agent') || 'Unknown',
              ip: ip,
              referer: req.get('Referer') || 'Direct',
              originalQueryId: emailId
            })
          }
        });

        console.log(`✅ [TRACKER] FIRST OPEN LOGGED: Contact ${sentEvent.contact.email} opened email ${sentEvent.emailId}`);

        // Broadcast via socket for real-time UI updates
        broadcastRealTimeEvent({
          id: newEvent.id,
          type: 'OPENED',
          campaignId: sentEvent.campaignId,
          contactId: sentEvent.contactId,
          enrollmentId: sentEvent.enrollmentId,
          to: sentEvent.contact.email,
          timestamp: newEvent.timestamp || new Date().toISOString()
        });
      } else {
        console.log(`ℹ️ [TRACKER] Repeat open for ID: ${emailId} (Contact: ${sentEvent.contact.email}). skipping log.`);
      }
    });

    return sendPixel();

  } catch (error) {
    console.error('❌ [TRACKER] Critical Error:', error.message);
    res.set('Content-Type', 'image/png');
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
      },
      include: {
        contact: true
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

    if (alreadyReplied) {
      console.log(`📧 Reply tracking: Duplicate reply detected for emailId: ${emailId}. Skipping.`);
      return res.json({ success: true, message: 'Reply already tracked' });
    }

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

    console.log(`✅ Reply tracking: Recorded new reply for emailId: ${emailId}`);

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
router.get('/track/stats/:emailId', authenticateToken, async (req, res) => {
  try {
    const { emailId } = req.params;

    const events = await prisma.event.findMany({
      where: {
        emailId: emailId,
        enrollment: {
          sequence: {
            userId: req.user.id
          }
        }
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
