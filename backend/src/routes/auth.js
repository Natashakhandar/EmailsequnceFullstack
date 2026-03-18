const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../db/prismaClient');
const { authenticateToken, requireSuperAdmin, requireAdmin } = require('../middleware/auth');
const { handleConnectionError } = require('../utils/connectionErrorHandler');

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
      console.log('❌ Missing email or password');
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check JWT_SECRET
    if (!process.env.JWT_SECRET) {
      console.error('❌ JWT_SECRET not configured');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Check if Prisma is available
    if (!prisma || !prisma.user) {
      console.error('❌ Prisma not initialized properly');
      return res.status(503).json({ 
        error: 'Database service temporarily unavailable',
        message: 'Prisma client is not ready. Please try again in a moment.'
      });
    }

    console.log('🔍 Looking for user:', email.toLowerCase());

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      console.log('❌ User not found:', email.toLowerCase());
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('✅ User found:', { id: user.id, email: user.email, isActive: user.isActive });

    if (!user.isActive) {
      console.log('❌ User account inactive');
      return res.status(401).json({ error: 'Account is inactive' });
    }

    // Verify password
    console.log('🔑 Verifying password...');
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      console.log('❌ Invalid password');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('✅ Password valid, generating token...');

    // Generate token
    const token = generateToken(user.id);

    // Return user data (without password) and token
    const { password: _, ...userWithoutPassword } = user;

    console.log('✅ Login successful for:', user.email);

    res.json({
      message: 'Login successful',
      user: userWithoutPassword,
      token
    });
  } catch (error) {
    console.error('❌ Login error:', error.message);
    
    // Ensure a response is sent within a timeout
    const responseTimeout = setTimeout(() => {
      if (!res.headersSent) {
        console.error('⚠️ Response timeout - sending fallback error');
        res.status(500).send('Server error');
      }
    }, 3000);
    
    try {
      handleConnectionError(error, res, 'login');
    } finally {
      clearTimeout(responseTimeout);
    }
  }
});

// POST /api/auth/register (only for superadmin/admin to create users)
router.post('/register', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { email, password, firstName, lastName, role = 'USER', managedUserIds = [] } = req.body;

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
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        firstName,
        lastName,
        role,
        ...(role === 'MANAGER' && managedUserIds.length > 0 && {
          managedUsers: {
            connect: managedUserIds.map(id => ({ id }))
          }
        })
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

// GET /api/auth/users - List users (superadmin can see all, manager can see managed users)
router.get('/users', authenticateToken, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'SUPERADMIN' || req.user.role === 'ADMIN';
    const isManager = req.user.role === 'MANAGER';

    if (!isAdmin && !isManager) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const where = isManager ? { managerId: req.user.id } : {};

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        managedUsers: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
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
    const { email, firstName, lastName, role, isActive, managedUserIds } = req.body;

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(email && { email: email.toLowerCase() }),
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(role && { role }),
        ...(isActive !== undefined && { isActive }),
        ...(role === 'MANAGER' && managedUserIds !== undefined && {
          managedUsers: {
            set: managedUserIds.map(id => ({ id }))
          }
        }),
        ...(role && role !== 'MANAGER' && {
          managedUsers: {
            set: []
          }
        })
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        managedUsers: {
          select: {
            id: true,
            email: true
          }
        }
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

// POST /api/auth/impersonate/:userId - Impersonate another user (superadmin/manager only)
router.post('/impersonate/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    console.log(`👤 Impersonation request: ${req.user.email} (Role: ${req.user.role}) -> ${userId}`);

    // Permission check
    if (req.user.role !== 'SUPERADMIN') {
      if (req.user.role !== 'MANAGER') {
        return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
      }

      // Check if this manager manages the target user
      const targetUser = await prisma.user.findFirst({
        where: {
          id: userId,
          managerId: req.user.id
        }
      });

      if (!targetUser) {
        return res.status(403).json({ error: 'Access denied. You can only view work of users you manage.' });
      }
    }

    // Prevent impersonating yourself
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot impersonate yourself' });
    }

    // Find target user (already found for manager above, but need it for superadmin)
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
      message: `Viewing work for ${targetUser.email}`,
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
    const saltRounds = 12;
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
