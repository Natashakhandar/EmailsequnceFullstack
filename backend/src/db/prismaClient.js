const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
  errorFormat: 'minimal',
});

// Help debug the engine type being used
console.log('🚀 Prisma initialized with engineType:', process.env.PRISMA_QUERY_ENGINE_TYPE || 'default');

// Graceful shutdown
const shutdown = async () => {
  console.log('🔌 Disconnecting Prisma...');
  try {
    await prisma.$disconnect();
  } catch (e) {
    console.error('Error during Prisma disconnect:', e);
  }
};

process.on('beforeExit', shutdown);
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

module.exports = prisma;
