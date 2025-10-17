const axios = require('axios');

async function testScheduler() {
  console.log('🧪 Testing Scheduler Status...\n');

  try {
    // Test scheduler status
    console.log('1️⃣ Testing scheduler status...');
    const statusResponse = await axios.get('http://localhost:3001/api/scheduler/status');
    console.log('✅ Scheduler status:', statusResponse.data);

    // Test manual trigger
    console.log('\n2️⃣ Testing manual trigger...');
    const triggerResponse = await axios.post('http://localhost:3001/api/scheduler/trigger');
    console.log('✅ Manual trigger:', triggerResponse.data);

    // Test pending emails
    console.log('\n3️⃣ Testing pending emails count...');
    const pendingResponse = await axios.get('http://localhost:3001/api/scheduler/pending');
    console.log('✅ Pending emails:', pendingResponse.data);

    console.log('\n🎉 All scheduler tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

testScheduler();
