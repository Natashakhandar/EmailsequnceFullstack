
const prisma = require('./src/db/prismaClient');

async function checkUserEvents() {
  const users = await prisma.user.findMany();
  console.log('--- USERS ---');
  users.forEach(u => console.log(`${u.id}: ${u.email}`));

  const events = await prisma.event.groupBy({
    by: ['type'],
    include: {
      contact: true
    }
  }).catch(e => {
    // groupBy doesn't support include
    return null;
  });

  const allEvents = await prisma.event.findMany({
    include: {
      contact: true
    }
  });

  const userStats = {};
  allEvents.forEach(e => {
    const uid = e.contact?.userId || 'NO_USER';
    if (!userStats[uid]) userStats[uid] = {};
    userStats[uid][e.type] = (userStats[uid][e.type] || 0) + 1;
  });

  console.log('--- STATS BY USER ---');
  console.log(JSON.stringify(userStats, null, 2));
  
  process.exit();
}

checkUserEvents();
