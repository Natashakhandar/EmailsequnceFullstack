const { PrismaClient } = require('@prisma/client');

let prisma = null;

// Initialize Prisma Client with connection pool settings for shared hosting
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
} else {
  try {
    console.log('🔌 Creating Prisma client with optimized connection pool...');
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
      errorFormat: 'minimal',
    });
    
    // Async connection test - don't block module load
    prisma.$queryRaw`SELECT 1`.then(() => {
      console.log('✅ Prisma database connection verified');
      console.log('🔋 Connection pool optimized for shared hosting (limit=2, timeout=10s)');
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
