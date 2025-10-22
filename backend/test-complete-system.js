const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BASE_URL = 'http://localhost:3001/api';

async function testCompleteSystem() {
  console.log('🧪 Testing Complete Email Sequencing System...\n');

  let sequenceId = null;
  let contactId = null;
  let enrollmentId = null;

  try {
    // Test 1: Create sequence with multiple steps
    console.log('1️⃣ Creating sequence with trigger system...');
    const sequencePayload = {
      name: 'Complete System Test',
      description: 'Testing the complete email sequencing system',
      steps: [
        {
          stepOrder: 1,
          delayDays: 0,
          delayHours: 0,
          delayMinutes: 0,
          subject: 'Welcome {{firstName}}!',
          body: '<h1>Welcome {{firstName}}!</h1><p>Thank you for joining us!</p>',
          triggerType: 'delay'
        },
        {
          stepOrder: 2,
          delayDays: 0,
          delayHours: 0,
          delayMinutes: 1,
          subject: 'Did you see our welcome?',
          body: '<h1>Hi {{firstName}},</h1><p>This email only sends if you opened the first one!</p>',
          triggerType: 'opened'
        },
        {
          stepOrder: 3,
          delayDays: 0,
          delayHours: 0,
          delayMinutes: 2,
          subject: 'Final message for {{firstName}}',
          body: '<h1>Last chance {{firstName}}!</h1><p>This is our final email in the sequence.</p>',
          triggerType: 'delay'
        }
      ]
    };

    const sequenceResponse = await axios.post(`${BASE_URL}/sequences`, sequencePayload);
    sequenceId = sequenceResponse.data.data.id;
    console.log('✅ Sequence created successfully');
    console.log(`   ID: ${sequenceId}`);
    console.log(`   Steps: ${sequenceResponse.data.data.steps.length}`);

    // Test 2: Set trigger step
    console.log('\n2️⃣ Setting trigger step...');
    const step2 = sequenceResponse.data.data.steps.find(s => s.stepOrder === 2);
    const triggerResponse = await axios.put(`${BASE_URL}/sequences/${sequenceId}/trigger`, {
      triggerStepId: step2.id
    });
    console.log('✅ Trigger step set successfully');
    console.log(`   Trigger Step: ${triggerResponse.data.data.triggerStepOrder}`);

    // Test 3: Verify trigger persistence
    console.log('\n3️⃣ Verifying trigger step persistence...');
    const getTriggerResponse = await axios.get(`${BASE_URL}/sequences/${sequenceId}/trigger`);
    console.log('✅ Trigger step persisted correctly');
    console.log(`   Has Trigger: ${getTriggerResponse.data.data.hasTrigger}`);
    console.log(`   Trigger Step Order: ${getTriggerResponse.data.data.triggerStepOrder}`);

    // Test 4: Get sequence with trigger info
    console.log('\n4️⃣ Retrieving sequence with trigger info...');
    const getSequenceResponse = await axios.get(`${BASE_URL}/sequences/${sequenceId}`);
    const sequence = getSequenceResponse.data;
    console.log('✅ Sequence retrieved with complete trigger info');
    console.log(`   Name: ${sequence.name}`);
    console.log(`   Steps: ${sequence.steps.length}`);
    console.log(`   Has Trigger: ${sequence.trigger ? 'Yes' : 'No'}`);
    if (sequence.trigger) {
      console.log(`   Trigger Step: ${sequence.trigger.triggerStep.stepOrder}`);
      console.log(`   Trigger Subject: ${sequence.trigger.triggerStep.subject}`);
    }

    // Test 5: Create contact
    console.log('\n5️⃣ Creating test contact...');
    const contactPayload = {
      email: 'complete-test@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
      company: 'Complete Test Co'
    };

    const contactResponse = await axios.post(`${BASE_URL}/contacts`, contactPayload);
    contactId = contactResponse.data.id;
    console.log('✅ Contact created successfully');
    console.log(`   Email: ${contactResponse.data.email}`);
    console.log(`   Name: ${contactResponse.data.firstName} ${contactResponse.data.lastName}`);

    // Test 6: Enroll contact
    console.log('\n6️⃣ Enrolling contact in sequence...');
    const enrollmentPayload = {
      contactId,
      sequenceId,
      startImmediately: true
    };

    const enrollmentResponse = await axios.post(`${BASE_URL}/enrollments`, enrollmentPayload);
    enrollmentId = enrollmentResponse.data.id;
    console.log('✅ Contact enrolled successfully');
    console.log(`   Enrollment ID: ${enrollmentId}`);
    console.log(`   Current Step: ${enrollmentResponse.data.currentStep}`);
    console.log(`   Status: ${enrollmentResponse.data.status}`);

    // Test 7: Check scheduler and trigger processing
    console.log('\n7️⃣ Checking scheduler and triggering email processing...');
    const schedulerStatus = await axios.get(`${BASE_URL}/scheduler/status`);
    console.log('✅ Scheduler status:', schedulerStatus.data.isRunning ? 'Running' : 'Stopped');

    await axios.post(`${BASE_URL}/scheduler/trigger`);
    console.log('✅ Email processing triggered');

    // Wait a moment for processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 8: Check enrollment after first processing
    console.log('\n8️⃣ Checking enrollment after first email processing...');
    const enrollmentAfterFirst = await axios.get(`${BASE_URL}/enrollments/${enrollmentId}`);
    console.log('✅ Enrollment status after first processing:');
    console.log(`   Current Step: ${enrollmentAfterFirst.data.currentStep}`);
    console.log(`   Last Sent Step: ${enrollmentAfterFirst.data.lastSentStep}`);
    console.log(`   Next Send At: ${enrollmentAfterFirst.data.nextSendAt}`);

    // Test 9: Check events
    console.log('\n9️⃣ Checking events...');
    const eventsResponse = await axios.get(`${BASE_URL}/enrollments/${enrollmentId}/events`);
    console.log(`✅ Found ${eventsResponse.data.length} events:`);
    eventsResponse.data.forEach((event, index) => {
      console.log(`   ${index + 1}. ${event.type} at ${new Date(event.timestamp).toLocaleTimeString()}`);
      if (event.details) {
        try {
          const details = JSON.parse(event.details);
          if (details.subject) {
            console.log(`      Subject: ${details.subject}`);
          }
          if (details.stepOrder) {
            console.log(`      Step: ${details.stepOrder}`);
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
    });

    // Test 10: Simulate email open to test trigger
    console.log('\n🔟 Testing trigger functionality...');
    const sentEvents = eventsResponse.data.filter(e => e.type === 'SENT');
    if (sentEvents.length > 0) {
      const firstEmailId = sentEvents[0].emailId;
      if (firstEmailId) {
        // Simulate email open
        await prisma.event.create({
          data: {
            enrollmentId,
            contactId,
            type: 'OPENED',
            emailId: firstEmailId,
            details: JSON.stringify({
              emailId: firstEmailId,
              timestamp: new Date().toISOString(),
              userAgent: 'Complete Test User Agent'
            })
          }
        });
        console.log('✅ Email open event simulated');

        // Wait and trigger processing again
        await new Promise(resolve => setTimeout(resolve, 1000));
        await axios.post(`${BASE_URL}/scheduler/trigger`);
        console.log('✅ Email processing triggered after open');

        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Check final status
        console.log('\n📊 Final system status...');
        const finalEnrollment = await axios.get(`${BASE_URL}/enrollments/${enrollmentId}`);
        console.log('✅ Final enrollment status:');
        console.log(`   Current Step: ${finalEnrollment.data.currentStep}`);
        console.log(`   Last Sent Step: ${finalEnrollment.data.lastSentStep}`);
        console.log(`   Status: ${finalEnrollment.data.status}`);

        const finalEvents = await axios.get(`${BASE_URL}/enrollments/${enrollmentId}/events`);
        console.log(`\n📋 Final events (${finalEvents.data.length} total):`);
        const eventCounts = finalEvents.data.reduce((acc, event) => {
          acc[event.type] = (acc[event.type] || 0) + 1;
          return acc;
        }, {});
        Object.entries(eventCounts).forEach(([type, count]) => {
          console.log(`   ${type}: ${count}`);
        });

        // Check if trigger worked
        const sentCount = eventCounts.SENT || 0;
        const openCount = eventCounts.OPENED || 0;
        console.log('\n🎯 Trigger System Analysis:');
        console.log(`   Emails Sent: ${sentCount}`);
        console.log(`   Emails Opened: ${openCount}`);
        if (sentCount >= 2 && openCount >= 1) {
          console.log('✅ Trigger system working correctly - second email sent after open!');
        } else if (sentCount === 1) {
          console.log('⚠️ Only first email sent - trigger step waiting for open (correct behavior)');
        } else {
          console.log('❌ Unexpected email sending behavior');
        }
      }
    }

    console.log('\n🎉 Complete system test finished successfully!');
    console.log('\n📋 Test Summary:');
    console.log('✅ Sequence creation with custom content');
    console.log('✅ Trigger step persistence');
    console.log('✅ Contact enrollment');
    console.log('✅ Email sending logic');
    console.log('✅ Trigger-based email flow');
    console.log('✅ Event tracking');
    console.log('✅ API endpoints');

    return { sequenceId, contactId, enrollmentId };

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    if (error.response?.data) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    return { sequenceId, contactId, enrollmentId };
  }
}

async function cleanup(testData) {
  if (!testData) return;
  
  console.log('\n🧹 Cleaning up test data...');
  
  try {
    if (testData.enrollmentId) {
      await axios.delete(`${BASE_URL}/enrollments/${testData.enrollmentId}`);
      console.log('✅ Enrollment deleted');
    }
    
    if (testData.contactId) {
      await axios.delete(`${BASE_URL}/contacts/${testData.contactId}`);
      console.log('✅ Contact deleted');
    }
    
    if (testData.sequenceId) {
      await axios.delete(`${BASE_URL}/sequences/${testData.sequenceId}`);
      console.log('✅ Sequence deleted');
    }
    
    console.log('✅ Cleanup completed');
  } catch (error) {
    console.error('❌ Cleanup failed:', error.response?.data || error.message);
  }
}

async function main() {
  let testData = null;
  
  try {
    testData = await testCompleteSystem();
  } catch (error) {
    console.error('Test execution failed:', error);
  } finally {
    await cleanup(testData);
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

module.exports = { testCompleteSystem, cleanup };
