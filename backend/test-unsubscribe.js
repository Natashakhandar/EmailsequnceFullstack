const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function testUnsubscribe() {
  try {
    // Get a contact
    const contact = await prisma.contact.findFirst();
    
    if (!contact) {
      console.log('❌ No contacts found in database. Create some contacts first.');
      return;
    }
    
    // Generate a test token
    const testToken = crypto.randomUUID();
    
    console.log('\n🧪 UNSUBSCRIBE TEST LINK\n');
    console.log('Contact Email:', contact.email);
    console.log('Contact ID:', contact.id);
    console.log('\nTest URL:');
    console.log(`http://localhost:8083/unsubscribe?token=${testToken}`);
    console.log('\nToken:', testToken);
    console.log('\n📌 Steps:');
    console.log('1. Open the link above in your browser');
    console.log('2. You should see a loading state');
    console.log('3. After verification, select a reason from dropdown');
    console.log('4. Click "Confirm Unsubscribe"');
    console.log('5. See success message');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testUnsubscribe();
