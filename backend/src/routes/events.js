const express = require('express');
const prisma = require('../db/prismaClient');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

router.use(authenticateToken);

// GET /api/events - Get all events with pagination
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      type,
      enrollmentId,
      contactId,
      startDate,
      endDate,
      search,
      leadListName
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPERADMIN';
    const where = {};
    const contactWhere = {};

    if (!isAdmin) contactWhere.userId = req.user.id;

    if (type) where.type = type;
    if (enrollmentId) where.enrollmentId = enrollmentId;
    if (contactId) where.contactId = contactId;

    // Handle leadListName (from dropdown) and search (from search bar)
    if (search) {
      contactWhere.leadListName = { contains: search, mode: 'insensitive' };
    } else if (leadListName !== undefined && leadListName !== 'all') {
      if (!leadListName || leadListName === 'null' || leadListName === 'Uncategorized') {
        contactWhere.leadListName = null;
      } else {
        contactWhere.leadListName = leadListName;
      }
    }

    if (Object.keys(contactWhere).length > 0) {
      where.contact = contactWhere;
    }

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { timestamp: 'desc' },
        include: {
          contact: true,
          enrollment: {
            include: {
              sequence: true
            }
          }
        }
      }),
      prisma.event.count({ where })
    ]);

    res.json({
      events,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// GET /api/events/:id - Get single event
router.get('/:id', async (req, res) => {
  try {
    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPERADMIN';
    const event = await prisma.event.findFirst({
      where: {
        id: req.params.id,
        ...(isAdmin ? {} : { contact: { userId: req.user.id } })
      },
      include: {
        contact: true,
        enrollment: {
          include: {
            sequence: {
              include: {
                steps: {
                  orderBy: { stepOrder: 'asc' },
                  include: {
                    template: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json(event);
  } catch (error) {
    console.error('Error fetching event:', error);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

// POST /api/events - Create new event (usually called by system)
router.post('/', async (req, res) => {
  try {
    const { enrollmentId, contactId, type, details, emailId } = req.body;

    if (!enrollmentId || !contactId || !type) {
      return res.status(400).json({
        error: 'enrollmentId, contactId, and type are required'
      });
    }

    // Validate event type
    const validTypes = ['SENT', 'DELIVERED', 'OPENED', 'CLICKED', 'REPLIED', 'BOUNCED', 'UNSUBSCRIBED', 'FAILED'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: `Invalid event type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    // Check if enrollment exists and belongs to user
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        id: enrollmentId,
        sequence: {
          userId: req.user.id
        }
      }
    });

    if (!enrollment) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }

    const event = await prisma.event.create({
      data: {
        enrollmentId,
        contactId,
        type,
        details: details ? JSON.stringify(details) : null,
        emailId
      },
      include: {
        contact: true,
        enrollment: {
          include: {
            sequence: true
          }
        }
      }
    });

    // Handle special event types that affect enrollment status
    if (type === 'REPLIED' || type === 'UNSUBSCRIBED') {
      await prisma.enrollment.update({
        where: { id: enrollmentId },
        data: {
          status: type === 'REPLIED' ? 'STOPPED' : 'UNSUBSCRIBED',
          completedAt: new Date(),
          nextSendAt: null
        }
      });

      // If unsubscribed, update contact status
      if (type === 'UNSUBSCRIBED') {
        await prisma.contact.update({
          where: { id: contactId },
          data: { status: 'UNSUBSCRIBED' }
        });
      }
    }

    res.status(201).json(event);
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// GET /api/events/analytics/summary - Get events analytics summary
router.get('/analytics/summary', async (req, res) => {
  try {
    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPERADMIN';
    const where = isAdmin ? {} : {
      contact: { userId: req.user.id }
    };
    const { startDate, endDate, sequenceId } = req.query;
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    if (sequenceId) {
      where.enrollment = {
        sequenceId
      };
    }

    const eventStats = await prisma.event.groupBy({
      by: ['type'],
      where,
      _count: {
        type: true
      }
    });

    const summary = eventStats.reduce((acc, stat) => {
      acc[stat.type.toLowerCase()] = stat._count.type;
      return acc;
    }, {});

    // Calculate rates
    const sent = summary.sent || 0;
    const analytics = {
      totals: summary,
      rates: {
        deliveryRate: sent > 0 ? (((summary.delivered || 0) / sent) * 100).toFixed(2) : 0,
        openRate: sent > 0 ? (((summary.opened || 0) / sent) * 100).toFixed(2) : 0,
        clickRate: sent > 0 ? (((summary.clicked || 0) / sent) * 100).toFixed(2) : 0,
        replyRate: sent > 0 ? (((summary.replied || 0) / sent) * 100).toFixed(2) : 0,
        bounceRate: sent > 0 ? (((summary.bounced || 0) / sent) * 100).toFixed(2) : 0,
        unsubscribeRate: sent > 0 ? (((summary.unsubscribed || 0) / sent) * 100).toFixed(2) : 0
      }
    };

    res.json(analytics);
  } catch (error) {
    console.error('Error fetching events analytics:', error);
    res.status(500).json({ error: 'Failed to fetch events analytics' });
  }
});

// GET /api/events/analytics/timeline - Get events timeline
router.get('/analytics/timeline', async (req, res) => {
  try {
    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPERADMIN';
    const where = isAdmin ? {} : {
      contact: { userId: req.user.id }
    };
    const { startDate, endDate, sequenceId } = req.query;
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    if (sequenceId) {
      where.enrollment = {
        sequenceId
      };
    }

    // For SQLite, we'll use a simpler approach for date grouping
    const events = await prisma.event.findMany({
      where,
      select: {
        type: true,
        timestamp: true
      },
      orderBy: {
        timestamp: 'asc'
      }
    });

    // Group events by date
    const timeline = {};
    events.forEach(event => {
      const date = event.timestamp.toISOString().split('T')[0]; // YYYY-MM-DD
      if (!timeline[date]) {
        timeline[date] = {};
      }
      if (!timeline[date][event.type]) {
        timeline[date][event.type] = 0;
      }
      timeline[date][event.type]++;
    });

    // Convert to array format
    const timelineArray = Object.entries(timeline).map(([date, events]) => ({
      date,
      events
    }));

    res.json(timelineArray);
  } catch (error) {
    console.error('Error fetching events timeline:', error);
    res.status(500).json({ error: 'Failed to fetch events timeline' });
  }
});

// DELETE /api/events/:id - Delete event (admin only)
router.delete('/:id', async (req, res) => {
  try {
    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPERADMIN';
    const event = await prisma.event.findFirst({
      where: {
        id: req.params.id,
        ...(isAdmin ? {} : { contact: { userId: req.user.id } })
      }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    await prisma.event.delete({
      where: {
        id: req.params.id,
        enrollment: {
          sequence: {
            userId: req.user.id
          }
        }
      }
    });

    res.status(204).send();
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Event not found' });
    }
    console.error('Error deleting event:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

module.exports = router;
