const express = require('express');
const prisma = require('../db/prismaClient');
const router = express.Router();

// GET /api/sequences - Get all sequences
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 50, isActive } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const [sequences, total] = await Promise.all([
      prisma.sequence.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          steps: {
            orderBy: { stepOrder: 'asc' },
            include: {
              template: true
            }
          },
          _count: {
            select: { 
              enrollments: true,
              steps: true
            }
          }
        }
      }),
      prisma.sequence.count({ where })
    ]);

    res.json({
      sequences,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching sequences:', error);
    res.status(500).json({ error: 'Failed to fetch sequences' });
  }
});

// GET /api/sequences/:id - Get single sequence
router.get('/:id', async (req, res) => {
  try {
    const sequence = await prisma.sequence.findUnique({
      where: { id: req.params.id },
      include: {
        steps: {
          orderBy: { stepOrder: 'asc' },
          include: {
            template: true
          }
        },
        enrollments: {
          include: {
            contact: true
          },
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        _count: {
          select: { enrollments: true }
        }
      }
    });

    if (!sequence) {
      return res.status(404).json({ error: 'Sequence not found' });
    }

    res.json(sequence);
  } catch (error) {
    console.error('Error fetching sequence:', error);
    res.status(500).json({ error: 'Failed to fetch sequence' });
  }
});

// POST /api/sequences - Create new sequence
router.post('/', async (req, res) => {
  try {
    const { name, description, steps = [], isActive = true } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Validate steps if provided
    if (steps.length > 0) {
      for (const step of steps) {
        if (!step.templateId || step.stepOrder === undefined) {
          return res.status(400).json({ 
            error: 'Each step must have templateId and stepOrder' 
          });
        }
      }
    }

    const sequence = await prisma.sequence.create({
      data: {
        name: name.trim(),
        description: description?.trim(),
        isActive,
        steps: {
          create: steps.map(step => ({
            templateId: step.templateId,
            stepOrder: step.stepOrder,
            delayDays: step.delayDays || 0,
            delayHours: step.delayHours || 0,
            isActive: step.isActive !== false
          }))
        }
      },
      include: {
        steps: {
          orderBy: { stepOrder: 'asc' },
          include: {
            template: true
          }
        }
      }
    });

    res.status(201).json(sequence);
  } catch (error) {
    console.error('Error creating sequence:', error);
    res.status(500).json({ error: 'Failed to create sequence' });
  }
});

// PUT /api/sequences/:id - Update sequence
router.put('/:id', async (req, res) => {
  try {
    const { name, description, isActive } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim();
    if (isActive !== undefined) updateData.isActive = isActive;

    const sequence = await prisma.sequence.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        steps: {
          orderBy: { stepOrder: 'asc' },
          include: {
            template: true
          }
        }
      }
    });

    res.json(sequence);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Sequence not found' });
    }
    console.error('Error updating sequence:', error);
    res.status(500).json({ error: 'Failed to update sequence' });
  }
});

// DELETE /api/sequences/:id - Delete sequence
router.delete('/:id', async (req, res) => {
  try {
    // Check if sequence has active enrollments
    const activeEnrollments = await prisma.enrollment.findMany({
      where: { 
        sequenceId: req.params.id,
        status: 'ACTIVE'
      }
    });

    if (activeEnrollments.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete sequence with active enrollments' 
      });
    }

    await prisma.sequence.delete({
      where: { id: req.params.id }
    });

    res.status(204).send();
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Sequence not found' });
    }
    console.error('Error deleting sequence:', error);
    res.status(500).json({ error: 'Failed to delete sequence' });
  }
});

// POST /api/sequences/:id/steps - Add step to sequence
router.post('/:id/steps', async (req, res) => {
  try {
    const { templateId, stepOrder, delayDays = 0, delayHours = 0, isActive = true } = req.body;

    if (!templateId || stepOrder === undefined) {
      return res.status(400).json({ 
        error: 'templateId and stepOrder are required' 
      });
    }

    // Check if sequence exists
    const sequence = await prisma.sequence.findUnique({
      where: { id: req.params.id }
    });

    if (!sequence) {
      return res.status(404).json({ error: 'Sequence not found' });
    }

    // Check if template exists
    const template = await prisma.template.findUnique({
      where: { id: templateId }
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const step = await prisma.sequenceStep.create({
      data: {
        sequenceId: req.params.id,
        templateId,
        stepOrder,
        delayDays,
        delayHours,
        isActive
      },
      include: {
        template: true
      }
    });

    res.status(201).json(step);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ 
        error: 'Step order already exists in this sequence' 
      });
    }
    console.error('Error adding step to sequence:', error);
    res.status(500).json({ error: 'Failed to add step to sequence' });
  }
});

