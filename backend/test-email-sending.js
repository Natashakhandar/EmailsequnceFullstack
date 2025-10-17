const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BASE_URL = 'http://localhost:3001/api';

async function testEmailSendingWithTriggers() {
  console.log('🧪 Testing Email Sending with Trigger System...\n');

  let sequenceId = null;
  let contactId = null;
  let enrollmentId = null;

  try {
    // Step 1: Create a sequence with trigger step
    console.log('1️⃣ Creating sequence with trigger step...');
    const sequencePayload = {
      name: 'Email Trigger Test Sequence',
      description: 'Testing email sending with trigger system',
      steps: [
        {
          stepOrder: 1,
          delayDays: 0,
          delayHours: 0,
          delayMinutes: 0, // Send immediately
          subject: 'Welcome {{firstName}}!',
          body: '<h1>Welcome {{firstName}}!</h1><p>This is our first email.</p>',
          triggerType: 'delay'
        },
        {
          stepOrder: 2,
          delayDays: 0,
          delayHours: 0,
          delayMinutes: 1, // 1 minute delay
          subject: 'Follow-up for {{firstName}}',
          body: '<h1>Hi {{firstName}},</h1><p>This email only sends if you opened the first one!</p>',
          triggerType: 'opened'
        },
        {
          stepOrder: 3,
          delayDays: 0,
          delayHours: 0,
          delayMinutes: 2, // 2 minute delay
          subject: 'Final reminder {{firstName}}',
          body: '<h1>Last chance {{firstName}}!</h1><p>This is our final email.</p>',
          triggerType: 'delay'
        }
      ]
    };

    const sequenceResponse = await axios.post(`${BASE_URL}/sequences`, sequencePayload);
    sequenceId = sequenceResponse.data.data.id;
    console.log('✅ Sequence created:', sequenceId);

    // Step 2: Set trigger step (step 2)
    console.log('\n2️⃣ Setting trigger step...');
    const step2 = sequenceResponse.data.data.steps.find(s => s.stepOrder === 2);
    await axios.put(`${BASE_URL}/sequences/${sequenceId}/trigger`, {
      triggerStepId: step2.id
    });
    console.log('✅ Trigger step set to step 2');

    // Step 3: Create a test contact
    console.log('\n3️⃣ Creating test contact...');
    const contactPayload = {
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      company: 'Test Company'
    };

    const contactResponse = await axios.post(`${BASE_URL}/contacts`, contactPayload);
    contactId = contactResponse.data.id;
    console.log('✅ Contact created:', contactId);

    // Step 4: Enroll contact in sequence
    console.log('\n4️⃣ Enrolling contact in sequence...');
    const enrollmentPayload = {
      contactId,
      sequenceId,
      startImmediately: true
    };

    const enrollmentResponse = await axios.post(`${BASE_URL}/enrollments`, enrollmentPayload);
    enrollmentId = enrollmentResponse.data.id;
    console.log('✅ Contact enrolled:', enrollmentId);

    // Step 5: Check scheduler status
    console.log('\n5️⃣ Checking scheduler status...');
    const schedulerResponse = await axios.get(`${BASE_URL}/scheduler/status`);
    console.log('✅ Scheduler status:', schedulerResponse.data);

    // Step 6: Manually trigger email processing
    console.log('\n6️⃣ Triggering email processing...');
    try {
      const triggerResponse = await axios.post(`${BASE_URL}/scheduler/trigger`);
      console.log('✅ Email processing triggered:', triggerResponse.data.message);
    } catch (error) {
      console.log('⚠️ Email processing trigger response:', error.response?.data || error.message);
    }

    // Step 7: Check enrollment status
    console.log('\n7️⃣ Checking enrollment status...');
    const enrollmentStatusResponse = await axios.get(`${BASE_URL}/enrollments/${enrollmentId}`);
    const enrollment = enrollmentStatusResponse.data;
    console.log('✅ Enrollment status:');
    console.log(`   Current Step: ${enrollment.currentStep}`);
    console.log(`   Last Sent Step: ${enrollment.lastSentStep}`);
    console.log(`   Status: ${enrollment.status}`);
    console.log(`   Next Send At: ${enrollment.nextSendAt}`);

    // Step 8: Check events
    console.log('\n8️⃣ Checking events...');
    const eventsResponse = await axios.get(`${BASE_URL}/enrollments/${enrollmentId}/events`);
    const events = eventsResponse.data;
    console.log(`✅ Found ${events.length} events:`);
    events.forEach((event, index) => {
      console.log(`   ${index + 1}. ${event.type} at ${event.timestamp}`);
      if (event.details) {
        try {
          const details = JSON.parse(event.details);
          console.log(`      Subject: ${details.subject}`);
          console.log(`      Step: ${details.stepOrder}`);
        } catch (e) {
          console.log(`      Details: ${event.details}`);
        }
      }
    });

    // Step 9: Test trigger logic by simulating email open
    console.log('\n9️⃣ Simulating email open to test trigger...');
    const sentEvents = events.filter(e => e.type === 'SENT');
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
              userAgent: 'Test User Agent'
            })
          }
        });
        console.log('✅ Email open event simulated');

        // Trigger processing again
        console.log('\n🔄 Triggering email processing again after open...');
        try {
          await axios.post(`${BASE_URL}/scheduler/trigger`);
          console.log('✅ Email processing triggered again');
        } catch (error) {
          console.log('⚠️ Email processing trigger response:', error.response?.data || error.message);
        }

        // Check enrollment status again
        console.log('\n📊 Checking enrollment status after open...');
        const finalEnrollmentResponse = await axios.get(`${BASE_URL}/enrollments/${enrollmentId}`);
        const finalEnrollment = finalEnrollmentResponse.data;
        console.log('✅ Final enrollment status:');
        console.log(`   Current Step: ${finalEnrollment.currentStep}`);
        console.log(`   Last Sent Step: ${finalEnrollment.lastSentStep}`);
        console.log(`   Status: ${finalEnrollment.status}`);

        // Check final events
        const finalEventsResponse = await axios.get(`${BASE_URL}/enrollments/${enrollmentId}/events`);
        const finalEvents = finalEventsResponse.data;
        console.log(`\n📋 Final events (${finalEvents.length} total):`);
        finalEvents.forEach((event, index) => {
          console.log(`   ${index + 1}. ${event.type} at ${event.timestamp}`);
        });
      }
    }

    console.log('\n🎉 Email sending test completed!');
    return { sequenceId, contactId, enrollmentId };

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    return { sequenceId, contactId, enrollmentId };
  }
}

async function cleanup(testData) {
  if (!testData) return;
  
  console.log('\n🧹 Cleaning up test data...');
  
  try {
    // Delete in correct order due to foreign key constraints
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
    testData = await testEmailSendingWithTriggers();
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

module.exports = { testEmailSendingWithTriggers, cleanup };
