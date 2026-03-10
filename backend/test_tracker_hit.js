
const axios = require('axios');
const prisma = require('./src/db/prismaClient');

async function testTracking() {
  try {
    // 1. Find a recent SENT event
     const sent = await prisma.event.findFirst({
      where: { type: 'SENT' },
      orderBy: { timestamp: 'desc' }
    });
    
    if (!sent) {
      console.log('No SENT events found to test with.');
      process.exit();
    }
    
    console.log(`Testing with emailId: ${sent.emailId}`);
    
    // 2. Call the tracking endpoint locally
    const url = `http://localhost:3001/api/track/open?emailId=${encodeURIComponent(sent.emailId)}`;
    console.log(`Calling: ${url}`);
    
    const res = await axios.get(url);
    console.log(`Response Status: ${res.status}`);
    console.log(`Content-Type: ${res.headers['content-type']}`);
    
    // 3. Check if an OPENED event was created
    const opened = await prisma.event.findFirst({
      where: { 
        type: 'OPENED',
        emailId: sent.emailId
      },
      orderBy: { timestamp: 'desc' }
    });
    
    if (opened) {
      console.log('✅ OPENED event found in DB!');
      console.log(JSON.stringify(opened, null, 2));
    } else {
      console.log('❌ No OPENED event found in DB.');
    }
    
  } catch (err) {
    console.error('Test failed:', err.message);
  } finally {
    process.exit();
  }
}

testTracking();
