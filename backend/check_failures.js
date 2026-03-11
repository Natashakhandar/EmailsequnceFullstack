const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkFailures() {
  try {
    const failures = await prisma.event.findMany({
      where: { type: 'FAILED' },
      orderBy: { timestamp: 'desc' },
      take: 10
    });

    console.log(`Found ${failures.length} recent failure events.`);
    failures.forEach(f => {
      console.log(`- [${f.timestamp.toISOString()}] Error: ${f.details}`);
    });

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

checkFailures();
