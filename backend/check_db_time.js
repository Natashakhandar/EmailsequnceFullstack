const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDbTime() {
  try {
    const result = await prisma.$queryRaw`SELECT NOW() as now`;
    console.log('Database NOW():', result[0].now);
    console.log('Local Node.js Date():', new Date().toISOString());
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

checkDbTime();
