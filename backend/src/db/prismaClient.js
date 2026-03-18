const { PrismaClient } = require('@prisma/client');

let prisma = null;
let initPromise = null;

async function ensurePrismaInitialized() {
  if (prisma) return prisma;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`🔌 Initializing Prisma (attempt ${attempt}/3)...`);
        
        if (!process.env.DATABASE_URL) {
          throw new Error('DATABASE_URL not set');
        }

        prisma = new PrismaClient({
          log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error', 'warn'],
          errorFormat: 'minimal',
        });

        // Verify connection
        await prisma.$queryRaw`SELECT 1`;
        console.log('✅ Prisma initialized');
        return prisma;
      } catch (error) {
        console.error(`❌ Attempt ${attempt} failed:`, error.message);
        if (prisma) {
          try { await prisma.$disconnect(); } catch (e) {}
          prisma = null;
        }
        if (attempt < 3) await new Promise(r => setTimeout(r, 2000));
      }
    }
    throw new Error('Prisma initialization failed after 3 attempts');
  })();

  return initPromise;
}

// Lazy proxy - acts like the real client but initializes on first use
const lazyPrismaProxy = new Proxy({}, {
  get: (target, prop) => {
    if (prop === 'getPrismaClient') {
      return () => {
        if (!prisma) throw new Error('Prisma not initialized');
        return prisma;
      };
    }
    if (prop === 'initializePrisma') {
      return ensurePrismaInitialized;
    }
    if (!prisma) throw new Error('Prisma not initialized. Call initializePrisma() first or wait for async initialization.');
    return prisma[prop];
  },
});

// Graceful shutdown
const shutdown = async () => {
  try {
    if (prisma) {
      await prisma.$disconnect();
      prisma = null;
      initPromise = null;
    }
  } catch (e) {
    console.error('Shutdown error:', e.message);
  }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('beforeExit', shutdown);

// Provide both ways to access  
module.exports = lazyPrismaProxy;
module.exports.initializePrisma = ensurePrismaInitialized;
module.exports.getPrismaClient = () => {
  if (!prisma) throw new Error('Prisma not initialized');
  return prisma;
};
