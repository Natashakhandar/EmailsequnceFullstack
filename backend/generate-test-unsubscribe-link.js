const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

async function main() {
  try {
    // Create token for a real contact
    const token = crypto.randomUUID();
    const created = await prisma.unsubscribeToken.create({
      data: {
        token,
        contactId: 'cmmepfcad000665xlqo7mdqx8' // Natasha's contact ID
      }
    });
    
    console.log('\n✅ TEST UNSUBSCRIBE LINK CREATED\n');
    console.log('Token:', token);
    console.log('\n🔗 Local Test Link:');
    console.log(`http://localhost:3001/api/unsubscribe/${token}`);
    console.log('\n🌐 Production Link:');
    console.log(`https://silver-tapir-929419.hostingersite.com/api/unsubscribe/${token}`);
    console.log('\n📧 Email Link (use this in emails):');
    console.log(`https://email.boostnow.in/api/unsubscribe/${token}`);
    console.log('\n');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
