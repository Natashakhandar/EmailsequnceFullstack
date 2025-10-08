const express = require('express');
const prisma = require('../db/prismaClient');
const router = express.Router();

// GET /api/enrollments - Get all enrollments with pagination
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 50, status, sequenceId, contactId } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (status) where.status = status;
    if (sequenceId) where.sequenceId = sequenceId;
    if (contactId) where.contactId = contactId;

    const [enrollments, total] = await Promise.all([
      prisma.enrollment.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          contact: true,
          sequence: {
            include: {
              steps: {
                orderBy: { stepOrder: 'asc' },
                include: {
                  template: true
                }
              }
            }
          },
          events: {
            orderBy: { timestamp: 'desc' },
            take: 5
          }
        }
      }),
      prisma.enrollment.count({ where })
    ]);

    res.json({
      enrollments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching enrollments:', error);
    res.status(500).json({ error: 'Failed to fetch enrollments' });
  }
});

// GET /api/enrollments/:id - Get single enrollment
router.get('/:id', async (req, res) => {
  try {
    const enrollment = await prisma.enrollment.findUnique({
      where: { id: req.params.id },
      include: {
        contact: true,
        sequence: {
          include: {
            steps: {
              orderBy: { stepOrder: 'asc' },
              include: {
                template: true
              }
            }
          }
        },
        events: {
          orderBy: { timestamp: 'desc' }
        }
      }
    });

    if (!enrollment) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }

    res.json(enrollment);
  } catch (error) {
    console.error('Error fetching enrollment:', error);
    res.status(500).json({ error: 'Failed to fetch enrollment' });
  }
});

// POST /api/enrollments - Create new enrollment
router.post('/', async (req, res) => {
  try {
    const { contactId, sequenceId, startImmediately = false } = req.body;

    if (!contactId || !sequenceId) {
      return res.status(400).json({ 
        error: 'contactId and sequenceId are required' 
      });
    }

    // Check if contact exists and is not unsubscribed
    const contact = await prisma.contact.findUnique({
      where: { id: contactId }
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    if (contact.status === 'UNSUBSCRIBED') {
      return res.status(400).json({ 
        error: 'Cannot enroll unsubscribed contact' 
      });
    }

    // Check if sequence exists and is active
    const sequence = await prisma.sequence.findUnique({
      where: { id: sequenceId },
      include: {
        steps: {
          orderBy: { stepOrder: 'asc' },
          where: { isActive: true }
        }
      }
    });

    if (!sequence) {
      return res.status(404).json({ error: 'Sequence not found' });
    }

    if (!sequence.isActive) {
      return res.status(400).json({ error: 'Cannot enroll in inactive sequence' });
    }

    if (sequence.steps.length === 0) {
      return res.status(400).json({ error: 'Sequence has no active steps' });
    }

    // Check if enrollment already exists
    const existingEnrollment = await prisma.enrollment.findUnique({
      where: {
        contactId_sequenceId: {
          contactId,
          sequenceId
        }
      }
    });

    if (existingEnrollment) {
      return res.status(409).json({ 
        error: 'Contact is already enrolled in this sequence' 
      });
    }

    // Calculate next send time for first step
    const firstStep = sequence.steps[0];
    let nextSendAt = null;
    
    if (startImmediately) {
      nextSendAt = new Date();
    } else {
      nextSendAt = new Date();
      nextSendAt.setDate(nextSendAt.getDate() + firstStep.delayDays);
      nextSendAt.setHours(nextSendAt.getHours() + firstStep.delayHours);
    }

    const enrollment = await prisma.enrollment.create({
      data: {
        contactId,
        sequenceId,
        currentStep: 1,
        nextSendAt,
        status: 'ACTIVE'
      },
      include: {
        contact: true,
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
    });

    res.status(201).json(enrollment);
  } catch (error) {
    console.error('Error creating enrollment:', error);
    res.status(500).json({ error: 'Failed to create enrollment' });
  }
});

// PUT /api/enrollments/:id - Update enrollment
router.put('/:id', async (req, res) => {
  try {
    const { status, currentStep, nextSendAt } = req.body;

    const updateData = {};
    if (status) updateData.status = status;
    if (currentStep !== undefined) updateData.currentStep = currentStep;
    if (nextSendAt) updateData.nextSendAt = new Date(nextSendAt);
    
    if (status === 'COMPLETED' || status === 'STOPPED') {
      updateData.completedAt = new Date();
      updateData.nextSendAt = null;
    }

    const enrollment = await prisma.enrollment.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        contact: true,
        sequence: true
      }
    });

    res.json(enrollment);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Enrollment not found' });
    }
    console.error('Error updating enrollment:', error);
    res.status(500).json({ error: 'Failed to update enrollment' });
  }
});

