const { PrismaClient } = require('@prisma/client');

let prisma = null;

// Retry logic with exponential backoff
const withRetry = async (operation, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const isConnectionError = 
        error.code === 'ER_TOO_MANY_CONNECTIONS' || 
        error.code === 'ER_CON_COUNT_ERROR' ||
        error.message?.includes('max_connections');

      if (isConnectionError && attempt < maxRetries) {
        const delay = Math.min(300 * Math.pow(2, attempt - 1), 3000); // Shorter delays
        console.warn(`⚠️ Connection limit (attempt ${attempt}/${maxRetries}), waiting ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
};

// Initialize Prisma Client
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
} else {
  try {
    console.log('🔌 Creating Prisma client...');
    
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error'] : ['error'],
      errorFormat: 'minimal',
    });
    
    // Add middleware to retry on connection errors
    prisma.$use(async (params, next) => {
      try {
        return await withRetry(async () => {
          return await next(params);
        });
      } catch (error) {
        console.error('❌ Prisma query failed:', error.message);
        throw error;
      }
    });
    
    // Test connection
    prisma.$queryRaw`SELECT 1`.then(() => {
      console.log('✅ Prisma database connection verified');
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
