require('dotenv').config({ path: './backend/.env' });
const mysql = require('mysql2/promise');

async function testConnection() {
  console.log('--- LOCAL DB DIAGNOSTIC ---');
  console.log('Target URL:', process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/:.*@/, ':****@') : 'MISSING');
  
  try {
    const connection = await mysql.createConnection(process.env.DATABASE_URL);
    console.log('✅ SUCCESS: Local PC can connect to Hostinger DB!');
    await connection.end();
  } catch (err) {
    console.error('❌ FAILED:', err.message);
    if (err.message.includes('Access denied')) {
      console.log('HINT: Password is wrong or Remote MySQL is not enabled for your IP on Hostinger.');
    }
  }
}

testConnection();
