const nodemailer = require('nodemailer');
const Imap = require('imap');
const { v4: uuidv4 } = require('uuid');
const { smtpConfig, emailConfig } = require('../config/smtp');
const { replaceTokens } = require('../utils/tokenReplace');
const prisma = require('../db/prismaClient');
const { broadcastRealTimeEvent } = require('../services/socketService');
const { calculateNextSendDate } = require('../utils/schedulerUtils');

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
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; color: #000; margin: 0; padding: 0;">
          <div style="padding: 10px 0;">
            ${enhanced}
          </div>
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
    const paragraphs = (typeof enhanced === 'string') ? enhanced.split('<br><br>') : [];
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

function appendUnsubscribeFooterToHtml(content, footerHtml) {
  if (!content || typeof content !== 'string') {
    return footerHtml;
  }

  const bodyCloseRegex = /<\/body\s*>/i;
  if (bodyCloseRegex.test(content)) {
    return content.replace(bodyCloseRegex, `${footerHtml}</body>`);
  }

  return `${content}${footerHtml}`;
}

function injectIntoBodyEnd(htmlContent, blockHtml) {
  if (!htmlContent || typeof htmlContent !== 'string') {
    return blockHtml;
  }

  const bodyCloseRegex = /<\/body\s*>/i;
  if (bodyCloseRegex.test(htmlContent)) {
    return htmlContent.replace(bodyCloseRegex, `${blockHtml}</body>`);
  }

  return `${htmlContent}${blockHtml}`;
}

// Create reusable transporter object using SMTP transport
let transporter = null;

function createTransporter(userConfig = null) {
  if (userConfig && userConfig.smtpHost) {
    return nodemailer.createTransport({
      host: userConfig.smtpHost,
      port: (typeof userConfig.smtpPort === 'string' ? parseInt(userConfig.smtpPort) : userConfig.smtpPort) || 465,
      secure: userConfig.smtpSecure ?? true,
      auth: {
        user: userConfig.smtpUser,
        pass: userConfig.smtpPassword
      },
      pool: true,
      maxConnections: 10,
      maxMessages: 100,
      connectionTimeout: 10000, // 10 seconds
      greetingTimeout: 10000,
      socketTimeout: 20000,
      tls: {
        rejectUnauthorized: false,
        servername: userConfig.smtpHost
      }
    });
  }

  if (!transporter) {
    transporter = nodemailer.createTransport(smtpConfig);
  }
  return transporter;
}

// Verify SMTP connection
async function verifyConnection(userConfig = null) {
  try {
    const transport = createTransporter(userConfig);
    await transport.verify();
    console.log('✅ SMTP connection verified successfully');
    return true;
  } catch (error) {
    console.error('❌ SMTP connection failed:', error.message);
    return false;
  }
}

// Verify SMTP connection with detailed error
async function verifyConnectionDetailed(userConfig = null) {
  try {
    const transport = createTransporter(userConfig);
    await transport.verify();
    return { success: true };
  } catch (error) {
    console.error('❌ SMTP verification detailed error:', error);
    let errorMessage = error.message || 'Unknown SMTP error';
    if (error.code === 'EAUTH') errorMessage = 'Authentication failed. Please check your username and password.';
    if (error.code === 'ECONNREFUSED') errorMessage = 'Connection refused. Check the Host and Port.';
    if (error.code === 'ETIMEDOUT') errorMessage = 'Connection timed out. Check your firewall or port.';

    return { success: false, error: errorMessage };
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

    return `${emailConfig.appUrl}/api/unsubscribe/${token}`;
  } catch (error) {
    console.error('Error generating unsubscribe token:', error);
    return `${emailConfig.appUrl}/api/unsubscribe/email`; // Fallback URL
  }
}

