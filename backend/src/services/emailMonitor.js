const Imap = require('imap');
const { simpleParser } = require('mailparser');
const prisma = require('../db/prismaClient');
const { broadcastRealTimeEvent } = require('./socketService');

class EmailMonitorService {
  constructor(userConfig = null) {
    this.imap = null;
    this.isConnected = false;

    // Config derivation
    const host = userConfig?.imapHost || process.env.IMAP_HOST || process.env.SMTP_HOST;
    const user = userConfig?.imapUser || userConfig?.smtpUser || process.env.IMAP_USER || process.env.SMTP_USER;
    const password = userConfig?.imapPassword || userConfig?.smtpPassword || process.env.IMAP_PASSWORD || process.env.SMTP_PASS;
    const port = (userConfig && userConfig.imapPort) ? userConfig.imapPort : (parseInt(process.env.IMAP_PORT) || 993);
    const tls = userConfig?.imapTls !== undefined ? userConfig.imapTls : (process.env.IMAP_TLS !== 'false');

    this.config = {
      user,
      password,
      host,
      port,
      tls,
      authTimeout: 15000,
      connTimeout: 20000,
      tlsOptions: {
        rejectUnauthorized: false,
        servername: host
      },
      debug: console.log // Temporary debug logging
    };

    console.log(`📡 IMAP Service config for user: ${user} on host: ${host}:${port} (TLS: ${tls})`);
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
        console.error('IMAP connection error:', err.message);
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
      const subject = (parsed.subject || '').toLowerCase();
      const fromEmail = (parsed.from?.value?.[0]?.address || parsed.from?.text || '').toLowerCase();

      // 1. FILTER: Ignore common automated emails, but KEEP potential bounces
      const ignorePrefixes = [
        'read:', 'delivered:', 'auto:', 'out of office',
        'automatic reply'
      ];

      // Bounce signals (we'll handle these separately)
      const bounceKeywords = [
        'undeliverable:', 'undelivered mail', 'delivery status notification', 
        'failure notice', 'returned mail', 'mail delivery failed', 
        'bounced', 'mailbox full', 'blocked', 'rejected', 'delivery failure',
        'non-delivery', 'not delivered', 'not reached', 'could not be delivered',
        'delivery has failed', 'diagnostic-code', 'failure report', 'permanent failure'
      ];
      
      const isPotentialBounce = bounceKeywords.some(kw => subject.includes(kw)) || 
                                fromEmail.includes('mailer-daemon') || 
                                fromEmail.includes('postmaster') ||
                                fromEmail.includes('mta') ||
                                fromEmail.includes('relay') ||
                                !!parsed.headers?.['x-failed-recipients'] ||
                                !!parsed.headers?.['x-failed-recipient'];

      if (isPotentialBounce) {
        console.log(`🚩 Potential bounce detected: "${subject}" from ${fromEmail}`);
        console.log(`   Headers - In-Reply-To: ${parsed.inReplyTo || 'None'}, References: ${Array.isArray(parsed.references) ? parsed.references.join(', ') : (parsed.references || 'None')}`);
      }

      if (!isPotentialBounce && ignorePrefixes.some(prefix => subject.startsWith(prefix))) {
        return { isReply: false, reason: 'automated_system_email' };
      }

      const inReplyTo = parsed.inReplyTo || '';
      const references = Array.isArray(parsed.references) ? parsed.references : (parsed.references ? [parsed.references] : []);

      // 2. HEADER MATCH: Look for our email Message-IDs
      const allHeaders = [inReplyTo, ...references].filter(Boolean);

      if (allHeaders.length > 0) {
        const sentEvent = await prisma.event.findFirst({
          where: {
            emailId: { in: allHeaders },
            type: 'SENT'
          },
          include: {
            contact: true,
            enrollment: { include: { sequence: true } }
          }
        });

        if (sentEvent) {
          console.log(`🔗 Matched via Header Message-ID: ${sentEvent.emailId}`);
          return { 
            isReply: true, 
            type: isPotentialBounce ? 'BOUNCED' : 'REPLIED',
            originalEvent: sentEvent 
          };
        } else {
          console.log(`ℹ️ Header match attempted with ${allHeaders.length} IDs but no SENT event found in DB.`);
        }
      }

      // 3. BODY MATCH: Look for our email Message-IDs inside the text (common for bounces)
      const body = (parsed.text || parsed.html || '').toLowerCase();
      // Regex to find Message-IDs like <uuid@domain.com> or just the uuid part
      const messageIdRegex = /<?([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}@[a-z0-9.-]+)>?/gi;
      const foundIdsInBody = body.match(messageIdRegex) || [];
      
      if (foundIdsInBody.length > 0) {
        const bodyMatchEvent = await prisma.event.findFirst({
          where: {
            emailId: { in: foundIdsInBody },
            type: 'SENT'
          },
          include: {
            contact: true,
            enrollment: { include: { sequence: true } }
          }
        });

        if (bodyMatchEvent) {
          console.log(`🔗 Matched via Body Message-ID: ${bodyMatchEvent.emailId}`);
          return { 
            isReply: true, 
            type: isPotentialBounce ? 'BOUNCED' : 'REPLIED',
            originalEvent: bodyMatchEvent 
          };
        }
      }

      // 4. FALLBACK: Match by contact and timing if it LOOKS like a reply
      const replyDate = parsed.date ? new Date(parsed.date) : new Date();
      const bounceData = isPotentialBounce ? this.extractBounceRecipient(parsed) : null;
      if (isPotentialBounce) {
        console.log(`🔍 Bounce extraction result: ${bounceData ? `Recipient: ${bounceData.recipient}, Reason: ${bounceData.reason}` : 'FAILED to extract recipient'}`);
      }
      const targetEmail = bounceData ? bounceData.recipient : fromEmail;

      if (targetEmail) {
        // Only consider it a reply if it has "Re:" or "Fwd:" or is a standard thread
        // OR if it's a potential bounce (where "reply" markers don't apply)
        const looksLikeReply = subject.startsWith('re:') || subject.startsWith('fwd:') || subject.startsWith('aw:');
        
        if (!looksLikeReply && !isPotentialBounce) {
          return { isReply: false, reason: 'not_a_thread' };
        }

        // Find contact(s) with this email (using startsWith as fallback for truncation)
        const contacts = await prisma.contact.findMany({
          where: { 
            OR: [
              { email: targetEmail },
              { email: { startsWith: targetEmail } }
            ]
          }
        });

        if (contacts.length > 0) {
          // Look for the most recent SENT event across any matching contact 
          // that happened BEFORE the reply/bounce date
          const recentSentEvent = await prisma.event.findFirst({
            where: {
              contactId: { in: contacts.map(c => c.id) },
              type: 'SENT',
              timestamp: { lte: replyDate }
            },
            orderBy: { timestamp: 'desc' },
            include: {
              contact: true,
              enrollment: { include: { sequence: true } }
            }
          });

          if (recentSentEvent) {
            console.log(`🔗 Matched via fallback Contact+Timing: ${recentSentEvent.contact?.email} (Sent at ${recentSentEvent.timestamp})`);
            return { 
              isReply: true, 
              type: isPotentialBounce ? 'BOUNCED' : 'REPLIED', 
              originalEvent: recentSentEvent 
            };
          } else {
            console.log(`⚠️ Found contact ${targetEmail} but no SENT event prior to ${replyDate} (checked ${contacts.length} contacts)`);
            // Log the first contact's ID for debugging
            if (contacts[0]) {
              console.log(`   Debug: Contact ID: ${contacts[0].id}, targetEmail used: ${targetEmail}`);
            }
          }
        } else {
          if (isPotentialBounce) {
            console.log(`⚠️ No contacts found in DB matching extracted recipient: ${targetEmail}`);
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

  // Extract recipient and reason from email headers or body for bounces
  extractBounceRecipient(parsed) {
    if (!parsed) return null;
    
    let recipient = null;
    let reason = 'Unknown bounce reason';

    // 1. Check custom headers
    const xFailedHeader = parsed.headers?.['x-failed-recipients'] || parsed.headers?.['x-failed-recipient'];
    if (xFailedHeader) recipient = xFailedHeader.toLowerCase().trim();

    const body = (parsed.text || parsed.html || '').toLowerCase();
    
    // Scan for reason markers
    const reasonMatch = body.match(/(?:diagnostic-code|status|reason):\s*([^\r\n]+)/i);
    if (reasonMatch?.[1]) reason = reasonMatch[1].trim();

    // 2. Scan body for email addresses near bounce markers
    if (!recipient) {
      // Look for common patterns like "Final-Recipient: rfc822; user@example.com"
      const recipientRegex = /final-recipient: rfc822;\s*([^\s;@<>]+@[^\s;@<>]+)/i;
      const matchFound = body.match(recipientRegex);
      if (matchFound?.[1]) recipient = matchFound[1].toLowerCase().replace(/[<>]/g, '').trim();
    }

    if (!recipient) {
      // Secondary scan: looking for "to: <email>" mentioned in the rejection part
      const toMatch = body.match(/to:.*?([^\s@<>;,]+@[^\s@<>;,]+)/i);
      if (toMatch?.[1]) recipient = toMatch[1].toLowerCase().replace(/[<>]/g, '').trim();
    }

    if (!recipient) {
      // Third scan: Look for common "failed to deliver to USER@DOMAIN.COM" patterns
      const failToMatch = body.match(/(?:failed|undeliverable|delivery to|address rejected|message not delivered|could not be delivered to|could not reach).*?\s+([^\s@<>;,]+@[^\s@<>;,]+)/i);
      if (failToMatch?.[1]) recipient = failToMatch[1].toLowerCase().replace(/[<>]/g, '').trim();
    }

    if (!recipient) {
      // Fourth scan: Looking for Remote-MTA reports
      const mtaMatch = body.match(/remote-mta:.*?;\s*([^\s@<>;,]+@[^\s@<>;,]+)/i);
      if (mtaMatch?.[1]) recipient = mtaMatch[1].toLowerCase().replace(/[<>]/g, '').trim();
    }

    // Fifth scan: Look for standard email patterns anywhere if it's a MAILER-DAEMON
    if (!recipient) {
      const fromEmail = (parsed.from?.value?.[0]?.address || '').toLowerCase();
      if (fromEmail.includes('mailer-daemon') || fromEmail.includes('postmaster') || fromEmail.includes('mta')) {
        // More permissive regex to capture potential malformed/truncated emails
        const allEmails = body.match(/[a-z0-9._%+-]+@[a-z0-9.-]+/gi);
        if (allEmails && allEmails.length > 0) {
          const ourEmail = (this.config.imapUser || '').toLowerCase();
          const excludeKeywords = ['daemon', 'postmaster', 'no-reply', 'noreply', 'support', 'mta', 'relay', 'mailchannels', 'hostinger'];
          
          const externalEmails = allEmails.filter(e => {
            const lowE = e.toLowerCase();
            return lowE !== ourEmail && 
                   !excludeKeywords.some(kw => lowE.includes(kw)) &&
                   lowE.includes('.'); // Must at least have a dot in the domain part
          });
          
          if (externalEmails.length > 0) {
            recipient = externalEmails[0].toLowerCase();
            console.log(`🔍 Extracted recipient from daemon body: ${recipient}`);
          }
        }
      }
    }

    // Final cleanup: remove any trailing dots or punctuation that might have been caught
    if (recipient) {
      recipient = recipient.replace(/[.>]$/, '').trim();
    }

    return recipient ? { recipient, reason } : null;
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
          const eventType = replyCheck.type || 'REPLIED';

          console.log(`✨ Detected ${eventType} for ${originalEvent.contact?.email} (Email ID: ${originalEvent.emailId})`);

          // Check if we already have this specific event (reply or bounce) recorded
          const existingEvent = await prisma.event.findFirst({
            where: {
              emailId: originalEvent.emailId,
              type: eventType
            }
          });

          if (!existingEvent) {
            // Also check if this specific incoming message has already been processed (using messageId)
            const incomingMessageId = parsed.messageId || '';
            const duplicateMessage = await prisma.event.findFirst({
              where: {
                type: { in: ['REPLIED', 'BOUNCED'] },
                details: {
                  contains: incomingMessageId
                }
              }
            });

            if (duplicateMessage && incomingMessageId !== '') {
              console.log(`ℹ️ Email ${incomingMessageId} already processed, skipping.`);
              continue;
            }

            // Sanitize incoming content
            const replyBody = this.sanitizeForJson(parsed.text || parsed.html || 'No content');
            const replySubject = this.sanitizeForJson(parsed.subject || 'No Subject');
            const replyFrom = this.sanitizeForJson(
              parsed.from?.value?.[0]?.address || parsed.from?.text || 'Unknown'
            );

            // Determine event type (REPLIED or BOUNCED)
            // eventType is already declared above

            // Create the event
            const bounceData = eventType === 'BOUNCED' ? this.extractBounceRecipient(parsed) : null;
            
            await prisma.event.create({
              data: {
                enrollmentId: originalEvent.enrollmentId,
                contactId: originalEvent.contactId,
                campaignId: originalEvent.campaignId,
                type: eventType,
                emailId: originalEvent.emailId,
                details: JSON.stringify({
                  receivedAt: parsed.date || new Date().toISOString(),
                  subject: replySubject,
                  body: replyBody,
                  from: replyFrom,
                  messageId: parsed.messageId || '',
                  inReplyTo: parsed.inReplyTo || '',
                  source: 'imap_monitoring',
                  isBounce: eventType === 'BOUNCED',
                  bounceReason: bounceData?.reason || null
                })
              }
            });

            console.log(`✅ Stored ${eventType} from ${parsed.from?.text} for email ${originalEvent.emailId}`);
            processedCount++;

            // Broadcast real-time event via socket
            broadcastRealTimeEvent({
              type: eventType,
              campaignId: originalEvent.campaignId,
              contactId: originalEvent.contactId,
              enrollmentId: originalEvent.enrollmentId,
              to: replyFrom,
              subject: replySubject,
              timestamp: new Date().toISOString()
            });

            // If it's a bounce, update contact status too
            if (eventType === 'BOUNCED') {
              await prisma.contact.update({
                where: { id: originalEvent.contactId },
                data: { status: 'BOUNCED' }
              });
              console.log(`🚫 Contact ${originalEvent.contactId} marked as BOUNCED`);
            }

            // Update enrollment status to STOPPED
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
