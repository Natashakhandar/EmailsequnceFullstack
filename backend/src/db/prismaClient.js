const { PrismaClient } = require('@prisma/client');

let prisma = null;
let prismaInitError = null;

// Create client immediately without waiting - this prevents blocking startup
function createPrismaClient() {
  if (prisma) return prisma;
  
  if (!process.env.DATABASE_URL) {
    prismaInitError = new Error('DATABASE_URL not set');
    console.error('❌ DATABASE_URL environment variable is not set');
    return null;
  }

  try {
    console.log('🔌 Creating Prisma client...');
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
      errorFormat: 'minimal',
      // Reduce timeout values for shared hosting
      __internal: {
        debug: false,
      }
    });
    
    // Async connection test - don't block startup
    prisma.$queryRaw`SELECT 1`.then(() => {
      console.log('✅ Prisma database connection verified');
    }).catch((err) => {
      console.warn('⚠️ Prisma connection test failed:', err.message);
      // Don't fail startup, routes will handle errors
    });
    
    return prisma;
  } catch (error) {
    prismaInitError = error;
    console.error('❌ Failed to create Prisma client:', error.message);
    return null;
  }
}

// Get prisma client - returns null if creation failed
function getPrisma() {
  if (!prisma) {
    return createPrismaClient();
  }
  return prisma;
}

// Graceful shutdown
const shutdown = async () => {
  try {
    if (prisma) {
      console.log('🛑 Disconnecting Prisma...');
      await prisma.$disconnect();
      prisma = null;
      prismaInitError = null;
    }
  } catch (e) {
    console.error('Shutdown error:', e.message);
  }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('beforeExit', shutdown);

// Export direct client and utilities  
module.exports = getPrisma();

// Also export getter for fresh calls
module.exports.getPrisma = getPrisma;
module.exports.initError = () => prismaInitError;
