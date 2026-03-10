
const fs = require('fs');
const prisma = require('./src/db/prismaClient');

async function check() {
  const users = await prisma.user.findMany({ select: { id: true, email: true } });
  const allEvents = await prisma.event.findMany({ include: { contact: true } });

  const summary = {
    users,
    stats: {}
  };

  allEvents.forEach(e => {
    const uid = e.contact?.userId || 'NO_USER';
    if (!summary.stats[uid]) summary.stats[uid] = {};
    const type = e.type;
    summary.stats[uid][type] = (summary.stats[uid][type] || 0) + 1;
  });

  fs.writeFileSync('user_stats.json', JSON.stringify(summary, null, 2));
  process.exit();
}

check();
