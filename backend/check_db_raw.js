const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const rawEvents = await prisma.$queryRaw`SELECT DISTINCT type FROM Event`;
  console.log('Unique raw types in Event table:');
  console.log(rawEvents);
  
  const sampleOpened = await prisma.$queryRaw`SELECT * FROM Event WHERE type = 'OPENED' LIMIT 1`;
  console.log('\nSample OPENED event:');
  console.log(sampleOpened);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
