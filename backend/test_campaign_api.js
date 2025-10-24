/**
 * Comprehensive Campaign API Test Suite
 * Tests all campaign management functionality including CRUD operations,
 * lead management, and campaign analytics.
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3001';
const API_BASE = `${BASE_URL}/api`;

// Test data storage
let testData = {
  authToken: null,
  campaignId: null,
  sequenceId: null,
  contactIds: [],
  testResults: []
};

/**
 * Utility function to make authenticated API requests
 */
async function apiRequest(method, endpoint, data = null, params = null) {
  try {
    const config = {
      method,
      url: `${API_BASE}${endpoint}`,
      headers: {
        'Authorization': testData.authToken ? `Bearer ${testData.authToken}` : '',
        'Content-Type': 'application/json'
      }
    };

    if (data) config.data = data;
    if (params) config.params = params;

    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status || 500
    };
  }
}

/**
 * Test helper to log results
 */
function logTest(testName, success, details = '') {
  const status = success ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} - ${testName}`);
  if (details) console.log(`   Details: ${details}`);
  
  testData.testResults.push({
    test: testName,
    success,
    details,
    timestamp: new Date().toISOString()
  });
}

/**
 * Test 1: Setup - Create test data (sequence and contacts)
 */
async function setupTestData() {
  console.log('\n🔧 Setting up test data...\n');

  try {
    // Create a test sequence
    const sequenceData = {
      name: 'Test Campaign Sequence',
      description: 'Test sequence for campaign API testing',
      steps: [
        {
          stepOrder: 1,
          subject: 'Welcome to our test campaign!',
          body: 'Hello {{firstName}}, this is a test email from our campaign.',
          delayDays: 0,
          delayHours: 0
        },
        {
          stepOrder: 2,
          subject: 'Follow-up from our test campaign',
          body: 'Hi {{firstName}}, just following up on our previous email.',
          delayDays: 1,
          delayHours: 0
        }
      ]
    };

    const sequenceResult = await apiRequest('POST', '/sequences', sequenceData);
    if (sequenceResult.success) {
      testData.sequenceId = sequenceResult.data.sequence.id;
      logTest('Create test sequence', true, `Sequence ID: ${testData.sequenceId}`);
    } else {
      logTest('Create test sequence', false, sequenceResult.error);
      return false;
    }

    // Create test contacts
    const contacts = [
      {
        email: 'test1@example.com',
        firstName: 'John',
        lastName: 'Doe',
        company: 'Test Company 1'
      },
      {
        email: 'test2@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        company: 'Test Company 2'
      },
      {
        email: 'test3@example.com',
        firstName: 'Bob',
        lastName: 'Johnson',
        company: 'Test Company 3'
      }
    ];

    for (const contact of contacts) {
      const contactResult = await apiRequest('POST', '/contacts', contact);
      if (contactResult.success) {
        testData.contactIds.push(contactResult.data.contact.id);
      }
    }

    logTest('Create test contacts', testData.contactIds.length === 3, 
      `Created ${testData.contactIds.length} contacts`);

    return testData.contactIds.length === 3;

  } catch (error) {
    logTest('Setup test data', false, error.message);
    return false;
  }
}

/**
 * Test 2: Create Campaign
 */
async function testCreateCampaign() {
  console.log('\n📊 Testing Campaign Creation...\n');

  const campaignData = {
    campaign_name: 'Test Marketing Campaign',
    description: 'This is a test campaign for API testing',
    sequence_id: testData.sequenceId,
    start_date: new Date().toISOString(),
    end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
    lead_ids: testData.contactIds
  };

  const result = await apiRequest('POST', '/campaigns', campaignData);

  if (result.success) {
    testData.campaignId = result.data.campaign.id;
    logTest('Create campaign', true, 
      `Campaign ID: ${testData.campaignId}, Leads: ${result.data.campaign.leads?.length || 0}`);
    
    // Verify campaign structure
    const campaign = result.data.campaign;
    const hasRequiredFields = campaign.id && campaign.campaignName && campaign.sequence && campaign.stats;
    logTest('Campaign has required fields', hasRequiredFields, 
      `Fields: ${Object.keys(campaign).join(', ')}`);
    
    return true;
  } else {
    logTest('Create campaign', false, result.error);
    return false;
  }
}

/**
 * Test 3: Fetch All Campaigns
 */
async function testFetchCampaigns() {
  console.log('\n📋 Testing Fetch All Campaigns...\n');

  const result = await apiRequest('GET', '/campaigns');

  if (result.success) {
    const campaigns = result.data.campaigns;
    const hasCampaigns = Array.isArray(campaigns) && campaigns.length > 0;
    logTest('Fetch campaigns', hasCampaigns, 
      `Found ${campaigns.length} campaigns`);

    // Check pagination
    const hasPagination = result.data.pagination && 
      typeof result.data.pagination.total === 'number';
    logTest('Campaign pagination', hasPagination, 
      `Total: ${result.data.pagination?.total || 0}`);

    // Check if our test campaign is in the list
    const ourCampaign = campaigns.find(c => c.id === testData.campaignId);
    logTest('Test campaign in list', !!ourCampaign, 
      ourCampaign ? `Found: ${ourCampaign.campaignName}` : 'Not found');

    return hasCampaigns;
  } else {
    logTest('Fetch campaigns', false, result.error);
    return false;
  }
}

/**
 * Test 4: Fetch Specific Campaign
 */
async function testFetchSpecificCampaign() {
  console.log('\n🔍 Testing Fetch Specific Campaign...\n');

  const result = await apiRequest('GET', `/campaigns/${testData.campaignId}`);

  if (result.success) {
    const campaign = result.data.campaign;
    
    // Check required fields
    const hasBasicFields = campaign.id && campaign.campaignName && 
      campaign.sequence && campaign.leads && campaign.stats;
    logTest('Campaign basic fields', hasBasicFields, 
      `ID: ${campaign.id}, Name: ${campaign.campaignName}`);

    // Check stats structure
    const hasStats = campaign.stats && campaign.stats.emails && 
      campaign.stats.rates && campaign.stats.enrollments;
    logTest('Campaign stats structure', hasStats, 
      `Emails sent: ${campaign.stats?.emails?.sent || 0}`);

    // Check leads
    const hasLeads = Array.isArray(campaign.leads) && campaign.leads.length > 0;
    logTest('Campaign has leads', hasLeads, 
      `Leads count: ${campaign.leads?.length || 0}`);

    return hasBasicFields && hasStats;
  } else {
    logTest('Fetch specific campaign', false, result.error);
    return false;
  }
}

/**
 * Test 5: Update Campaign
 */
async function testUpdateCampaign() {
  console.log('\n✏️ Testing Campaign Update...\n');

  const updateData = {
    campaign_name: 'Updated Test Marketing Campaign',
    description: 'Updated description for testing',
    add_lead_ids: [], // No new leads to add
    remove_lead_ids: [testData.contactIds[0]] // Remove first contact
  };

  const result = await apiRequest('PATCH', `/campaigns/${testData.campaignId}`, updateData);

  if (result.success) {
    const campaign = result.data.campaign;
    
    // Check if name was updated
    const nameUpdated = campaign.campaignName === updateData.campaign_name;
    logTest('Campaign name updated', nameUpdated, 
      `New name: ${campaign.campaignName}`);

    // Check if lead was removed
    const expectedLeadCount = testData.contactIds.length - 1;
    const leadRemoved = campaign.leads.length === expectedLeadCount;
    logTest('Lead removed from campaign', leadRemoved, 
      `Leads count: ${campaign.leads.length}, Expected: ${expectedLeadCount}`);

    return nameUpdated && leadRemoved;
  } else {
    logTest('Update campaign', false, result.error);
    return false;
  }
}

/**
 * Test 6: Campaign Analytics
 */
async function testCampaignAnalytics() {
  console.log('\n📈 Testing Campaign Analytics...\n');

  // Test general analytics with campaign filter
  const analyticsResult = await apiRequest('GET', '/reports/analytics', null, {
    campaignId: testData.campaignId
  });

  if (analyticsResult.success) {
    const analytics = analyticsResult.data;
    
    const hasMetrics = analytics.totalCampaigns !== undefined && 
      analytics.totalLeads !== undefined && 
      analytics.avgResponseRate !== undefined;
    logTest('General analytics with campaign filter', hasMetrics, 
      `Campaigns: ${analytics.totalCampaigns}, Leads: ${analytics.totalLeads}`);
  } else {
    logTest('General analytics with campaign filter', false, analyticsResult.error);
  }

  // Test campaign-specific analytics
  const campaignAnalyticsResult = await apiRequest('GET', '/reports/campaign-analytics');

  if (campaignAnalyticsResult.success) {
    const data = campaignAnalyticsResult.data;
    
    const hasStructure = data.campaigns && data.summary && data.pieChartData;
    logTest('Campaign analytics structure', hasStructure, 
      `Campaigns: ${data.campaigns?.length || 0}`);

    // Check if our campaign is included
    const ourCampaign = data.campaigns?.find(c => c.id === testData.campaignId);
    logTest('Test campaign in analytics', !!ourCampaign, 
      ourCampaign ? `Found: ${ourCampaign.name}` : 'Not found');

    // Check pie chart data format
    const hasPieChart = Array.isArray(data.pieChartData) && 
      data.pieChartData.every(item => item.name && item.value !== undefined);
    logTest('Pie chart data format', hasPieChart, 
      `Chart items: ${data.pieChartData?.length || 0}`);

    return hasStructure && hasPieChart;
  } else {
    logTest('Campaign analytics', false, campaignAnalyticsResult.error);
    return false;
  }
}

/**
 * Test 7: Delete Campaign
 */
async function testDeleteCampaign() {
  console.log('\n🗑️ Testing Campaign Deletion...\n');

  const result = await apiRequest('DELETE', `/campaigns/${testData.campaignId}`);

  if (result.success) {
    const deletedInfo = result.data.deletedCampaign;
    
    logTest('Delete campaign', true, 
      `Deleted: ${deletedInfo.campaignName}, Affected leads: ${deletedInfo.leadsAffected}`);

    // Verify campaign is actually deleted
    const fetchResult = await apiRequest('GET', `/campaigns/${testData.campaignId}`);
    const isDeleted = !fetchResult.success && fetchResult.status === 404;
    logTest('Campaign actually deleted', isDeleted, 
      isDeleted ? 'Campaign not found (expected)' : 'Campaign still exists');

    return isDeleted;
  } else {
    logTest('Delete campaign', false, result.error);
    return false;
  }
}

/**
 * Test 8: Error Handling
 */
async function testErrorHandling() {
  console.log('\n⚠️ Testing Error Handling...\n');

  // Test creating campaign with invalid sequence
  const invalidCampaign = {
    campaign_name: 'Invalid Campaign',
    sequence_id: 'invalid-sequence-id',
    lead_ids: []
  };

  const result1 = await apiRequest('POST', '/campaigns', invalidCampaign);
  const handlesInvalidSequence = !result1.success && result1.status === 404;
  logTest('Invalid sequence ID error', handlesInvalidSequence, 
    result1.error?.error || 'No error message');

  // Test fetching non-existent campaign
  const result2 = await apiRequest('GET', '/campaigns/non-existent-id');
  const handlesNotFound = !result2.success && result2.status === 404;
  logTest('Non-existent campaign error', handlesNotFound, 
    result2.error?.error || 'No error message');

  // Test creating campaign with invalid contact IDs
  const invalidContacts = {
    campaign_name: 'Invalid Contacts Campaign',
    sequence_id: testData.sequenceId,
    lead_ids: ['invalid-contact-1', 'invalid-contact-2']
  };

  const result3 = await apiRequest('POST', '/campaigns', invalidContacts);
  const handlesInvalidContacts = !result3.success && result3.status === 400;
  logTest('Invalid contact IDs error', handlesInvalidContacts, 
    result3.error?.error || 'No error message');

  return handlesInvalidSequence && handlesNotFound && handlesInvalidContacts;
}

/**
 * Cleanup test data
 */
async function cleanup() {
  console.log('\n🧹 Cleaning up test data...\n');

  // Delete test contacts
  for (const contactId of testData.contactIds) {
    await apiRequest('DELETE', `/contacts/${contactId}`);
  }

  // Delete test sequence
  if (testData.sequenceId) {
    await apiRequest('DELETE', `/sequences/${testData.sequenceId}`);
  }

  logTest('Cleanup completed', true, 
    `Cleaned up ${testData.contactIds.length} contacts and 1 sequence`);
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('🚀 Starting Campaign API Test Suite');
  console.log('=====================================\n');

  const startTime = Date.now();

  try {
    // Setup
    const setupSuccess = await setupTestData();
    if (!setupSuccess) {
      console.log('❌ Setup failed. Aborting tests.');
      return;
    }

    // Run all tests
    const tests = [
      testCreateCampaign,
      testFetchCampaigns,
      testFetchSpecificCampaign,
      testUpdateCampaign,
      testCampaignAnalytics,
      testDeleteCampaign,
      testErrorHandling
    ];

    for (const test of tests) {
      await test();
      await new Promise(resolve => setTimeout(resolve, 500)); // Small delay between tests
    }

  } catch (error) {
    console.error('❌ Test suite error:', error.message);
  } finally {
    await cleanup();
  }

  // Summary
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  const passed = testData.testResults.filter(r => r.success).length;
  const total = testData.testResults.length;

  console.log('\n📊 Test Summary');
  console.log('================');
  console.log(`Total Tests: ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${total - passed}`);
  console.log(`Duration: ${duration}s`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

  if (passed === total) {
    console.log('\n🎉 All tests passed! Campaign API is working correctly.');
  } else {
    console.log('\n⚠️ Some tests failed. Please check the details above.');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  runTests,
  apiRequest,
  testData
};
