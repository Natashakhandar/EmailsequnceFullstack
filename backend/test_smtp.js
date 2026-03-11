const { sendTestEmail } = require('./src/mailer/sendEmail');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    const config = await prisma.emailConfig.findFirst({
      where: { smtpUser: 'natasha@boostnow.in' }
    });

    if (!config) {
      console.log('Config not found!');
      return;
    }

    console.log('Testing SMTP for:', config.smtpUser);
    const result = await sendTestEmail(
      'natashakhandr05@gmail.com', // Recipient
      'Immediate Test email',
      'If you see this, sending works!',
      config
    );

    console.log('Result:', result);

  } catch (err) {
    console.error('Test error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

test();
