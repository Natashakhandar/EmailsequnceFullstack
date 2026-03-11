const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkEnrollments() {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    console.log('--- Enrollment Statistics ---');
    const totalEnrollments = await prisma.enrollment.count();
    const activeEnrollments = await prisma.enrollment.count({ where: { status: 'ACTIVE' } });
    const todayEnrollments = await prisma.enrollment.count({
      where: {
        createdAt: { gte: startOfToday }
      }
    });

    console.log(`Total Enrollments: ${totalEnrollments}`);
    console.log(`Active Enrollments: ${activeEnrollments}`);
    console.log(`Today's Enrollments: ${todayEnrollments}`);

    if (activeEnrollments > 0) {
      const pendingEnrollments = await prisma.enrollment.findMany({
        where: {
          status: 'ACTIVE',
          OR: [
            { nextSendAt: null },
            { nextSendAt: { lte: now } }
          ]
        },
        include: {
          contact: { select: { email: true } },
          sequence: { select: { name: true } }
        },
        take: 10
      });

      console.log(`\nPending Enrollments Due (Limit 10): ${pendingEnrollments.length}`);
      pendingEnrollments.forEach(e => {
        console.log(`- ID: ${e.id}, Email: ${e.contact.email}, Sequence: ${e.sequence.name}, nextSendAt: ${e.nextSendAt}`);
      });
    }

    const last5Events = await prisma.event.findMany({
      orderBy: { timestamp: 'desc' },
      take: 5,
      include: {
        contact: { select: { email: true } }
      }
    });

    console.log('\nLast 5 Events:');
    last5Events.forEach(ev => {
      console.log(`- [${ev.timestamp.toISOString()}] ${ev.type} to ${ev.contact.email}`);
    });

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

checkEnrollments();
