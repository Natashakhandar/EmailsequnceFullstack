const Imap = require('imap');
const { simpleParser } = require('mailparser');
const prisma = require('../db/prismaClient');

class EmailMonitorService {
  constructor() {
    this.imap = null;
    this.isConnected = false;
    this.config = {
      user: process.env.IMAP_USER || process.env.SMTP_USER,
      password: process.env.IMAP_PASSWORD || process.env.SMTP_PASS,
      host: process.env.IMAP_HOST || process.env.SMTP_HOST,
      port: parseInt(process.env.IMAP_PORT) || 993,
      tls: process.env.IMAP_TLS !== 'false',
      authTimeout: 3000,
      connTimeout: 10000,
      tlsOptions: {
        rejectUnauthorized: false
      }
    };
  }

  // Connect to IMAP server
  async connect() {
    return new Promise((resolve, reject) => {
      if (this.isConnected) {
        return resolve();
      }

      console.log('📧 Connecting to IMAP server...');

      this.imap = new Imap(this.config);

      this.imap.once('ready', () => {
        console.log('✅ IMAP connection established');
        this.isConnected = true;
        resolve();
      });

      this.imap.once('error', (err) => {
        console.error('❌ IMAP connection error:', err.message);
        this.isConnected = false;
        reject(err);
      });

      this.imap.once('end', () => {
        console.log('📪 IMAP connection ended');
        this.isConnected = false;
      });

      try {
        this.imap.connect();
      } catch (error) {
        reject(error);
      }
    });
  }

  // Disconnect from IMAP server
  disconnect() {
    if (this.imap && this.isConnected) {
      this.imap.end();
      this.isConnected = false;
    }
  }

  // Fetch recent emails from inbox
  async fetchRecentEmails(days = 7) {
    try {
      await this.connect();

      return new Promise((resolve, reject) => {
        this.imap.openBox('INBOX', true, (err, box) => {
          if (err) {
            return reject(err);
          }

          // Search for emails from the last X days
          const since = new Date();
          since.setDate(since.getDate() - days);
          // Search for all emails from the last X days, not just unseen 
          // (otherwise it misses replies the user quickly read manually)
          this.imap.search([['SINCE', since]], (err, results) => {
            if (err) {
              return reject(err);
            }

            if (!results || results.length === 0) {
              console.log('📭 No new emails found');
              return resolve([]);
            }

            console.log(`📬 Found ${results.length} new emails`);

            const parsePromises = [];
            const fetch = this.imap.fetch(results, { bodies: '' });

            fetch.on('message', (msg, seqno) => {
              let emailData = { seqno };

              msg.on('body', (stream, info) => {
                let buffer = '';
                stream.on('data', (chunk) => {
                  buffer += chunk.toString('utf8');
                });

                stream.once('end', () => {
                  const p = simpleParser(buffer).then(parsed => {
                    emailData.parsed = parsed;
                    return emailData;
                  }).catch(parseErr => {
                    console.error('❌ Error parsing email:', parseErr);
                    return null;
                  });
                  parsePromises.push(p);
                });
              });

              msg.once('attributes', (attrs) => {
                emailData.attrs = attrs;
              });
            });

            fetch.once('error', (err) => {
              reject(err);
            });

            fetch.once('end', () => {
              Promise.all(parsePromises).then(results => {
                resolve(results.filter(Boolean));
              });
            });
          });
        });
      });
    } catch (error) {
      console.error('❌ Error fetching emails:', error);
      throw error;
    }
  }

  // Check if an email is a reply to our sent emails
  async isReplyToOurEmail(email) {
    try {
      const parsed = email.parsed;

      // Check various reply indicators
      const subject = parsed.subject || '';
      const inReplyTo = parsed.inReplyTo || '';
      const references = parsed.references || [];

      // Look for our email IDs in the references or in-reply-to headers
      if (inReplyTo) {
        const sentEvent = await prisma.event.findFirst({
          where: {
            emailId: inReplyTo,
            type: 'SENT'
          },
          include: {
            contact: true,
            enrollment: {
              include: {
                sequence: true
              }
            }
          }
        });

        if (sentEvent) {
          return { isReply: true, originalEvent: sentEvent };
        }
      }

      // Check references array
      for (const ref of references) {
        const sentEvent = await prisma.event.findFirst({
          where: {
            emailId: ref,
            type: 'SENT'
          },
          include: {
            contact: true,
            enrollment: {
              include: {
                sequence: true
              }
            }
          }
        });

        if (sentEvent) {
          return { isReply: true, originalEvent: sentEvent };
        }
      }

      // Check if sender email matches any of our contacts
      const fromEmail = parsed.from?.value?.[0]?.address || parsed.from?.text;
      if (fromEmail) {
        const contact = await prisma.contact.findFirst({
          where: {
            email: fromEmail
          }
        });

        if (contact) {
          // Find the most recent sent email to this contact
          const recentSentEvent = await prisma.event.findFirst({
            where: {
              contactId: contact.id,
              type: 'SENT'
            },
            orderBy: {
              timestamp: 'desc'
            },
            include: {
              contact: true,
              enrollment: {
                include: {
                  sequence: true
                }
              }
            }
          });

          if (recentSentEvent) {
            return { isReply: true, originalEvent: recentSentEvent };
          }
        }
      }

      return { isReply: false };
    } catch (error) {
      console.error('❌ Error checking if email is reply:', error);
      return { isReply: false };
    }
  }