// Save sent email to IMAP Sent folder
async function saveToSentFolder(mailOptions, userConfig = null) {
  const imapHost = userConfig?.imapHost || process.env.IMAP_HOST;
  const imapUser = userConfig?.imapUser || process.env.IMAP_USER || userConfig?.smtpUser || process.env.SMTP_USER;
  const imapPass = userConfig?.imapPassword || process.env.IMAP_PASSWORD || userConfig?.smtpPassword || process.env.SMTP_PASS;

  if (!imapHost || !imapUser || !imapPass) {
    return; // IMAP not configured, skip
  }

  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: imapUser,
      password: imapPass,
      host: imapHost,
      port: (userConfig && userConfig.imapPort) ? userConfig.imapPort : (parseInt(process.env.IMAP_PORT) || 993),
      tls: userConfig?.imapTls !== undefined ? userConfig.imapTls : true,
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 5000,
      connTimeout: 10000
    });

    // Build valid RFC-822 raw email string
    const fromStr = mailOptions.from.name
      ? `"${mailOptions.from.name}" <${mailOptions.from.address}>`
      : mailOptions.from.address;

    // Construct headers array
    const headers = [
      `From: ${fromStr}`,
      `To: ${mailOptions.to}`,
      `Subject: ${mailOptions.subject}`,
      `Content-Type: text/html; charset=utf-8`,
      `Date: ${new Date().toUTCString()}`,
      `MIME-Version: 1.0`
    ];

    if (mailOptions.headers?.['Message-ID']) {
      headers.push(`Message-ID: ${mailOptions.headers['Message-ID']}`);
    }

    // Join headers with CRLF, then add TWO CRLFs before the body
    const rawEmail = headers.join('\r\n') + '\r\n\r\n' + (mailOptions.html || mailOptions.text || '');

    imap.once('ready', () => {
      // Try common Sent folder names
      const sentFolders = ['Sent', 'INBOX.Sent', 'Sent Messages', 'Sent Items'];

      const tryAppend = (index) => {
        if (index >= sentFolders.length) {
          imap.end();
          return reject(new Error('No Sent folder found'));
        }

        imap.append(rawEmail, { mailbox: sentFolders[index], flags: ['Seen'] }, (err) => {
          if (err) {
            console.warn(`⚠️ Failed to append to ${sentFolders[index]}:`, err.message);
            // Try next folder name
            tryAppend(index + 1);
          } else {
            console.log('📤 Email saved to Sent folder');
            imap.end();
            resolve();
          }
        });
      };

      tryAppend(0);
    });

    imap.once('error', (err) => {
      reject(err);
    });

    imap.connect();
  });
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
  campaignId = null,
  userConfig = null,
  inReplyTo = null,
  references = null
}) {
  try {
    const transport = createTransporter(userConfig);

    // CRITICAL LOGGING: Input validation
    console.log('📧 SENDMAIL INPUT VALIDATION');
    console.log('Sending email body length:', htmlBody?.length || 0);
    console.log('Sending email body type:', typeof htmlBody);
    console.log('To:', to);
    console.log('Has signature:', !!signature);

    // Replace tokens in subject and body (removeUnmatched: true so empty contact fields don't show raw tokens)
    const tokenOptions = { removeUnmatched: true };
    const processedSubject = replaceTokens(subject, contactData, tokenOptions);
    console.log(`📝 Final Processed Subject: "${processedSubject}"`);

    // Process email body
    let processedEmailBody = replaceTokens(htmlBody, contactData, tokenOptions);
    console.log(`📝 Body after token replacement length: ${processedEmailBody?.length || 0}`);

    const hasDocumentHtmlRaw = /<html[\s>]|<body[\s>]/i.test(processedEmailBody || '');
    const formattedBody = hasDocumentHtmlRaw
      ? processedEmailBody
      : processedEmailBody.replace(/\n/g, '<br>');
    console.log(`📝 Body after formatting length: ${formattedBody?.length || 0}`);

    // Process signature: replace tokens and convert line breaks to <br> tags
    const formattedSignature = signature && signature.trim() ?
      replaceTokens(signature, contactData, tokenOptions).replace(/\n/g, '<br>') : "";

    // Generate unsubscribe URL if contactId is provided (BEFORE creating HTML)
    let unsubscribeUrl = `${emailConfig.appUrl}/api/unsubscribe/email`;
    if (contactId) {
      console.log(`🔗 Generating unsubscribe token for contactId: ${contactId}`);
      unsubscribeUrl = await generateUnsubscribeToken(contactId);
      console.log(`🔗 Unsubscribe URL generated: ${unsubscribeUrl}`);
    } else {
      console.log(`⚠️ No contactId provided - using generic unsubscribe URL`);
    }

    const fromAddressForUnsub = userConfig?.fromEmail || emailConfig.from.address || 'sales@boostnow.in';
    const unsubscribeMailto = `mailto:${fromAddressForUnsub}?subject=unsubscribe`;

    // Old-style footer: small unsubscribe link only at the very bottom.
    const unsubscribeBlock = `
    <div style="margin-top: 24px; padding-top: 12px; border-top: 1px solid #d9d9d9;">
      <a href="${unsubscribeUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:8px 14px;border-radius:6px;font-size:12px;font-weight:600;">Unsubscribe</a>
    </div>
    `;

    console.log(`📧 Unsubscribe footer included in email (length: ${unsubscribeBlock.length} chars)`);

    const topUnsubscribeLine = `<div style="margin: 0 0 14px 0; padding: 8px 10px; border: 1px solid #d8d8d8; background: #fafafa; font-family: Arial, sans-serif; font-size: 13px; color: #111;"><strong>Manage preferences:</strong> <a href="${unsubscribeUrl}" target="_blank" rel="noopener noreferrer" style="color: #0b57d0; text-decoration: underline; font-weight: 600;">Unsubscribe</a></div>`;
    const signatureBlock = formattedSignature ? `<div style="margin-top: 20px;">${formattedSignature}</div>` : '';
    const appendBlock = `${signatureBlock}${unsubscribeBlock}`;

    const hasDocumentHtml = hasDocumentHtmlRaw;
    let fullEmailHtml;

    if (hasDocumentHtml) {
      // For full-document templates, insert near top; if <body> tag is missing, prepend to document.
      const withTop = /<body[^>]*>/i.test(formattedBody)
        ? formattedBody.replace(/<body[^>]*>/i, (match) => `${match}${topUnsubscribeLine}`)
        : `${topUnsubscribeLine}${formattedBody}`;
      fullEmailHtml = injectIntoBodyEnd(withTop, appendBlock);
    } else {
      const contentWithSignature = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.5; color: #000; text-align: left;">
          ${topUnsubscribeLine}
          ${formattedBody}
          ${appendBlock}
        </div>
      `;

      fullEmailHtml = appendUnsubscribeFooterToHtml(contentWithSignature, '');
    }

    console.log(`📝 Full final HTML length: ${fullEmailHtml?.length || 0}`);
    console.log(`✅ UNSUBSCRIBE FOOTER INCLUDED: ${unsubscribeBlock ? 'YES' : 'NO'}`);
    
    // Log a snippet of the footer to verify it's there
    if (unsubscribeBlock && /unsubscribe/i.test(unsubscribeBlock)) {
      console.log('✅ Footer contains unsubscribe link text');
    } else {
      console.log('❌ Footer missing unsubscribe link text!');
    }

    let processedHtmlBody = fullEmailHtml;
    let processedTextBody = textBody ?
      replaceTokens(textBody, contactData, tokenOptions) :
      generateTextFromHtml(processedHtmlBody);

    // Final fallback: always append a raw unsubscribe line at absolute end.
    // This protects against template/body parsing quirks in some mail clients.
    const rawUnsubscribeTail = `<div style="margin-top:10px;font-size:11px;color:#777;"><a href="${unsubscribeUrl}" target="_blank" rel="noopener noreferrer" style="color:#5d7ea5;text-decoration:underline;">Unsubscribe</a></div>`;
    processedHtmlBody = `${processedHtmlBody}${rawUnsubscribeTail}`;

    processedTextBody = `${processedTextBody}\n\nUnsubscribe: ${unsubscribeUrl}`;

    // Generate unique Message-ID for tracking
    const fromName = userConfig?.fromName || emailConfig.from.name || 'Sales';
    const fromAddress = userConfig?.fromEmail || emailConfig.from.address || 'sales@boostnow.in';
    const fromDomain = (fromAddress && typeof fromAddress === 'string' && fromAddress.includes('@'))
      ? fromAddress.split('@')[1].trim()
      : 'boostnow.in';
    const messageId = `<${uuidv4()}@${fromDomain}>`;

    // Add tracking pixel to HTML body if enrollmentId is provided
    // MOVED to bottom to avoid early detection by tab filters
    if (enrollmentId && processedHtmlBody) {
      const trackingPixel = `<img src="${emailConfig.appUrl}/api/track/open?emailId=${encodeURIComponent(messageId)}" width="1" height="1" style="display:none !important;" alt="" />`;
      processedHtmlBody = processedHtmlBody + trackingPixel;
    }

    // Prepare email options
    const mailOptions = {
      from: {
        name: fromName,
        address: fromAddress
      },
      to: to,
      subject: processedSubject,
      html: processedHtmlBody,
      text: processedTextBody,
      replyTo: fromAddress,
      priority: 'normal',
      headers: {
        'Message-ID': messageId,
        'List-Unsubscribe': `<${unsubscribeMailto}>, <${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        'List-ID': `BoostNow Mailer <${fromDomain}>`,
        'X-Priority': '3 (Normal)',
        'Importance': 'Normal',
        // Anti-Promotion/Update tab headers
        'X-Entity-Ref-ID': uuidv4(),
        'X-Auto-Response-Suppress': 'OOF, AutoReply',
        'Precedence': 'personal'
      }
    };

    if (inReplyTo) {
      mailOptions.inReplyTo = inReplyTo;
      mailOptions.headers['In-Reply-To'] = inReplyTo;
    }

    if (references) {
      mailOptions.references = references;
      mailOptions.headers['References'] = references;
    }

    // Add bounce handling
    const bounceAddr = userConfig?.fromEmail || emailConfig.bounceAddress;
    if (bounceAddr) {
      mailOptions.envelope = {
        from: bounceAddr,
        to: [to]
      };
    }

    // CRITICAL SAFEGUARD: Ensure single email send
    console.log('🚀 SENDING EMAIL - Single sendMail call');
    console.log('Final payload HTML length:', mailOptions.html?.length || 0);
    console.log('Final payload text length:', mailOptions.text?.length || 0);
    console.log('Recipient:', mailOptions.to);
    console.log('Subject:', mailOptions.subject);
    
    // Verify footer is in the HTML
    const footerInPayload = /unsubscribe/i.test(mailOptions.html || '');
    console.log(`📧 Footer in payload: ${footerInPayload ? '✅ YES' : '❌ NO'}`);
    const unsubscribeUrlInPayload = (mailOptions.html || '').includes(unsubscribeUrl);
    console.log(`📧 Unsubscribe URL in payload: ${unsubscribeUrlInPayload ? '✅ YES' : '❌ NO'}`);
    
    // Show last 300 characters to see if footer is there
    if (mailOptions.html && mailOptions.html.length > 300) {
      console.log(`📧 Last 300 chars of HTML:\n${mailOptions.html.substring(mailOptions.html.length - 300)}`);
    }

    // Send email - THIS IS THE ONLY SENDMAIL CALL PER SEQUENCE STEP
    console.log(`📤 INITIATING SENDMAIL TO: ${to} VIA ${mailOptions.from.address}`);
    const info = await transport.sendMail(mailOptions);

    // DELIVERY CONFIRMATION
    console.log('✅ EMAIL DELIVERY CONFIRMED BY SMTP SERVER');
    console.log(`📧 Status: ${info.response}`);
    console.log(`Message ID: ${info.messageId}`);
    console.log(`Accepted: ${info.accepted.join(', ')}`);
    if (info.rejected.length > 0) {
      console.log(`❌ Rejected: ${info.rejected.join(', ')}`);
    }
    console.log('--- END OF SEND_EMAIL LOG ---');

    // Save to IMAP Sent folder (async, non-blocking)
    saveToSentFolder(mailOptions, userConfig).catch(err => {
      console.log('⚠️ Could not save to Sent folder:', err.message);
    });

    // Log sent event if enrollment provided
    if (enrollmentId && contactId) {
      await prisma.event.create({
        data: {
          enrollmentId,
          contactId,
          campaignId,
          type: 'SENT',
          emailId: messageId,
          details: JSON.stringify({
            to,
            subject: processedSubject,
            messageId: info.messageId,
            response: info.response,
            replyTo: mailOptions.replyTo,
            sentFrom: mailOptions.from.address,
            provider: userConfig?.smtpHost || 'fallback'
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
                email: true,
                smtpHost: true,
                smtpPort: true,
                smtpSecure: true,
                smtpUser: true,
                smtpPass: true,
                fromEmail: true,
                fromName: true,
                imapHost: true,
                imapPort: true,
                emailConfig: true
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

    // Check for previous step's Message-ID for threading (if Step > 1)
    let threadHeaders = {};
    if (enrollment.currentStep > 1) {
      try {
        const lastSentEvent = await prisma.event.findFirst({
          where: {
            enrollmentId: enrollment.id,
            type: 'SENT'
          },
          orderBy: { timestamp: 'desc' }
        });

        if (lastSentEvent && lastSentEvent.emailId) {
          threadHeaders = {
            inReplyTo: lastSentEvent.emailId,
            references: lastSentEvent.emailId
          };
          console.log(`🧵 Threading Step ${enrollment.currentStep} with previous Message-ID: ${lastSentEvent.emailId}`);
        }
      } catch (err) {
        console.warn('⚠️ Could not fetch previous message for threading:', err.message);
      }
    }

    // Send the email
    const result = await sendEmail({
      to: contact.email,
      subject: emailSubject,
      htmlBody: emailBody,
      contactData,
      enrollmentId: enrollment.id,
      contactId: contact.id,
      signature: userSignature,
      campaignId: fullEnrollment.campaignId, // Pass campaign ID for tracking
      userConfig: sequence.user?.emailConfig || sequence.user || null,
      ...threadHeaders
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
        // Schedule next step using custom logic
        const nextSendAt = calculateNextSendDate(nextStepData);

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
async function sendTestEmail(to, subject = 'Test Email', body = 'This is a test email from the Email Sequencing System.', userConfig = null, contactId = null) {
  return await sendEmail({
    to,
    subject,
    userConfig,
    contactId: contactId || null, // Pass contactId if available, will still show unsubscribe footer
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
  verifyConnectionDetailed,
  createTransporter
};
