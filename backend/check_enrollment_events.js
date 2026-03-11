const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkEvents() {
  try {
    const enrollments = ['cmmds0hd1000g11epumcf9mi6', 'cmmeiegu20001lb3xdqi82ncn', 'cmmlp1ib1000614bwof0uwtra', 'cmmlp3kqv000f14bwqbveimhf'];
    
    for (const eid of enrollments) {
      const events = await prisma.event.findMany({
        where: { enrollmentId: eid },
        orderBy: { timestamp: 'desc' }
      });
      console.log(`Enrollment ${eid}: ${events.length} events.`);
      events.forEach(ev => {
        console.log(`  - [${ev.timestamp.toISOString()}] ${ev.type} ${ev.details?.substring(0, 50)}`);
      });
    }

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

checkEvents();
