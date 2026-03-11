const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCampaigns() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const campaigns = await prisma.campaign.findMany({
      where: {
        createdAt: { gte: today }
      },
      include: {
        _count: {
          select: { campaignLeads: true, enrollments: true, events: true }
        }
      }
    });

    console.log(`Found ${campaigns.length} campaigns created today.`);
    campaigns.forEach(c => {
      console.log(`- Campaign: ${c.campaignName} (ID: ${c.id})`);
      console.log(`  Leads: ${c._count.campaignLeads}, Enrollments: ${c._count.enrollments}, Events: ${c._count.events}`);
      console.log(`  isActive: ${c.isActive}, startDate: ${c.startDate}`);
    });

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

checkCampaigns();
