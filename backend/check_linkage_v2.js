
const prisma = require('./src/db/prismaClient');

async function check() {
  const events = await prisma.event.findMany({
    select: {
      type: true,
      enrollmentId: true,
      campaignId: true,
      contactId: true
    }
  });
  
  const stats = {
    total: events.length,
    noEnrollment: events.filter(e => !e.enrollmentId).length,
    noCampaign: events.filter(e => !e.campaignId).length,
    noContact: events.filter(e => !e.contactId).length,
    types: {}
  };
  
  events.forEach(e => {
    if (!stats.types[e.type]) stats.types[e.type] = { total: 0, noEnrollment: 0, noCampaign: 0 };
    stats.types[e.type].total++;
    if (!e.enrollmentId) stats.types[e.type].noEnrollment++;
    if (!e.campaignId) stats.types[e.type].noCampaign++;
  });

  console.log(JSON.stringify(stats, null, 2));
  process.exit();
}

check();
