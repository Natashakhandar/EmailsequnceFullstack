const express = require('express');
const prisma = require('../db/prismaClient');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

router.use(authenticateToken);

/**
 * DELETE /api/email-activity/:id
 * Delete an email activity record by ID
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        message: "Email activity ID is required"
      });
    }

    console.log(`🗑️ Attempting to delete email activity with ID: ${id}`);

    // Try to delete from emailActivity table first (if it exists)
    // If it doesn't exist, fall back to events table
    let deletedRecord = null;

    try {
      // First attempt: Try emailActivity table
      if (prisma.emailActivity) {
        deletedRecord = await prisma.emailActivity.delete({
          where: { id }
        });
        console.log(`✅ Email activity deleted from emailActivity table: ${id}`);
      } else {
        throw new Error('emailActivity table not found');
      }
    } catch (emailActivityError) {
      // Fallback: Try events table (which represents email activities in current schema)
      try {
        const eventToDel = await prisma.event.findFirst({
          where: { id, contact: { userId: req.user.id } }
        });
        if (!eventToDel) {
          throw Object.assign(new Error('Event not found'), { code: 'P2025' });
        }
        deletedRecord = await prisma.event.delete({
          where: { id }
        });
        console.log(`✅ Email activity deleted from events table: ${id}`);
      } catch (eventError) {
        console.error('❌ Failed to delete from both emailActivity and events tables:', {
          emailActivityError: emailActivityError.message,
          eventError: eventError.message
        });

        // Check if record was not found
        if (eventError.code === 'P2025' || emailActivityError.code === 'P2025') {
          return res.status(404).json({
            message: "Email activity not found"
          });
        }

        throw eventError;
      }
    }

    res.json({
      message: "Email activity deleted successfully",
      deletedId: id
    });

  } catch (error) {
    console.error('❌ Error deleting email activity:', {
      id: req.params.id,
      error: error.message,
      code: error.code,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });

    // Handle specific Prisma errors
    if (error.code === 'P2025') {
      return res.status(404).json({
        message: "Email activity not found"
      });
    }

    if (error.code === 'P2003') {
      return res.status(400).json({
        message: "Cannot delete email activity due to related records"
      });
    }

    res.status(500).json({
      message: "Failed to delete email activity",
      ...(process.env.NODE_ENV !== 'production' && { error: error.message })
    });
  }
});

/**
 * GET /api/email-activity
 * Get all email activities (for testing purposes)
 */
router.get('/', async (req, res) => {
  try {
    let activities = [];

    // Try emailActivity table first, fallback to events
    try {
      if (prisma.emailActivity) {
        activities = await prisma.emailActivity.findMany({
          orderBy: { createdAt: 'desc' },
          take: 100 // Limit to prevent large responses
        });
      } else {
        throw new Error('emailActivity table not found');
      }
    } catch (emailActivityError) {
      // Fallback to events table
      const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPERADMIN';
      activities = await prisma.event.findMany({
        where: isAdmin ? {} : { contact: { userId: req.user.id } },
        orderBy: { timestamp: 'desc' },
        take: 100,
        include: {
          contact: {
            select: {
              email: true,
              firstName: true,
              lastName: true
            }
          },
          enrollment: {
            select: {
              id: true,
              sequence: {
                select: {
                  name: true
                }
              }
            }
          }
        }
      });
    }

    res.json({
      message: "Email activities retrieved successfully",
      count: activities.length,
      activities
    });

  } catch (error) {
    console.error('❌ Error retrieving email activities:', error);
    res.status(500).json({
      message: "Failed to retrieve email activities",
      ...(process.env.NODE_ENV !== 'production' && { error: error.message })
    });
  }
});

/**
 * GET /api/email-activity/:id
 * Get a specific email activity by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        message: "Email activity ID is required"
      });
    }

    let activity = null;

    // Try emailActivity table first, fallback to events
    try {
      if (prisma.emailActivity) {
        activity = await prisma.emailActivity.findUnique({
          where: { id }
        });
      } else {
        throw new Error('emailActivity table not found');
      }
    } catch (emailActivityError) {
      // Fallback to events table
      const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPERADMIN';
      activity = await prisma.event.findFirst({
        where: {
          id,
          ...(isAdmin ? {} : { contact: { userId: req.user.id } })
        },
        include: {
          contact: {
            select: {
              email: true,
              firstName: true,
              lastName: true
            }
          },
          enrollment: {
            select: {
              id: true,
              sequence: {
                select: {
                  name: true
                }
              }
            }
          }
        }
      });
    }

    if (!activity) {
      return res.status(404).json({
        message: "Email activity not found"
      });
    }

    res.json({
      message: "Email activity retrieved successfully",
      activity
    });

  } catch (error) {
    console.error('❌ Error retrieving email activity:', error);
    res.status(500).json({
      message: "Failed to retrieve email activity",
      ...(process.env.NODE_ENV !== 'production' && { error: error.message })
    });
  }
});

module.exports = router;
