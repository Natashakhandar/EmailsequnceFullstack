# Email Reply Monitoring Setup Guide

## Overview
Your email sequencing system now includes **automatic email reply monitoring** that can fetch and display real client replies from your REPLY_TO_EMAIL inbox using IMAP.

## 🔧 Configuration Required

To enable automatic reply monitoring, add these IMAP credentials to your backend `.env` file:

```bash
# IMAP Configuration for Email Monitoring
IMAP_HOST=imap.gmail.com          # Your IMAP server (Gmail example)
IMAP_PORT=993                     # IMAP port (993 for SSL, 143 for non-SSL)
IMAP_USER=support@yourcompany.com # The email address where replies are received
IMAP_PASSWORD=your_app_password   # Email password or app-specific password
IMAP_TLS=true                     # Enable TLS/SSL (recommended)

# Alternative: If IMAP credentials are same as SMTP, the system will use SMTP credentials
# SMTP_HOST=smtp.gmail.com
# SMTP_USER=support@yourcompany.com
# SMTP_PASSWORD=your_app_password
```

## 📧 Common IMAP Settings

### Gmail
```bash
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_TLS=true
```

### Outlook/Hotmail
```bash
IMAP_HOST=outlook.office365.com
IMAP_PORT=993
IMAP_TLS=true
```

### Yahoo
```bash
IMAP_HOST=imap.mail.yahoo.com
IMAP_PORT=993
IMAP_TLS=true
```

### Custom/Business Email
```bash
IMAP_HOST=mail.yourdomain.com
IMAP_PORT=993
IMAP_TLS=true
```

## 🚀 How It Works

### Automatic Monitoring
- **Runs every 5 minutes** to check for new replies
- **Matches replies** to original sent emails using Message-ID headers
- **Creates REPLIED events** with actual email content
- **Stops sequences** automatically when clients reply

### Manual Monitoring
- **"Check Replies" button** in Email Activity page
- **Instant reply detection** when you need it
- **Real-time feedback** on found replies

## 📊 What You'll See

### In Email Activity Table
- **Green REPLIED badges** for actual client replies
- **💬 MessageCircle icon** indicating reply content is available
- **Real reply timestamps** from when clients actually responded

### In Email Details Popup
- **🔵 Reply-To Email Address** section showing where replies go
- **🟢 Client Reply** section with:
  - Actual reply subject and content
  - Client's email address
  - Real timestamp when they replied
  - Copy functionality for reply content

## 🔍 Testing the Setup

### 1. Test IMAP Connection
```bash
# API endpoint to test connection
GET /api/email-monitoring/test
```

### 2. Check Configuration Status
```bash
# API endpoint to check if IMAP is configured
GET /api/email-monitoring/status
```

### 3. Manual Reply Check
```bash
# API endpoint to manually check for replies
POST /api/email-monitoring/check-replies
```

### 4. View Recent Emails
```bash
# API endpoint to see recent emails in inbox
GET /api/email-monitoring/recent-emails?days=7
```

## 🛡️ Security Notes

### Gmail App Passwords
If using Gmail, you'll need to:
1. Enable 2-Factor Authentication
2. Generate an App Password
3. Use the App Password instead of your regular password

### Business Email
For business email accounts:
1. Ensure IMAP is enabled
2. Use proper authentication credentials
3. Check firewall settings if needed

## 📈 Benefits

### Real Client Engagement
- **See actual replies** from interested clients
- **Track engagement** beyond just opens and clicks
- **Identify hot leads** who respond quickly

### Automatic Workflow
- **Sequences stop** when clients reply (prevents spam)
- **No manual checking** required
- **Real-time updates** in your dashboard

### Complete Visibility
- **Full reply content** for context
- **Reply-to email tracking** for proper routing
- **Timestamp accuracy** for response time analysis

## 🔧 Troubleshooting

### Connection Issues
1. **Check credentials** in `.env` file
2. **Verify IMAP is enabled** on email account
3. **Test with API endpoints** for debugging

### No Replies Found
1. **Check email headers** - system matches by Message-ID
2. **Verify reply-to address** matches monitored inbox
3. **Check recent emails** endpoint to see if emails are being fetched

### Performance
- **Monitoring runs every 5 minutes** automatically
- **Manual checks** available via "Check Replies" button
- **Cleanup tasks** remove old events to maintain performance

## 🎯 Next Steps

1. **Add IMAP credentials** to your `.env` file
2. **Restart your backend server**
3. **Test the connection** using the API endpoints
4. **Send test emails** and reply to them
5. **Use "Check Replies" button** to see real replies appear!

Your email sequencing system now provides complete visibility into client engagement with automatic reply monitoring! 🎉
