# Email Activity API Documentation

## Overview

The Email Activity API provides endpoints for managing email activity records. This API works with both dedicated `emailActivity` tables and falls back to the existing `events` table for backward compatibility.

## Base URL

```
/api/email-activity
```

## Endpoints

### 1. Delete Email Activity

**DELETE** `/api/email-activity/:id`

Deletes an email activity record by its ID.

#### Parameters

- `id` (string, required) - The UUID of the email activity to delete

#### Response

**Success (200)**
```json
{
  "message": "Email activity deleted successfully",
  "deletedId": "uuid-string"
}
```

**Not Found (404)**
```json
{
  "message": "Email activity not found"
}
```

**Bad Request (400)**
```json
{
  "message": "Email activity ID is required"
}
```

**Constraint Error (400)**
```json
{
  "message": "Cannot delete email activity due to related records"
}
```

**Server Error (500)**
```json
{
  "message": "Failed to delete email activity"
}
```

#### Example Usage

```bash
# Delete a specific email activity
curl -X DELETE http://localhost:3001/api/email-activity/4549cf16-aa81-4953-875e-8b6677df3535
```

### 2. List Email Activities

**GET** `/api/email-activity`

Retrieves all email activities (limited to 100 most recent).

#### Response

**Success (200)**
```json
{
  "message": "Email activities retrieved successfully",
  "count": 25,
  "activities": [
    {
      "id": "uuid-string",
      "type": "SENT",
      "timestamp": "2025-10-11T11:47:21.000Z",
      "contact": {
        "email": "user@example.com",
        "firstName": "John",
        "lastName": "Doe"
      },
      "enrollment": {
        "id": "enrollment-uuid",
        "sequence": {
          "name": "Welcome Series"
        }
      }
    }
  ]
}
```

#### Example Usage

```bash
# List all email activities
curl http://localhost:3001/api/email-activity
```

### 3. Get Specific Email Activity

**GET** `/api/email-activity/:id`

Retrieves a specific email activity by its ID.

#### Parameters

- `id` (string, required) - The UUID of the email activity

#### Response

**Success (200)**
```json
{
  "message": "Email activity retrieved successfully",
  "activity": {
    "id": "uuid-string",
    "type": "SENT",
    "timestamp": "2025-10-11T11:47:21.000Z",
    "details": "{\"subject\":\"Welcome!\",\"to\":\"user@example.com\"}",
    "contact": {
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe"
    },
    "enrollment": {
      "id": "enrollment-uuid",
      "sequence": {
        "name": "Welcome Series"
      }
    }
  }
}
```

**Not Found (404)**
```json
{
  "message": "Email activity not found"
}
```

#### Example Usage

```bash
# Get specific email activity
curl http://localhost:3001/api/email-activity/4549cf16-aa81-4953-875e-8b6677df3535
```

## Error Handling

The API includes comprehensive error handling:

- **Validation Errors**: Missing or invalid parameters
- **Database Errors**: Connection issues, constraint violations
- **Not Found Errors**: Non-existent records
- **Server Errors**: Unexpected application errors

All errors are logged with detailed information including:
- Request parameters
- Error messages and codes
- Stack traces (in development mode)

## Database Compatibility

The API is designed to work with:

1. **Primary**: `emailActivity` table (if exists)
2. **Fallback**: `events` table (current schema)

This ensures backward compatibility with existing systems while supporting future schema changes.

## Event Types

When working with the `events` table, the following event types represent email activities:

- `SENT` - Email was sent successfully
- `DELIVERED` - Email was delivered to recipient
- `OPENED` - Email was opened by recipient
- `CLICKED` - Links in email were clicked
- `REPLIED` - Recipient replied to email
- `BOUNCED` - Email bounced back
- `UNSUBSCRIBED` - Recipient unsubscribed
- `FAILED` - Email sending failed

## Security Considerations

- **Rate Limiting**: Applied through Express middleware
- **Input Validation**: UUID format validation for IDs
- **Error Sanitization**: Sensitive information filtered in production
- **Logging**: Comprehensive audit trail for all operations

## Testing

Use the provided test script to verify functionality:

```bash
node test-email-activity-route.js
```

This will:
- Test database connectivity
- Show existing email activities
- Verify route implementation
- Provide sample API calls for testing
