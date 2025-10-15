const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const { smtpConfig, emailConfig } = require('../config/smtp');
const { replaceTokens } = require('../utils/tokenReplace');
const prisma = require('../db/prismaClient');

// Create reusable transporter object using SMTP transport
let transporter = null;

function createTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport(smtpConfig);
  }
  return transporter;
}

// Verify SMTP connection
async function verifyConnection() {
  try {
    const transport = createTransporter();
    await transport.verify();
    console.log('✅ SMTP connection verified successfully');
    return true;
  } catch (error) {
    console.error('❌ SMTP connection failed:', error.message);
    return false;
  }
}

// Generate unsubscribe token and URL
async function generateUnsubscribeToken(contactId) {
  try {
    const token = uuidv4();
    
    await prisma.unsubscribeToken.create({
      data: {
        token,
        contactId
      }
    });

    return `${emailConfig.appUrl}/api/unsubscribe/page/${token}`;
  } catch (error) {
    console.error('Error generating unsubscribe token:', error);
    return `${emailConfig.appUrl}/api/unsubscribe/email`; // Fallback URL
  }
}

// Send individual email
async function sendEmail({ 
  to, 
  subject, 
  htmlBody, 
  textBody, 
  contactData = {}, 
  enrollmentId = null,
  contactId = null 
}) {
  try {
    const transport = createTransporter();
    
    // Replace tokens in subject and body
    const processedSubject = replaceTokens(subject, contactData);
    let processedHtmlBody = replaceTokens(htmlBody, contactData);
    const processedTextBody = textBody ? replaceTokens(textBody, contactData) : null;

    // Generate unique Message-ID for tracking
    const messageId = `<${uuidv4()}@${emailConfig.from.address.split('@')[1]}>`;

    // Add tracking pixel to HTML body if enrollmentId is provided
    if (enrollmentId && processedHtmlBody) {
      const trackingPixel = `<img src="${emailConfig.appUrl}/api/track/open?emailId=${encodeURIComponent(messageId)}" width="1" height="1" style="display:none;" alt="" />`;
      
      // Try to insert before closing body tag, otherwise append
      if (processedHtmlBody.includes('</body>')) {
        processedHtmlBody = processedHtmlBody.replace('</body>', `${trackingPixel}</body>`);
      } else {
        processedHtmlBody += trackingPixel;
      }
    }

    // Generate unsubscribe URL if contactId is provided
    let unsubscribeUrl = `${emailConfig.appUrl}/api/unsubscribe/email`;
    if (contactId) {
      unsubscribeUrl = await generateUnsubscribeToken(contactId);
    }

    // Prepare email options
    const mailOptions = {
      from: {
        name: emailConfig.from.name,
        address: emailConfig.from.address
      },
      to: to,
      subject: processedSubject,
      html: processedHtmlBody,
      text: processedTextBody,
      replyTo: emailConfig.replyTo,
      headers: {
        'Message-ID': messageId,
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        'X-Contact-ID': contactId || '',
        'X-Enrollment-ID': enrollmentId || '',
        'X-Mailer': 'Email Sequencing System v1.0'
      }
    };

    // Add bounce handling if configured
    if (emailConfig.bounceAddress) {
      mailOptions.envelope = {
        from: emailConfig.bounceAddress,
        to: [to]
      };
    }

    // Send email
    const info = await transport.sendMail(mailOptions);
    
    console.log(`📧 Email sent successfully to ${to}`);
    console.log(`Message ID: ${info.messageId}`);

    // Log sent event if enrollment provided
    if (enrollmentId && contactId) {
      await prisma.event.create({
        data: {
          enrollmentId,
          contactId,
          type: 'SENT',
          emailId: messageId,
          details: JSON.stringify({
            to,
            subject: processedSubject,
            messageId: info.messageId,
            response: info.response
          })
        }
      });
    }

    return {
      success: true,
      messageId: info.messageId,
      response: info.response,
      emailId: messageId
    };

  } catch (error) {
    console.error(`❌ Failed to send email to ${to}:`, error.message);

    // Log failed event if enrollment provided
    if (enrollmentId && contactId) {
      try {
        await prisma.event.create({
          data: {
            enrollmentId,
            contactId,
            type: 'FAILED',
            details: JSON.stringify({
              to,
              error: error.message,
              code: error.code,
              command: error.command
            })
          }
        });
      } catch (logError) {
        console.error('Failed to log email failure event:', logError);
      }
    }

    return {
      success: false,
      error: error.message,
      code: error.code
    };
  }
}

