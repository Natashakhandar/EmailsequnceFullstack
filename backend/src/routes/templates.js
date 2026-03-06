const express = require('express');
const prisma = require('../db/prismaClient');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

router.use(authenticateToken);

// GET /api/templates - Get all templates
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 50, isActive } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      userId: req.user.id
    };
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const [templates, total] = await Promise.all([
      prisma.template.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { sequenceSteps: true }
          }
        }
      }),
      prisma.template.count({ where })
    ]);

    res.json({
      templates,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// GET /api/templates/:id - Get single template
router.get('/:id', async (req, res) => {
  try {
    const template = await prisma.template.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id
      },
      include: {
        sequenceSteps: {
          include: {
            sequence: true
          }
        }
      }
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json(template);
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// POST /api/templates - Create new template
router.post('/', async (req, res) => {
  try {
    const { name, subject, body, isActive = true } = req.body;

    if (!name || !subject || !body) {
      return res.status(400).json({
        error: 'Name, subject, and body are required'
      });
    }

    const template = await prisma.template.create({
      data: {
        name: name.trim(),
        subject: subject.trim(),
        body: body.trim(),
        isActive,
        userId: req.user.id
      }
    });

    res.status(201).json(template);
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// PUT /api/templates/:id - Update template
router.put('/:id', async (req, res) => {
  try {
    const { name, subject, body, isActive } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (subject !== undefined) updateData.subject = subject.trim();
    if (body !== undefined) updateData.body = body.trim();
    if (isActive !== undefined) updateData.isActive = isActive;

    const existingTemplate = await prisma.template.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!existingTemplate) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const template = await prisma.template.update({
      where: { id: req.params.id, userId: req.user.id },
      data: updateData
    });

    res.json(template);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Template not found' });
    }
    console.error('Error updating template:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// DELETE /api/templates/:id - Delete template
router.delete('/:id', async (req, res) => {
  try {
    // Check if template is used in any sequences
    const sequenceSteps = await prisma.sequenceStep.findMany({
      where: { templateId: req.params.id }
    });

    if (sequenceSteps.length > 0) {
      return res.status(400).json({
        error: 'Cannot delete template that is used in sequences'
      });
    }

    // Check if template exists and belongs to user
    const template = await prisma.template.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    await prisma.template.delete({
      where: { id: req.params.id, userId: req.user.id }
    });

    res.status(204).send();
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Template not found' });
    }
    console.error('Error deleting template:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

// POST /api/templates/:id/preview - Preview template with sample data
router.post('/:id/preview', async (req, res) => {
  try {
    const { sampleData = {} } = req.body;

    const template = await prisma.template.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id
      }
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Import token replacement utility
    const { replaceTokens } = require('../utils/tokenReplace');

    const previewData = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      company: 'Example Corp',
      ...sampleData
    };

    const previewSubject = replaceTokens(template.subject, previewData);
    const previewBody = replaceTokens(template.body, previewData);

    res.json({
      original: {
        subject: template.subject,
        body: template.body
      },
      preview: {
        subject: previewSubject,
        body: previewBody
      },
      sampleData: previewData
    });
  } catch (error) {
    console.error('Error previewing template:', error);
    res.status(500).json({ error: 'Failed to preview template' });
  }
});

module.exports = router;
