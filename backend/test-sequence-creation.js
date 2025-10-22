const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testSequenceCreation() {
  console.log('🧪 Testing Sequence Creation Issues...\n');

  try {
    // Test 1: Simple sequence creation (should work)
    console.log('1️⃣ Testing simple sequence creation...');
    const simpleSequence = {
      name: 'Test Simple Sequence',
      description: 'Testing basic sequence creation',
      steps: [
        {
          stepOrder: 1,
          delayDays: 0,
          delayHours: 0,
          subject: 'Welcome!',
          body: '<h1>Welcome {{firstName}}!</h1>'
        }
      ]
    };

    try {
      const sequence1 = await prisma.sequence.create({
        data: {
          name: simpleSequence.name,
          description: simpleSequence.description,
          steps: {
            create: simpleSequence.steps.map(step => ({
              stepOrder: step.stepOrder,
              delayDays: step.delayDays || 0,
              delayHours: step.delayHours || 0,
              delayMinutes: step.delayMinutes || 0,
              subject: step.subject || null,
              body: step.body || null,
              triggerType: step.triggerType || 'delay',
              triggerStepId: step.triggerStepId || null,
              isActive: step.isActive !== false
            }))
          }
        },
        include: {
          steps: {
            orderBy: { stepOrder: 'asc' }
          }
        }
      });
      console.log('✅ Simple sequence created:', sequence1.id);
    } catch (error) {
      console.log('❌ Simple sequence creation failed:', error.message);
      console.log('Error code:', error.code);
      console.log('Error details:', error.meta);
    }

    // Test 2: Sequence with template reference
    console.log('\n2️⃣ Testing sequence with template...');
    
    // First create a template
    const template = await prisma.template.create({
      data: {
        name: 'Test Template',
        subject: 'Template Subject',
        body: '<p>Template body</p>'
      }
    });

    const templateSequence = {
      name: 'Test Template Sequence',
      description: 'Testing sequence with template',
      steps: [
        {
          stepOrder: 1,
          templateId: template.id,
          delayDays: 0,
          delayHours: 0
        }
      ]
    };

    try {
      const sequence2 = await prisma.sequence.create({
        data: {
          name: templateSequence.name,
          description: templateSequence.description,
          steps: {
            create: templateSequence.steps.map(step => ({
              templateId: step.templateId || null,
              stepOrder: step.stepOrder,
              delayDays: step.delayDays || 0,
              delayHours: step.delayHours || 0,
              delayMinutes: step.delayMinutes || 0,
              subject: step.subject || null,
              body: step.body || null,
              triggerType: step.triggerType || 'delay',
              triggerStepId: step.triggerStepId || null,
              isActive: step.isActive !== false
            }))
          }
        },
        include: {
          steps: {
            orderBy: { stepOrder: 'asc' }
          }
        }
      });
      console.log('✅ Template sequence created:', sequence2.id);
    } catch (error) {
      console.log('❌ Template sequence creation failed:', error.message);
      console.log('Error code:', error.code);
      console.log('Error details:', error.meta);
    }

    // Test 3: Sequence with multiple steps and trigger references
    console.log('\n3️⃣ Testing complex sequence with trigger references...');
    
    const complexSequence = {
      name: 'Test Complex Sequence',
      description: 'Testing complex sequence with triggers',
      steps: [
        {
          stepOrder: 1,
          delayDays: 0,
          delayHours: 0,
          subject: 'Step 1',
          body: '<h1>Step 1</h1>',
          triggerType: 'delay'
        },
        {
          stepOrder: 2,
          delayDays: 0,
          delayHours: 1,
          subject: 'Step 2',
          body: '<h1>Step 2</h1>',
          triggerType: 'opened',
          triggerStepId: 'will-be-set-after-creation' // This might cause issues
        }
      ]
    };

    try {
      // Create sequence first
      const sequence3 = await prisma.sequence.create({
        data: {
          name: complexSequence.name,
          description: complexSequence.description,
          steps: {
            create: complexSequence.steps.map(step => ({
              stepOrder: step.stepOrder,
              delayDays: step.delayDays || 0,
              delayHours: step.delayHours || 0,
              delayMinutes: step.delayMinutes || 0,
              subject: step.subject || null,
              body: step.body || null,
              triggerType: step.triggerType || 'delay',
              triggerStepId: step.triggerStepId === 'will-be-set-after-creation' ? null : step.triggerStepId,
              isActive: step.isActive !== false
            }))
          }
        },
        include: {
          steps: {
            orderBy: { stepOrder: 'asc' }
          }
        }
      });
      console.log('✅ Complex sequence created:', sequence3.id);
      
      // Now test setting trigger step
      const step1 = sequence3.steps.find(s => s.stepOrder === 1);
      const step2 = sequence3.steps.find(s => s.stepOrder === 2);
      
      if (step1 && step2) {
        // Update step 2 to reference step 1
        await prisma.sequenceStep.update({
          where: { id: step2.id },
          data: { triggerStepId: step1.id }
        });
        console.log('✅ Trigger step reference updated');
      }
      
    } catch (error) {
      console.log('❌ Complex sequence creation failed:', error.message);
      console.log('Error code:', error.code);
      console.log('Error details:', error.meta);
    }

    // Test 4: Test trigger step setting
    console.log('\n4️⃣ Testing trigger step setting...');
    
    const sequences = await prisma.sequence.findMany({
      include: {
        steps: {
          orderBy: { stepOrder: 'asc' }
        }
      },
      take: 1
    });

    if (sequences.length > 0) {
      const testSequence = sequences[0];
      const triggerStep = testSequence.steps.find(s => s.stepOrder === 1);
      
      if (triggerStep) {
        try {
          const sequenceTrigger = await prisma.sequenceTrigger.create({
            data: {
              sequenceId: testSequence.id,
              triggerStepId: triggerStep.id
            }
          });
          console.log('✅ Sequence trigger created:', sequenceTrigger.id);
          
          // Test retrieval
          const retrieved = await prisma.sequenceTrigger.findUnique({
            where: { sequenceId: testSequence.id },
            include: {
              triggerStep: true
            }
          });
          
          if (retrieved) {
            console.log('✅ Trigger step retrieved:', retrieved.triggerStep.stepOrder);
          } else {
            console.log('❌ Trigger step not found after creation');
          }
          
        } catch (error) {
          console.log('❌ Trigger step creation failed:', error.message);
          console.log('Error code:', error.code);
        }
      }
    }

    console.log('\n🎉 Database tests completed!');

  } catch (error) {
    console.error('❌ Test execution failed:', error);
  }
}

async function cleanup() {
  console.log('\n🧹 Cleaning up test data...');
  
  try {
    await prisma.sequenceTrigger.deleteMany({});
    await prisma.enrollment.deleteMany({});
    await prisma.sequenceStep.deleteMany({});
    await prisma.sequence.deleteMany({});
    await prisma.template.deleteMany({});
    console.log('✅ Cleanup completed');
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  }
}

async function main() {
  try {
    await testSequenceCreation();
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

module.exports = { testSequenceCreation, cleanup };
