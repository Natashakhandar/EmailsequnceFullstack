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
  
  // Custom headers to identify Node.js is handling it
  res.setHeader('X-Powered-By', 'BoostNow-Email-Suite');
  res.setHeader('X-Node-Port', PORT);
  res.setHeader('X-Origin-File', 'backend/src/index.js');
  
  // Quick pong for ANY /ping path
  if (req.path === '/ping' || req.path === '/api/ping') {
    return res.status(200).send('pong-stable-v3-final');
  }
  
  // Direct health check
  if (req.path === '/health' || req.path === '/api/health') {
    return res.status(200).json({ status: 'OK', message: 'Core API Stable' });
  }

  next();
});

// 2. CORE API ROUTES - Prioritized
app.use('/api/auth', authRouter);
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

// 3. SECURITY & CORS
app.use(cors({ origin: '*', credentials: true }));
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 4. FRONTEND SERVING
const fs = require('fs');
const frontendPath = [
  path.join(process.cwd(), 'public'),
  path.join(process.cwd(), 'dist'),
  path.join(process.cwd(), '../dist'), // Relative to backend
  path.join(process.cwd(), 'backend/public'),
  path.join(__dirname, '../../dist'),
  path.join(__dirname, '../public')
].find(p => fs.existsSync(path.join(p, 'index.html'))) || path.join(process.cwd(), 'public');

console.log(`📂 Serving frontend from: ${frontendPath}`);
app.use(express.static(frontendPath));

// 5. CATCH-ALL FOR SPA
app.get('*', (req, res) => {
  // Never serve index.html for API paths
  if (req.path.startsWith('/api/') || req.path.startsWith('/auth/')) {
    return res.status(404).json({ error: 'API route not found', path: req.path });
  }
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Start server
initializeSocket(server);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  try {
    fs.writeFileSync(path.join(process.cwd(), 'startup_diagnostics.txt'), 
      `DATE: ${new Date().toISOString()}\nPORT: ${PORT}\nCWD: ${process.cwd()}\nENV: ${process.env.NODE_ENV}`);
  } catch (e) {}

  try { 
    prisma.$connect().catch(e => console.error('DB Warmup Error:', e.message));
    startScheduler(); 
  } catch (e) { console.error('Scheduler error:', e.message); }
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error.message);
  if (error.code === 'ERR_INTERNAL_ASSERTION') process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

const shutdown = () => {
  server.close(() => process.exit(0));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

module.exports = app;
