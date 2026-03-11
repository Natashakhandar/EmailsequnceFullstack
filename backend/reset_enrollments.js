const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function reset() {
  try {
    const today = new Date();
    today.setHours(today.getHours() - 1); // Set to 1 hour ago to ensure they are "due"

    const result = await prisma.enrollment.updateMany({
      where: {
        lastSentStep: { not: null },
        status: 'ACTIVE'
      },
      data: {
        lastSentStep: null,
        status: 'ACTIVE',
        nextSendAt: new Date()
      }
    });

    console.log(`Reset ${result.count} enrollments.`);

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

reset();
