const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const events = await prisma.event.findMany({
    select: {
      type: true,
      campaignId: true
    }
  });

  const summary = events.reduce((acc, event) => {
    const type = event.type;
    const hasCampaignId = !!event.campaignId;
    
    if (!acc[type]) acc[type] = { total: 0, withCampaignId: 0, withoutCampaignId: 0 };
    acc[type].total++;
    if (hasCampaignId) acc[type].withCampaignId++;
    else acc[type].withoutCampaignId++;
    
    return acc;
  }, {});

  console.log('Event Campaign Correlation:');
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
