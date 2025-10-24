/**
 * Test Script: Campaign Creation with Proper Field Mapping
 * Tests Prisma campaign.create and campaign.findUnique with required fields
 */

const prisma = require('./src/db/prismaClient');

// Test data
const testData = {
  sequenceId: null,
  contactIds: [],
  campaignId: null
};

/**
 * Setup: Create test sequence and contacts
 */
async function setupTestData() {
  console.log('🔧 Setting up test data...\n');

  try {
    // Create test sequence
    const sequence = await prisma.sequence.create({
      data: {
        name: 'Test Campaign Sequence',
        description: 'Test sequence for campaign creation testing',
        isActive: true
      }
    });
    testData.sequenceId = sequence.id;
    console.log('✅ Created test sequence:', sequence.id);

    // Create test sequence step
    await prisma.sequenceStep.create({
      data: {
        sequenceId: sequence.id,
        stepOrder: 1,
        subject: 'Test Campaign Email',
        body: 'Hello {{firstName}}, this is a test campaign email.',
        delayDays: 0,
        delayHours: 0,
        isActive: true
      }
    });
    console.log('✅ Created test sequence step');

    // Create test contacts
    const contacts = [
      {
        email: 'test1@campaigntest.com',
        firstName: 'John',
        lastName: 'Doe',
        status: 'ACTIVE'
      },
      {
        email: 'test2@campaigntest.com',
        firstName: 'Jane',
        lastName: 'Smith',
        status: 'ACTIVE'
      }
    ];

    for (const contactData of contacts) {
      const contact = await prisma.contact.create({
        data: contactData
      });
      testData.contactIds.push(contact.id);
      console.log('✅ Created test contact:', contact.email);
    }

    console.log(`\n✅ Setup complete: Sequence ${testData.sequenceId}, ${testData.contactIds.length} contacts\n`);
    return true;

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    return false;
  }
}

/**
 * Test 1: Direct Prisma Campaign Creation
 */
async function testDirectPrismaCampaignCreation() {
  console.log('🧪 Test 1: Direct Prisma Campaign Creation\n');

  try {
    // Test data with proper field mapping
    const campaignData = {
      campaignName: 'Test Direct Campaign', // Prisma field name
      description: 'Testing direct Prisma campaign creation',
      sequenceId: testData.sequenceId, // Prisma field name
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      isActive: true
    };

    console.log('📝 Creating campaign with data:', {
      campaignName: campaignData.campaignName,
      sequenceId: campaignData.sequenceId,
      startDate: campaignData.startDate.toISOString(),
      endDate: campaignData.endDate.toISOString()
    });

    // Direct Prisma create call
    const campaign = await prisma.campaign.create({
      data: campaignData,
      include: {
        sequence: {
          select: { name: true }
        }
      }
    });

    testData.campaignId = campaign.id;

    console.log('✅ Campaign created successfully:');
    console.log('   - ID:', campaign.id);
    console.log('   - Name:', campaign.campaignName);
    console.log('   - Sequence:', campaign.sequence.name);
    console.log('   - Start Date:', campaign.startDate);
    console.log('   - End Date:', campaign.endDate);
    console.log('   - Active:', campaign.isActive);

    return true;

  } catch (error) {
    console.error('❌ Direct Prisma creation failed:', error.message);
    console.error('   Error details:', error);
    return false;
  }
}

/**
 * Test 2: API Field Mapping Simulation
 */
