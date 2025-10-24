const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const { smtpConfig, emailConfig } = require('../config/smtp');
const { replaceTokens } = require('../utils/tokenReplace');
const prisma = require('../db/prismaClient');
const { broadcastRealTimeEvent } = require('../services/socketService');

// Enhanced HTML formatting function
function enhanceHtmlFormatting(htmlContent) {
  if (!htmlContent || typeof htmlContent !== 'string') {
    return htmlContent;
  }

  let enhanced = htmlContent;

  // If content doesn't have basic HTML structure, wrap it
  if (!enhanced.includes('<html') && !enhanced.includes('<body')) {
    enhanced = `
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Email</title>
        </head>
        <body style="font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          ${enhanced}
        </body>
      </html>
    `;
  }

  // Ensure proper paragraph spacing
  enhanced = enhanced.replace(/\n\n/g, '</p><p>');
  
  // Convert single line breaks to <br> tags if not already HTML
  if (!enhanced.includes('<br') && !enhanced.includes('<p>')) {
    enhanced = enhanced.replace(/\n/g, '<br>');
  }

  // Ensure paragraphs are properly wrapped
  if (!enhanced.includes('<p>') && enhanced.includes('<br>')) {
    // Wrap content in paragraphs, splitting on double breaks
    const paragraphs = enhanced.split('<br><br>');
    enhanced = paragraphs.map(p => p.trim() ? `<p>${p.replace(/<br>/g, '<br>')}</p>` : '').join('');
  }

  // Add basic styling for common elements if not present
  if (!enhanced.includes('style=') && !enhanced.includes('<style>')) {
    enhanced = enhanced.replace(/<h1>/g, '<h1 style="color: #2c3e50; margin-bottom: 20px;">');
    enhanced = enhanced.replace(/<h2>/g, '<h2 style="color: #34495e; margin-bottom: 15px;">');
    enhanced = enhanced.replace(/<h3>/g, '<h3 style="color: #34495e; margin-bottom: 10px;">');
    enhanced = enhanced.replace(/<p>/g, '<p style="margin-bottom: 15px;">');
    enhanced = enhanced.replace(/<ul>/g, '<ul style="margin-bottom: 15px; padding-left: 20px;">');
    enhanced = enhanced.replace(/<ol>/g, '<ol style="margin-bottom: 15px; padding-left: 20px;">');
    enhanced = enhanced.replace(/<li>/g, '<li style="margin-bottom: 5px;">');
  }

  return enhanced;
}

