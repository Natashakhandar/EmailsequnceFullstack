# Email Tracking & Sequence Progression Features

## Overview

This implementation adds comprehensive email open tracking and intelligent sequence progression to the Email Sequencing system.

## Features Implemented

### 1. Email Open Tracking

#### Tracking Pixel Integration
- **Automatic Injection**: 1×1 transparent PNG tracking pixel automatically added to all sequence emails
- **Pixel URL**: `https://api.fulboost.fun/api/track/open?emailId={{emailId}}`
- **Placement**: Inserted before `</body>` tag or appended to HTML content
- **Stealth**: Invisible pixel with `display:none` styling

#### Tracking Endpoint
```
GET /api/track/open?emailId=<messageId>
```
- Accepts `emailId` as query parameter
- Logs OPENED event to database with timestamp
- Returns 1×1 transparent PNG (always, even on errors)
- Prevents duplicate open tracking for same email
- Captures metadata: User-Agent, IP, Referer

### 2. Sequence Progression Logic

#### Smart Progression Rules
1. **Step 1 (Intro Email)**: Always send if not already sent
2. **Step 2 (Follow-up)**: Send only if Step 1 was opened
3. **Step 3+ (Reminders)**: Send only if previous step was NOT opened after delay period
4. **Reply Detection**: Complete sequence immediately if contact replies

#### Duplicate Prevention
- `lastSentStep` field tracks the last successfully sent step
- Prevents duplicate sends of the same step
- Scheduler checks this field before sending

### 3. Database Schema Updates

#### New Fields Added
```sql
-- Enrollment table
ALTER TABLE enrollments ADD COLUMN lastSentStep INTEGER;
```

#### Enhanced Event Tracking
```json
{
  "stepOrder": 1,
  "stepLabel": "Intro Email",
  "to": "contact@example.com",
  "subject": "Email Subject",
  "messageId": "<unique-id@domain.com>",
  "response": "250 OK"
}
```

### 4. API Endpoints

#### Open Tracking
```
GET /api/track/open?emailId=<messageId>
- Tracks email opens
- Returns 1×1 transparent PNG
- Creates OPENED event in database
```

#### Reply Tracking (Future IMAP Integration)
```
GET /api/track/reply?emailId=<messageId>
- Manual reply tracking endpoint
- Creates REPLIED event in database
- Ready for Gmail/IMAP webhook integration
```

#### Email Statistics
```
GET /api/track/stats/<emailId>
- Returns comprehensive tracking stats for an email
- Shows all events: SENT, OPENED, CLICKED, REPLIED, etc.
- Includes contact information and event timeline
```

### 5. Scheduler Enhancements

#### Intelligent Processing
- Checks sequence conditions before sending each email
- Implements wait/complete/send logic based on previous email status
- Automatic retry with 1-hour intervals for waiting conditions
- Graceful handling of edge cases and errors

#### Condition Checking Function
```javascript
shouldSendNextEmail(enrollment) {
  // Returns: { send: boolean, reason: string, action: 'wait'|'complete'|null }
}
```

## Usage Examples

### 1. Basic Email Sending
```javascript
const result = await sendSequenceEmail(enrollment);
// Automatically includes tracking pixel and updates lastSentStep
```

### 2. Manual Open Tracking
```html
<!-- Automatically injected in emails -->
<img src="https://api.fulboost.fun/api/track/open?emailId=%3Ctest-123%40example.com%3E" 
     width="1" height="1" style="display:none;" alt="" />
```

### 3. Check Email Stats
```javascript
const stats = await fetch('/api/track/stats/test-123@example.com');
// Returns complete tracking information
```

## Configuration

### Environment Variables
```env
# Required for tracking pixel URLs
APP_URL=https://api.fulboost.fun

# SMTP configuration (existing)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### Sequence Step Configuration
```javascript
{
  stepOrder: 1,
  delayDays: 3,      // Wait 3 days before next step
  delayHours: 0,     // Additional hours
  isActive: true
}
```

## Testing

### Run Test Script
```bash
node test-tracking.js
```

### Manual Testing
1. Create a sequence with multiple steps
2. Enroll a contact
3. Check that intro email is sent with tracking pixel
4. Visit tracking URL to simulate open
5. Verify follow-up email is scheduled
6. Test reply tracking endpoint

### Verify Database Events
```sql
SELECT * FROM events WHERE type IN ('SENT', 'OPENED', 'REPLIED') 
ORDER BY timestamp DESC;
```

## Sequence Flow Examples

### Example 1: Contact Opens Emails
```
Day 1: Send Intro Email → Contact Opens → Schedule Follow-up
Day 2: Send Follow-up → Contact Opens → Complete Sequence ✅
```

### Example 2: Contact Doesn't Open
```
Day 1: Send Intro Email → No Open → Wait
Day 4: Still No Open → Send Reminder
Day 7: Still No Open → Send Final Reminder
```

### Example 3: Contact Replies
```
Day 1: Send Intro Email → Contact Replies → Complete Sequence ✅
(No further emails sent)
```

## Error Handling

- **SMTP Failures**: Logged as FAILED events, enrollment marked as STOPPED
- **Tracking Errors**: Always return pixel, log errors to console
- **Database Errors**: Graceful fallback, prevent scheduler crashes
- **Invalid EmailIds**: Return pixel, log warning

## Security Considerations

- **Rate Limiting**: Applied to all tracking endpoints
- **Input Validation**: EmailId parameter validation
- **CORS**: Configured for tracking pixel requests
- **Privacy**: Minimal data collection (no personal info in tracking)

## Future Enhancements

1. **Gmail Integration**: Webhook for automatic reply detection
2. **Click Tracking**: Track link clicks within emails
3. **Delivery Tracking**: SMTP delivery confirmations
4. **Analytics Dashboard**: Visual tracking statistics
5. **A/B Testing**: Template performance comparison
