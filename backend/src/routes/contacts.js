const express = require('express');
const prisma = require('../db/prismaClient');
const router = express.Router();

// GET /api/contacts - Get all contacts with pagination
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 50, status, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          enrollments: {
            include: {
              sequence: true
            }
          },
          _count: {
            select: { events: true }
          }
        }
      }),
      prisma.contact.count({ where })
    ]);

    res.json({
      contacts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

// GET /api/contacts/:id - Get single contact
router.get('/:id', async (req, res) => {
  try {
    const contact = await prisma.contact.findUnique({
      where: { id: req.params.id },
      include: {
        enrollments: {
          include: {
            sequence: true,
            events: {
              orderBy: { timestamp: 'desc' },
              take: 10
            }
          }
        },
        events: {
          orderBy: { timestamp: 'desc' },
          take: 20
        }
      }
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json(contact);
  } catch (error) {
    console.error('Error fetching contact:', error);
    res.status(500).json({ error: 'Failed to fetch contact' });
  }
});

// POST /api/contacts - Create new contact
router.post('/', async (req, res) => {
  try {
    const { email, firstName, lastName, company, timezone = 'UTC' } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if contact already exists
    const existingContact = await prisma.contact.findUnique({
      where: { email }
    });

    if (existingContact) {
      return res.status(409).json({ error: 'Contact with this email already exists' });
    }

    const contact = await prisma.contact.create({
      data: {
        email: email.toLowerCase().trim(),
        firstName: firstName?.trim(),
        lastName: lastName?.trim(),
        company: company?.trim(),
        timezone
      }
    });

    res.status(201).json(contact);
  } catch (error) {
    console.error('Error creating contact:', error);
    res.status(500).json({ error: 'Failed to create contact' });
  }
});

// PUT /api/contacts/:id - Update contact
router.put('/:id', async (req, res) => {
  try {
    const { firstName, lastName, company, timezone, status } = req.body;

    const contact = await prisma.contact.update({
      where: { id: req.params.id },
      data: {
        ...(firstName !== undefined && { firstName: firstName?.trim() }),
        ...(lastName !== undefined && { lastName: lastName?.trim() }),
        ...(company !== undefined && { company: company?.trim() }),
        ...(timezone && { timezone }),
        ...(status && { status })
      }
    });

    res.json(contact);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Contact not found' });
    }
    console.error('Error updating contact:', error);
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

// DELETE /api/contacts/:id - Delete contact
router.delete('/:id', async (req, res) => {
  try {
    const deletedId = req.params.id;
    
    await prisma.contact.delete({
      where: { id: deletedId }
    });

    res.status(200).json({
      message: "Lead deleted successfully",
      deletedId: deletedId
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Contact not found' });
    }
    console.error('Error deleting contact:', error);
    res.status(500).json({ message: 'Failed to delete lead' });
  }
});

// POST /api/contacts/bulk - Bulk import contacts
router.post('/bulk', async (req, res) => {
  try {
    const { contacts } = req.body;

    if (!Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ error: 'Contacts array is required' });
    }

    const results = {
      created: 0,
      skipped: 0,
      errors: []
    };

    for (const contactData of contacts) {
      try {
        if (!contactData.email) {
          results.errors.push({ data: contactData, error: 'Email is required' });
          continue;
        }

        // Check if contact exists
        const existing = await prisma.contact.findUnique({
          where: { email: contactData.email.toLowerCase().trim() }
        });

        if (existing) {
          results.skipped++;
          continue;
        }

        await prisma.contact.create({
          data: {
            email: contactData.email.toLowerCase().trim(),
            firstName: contactData.firstName?.trim(),
            lastName: contactData.lastName?.trim(),
            company: contactData.company?.trim(),
            timezone: contactData.timezone || 'UTC'
          }
        });

        results.created++;
      } catch (error) {
        results.errors.push({ data: contactData, error: error.message });
      }
    }

    res.json(results);
  } catch (error) {
    console.error('Error bulk importing contacts:', error);
    res.status(500).json({ error: 'Failed to import contacts' });
  }
});

// POST /api/contacts/bulk-delete - Bulk delete contacts
router.post('/bulk-delete', async (req, res) => {
  try {
    const { ids } = req.body;

    // Validate ids array
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'No contact IDs provided' });
    }

    // Delete contacts using deleteMany
    const result = await prisma.contact.deleteMany({
      where: {
        id: {
          in: ids
        }
      }
    });

    res.status(200).json({
      message: 'Contacts deleted successfully',
      deleted: result.count
    });
  } catch (error) {
    console.error('Error bulk deleting contacts:', error);
    res.status(500).json({ message: 'Failed to delete contacts' });
  }
});

module.exports = router;