// Generate plain text version from HTML content
function generateTextFromHtml(htmlContent) {
  if (!htmlContent || typeof htmlContent !== 'string') {
    return '';
  }

  let text = htmlContent;

  // Remove HTML tags and convert to plain text
  text = text
    // Convert headings to uppercase with line breaks
    .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '\n\n$1\n' + '='.repeat(50) + '\n')
    // Convert paragraphs to line breaks
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
    // Convert line breaks
    .replace(/<br[^>]*>/gi, '\n')
    // Convert list items
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '• $1\n')
    // Remove all other HTML tags
    .replace(/<[^>]*>/g, '')
    // Decode HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Clean up multiple line breaks
    .replace(/\n{3,}/g, '\n\n')
    // Trim whitespace
    .trim();

  return text;
}

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
  contactId = null,
  signature = null,
  campaignId = null
}) {
  try {
    const transport = createTransporter();
    
    // CRITICAL LOGGING: Input validation
    console.log('📧 SENDMAIL INPUT VALIDATION');
    console.log('Sending email body length:', htmlBody?.length || 0);
    console.log('Sending email body type:', typeof htmlBody);
    console.log('To:', to);
    console.log('Has signature:', !!signature);
    
    // Replace tokens in subject and body
    const processedSubject = replaceTokens(subject, contactData);
    
    // Process email body: replace tokens and convert line breaks to <br> tags
    let processedEmailBody = replaceTokens(htmlBody, contactData);
    console.log('After token replacement - body length:', processedEmailBody?.length || 0);
    
    const formattedBody = processedEmailBody.replace(/\n/g, '<br>');
    console.log('After line break conversion - body length:', formattedBody?.length || 0);
    
    // Process signature: replace tokens and convert line breaks to <br> tags
    const formattedSignature = signature && signature.trim() ? 
      replaceTokens(signature, contactData).replace(/\n/g, '<br>') : "";
    
    // Generate final email HTML with proper left alignment and structure
    const fullEmailHtml = `
      <div style="text-align:left; font-family:Arial, sans-serif; line-height:1.6; padding: 16px; max-width: 600px;">
        ${formattedBody}
        ${formattedSignature ? `<br><br>${formattedSignature}` : ''}
      </div>
    `;
    
    console.log('Final email HTML length:', fullEmailHtml?.length || 0);
    console.log('Final email contains signature:', fullEmailHtml.includes(formattedSignature));
    
    let processedHtmlBody = fullEmailHtml;
    
    // Generate text version from HTML if not provided (signature is already included in processedHtmlBody)
    let processedTextBody = textBody ? 
      replaceTokens(textBody, contactData) : 
      generateTextFromHtml(processedHtmlBody);

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

    // CRITICAL SAFEGUARD: Ensure single email send
    console.log('🚀 SENDING EMAIL - Single sendMail call');
    console.log('Final payload HTML length:', mailOptions.html?.length || 0);
    console.log('Final payload text length:', mailOptions.text?.length || 0);
    console.log('Recipient:', mailOptions.to);
    console.log('Subject:', mailOptions.subject);
    
    // Send email - THIS IS THE ONLY SENDMAIL CALL PER SEQUENCE STEP
    const info = await transport.sendMail(mailOptions);
    
    // DELIVERY CONFIRMATION
    console.log('✅ EMAIL DELIVERY CONFIRMED');
    console.log(`📧 Email sent successfully to ${to}`);
    console.log(`Message ID: ${info.messageId}`);
    console.log('Response:', info.response);
    console.log('Exactly ONE email sent for this sequence step');

    // Log sent event if enrollment provided
    if (enrollmentId && contactId) {
      await prisma.event.create({
        data: {
          enrollmentId,
          contactId,
          campaignId, // Include campaign ID for tracking
          type: 'SENT',
          emailId: messageId,
          details: JSON.stringify({
            to,
            subject: processedSubject,
            messageId: info.messageId,
            response: info.response,
            replyTo: emailConfig.replyTo || emailConfig.from.address,
            sentFrom: emailConfig.from.address
          })
        }
      });

      // Broadcast real-time event via socket
      broadcastRealTimeEvent({
        type: 'SENT',
        campaignId,
        contactId,
        enrollmentId,
        to,
        subject: processedSubject,
        timestamp: new Date().toISOString()
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
            campaignId, // Include campaign ID for tracking
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
            },
            user: {
              select: {
                id: true,
                signature: true,
                firstName: true,
                lastName: true,
                email: true
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

    if (!currentStep) {
      throw new Error('No step configuration found for current step');
    }

    // Check if step has template or custom content
    if (!currentStep.template && (!currentStep.subject || !currentStep.body)) {
      throw new Error('Step must have either a template or custom subject and body');
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
      companyName: contact.company || '', // Alias for company
      fullName: [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.email,
      // Additional computed fields
      firstNameCapitalized: contact.firstName ? contact.firstName.charAt(0).toUpperCase() + contact.firstName.slice(1).toLowerCase() : '',
      lastNameCapitalized: contact.lastName ? contact.lastName.charAt(0).toUpperCase() + contact.lastName.slice(1).toLowerCase() : '',
      fullNameCapitalized: [
        contact.firstName ? contact.firstName.charAt(0).toUpperCase() + contact.firstName.slice(1).toLowerCase() : '',
        contact.lastName ? contact.lastName.charAt(0).toUpperCase() + contact.lastName.slice(1).toLowerCase() : ''
      ].filter(Boolean).join(' ') || contact.email,
      // Date/time tokens
      currentDate: new Date().toLocaleDateString(),
      currentTime: new Date().toLocaleTimeString(),
      currentYear: new Date().getFullYear().toString()
    };

    // Determine email content (template or custom)
    const emailSubject = currentStep.subject || currentStep.template?.subject;
    const emailBody = currentStep.body || currentStep.template?.body;

    // CRITICAL LOGGING: Validate email body integrity
    console.log('🔍 EMAIL BODY VALIDATION - Step', enrollment.currentStep);
    console.log('DB retrieved email body length:', emailBody?.length || 0);
    console.log('DB retrieved email body type:', typeof emailBody);
    console.log('Has custom body:', !!currentStep.body);
    console.log('Has template body:', !!currentStep.template?.body);
    console.log('Email body source:', currentStep.body ? 'Custom Step' : 'Template');
    
    if (emailBody && emailBody.length > 100) {
      console.log('Email body preview (first 100 chars):', emailBody.substring(0, 100) + '...');
      console.log('Email body preview (last 100 chars):', '...' + emailBody.substring(emailBody.length - 100));
    } else {
      console.log('Full email body:', emailBody);
    }

    if (!emailSubject || !emailBody) {
      throw new Error('Email subject and body are required');
    }

    // Get user signature (if sequence has an owner)
    const userSignature = sequence.user?.signature || null;

    // Send the email
    const result = await sendEmail({
      to: contact.email,
      subject: emailSubject,
      htmlBody: emailBody,
      contactData,
      enrollmentId: enrollment.id,
      contactId: contact.id,
      signature: userSignature,
      campaignId: fullEnrollment.campaignId // Pass campaign ID for tracking
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
            subject: emailSubject?.substring(0, 200) || '', // Limit subject length for JSON safety
            messageId: result.messageId,
            response: result.response,
            stepOrder: enrollment.currentStep,
            stepLabel: currentStep.template?.name || `Step ${enrollment.currentStep}`,
            isCustomEmail: !currentStep.template,
            bodyLength: emailBody?.length || 0, // Track body length instead of full content
            hasSignature: !!userSignature
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
