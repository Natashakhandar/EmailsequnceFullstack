const express = require('express');
const prisma = require('../db/prismaClient');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Apply authentication middleware to all sequence routes
router.use(authenticateToken);

// Helper function to ensure backward compatibility for sequence steps
const normalizeSequenceStep = (step) => {
  return {
    ...step,
    // Ensure all new fields have default values for backward compatibility
    subject: step.subject || null,
    body: step.body || null,
    triggerType: step.triggerType || 'delay',
    triggerStepId: step.triggerStepId || null,
    delayMinutes: step.delayMinutes || 0,
    
    // Legacy support: if no trigger type is set, default to 'delay'
    // This ensures old sequences without trigger logic still work
    ...((!step.triggerType || step.triggerType === 'delay') && {
      triggerType: 'delay',
      triggerStepId: null
    })
  };
};

// Helper function to normalize sequence data
const normalizeSequence = (sequence) => {
  return {
    ...sequence,
    steps: sequence.steps ? sequence.steps.map(normalizeSequenceStep) : []
  };
};

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

    // Normalize sequences for backward compatibility
    const normalizedSequences = sequences.map(normalizeSequence);

    res.json({
      sequences: normalizedSequences,
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
        trigger: {
          include: {
            triggerStep: {
              include: {
                template: true
              }
            }
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

    // CRITICAL LOGGING: Verify database retrieval integrity
    console.log('📖 SEQUENCE RETRIEVAL VALIDATION');
    console.log('Sequence ID:', sequence.id);
    console.log('Step count:', sequence.steps?.length || 0);
    
    sequence.steps?.forEach((step, index) => {
      if (step.body) {
        console.log(`Step ${step.stepOrder} body length:`, step.body?.length || 0);
        console.log(`Step ${step.stepOrder} body type:`, typeof step.body);
        console.log(`Step ${step.stepOrder} body preview:`, step.body?.substring(0, 50) + '...');
      }
    });

    // Normalize sequence for backward compatibility
    const normalizedSequence = normalizeSequence(sequence);

    res.json(normalizedSequence);
  } catch (error) {
    console.error('Error fetching sequence:', error);
    res.status(500).json({ error: 'Failed to fetch sequence' });
  }
});

// POST /api/sequences - Create new sequence
router.post('/', async (req, res) => {
  try {
    const { name, description, steps = [], isActive = true } = req.body;

    console.log('🚀 Creating new sequence:', { name, description, stepCount: steps.length });

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Enhanced validation for steps with trigger logic
    if (steps.length > 0) {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        console.log(`📧 Validating step ${i + 1}:`, {
          templateId: step.templateId,
          stepOrder: step.stepOrder,
          triggerType: step.triggerType || 'delay',
          triggerStepId: step.triggerStepId,
          delayHours: step.delayHours,
          hasSubject: !!step.subject,
          hasBody: !!step.body,
          subjectLength: step.subject?.length || 0,
          bodyLength: step.body?.length || 0
        });

        // Basic validation
        if (step.stepOrder === undefined) {
          return res.status(400).json({ 
            success: false,
            message: `Step ${i + 1} must have stepOrder` 
          });
        }

        // Validate template exists if templateId is provided
        if (step.templateId) {
          try {
            const template = await prisma.template.findUnique({
              where: { id: step.templateId }
            });
            if (!template) {
              return res.status(400).json({ 
                success: false,
                message: `Template with ID "${step.templateId}" not found for step ${i + 1}` 
              });
            }
          } catch (error) {
            console.error(`❌ Error validating template for step ${i + 1}:`, error);
            return res.status(400).json({ 
              success: false,
              message: `Invalid template ID for step ${i + 1}` 
            });
          }
        }

        // For custom emails (no templateId), ensure subject and body are provided
        if (!step.templateId && (!step.subject || !step.body)) {
          return res.status(400).json({ 
            success: false,
            message: `Step ${i + 1} must have either a templateId or both subject and body for custom email` 
          });
        }

        // Note: triggerStepId validation is removed during creation since step IDs don't exist yet
        // The trigger step system is handled separately via the /trigger endpoint after creation
        // We only validate that triggerType is a valid value if provided
        if (step.triggerType && !['delay', 'opened', 'not_opened', 'replied', 'skip'].includes(step.triggerType)) {
          return res.status(400).json({ 
            success: false,
            message: `Step ${i + 1} triggerType must be one of: delay, opened, not_opened, replied, skip` 
          });
        }

        // Validate delay formatting
        if (step.delayHours !== undefined && (isNaN(step.delayHours) || step.delayHours < 0)) {
          return res.status(400).json({ 
            success: false,
            message: `Step ${i + 1} delayHours must be a non-negative number` 
          });
        }

        if (step.delayDays !== undefined && (isNaN(step.delayDays) || step.delayDays < 0)) {
          return res.status(400).json({ 
            success: false,
            message: `Step ${i + 1} delayDays must be a non-negative number` 
          });
        }

        if (step.delayMinutes !== undefined && (isNaN(step.delayMinutes) || step.delayMinutes < 0)) {
          return res.status(400).json({ 
            success: false,
            message: `Step ${i + 1} delayMinutes must be a non-negative number` 
          });
        }
      }
    }

    console.log('✅ All step validations passed, creating sequence...');

    const sequence = await prisma.sequence.create({
      data: {
        name: name.trim(),
        description: description?.trim(),
        isActive,
        // Note: userId field temporarily removed due to Prisma client sync issue
        steps: {
          create: steps.map(step => {
            // CRITICAL LOGGING: Track body integrity during database save
            if (step.body) {
              console.log(`💾 SAVING STEP ${step.stepOrder} BODY TO DB`);
              console.log('Frontend body length:', step.body?.length || 0);
              console.log('Frontend body type:', typeof step.body);
              console.log('Body preview (first 50 chars):', step.body?.substring(0, 50) + '...');
            }
            
            return {
              templateId: step.templateId || null,
              stepOrder: step.stepOrder,
              delayDays: step.delayDays || 0,
              delayHours: step.delayHours || 0,
              delayMinutes: step.delayMinutes || 0,
              
              // NEW: Trigger and content fields
              subject: step.subject || null,
              body: step.body || null,
              triggerType: step.triggerType || 'delay',
              triggerStepId: step.triggerStepId || null,
              
              isActive: step.isActive !== false
            };
          })
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

    console.log('🎉 Sequence created successfully:', { 
      id: sequence.id, 
      name: sequence.name, 
      stepCount: sequence.steps.length 
    });

    res.status(201).json({
      success: true,
      message: "Sequence saved successfully",
      data: sequence
    });
  } catch (error) {
    console.error('❌ Error creating sequence:', error);
    
    // Provide more specific error messages based on error type
    if (error.code === 'P2002') {
      return res.status(409).json({ 
        success: false,
        message: 'A sequence with this name already exists or duplicate step order detected' 
      });
    }
    
    if (error.code === 'P2003') {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid template reference in one of the steps' 
      });
    }
    
    if (error.code === 'P2025') {
      return res.status(404).json({ 
        success: false,
        message: 'Referenced template not found' 
      });
    }
    
    // Generic error with more helpful message
    res.status(500).json({ 
      success: false,
      message: 'Failed to save sequence. Please check your data and try again.' 
    });
  }
});

// PUT /api/sequences/:id - Update sequence
router.put('/:id', async (req, res) => {
  try {
    const { name, description, isActive, steps } = req.body;

    console.log('🔄 Updating sequence:', { 
      id: req.params.id, 
      name, 
      description, 
      isActive, 
      stepCount: steps?.length 
    });

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim();
    if (isActive !== undefined) updateData.isActive = isActive;

    // If steps are provided, validate and update them
    if (steps && Array.isArray(steps)) {
      console.log('📝 Updating sequence steps...');
      
      // Enhanced validation for steps with trigger logic
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        console.log(`📧 Validating step ${i + 1}:`, {
          templateId: step.templateId,
          stepOrder: step.stepOrder,
          triggerType: step.triggerType,
          triggerStepId: step.triggerStepId,
          delayHours: step.delayHours,
          hasSubject: !!step.subject,
          hasBody: !!step.body,
          subjectLength: step.subject?.length || 0,
          bodyLength: step.body?.length || 0
        });

        // Basic validation
        if (step.stepOrder === undefined) {
          return res.status(400).json({ 
            success: false,
            message: `Step ${i + 1} must have stepOrder` 
          });
        }

        // Validate template exists if templateId is provided
        if (step.templateId) {
          try {
            const template = await prisma.template.findUnique({
              where: { id: step.templateId }
            });
            if (!template) {
              return res.status(400).json({ 
                success: false,
                message: `Template with ID "${step.templateId}" not found for step ${i + 1}` 
              });
            }
          } catch (error) {
            console.error(`❌ Error validating template for step ${i + 1}:`, error);
            return res.status(400).json({ 
              success: false,
              message: `Invalid template ID for step ${i + 1}` 
            });
          }
        }

        // For custom emails (no templateId), ensure subject and body are provided
        if (!step.templateId && (!step.subject || !step.body)) {
          return res.status(400).json({ 
            success: false,
            message: `Step ${i + 1} must have either a templateId or both subject and body for custom email` 
          });
        }

        // Note: triggerStepId validation is removed during update since step IDs may not exist yet
        // The trigger step system is handled separately via the /trigger endpoint
        // We only validate that triggerType is a valid value if provided
        if (step.triggerType && !['delay', 'opened', 'not_opened', 'replied', 'skip'].includes(step.triggerType)) {
          return res.status(400).json({ 
            success: false,
            message: `Step ${i + 1} triggerType must be one of: delay, opened, not_opened, replied, skip` 
          });
        }

        // Validate delay formatting
        if (step.delayHours !== undefined && (isNaN(step.delayHours) || step.delayHours < 0)) {
          return res.status(400).json({ 
            success: false,
            message: `Step ${i + 1} delayHours must be a non-negative number` 
          });
        }

        if (step.delayDays !== undefined && (isNaN(step.delayDays) || step.delayDays < 0)) {
          return res.status(400).json({ 
            success: false,
            message: `Step ${i + 1} delayDays must be a non-negative number` 
          });
        }

        if (step.delayMinutes !== undefined && (isNaN(step.delayMinutes) || step.delayMinutes < 0)) {
          return res.status(400).json({ 
            success: false,
            message: `Step ${i + 1} delayMinutes must be a non-negative number` 
          });
        }
      }

      // Delete existing steps and create new ones
      await prisma.sequenceStep.deleteMany({
        where: { sequenceId: req.params.id }
      });

      updateData.steps = {
        create: steps.map(step => {
          // CRITICAL LOGGING: Track body integrity during database update
          if (step.body) {
            console.log(`🔄 UPDATING STEP ${step.stepOrder} BODY IN DB`);
            console.log('Frontend body length:', step.body?.length || 0);
            console.log('Frontend body type:', typeof step.body);
            console.log('Body preview (first 50 chars):', step.body?.substring(0, 50) + '...');
          }
          
          return {
            templateId: step.templateId || null,
            stepOrder: step.stepOrder,
            delayDays: step.delayDays || 0,
            delayHours: step.delayHours || 0,
            delayMinutes: step.delayMinutes || 0,
            
            // NEW: Trigger and content fields
            subject: step.subject || null,
            body: step.body || null,
            triggerType: step.triggerType || 'delay',
            triggerStepId: step.triggerStepId || null,
            
            isActive: step.isActive !== false
          };
        })
      };
    }

    console.log('✅ All validations passed, updating sequence...');

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

    console.log('🎉 Sequence updated successfully:', { 
      id: sequence.id, 
      name: sequence.name, 
      stepCount: sequence.steps.length 
    });

    res.json({
      success: true,
      message: "Sequence saved successfully",
      data: sequence
    });
  } catch (error) {
    console.error('❌ Error updating sequence:', error);
    
    // Provide more specific error messages based on error type
    if (error.code === 'P2025') {
      return res.status(404).json({ 
        success: false,
        message: 'Sequence not found' 
      });
    }
    
    if (error.code === 'P2002') {
      return res.status(409).json({ 
        success: false,
        message: 'Duplicate step order detected or sequence name already exists' 
      });
    }
    
    if (error.code === 'P2003') {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid template reference in one of the steps' 
      });
    }
    
    // Generic error with more helpful message
    res.status(500).json({ 
      success: false,
      message: 'Failed to update sequence. Please check your data and try again.' 
    });
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
    const { 
      templateId, 
      stepOrder, 
      delayDays = 0, 
      delayHours = 0, 
      delayMinutes = 0,
      subject,
      body,
      triggerType = 'delay',
      triggerStepId,
      isActive = true 
    } = req.body;

    console.log('➕ Adding step to sequence:', { 
      sequenceId: req.params.id, 
      stepOrder, 
      triggerType, 
      triggerStepId 
    });

    if (stepOrder === undefined) {
      return res.status(400).json({ 
        error: 'stepOrder is required' 
      });
    }

    // Validate trigger conditions
    if (triggerType && ['opened', 'not_opened', 'replied'].includes(triggerType)) {
      if (!triggerStepId) {
        return res.status(400).json({ 
          error: `Step with triggerType "${triggerType}" must have a valid triggerStepId` 
        });
      }
    }

    // Check if sequence exists
    const sequence = await prisma.sequence.findUnique({
      where: { id: req.params.id }
    });

    if (!sequence) {
      return res.status(404).json({ error: 'Sequence not found' });
    }

    // Check if template exists (if provided)
    if (templateId) {
      const template = await prisma.template.findUnique({
        where: { id: templateId }
      });

      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }
    }

    const step = await prisma.sequenceStep.create({
      data: {
        sequenceId: req.params.id,
        templateId: templateId || null,
        stepOrder,
        delayDays,
        delayHours,
        delayMinutes,
        subject: subject || null,
        body: body || null,
        triggerType,
        triggerStepId: triggerStepId || null,
        isActive
      },
      include: {
        template: true
      }
    });

    console.log('✅ Step added successfully:', { stepId: step.id, stepOrder: step.stepOrder });

    res.status(201).json(step);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ 
        error: 'Step order already exists in this sequence' 
      });
    }
    console.error('❌ Error adding step to sequence:', error);
    res.status(500).json({ error: 'Failed to add step to sequence' });
  }
});

