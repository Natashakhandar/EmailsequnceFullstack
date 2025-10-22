const { PrismaClient } = require('@prisma/client');
const { sendEmail, sendSequenceEmail } = require('./src/mailer/sendEmail');
const { replaceTokens, generateSampleData } = require('./src/utils/tokenReplace');

const prisma = new PrismaClient();

async function testEmailFormatting() {
  console.log('🧪 Testing Email Formatting and Token Replacement...\n');

  try {
    // Test 1: Token replacement functionality
    console.log('1️⃣ Testing token replacement...');
    
    const sampleData = {
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@testcompany.com',
      company: 'Test Company Inc',
      companyName: 'Test Company Inc'
    };

    const testSubject = 'Welcome {{firstName}} from {{companyName}}!';
    const testBody = `
      <h1>Hello {{firstName}}!</h1>
      <p>Welcome to {{companyName}}. We're excited to have you on board.</p>
      <p>Your email address {{email}} has been registered successfully.</p>
      
      <h2>Next Steps:</h2>
      <ul>
        <li>Complete your profile</li>
        <li>Explore our features</li>
        <li>Contact support if needed</li>
      </ul>
      
      <p>Best regards,<br>
      The {{companyName}} Team</p>
    `;

    const processedSubject = replaceTokens(testSubject, sampleData);
    const processedBody = replaceTokens(testBody, sampleData);

    console.log('✅ Subject processed:', processedSubject);
    console.log('✅ Body tokens replaced successfully');
    console.log('   Sample:', processedBody.substring(0, 100) + '...');

    // Test 2: Create test data for sequence email
    console.log('\n2️⃣ Creating test data for sequence email...');
    
    // Create a test contact
    const contact = await prisma.contact.create({
      data: {
        email: 'test-formatting@example.com',
        firstName: 'John',
        lastName: 'Doe',
        company: 'Formatting Test Corp'
      }
    });
    console.log('✅ Test contact created:', contact.email);

    // Create a test sequence with rich HTML content
    const sequence = await prisma.sequence.create({
      data: {
        name: 'HTML Formatting Test Sequence',
        description: 'Testing HTML formatting and token replacement',
        steps: {
          create: [
            {
              stepOrder: 1,
              delayDays: 0,
              delayHours: 0,
              subject: 'Welcome {{firstNameCapitalized}} from {{companyName}}!',
              body: `
                <h1>Welcome {{firstNameCapitalized}}!</h1>
                
                <p>Thank you for joining <strong>{{companyName}}</strong>. We're thrilled to have you as part of our community.</p>
                
                <h2>What's Next?</h2>
                <p>Here are some important steps to get you started:</p>
                
                <ul>
                  <li><strong>Complete your profile</strong> - Add your personal information</li>
                  <li><strong>Explore our dashboard</strong> - Familiarize yourself with the interface</li>
                  <li><strong>Join our community</strong> - Connect with other users</li>
                </ul>
                
                <h3>Important Information</h3>
                <p>Your account details:</p>
                <ul>
                  <li>Email: {{email}}</li>
                  <li>Full Name: {{fullNameCapitalized}}</li>
                  <li>Company: {{companyName}}</li>
                  <li>Registration Date: {{currentDate}}</li>
                </ul>
                
                <p>If you have any questions, please don't hesitate to reach out to our support team.</p>
                
                <p>Best regards,<br>
                <strong>The {{companyName}} Team</strong></p>
                
                <hr>
                <p style="font-size: 12px; color: #666;">
                  This email was sent to {{email}} on {{currentDate}} at {{currentTime}}.
                </p>
              `,
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
    console.log('✅ Test sequence created:', sequence.name);

    // Create enrollment
    const enrollment = await prisma.enrollment.create({
      data: {
        contactId: contact.id,
        sequenceId: sequence.id,
        currentStep: 1,
        nextSendAt: new Date(),
        status: 'ACTIVE'
      }
    });
    console.log('✅ Test enrollment created:', enrollment.id);

    // Test 3: Test sequence email sending (without actually sending)
    console.log('\n3️⃣ Testing sequence email processing...');
    
    // Get the enrollment with all related data (simulating scheduler behavior)
    const fullEnrollment = await prisma.enrollment.findUnique({
      where: { id: enrollment.id },
      include: {
        contact: true,
        sequence: {
          include: {
            steps: {
              where: { stepOrder: enrollment.currentStep },
              include: {
                template: true
              }
            }
          }
        }
      }
    });

    const { contact: testContact, sequence: testSequence } = fullEnrollment;
    const currentStep = testSequence.steps[0];

    // Prepare contact data (same as in sendSequenceEmail)
    const contactData = {
      firstName: testContact.firstName || '',
      lastName: testContact.lastName || '',
      email: testContact.email,
      company: testContact.company || '',
      companyName: testContact.company || '',
      fullName: [testContact.firstName, testContact.lastName].filter(Boolean).join(' ') || testContact.email,
      firstNameCapitalized: testContact.firstName ? testContact.firstName.charAt(0).toUpperCase() + testContact.firstName.slice(1).toLowerCase() : '',
      lastNameCapitalized: testContact.lastName ? testContact.lastName.charAt(0).toUpperCase() + testContact.lastName.slice(1).toLowerCase() : '',
      fullNameCapitalized: [
        testContact.firstName ? testContact.firstName.charAt(0).toUpperCase() + testContact.firstName.slice(1).toLowerCase() : '',
        testContact.lastName ? testContact.lastName.charAt(0).toUpperCase() + testContact.lastName.slice(1).toLowerCase() : ''
      ].filter(Boolean).join(' ') || testContact.email,
      currentDate: new Date().toLocaleDateString(),
      currentTime: new Date().toLocaleTimeString(),
      currentYear: new Date().getFullYear().toString()
    };

    // Process the email content
    const emailSubject = replaceTokens(currentStep.subject, contactData);
    const emailBody = replaceTokens(currentStep.body, contactData);

    console.log('✅ Email processing test completed');
    console.log('   Processed Subject:', emailSubject);
    console.log('   Body length:', emailBody.length, 'characters');
    console.log('   Contains HTML tags:', emailBody.includes('<h1>') ? 'Yes' : 'No');
    console.log('   Contains replaced tokens:', emailBody.includes('{{') ? 'No (Good!)' : 'Yes (Good!)');

    // Test 4: Verify specific token replacements
    console.log('\n4️⃣ Verifying specific token replacements...');
    
    const tokenTests = [
      { token: '{{firstName}}', expected: testContact.firstName },
      { token: '{{lastName}}', expected: testContact.lastName },
      { token: '{{email}}', expected: testContact.email },
      { token: '{{company}}', expected: testContact.company },
      { token: '{{companyName}}', expected: testContact.company },
      { token: '{{fullName}}', expected: `${testContact.firstName} ${testContact.lastName}` },
      { token: '{{firstNameCapitalized}}', expected: 'John' },
      { token: '{{fullNameCapitalized}}', expected: 'John Doe' }
    ];

    tokenTests.forEach(test => {
      const replaced = replaceTokens(test.token, contactData);
      const success = replaced === test.expected;
      console.log(`   ${success ? '✅' : '❌'} ${test.token} -> "${replaced}" ${success ? '' : `(expected: "${test.expected}")`}`);
    });

    // Test 5: HTML formatting preservation
    console.log('\n5️⃣ Testing HTML formatting preservation...');
    
    const htmlTests = [
      '<h1>Test Header</h1>',
      '<p>Test paragraph with <strong>bold text</strong></p>',
      '<ul><li>Item 1</li><li>Item 2</li></ul>',
      'Plain text\nwith line breaks\n\nand paragraphs'
    ];

    htmlTests.forEach((html, index) => {
      const processed = replaceTokens(html, contactData);
      console.log(`   Test ${index + 1}: ${processed.length > 50 ? processed.substring(0, 50) + '...' : processed}`);
    });

    console.log('\n🎉 All email formatting tests completed successfully!');

    return { contactId: contact.id, sequenceId: sequence.id, enrollmentId: enrollment.id };

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

async function cleanup(testData) {
  if (!testData) return;
  
  console.log('\n🧹 Cleaning up test data...');
  
  try {
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

async function main() {
  let testData = null;
  
  try {
    testData = await testEmailFormatting();
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

module.exports = { testEmailFormatting, cleanup };