  // Sanitize text content for safe JSON storage
  sanitizeForJson(text) {
    if (!text) return '';

    // Convert to string if not already
    let sanitized = String(text);

    // Remove control characters (0x00-0x1F and 0x7F-0x9F) except newlines and tabs
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');

    // Convert literal \n strings to actual newlines (in case they exist)
    sanitized = sanitized.replace(/\\n/g, '\n');

    // Remove email quote markers (>) at the start of lines
    sanitized = sanitized.split('\n').map(line => line.replace(/^>\s*/, '')).join('\n');

    // Normalize line endings
    sanitized = sanitized.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Remove excessive newlines (more than 2 consecutive)
    sanitized = sanitized.replace(/\n{3,}/g, '\n\n');

    // Trim whitespace
    sanitized = sanitized.trim();

    // Limit length to prevent oversized JSON (5000 chars for body content)
    if (sanitized.length > 5000) {
      sanitized = sanitized.substring(0, 5000) + '... [truncated]';
    }

    return sanitized;
  }

  // Process and store reply emails
  async processReplyEmails() {
    try {
      console.log('🔍 Checking for new reply emails...');

      const emails = await this.fetchRecentEmails();
      let processedCount = 0;

      for (const email of emails) {
        const replyCheck = await this.isReplyToOurEmail(email);

        if (replyCheck.isReply && replyCheck.originalEvent) {
          const parsed = email.parsed;
          const originalEvent = replyCheck.originalEvent;

          // Check if we already have this reply
          const existingReply = await prisma.event.findFirst({
            where: {
              emailId: originalEvent.emailId,
              type: 'REPLIED'
            }
          });

          if (!existingReply) {
            // Sanitize email content before storing
            const replyBody = this.sanitizeForJson(parsed.text || parsed.html || 'No content');
            const replySubject = this.sanitizeForJson(parsed.subject || 'No Subject');
            const replyFrom = this.sanitizeForJson(
              parsed.from?.value?.[0]?.address || parsed.from?.text || 'Unknown'
            );

            // Create a new REPLIED event with the actual email content
            await prisma.event.create({
              data: {
                enrollmentId: originalEvent.enrollmentId,
                contactId: originalEvent.contactId,
                campaignId: originalEvent.campaignId,
                type: 'REPLIED',
                emailId: originalEvent.emailId,
                details: JSON.stringify({
                  repliedAt: parsed.date || new Date().toISOString(),
                  replySubject: replySubject,
                  replyBody: replyBody,
                  replyFrom: replyFrom,
                  messageId: parsed.messageId || '',
                  inReplyTo: parsed.inReplyTo || '',
                  source: 'imap_monitoring',
                  attachments: parsed.attachments?.length || 0
                })
              }
            });

            console.log(`✅ Stored reply from ${parsed.from?.text} for email ${originalEvent.emailId}`);
            processedCount++;

            // Update enrollment status to STOPPED since they replied
            await prisma.enrollment.update({
              where: { id: originalEvent.enrollmentId },
              data: {
                status: 'STOPPED',
                completedAt: new Date(),
                nextSendAt: null
              }
            });
          }
        }
      }

      console.log(`📊 Processed ${processedCount} new replies`);
      return processedCount;

    } catch (error) {
      console.error('❌ Error processing reply emails:', error);
      throw error;
    } finally {
      this.disconnect();
    }
  }

  // Test IMAP connection
  async testConnection() {
    try {
      await this.connect();
      console.log('✅ IMAP connection test successful');
      this.disconnect();
      return true;
    } catch (error) {
      console.error('❌ IMAP connection test failed:', error.message);
      return false;
    }
  }
}

module.exports = EmailMonitorService;