// PUT /api/sequences/:id/steps/:stepId - Update sequence step
router.put('/:id/steps/:stepId', async (req, res) => {
  try {
    const { templateId, stepOrder, delayDays, delayHours, isActive } = req.body;

    const updateData = {};
    if (templateId) updateData.templateId = templateId;
    if (stepOrder !== undefined) updateData.stepOrder = stepOrder;
    if (delayDays !== undefined) updateData.delayDays = delayDays;
    if (delayHours !== undefined) updateData.delayHours = delayHours;
    if (isActive !== undefined) updateData.isActive = isActive;

    const step = await prisma.sequenceStep.update({
      where: { 
        id: req.params.stepId,
        sequenceId: req.params.id
      },
      data: updateData,
      include: {
        template: true
      }
    });

    res.json(step);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Step not found' });
    }
    if (error.code === 'P2002') {
      return res.status(409).json({ 
        error: 'Step order already exists in this sequence' 
      });
    }
    console.error('Error updating sequence step:', error);
    res.status(500).json({ error: 'Failed to update sequence step' });
  }
});

// DELETE /api/sequences/:id/steps/:stepId - Delete sequence step
router.delete('/:id/steps/:stepId', async (req, res) => {
  try {
    await prisma.sequenceStep.delete({
      where: { 
        id: req.params.stepId,
        sequenceId: req.params.id
      }
    });

    res.status(204).send();
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Step not found' });
    }
    console.error('Error deleting sequence step:', error);
    res.status(500).json({ error: 'Failed to delete sequence step' });
  }
});

// GET /api/sequences/:id/analytics - Get sequence analytics
router.get('/:id/analytics', async (req, res) => {
  try {
    const sequenceId = req.params.id;

    const [
      totalEnrollments,
      activeEnrollments,
      completedEnrollments,
      eventStats
    ] = await Promise.all([
      prisma.enrollment.count({ where: { sequenceId } }),
      prisma.enrollment.count({ where: { sequenceId, status: 'ACTIVE' } }),
      prisma.enrollment.count({ where: { sequenceId, status: 'COMPLETED' } }),
      prisma.event.groupBy({
        by: ['type'],
        where: {
          enrollment: {
            sequenceId
          }
        },
        _count: {
          type: true
        }
      })
    ]);

    const analytics = {
      enrollments: {
        total: totalEnrollments,
        active: activeEnrollments,
        completed: completedEnrollments,
        completionRate: totalEnrollments > 0 ? (completedEnrollments / totalEnrollments * 100).toFixed(2) : 0
      },
      events: eventStats.reduce((acc, stat) => {
        acc[stat.type.toLowerCase()] = stat._count.type;
        return acc;
      }, {}),
      engagement: {
        openRate: 0, // Calculate based on OPENED vs SENT events
        clickRate: 0, // Calculate based on CLICKED vs SENT events
        replyRate: 0  // Calculate based on REPLIED vs SENT events
      }
    };

    // Calculate engagement rates
    const sentCount = analytics.events.sent || 0;
    if (sentCount > 0) {
      analytics.engagement.openRate = ((analytics.events.opened || 0) / sentCount * 100).toFixed(2);
      analytics.engagement.clickRate = ((analytics.events.clicked || 0) / sentCount * 100).toFixed(2);
      analytics.engagement.replyRate = ((analytics.events.replied || 0) / sentCount * 100).toFixed(2);
    }

    res.json(analytics);
  } catch (error) {
    console.error('Error fetching sequence analytics:', error);
    res.status(500).json({ error: 'Failed to fetch sequence analytics' });
  }
});

module.exports = router;
