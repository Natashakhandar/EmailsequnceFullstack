const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const events = await prisma.event.findMany({
    where: { type: { in: ['OPENED', 'REPLIED'] } },
    select: { enrollmentId: true, type: true }
  });

  const nullCounts = events.reduce((acc, e) => {
    if (e.enrollmentId === null) {
      acc[e.type] = (acc[e.type] || 0) + 1;
    }
    return acc;
  }, {});

  console.log('Total events counts:');
  const totals = events.reduce((acc, e) => {
    acc[e.type] = (acc[e.type] || 0) + 1;
    return acc;
  }, {});
  console.log(totals);
  
  console.log('\nOpened/Replied events with NULL enrollmentId:');
  console.log(nullCounts);
}

main().finally(() => prisma.$disconnect());
