const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';

async function testSequenceCreationAPI() {
  console.log('🧪 Testing Sequence Creation API Endpoints...\n');

  try {
    // Test 1: Simple sequence creation
    console.log('1️⃣ Testing simple sequence creation via API...');
    const simpleSequencePayload = {
      name: 'Test API Sequence',
      description: 'Testing sequence creation via API',
      steps: [
        {
          stepOrder: 1,
          delayDays: 0,
          delayHours: 0,
          subject: 'Welcome!',
          body: '<h1>Welcome {{firstName}}!</h1>',
          triggerType: 'delay'
        },
        {
          stepOrder: 2,
          delayDays: 0,
          delayHours: 1,
          subject: 'Follow up',
          body: '<h1>Follow up email</h1>',
          triggerType: 'opened'
        }
      ]
    };

    try {
      const response = await axios.post(`${BASE_URL}/sequences`, simpleSequencePayload);
      console.log('✅ Sequence created successfully:', response.data.data.id);
      
      const sequenceId = response.data.data.id;
      
      // Test 2: Set trigger step
      console.log('\n2️⃣ Testing trigger step setting...');
      const step2 = response.data.data.steps.find(s => s.stepOrder === 2);
      
      if (step2) {
        try {
          const triggerResponse = await axios.put(`${BASE_URL}/sequences/${sequenceId}/trigger`, {
            triggerStepId: step2.id
          });
          console.log('✅ Trigger step set successfully:', triggerResponse.data.data.triggerStepOrder);
        } catch (triggerError) {
          console.log('❌ Trigger step setting failed:', triggerError.response?.data || triggerError.message);
        }
      }
      
      // Test 3: Get trigger step
      console.log('\n3️⃣ Testing trigger step retrieval...');
      try {
        const getTriggerResponse = await axios.get(`${BASE_URL}/sequences/${sequenceId}/trigger`);
        console.log('✅ Trigger step retrieved:', getTriggerResponse.data.data);
      } catch (getTriggerError) {
        console.log('❌ Trigger step retrieval failed:', getTriggerError.response?.data || getTriggerError.message);
      }
      
      // Test 4: Get sequence with trigger info
      console.log('\n4️⃣ Testing sequence retrieval with trigger info...');
      try {
        const getSequenceResponse = await axios.get(`${BASE_URL}/sequences/${sequenceId}`);
        const sequence = getSequenceResponse.data;
        console.log('✅ Sequence retrieved with trigger info:');
        console.log(`   Name: ${sequence.name}`);
        console.log(`   Steps: ${sequence.steps.length}`);
        console.log(`   Has Trigger: ${sequence.trigger ? 'Yes' : 'No'}`);
        if (sequence.trigger) {
          console.log(`   Trigger Step Order: ${sequence.trigger.triggerStep.stepOrder}`);
        }
      } catch (getError) {
        console.log('❌ Sequence retrieval failed:', getError.response?.data || getError.message);
      }
      
      return sequenceId;
      
    } catch (error) {
      console.log('❌ Sequence creation failed:', error.response?.data || error.message);
      return null;
    }

  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
    return null;
  }
}

async function testInvalidPayloads() {
  console.log('\n🧪 Testing Invalid Payloads...\n');

  // Test invalid triggerType
  console.log('5️⃣ Testing invalid triggerType...');
  const invalidTriggerPayload = {
    name: 'Invalid Trigger Test',
    steps: [
      {
        stepOrder: 1,
        subject: 'Test',
        body: 'Test body',
        triggerType: 'invalid_type' // This should fail
      }
    ]
  };

  try {
    await axios.post(`${BASE_URL}/sequences`, invalidTriggerPayload);
    console.log('❌ Should have failed with invalid triggerType');
  } catch (error) {
    console.log('✅ Correctly rejected invalid triggerType:', error.response?.data?.message);
  }

  // Test missing content
  console.log('\n6️⃣ Testing missing subject/body...');
  const missingContentPayload = {
    name: 'Missing Content Test',
    steps: [
      {
        stepOrder: 1,
        delayDays: 0
        // Missing subject and body, and no templateId
      }
    ]
  };

  try {
    await axios.post(`${BASE_URL}/sequences`, missingContentPayload);
    console.log('❌ Should have failed with missing content');
  } catch (error) {
    console.log('✅ Correctly rejected missing content:', error.response?.data?.message);
  }
}

async function cleanup(sequenceId) {
  if (sequenceId) {
    console.log('\n🧹 Cleaning up...');
    try {
      await axios.delete(`${BASE_URL}/sequences/${sequenceId}`);
      console.log('✅ Sequence deleted');
    } catch (error) {
      console.log('❌ Cleanup failed:', error.response?.data || error.message);
    }
  }
}

async function main() {
  let sequenceId = null;
  
  try {
    sequenceId = await testSequenceCreationAPI();
    await testInvalidPayloads();
  } catch (error) {
    console.error('Test execution failed:', error);
  } finally {
    await cleanup(sequenceId);
  }
}

if (require.main === module) {
  main();
}

module.exports = { testSequenceCreationAPI, testInvalidPayloads, cleanup };
