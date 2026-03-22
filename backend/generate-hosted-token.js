const prisma = require('./src/db/prismaClient');
const { v4: uuidv4 } = require('uuid');

async function generateHostedToken() {
  try {
    // First, check if there are any contacts in the database
    const contactCount = await prisma.contact.count();
    console.log(`\n📊 Total contacts in database: ${contactCount}`);

    if (contactCount === 0) {
      console.log('\n❌ No contacts found! Please create a contact first.');
      console.log('You can create a contact through the web dashboard or API.');
      process.exit(1);
    }

    // Get the first contact
    const contact = await prisma.contact.findFirst();
    console.log(`\n✅ Using contact: ${contact.email} (ID: ${contact.id})`);

    // Generate a new unsubscribe token
    const token = uuidv4();
    
    const unsubscribeToken = await prisma.unsubscribeToken.create({
      data: {
        token,
        contactId: contact.id,
        createdAt: new Date()
      },
      include: { contact: { select: { email: true, status: true } } }
    });

    console.log('\n✅ Generated Unsubscribe Token!');
    console.log(`\nToken: ${token}`);
    console.log(`Contact: ${unsubscribeToken.contact.email}`);
    console.log(`Status: ${unsubscribeToken.contact.status}`);
    
    console.log('\n🔗 Unsubscribe Link for Hosted Server:');
    console.log(`https://silver-tapir-929419.hostingersite.com/unsubscribe?token=${token}`);
    
    console.log('\n🔗 API Test Link (GET request):');
    console.log(`https://silver-tapir-929419.hostingersite.com/api/unsubscribe/info/${token}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

generateHostedToken();
