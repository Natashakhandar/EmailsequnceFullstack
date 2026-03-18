require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const prisma = require('./src/db/prismaClient');

async function createTestToken() {
  try {
    // Get the first contact from the database
    const contact = await prisma.contact.findFirst({
      where: {
        email: {
          contains: '@'
        }
      }
    });

    if (!contact) {
      console.log('❌ No contacts found in database. Create a contact first!');
      process.exit(1);
    }

    // Create a new unsubscribe token
    const token = uuidv4();
    const unsubscribeToken = await prisma.unsubscribeToken.create({
      data: {
        token,
        contactId: contact.id
      }
    });

    const unsubscribeUrl = `http://localhost:3001/api/unsubscribe/${token}`;
    
    console.log('\n✅ Test Unsubscribe Token Created!\n');
    console.log(`Contact Email: ${contact.email}`);
    console.log(`Token: ${token}`);
    console.log(`\nTest Link (localhost): ${unsubscribeUrl}`);
    console.log(`\nTest Link (production): https://email.boostnow.in/api/unsubscribe/${token}`);
    console.log('\n📧 Share the production link in your test email!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating token:', error);
    process.exit(1);
  }
}

createTestToken();
