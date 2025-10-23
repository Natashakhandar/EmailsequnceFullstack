# Email Sequencing System - API Payload Examples

## Sequence Creation Examples

### 1. Basic Sequence with Custom Content

```json
{
  "name": "Welcome Sequence",
  "description": "Onboarding sequence for new users",
  "steps": [
    {
      "stepOrder": 1,
      "delayDays": 0,
      "delayHours": 0,
      "delayMinutes": 0,
      "subject": "Welcome {{firstName}}!",
      "body": "<h1>Welcome {{firstName}}!</h1><p>Thank you for joining us at {{company}}!</p>",
      "triggerType": "delay"
    },
    {
      "stepOrder": 2,
      "delayDays": 0,
      "delayHours": 2,
      "delayMinutes": 0,
      "subject": "Getting started guide for {{firstName}}",
      "body": "<h1>Hi {{firstName}},</h1><p>Here's how to get started...</p>",
      "triggerType": "delay"
    }
  ]
}
```

### 2. Sequence with Template References

```json
{
  "name": "Template-Based Sequence",
  "description": "Using existing email templates",
  "steps": [
    {
      "stepOrder": 1,
      "templateId": "template-uuid-here",
      "delayDays": 0,
      "delayHours": 0,
      "triggerType": "delay"
    },
    {
      "stepOrder": 2,
      "templateId": "another-template-uuid",
      "delayDays": 1,
      "delayHours": 0,
      "triggerType": "delay"
    }
  ]
}
```

### 3. Advanced Sequence with Trigger Steps

```json
{
  "name": "Engagement-Based Sequence",
  "description": "Sequence that responds to user engagement",
  "steps": [
    {
      "stepOrder": 1,
      "delayDays": 0,
      "delayHours": 0,
      "subject": "Welcome {{firstName}}!",
      "body": "<h1>Welcome!</h1><p>Please read this important message.</p>",
      "triggerType": "delay"
    },
    {
      "stepOrder": 2,
      "delayDays": 0,
      "delayHours": 4,
      "subject": "Did you see our message, {{firstName}}?",
      "body": "<h1>Follow-up</h1><p>This email only sends if you opened the first one!</p>",
      "triggerType": "opened"
    },
    {
      "stepOrder": 3,
      "delayDays": 1,
      "delayHours": 0,
      "subject": "Final reminder",
      "body": "<h1>Last chance!</h1><p>This is our final email.</p>",
      "triggerType": "delay"
    }
  ]
}
```

## Setting Trigger Steps

### Set Trigger Step
```json
PUT /api/sequences/{sequenceId}/trigger
{
  "triggerStepId": "step-uuid-here"
}
```

### Response
```json
{
  "success": true,
  "message": "Trigger step set successfully",
  "data": {
    "sequenceId": "sequence-uuid",
    "triggerStepId": "step-uuid",
    "triggerStepOrder": 2,
    "sequence": { /* full sequence object */ }
  }
}
```

## Contact Enrollment

### Enroll Contact in Sequence
```json
POST /api/enrollments
{
  "contactId": "contact-uuid",
  "sequenceId": "sequence-uuid",
  "startImmediately": true
}
```

### Bulk Enrollment
```json
POST /api/enrollments/bulk
{
  "contactIds": ["contact-1-uuid", "contact-2-uuid"],
  "sequenceId": "sequence-uuid",
  "startImmediately": false
}
```

## Contact Creation

### Create Contact
```json
POST /api/contacts
{
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "company": "Example Corp",
  "timezone": "UTC"
}
```

## Error Response Examples

### Validation Error
```json
{
  "success": false,
  "message": "Step 1 must have either a templateId or both subject and body for custom email"
}
```

### Invalid Trigger Type
```json
{
  "success": false,
  "message": "Step 2 triggerType must be one of: delay, opened, not_opened, replied, skip"
}
```

### Template Not Found
```json
{
  "success": false,
  "message": "Template with ID \"invalid-uuid\" not found for step 1"
}
```

## Trigger Step Retrieval

### Get Trigger Step
```json
GET /api/sequences/{sequenceId}/trigger

Response (with trigger):
{
  "success": true,
  "data": {
    "hasTrigger": true,
    "triggerStepId": "step-uuid",
    "triggerStepOrder": 2,
    "stepId": "step-uuid",
    "templateName": "Follow-up Email",
    "subject": "Did you see our message?"
  }
}

Response (no trigger):
{
  "success": true,
  "data": {
    "hasTrigger": false,
    "triggerStepId": null,
    "triggerStepOrder": null
  }
}
```

## Scheduler Operations

### Check Scheduler Status
```json
GET /api/scheduler/status

Response:
{
  "isRunning": true,
  "isProcessing": false,
  "nextRun": "Every minute",
  "lastRun": "2025-10-15T16:01:04.672Z"
}
```

### Trigger Email Processing
```json
POST /api/scheduler/trigger

Response:
{
  "success": true,
  "message": "Email processing triggered successfully"
}
```

### Get Pending Emails Count
```json
GET /api/scheduler/pending

Response:
{
  "pendingEmails": 5
}
```

## Token Replacement

The system supports the following tokens in email content:

- `{{firstName}}` - Contact's first name
- `{{lastName}}` - Contact's last name  
- `{{email}}` - Contact's email address
- `{{company}}` - Contact's company
- `{{fullName}}` - Full name (firstName + lastName)

Example:
```html
<h1>Hello {{firstName}}!</h1>
<p>Welcome to {{company}}. We're excited to have you on board.</p>
<p>If you have any questions, reply to this email at {{email}}.</p>
```

## Trigger Types

- **delay**: Send after specified delay period (default behavior)
- **opened**: Send only if previous email was opened
- **not_opened**: Send only if previous email was NOT opened
- **replied**: Send only if previous email was replied to
- **skip**: Skip this step entirely

## Best Practices

1. **Always validate payloads** before sending to ensure required fields are present
2. **Use meaningful step orders** (1, 2, 3, etc.) for clarity
3. **Set appropriate delays** to avoid overwhelming contacts
4. **Test trigger logic** with small groups before full deployment
5. **Monitor events** to understand engagement patterns
6. **Handle errors gracefully** and provide meaningful feedback to users

## Testing Payloads

Use these payloads for testing the system:

### Minimal Valid Sequence
```json
{
  "name": "Test Sequence",
  "steps": [
    {
      "stepOrder": 1,
      "subject": "Test",
      "body": "Test body",
      "delayDays": 0
    }
  ]
}
```

### Invalid Sequence (Missing Content)
```json
{
  "name": "Invalid Sequence",
  "steps": [
    {
      "stepOrder": 1,
      "delayDays": 0
      // Missing subject, body, and templateId - should fail
    }
  ]
}
```

### Invalid Trigger Type
```json
{
  "name": "Invalid Trigger",
  "steps": [
    {
      "stepOrder": 1,
      "subject": "Test",
      "body": "Test",
      "triggerType": "invalid_type" // Should fail
    }
  ]
}
```
