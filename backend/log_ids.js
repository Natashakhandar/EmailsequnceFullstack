
const fs = require('fs');
const prisma = require('./src/db/prismaClient');

async function check() {
  const sent = await prisma.event.findMany({
    where: { type: 'SENT' },
    orderBy: { timestamp: 'desc' },
    take: 20
  });
  
  const opened = await prisma.event.findMany({
    where: { type: 'OPENED' },
    orderBy: { timestamp: 'desc' },
    take: 20
  });

  const output = {
    sent: sent.map(s => ({ id: s.id, emailId: s.emailId, timestamp: s.timestamp })),
    opened: opened.map(o => ({ id: o.id, emailId: o.emailId, timestamp: o.timestamp }))
  };

  fs.writeFileSync('id_check.json', JSON.stringify(output, null, 2));
  process.exit();
}

check();
