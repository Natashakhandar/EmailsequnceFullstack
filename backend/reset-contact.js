const prisma = require('./src/db/prismaClient');

async function resetContactStatus() {
  try {
    const contactId = 'cmn1i26qi000111ghds0vbmax'; // khandardolly@gmail.com
    
    console.log(`\n🔄 Resetting contact status (ID: ${contactId})\n`);
    
    const contact = await prisma.contact.update({
      where: { id: contactId },
      data: {
        status: 'ACTIVE',
        unsubscribeReason: null,
        unsubscribedAt: null
      }
    });
    
    console.log('✅ Contact reset to ACTIVE!');
    console.log(`\nContact: ${contact.email}`);
    console.log(`Status: ${contact.status}`);
    console.log(`Ready for new unsubscribe test`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

resetContactStatus();
