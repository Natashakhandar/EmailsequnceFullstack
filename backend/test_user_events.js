const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    take: 5
  });
  console.log('Users in DB:');
  console.log(users.map(u => ({ id: u.id, email: u.email, role: u.role })));
  
  const user = users[0];
  if (!user) return console.log('No users found.');
  
  const eventsVisibleToUser = await prisma.event.findMany({
    where: {
      contact: {
        userId: user.id
      }
    },
    include: {
      contact: true
    }
  });

  console.log(`\nEvents visible to user ${user.email} (${user.id}):`);
  const counts = eventsVisibleToUser.reduce((acc, ev) => {
    acc[ev.type] = (acc[ev.type] || 0) + 1;
    return acc;
  }, {});
  console.log(counts);
}

main().finally(() => prisma.$disconnect());
