const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSequences() {
  try {
    const sequences = await prisma.sequence.findMany({
      include: {
        steps: { orderBy: { stepOrder: 'asc' } }
      }
    });

    sequences.forEach(s => {
      console.log(`Sequence: ${s.name} (Steps: ${s.steps.length})`);
      s.steps.forEach(step => {
        console.log(`  Step ${step.stepOrder}: Delay ${step.delayDays}d ${step.delayHours}h ${step.delayMinutes}m`);
      });
    });

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

checkSequences();
