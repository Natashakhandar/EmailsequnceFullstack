const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPending() {
  try {
    const now = new Date();
    console.log('Current time:', now.toISOString());

    const activeEnrollments = await prisma.enrollment.findMany({
      where: {
        status: 'ACTIVE'
      },
      include: {
        contact: true,
        sequence: true
      }
    });

    console.log(`Found ${activeEnrollments.length} total ACTIVE enrollments.`);

    const dueEnrollments = activeEnrollments.filter(e => !e.nextSendAt || e.nextSendAt <= now);
    console.log(`Found ${dueEnrollments.length} enrollments that are DUE (nextSendAt <= now).`);

    if (dueEnrollments.length > 0) {
      console.log('Due Enrollments Details:');
      dueEnrollments.forEach(e => {
        console.log(`- ID: ${e.id}, Contact: ${e.contact.email}, Sequence: ${e.sequence.name}, nextSendAt: ${e.nextSendAt ? e.nextSendAt.toISOString() : 'NULL'}`);
      });
    }

    const recentEvents = await prisma.event.findMany({
      take: 10,
      orderBy: { timestamp: 'desc' },
      include: {
        contact: { select: { email: true } }
      }
    });

    console.log('\nLast 10 Events:');
    recentEvents.forEach(ev => {
      console.log(`- [${ev.timestamp.toISOString()}] ${ev.type} to ${ev.contact.email}`);
    });

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

checkPending();
