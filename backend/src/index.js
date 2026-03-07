require('dotenv').config();
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
const PORT = process.env.PORT || 3001;

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

// Debug environment variables (non-sensitive)
app.get('/api/debug-env', (req, res) => {
  const safeEnv = {};
  const sensitiveKeys = ['PASS', 'SECRET', 'KEY', 'URL', 'TOKEN', 'DB', 'DATABASE'];

  Object.keys(process.env).forEach(key => {
    const isSensitive = sensitiveKeys.some(s => key.toUpperCase().includes(s));
    if (!isSensitive) {
      safeEnv[key] = process.env[key];
    }
  });

  res.json({
    env: safeEnv,
    node_version: process.version,
    platform: process.platform,
    cwd: process.cwd()
  });
});

// Debug port file read
app.get('/api/read-port', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const portFile = path.join(__dirname, '../port.txt');
  if (fs.existsSync(portFile)) {
    res.send(fs.readFileSync(portFile, 'utf8'));
  } else {
    res.status(404).send('port.txt not found at ' + portFile);
  }
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

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Email Sequencing Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      contacts: '/api/contacts',
      leads: '/api/leads',
      templates: '/api/templates',
      sequences: '/api/sequences',
      enrollments: '/api/enrollments',
      events: '/api/events',
      unsubscribe: '/api/unsubscribe',
      scheduler: '/api/scheduler',
      tracking: '/api/track',
      emailActivity: '/api/email-activity',
      emailMonitoring: '/api/email-monitoring',
      profile: '/api/profile',
      dashboard: '/api/dashboard',
      reports: '/api/reports',
      campaigns: '/api/campaigns',
      smtp: '/api/smtp'
    }
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

// Static file serving - Serve frontend build
const path = require('path');
const frontendPath = path.join(__dirname, '../../emailseq-frontend/dist');

// Serve static files from the React app
app.use(express.static(frontendPath));

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

server.listen(PORT, () => {
  console.log(`🚀 Email Sequencing Backend running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);

  // Start the email scheduler
  startScheduler();
  console.log('📧 Email scheduler started');

  // Start the email reply monitor
  startEmailMonitoring();

  // Log port for debugging
  const fs = require('fs');
  const path = require('path');
  fs.writeFileSync(path.join(__dirname, '../port.txt'), `Started on port: ${PORT}\nEnv PORT: ${process.env.PORT}\nTime: ${new Date().toISOString()}`);
});


// Graceful shutdown
const shutdown = () => {
  console.log('Stopping server gracefully...');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

module.exports = app;
