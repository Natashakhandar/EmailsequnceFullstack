const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkLock() {
  try {
    const enrollments = await prisma.enrollment.findMany({
      where: {
        id: { in: ['cmmds0hd1000g11epumcf9mi6', 'cmmeiegu20001lb3xdqi82ncn', 'cmmlp1ib1000614bwof0uwtra', 'cmmlp3kqv000f14bwqbveimhf'] }
      }
    });

    enrollments.forEach(e => {
      console.log(`Enrollment ${e.id}: currentStep=${e.currentStep}, lastSentStep=${e.lastSentStep}, status=${e.status}`);
    });

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

checkLock();
