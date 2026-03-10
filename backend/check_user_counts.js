
const prisma = require('./src/db/prismaClient');

async function check() {
  const users = await prisma.user.findMany({ select: { id: true, email: true } });
  
  for (const u of users) {
    const contactCount = await prisma.contact.count({ where: { userId: u.id } });
    const eventCount = await prisma.event.count({ where: { contact: { userId: u.id } } });
    console.log(`User: ${u.email}, Contacts: ${contactCount}, Events: ${eventCount}`);
  }
  
  process.exit();
}

check();
