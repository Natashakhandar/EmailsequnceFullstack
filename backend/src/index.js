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

// 1. GLOBAL DIAGNOSTICS - Catch everything first
app.use((req, res, next) => {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`📡 [${timestamp}] ${req.method} ${req.path}`);
  
  // Custom headers to identify Node.js is handling it
  res.setHeader('X-Powered-By', 'BoostNow-Email-Suite');
  res.setHeader('X-Node-Port', PORT);
  
  // Quick pong for ANY /ping path
  if (req.path === '/ping' || req.path === '/api/ping') {
    return res.status(200).send('pong-stable-v3');
  }
  
  // Direct health check
  if (req.path === '/health' || req.path === '/api/health') {
    return res.status(200).json({ status: 'OK', message: 'Core API Stable' });
  }

  next();
});

// 2. CORE API ROUTES - Prioritized
app.use('/api/auth', (req, res, next) => {
  res.setHeader('X-API-Category', 'auth');
  next();
}, authRouter);

app.use('/api/contacts', contactsRouter);
app.use('/api/leads', contactsRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/sequences', sequencesRouter);
app.use('/api/enrollments', enrollmentsRouter);
app.use('/api/events', eventsRouter);
app.use('/api/unsubscribe', unsubscribeRouter);
app.use('/api/scheduler', schedulerRouter);
app.use('/api/email-activity', emailActivityRouter);
app.use('/api/email-monitoring', emailMonitoringRouter);
app.use('/api/profile', profileRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/campaigns', campaignsRouter);
app.use('/api/smtp', smtpRouter);

// Fallback for auth if /api is missing
app.use('/auth', authRouter);

// Base API route
app.get('/api', (req, res) => res.json({ message: 'API active', version: '1.2.0' }));

// 3. SECURITY & CORS (After basic diagnostics to avoid blocking them)
app.use(cors({ origin: '*', credentials: true }));
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 4. FRONTEND SERVING
const fs = require('fs');
const frontendPath = [
  path.join(process.cwd(), 'public'),
  path.join(process.cwd(), 'dist'),
  path.join(process.cwd(), 'backend/public'),
  path.join(__dirname, '../public'),
  path.join(__dirname, '../../emailseq-frontend/dist')
].find(p => fs.existsSync(path.join(p, 'index.html'))) || path.join(process.cwd(), 'public');

app.use(express.static(frontendPath));

// 5. CATCH-ALL FOR SPA
app.get('*', (req, res, next) => {
  // Never serve index.html for API paths
  if (req.path.startsWith('/api/') || req.path.startsWith('/auth/')) {
    return next();
  }
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// 6. FINAL 404 FOR API
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API route not found', path: req.path });
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
  
  // Write port to file so user can find it for .htaccess if needed
  try {
    fs.writeFileSync(path.join(process.cwd(), 'startup_diagnostics.txt'), 
      `DATE: ${new Date().toISOString()}\nPORT: ${PORT}\nCWD: ${process.cwd()}\nENV: ${process.env.NODE_ENV}`);
  } catch (e) {}

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
