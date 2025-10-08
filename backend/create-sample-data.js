const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createSampleData() {
  try {
    console.log('Creating sample data...');
    
    // Generate a unique email for this run
    const timestamp = Date.now();
    const uniqueEmail = `test-${timestamp}@example.com`;
    
    // Create a sample contact with unique email
    const contact = await prisma.contact.upsert({
      where: { email: uniqueEmail },
      update: {},
      create: {
        email: uniqueEmail,
        firstName: 'John',
        lastName: 'Doe',
        company: 'Example Corp',
        status: 'ACTIVE',
        timezone: 'UTC'
      }
    });
    
    console.log('✅ Created contact:', contact);
    
    // Create a sample email template
    const template = await prisma.template.create({
      data: {
        name: 'Welcome Email',
        subject: 'Welcome to Our Service, {{firstName}}!',
        body: `Hello {{firstName}},\n\nThank you for joining us at {{company}}! We're excited to have you on board.\n\nBest regards,\nThe Team`,
        isActive: true
      }
    });
    
    console.log('✅ Created template:', template);
    
    // Create a sample sequence
    const sequence = await prisma.sequence.create({
      data: {
        name: 'Onboarding Sequence',
        description: 'Welcome new users to our platform',
        isActive: true
      }
    });
    
    console.log('✅ Created sequence:', sequence);
    
    // Create sequence step
    const sequenceStep = await prisma.sequenceStep.create({
      data: {
        sequenceId: sequence.id,
        templateId: template.id,
        stepOrder: 1,
        delayDays: 0,
        isActive: true
      }
    });
    
    console.log('✅ Created sequence step:', sequenceStep);
    
    // Enroll the contact in the sequence
    const enrollment = await prisma.enrollment.create({
      data: {
        contactId: contact.id,
        sequenceId: sequence.id,
        status: 'ACTIVE',
        nextSendAt: new Date(),
        currentStep: 1
      }
    });
    
    console.log('✅ Created enrollment:', enrollment);
    
    // Create a sample event
    const event = await prisma.event.create({
      data: {
        type: 'SENT',
        contactId: contact.id,
        enrollmentId: enrollment.id,
        details: JSON.stringify({ message: 'User enrolled in sequence' })
      }
    });
    
    console.log('✅ Created event:', event);
    
  } catch (error) {
    console.error('❌ Error creating sample data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createSampleData();
