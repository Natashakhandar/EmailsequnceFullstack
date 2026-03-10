
const prisma = require('./src/db/prismaClient');

async function check() {
  const sent = await prisma.event.findMany({
    where: { type: 'SENT' },
    orderBy: { timestamp: 'desc' },
    take: 10,
    select: { emailId: true, id: true }
  });
  
  console.log('--- SENT ---');
  sent.forEach(s => console.log(s.emailId));

  const opened = await prisma.event.findMany({
    where: { type: 'OPENED' },
    orderBy: { timestamp: 'desc' },
    take: 10,
    select: { emailId: true, id: true }
  });

  console.log('--- OPENED ---');
  opened.forEach(o => console.log(o.emailId));
  
  process.exit();
}

check();
