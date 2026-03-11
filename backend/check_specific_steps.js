const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSteps() {
  try {
    const steps = await prisma.sequenceStep.findMany({
      where: {
        sequence: {
          name: { in: ['Connections', 'Pro', 'Launch', 'Campaign'] }
        },
        stepOrder: 1
      },
      include: { sequence: true }
    });

    console.log(`Found ${steps.length} first steps.`);
    steps.forEach(s => {
      console.log(`Sequence: ${s.sequence.name}`);
      console.log(`  Delay: ${s.delayDays}d ${s.delayHours}h ${s.delayMinutes}m`);
    });

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

checkSteps();
