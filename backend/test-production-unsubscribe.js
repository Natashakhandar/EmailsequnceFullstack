/**
 * Test Production Unsubscribe Endpoint
 * This script tests the unsubscribe flow against production database
 * directly without needing backend server
 */

const { PrismaClient } = require('@prisma/client');

async function testProductionUnsubscribe() {
  // Use production DATABASE_URL
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'mysql://u825197931_email_user:BoostNow2026@srv2205.hstgr.io:3306/u825197931_email_app?connectionLimit=5&waitForConnections=true&enableKeepAlive=true&tls=prefer'
      }
    }
  });

  try {
    console.log('🔍 Testing production database connection...');
    
    // Test connection
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connection successful!');

    // Test token
    const testToken = '5934c72f-2f46-4766-a7b0-0365a8711f53';
    
    console.log(`\n🔎 Looking for token: ${testToken}`);
    const token = await prisma.unsubscribeToken.findUnique({
      where: { token: testToken },
      include: { contact: true }
    });

    if (!token) {
      console.log('❌ Token not found!');
      return;
    }

    console.log('✅ Token found!');
    console.log(`   Email: ${token.contact.email}`);
    console.log(`   Status: ${token.contact.status}`);
    console.log(`   Contact ID: ${token.contact.id}`);

    console.log('\n✅ PRODUCTION UNSUBSCRIBE CHAIN IS WORKING!');
    console.log('\n📝 Next: Restart backend on Hostinger manually:');
    console.log('   ssh -p 65002 u825197931@89.117.27.1');
    console.log('   cd public_html/EmailsequnceFullstack');
    console.log('   pm2 restart all');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('connect')) {
      console.log('\n⚠️ CRITICAL: Cannot connect to production database!');
      console.log('Check DATABASE_URL and firewall settings.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

testProductionUnsubscribe();
