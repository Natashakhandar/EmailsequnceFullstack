const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const latestEvents = await prisma.event.findMany({
    orderBy: { timestamp: 'desc' },
    take: 10,
    include: {
      contact: {
        select: {
          email: true,
          userId: true
        }
      }
    }
  });

  console.log('Latest 10 Events:');
  console.log(JSON.stringify(latestEvents, null, 2));

  const stats = await prisma.event.groupBy({
    by: ['type'],
    _count: {
      type: true
    }
  });
  console.log('\nEvent counts by type:');
  console.log(JSON.stringify(stats, null, 2));
  
  const contactsWithoutUserId = await prisma.contact.count({
    where: { userId: null }
  });
  console.log(`\nContacts without userId: ${contactsWithoutUserId}`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