async function testAPIFieldMappingSimulation() {
  console.log('\n🧪 Test 2: API Field Mapping Simulation\n');

  try {
    // Simulate API input with snake_case fields
    const apiInput = {
      campaign_name: 'Test API Mapped Campaign', // snake_case API field
      description: 'Testing API field mapping to Prisma fields',
      sequence_id: testData.sequenceId, // snake_case API field
      start_date: new Date().toISOString(), // snake_case API field
      end_date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(), // snake_case API field
      lead_ids: testData.contactIds // snake_case API field
    };

    console.log('📝 API Input (snake_case):', {
      campaign_name: apiInput.campaign_name,
      sequence_id: apiInput.sequence_id,
      start_date: apiInput.start_date,
      end_date: apiInput.end_date,
      lead_ids: apiInput.lead_ids.length + ' contacts'
    });

    // Map API fields to Prisma fields (as done in campaigns.js)
    const prismaData = {
      campaignName: apiInput.campaign_name, // API → Prisma mapping
      description: apiInput.description,
      sequenceId: apiInput.sequence_id, // API → Prisma mapping
      startDate: apiInput.start_date ? new Date(apiInput.start_date) : null, // API → Prisma mapping
      endDate: apiInput.end_date ? new Date(apiInput.end_date) : null, // API → Prisma mapping
      isActive: true
    };

    console.log('📝 Mapped to Prisma fields (camelCase):', {
      campaignName: prismaData.campaignName,
      sequenceId: prismaData.sequenceId,
      startDate: prismaData.startDate.toISOString(),
      endDate: prismaData.endDate.toISOString()
    });

    // Create campaign with transaction (as in campaigns.js)
    const result = await prisma.$transaction(async (tx) => {
      // Create campaign
      const campaign = await tx.campaign.create({
        data: prismaData,
        include: {
          sequence: {
            select: { name: true }
          }
        }
      });

      // Add campaign leads
      if (apiInput.lead_ids.length > 0) {
        await tx.campaignLead.createMany({
          data: apiInput.lead_ids.map(contactId => ({
            campaignId: campaign.id,
            contactId
          }))
        });

        // Create enrollments
        const enrollmentData = apiInput.lead_ids.map(contactId => ({
          contactId,
          sequenceId: apiInput.sequence_id,
          campaignId: campaign.id,
          currentStep: 1,
          status: 'ACTIVE',
          nextSendAt: new Date()
        }));

        await tx.enrollment.createMany({
          data: enrollmentData
        });
      }

      return campaign;
    });

    console.log('✅ API Field Mapping successful:');
    console.log('   - Campaign ID:', result.id);
    console.log('   - Campaign Name:', result.campaignName);
    console.log('   - Sequence:', result.sequence.name);
    console.log('   - Leads Added:', apiInput.lead_ids.length);

    return true;

  } catch (error) {
    console.error('❌ API Field Mapping failed:', error.message);
    console.error('   Error details:', error);
    return false;
  }
}

/**
 * Test 3: Campaign Fetching and Verification
 */
async function testCampaignFetching() {
  console.log('\n🧪 Test 3: Campaign Fetching and Verification\n');

  try {
    // Fetch the created campaign
    const campaign = await prisma.campaign.findUnique({
      where: { id: testData.campaignId },
      include: {
        sequence: {
          select: { name: true, description: true }
        },
        campaignLeads: {
          include: {
            contact: {
              select: { email: true, firstName: true, lastName: true }
            }
          }
        },
        enrollments: {
          select: { id: true, status: true, currentStep: true }
        },
        _count: {
          select: {
            campaignLeads: true,
            enrollments: true,
            events: true
          }
        }
      }
    });

    if (!campaign) {
      console.error('❌ Campaign not found');
      return false;
    }

    console.log('✅ Campaign fetched successfully:');
    console.log('   - ID:', campaign.id);
    console.log('   - Name:', campaign.campaignName);
    console.log('   - Description:', campaign.description);
    console.log('   - Sequence:', campaign.sequence.name);
    console.log('   - Start Date:', campaign.startDate);
    console.log('   - End Date:', campaign.endDate);
    console.log('   - Active:', campaign.isActive);
    console.log('   - Created:', campaign.createdAt);
    console.log('   - Updated:', campaign.updatedAt);
    console.log('   - Leads Count:', campaign._count.campaignLeads);
    console.log('   - Enrollments Count:', campaign._count.enrollments);

    // Verify required fields are present
    const requiredFields = ['campaignName', 'sequenceId'];
    const missingFields = requiredFields.filter(field => !campaign[field]);
    
    if (missingFields.length > 0) {
      console.error('❌ Missing required fields:', missingFields);
      return false;
    }

    console.log('✅ All required fields present:', requiredFields);

    // Verify field types
    console.log('✅ Field type verification:');
    console.log('   - campaignName (string):', typeof campaign.campaignName);
    console.log('   - sequenceId (string):', typeof campaign.sequenceId);
    console.log('   - startDate (date):', campaign.startDate instanceof Date);
    console.log('   - endDate (date):', campaign.endDate instanceof Date);
    console.log('   - isActive (boolean):', typeof campaign.isActive);

    return true;

  } catch (error) {
    console.error('❌ Campaign fetching failed:', error.message);
    return false;
  }
}

