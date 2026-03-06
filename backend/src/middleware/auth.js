const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from database to ensure they still exist and are active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true
      }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid or inactive user' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Middleware to check if user has required role
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

// Middleware to check if user is superadmin
const requireSuperAdmin = requireRole(['SUPERADMIN']);

// Middleware to check if user is admin or superadmin
const requireAdmin = requireRole(['ADMIN', 'SUPERADMIN']);

/**
 * Middleware to make SUPERADMIN read-only.
 * Any non-GET request from a SUPERADMIN will be blocked.
 */
const readOnlyCheck = (req, res, next) => {
  if (req.user && req.user.role === 'SUPERADMIN' && req.method !== 'GET') {
    return res.status(403).json({ error: 'Superadmin is in read-only mode' });
  }
  next();
};

module.exports = {
  authenticateToken,
  requireRole,
  requireSuperAdmin,
  requireAdmin
};
