const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const models = ['user', 'contact', 'campaign', 'event', 'enrollment', 'sequence', 'template'];
  for (const model of models) {
    console.log(`Testing ${model}...`);
    try {
      await prisma[model].findMany({ take: 10 });
      console.log(`${model} OK`);
    } catch (e) {
      console.error(`${model} Error:`, e.message);
    }
  }

  // Also try aggregating events
  console.log('Testing event aggregation...');
  try {
    await prisma.event.groupBy({
      by: ['type'],
      _count: { type: true }
    });
    console.log('Event aggregation OK');
  } catch(e) {
    console.error('Event aggregation Error:', e.message);
  }

  // Try campaign findMany
  console.log('Testing campaign findMany with events...');
  try {
    await prisma.campaign.findMany({
      take: 10,
      select: {
        id: true,
        campaignName: true,
        description: true,
        startDate: true,
        endDate: true,
        sequence: { select: { name: true } }
      }
    });
    console.log('Campaign findMany with events OK');
  } catch(e) {
    console.error('Campaign findMany Error:', e.message);
  }

  console.log('Finished testing.');
  await prisma.$disconnect();
}

main();
