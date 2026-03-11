const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkConfigs() {
  try {
    const configs = await prisma.emailConfig.findMany({
      include: { user: true }
    });

    console.log(`Found ${configs.length} email configs.`);
    configs.forEach(c => {
      console.log(`User: ${c.user.email}`);
      console.log(`  SMTP: ${c.smtpHost}:${c.smtpPort} (User: ${c.smtpUser})`);
    });

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

checkConfigs();
