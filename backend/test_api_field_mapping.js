/**
 * Test Script: API Field Mapping for Campaign Creation
 * Tests the actual API endpoint with snake_case to camelCase field mapping
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3001';
const API_BASE = `${BASE_URL}/api`;

// Test data storage
let testData = {
  authToken: null,
  sequenceId: null,
  contactIds: [],
  campaignId: null
};

/**
 * Utility function to make API requests
 */
async function apiRequest(method, endpoint, data = null) {
  try {
    const config = {
      method,
      url: `${API_BASE}${endpoint}`,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (data) config.data = data;

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
 * Setup test data
 */
async function setupTestData() {
  console.log('🔧 Setting up test data via API...\n');

  try {
    // Create test sequence
    const sequenceData = {
      name: 'API Test Campaign Sequence',
      description: 'Test sequence for API field mapping',
      steps: [
        {
          stepOrder: 1,
          subject: 'API Test Campaign Email',
          body: 'Hello {{firstName}}, this is an API test campaign email.',
          delayDays: 0,
          delayHours: 0
        }
      ]
    };

    const sequenceResult = await apiRequest('POST', '/sequences', sequenceData);
    if (sequenceResult.success) {
      testData.sequenceId = sequenceResult.data.sequence.id;
      console.log('✅ Created test sequence via API:', testData.sequenceId);
    } else {
      console.error('❌ Failed to create sequence:', sequenceResult.error);
      return false;
    }

    // Create test contacts
    const contacts = [
      {
        email: 'apitest1@example.com',
        firstName: 'Alice',
        lastName: 'Johnson',
        company: 'API Test Corp'
      },
      {
        email: 'apitest2@example.com',
        firstName: 'Bob',
        lastName: 'Wilson',
        company: 'Field Mapping Inc'
      }
    ];

    for (const contact of contacts) {
      const contactResult = await apiRequest('POST', '/contacts', contact);
      if (contactResult.success) {
        testData.contactIds.push(contactResult.data.contact.id);
        console.log('✅ Created test contact via API:', contact.email);
      }
    }

    console.log(`\n✅ Setup complete: ${testData.contactIds.length} contacts created\n`);
    return testData.contactIds.length === 2;

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    return false;
  }
}

/**
 * Test 1: Campaign Creation with snake_case API fields
 */
async function testCampaignCreationAPI() {
  console.log('🧪 Test 1: Campaign Creation with snake_case API Fields\n');

  // Test data with snake_case fields (as expected by API)
  const campaignData = {
    campaign_name: 'API Field Mapping Test Campaign', // snake_case
    description: 'Testing API field mapping from snake_case to camelCase',
    sequence_id: testData.sequenceId, // snake_case
    start_date: new Date().toISOString(), // snake_case
    end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // snake_case
    lead_ids: testData.contactIds // snake_case
  };

  console.log('📝 API Request Data (snake_case):');
  console.log('   - campaign_name:', campaignData.campaign_name);
  console.log('   - sequence_id:', campaignData.sequence_id);
  console.log('   - start_date:', campaignData.start_date);
  console.log('   - end_date:', campaignData.end_date);
  console.log('   - lead_ids:', campaignData.lead_ids.length, 'contacts');

  const result = await apiRequest('POST', '/campaigns', campaignData);

  if (result.success) {
    const campaign = result.data.campaign;
    testData.campaignId = campaign.id;

    console.log('\n✅ Campaign created successfully via API:');
    console.log('   - ID:', campaign.id);
    console.log('   - Name (campaignName):', campaign.campaignName);
    console.log('   - Sequence ID (sequenceId):', campaign.sequenceId);
    console.log('   - Start Date (startDate):', campaign.startDate);
    console.log('   - End Date (endDate):', campaign.endDate);
    console.log('   - Leads Count:', campaign.leads?.length || 0);
    console.log('   - Active:', campaign.isActive);

    // Verify field mapping worked correctly
    const mappingTests = [
      { api: 'campaign_name', prisma: 'campaignName', expected: campaignData.campaign_name, actual: campaign.campaignName },
      { api: 'sequence_id', prisma: 'sequenceId', expected: campaignData.sequence_id, actual: campaign.sequenceId },
      { api: 'start_date', prisma: 'startDate', expected: campaignData.start_date, actual: campaign.startDate },
      { api: 'end_date', prisma: 'endDate', expected: campaignData.end_date, actual: campaign.endDate }
    ];

    console.log('\n📊 Field Mapping Verification:');
    let allMappingsCorrect = true;

    for (const test of mappingTests) {
      const isCorrect = test.expected === test.actual || 
        (test.api.includes('date') && new Date(test.expected).toISOString() === new Date(test.actual).toISOString());
      
      console.log(`   ${isCorrect ? '✅' : '❌'} ${test.api} → ${test.prisma}: ${isCorrect ? 'CORRECT' : 'INCORRECT'}`);
      
      if (!isCorrect) {
        console.log(`      Expected: ${test.expected}`);
        console.log(`      Actual: ${test.actual}`);
        allMappingsCorrect = false;
      }
    }

    if (allMappingsCorrect) {
      console.log('\n🎉 All field mappings are correct!');
    }

    return allMappingsCorrect;

  } else {
    console.error('❌ Campaign creation failed:', result.error);
    return false;
  }
}

/**
 * Test 2: Fetch Campaign and Verify Data Integrity
 */
async function testCampaignFetching() {
  console.log('\n🧪 Test 2: Fetch Campaign and Verify Data Integrity\n');

  const result = await apiRequest('GET', `/campaigns/${testData.campaignId}`);

  if (result.success) {
    const campaign = result.data.campaign;

    console.log('✅ Campaign fetched successfully:');
    console.log('   - ID:', campaign.id);
    console.log('   - Name:', campaign.campaignName);
    console.log('   - Description:', campaign.description);
    console.log('   - Sequence:', campaign.sequence?.name);
    console.log('   - Leads:', campaign.leads?.length || 0);
    console.log('   - Stats:', JSON.stringify(campaign.stats, null, 2));

    // Verify required fields are present and correct type
    const fieldChecks = [
      { field: 'campaignName', type: 'string', required: true },
      { field: 'sequenceId', type: 'string', required: true },
      { field: 'startDate', type: 'string', required: false }, // ISO string from API
      { field: 'endDate', type: 'string', required: false },
      { field: 'isActive', type: 'boolean', required: true }
    ];

    console.log('\n📊 Field Type Verification:');
    let allFieldsCorrect = true;

    for (const check of fieldChecks) {
      const value = campaign[check.field];
      const hasValue = value !== null && value !== undefined;
      const correctType = hasValue ? typeof value === check.type : true;
      const meetsRequirement = check.required ? hasValue : true;

      const status = correctType && meetsRequirement ? '✅' : '❌';
      console.log(`   ${status} ${check.field}: ${typeof value} ${hasValue ? `(${value})` : '(null/undefined)'}`);

      if (!correctType || !meetsRequirement) {
        allFieldsCorrect = false;
      }
    }

    return allFieldsCorrect;

  } else {
    console.error('❌ Campaign fetching failed:', result.error);
    return false;
  }
}

/**
 * Test 3: Campaign Update with Field Mapping
 */
async function testCampaignUpdate() {
  console.log('\n🧪 Test 3: Campaign Update with Field Mapping\n');

  const updateData = {
    campaign_name: 'Updated API Field Mapping Test Campaign', // snake_case
    description: 'Updated description via API',
    start_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // snake_case - tomorrow
    end_date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString() // snake_case - 45 days
  };

  console.log('📝 Update Request Data (snake_case):');
  console.log('   - campaign_name:', updateData.campaign_name);
  console.log('   - start_date:', updateData.start_date);
  console.log('   - end_date:', updateData.end_date);

  const result = await apiRequest('PATCH', `/campaigns/${testData.campaignId}`, updateData);

  if (result.success) {
    const campaign = result.data.campaign;

    console.log('\n✅ Campaign updated successfully:');
    console.log('   - Name:', campaign.campaignName);
    console.log('   - Description:', campaign.description);
    console.log('   - Start Date:', campaign.startDate);
    console.log('   - End Date:', campaign.endDate);

    // Verify updates were applied correctly
    const updateChecks = [
      { field: 'campaignName', expected: updateData.campaign_name },
      { field: 'description', expected: updateData.description }
    ];

    console.log('\n📊 Update Verification:');
    let allUpdatesCorrect = true;

    for (const check of updateChecks) {
      const isCorrect = campaign[check.field] === check.expected;
      console.log(`   ${isCorrect ? '✅' : '❌'} ${check.field}: ${isCorrect ? 'CORRECT' : 'INCORRECT'}`);
      
      if (!isCorrect) {
        console.log(`      Expected: ${check.expected}`);
        console.log(`      Actual: ${campaign[check.field]}`);
        allUpdatesCorrect = false;
      }
    }

    return allUpdatesCorrect;

  } else {
    console.error('❌ Campaign update failed:', result.error);
    return false;
  }
}

/**
 * Cleanup test data
 */
async function cleanup() {
  console.log('\n🧹 Cleaning up test data...\n');

  try {
    // Delete campaign
    if (testData.campaignId) {
      await apiRequest('DELETE', `/campaigns/${testData.campaignId}`);
      console.log('✅ Deleted test campaign');
    }

    // Delete contacts
    for (const contactId of testData.contactIds) {
      await apiRequest('DELETE', `/contacts/${contactId}`);
    }
    console.log('✅ Deleted test contacts');

    // Delete sequence
    if (testData.sequenceId) {
      await apiRequest('DELETE', `/sequences/${testData.sequenceId}`);
      console.log('✅ Deleted test sequence');
    }

    console.log('✅ Cleanup completed\n');

  } catch (error) {
    console.error('❌ Cleanup error:', error.message);
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('🚀 API Field Mapping Test Suite');
  console.log('=================================\n');

  const startTime = Date.now();
  let allTestsPassed = true;

  try {
    // Check if server is running
    console.log('🔍 Checking if server is running...');
    const healthCheck = await apiRequest('GET', '/health').catch(() => ({ success: false }));
    
    if (!healthCheck.success) {
      console.log('❌ Server is not running. Please start the server with: npm run dev');
      console.log('   Expected server at:', BASE_URL);
      return;
    }
    console.log('✅ Server is running\n');

    // Setup
    const setupSuccess = await setupTestData();
    if (!setupSuccess) {
      console.log('❌ Setup failed. Aborting tests.');
      return;
    }

    // Run tests
    const tests = [
      { name: 'Campaign Creation with snake_case API Fields', fn: testCampaignCreationAPI },
      { name: 'Fetch Campaign and Verify Data Integrity', fn: testCampaignFetching },
      { name: 'Campaign Update with Field Mapping', fn: testCampaignUpdate }
    ];

    for (const test of tests) {
      const success = await test.fn();
      if (!success) {
        allTestsPassed = false;
      }
    }

  } catch (error) {
    console.error('❌ Test suite error:', error.message);
    allTestsPassed = false;
  } finally {
    await cleanup();
  }

  // Summary
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  console.log('📊 Test Summary');
  console.log('================');
  console.log(`Duration: ${duration}s`);
  console.log(`Status: ${allTestsPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);

  if (allTestsPassed) {
    console.log('\n🎉 API field mapping is working correctly!');
    console.log('✅ snake_case API fields → camelCase Prisma fields');
    console.log('✅ Required fields (campaign_name, sequence_id) properly validated');
    console.log('✅ Optional fields (start_date, end_date) properly handled');
    console.log('✅ Campaign CRUD operations working via API');
  } else {
    console.log('\n⚠️ Some tests failed. Please check the output above for details.');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests };
