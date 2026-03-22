const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getResubscribeLink() {
  try {
    // Find an already unsubscribed contact
    const unsubscribedContact = await prisma.contact.findFirst({
      where: { status: 'UNSUBSCRIBED' }
    });

    if (!unsubscribedContact) {
      console.log('❌ No unsubscribed contacts found.');
      console.log('\n📋 Steps to get Resubscribe link:');
      console.log('1. First, unsubscribe using the Unsubscribe link:');
      console.log('   http://localhost:8083/unsubscribe?token=11653bb7-e66f-4e98-a048-d99e99df5a70');
      console.log('2. Select a reason and confirm unsubscribe');
      console.log('3. Then you will see the Resubscribe button on that same page');
      console.log('4. Click the button to resubscribe');
      await prisma.$disconnect();
      return;
    }

    // Get token for this contact
    const token = await prisma.unsubscribeToken.findFirst({
      where: { contactId: unsubscribedContact.id }
    });

    if (!token) {
      console.log('❌ No token found for unsubscribed contact.');
      await prisma.$disconnect();
      return;
    }

    console.log('\n✅ RESUBSCRIBE TEST LINK');
    console.log('\nAlready Unsubscribed Contact:', unsubscribedContact.email);
    console.log('Token:', token.token);
    console.log('\n🔗 Resubscribe Link:');
    console.log('http://localhost:8083/unsubscribe?token=' + token.token);
    console.log('\nWhat you will see:');
    console.log('- Page shows "You\'re Unsubscribed"');
    console.log('- Green "Yes, Re-subscribe Me" button');
    console.log('- Click button to resubscribe');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

getResubscribeLink();
