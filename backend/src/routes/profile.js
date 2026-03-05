const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Apply authentication middleware to all profile routes
router.use(authenticateToken);

// GET /api/profile/signature - Get user's email signature
router.get('/signature', async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        signature: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      signature: user.signature || ''
    });

  } catch (error) {
    console.error('Error fetching user signature:', error);
    res.status(500).json({
      error: 'Failed to fetch signature',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/profile/signature - Save/update user's email signature
router.post('/signature', async (req, res) => {
  try {
    const userId = req.user.id;
    const { signature } = req.body;

    // Validate signature input
    if (signature !== null && signature !== undefined && typeof signature !== 'string') {
      return res.status(400).json({
        error: 'Signature must be a string or null'
      });
    }

    // Limit signature length (e.g., 10KB)
    if (signature && signature.length > 10000) {
      return res.status(400).json({
        error: 'Signature is too long. Maximum length is 10,000 characters.'
      });
    }

    // Update user signature
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        signature: signature || null,
        updatedAt: new Date()
      },
      select: {
        id: true,
        signature: true,
        updatedAt: true
      }
    });

    console.log(`✅ User signature updated for user ${userId}`);

    res.json({
      success: true,
      message: 'Signature updated successfully',
      signature: updatedUser.signature || '',
      updatedAt: updatedUser.updatedAt
    });

  } catch (error) {
    console.error('Error updating user signature:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(500).json({
      error: 'Failed to update signature',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/profile - Get user profile information (bonus endpoint)
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        signature: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      user: {
        ...user,
        signature: user.signature || ''
      }
    });

  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({
      error: 'Failed to fetch profile',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
