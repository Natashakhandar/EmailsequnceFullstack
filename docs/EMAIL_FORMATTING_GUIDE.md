# Email Formatting and Token Replacement Guide

## Overview

The Email Sequencing System provides powerful token replacement and HTML formatting capabilities to create personalized, well-formatted emails.

## Available Tokens

### Contact Information Tokens

| Token | Description | Example Output |
|-------|-------------|----------------|
| `{{firstName}}` | Contact's first name | John |
| `{{lastName}}` | Contact's last name | Doe |
| `{{email}}` | Contact's email address | john.doe@example.com |
| `{{company}}` | Contact's company name | Example Corp |
| `{{companyName}}` | Alias for company | Example Corp |
| `{{fullName}}` | Full name (first + last) | John Doe |

### Capitalized Name Tokens

| Token | Description | Example Output |
|-------|-------------|----------------|
| `{{firstNameCapitalized}}` | First name with proper capitalization | John |
| `{{lastNameCapitalized}}` | Last name with proper capitalization | Doe |
| `{{fullNameCapitalized}}` | Full name with proper capitalization | John Doe |

### Date/Time Tokens

| Token | Description | Example Output |
|-------|-------------|----------------|
| `{{currentDate}}` | Current date | 10/15/2025 |
| `{{currentTime}}` | Current time | 9:30:45 PM |
| `{{currentYear}}` | Current year | 2025 |

## Token Formats Supported

The system supports multiple token formats:

- `{{tokenName}}` - Double curly braces (recommended)
- `{tokenName}` - Single curly braces
- `[tokenName]` - Square brackets

## HTML Formatting Features

### Automatic HTML Enhancement

The system automatically enhances HTML content with:

1. **Complete HTML Structure**: Adds `<html>`, `<head>`, and `<body>` tags if missing
2. **Responsive Design**: Includes viewport meta tag and mobile-friendly styling
3. **Default Styling**: Applies consistent styling to common HTML elements
4. **Line Break Conversion**: Converts plain text line breaks to HTML `<br>` tags
5. **Paragraph Wrapping**: Automatically wraps content in `<p>` tags when appropriate

### Supported HTML Elements

The system preserves and enhances these HTML elements:

- **Headings**: `<h1>`, `<h2>`, `<h3>` with automatic styling
- **Paragraphs**: `<p>` with proper spacing
- **Lists**: `<ul>`, `<ol>`, `<li>` with indentation
- **Text Formatting**: `<strong>`, `<em>`, `<b>`, `<i>`
- **Line Breaks**: `<br>` for single line breaks
- **Links**: `<a href="">` for clickable links
- **Images**: `<img>` for embedded images

### Automatic Text Version Generation

The system automatically generates plain text versions from HTML content:

- Converts headings to uppercase with underlines
- Converts paragraphs to line breaks
- Converts list items to bullet points
- Removes HTML tags while preserving structure
- Decodes HTML entities

## Usage Examples

### Basic Token Replacement

**Email Subject:**
```
Welcome {{firstName}} to {{companyName}}!
```

**Output:**
```
Welcome John to Example Corp!
```

### Rich HTML Email Body

**Input:**
```html
<h1>Welcome {{firstNameCapitalized}}!</h1>

<p>Thank you for joining <strong>{{companyName}}</strong>. We're excited to have you on board.</p>

<h2>Your Account Details</h2>
<ul>
  <li>Email: {{email}}</li>
  <li>Full Name: {{fullNameCapitalized}}</li>
  <li>Company: {{companyName}}</li>
  <li>Registration Date: {{currentDate}}</li>
</ul>

<p>Best regards,<br>
The {{companyName}} Team</p>
```

**Output:**
```html
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email</title>
  </head>
  <body style="font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1 style="color: #2c3e50; margin-bottom: 20px;">Welcome John!</h1>

    <p style="margin-bottom: 15px;">Thank you for joining <strong>Example Corp</strong>. We're excited to have you on board.</p>

    <h2 style="color: #34495e; margin-bottom: 15px;">Your Account Details</h2>
    <ul style="margin-bottom: 15px; padding-left: 20px;">
      <li style="margin-bottom: 5px;">Email: john.doe@example.com</li>
      <li style="margin-bottom: 5px;">Full Name: John Doe</li>
      <li style="margin-bottom: 5px;">Company: Example Corp</li>
      <li style="margin-bottom: 5px;">Registration Date: 10/15/2025</li>
    </ul>

    <p style="margin-bottom: 15px;">Best regards,<br>
    The Example Corp Team</p>
  </body>
</html>
```

