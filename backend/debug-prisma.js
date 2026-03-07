const prisma = require('./src/db/prismaClient');

async function test() {
    try {
        console.log('Testing prisma.user.findFirst()...');
        const user = await prisma.user.findFirst();
        console.log('✅ Result:', user ? 'User found' : 'No users in table');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err);
        process.exit(1);
    }
}

test();
