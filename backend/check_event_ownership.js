const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const openedEvents = await prisma.event.findMany({
    where: { type: 'OPENED' },
    include: {
      contact: true
    }
  });

  console.log('OPENED Events ownership:');
  openedEvents.forEach(e => {
    console.log(`Event ID: ${e.id}, contactId: ${e.contactId}, contactEmail: ${e.contact.email}, userId: ${e.contact.userId}`);
  });
  
  const repliedEvents = await prisma.event.findMany({
    where: { type: 'REPLIED' },
    include: {
      contact: true
    }
  });

  console.log('\nREPLIED Events ownership:');
  repliedEvents.forEach(e => {
    console.log(`Event ID: ${e.id}, contactId: ${e.contactId}, contactEmail: ${e.contact.email}, userId: ${e.contact.userId}`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
