const prisma = require('./src/db/prismaClient');

async function checkUser() {
    try {
        const email = 'natashakhandr05@gmail.com';
        console.log(`Checking for user: ${email}`);
        const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase() }
        });
        if (user) {
            console.log('✅ User found:', { id: user.id, email: user.email, role: user.role, isActive: user.isActive });
        } else {
            console.log('❌ User not found');
        }
        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err);
        process.exit(1);
    }
}

checkUser();
