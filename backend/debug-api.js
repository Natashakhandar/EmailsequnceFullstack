const prisma = require('./src/db/prismaClient');

async function debugHostedApi() {
  try {
    const token = '846d3d45-8325-4adc-82d5-bb0e12a812da';
    
    console.log('\n🔍 Debugging unsubscribe token...\n');
    
    // Check token in database
    const unsubscribeToken = await prisma.unsubscribeToken.findUnique({
      where: { token },
      include: { contact: true }
    });
    
    if (!unsubscribeToken) {
      console.log('❌ Token not found in database');
      process.exit(1);
    }
    
    console.log('✅ Token found!');
    console.log('\nToken Details:');
    console.log('  - Token:', unsubscribeToken.token);
    console.log('  - Contact ID:', unsubscribeToken.contactId);
    console.log('  - Created:', unsubscribeToken.createdAt);
    console.log('  - Used At:', unsubscribeToken.usedAt);
    
    console.log('\nLinked Contact:');
    console.log('  - ID:', unsubscribeToken.contact.id);
    console.log('  - Email:', unsubscribeToken.contact.email);
    console.log('  - Status:', unsubscribeToken.contact.status);
    console.log('  - Unsubscribe Reason:', unsubscribeToken.contact.unsubscribe_reason || unsubscribeToken.contact.unsubscribeReason);
    console.log('  - Unsubscribed At:', unsubscribeToken.contact.unsubscribed_at || unsubscribeToken.contact.unsubscribedAt);
    
    console.log('\n📋 API Response Simulation:');
    console.log(JSON.stringify({
      email: unsubscribeToken.contact.email
    }, null, 2));
    
    // Check if there are any other contacts
    const allContacts = await prisma.contact.findMany({
      select: { id: true, email: true, status: true }
    });
    console.log('\n📋 All Contacts in Database:');
    console.table(allContacts);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

debugHostedApi();
