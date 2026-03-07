const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

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

// CORS configuration - MUST be before helmet
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:8080',
    'http://localhost:5173',
    'http://localhost:8081',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:8080',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:8081',
    'https://email.boostnow.in',
    'https://www.email.boostnow.in',
    'https://silver-tapir-929419.hostingersite.com'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Security middleware - after CORS so it doesn't block cross-origin requests
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: false,
  contentSecurityPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Increased limit for production to avoid early blocking
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// CORS configuration is already set up above

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});


// API routes
app.use('/api/auth', authRouter);
app.use('/api/contacts', contactsRouter);
app.use('/api/leads', contactsRouter); // Alias for contacts (leads)
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

// Static file serving - Serve frontend build from local public folder
const frontendPath = path.join(__dirname, '../public');

// Serve static files from the React app
app.use(express.static(frontendPath));

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
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// For all other requests, send back index.html (React routing)
// BUT exclude /api routes so they still trigger 404 or their respective handlers
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API Route not found' });
});

// Start server
initializeSocket(server);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

  try { startScheduler(); } catch (e) { console.error('Scheduler error:', e.message); }
  try { startEmailMonitoring(); } catch (e) { console.error('Email monitor error:', e.message); }
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
