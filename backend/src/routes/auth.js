const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../db/prismaClient');
const { authenticateToken, requireSuperAdmin, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Generate JWT token
const generateToken = (userId, extraClaims = {}) => {
  return jwt.sign({ userId, ...extraClaims }, process.env.JWT_SECRET, { expiresIn: '24h' });
};

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    console.log('🔐 Login attempt received:', { email: req.body?.email, hasPassword: !!req.body?.password });

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check JWT_SECRET
    if (!process.env.JWT_SECRET) {
      console.error('❌ JWT_SECRET not configured');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(401).json({ error: 'Account is inactive' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken(user.id);

    // Return user data (without password) and token
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      message: 'Login successful',
      user: userWithoutPassword,
      token
    });
  } catch (error) {
    console.error('❌ Login error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    res.status(500).json({ 
      error: error.message || 'Internal server error', 
      message: error.message,
      code: error.code,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// POST /api/auth/register (only for superadmin/admin to create users)
router.post('/register', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { email, password, firstName, lastName, role = 'USER' } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        firstName,
        lastName,
        role
      }
    });

    // Return user data (without password)
    const { password: _, ...userWithoutPassword } = user;

    res.status(201).json({
      message: 'User created successfully',
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/signup - Open registration disabled (only superadmin can add users)
router.post('/signup', async (req, res) => {
  return res.status(403).json({ error: 'Open registration is disabled. Please contact an administrator.' });
});

// GET /api/auth/me - Get current user info
router.get('/me', authenticateToken, async (req, res) => {
  try {
    res.json({
      user: req.user
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // In a more sophisticated setup, you might want to blacklist the token
    // For now, we'll just return success and let the client handle token removal
    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/users - List all users (superadmin only)
router.get('/users', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/auth/users/:id - Update user (superadmin/admin only)
router.put('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { email, firstName, lastName, role, isActive } = req.body;

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(email && { email: email.toLowerCase() }),
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(role && { role }),
        ...(isActive !== undefined && { isActive })
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    res.json({
      message: 'User updated successfully',
      user
    });
  } catch (error) {
    console.error('Update user error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/auth/users/:id - Delete user (superadmin/admin only)
router.delete('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent superadmin from deleting themselves
    if (id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    await prisma.user.delete({
      where: { id }
    });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/impersonate/:userId - Impersonate another user (superadmin only)
router.post('/impersonate/:userId', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    console.log(`👤 Impersonation request: ${req.user.email} -> ${userId}`);

    // Prevent impersonating yourself (waste of time)
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot impersonate yourself' });
    }

    // Find target user
    const targetUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'Target user not found' });
    }

    if (!targetUser.isActive) {
      return res.status(400).json({ error: 'Cannot impersonate an inactive user' });
    }

    // Generate token for target user (mark as impersonating for read-only mode)
    const token = generateToken(targetUser.id, { isImpersonating: true });
    const { password: _, ...userWithoutPassword } = targetUser;

    console.log(`✅ Impersonation successful: Logged in as ${targetUser.email}`);

    res.json({
      message: `Impersonating ${targetUser.email}`,
      user: userWithoutPassword,
      token,
      isImpersonating: true,
      originalUser: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role
      }
    });
  } catch (error) {
    console.error('Impersonation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/users/:id/change-password - Change user password (superadmin only)
router.post('/users/:id/change-password', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'New password is required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Hash new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword }
    });

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
