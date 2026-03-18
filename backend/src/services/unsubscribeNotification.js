const nodemailer = require('nodemailer');
const { smtpConfig, emailConfig } = require('../config/smtp');

// Create a transporter for sending emails
let transporter = null;

const initTransporter = (smtpSettings = null) => {
  if (smtpSettings && smtpSettings.smtpHost && smtpSettings.smtpUser && smtpSettings.smtpPassword) {
    return nodemailer.createTransport({
      host: smtpSettings.smtpHost,
      port: smtpSettings.smtpPort || 465,
      secure: smtpSettings.smtpSecure !== false,
      auth: {
        user: smtpSettings.smtpUser,
        pass: smtpSettings.smtpPassword
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  }

  if (!transporter && smtpConfig.auth.user && smtpConfig.auth.pass) {
    transporter = nodemailer.createTransport(smtpConfig);
  }
  return transporter;
};

/**
 * Send unsubscribe notification email to the user who created the sequence
 */
const sendUnsubscribeNotification = async ({
  recipientEmail,
  contactEmail,
  contactName,
  sequenceName,
  reason,
  unsubscribedAt,
  smtpSettings = null
}) => {
  try {
    const mailer = initTransporter(smtpSettings);
    
    if (!mailer) {
      console.warn('⚠️ Email transporter not configured, skipping notification');
      return null;
    }

    if (!recipientEmail) {
      console.warn('⚠️ No recipient email provided for unsubscribe notification');
      return null;
    }

    const formattedDate = new Date(unsubscribedAt).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0; font-size: 24px;">Contact Unsubscribed</h2>
        </div>
        
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e0e0e0;">
          <p style="margin-top: 0; font-size: 16px;">
            A recipient has unsubscribed from one of your email sequences.
          </p>

          <div style="background: white; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #667eea;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 0; font-weight: bold; color: #666; width: 120px;">Contact:</td>
                <td style="padding: 10px 0;">
                  <strong>${contactName}</strong><br>
                  <span style="color: #666; font-size: 14px;">${contactEmail}</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: bold; color: #666;">Sequence:</td>
                <td style="padding: 10px 0;">${sequenceName}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: bold; color: #666;">Reason:</td>
                <td style="padding: 10px 0; font-style: italic; color: #555;">"${reason}"</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: bold; color: #666;">Unsubscribed:</td>
                <td style="padding: 10px 0;">${formattedDate}</td>
              </tr>
            </table>
          </div>

          <div style="background: #fff3cd; padding: 15px; border-radius: 6px; border-left: 4px solid #ffc107; margin: 20px 0;">
            <p style="margin: 0; color: #856404; font-size: 14px;">
              <strong>Note:</strong> Understanding unsubscribe reasons can help you improve your email engagement and content strategy.
            </p>
          </div>

          <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 12px;">
            <p style="margin: 5px 0;">
              This is an automated notification from your Email Sequencing System.
            </p>
            <p style="margin: 5px 0;">
              Check your dashboard to view all unsubscribe activity and trends.
            </p>
          </div>
        </div>
      </div>
    `;

    const textContent = `
Contact Unsubscribed

A recipient has unsubscribed from one of your email sequences.

Contact: ${contactName} <${contactEmail}>
Sequence: ${sequenceName}
Reason: "${reason}"
Unsubscribed: ${formattedDate}

This is an automated notification from your Email Sequencing System.
    `.trim();

    const mailOptions = {
      from: smtpSettings?.fromEmail
        ? {
            name: smtpSettings.fromName || emailConfig.from.name,
            address: smtpSettings.fromEmail
          }
        : emailConfig.from,
      to: recipientEmail,
      subject: `⚠️ Contact Unsubscribed: ${contactName} from "${sequenceName}"`,
      html: htmlContent,
      text: textContent,
      replyTo: smtpSettings?.fromEmail || emailConfig.replyTo || emailConfig.from.address
    };

    const result = await mailer.sendMail(mailOptions);
    
    console.log(`✅ Unsubscribe notification sent to ${recipientEmail}`);
    return result;

  } catch (error) {
    console.error('❌ Failed to send unsubscribe notification:', error.message);
    // Don't throw - notifications are optional
    return null;
  }
};

module.exports = {
  sendUnsubscribeNotification,
  initTransporter
};
