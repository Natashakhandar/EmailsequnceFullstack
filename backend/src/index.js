const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
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
const smtpRouter = require('./routes/smtp');

const { startScheduler } = require('./jobs/scheduler');
const { initializeSocket } = require('./services/socketService');

const app = express();
const http = require('http');
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

// --- 1. ABSOLUTE TOP: Diagnostics (Bypass all middleware) ---
app.get('/ping', (req, res) => res.status(200).send('pong-v7-master-stable'));
app.get('/api/ping', (req, res) => res.status(200).send('pong-api-v7-master-stable'));

// --- 2. GLOBAL MIDDLEWARE (Security & Parsers) ---
app.use(cors({ origin: '*', credentials: true }));
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Custom Response Headers
app.use((req, res, next) => {
  res.setHeader('X-Power-Source', 'NodeJS-Master-V7');
  res.setHeader('X-Active-Port', PORT);
  next();
});

// --- 3. API ROUTES ---
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

// Fallback for missing /api
app.use('/auth', authRouter);

// --- 4. FRONTEND SERVING ---
// Robust discovery of static assets
const feAssets = [
  path.join(process.cwd(), 'dist'),
  path.join(process.cwd(), 'public'),
  path.join(process.cwd(), '../dist'),
  path.join(__dirname, '../../dist'),
  path.join(__dirname, '../public')
].find(p => fs.existsSync(path.join(p, 'index.html'))) || path.join(process.cwd(), 'public');

app.use(express.static(feAssets));

// --- 5. SPA CATCH-ALL ---
app.get('*', (req, res, next) => {
  // Never serve HTML for API requests
  if (req.path.startsWith('/api/') || req.path.startsWith('/auth/')) {
    return res.status(404).json({ error: 'API endpoint not found', path: req.path });
  }
  res.sendFile(path.join(feAssets, 'index.html'));
});

// --- 6. START SERVER ---
initializeSocket(server);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 MASTER STABLE V7: Running on port ${PORT}`);
  
  // Write persistent diagnostic file
  try {
    fs.writeFileSync(path.join(process.cwd(), 'v7_status.txt'), 
      `STATUS: STABLE\nPORT: ${PORT}\nTIME: ${new Date().toISOString()}\nFE: ${feAssets}`);
  } catch (e) {}

  try { 
    prisma.$connect().catch(e => console.error('DB FAIL:', e.message));
    startScheduler(); 
  } catch (e) {}
});

module.exports = app;
