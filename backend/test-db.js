const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testConnection() {
  try {
    console.log('Testing PostgreSQL connection...');
    await prisma.$connect();
    console.log('✅ Successfully connected to PostgreSQL!');
    
    // Test query
    const result = await prisma.$queryRaw`SELECT version()`;
    console.log('📊 PostgreSQL version:', result[0].version);
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.log('\n🔧 Make sure:');
    console.log('1. PostgreSQL is running');
    console.log('2. Database "mail_sequencing" exists');
    console.log('3. User "mail_user" has correct permissions');
    console.log('4. DATABASE_URL in .env is correct');
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
