const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const prisma = require('./db/prismaClient');

// Import routes
const authRouter = require('./routes/auth');
const contactsRouter = require('./routes/contacts');
const templatesRouter = require('./routes/templates');
const sequencesRouter = require('./routes/sequences');
const enrollmentsRouter = require('./routes/enrollments');
const eventsRouter = require('./routes/events');
const unsubscribeRouter = require('./routes/unsubscribe');
const schedulerRouter = require('./routes/scheduler');
const emailRouter = require('./routes/email');
const emailActivityRouter = require('./routes/emailActivity');
const emailMonitoringRouter = require('./routes/emailMonitoring');
const profileRouter = require('./routes/profile');
const dashboardRouter = require('./routes/dashboard');
const reportsRouter = require('./routes/reports');
const campaignsRouter = require('./routes/campaigns');
const fixEventDetailsRouter = require('./routes/fixEventDetails');
const smtpRouter = require('./routes/smtp');

// Import scheduler and email monitor
const { startScheduler } = require('./jobs/scheduler');
const { startEmailMonitoring } = require('./jobs/emailMonitorJob');
const { initializeSocket } = require('./services/socketService');

const app = express();
const http = require('http');
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
app.set('trust proxy', true); // Trust Hostinger proxy for accurate IP tracking


if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is not defined in environment variables');
} else {
  console.log('✅ DATABASE_URL is configured');
}

// CORS configuration - MUST be before helmet
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    const allowedPatterns = [
      'localhost',
      '127.0.0.1',
      'boostnow.in',
      'hostingersite.com'
    ];
    
    const isAllowed = allowedPatterns.some(pattern => origin.includes(pattern));
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log('🚫 CORS Blocked Origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  credentials: true,
  maxAge: 86400 // Cache preflight for 24 hours
}));

// Security middleware - after CORS so it doesn't block cross-origin requests
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: false,
  contentSecurityPolicy: false
}));

// Rate limiting
// Rate limiting - increased for production because Hostinger triggers it often
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000, // Significantly increased to avoid proxy IP issues
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests, please try again later.',
  skip: (req) => req.method === 'OPTIONS', // Never rate limit preflights
});
app.use(limiter);

// CORS configuration is already set up above

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 1. ABSOLUTE TOP DIAGNOSTICS - No dependency, no middleware
app.get('/ping', (req, res) => res.status(200).send('pong-backend-src-stable'));
app.get('/api/ping', (req, res) => res.status(200).send('pong-api-stable'));
app.get('/debug-route', (req, res) => res.json({
  message: 'Backend index.js is reachable',
  cwd: process.cwd(),
  dirname: __dirname,
  port: PORT
}));

// Identifying Header
app.use((req, res, next) => {
  res.setHeader('X-Origin-File', 'backend/src/index.js');
  res.setHeader('X-Handled-By', 'Express');
  next();
});

// Logging
app.use((req, res, next) => {
  if (req.path.startsWith('/api') || req.path.includes('auth')) {
    console.log(`📡 [${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  }
  next();
});

// 2. API ROUTES - Explicitly defined before static serving
app.use('/api/auth', authRouter);
app.use('/api/contacts', contactsRouter);
app.use('/api/leads', contactsRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/sequences', sequencesRouter);
app.use('/api/enrollments', enrollmentsRouter);
app.use('/api/events', eventsRouter);
app.use('/api/unsubscribe', unsubscribeRouter);
app.use('/api/scheduler', schedulerRouter);
app.use('/api', emailRouter);
app.use('/api/email-activity', emailActivityRouter);
app.use('/api/email-monitoring', emailMonitoringRouter);
app.use('/api/profile', profileRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/campaigns', campaignsRouter);
app.use('/api/fix-event-details', fixEventDetailsRouter);
app.use('/api/smtp', smtpRouter);

// API Logic routes & Health check
app.get('/api/health', (req, res) => res.json({ status: 'OK', message: 'API is functional' }));
app.get('/api/ping', (req, res) => res.send('pong-api'));

// 3. FALLBACKS
app.use('/auth', authRouter); // External fallback

// 4. FRONTEND SERVING
const fs = require('fs');
const frontendPath = [
  path.join(process.cwd(), 'public'),
  path.join(process.cwd(), '../dist'), // Relative to backend
  path.join(process.cwd(), 'dist'),
  path.join(__dirname, '../../dist'),
  path.join(__dirname, '../public')
].find(p => fs.existsSync(path.join(p, 'index.html'))) || path.join(process.cwd(), 'public');

console.log(`📂 Serving frontend from: ${frontendPath}`);
app.use(express.static(frontendPath));

// 5. CATCH-ALL FOR SPA
app.get('*', (req, res, next) => {
  // Never serve index.html for API paths
  if (req.path.startsWith('/api/') || req.path.startsWith('/auth/')) {
    return next();
  }
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// API routes Documentation
app.get('/api', (req, res) => {
  res.json({
    message: 'Email Sequencing Backend API',
    version: '1.0.0'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }

  res.status(err.status || 500).json({
    error: 'Internal server error',
    message: err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// API 404 handler
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: 'API Route Not Found' });
});

// Start server
initializeSocket(server);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

  try { 
    prisma.$connect().catch(e => console.error('DB Warmup Error:', e.message));
    startScheduler(); 
  } catch (e) { console.error('Scheduler error:', e.message); }
  // Removed redundant startEmailMonitoring here as it is started by the scheduler
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error.message);
  // Don't exit on IMAP/network errors - only exit on fatal errors
  if (error.code === 'ERR_INTERNAL_ASSERTION') process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  // Don't crash on unhandled promise rejections
});

const shutdown = () => {
  server.close(() => process.exit(0));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

module.exports = app;
