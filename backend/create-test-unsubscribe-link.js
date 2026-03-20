const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function createTestUnsubscribeLink() {
  try {
    console.log('🔍 Checking unsubscribeToken table...');
    
    // First, let's verify the table exists by trying to count records
    const count = await prisma.unsubscribeToken.count().catch(err => {
      console.error('❌ UnsubscribeToken table error:', err.message);
      return null;
    });

    if (count === null) {
      console.error('❌ UnsubscribeToken table might not exist or has issues');
      console.log('\n📝 Solution: Run "npx prisma db push" on the hosting server');
      process.exit(1);
    }

    console.log(`✅ UnsubscribeToken table exists. Current records: ${count}`);

    // Get a valid user first
    const user = await prisma.user.findFirst();
    if (!user) {
      console.error('❌ No users found in database');
      console.log('Please create a user first');
      process.exit(1);
    }
    console.log(`✅ Using user: ${user.email}`);

    // Get or create a test contact
    let testContact = await prisma.contact.findFirst({
      where: { email: 'test-unsubscribe@example.com' }
    });

    if (!testContact) {
      console.log('📧 Creating test contact...');
      testContact = await prisma.contact.create({
        data: {
          email: 'test-unsubscribe@example.com',
          firstName: 'Test',
          lastName: 'Unsubscribe',
          timezone: 'UTC',
          status: 'ACTIVE',
          userId: user.id
        }
      });
      console.log(`✅ Test contact created: ${testContact.id}`);
    } else {
      console.log(`✅ Found existing test contact: ${testContact.id}`);
    }

    // Create an unsubscribe token
    const token = crypto.randomUUID();
    console.log(`\n🎟️  Creating unsubscribe token: ${token}`);

    const unsubToken = await prisma.unsubscribeToken.create({
      data: {
        token,
        contactId: testContact.id
      }
    });

    console.log(`✅ Token created successfully`);

    // Generate the test links
    const localLink = `http://localhost:5173/unsubscribe?token=${token}`;
    const hostedLink = `https://email.boostnow.in/unsubscribe?token=${token}`;
    const backendLink = `https://silver-tapir-929419.hostingersite.com/api/unsubscribe/info/${token}`;

    console.log('\n' + '='.repeat(80));
    console.log('✅ TEST UNSUBSCRIBE LINKS READY');
    console.log('='.repeat(80));
    console.log('\n📱 Frontend Test Link:');
    console.log(hostedLink);
    console.log('\n🏠 Local Dev Link:');
    console.log(localLink);
    console.log('\n🔗 Backend API Check:');
    console.log(backendLink);
    console.log('\n📧 Test Contact:');
    console.log(`Email: ${testContact.email}`);
    console.log(`ID: ${testContact.id}`);
    console.log('\n🎫 Token:');
    console.log(token);
    console.log('\n' + '='.repeat(80));
    console.log('\nTo test:');
    console.log('1. Click the Frontend Test Link above');
    console.log('2. You should see the unsubscribe form');
    console.log('3. Select a reason and submit');
    console.log('4. Should show success message');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Error creating test link:', error.message);
    console.error('\nFull error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUnsubscribeLink();
