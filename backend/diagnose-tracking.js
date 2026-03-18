require('dotenv').config();
const prisma = require('./src/db/prismaClient');

async function diagnoseTracking() {
  try {
    console.log('\n🔍 EMAIL TRACKING DIAGNOSTIC\n');
    console.log('═'.repeat(60));

    // 1. Check SENT events
    const sentCount = await prisma.event.count({
      where: { type: 'SENT' }
    });
    console.log(`\n📊 SENT Events: ${sentCount}`);

    // 2. Check OPENED events
    const openedCount = await prisma.event.count({
      where: { type: 'OPENED' }
    });
    console.log(`📊 OPENED Events: ${openedCount}`);

    // 3. Get recent SENT events
    const recentSent = await prisma.event.findMany({
      where: { type: 'SENT' },
      orderBy: { timestamp: 'desc' },
      take: 5,
      include: {
        contact: { select: { email: true } },
        enrollment: { select: { sequence: { select: { name: true } } } }
      }
    });

    console.log(`\n📧 Recent SENT Emails:`);
    recentSent.forEach((e, i) => {
      console.log(`  ${i + 1}. ${e.contact?.email} → ${e.enrollment?.sequence?.name}`);
      console.log(`     Time: ${e.timestamp}`);
      console.log(`     emailId: ${e.emailId}`);
    });

    // 4. Get recent OPENED events
    const recentOpened = await prisma.event.findMany({
      where: { type: 'OPENED' },
      orderBy: { timestamp: 'desc' },
      take: 5,
      include: {
        contact: { select: { email: true } },
        enrollment: { select: { sequence: { select: { name: true } } } }
      }
    });

    console.log(`\n👁️  Recent OPENED Emails:`);
    if (recentOpened.length === 0) {
      console.log(`  ⚠️  No OPENED events found yet`);
      console.log(`  This means tracking pixels haven't loaded from recipients yet.`);
    } else {
      recentOpened.forEach((e, i) => {
        console.log(`  ${i + 1}. ${e.contact?.email} opened → ${e.enrollment?.sequence?.name}`);
        console.log(`     Time: ${e.timestamp}`);
      });
    }

    // 5. Check if tracking pixel URL is correct
    const { emailConfig } = require('./src/config/smtp');
    console.log(`\n🔗 Tracking Endpoint:`);
    console.log(`  Base URL: ${emailConfig.appUrl}`);
    console.log(`  Pixel Endpoint: ${emailConfig.appUrl}/api/track/open?emailId={messageId}`);
    console.log(`  Status: ${emailConfig.appUrl.includes('localhost') ? '⚠️ LOCAL' : '✅ PRODUCTION'}`);

    // 6. Test tracking endpoint
    console.log(`\n🧪 Testing Tracking Endpoint...`);
    if (recentSent.length > 0) {
      const testEmailId = recentSent[0].emailId;
      console.log(`  Would test with: ${emailConfig.appUrl}/api/track/open?emailId=${testEmailId}`);
      console.log(`  Note: This endpoint should return a 1x1 pixel image`);
    }

    console.log(`\n═`.repeat(60));
    console.log(`\n💡 WHAT TO DO:`);
    console.log(`  1. If OPENED count is 0:`);
    console.log(`     → Recipients haven't opened emails yet`);
    console.log(`     → Some email clients block image loading`);
    console.log(`     → Try opening an email yourself through Hostinger`);
    console.log(`  \n  2. To manually test, run: node create-test-open-event.js`);
    console.log(`  \n  3. Check email HTML has tracking pixel injected`);
    console.log(`  \n  4. Verify production URL is correct in .env`);
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('❌ Diagnostic error:', error);
    process.exit(1);
  }
}

diagnoseTracking();
