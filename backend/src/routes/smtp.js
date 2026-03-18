const express = require('express');
const nodemailer = require('nodemailer');
const prisma = require('../db/prismaClient');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// GET /api/smtp/settings - Get current user's SMTP/IMAP settings
router.get('/settings', authenticateToken, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                smtpHost: true,
                smtpPort: true,
                smtpSecure: true,
                smtpUser: true,
                // Don't send password back for security, just a placeholder if it exists
                smtpPass: true,
                fromEmail: true,
                fromName: true,
                imapHost: true,
                imapPort: true
            }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Replace actual password with a placeholder if it exists
        if (user.smtpPass) {
            user.smtpPass = '********';
        }

        res.json(user);
    } catch (error) {
        console.error('Error fetching SMTP settings:', error);
        res.status(500).json({ error: 'Failed to fetch SMTP settings' });
    }
});

// POST /api/smtp/settings - Save/Update user's SMTP/IMAP settings
router.post('/settings', authenticateToken, async (req, res) => {
    try {
        const {
            smtpHost,
            smtpPort,
            smtpSecure,
            smtpUser,
            smtpPass,
            fromEmail,
            fromName,
            imapHost,
            imapPort
        } = req.body;

        const updateData = {
            smtpHost,
            smtpPort: smtpPort ? parseInt(smtpPort) : null,
            smtpSecure: smtpSecure === true,
            smtpUser,
            fromEmail,
            fromName,
            imapHost,
            imapPort: imapPort ? parseInt(imapPort) : null
        };

        // Only update password if a new one is provided (and it's not our placeholder)
        if (smtpPass && smtpPass !== '********') {
            updateData.smtpPass = smtpPass;
        }

        const updatedUser = await prisma.user.update({
            where: { id: req.user.id },
            data: updateData
        });

        res.json({ success: true, message: 'SMTP settings updated successfully' });
    } catch (error) {
        console.error('Error saving SMTP settings:', error);
        res.status(500).json({ error: 'Failed to save SMTP settings' });
    }
});

// POST /api/smtp/test - Test SMTP connection
router.post('/test', authenticateToken, async (req, res) => {
    try {
        const {
            smtpHost,
            smtpPort,
            smtpSecure,
            smtpUser,
            smtpPass,
            testRecipient
        } = req.body;

        if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
            return res.status(400).json({ error: 'Missing required SMTP fields' });
        }

        // Handle placeholder password
        let actualPass = smtpPass;
        if (smtpPass === '********') {
            const user = await prisma.user.findUnique({
                where: { id: req.user.id },
                select: { smtpPass: true }
            });
            actualPass = user?.smtpPass;
        }

        if (!actualPass) {
            return res.status(400).json({ error: 'SMTP password is required' });
        }

        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: parseInt(smtpPort),
            secure: smtpSecure === true,
            auth: {
                user: smtpUser,
                pass: actualPass
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        // Verify connection
        await transporter.verify();

        // If testRecipient is provided, send a test email
        if (testRecipient) {
            const appUrl = process.env.APP_URL || 'http://localhost:3001';
            const unsubscribeUrl = `${appUrl}/api/unsubscribe/email`;
            const unsubscribeMailto = `mailto:${smtpUser}?subject=unsubscribe`;
            await transporter.sendMail({
                from: smtpUser,
                to: testRecipient,
                subject: 'SMTP Connection Test',
                text: `This is a test email to verify your SMTP settings in the Email Sequencing System.\n\nUnsubscribe: ${unsubscribeUrl}`,
                html: `<p>This is a test email to verify your SMTP settings in the Email Sequencing System.</p><p style="margin-top:20px;font-size:11px;color:#777;"><a href="${unsubscribeUrl}" target="_blank" rel="noopener noreferrer" style="color:#5d7ea5;text-decoration:underline;">Unsubscribe</a></p>`,
                headers: {
                    'List-Unsubscribe': `<${unsubscribeMailto}>, <${unsubscribeUrl}>`,
                    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
                }
            });
        }

        res.json({ success: true, message: 'SMTP connection verified successfully' });
    } catch (error) {
        console.error('SMTP Test Error:', error);
        res.status(500).json({
            error: 'SMTP connection failed',
            details: error.message
        });
    }
});

module.exports = router;
