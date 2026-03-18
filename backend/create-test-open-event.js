require('dotenv').config();
const prisma = require('./src/db/prismaClient');

async function createTestOpenedEvent() {
  try {
    console.log('\n✉️ CREATING TEST OPENED EVENT\n');

    // Get the most recent SENT event
    const latestSent = await prisma.event.findFirst({
      where: { type: 'SENT' },
      orderBy: { timestamp: 'desc' },
      include: {
        contact: { select: { email: true, id: true } },
        enrollment: { select: { id: true, sequence: { select: { name: true } } } }
      }
    });

    if (!latestSent) {
      console.log('❌ No SENT events found. Send a campaign first!');
      process.exit(1);
    }

    console.log(`📧 Latest SENT Event:`);
    console.log(`  Email: ${latestSent.contact.email}`);
    console.log(`  Sequence: ${latestSent.enrollment?.sequence?.name}`);
    console.log(`  Sent at: ${latestSent.timestamp}`);

    // Check if already opened
    const existingOpen = await prisma.event.findFirst({
      where: {
        type: 'OPENED',
        emailId: latestSent.emailId
      }
    });

    if (existingOpen) {
      console.log(`\n⚠️  This email was already opened at: ${existingOpen.timestamp}`);
      console.log(`Skipping creation of duplicate event.`);
      process.exit(0);
    }

    // Create OPENED event
    const openedEvent = await prisma.event.create({
      data: {
        enrollmentId: latestSent.enrollmentId,
        contactId: latestSent.contactId,
        campaignId: latestSent.campaignId,
        type: 'OPENED',
        emailId: latestSent.emailId,
        details: JSON.stringify({
          openedAt: new Date().toISOString(),
          userAgent: 'Mozilla/5.0 (Test Manual Open)',
          ip: '192.168.1.1',
          referer: 'Direct',
          manual: true
        }),
        timestamp: new Date()
      }
    });

    console.log(`\n✅ TEST OPENED EVENT CREATED!`);
    console.log(`  Event ID: ${openedEvent.id}`);
    console.log(`  Type: ${openedEvent.type}`);
    console.log(`  Timestamp: ${openedEvent.timestamp}`);

    console.log(`\n🔄 Steps:`);
    console.log(`  1. Go to Email Activity Logs page`);
    console.log(`  2. Filter by Status = "OPENED"`);
    console.log(`  3. Look for email from: ${latestSent.contact.email}`);
    console.log(`  4. Should appear with "OPENED" badge`);
    console.log(`\nIf it doesn't show, refresh the page or check browser console for errors.`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating test event:', error);
    process.exit(1);
  }
}

createTestOpenedEvent();
