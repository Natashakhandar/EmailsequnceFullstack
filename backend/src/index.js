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

// --- CRITICAL: Diagnostic Routes (Before everything) ---
app.get('/ping', (req, res) => res.status(200).send('pong-v5-stable-final'));
app.get('/api/ping', (req, res) => res.status(200).send('pong-api-v5-stable-final'));

// --- GLOBAL MIDDLEWARE ---
app.use(cors({ origin: '*', credentials: true }));
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

app.use((req, res, next) => {
  res.setHeader('X-Backend-Server', 'NodeJS');
  res.setHeader('X-API-Path', req.path);
  next();
});

// --- API ROUTES ---
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

// Fallback for auth if /api is missing (common in some configs)
app.use('/auth', authRouter);

// --- FRONTEND SERVING ---
// Discovery of frontend assets
const possiblePaths = [
  path.join(process.cwd(), 'dist'),
  path.join(process.cwd(), 'public'),
  path.join(process.cwd(), 'backend/dist'),
  path.join(process.cwd(), 'backend/public'),
  path.join(__dirname, '../../dist'),
  path.join(__dirname, '../public')
];

let frontendPath = null;
for (const p of possiblePaths) {
  if (fs.existsSync(path.join(p, 'index.html'))) {
    frontendPath = p;
    console.log(`✅ Found Frontend Assets at: ${p}`);
    break;
  }
}

if (frontendPath) {
  app.use(express.static(frontendPath));
  
  // SPA Catch-all
  app.get('*', (req, res, next) => {
    // If it's an API request that failed all routes, return 404 JSON, not HTML
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'API route not found', path: req.path });
    }
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
} else {
  console.warn('⚠️ Frontend assets NOT found. Only API routes will work.');
  app.get('/', (req, res) => res.send('API is running, but UI assets were not found.'));
}

// --- START SERVER ---
initializeSocket(server);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server listening on port ${PORT}`);
  
  // Write diagnostic file
  try {
    fs.writeFileSync(path.join(process.cwd(), 'server_info.txt'), 
      `START: ${new Date().toISOString()}\nPORT: ${PORT}\nCWD: ${process.cwd()}\nFE: ${frontendPath}`);
  } catch (e) {}

  try { 
    prisma.$connect().catch(e => console.error('Prisma Error:', e.message));
    startScheduler(); 
  } catch (e) {}
});

module.exports = app;
