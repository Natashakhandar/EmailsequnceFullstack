const { PrismaClient } = require('@prisma/client');

let prisma = null;

function getPrismaClient() {
  if (prisma) return prisma;

  prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error', 'warn'],
    errorFormat: 'minimal',
  });

  console.log('🚀 Prisma initialized with database connection');

  return prisma;
}

// Graceful shutdown
const shutdown = async () => {
  console.log('🔌 Disconnecting Prisma...');
  try {
    if (prisma) {
      await prisma.$disconnect();
      prisma = null;
    }
  } catch (e) {
    console.error('Error during Prisma disconnect:', e);
  }
};

process.on('beforeExit', shutdown);
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

module.exports = getPrismaClient();
