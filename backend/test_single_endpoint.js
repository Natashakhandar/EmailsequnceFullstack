const axios = require('axios');

async function testAnalyticsEndpoint() {
  try {
    console.log('🧪 Testing Reports Analytics Endpoint...');
    const response = await axios.get('http://localhost:3001/api/reports/analytics');
    
    console.log('✅ SUCCESS - Status:', response.status);
    console.log('\n📊 ANALYTICS RESPONSE DATA:');
    console.log(JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.log('❌ ERROR:', error.message);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', error.response.data);
    }
  }
}

async function testRealTimeStats() {
  try {
    console.log('\n🧪 Testing Real-time Stats Endpoint...');
    const response = await axios.get('http://localhost:3001/api/reports/real-time-stats');
    
    console.log('✅ SUCCESS - Status:', response.status);
    console.log('\n📊 REAL-TIME STATS RESPONSE DATA:');
    console.log(JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.log('❌ ERROR:', error.message);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', error.response.data);
    }
  }
}

async function runTests() {
  await testAnalyticsEndpoint();
  await testRealTimeStats();
}

runTests();
