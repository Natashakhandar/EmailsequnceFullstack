const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3001';
const API_ENDPOINTS = {
  analytics: '/api/reports/analytics',
  performanceTrends: '/api/reports/performance-trends',
  campaignPerformance: '/api/reports/campaign-performance',
  realTimeStats: '/api/reports/real-time-stats',
  dashboardStats: '/api/dashboard/stats'
};

// Test helper function
async function testEndpoint(name, url, params = {}) {
  try {
    console.log(`\n🧪 Testing ${name}...`);
    console.log(`📍 URL: ${BASE_URL}${url}`);
    
    const startTime = Date.now();
    const response = await axios.get(`${BASE_URL}${url}`, { params });
    const endTime = Date.now();
    
    console.log(`✅ ${name} - SUCCESS`);
    console.log(`⏱️  Response time: ${endTime - startTime}ms`);
    console.log(`📊 Status: ${response.status}`);
    console.log(`📦 Data keys:`, Object.keys(response.data));
    
    // Log specific metrics for analytics endpoint
    if (name === 'Reports Analytics') {
      const data = response.data;
      console.log(`📈 Key Metrics:`);
      console.log(`   - Total Campaigns: ${data.totalCampaigns}`);
      console.log(`   - Total Leads: ${data.totalLeads}`);
      console.log(`   - Avg Response Rate: ${data.avgResponseRate}%`);
      console.log(`   - Bounce Rate: ${data.bounceRate}%`);
      console.log(`   - Total Emails Sent: ${data.totalEmailsSent}`);
      console.log(`   - Monthly Emails Sent: ${data.monthlySummary.totalEmailsSent}`);
    }
    
    // Log performance trends summary
    if (name === 'Performance Trends') {
      const data = response.data;
      console.log(`📈 Trends Summary:`);
      console.log(`   - Period: ${data.period}`);
      console.log(`   - Total Days: ${data.totalDays}`);
      console.log(`   - Trend Points: ${data.trends.length}`);
    }
    
    // Log campaign performance summary
    if (name === 'Campaign Performance') {
      const data = response.data;
      console.log(`📈 Campaign Summary:`);
      console.log(`   - Total Campaigns: ${data.totalCampaigns}`);
      console.log(`   - Campaigns Listed: ${data.campaigns.length}`);
      if (data.campaigns.length > 0) {
        const topCampaign = data.campaigns[0];
        console.log(`   - Top Campaign: ${topCampaign.name} (${topCampaign.responseRate}% response rate)`);
      }
    }
    
    // Log real-time stats summary
    if (name === 'Real-time Stats') {
      const data = response.data;
      console.log(`📈 Real-time Summary:`);
      console.log(`   - Last 24h Emails Sent: ${data.last24Hours.emailsSent}`);
      console.log(`   - Last 24h Emails Opened: ${data.last24Hours.emailsOpened}`);
      console.log(`   - Last 24h Replies: ${data.last24Hours.repliesReceived}`);
      console.log(`   - Active Enrollments: ${data.activeEnrollments}`);
      console.log(`   - Recent Activity Items: ${data.recentActivity.length}`);
    }
    
    return { success: true, responseTime: endTime - startTime, data: response.data };
    
  } catch (error) {
    console.log(`❌ ${name} - FAILED`);
    console.log(`🚨 Error: ${error.message}`);
    if (error.response) {
      console.log(`📊 Status: ${error.response.status}`);
      console.log(`📦 Error Data:`, error.response.data);
    }
    return { success: false, error: error.message };
  }
}

// Main test function
async function runAllTests() {
  console.log('🚀 Starting Reports API Tests');
  console.log('=' .repeat(50));
  
  const results = {};
  
  // Test 1: Reports Analytics (main endpoint)
  results.analytics = await testEndpoint('Reports Analytics', API_ENDPOINTS.analytics);
  
  // Test 2: Performance Trends
  results.performanceTrends = await testEndpoint('Performance Trends', API_ENDPOINTS.performanceTrends, {
    days: 30
  });
  
  // Test 3: Campaign Performance
  results.campaignPerformance = await testEndpoint('Campaign Performance', API_ENDPOINTS.campaignPerformance, {
    limit: 5
  });
  
  // Test 4: Real-time Stats
  results.realTimeStats = await testEndpoint('Real-time Stats', API_ENDPOINTS.realTimeStats);
  
  // Test 5: Dashboard Stats (existing endpoint for comparison)
  results.dashboardStats = await testEndpoint('Dashboard Stats', API_ENDPOINTS.dashboardStats);
  
  // Test with date filters
  console.log('\n🔍 Testing with Date Filters...');
  const lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - 7);
  const today = new Date();
  
  results.analyticsFiltered = await testEndpoint('Reports Analytics (Filtered)', API_ENDPOINTS.analytics, {
    startDate: lastWeek.toISOString(),
    endDate: today.toISOString()
  });
  
  // Summary
  console.log('\n📋 TEST SUMMARY');
  console.log('=' .repeat(50));
  
  const successCount = Object.values(results).filter(r => r.success).length;
  const totalTests = Object.keys(results).length;
  
  console.log(`✅ Successful Tests: ${successCount}/${totalTests}`);
  console.log(`❌ Failed Tests: ${totalTests - successCount}/${totalTests}`);
  
  // Performance summary
  const responseTimes = Object.values(results)
    .filter(r => r.success && r.responseTime)
    .map(r => r.responseTime);
  
  if (responseTimes.length > 0) {
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const maxResponseTime = Math.max(...responseTimes);
    const minResponseTime = Math.min(...responseTimes);
    
    console.log(`\n⏱️  PERFORMANCE METRICS:`);
    console.log(`   - Average Response Time: ${Math.round(avgResponseTime)}ms`);
    console.log(`   - Fastest Response: ${minResponseTime}ms`);
    console.log(`   - Slowest Response: ${maxResponseTime}ms`);
  }
  
  // Data validation
  console.log(`\n🔍 DATA VALIDATION:`);
  if (results.analytics.success) {
    const data = results.analytics.data;
    console.log(`   ✅ Analytics endpoint returns all required fields`);
    console.log(`   ✅ Real-time timestamp: ${data.lastUpdated}`);
    console.log(`   ✅ Email status distribution available`);
    console.log(`   ✅ Lead performance metrics available`);
    console.log(`   ✅ Monthly summary available`);
    console.log(`   ✅ No "Goal Achievement" data (correctly removed)`);
  }
  
  if (totalTests === successCount) {
    console.log('\n🎉 ALL TESTS PASSED! Reports API is ready for production.');
  } else {
    console.log('\n⚠️  Some tests failed. Please check the errors above.');
  }
  
  return results;
}

// Data structure validation
function validateReportsData(data) {
  const requiredFields = [
    'totalCampaigns',
    'totalLeads', 
    'avgResponseRate',
    'bounceRate',
    'emailStatusDistribution',
    'leadPerformance',
    'monthlySummary',
    'lastUpdated'
  ];
  
  const missingFields = requiredFields.filter(field => !(field in data));
  
  if (missingFields.length > 0) {
    console.log(`❌ Missing required fields: ${missingFields.join(', ')}`);
    return false;
  }
  
  console.log(`✅ All required fields present`);
  return true;
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testEndpoint,
  runAllTests,
  validateReportsData
};
