const express = require('express');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../db/prismaClient');
const { authenticateToken } = require('../middleware/auth');
const { sendUnsubscribeNotification } = require('../services/unsubscribeNotification');
const router = express.Router();

function getFrontendBaseUrl() {
  if (process.env.FRONTEND_URL && process.env.FRONTEND_URL.trim()) {
    return process.env.FRONTEND_URL.trim().replace(/\/$/, '');
  }
  if (process.env.APP_URL && process.env.APP_URL.trim()) {
    return process.env.APP_URL.trim().replace(/\/$/, '');
  }
  return 'http://localhost:5173';
}

// IMPORTANT: Put specific routes BEFORE generic parameter routes in Express
// So these specific named routes must come first

// GET /api/unsubscribe/my-unsubscribed-contacts - Get all unsubscribed contacts for current user (authenticated)
router.get('/my-unsubscribed-contacts', authenticateToken, async (req, res) => {
  try {
    // Get all unsubscribed contacts belonging to this user
    const unsubscribedContacts = await prisma.contact.findMany({
      where: {
        userId: req.user.id,
        status: 'UNSUBSCRIBED'
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        company: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        events: {
          where: { type: 'UNSUBSCRIBED' },
          select: {
            id: true,
            details: true,
            timestamp: true,
            enrollment: {
              select: {
                sequence: {
                  select: {
                    name: true
                  }
                }
              }
            }
          },
          orderBy: { timestamp: 'desc' }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    // Process the data to extract reasons
    const processedContacts = unsubscribedContacts.map(contact => {
      // Get the most recent unsubscribe event  
      const latestEvent = contact.events[0];
      let reason = 'No reason provided';
      let unsubscribedAt = new Date();
      
      if (latestEvent) {
        try {
          const details = JSON.parse(latestEvent.details || '{}');
          reason = details.reason || reason;
          unsubscribedAt = latestEvent.timestamp;
        } catch (e) {
          unsubscribedAt = latestEvent.timestamp;
        }
      }

      return {
        id: contact.id,
        email: contact.email,
        firstName: contact.firstName,
        lastName: contact.lastName,
        company: contact.company,
        reason,
        unsubscribedAt,
        sequenceName: latestEvent?.enrollment?.sequence?.name || 'Unknown Sequence',
        totalUnsubscribeEvents: contact.events.length
      };
    });

    res.json(processedContacts);
  } catch (error) {
    console.error('Error fetching unsubscribed contacts:', error);
    res.status(500).json({ error: 'Failed to fetch unsubscribed contacts' });
  }
});

// GET /api/unsubscribe/reasons/:contactId - Get unsubscribe reasons for a contact (authenticated)
router.get('/reasons/:contactId', authenticateToken, async (req, res) => {
  try {
    const { contactId } = req.params;
    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPERADMIN';

    // Check access: admin or owner of contact
    if (!isAdmin) {
      const contact = await prisma.contact.findUnique({
        where: { id: contactId }
      });

      if (!contact || contact.userId !== req.user.id) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
    }

    // Get all unsubscribe events for this contact
    const unsubscribeEvents = await prisma.event.findMany({
      where: { 
        contactId,
        type: 'UNSUBSCRIBED'
      },
      orderBy: { timestamp: 'desc' },
      include: {
        enrollment: {
          include: {
            sequence: true
          }
        }
      }
    });

    // Map events to extract reason from details
    const reasons = unsubscribeEvents.map(event => {
      let reason = 'No reason provided';
      let unsubscribedAt = event.timestamp;
      let method = 'form';
      
      try {
        const details = JSON.parse(event.details || '{}');
        reason = details.reason || reason;
        unsubscribedAt = details.unsubscribedAt ? new Date(details.unsubscribedAt) : unsubscribedAt;
        method = details.method || method;
      } catch (e) {
        // details is not JSON, use defaults
      }

      return {
        id: event.id,
        reason,
        sequenceName: event.enrollment?.sequence?.name,
        unsubscribedAt,
        method
      };
    });

    res.json(reasons);
  } catch (error) {
    console.error('Error fetching unsubscribe reasons:', error);
    res.status(500).json({ error: 'Failed to fetch unsubscribe reasons' });
  }
});

// GET /api/unsubscribe/:token - Handle unsubscribe via token
router.get('/:token', async (req, res, next) => {
  try {
    const { token } = req.params;

    const reservedTokens = new Set(['email', 'submit', 'generate-token', 'my-unsubscribed-contacts', 'reasons', 'page']);
    if (reservedTokens.has(token)) {
      return next();
    }

    // Find the unsubscribe token
    const unsubscribeToken = await prisma.unsubscribeToken.findUnique({
      where: { token }
    });

    if (!unsubscribeToken) {
      return res.setHeader('Content-Type', 'text/html; charset=utf-8').send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invalid Link</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto; background: linear-gradient(135deg, #f5f7fa 0%, #f0f2f5 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; }
        .container { background: white; border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); padding: 48px; text-align: center; max-width: 500px; }
        h1 { color: #d32f2f; font-size: 28px; margin-bottom: 12px; }
        p { color: #666; font-size: 15px; line-height: 1.6; }
    </style>
</head>
<body>
    <div class="container">
        <h1>❌ Invalid Link</h1>
        <p>This unsubscribe link is invalid or has expired. If you believe this is an error, please contact the sender.</p>
    </div>
</body>
</html>
      `);
    }

    const tokenContact = await prisma.contact.findUnique({
      where: { id: unsubscribeToken.contactId }
    });

    if (!tokenContact) {
      return res.setHeader('Content-Type', 'text/html; charset=utf-8').send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Error</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto; background: linear-gradient(135deg, #f5f7fa 0%, #f0f2f5 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; }
        .container { background: white; border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); padding: 48px; text-align: center; max-width: 500px; }
        h1 { color: #d32f2f; font-size: 28px; margin-bottom: 12px; }
        p { color: #666; font-size: 15px; line-height: 1.6; }
    </style>
</head>
<body>
    <div class="container">
        <h1>⚠️ Error</h1>
        <p>We couldn't find your email in our system. Please check the unsubscribe link or contact the sender.</p>
    </div>
</body>
</html>
      `);
    }

    // Check if token is expired (optional - you can set expiration logic)
    const tokenAge = Date.now() - unsubscribeToken.createdAt.getTime();
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

    if (tokenAge > maxAge) {
      return res.setHeader('Content-Type', 'text/html; charset=utf-8').send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Link Expired</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto; background: linear-gradient(135deg, #f5f7fa 0%, #f0f2f5 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; }
        .container { background: white; border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); padding: 48px; text-align: center; max-width: 500px; }
        h1 { color: #f57c00; font-size: 28px; margin-bottom: 12px; }
        p { color: #666; font-size: 15px; line-height: 1.6; }
    </style>
</head>
<body>
    <div class="container">
        <h1>⏰ Link Expired</h1>
        <p>This unsubscribe link has expired (valid for 30 days). Please request a new unsubscribe link from the sender.</p>
    </div>
</body>
</html>
      `);
    }

    // JSON mode is used by the public page to validate token and show context.
    if (req.query.json === 'true') {
      return res.json({
        success: true,
        message: 'Token is valid',
        alreadyUnsubscribed: unsubscribeToken.usedAt !== null || tokenContact.status === 'UNSUBSCRIBED',
        contact: {
          email: tokenContact.email,
          firstName: tokenContact.firstName,
          lastName: tokenContact.lastName
        }
      });
    }

    // Return HTML page with popup dialog for unsubscribe
    const alreadyUnsubscribed = unsubscribeToken.usedAt !== null || tokenContact.status === 'UNSUBSCRIBED';
    const contactEmail = tokenContact.email;
    const contactName = tokenContact.firstName ? `${tokenContact.firstName} ${tokenContact.lastName}`.trim() : contactEmail;

    const htmlPage = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Unsubscribe</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
            background: linear-gradient(135deg, #f5f7fa 0%, #f0f2f5 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
        }

        .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 50;
        }

        .modal {
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            max-width: 500px;
            width: 100%;
            padding: 32px;
            animation: modalSlideIn 0.3s ease-out;
        }

        @keyframes modalSlideIn {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .modal-header {
            margin-bottom: 24px;
        }

        .modal h1 {
            font-size: 24px;
            font-weight: 700;
            color: #1a1a1a;
            margin-bottom: 8px;
        }

        .modal-description {
            font-size: 15px;
            color: #666;
            line-height: 1.5;
        }

        .modal-content {
            margin-bottom: 24px;
        }

        .form-group {
            margin-bottom: 16px;
        }

        label {
            display: block;
            font-size: 14px;
            font-weight: 600;
            color: #1a1a1a;
            margin-bottom: 8px;
        }

        input, select, textarea {
            width: 100%;
            padding: 10px 12px;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            font-size: 14px;
            font-family: inherit;
            transition: border-color 0.2s;
        }

        input:focus, select:focus, textarea:focus {
            outline: none;
            border-color: #0b57d0;
            box-shadow: 0 0 0 2px rgba(11, 87, 208, 0.1);
        }

        input[type="email"]:disabled {
            background-color: #f5f5f5;
            color: #999;
        }

        textarea {
            resize: vertical;
            min-height: 100px;
        }

        .modal-footer {
            display: flex;
            gap: 12px;
            justify-content: flex-end;
        }

        button {
            padding: 10px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            border: none;
            cursor: pointer;
            transition: all 0.2s;
        }

        .btn-cancel {
            background-color: #f0f0f0;
            color: #1a1a1a;
        }

        .btn-cancel:hover {
            background-color: #e0e0e0;
        }

        .btn-unsubscribe {
            background-color: #d32f2f;
            color: white;
        }

        .btn-unsubscribe:hover {
            background-color: #b71c1c;
        }

        .btn-unsubscribe:disabled {
            background-color: #ccc;
            cursor: not-allowed;
        }

        .error-message {
            background-color: #ffebee;
            border: 1px solid #ef5350;
            color: #c62828;
            padding: 12px;
            border-radius: 8px;
            font-size: 14px;
            margin-bottom: 16px;
            display: none;
        }

        .success-message {
            background-color: #c8e6c9;
            border: 1px solid #66bb6a;
            color: #2e7d32;
            padding: 12px;
            border-radius: 8px;
            font-size: 14px;
            margin-bottom: 16px;
            display: none;
        }

        .hidden {
            display: none !important;
        }

        .loading-spinner {
            display: inline-block;
            width: 14px;
            height: 14px;
            border: 2px solid #ffffff;
            border-top-color: transparent;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            margin-right: 6px;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="modal-overlay">
        <div class="modal">
            <div class="error-message" id="errorMessage"></div>
            <div class="success-message" id="successMessage"></div>

            <div id="formContent">
                <div class="modal-header">
                    <h1>Unsubscribe</h1>
                    <p class="modal-description">
                        ${alreadyUnsubscribed 
                            ? "You've already been unsubscribed. Please share your reason so we can improve." 
                            : "We're sorry to see you go. Please let us know why you're unsubscribing so we can improve."}
                    </p>
                </div>

                <form id="unsubscribeForm" class="modal-content">
                    <div class="form-group">
                        <label for="email">Email Address</label>
                        <input 
                            type="email" 
                            id="email" 
                            value="${contactEmail}" 
                            disabled 
                            placeholder="your@email.com"
                        />
                        <div style="font-size: 12px; color: #999; margin-top: 4px;">
                            This is the email you'll be unsubscribed from
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="reason">Reason for Unsubscribing <span style="color: #d32f2f;">*</span></label>
                        <select id="reason" required>
                            <option value="">Select a reason...</option>
                            <option value="Too many emails">Too many emails</option>
                            <option value="Irrelevant content">Irrelevant content</option>
                            <option value="Already subscribed elsewhere">Already subscribed elsewhere</option>
                            <option value="No longer interested">No longer interested</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>

                    <div id="customReasonGroup" class="form-group hidden">
                        <label for="customReason">Please tell us more <span style="color: #d32f2f;">*</span></label>
                        <textarea 
                            id="customReason" 
                            placeholder="Your feedback helps us improve..."
                        ></textarea>
                    </div>

                    <div class="modal-footer">
                        <button type="button" class="btn-cancel" onclick="window.history.back()">
                            Cancel
                        </button>
                        <button type="submit" class="btn-unsubscribe" id="submitBtn">
                            Unsubscribe
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <script>
        const token = '${token}';
        const form = document.getElementById('unsubscribeForm');
        const reasonSelect = document.getElementById('reason');
        const customReasonGroup = document.getElementById('customReasonGroup');
        const customReasonInput = document.getElementById('customReason');
        const submitBtn = document.getElementById('submitBtn');
        const errorMessage = document.getElementById('errorMessage');
        const successMessage = document.getElementById('successMessage');
        const formContent = document.getElementById('formContent');

        // Show/hide custom reason field
        reasonSelect.addEventListener('change', (e) => {
            if (e.target.value === 'Other') {
                customReasonGroup.classList.remove('hidden');
                customReasonInput.focus();
            } else {
                customReasonGroup.classList.add('hidden');
                customReasonInput.value = '';
            }
        });

        // Handle form submission
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const reason = reasonSelect.value;
            if (!reason) {
                showError('Please select a reason');
                return;
            }

            if (reason === 'Other' && !customReasonInput.value.trim()) {
                showError('Please provide a reason');
                return;
            }

            const finalReason = reason === 'Other' ? customReasonInput.value : reason;

            // Disable submit button and show loading state
            submitBtn.disabled = true;
            const originalText = submitBtn.textContent;
            submitBtn.innerHTML = '<span class="loading-spinner"></span>Processing...';

            try {
                const response = await fetch('/api/unsubscribe/submit', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        token: token,
                        reason: finalReason
                    })
                });

                if (!response.ok) {
                    const data = await response.json().catch(() => ({}));
                    throw new Error(data.error || 'Failed to unsubscribe');
                }

                // Show success message
                showSuccess('Successfully unsubscribed!');
                formContent.style.display = 'none';
                
                setTimeout(() => {
                    window.location.href = 'about:blank';
                }, 2000);
            } catch (error) {
                showError(error.message || 'Failed to unsubscribe. Please try again.');
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });

        function showError(message) {
            errorMessage.textContent = message;
            errorMessage.style.display = 'block';
            successMessage.style.display = 'none';
        }

        function showSuccess(message) {
            successMessage.textContent = message;
            successMessage.style.display = 'block';
            errorMessage.style.display = 'none';
        }
    </script>
</body>
</html>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(htmlPage);

  } catch (error) {
    console.error('Error processing unsubscribe:', error);
    res.status(500).json({ error: 'Failed to process unsubscribe request' });
  }
});

// POST /api/unsubscribe/submit - Submit unsubscribe reason (from frontend)
router.post('/submit', async (req, res) => {
  try {
    const { token, reason } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ error: 'Reason is required' });
    }

    // Find the unsubscribe token
    const unsubscribeToken = await prisma.unsubscribeToken.findUnique({
      where: { token }
    });

    if (!unsubscribeToken) {
      return res.status(404).json({ error: 'Invalid unsubscribe token' });
    }

    const contact = await prisma.contact.findUnique({
      where: { id: unsubscribeToken.contactId },
      include: {
        user: {
          include: {
            emailConfig: true
          }
        }
      }
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found for unsubscribe token' });
    }

    // Mark contact as unsubscribed (idempotent)
    if (contact.status !== 'UNSUBSCRIBED') {
      await prisma.contact.update({
        where: { id: contact.id },
        data: { status: 'UNSUBSCRIBED' }
      });
    }

    // Stop active enrollments
    await prisma.enrollment.updateMany({
      where: {
        contactId: contact.id,
        status: 'ACTIVE'
      },
      data: {
        status: 'UNSUBSCRIBED',
        completedAt: new Date(),
        nextSendAt: null
      }
    });

    // Mark token used (first submit wins)
    if (!unsubscribeToken.usedAt) {
      await prisma.unsubscribeToken.update({
        where: { id: unsubscribeToken.id },
        data: { usedAt: new Date() }
      });
    }

    // Record/update unsubscribe events with reason so unsubscribed table shows it.
    const enrollments = await prisma.enrollment.findMany({
      where: {
        contactId: contact.id,
        status: 'UNSUBSCRIBED'
      },
      include: {
        sequence: true
      },
      orderBy: { updatedAt: 'desc' },
      take: 5 // Reasonable limit
    });

    for (const enrollment of enrollments) {
      // Find the last unsubscribe event for this enrollment
      const lastUnsubscribeEvent = await prisma.event.findFirst({
        where: {
          enrollmentId: enrollment.id,
          type: 'UNSUBSCRIBED'
        },
        orderBy: { timestamp: 'desc' }
      });

      if (lastUnsubscribeEvent) {
        let details = {};
        try {
          details = JSON.parse(lastUnsubscribeEvent.details || '{}');
        } catch (e) {}

        // Update latest unsubscribe event with reason
        details.reason = String(reason).trim();
        details.method = details.method || 'token_form';
        details.unsubscribedAt = details.unsubscribedAt || new Date().toISOString();
        
        await prisma.event.update({
          where: { id: lastUnsubscribeEvent.id },
          data: {
            details: JSON.stringify(details)
          }
        });
      } else {
        await prisma.event.create({
          data: {
            enrollmentId: enrollment.id,
            contactId: contact.id,
            type: 'UNSUBSCRIBED',
            details: JSON.stringify({
              reason: String(reason).trim(),
              method: 'token_form',
              token,
              unsubscribedAt: new Date().toISOString(),
              userAgent: req.get('User-Agent'),
              ip: req.ip
            })
          }
        });
      }

    }

    const smtpSettings = contact.user?.emailConfig
      ? {
          smtpHost: contact.user.emailConfig.smtpHost,
          smtpPort: contact.user.emailConfig.smtpPort,
          smtpSecure: contact.user.emailConfig.smtpSecure,
          smtpUser: contact.user.emailConfig.smtpUser,
          smtpPassword: contact.user.emailConfig.smtpPassword,
          fromEmail: contact.user.emailConfig.fromEmail,
          fromName: contact.user.emailConfig.fromName
        }
      : {
          smtpHost: contact.user?.smtpHost,
          smtpPort: contact.user?.smtpPort,
          smtpSecure: contact.user?.smtpSecure,
          smtpUser: contact.user?.smtpUser,
          smtpPassword: contact.user?.smtpPass,
          fromEmail: contact.user?.fromEmail,
          fromName: contact.user?.fromName
        };

    if (contact.user && contact.user.email) {
      try {
        await sendUnsubscribeNotification({
          recipientEmail: contact.user.email,
          contactEmail: contact.email,
          contactName: `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email,
          sequenceName: enrollments[0]?.sequence?.name || 'Unknown Sequence',
          reason: String(reason).trim(),
          unsubscribedAt: new Date(),
          smtpSettings
        });
      } catch (mailError) {
        console.error('Error sending unsubscribe notification:', mailError);
      }
    }

    res.json({
      success: true,
      message: 'Unsubscribe feedback received'
    });

  } catch (error) {
    console.error('Error submitting unsubscribe reason:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

// POST /api/unsubscribe/email - Handle unsubscribe via email
router.post('/email', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find contact by email
    const contact = await prisma.contact.findUnique({
      where: { email: email.toLowerCase().trim() }
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    if (contact.status === 'UNSUBSCRIBED') {
      return res.status(400).json({
        error: 'Contact is already unsubscribed',
        contact
      });
    }

    // Update contact status
    const updatedContact = await prisma.contact.update({
      where: { id: contact.id },
      data: { status: 'UNSUBSCRIBED' }
    });

    // Stop all active enrollments
    await prisma.enrollment.updateMany({
      where: {
        contactId: contact.id,
        status: 'ACTIVE'
      },
      data: {
        status: 'UNSUBSCRIBED',
        completedAt: new Date(),
        nextSendAt: null
      }
    });

    // Log unsubscribe events
    const enrollments = await prisma.enrollment.findMany({
      where: {
        contactId: contact.id,
        status: 'UNSUBSCRIBED'
      }
    });

    for (const enrollment of enrollments) {
      await prisma.event.create({
        data: {
          enrollmentId: enrollment.id,
          contactId: contact.id,
          type: 'UNSUBSCRIBED',
          details: JSON.stringify({
            method: 'email',
            userAgent: req.get('User-Agent'),
            ip: req.ip
          })
        }
      });
    }

    res.json({
      success: true,
      message: 'Successfully unsubscribed',
      contact: {
        email: updatedContact.email,
        firstName: updatedContact.firstName,
        lastName: updatedContact.lastName
      }
    });

  } catch (error) {
    console.error('Error processing email unsubscribe:', error);
    res.status(500).json({ error: 'Failed to process unsubscribe request' });
  }
});

// POST /api/unsubscribe/generate-token - Generate unsubscribe token for contact
router.post('/generate-token', authenticateToken, async (req, res) => {
  try {
    const { contactId } = req.body;

    if (!contactId) {
      return res.status(400).json({ error: 'contactId is required' });
    }

    // Check if contact exists and belongs to user
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, userId: req.user.id }
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // Generate unique token
    const token = uuidv4();

    // Create unsubscribe token
    const unsubscribeToken = await prisma.unsubscribeToken.create({
      data: {
        token,
        contactId
      }
    });

    // Generate unsubscribe URL
    const unsubscribeUrl = `${process.env.APP_URL}/api/unsubscribe/${token}`;

    res.json({
      token: unsubscribeToken.token,
      url: unsubscribeUrl,
      contactId
    });

  } catch (error) {
    console.error('Error generating unsubscribe token:', error);
    res.status(500).json({ error: 'Failed to generate unsubscribe token' });
  }
});

// GET /api/unsubscribe/page/:token - Legacy endpoint kept for backward compatibility
router.get('/page/:token', async (req, res) => {
  const { token } = req.params;
  return res.redirect(`/api/unsubscribe/${token}`);
});

// POST /api/unsubscribe - Handle unsubscribe with contactId, enrollmentId, and reason
router.post('/', async (req, res) => {
  try {
    const { contactId, enrollmentId, reason } = req.body;

    // Validate required fields
    if (!contactId || !enrollmentId || !reason) {
      return res.status(400).json({ 
        error: 'Missing required fields: contactId, enrollmentId, reason' 
      });
    }

    // Find contact and enrollment together to validate they belong to each other
    const [contact, enrollment] = await Promise.all([
      prisma.contact.findUnique({ where: { id: contactId } }),
      prisma.enrollment.findUnique({ 
        where: { id: enrollmentId },
        include: {
          contact: true,
          sequence: {
            include: { user: true }
          }
        }
      })
    ]);

    // Validate both exist
    if (!contact || !enrollment) {
      return res.status(404).json({ error: 'Contact or enrollment not found' });
    }

    // Validate they belong together
    if (enrollment.contactId !== contactId) {
      return res.status(400).json({ error: 'Contact and enrollment do not match' });
    }

    // Check if already unsubscribed
    if (contact.status === 'UNSUBSCRIBED') {
      return res.status(400).json({ 
        error: 'Contact is already unsubscribed',
        contact: { email: contact.email }
      });
    }

    // Update contact status to UNSUBSCRIBED
    const updatedContact = await prisma.contact.update({
      where: { id: contactId },
      data: { status: 'UNSUBSCRIBED' }
    });

    // Update this specific enrollment to UNSUBSCRIBED
    await prisma.enrollment.update({
      where: { id: enrollmentId },
      data: { 
        status: 'UNSUBSCRIBED',
        completedAt: new Date(),
        nextSendAt: null
      }
    });

    // Create unsubscribe event with reason stored in details
    await prisma.event.create({
      data: {
        enrollmentId,
        contactId,
        type: 'UNSUBSCRIBED',
        details: JSON.stringify({
          reason,
          method: 'form',
          unsubscribedAt: new Date().toISOString(),
          userAgent: req.get('User-Agent'),
          ip: req.ip
        })
      }
    });

    // Send notification email to the user who created this sequence
    const senderEmail = enrollment.sequence?.user?.email;
    const contactName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email;
    const sequenceName = enrollment.sequence?.name || 'Unknown Sequence';

    if (senderEmail) {
      // Send notification in the background (don't wait for it)
      sendUnsubscribeNotification({
        recipientEmail: senderEmail,
        contactEmail: contact.email,
        contactName,
        sequenceName,
        reason,
        unsubscribedAt: new Date()
      }).catch(err => {
        console.error('Notification error (non-critical):', err.message);
      });
    }

    // Return success response
    res.json({
      success: true,
      message: 'Successfully unsubscribed',
      contact: {
        email: updatedContact.email,
        firstName: updatedContact.firstName,
        lastName: updatedContact.lastName
      }
    });

  } catch (error) {
    console.error('Error processing unsubscribe with reason:', error);
    res.status(500).json({ error: 'Failed to process unsubscribe request' });
  }
});

module.exports = router;
