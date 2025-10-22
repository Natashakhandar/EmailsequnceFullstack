const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testTriggerSystem() {
  console.log('🧪 Testing Email Sequencing Trigger System...\n');

  try {
    // 1. Test creating a sequence with steps
    console.log('1️⃣ Creating test sequence...');
    const sequence = await prisma.sequence.create({
      data: {
        name: 'Test Trigger Sequence',
        description: 'Testing the trigger step functionality',
        steps: {
          create: [
            {
              stepOrder: 1,
              delayDays: 0,
              delayHours: 0,
              delayMinutes: 1,
              subject: 'Welcome to our sequence!',
              body: '<h1>Welcome {{firstName}}!</h1><p>This is the first email in our sequence.</p>',
              triggerType: 'delay'
            },
            {
              stepOrder: 2,
              delayDays: 0,
              delayHours: 0,
              delayMinutes: 2,
              subject: 'Follow-up: Did you see our welcome message?',
              body: '<h1>Hi {{firstName}},</h1><p>This is our trigger step - it only sends if you opened the first email!</p>',
              triggerType: 'opened'
            },
            {
              stepOrder: 3,
              delayDays: 1,
              delayHours: 0,
              delayMinutes: 0,
              subject: 'Final reminder',
              body: '<h1>Last chance {{firstName}}!</h1><p>This is our final email in the sequence.</p>',
              triggerType: 'delay'
            }
          ]
        }
      },
      include: {
        steps: {
          orderBy: { stepOrder: 'asc' }
        }
      }
    });
    console.log('✅ Sequence created:', sequence.name);
    console.log(`   Steps: ${sequence.steps.length}`);

    // 2. Set trigger step (step 2)
    console.log('\n2️⃣ Setting trigger step...');
    const triggerStep = sequence.steps.find(step => step.stepOrder === 2);
    
    await prisma.sequenceTrigger.create({
      data: {
        sequenceId: sequence.id,
        triggerStepId: triggerStep.id
      }
    });
    console.log('✅ Trigger step set to step 2');

    // 3. Create test contact
    console.log('\n3️⃣ Creating test contact...');
    const contact = await prisma.contact.create({
      data: {
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        company: 'Test Company'
      }
    });
    console.log('✅ Contact created:', contact.email);

    // 4. Enroll contact in sequence
    console.log('\n4️⃣ Enrolling contact in sequence...');
    const enrollment = await prisma.enrollment.create({
      data: {
        contactId: contact.id,
        sequenceId: sequence.id,
        currentStep: 1,
        nextSendAt: new Date(), // Send immediately for testing
        status: 'ACTIVE'
      }
    });
    console.log('✅ Contact enrolled:', enrollment.id);

    // 5. Test trigger step retrieval
    console.log('\n5️⃣ Testing trigger step retrieval...');
    const triggerInfo = await prisma.sequenceTrigger.findUnique({
      where: { sequenceId: sequence.id },
      include: {
        triggerStep: {
          include: {
            template: true
          }
        }
      }
    });
    
    if (triggerInfo) {
      console.log('✅ Trigger step retrieved successfully:');
      console.log(`   Trigger Step Order: ${triggerInfo.triggerStep.stepOrder}`);
      console.log(`   Subject: ${triggerInfo.triggerStep.subject}`);
    } else {
      console.log('❌ No trigger step found');
    }

    // 6. Test sequence with trigger info
    console.log('\n6️⃣ Testing sequence retrieval with trigger info...');
    const fullSequence = await prisma.sequence.findUnique({
      where: { id: sequence.id },
      include: {
        steps: {
          orderBy: { stepOrder: 'asc' }
        },
        trigger: {
          include: {
            triggerStep: true
          }
        }
      }
    });

    if (fullSequence.trigger) {
      console.log('✅ Sequence with trigger info retrieved:');
      console.log(`   Sequence: ${fullSequence.name}`);
      console.log(`   Total Steps: ${fullSequence.steps.length}`);
      console.log(`   Trigger Step: ${fullSequence.trigger.triggerStep.stepOrder}`);
    } else {
      console.log('❌ No trigger info found in sequence');
    }

    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   - Sequence ID: ${sequence.id}`);
    console.log(`   - Contact ID: ${contact.id}`);
    console.log(`   - Enrollment ID: ${enrollment.id}`);
    console.log(`   - Trigger Step: ${triggerInfo?.triggerStep.stepOrder || 'Not set'}`);

    return {
      sequenceId: sequence.id,
      contactId: contact.id,
      enrollmentId: enrollment.id,
      triggerStepOrder: triggerInfo?.triggerStep.stepOrder
    };

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

async function cleanup(testData) {
  if (!testData) return;
  
  console.log('\n🧹 Cleaning up test data...');
  
  try {
    // Delete in correct order due to foreign key constraints
    if (testData.enrollmentId) {
      await prisma.enrollment.delete({ where: { id: testData.enrollmentId } });
      console.log('✅ Enrollment deleted');
    }
    
    if (testData.contactId) {
      await prisma.contact.delete({ where: { id: testData.contactId } });
      console.log('✅ Contact deleted');
    }
    
    if (testData.sequenceId) {
      await prisma.sequence.delete({ where: { id: testData.sequenceId } });
      console.log('✅ Sequence deleted');
    }
    
    console.log('✅ Cleanup completed');
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  }
}

// Run the test
async function main() {
  let testData = null;
  
  try {
    testData = await testTriggerSystem();
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

module.exports = { testTriggerSystem, cleanup };