// DELETE /api/enrollments/:id - Delete enrollment
router.delete('/:id', async (req, res) => {
  try {
    await prisma.enrollment.delete({
      where: { id: req.params.id }
    });

    res.status(204).send();
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Enrollment not found' });
    }
    console.error('Error deleting enrollment:', error);
    res.status(500).json({ error: 'Failed to delete enrollment' });
  }
});

// POST /api/enrollments/:id/pause - Pause enrollment
router.post('/:id/pause', async (req, res) => {
  try {
    const enrollment = await prisma.enrollment.update({
      where: { id: req.params.id },
      data: { 
        status: 'PAUSED',
        nextSendAt: null
      },
      include: {
        contact: true,
        sequence: true
      }
    });

    res.json(enrollment);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Enrollment not found' });
    }
    console.error('Error pausing enrollment:', error);
    res.status(500).json({ error: 'Failed to pause enrollment' });
  }
});

// POST /api/enrollments/:id/resume - Resume enrollment
router.post('/:id/resume', async (req, res) => {
  try {
    const { delayDays = 0, delayHours = 0 } = req.body;

    // Calculate next send time
    const nextSendAt = new Date();
    nextSendAt.setDate(nextSendAt.getDate() + delayDays);
    nextSendAt.setHours(nextSendAt.getHours() + delayHours);

    const enrollment = await prisma.enrollment.update({
      where: { id: req.params.id },
      data: { 
        status: 'ACTIVE',
        nextSendAt
      },
      include: {
        contact: true,
        sequence: true
      }
    });

    res.json(enrollment);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Enrollment not found' });
    }
    console.error('Error resuming enrollment:', error);
    res.status(500).json({ error: 'Failed to resume enrollment' });
  }
});

// POST /api/enrollments/:id/stop - Stop enrollment
router.post('/:id/stop', async (req, res) => {
  try {
    const enrollment = await prisma.enrollment.update({
      where: { id: req.params.id },
      data: { 
        status: 'STOPPED',
        completedAt: new Date(),
        nextSendAt: null
      },
      include: {
        contact: true,
        sequence: true
      }
    });

    res.json(enrollment);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Enrollment not found' });
    }
    console.error('Error stopping enrollment:', error);
    res.status(500).json({ error: 'Failed to stop enrollment' });
  }
});

// POST /api/enrollments/bulk - Bulk enroll contacts
router.post('/bulk', async (req, res) => {
  try {
    const { contactIds, sequenceId, startImmediately = false } = req.body;

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return res.status(400).json({ error: 'contactIds array is required' });
    }

    if (!sequenceId) {
      return res.status(400).json({ error: 'sequenceId is required' });
    }

    // Check sequence exists and is active
    const sequence = await prisma.sequence.findUnique({
      where: { id: sequenceId },
      include: {
        steps: {
          orderBy: { stepOrder: 'asc' },
          where: { isActive: true }
        }
      }
    });

    if (!sequence || !sequence.isActive || sequence.steps.length === 0) {
      return res.status(400).json({ error: 'Invalid or inactive sequence' });
    }

    const results = {
      enrolled: 0,
      skipped: 0,
      errors: []
    };

    // Calculate next send time for first step
    const firstStep = sequence.steps[0];
    let nextSendAt = new Date();
    if (!startImmediately) {
      nextSendAt.setDate(nextSendAt.getDate() + firstStep.delayDays);
      nextSendAt.setHours(nextSendAt.getHours() + firstStep.delayHours);
    }

    for (const contactId of contactIds) {
      try {
        // Check if contact exists and is not unsubscribed
        const contact = await prisma.contact.findUnique({
          where: { id: contactId }
        });

        if (!contact) {
          results.errors.push({ contactId, error: 'Contact not found' });
          continue;
        }

        if (contact.status === 'UNSUBSCRIBED') {
          results.skipped++;
          continue;
        }

        // Check if already enrolled
        const existing = await prisma.enrollment.findUnique({
          where: {
            contactId_sequenceId: {
              contactId,
              sequenceId
            }
          }
        });

        if (existing) {
          results.skipped++;
          continue;
        }

        await prisma.enrollment.create({
          data: {
            contactId,
            sequenceId,
            currentStep: 1,
            nextSendAt: new Date(nextSendAt),
            status: 'ACTIVE'
          }
        });

        results.enrolled++;
      } catch (error) {
        results.errors.push({ contactId, error: error.message });
      }
    }

    res.json(results);
  } catch (error) {
    console.error('Error bulk enrolling contacts:', error);
    res.status(500).json({ error: 'Failed to bulk enroll contacts' });
  }
});

module.exports = router;
