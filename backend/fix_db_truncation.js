const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Altering events table...');
        await prisma.$executeRawUnsafe('ALTER TABLE events MODIFY details MEDIUMTEXT');
        console.log('Altering enrollments table (if needed)...');
        // Ensure enrollment details are also TEXT
        // await prisma.$executeRawUnsafe('ALTER TABLE enrollments MODIFY status VARCHAR(50)'); 
        console.log('Table altered successfully');
    } catch (err) {
        console.error('Error altering table:', err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
