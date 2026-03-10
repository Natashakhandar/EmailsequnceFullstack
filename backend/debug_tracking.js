
const prisma = require('./src/db/prismaClient');

async function checkOpenTracking() {
  try {
    console.log('--- SENT EVENTS ---');
    const sentEvents = await prisma.event.findMany({
      where: { type: 'SENT' },
      orderBy: { timestamp: 'desc' },
      take: 5,
      include: { contact: true }
    });

    for (const e of sentEvents) {
      const openCount = await prisma.event.count({
        where: {
          type: 'OPENED',
          emailId: e.emailId
        }
      });
      console.log(`ID: ${e.id}, emailId: ${e.emailId}, Contact: ${e.contact.email}, Open Count: ${openCount}`);
      
      // Also check fuzzy matches manually
      if (openCount === 0 && e.emailId) {
        const cleanId = e.emailId.replace(/[<>]/g, '');
        const fuzzyOpen = await prisma.event.findFirst({
           where: {
             type: 'OPENED',
             OR: [
               { emailId: { contains: cleanId } },
               { details: { contains: cleanId } }
             ]
           }
        });
        if (fuzzyOpen) {
          console.log(`  Found fuzzy match! Open Event ID: ${fuzzyOpen.id}, Type: ${fuzzyOpen.type}`);
        }
      }
    }

    console.log('\n--- ALL OPENED EVENTS ---');
    const openedEvents = await prisma.event.findMany({
      where: { type: 'OPENED' },
      orderBy: { timestamp: 'desc' },
      take: 5
    });
    console.log(JSON.stringify(openedEvents, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

checkOpenTracking();