// Send sequence email (used by scheduler)
async function sendSequenceEmail(enrollment) {
  try {
    // Get enrollment with all related data
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

    if (!fullEnrollment) {
      throw new Error('Enrollment not found');
    }

    const { contact, sequence } = fullEnrollment;
    const currentStep = sequence.steps[0]; // Should be the current step

    if (!currentStep || !currentStep.template) {
      throw new Error('No template found for current step');
    }

    // Check if contact is still active
    if (contact.status === 'UNSUBSCRIBED' || contact.status === 'BOUNCED') {
      console.log(`Skipping email for ${contact.email} - status: ${contact.status}`);
      
      // Update enrollment status
      await prisma.enrollment.update({
        where: { id: enrollment.id },
        data: { 
          status: contact.status === 'UNSUBSCRIBED' ? 'UNSUBSCRIBED' : 'STOPPED',
          completedAt: new Date(),
          nextSendAt: null
        }
      });

      return { success: false, reason: 'Contact inactive' };
    }

    // Prepare contact data for token replacement
    const contactData = {
      firstName: contact.firstName || '',
      lastName: contact.lastName || '',
      email: contact.email,
      company: contact.company || '',
      fullName: [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.email
    };

    // Send the email
    const result = await sendEmail({
      to: contact.email,
      subject: currentStep.template.subject,
      htmlBody: currentStep.template.body,
      contactData,
      enrollmentId: enrollment.id,
      contactId: contact.id
    });

    if (result.success) {
      // Update the sent event with step information
      await prisma.event.updateMany({
        where: {
          enrollmentId: enrollment.id,
          emailId: result.emailId,
          type: 'SENT'
        },
        data: {
          details: JSON.stringify({
            to: contact.email,
            subject: currentStep.template.subject,
            messageId: result.messageId,
            response: result.response,
            stepOrder: enrollment.currentStep,
            stepLabel: currentStep.template.name || `Step ${enrollment.currentStep}`
          })
        }
      });

      // Calculate next step timing
      const nextStep = enrollment.currentStep + 1;
      const nextStepData = await prisma.sequenceStep.findFirst({
        where: { 
          sequenceId: sequence.id,
          stepOrder: nextStep,
          isActive: true
        }
      });

      let updateData = {
        lastSentStep: enrollment.currentStep // Track the step that was just sent
      };

      if (nextStepData) {
        // Schedule next step
        const nextSendAt = new Date();
        nextSendAt.setDate(nextSendAt.getDate() + nextStepData.delayDays);
        nextSendAt.setHours(nextSendAt.getHours() + nextStepData.delayHours);

        updateData = {
          ...updateData,
          currentStep: nextStep,
          nextSendAt
        };
      } else {
        // Sequence completed
        updateData = {
          ...updateData,
          status: 'COMPLETED',
          completedAt: new Date(),
          nextSendAt: null
        };
      }

      // Update enrollment
      await prisma.enrollment.update({
        where: { id: enrollment.id },
        data: updateData
      });

      console.log(`✅ Sequence email sent to ${contact.email} - Step ${enrollment.currentStep}`);
    }

    return result;

  } catch (error) {
    console.error('Error sending sequence email:', error);
    
    // Update enrollment with error
    try {
      await prisma.enrollment.update({
        where: { id: enrollment.id },
        data: { 
          status: 'STOPPED',
          completedAt: new Date(),
          nextSendAt: null
        }
      });
    } catch (updateError) {
      console.error('Failed to update enrollment after error:', updateError);
    }

    return { success: false, error: error.message };
  }
}

// Send test email
async function sendTestEmail(to, subject = 'Test Email', body = 'This is a test email from the Email Sequencing System.') {
  return await sendEmail({
    to,
    subject,
    htmlBody: `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Test Email</h2>
          <p>${body}</p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
          <p style="font-size: 12px; color: #666;">
            This is a test email from the Email Sequencing System.<br>
            Sent at: ${new Date().toISOString()}
          </p>
        </body>
      </html>
    `,
    textBody: `${body}\n\nThis is a test email from the Email Sequencing System.\nSent at: ${new Date().toISOString()}`
  });
}

module.exports = {
  sendEmail,
  sendSequenceEmail,
  sendTestEmail,
  verifyConnection,
  createTransporter
};