### Plain Text Conversion

The same HTML content automatically generates this plain text version:

```
WELCOME JOHN!
==================================================

Thank you for joining Example Corp. We're excited to have you on board.

YOUR ACCOUNT DETAILS
==================================================
• Email: john.doe@example.com
• Full Name: John Doe
• Company: Example Corp
• Registration Date: 10/15/2025

Best regards,
The Example Corp Team
```

## Advanced Features

### Fallback Values

If a token value is missing or empty, the system provides safe fallbacks:

- Empty string for missing contact information
- Email address as fallback for missing names
- Current date/time for timestamp tokens

### Token Validation

The system includes validation functions to:

- Extract all tokens from email content
- Identify missing token values
- Preview emails with token replacements
- Generate sample data for testing

### XSS Prevention

For HTML emails, the system automatically sanitizes token values to prevent XSS attacks:

- Escapes HTML entities (`<`, `>`, `&`, `"`, `'`)
- Preserves intended HTML structure
- Maintains email formatting integrity

## Best Practices

### 1. Use Descriptive Tokens

```html
<!-- Good -->
<h1>Welcome {{firstNameCapitalized}}!</h1>
<p>Thank you for joining {{companyName}}.</p>

<!-- Avoid -->
<h1>Welcome {{firstName}}!</h1> <!-- May be lowercase -->
<p>Thank you for joining {{company}}.</p> <!-- Less descriptive -->
```

### 2. Provide Fallback Content

```html
<!-- Good -->
<p>Hello {{firstName}},</p>
<p>Welcome to {{companyName}}!</p>

<!-- Better with context -->
<p>Hello {{firstName}},</p>
<p>Welcome to {{companyName}}! We're excited to have you join our community.</p>
```

### 3. Structure HTML Properly

```html
<!-- Good structure -->
<h1>Main Heading</h1>
<p>Introduction paragraph.</p>

<h2>Section Heading</h2>
<ul>
  <li>List item 1</li>
  <li>List item 2</li>
</ul>

<p>Conclusion paragraph.</p>
```

### 4. Test Token Replacement

Always test your email templates with sample data to ensure:

- All tokens are replaced correctly
- HTML formatting is preserved
- Plain text version is readable
- Email displays properly across clients

## API Integration

### Creating Sequences with Tokens

```json
POST /api/sequences
{
  "name": "Welcome Sequence",
  "steps": [
    {
      "stepOrder": 1,
      "subject": "Welcome {{firstNameCapitalized}} to {{companyName}}!",
      "body": "<h1>Welcome {{firstNameCapitalized}}!</h1><p>Thank you for joining {{companyName}}.</p>",
      "delayDays": 0
    }
  ]
}
```

### Testing Token Replacement

Use the token replacement utility functions:

```javascript
const { replaceTokens, generateSampleData } = require('./src/utils/tokenReplace');

const sampleData = generateSampleData();
const processedSubject = replaceTokens('Welcome {{firstName}}!', sampleData);
console.log(processedSubject); // "Welcome John!"
```

## Troubleshooting

### Common Issues

1. **Tokens not replaced**: Check token spelling and format
2. **HTML not formatted**: Ensure proper HTML structure
3. **Missing contact data**: Verify contact information is complete
4. **Plain text issues**: Check HTML-to-text conversion

### Debug Mode

Enable detailed logging to troubleshoot token replacement:

```javascript
// In development environment
const processedContent = replaceTokens(content, contactData, { debug: true });
```

## Migration from Old System

If migrating from an older token system:

1. **Update token format**: Change `{token}` to `{{token}}`
2. **Add new tokens**: Use `{{companyName}}` instead of `{{company}}`
3. **Test HTML formatting**: Verify enhanced HTML output
4. **Check plain text**: Review auto-generated text versions

This enhanced email formatting system ensures professional, personalized, and well-formatted emails that work across all email clients while maintaining security and reliability.
