const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const events = await prisma.event.findMany({
    include: {
      contact: true
    }
  });

  console.log('Event Analysis (JSON):');
  const summary = events.reduce((acc, event) => {
    const type = event.type;
    const hasUserId = !!event.contact?.userId;
    const userId = event.contact?.userId || 'NULL';
    
    if (!acc[type]) acc[type] = { total: 0, byUser: {} };
    acc[type].total++;
    if (!acc[type].byUser[userId]) acc[type].byUser[userId] = 0;
    acc[type].byUser[userId]++;
    
    return acc;
  }, {});

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
