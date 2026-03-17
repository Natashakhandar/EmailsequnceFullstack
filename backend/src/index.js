const path = require('path');
const fs = require('fs');

// 0. Capture System Port BEFORE loading .env (Critical for Hostinger)
const SYSTEM_PORT = process.env.PORT;

// 1. Robust Environment Variable Loading
const envPaths = [
  path.join(__dirname, '../.env.development'),
  path.join(__dirname, '../.env'),
  path.join(__dirname, '../../.env'),
  path.join(process.cwd(), '.env'),
  path.join(process.cwd(), 'backend/.env'),
  path.join(process.cwd(), 'backend/.env.development')
];

let envFound = false;
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
    console.log(`✅ Loaded environment from: ${envPath}`);
    envFound = true;
    break;
  }
}

if (!envFound) {
  console.warn('⚠️ No .env file found in standard locations. Using system environment variables.');
}

// 🚀 DEPLOYMENT TRIGGER: DB Credential Update
// Last updated: 2026-03-17 09:45:00
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
const warmupRouter = require('./routes/warmup');

// Import scheduler and email monitor
const { startScheduler } = require('./jobs/scheduler');
const { startEmailMonitoring } = require('./jobs/emailMonitorJob');
const { initializeSocket } = require('./services/socketService');

const app = express();
const http = require('http');
const server = http.createServer(app);

// 2. Port Configuration - Hostinger provides PORT env var, MUST use it
// Always prioritize the port provided by the system/host
const PORT = SYSTEM_PORT || process.env.PORT || 3001;

app.set('trust proxy', true); // Trust Hostinger proxy for accurate IP tracking

const SERVER_ID = Math.random().toString(36).substring(7);
console.log(`🆔 Server Instance ID: ${SERVER_ID}`);


const REQUIRED_ENVS = ['DATABASE_URL', 'JWT_SECRET', 'NODE_ENV'];
REQUIRED_ENVS.forEach(env => {
  if (!process.env[env]) {
    console.warn(`⚠️ Warning: ${env} is not defined in process.env`);
  } else {
    console.log(`✅ ${env} is present`);
  }
});

if (process.env.DATABASE_URL) {
  console.log('🔍 DATABASE_URL protocol:', process.env.DATABASE_URL.split(':')[0]);
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
      'email.boostnow.in',
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

// 1. Global Request Logger (To debug 404s on hosted site)
app.use((req, res, next) => {
  if (!req.path.includes('.') && !req.path.startsWith('/static')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - IP: ${req.ip}`);
  }
  next();
});

// 1. Health & Ping (Highest Priority)
app.get('/health', async (req, res) => {
  let dbStatus = 'NOT CONFIGURED';
  if (process.env.DATABASE_URL) {
    try {
      const prisma = require('./db/prismaClient');
      await prisma.$queryRaw`SELECT 1`;
      dbStatus = 'CONNECTED';
    } catch (e) {
      dbStatus = `ERROR: ${e.message}`;
    }
  }

  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    port: PORT,
    db: dbStatus,
    url: req.url,
    headers: req.headers['host']
  });
});

app.get('/api/ping', (req, res) => res.json({ status: 'pong', timestamp: new Date().toISOString(), serverId: SERVER_ID }));

// Debug routes endpoint
app.get('/api/debug-routes', (req, res) => {
  const routes = [];
  try {
    app._router.stack.forEach(middleware => {
      if (middleware.route) {
        routes.push(`${Object.keys(middleware.route.methods).join(',').toUpperCase()} ${middleware.route.path}`);
      } else if (middleware.name === 'router') {
        middleware.handle.stack.forEach(handler => {
          if (handler.route) {
            const path = handler.route.path;
            const methods = Object.keys(handler.route.methods).join(',').toUpperCase();
            routes.push(`${methods} /api${path}`);
          }
        });
      }
    });
  } catch (e) {
    return res.json({ error: e.message });
  }
  res.json({ routes, serverId: SERVER_ID });
});

// 2. Consolidate API Routes
const apiRouter = express.Router();

// Logger for API requests
apiRouter.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.path}`);
  next();
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/contacts', contactsRouter);
apiRouter.use('/leads', contactsRouter);
apiRouter.use('/templates', templatesRouter);
apiRouter.use('/sequences', sequencesRouter);
apiRouter.use('/enrollments', enrollmentsRouter);
apiRouter.use('/events', eventsRouter);
apiRouter.use('/unsubscribe', unsubscribeRouter);
apiRouter.use('/scheduler', schedulerRouter);
apiRouter.use('/email-activity', emailActivityRouter);
apiRouter.use('/email-monitoring', emailMonitoringRouter);
apiRouter.use('/profile', profileRouter);
apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/reports', reportsRouter);
apiRouter.use('/campaigns', campaignsRouter);
apiRouter.use('/fix-event-details', fixEventDetailsRouter);
apiRouter.use('/smtp', smtpRouter);
apiRouter.use('/warmup', warmupRouter);
apiRouter.use('/', emailRouter); // Email tracker routes

apiRouter.get('/', (req, res) => {
  res.json({ message: 'Email Sequencing API', version: '1.0.0' });
});

// Register the combined API router
app.use('/api', apiRouter);

// FALLBACK: If the proxy strips /api, we still want auth to work
app.use('/auth', authRouter);

app.get('/ping', (req, res) => res.json({ status: 'pong', note: 'Top level reachable' }));

// Static file serving - Serve frontend build
const possibleFrontendPaths = [
  path.join(__dirname, '../public'),
  path.join(__dirname, '../../public'),
  path.join(__dirname, '../dist'),
  path.join(__dirname, '../../emailseq-frontend/dist'),
  path.join(process.cwd(), 'public'),
  path.join(process.cwd(), 'dist'),
  path.join(process.cwd(), 'emailseq-frontend/dist'),
  path.join(process.cwd(), 'backend/public')
];

let frontendPath = possibleFrontendPaths[0];
for (const p of possibleFrontendPaths) {
  if (fs.existsSync(path.join(p, 'index.html'))) {
    frontendPath = p;
    console.log(`✅ Serving frontend from: ${frontendPath}`);
    break;
  }
}

// Serve static files from the React app
// Priority: backend/public (Internal) -> backend/dist -> root public
app.use(express.static(frontendPath));
app.use(express.static(path.join(__dirname, '../public'))); 

// Log all incoming requests for debugging 404s
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  console.log(`[ROUTE] Serving: ${req.path}`);
  next();
});

// API routes Documentation
app.get('/api', (req, res) => {
  res.json({
    message: 'Email Sequencing Backend API',
    version: '1.0.0',
    endpoints: ['/api/auth/login', '/api/ping', '/health']
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

// 4. SPA Fallback - Only for non-API routes
app.get('*', (req, res, next) => {
  // If it's an API route that reached here, it means 404 in API
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  
  // If it's a static file that wasn't caught by express.static
  if (req.path.includes('.')) {
    return next();
  }

  // Otherwise, serve the SPA
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Start server
initializeSocket(server);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

  try { startScheduler(); } catch (e) { console.error('Scheduler error:', e.message); }
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