// PUT /api/sequences/:id/steps/:stepId - Update sequence step
router.put('/:id/steps/:stepId', async (req, res) => {
  try {
    const { 
      templateId, 
      stepOrder, 
      delayDays, 
      delayHours, 
      delayMinutes,
      subject,
      body,
      triggerType,
      triggerStepId,
      isActive 
    } = req.body;

    console.log('🔄 Updating sequence step:', { 
      stepId: req.params.stepId, 
      stepOrder, 
      triggerType, 
      triggerStepId 
    });

    // Validate trigger conditions
    if (triggerType && ['opened', 'not_opened', 'replied'].includes(triggerType)) {
      if (!triggerStepId) {
        return res.status(400).json({ 
          error: `Step with triggerType "${triggerType}" must have a valid triggerStepId` 
        });
      }
    }

    const updateData = {};
    if (templateId !== undefined) updateData.templateId = templateId;
    if (stepOrder !== undefined) updateData.stepOrder = stepOrder;
    if (delayDays !== undefined) updateData.delayDays = delayDays;
    if (delayHours !== undefined) updateData.delayHours = delayHours;
    if (delayMinutes !== undefined) updateData.delayMinutes = delayMinutes;
    if (subject !== undefined) updateData.subject = subject;
    if (body !== undefined) updateData.body = body;
    if (triggerType !== undefined) updateData.triggerType = triggerType;
    if (triggerStepId !== undefined) updateData.triggerStepId = triggerStepId;
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

    console.log('✅ Step updated successfully:', { stepId: step.id, stepOrder: step.stepOrder });

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
    console.error('❌ Error updating sequence step:', error);
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

// PUT /api/sequences/:id/trigger - Set trigger step for sequence
router.put('/:id/trigger', async (req, res) => {
  try {
    const { triggerStepId } = req.body;
    const sequenceId = req.params.id;

    console.log('🎯 Setting trigger step:', { sequenceId, triggerStepId });

    if (!triggerStepId) {
      return res.status(400).json({ 
        success: false,
        error: 'triggerStepId is required' 
      });
    }

    // Verify sequence exists
    const sequence = await prisma.sequence.findUnique({
      where: { id: sequenceId },
      include: {
        steps: {
          orderBy: { stepOrder: 'asc' }
        }
      }
    });

    if (!sequence) {
      return res.status(404).json({ 
        success: false,
        error: 'Sequence not found' 
      });
    }

    // Verify the trigger step exists in this sequence
    const triggerStep = sequence.steps.find(step => step.id === triggerStepId);
    if (!triggerStep) {
      return res.status(400).json({ 
        success: false,
        error: 'Trigger step not found in this sequence' 
      });
    }

    // Update sequence to store trigger step reference
    // We'll add a triggerStepId field to the sequence table
    const updatedSequence = await prisma.sequence.update({
      where: { id: sequenceId },
      data: { 
        updatedAt: new Date() // Update timestamp to track changes
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

    // Store trigger step info using Prisma
    await prisma.sequenceTrigger.upsert({
      where: { sequenceId },
      update: { triggerStepId },
      create: { 
        sequenceId, 
        triggerStepId 
      }
    });

    console.log('✅ Trigger step set successfully:', { sequenceId, triggerStepId, stepOrder: triggerStep.stepOrder });

    res.json({
      success: true,
      message: 'Trigger step set successfully',
      data: {
        sequenceId,
        triggerStepId,
        triggerStepOrder: triggerStep.stepOrder,
        sequence: updatedSequence
      }
    });

  } catch (error) {
    console.error('❌ Error setting trigger step:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ 
        success: false,
        error: 'Sequence not found' 
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to set trigger step' 
    });
  }
});

// GET /api/sequences/:id/trigger - Get trigger step for sequence
router.get('/:id/trigger', async (req, res) => {
  try {
    const sequenceId = req.params.id;

    console.log('🔍 Getting trigger step for sequence:', sequenceId);

    // Get trigger step info using Prisma
    const triggerInfo = await prisma.sequenceTrigger.findUnique({
      where: { sequenceId },
      include: {
        triggerStep: {
          include: {
            template: true
          }
        }
      }
    });

    if (!triggerInfo) {
      return res.json({
        success: true,
        data: {
          hasTrigger: false,
          triggerStepId: null,
          triggerStepOrder: null
        }
      });
    }

    res.json({
      success: true,
      data: {
        hasTrigger: true,
        triggerStepId: triggerInfo.triggerStepId,
        triggerStepOrder: triggerInfo.triggerStep.stepOrder,
        stepId: triggerInfo.triggerStep.id,
        templateName: triggerInfo.triggerStep.template?.name,
        subject: triggerInfo.triggerStep.template?.subject
      }
    });

  } catch (error) {
    console.error('❌ Error getting trigger step:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get trigger step' 
    });
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
