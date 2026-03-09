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
    req.isImpersonating = !!decoded.isImpersonating;

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
    
    // If impersonating, block any non-GET requests (Read-only Work Mode)
    if (req.isImpersonating && req.method !== 'GET') {
      console.log(`🚫 Blocked ${req.method} request while impersonating`);
      return res.status(403).json({ 
        error: 'In Work Mode: Read-only access only. You cannot make any changes while viewing user work.' 
      });
    }

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
 * Middleware to make impersonation mode read-only.
 * Any non-GET request while impersonating will be blocked.
 */
const readOnlyCheck = (req, res, next) => {
  if (req.isImpersonating && req.method !== 'GET') {
    return res.status(403).json({ 
      error: 'In Work Mode: Read-only access only. You cannot make any changes while viewing user work.' 
    });
  }
  next();
};

module.exports = {
  authenticateToken,
  requireRole,
  requireSuperAdmin,
  requireAdmin,
  readOnlyCheck
};
