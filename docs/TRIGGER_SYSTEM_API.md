# Email Sequencing Trigger System API

This document describes the enhanced email sequencing system with trigger step functionality.

## Overview

The trigger system allows you to specify which step in a sequence should only be sent when the previous email is opened. This enables more intelligent email sequences that respond to user engagement.

## Key Features

1. **Trigger Step Configuration**: Set any step as a "trigger step" that only sends when the previous email is opened
2. **Flexible Email Content**: Support both template-based and custom email content
3. **Backward Compatibility**: Sequences without triggers continue to work with delay-based logic
4. **Persistent Storage**: Trigger step selections are saved and retrieved correctly

## API Endpoints

### 1. Set Trigger Step for Sequence

**PUT** `/api/sequences/:id/trigger`

Sets which step should be the trigger step for a sequence.

**Request Body:**
```json
{
  "triggerStepId": "uuid-of-step"
}
```

**Response:**
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

**Example:**
```bash
curl -X PUT http://localhost:3001/api/sequences/123/trigger \
  -H "Content-Type: application/json" \
  -d '{"triggerStepId": "step-uuid-456"}'
```

### 2. Get Trigger Step for Sequence

**GET** `/api/sequences/:id/trigger`

Retrieves the current trigger step configuration for a sequence.

**Response (with trigger):**
```json
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
```

**Response (no trigger):**
```json
{
  "success": true,
  "data": {
    "hasTrigger": false,
    "triggerStepId": null,
    "triggerStepOrder": null
  }
}
```

### 3. Enhanced Sequence Endpoints

The existing sequence endpoints now include trigger information:

**GET** `/api/sequences` - Lists all sequences with trigger info
**GET** `/api/sequences/:id` - Gets single sequence with trigger info

**Response includes:**
```json
{
  "id": "sequence-uuid",
  "name": "My Sequence",
  "steps": [...],
  "trigger": {
    "id": "trigger-uuid",
    "triggerStepId": "step-uuid",
    "triggerStep": {
      "stepOrder": 2,
      "subject": "Follow-up Email",
      "template": { /* template info */ }
    }
  }
}
```

## How It Works

### 1. Sequence Creation

Create sequences with steps as usual. You can use either templates or custom content:

```json
{
  "name": "Welcome Sequence",
  "description": "Onboarding sequence with trigger",
  "steps": [
    {
      "stepOrder": 1,
      "delayDays": 0,
      "delayHours": 0,
      "subject": "Welcome!",
      "body": "<h1>Welcome {{firstName}}!</h1>",
      "triggerType": "delay"
    },
    {
      "stepOrder": 2,
      "delayDays": 0,
      "delayHours": 2,
      "subject": "Follow-up",
      "body": "<h1>Hi {{firstName}}, did you see our welcome?</h1>",
      "triggerType": "opened"
    }
  ]
}
```

### 2. Setting Trigger Step

After creating the sequence, set which step should be the trigger:

```javascript
// Set step 2 as the trigger step
await fetch('/api/sequences/sequence-id/trigger', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ triggerStepId: 'step-2-uuid' })
});
```

### 3. Email Sending Logic

The system automatically handles email sending based on the trigger configuration:

- **Step 1**: Always sends based on delay
- **Trigger Step**: Only sends if previous email was opened (after delay period)
- **Other Steps**: Send based on delay (backward compatibility)

### 4. Contact Enrollment

Enroll contacts normally - the trigger logic is handled automatically:

```json
{
  "contactId": "contact-uuid",
  "sequenceId": "sequence-uuid",
  "startImmediately": false
}
```

## Email Content Options

### Template-Based (Existing)
```json
{
  "stepOrder": 1,
  "templateId": "template-uuid",
  "delayDays": 1
}
```

### Custom Content (New)
```json
{
  "stepOrder": 1,
  "subject": "Custom Subject with {{firstName}}",
  "body": "<h1>Custom HTML content</h1>",
  "delayDays": 1
}
```

## Trigger Behavior

### Without Trigger Step
- All emails send based on delay periods
- Traditional sequence behavior

### With Trigger Step
- **Before Trigger**: Normal delay-based sending
- **Trigger Step**: Waits for previous email to be opened
- **After Trigger**: Normal delay-based sending

## Error Handling

All endpoints include comprehensive error handling:

```json
{
  "success": false,
  "error": "Trigger step not found in this sequence"
}
```

Common error codes:
- `400`: Invalid request data
- `404`: Sequence or step not found
- `409`: Conflict (e.g., duplicate enrollment)
- `500`: Server error

## Frontend Integration

### Setting Trigger Step
```javascript
async function setTriggerStep(sequenceId, stepId) {
  const response = await fetch(`/api/sequences/${sequenceId}/trigger`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ triggerStepId: stepId })
  });
  
  const result = await response.json();
  if (result.success) {
    console.log('Trigger step set successfully');
  }
}
```

### Getting Trigger Step
```javascript
async function getTriggerStep(sequenceId) {
  const response = await fetch(`/api/sequences/${sequenceId}/trigger`);
  const result = await response.json();
  
  if (result.data.hasTrigger) {
    console.log(`Trigger step: ${result.data.triggerStepOrder}`);
  } else {
    console.log('No trigger step configured');
  }
}
```

## Database Schema

### New Table: sequence_triggers
```sql
CREATE TABLE sequence_triggers (
  id UUID PRIMARY KEY,
  sequence_id UUID REFERENCES sequences(id) ON DELETE CASCADE,
  trigger_step_id UUID REFERENCES sequence_steps(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(sequence_id)
);
```

## Testing

Use the provided test script to verify functionality:

```bash
node test-trigger-system.js
```

This creates a complete test sequence, sets a trigger step, enrolls a contact, and verifies all functionality works correctly.

## Migration Notes

- Existing sequences continue to work without modification
- No breaking changes to existing API endpoints
- New trigger functionality is opt-in
- Database migrations are handled automatically

## Troubleshooting

### Trigger Step Not Persisting
- Verify the step exists in the sequence
- Check that the triggerStepId is valid
- Ensure database migrations have run

### Emails Not Sending
- Check scheduler is running: `GET /api/scheduler/status`
- Verify SMTP configuration
- Check enrollment status and nextSendAt timing
- Review logs for trigger step evaluation

### Custom Emails Not Working
- Ensure both subject and body are provided
- Verify token replacement syntax: `{{firstName}}`
- Check that step validation passes
