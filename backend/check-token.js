const prisma = require('./src/db/prismaClient');

async function checkToken() {
  try {
    const token = process.argv[2];
    
    if (!token) {
      console.log('Usage: node check-token.js <token>');
      console.log('Example: node check-token.js 78760bef-ac06-4a8d-bdda-fc80fbb7f4d2');
      process.exit(1);
    }

    console.log(`\n🔍 Checking token: ${token}\n`);

    // Check if token exists
    const unsubscribeToken = await prisma.unsubscribeToken.findUnique({
      where: { token },
      include: { contact: true }
    });

    if (!unsubscribeToken) {
      console.log('❌ Token NOT found in database');
      console.log('\n📋 All tokens in database:');
      const allTokens = await prisma.unsubscribeToken.findMany({
        include: { contact: { select: { id: true, email: true, status: true } } },
        take: 10
      });
      console.table(allTokens);
      process.exit(1);
    }

    console.log('✅ Token FOUND!\n');
    console.log('Token Details:');
    console.log('  - ID:', unsubscribeToken.id);
    console.log('  - Token:', unsubscribeToken.token);
    console.log('  - Created:', unsubscribeToken.createdAt);
    console.log('  - Used At:', unsubscribeToken.usedAt);
    console.log('  - Contact ID:', unsubscribeToken.contactId);
    
    if (unsubscribeToken.contact) {
      console.log('\nLinked Contact:');
      console.log('  - Email:', unsubscribeToken.contact.email);
      console.log('  - Status:', unsubscribeToken.contact.status);
      console.log('  - ID:', unsubscribeToken.contact.id);
    } else {
      console.log('\n⚠️ WARNING: Contact NOT linked to this token!');
    }

    // Check token age
    const tokenAge = Date.now() - unsubscribeToken.createdAt.getTime();
    const tokenAgeDays = Math.floor(tokenAge / (1000 * 60 * 60 * 24));
    console.log(`\nToken Age: ${tokenAgeDays} days`);
    
    if (tokenAge > 30 * 24 * 60 * 60 * 1000) {
      console.log('⚠️ WARNING: Token has EXPIRED (older than 30 days)');
    } else {
      console.log('✅ Token is still valid');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkToken();
