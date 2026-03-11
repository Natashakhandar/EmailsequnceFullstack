const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkNextSend() {
  try {
    const eids = ['cmmds0hd1000g11epumcf9mi6', 'cmmeiegu20001lb3xdqi82ncn', 'cmmlp1ib1000614bwof0uwtra', 'cmmlp3kqv000f14bwqbveimhf'];
    const enrollments = await prisma.enrollment.findMany({
      where: { id: { in: eids } }
    });

    enrollments.forEach(e => {
      console.log(`ID: ${e.id}, nextSendAt: ${e.nextSendAt?.toISOString()}, status: ${e.status}, currentStep: ${e.currentStep}, lastSentStep: ${e.lastSentStep}`);
    });

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

checkNextSend();
