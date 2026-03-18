const { PrismaClient } = require('@prisma/client');

let prisma = null;

// Initialize Prisma Client
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
} else {
  try {
    console.log('🔌 Creating Prisma client...');
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
      errorFormat: 'minimal',
    });
    
    // Async connection test - don't block module load
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

// Export the client directly - routes will use this
module.exports = prisma || new Proxy({}, {
  get() {
    throw new Error('Prisma client is not initialized. Check DATABASE_URL environment variable.');
  }
});
