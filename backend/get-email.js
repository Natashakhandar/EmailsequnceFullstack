const prisma = require('./src/db/prismaClient');

async function test() {
    const user = await prisma.user.findFirst();
    console.log('Valid email:', user.email);
    process.exit(0);
}

test();
