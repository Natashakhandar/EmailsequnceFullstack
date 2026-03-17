const { PrismaClient } = require('@prisma/client');

let prisma = null;

function getPrismaClient() {
  if (prisma) return prisma;

  console.log('🔌 DATABASE_URL Protocol Check:', process.env.DATABASE_URL ? process.env.DATABASE_URL.split(':')[0] : 'UNDEFINED');
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
