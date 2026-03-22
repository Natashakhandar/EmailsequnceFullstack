const prisma = require('./src/db/prismaClient');
const { v4: uuidv4 } = require('uuid');

async function generateLocalToken() {
  try {
    // First, check if there are any contacts in the database
    const contactCount = await prisma.contact.count();
    console.log(`\n📊 Total contacts in database: ${contactCount}`);

    if (contactCount === 0) {
      console.log('\n❌ No contacts found! Please create a contact first.');
      process.exit(1);
    }

    // Get the first ACTIVE contact, or any contact
    let contact = await prisma.contact.findFirst({
      where: { status: 'ACTIVE' }
    });

    if (!contact) {
      contact = await prisma.contact.findFirst();
      console.log(`\n⚠️ No ACTIVE contacts found. Using: ${contact.email}`);
    } else {
      console.log(`\n✅ Using ACTIVE contact: ${contact.email}`);
    }

    // Delete old tokens for this contact
    const oldTokens = await prisma.unsubscribeToken.findMany({
      where: { contactId: contact.id }
    });
    
    if (oldTokens.length > 0) {
      await prisma.unsubscribeToken.deleteMany({
        where: { contactId: contact.id }
      });
      console.log(`🗑️ Deleted ${oldTokens.length} old tokens`);
    }

    // Generate a new unsubscribe token
    const token = uuidv4();
    
    const unsubscribeToken = await prisma.unsubscribeToken.create({
      data: {
        token,
        contactId: contact.id,
        createdAt: new Date()
      },
      include: { contact: { select: { email: true, status: true, id: true } } }
    });

    console.log('\n✅ Generated Fresh Local Token!');
    console.log(`\nToken: ${token}`);
    console.log(`Contact: ${unsubscribeToken.contact.email}`);
    console.log(`Status: ${unsubscribeToken.contact.status}`);
    
    console.log('\n🔗 Test Link for Local:');
    console.log(`http://localhost:8083/unsubscribe?token=${token}`);
    
    console.log('\n📋 Token is ready for testing!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

generateLocalToken();
