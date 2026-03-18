const { PrismaClient } = require('@prisma/client');

let prisma = null;
let activeRequests = 0;
const MAX_CONCURRENT_REQUESTS = 2; // Strictly limit concurrent DB requests
const requestQueue = [];

// Request queue manager
const queueRequest = async (operation) => {
  return new Promise((resolve, reject) => {
    const tryExecute = async () => {
      if (activeRequests < MAX_CONCURRENT_REQUESTS) {
        activeRequests++;
        try {
          const result = await operation();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          activeRequests--;
          // Process next in queue
          if (requestQueue.length > 0) {
            const next = requestQueue.shift();
            next();
          }
        }
      } else {
        requestQueue.push(tryExecute);
      }
    };
    tryExecute();
  });
};

// Retry logic with exponential backoff
const withRetry = async (operation, maxRetries = 5) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const isConnectionError = 
        error.code === 'ER_TOO_MANY_CONNECTIONS' || 
        error.code === 'ER_CON_COUNT_ERROR' ||
        error.message.includes('max_connections');

      if (isConnectionError && attempt < maxRetries) {
        const delay = Math.min(500 * Math.pow(2, attempt - 1), 10000); // Max 10 seconds
        console.warn(`⚠️ Connection limit (attempt ${attempt}/${maxRetries}), waiting ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
};

// Initialize Prisma Client with connection settings for shared hosting
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
} else {
  try {
    console.log('🔌 Creating Prisma client with request queuing...');
    
    // Remove connection pool params from URL if they exist
    const dbUrl = process.env.DATABASE_URL.split('?')[0];
    
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: dbUrl,
        },
      },
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
      errorFormat: 'minimal',
    });
    
    // Add middleware to queue and retry all database requests
    prisma.$use(async (params, next) => {
      return withRetry(async () => {
        return queueRequest(async () => {
          return next(params);
        });
      });
    });
    
    // Async connection test - don't block module load
    prisma.$queryRaw`SELECT 1`.then(() => {
      console.log('✅ Prisma database connection verified');
      console.log('🔋 Request queuing enabled (max 2 concurrent, auto-retry on limits)');
    }).catch((err) => {
      console.warn('⚠️ Prisma connection test failed:', err.message);
    });
  } catch (error) {
    console.error('❌ Failed to create Prisma client:', error.message);
    prisma = null;
  }
}

// Graceful shutdown
const shutdown = async () => {
  if (prisma) {
    try {
      console.log('🛑 Disconnecting Prisma...');
      await prisma.$disconnect();
    } catch (e) {
      console.error('Shutdown error:', e.message);
    }
  }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('beforeExit', shutdown);

// Export the client directly
module.exports = prisma || {
  $connect: () => Promise.reject(new Error('Prisma client is not initialized')),
  $disconnect: () => Promise.reject(new Error('Prisma client is not initialized')),
};
