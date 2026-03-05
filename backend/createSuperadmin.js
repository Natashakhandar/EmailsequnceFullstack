require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    const email = process.env.SUPERADMIN_EMAIL;
    const password = process.env.SUPERADMIN_PASSWORD;

    if (!email || !password) {
        console.error('❌ SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD must be set in .env');
        process.exit(1);
    }

    const existingUser = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
    });

    if (existingUser) {
        if (existingUser.role !== 'SUPERADMIN') {
            await prisma.user.update({
                where: { email: email.toLowerCase() },
                data: { role: 'SUPERADMIN' }
            });
            console.log('✅ User upgraded to SUPERADMIN:', email);
        } else {
            console.log('ℹ️  Superadmin already exists:', email);
        }
        return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
        data: {
            email: email.toLowerCase(),
            password: hashedPassword,
            firstName: 'Super',
            lastName: 'Admin',
            role: 'SUPERADMIN',
        },
    });

    console.log('✅ Superadmin created successfully!');
    console.log('   Email:', user.email);
}

main()
    .catch((e) => {
        console.error('❌ Error:', e.message);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