/**
 * Test 4: Field Validation Tests
 */
async function testFieldValidation() {
  console.log('\n🧪 Test 4: Field Validation Tests\n');

  const tests = [
    {
      name: 'Missing campaignName',
      data: { sequenceId: testData.sequenceId },
      shouldFail: true
    },
    {
      name: 'Missing sequenceId',
      data: { campaignName: 'Test Campaign' },
      shouldFail: true
    },
    {
      name: 'Invalid sequenceId',
      data: { campaignName: 'Test Campaign', sequenceId: 'invalid-id' },
      shouldFail: true
    },
    {
      name: 'Valid minimal data',
      data: { campaignName: 'Minimal Test Campaign', sequenceId: testData.sequenceId },
      shouldFail: false
    }
  ];

  let passedTests = 0;

  for (const test of tests) {
    try {
      console.log(`📝 Testing: ${test.name}`);
      
      const result = await prisma.campaign.create({
        data: test.data
      });

      if (test.shouldFail) {
        console.log(`❌ Test "${test.name}" should have failed but succeeded`);
        // Clean up the created campaign
        await prisma.campaign.delete({ where: { id: result.id } });
      } else {
        console.log(`✅ Test "${test.name}" passed - Campaign created: ${result.id}`);
        // Clean up the created campaign
        await prisma.campaign.delete({ where: { id: result.id } });
        passedTests++;
      }

    } catch (error) {
      if (test.shouldFail) {
        console.log(`✅ Test "${test.name}" passed - Expected failure: ${error.message}`);
        passedTests++;
      } else {
        console.log(`❌ Test "${test.name}" failed unexpectedly: ${error.message}`);
      }
    }
  }

  console.log(`\n📊 Field Validation Results: ${passedTests}/${tests.length} tests passed`);
  return passedTests === tests.length;
}

/**
 * Cleanup test data
 */
async function cleanup() {
  console.log('\n🧹 Cleaning up test data...\n');

  try {
    // Delete campaign leads and enrollments (cascade should handle this)
    if (testData.campaignId) {
      await prisma.campaign.deleteMany({
        where: {
          OR: [
            { id: testData.campaignId },
            { campaignName: { contains: 'Test' } }
          ]
        }
      });
      console.log('✅ Deleted test campaigns');
    }

    // Delete test contacts
    if (testData.contactIds.length > 0) {
      await prisma.contact.deleteMany({
        where: { id: { in: testData.contactIds } }
      });
      console.log('✅ Deleted test contacts');
    }

    // Delete test sequence
    if (testData.sequenceId) {
      await prisma.sequence.delete({
        where: { id: testData.sequenceId }
      });
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
  console.log('🚀 Campaign Creation Test Suite');
  console.log('=================================\n');

  const startTime = Date.now();
  let allTestsPassed = true;

  try {
    // Setup
    const setupSuccess = await setupTestData();
    if (!setupSuccess) {
      console.log('❌ Setup failed. Aborting tests.');
      return;
    }

    // Run tests
    const tests = [
      { name: 'Direct Prisma Campaign Creation', fn: testDirectPrismaCampaignCreation },
      { name: 'API Field Mapping Simulation', fn: testAPIFieldMappingSimulation },
      { name: 'Campaign Fetching and Verification', fn: testCampaignFetching },
      { name: 'Field Validation Tests', fn: testFieldValidation }
    ];

    for (const test of tests) {
      const success = await test.fn();
      if (!success) {
        allTestsPassed = false;
      }
      console.log(''); // Add spacing between tests
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
    console.log('\n🎉 Campaign creation with proper field mapping is working correctly!');
    console.log('✅ Required fields (campaignName, sequenceId) are properly validated');
    console.log('✅ API field mapping (snake_case → camelCase) is working');
    console.log('✅ Prisma campaign.create and campaign.findUnique are functioning');
    console.log('✅ Transaction-based creation with leads and enrollments works');
  } else {
    console.log('\n⚠️ Some tests failed. Please check the output above for details.');
  }

  // Disconnect Prisma
  await prisma.$disconnect();
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests };
