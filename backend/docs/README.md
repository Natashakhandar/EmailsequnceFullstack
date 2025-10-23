# Email Sequencing Backend

A powerful Node.js backend for automated email sequencing and marketing automation. Built with Express, Prisma, and SQLite for simplicity and scalability.

## 🚀 Features

- **Contact Management**: Store and manage prospect information
- **Email Templates**: Create reusable email templates with token replacement
- **Sequence Builder**: Build multi-step email sequences with custom delays
- **Automated Scheduling**: Send emails automatically based on sequence timing
- **Event Tracking**: Track sent, delivered, opened, clicked, replied, and bounced emails
- **Unsubscribe Handling**: Automatic unsubscribe management with one-click links
- **SMTP Integration**: Works with any SMTP provider (Gmail, SendGrid, etc.)
- **Analytics**: Comprehensive analytics and reporting
- **REST API**: Full REST API for frontend integration

## 📋 Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- SMTP email account (Gmail, Outlook, SendGrid, etc.)

## 🛠️ Installation

1. **Clone and navigate to the backend directory**
   ```bash
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` file with your configuration:
   ```env
   # Database
   DATABASE_URL="file:./dev.db"
   
   # Server
   PORT=3001
   NODE_ENV=development
   
   # SMTP Configuration
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   
   # Email Settings
   FROM_EMAIL=your-email@gmail.com
   FROM_NAME="Your Company Name"
   REPLY_TO_EMAIL=replies@yourcompany.com
   
   # App URL (for unsubscribe links)
   APP_URL=http://localhost:3001
   ```

4. **Initialize the database**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. **Start the server**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

## 📧 SMTP Setup

### Gmail Setup
1. Enable 2-Factor Authentication on your Gmail account
2. Generate an App Password:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate password for "Mail"
3. Use the generated password in `SMTP_PASS`

### Other SMTP Providers
- **SendGrid**: Use API key as password
- **Mailgun**: Use domain and API key
- **Outlook**: Use regular credentials with app password

## 🗄️ Database Schema

The system uses the following main entities:

- **Contacts**: Store prospect information
- **Templates**: Email templates with token support
- **Sequences**: Multi-step email sequences
- **SequenceSteps**: Individual steps in sequences
- **Enrollments**: Track contact progress through sequences
- **Events**: Log all email interactions
- **UnsubscribeTokens**: Manage unsubscribe requests

## 🔌 API Endpoints

### Health & Status
- `GET /health` - Health check
- `GET /api/scheduler/status` - Scheduler status
- `GET /api/scheduler/stats` - Detailed statistics

### Contacts
- `GET /api/contacts` - List contacts
- `POST /api/contacts` - Create contact
- `GET /api/contacts/:id` - Get contact details
- `PUT /api/contacts/:id` - Update contact
- `DELETE /api/contacts/:id` - Delete contact
- `POST /api/contacts/bulk` - Bulk import contacts

### Templates
- `GET /api/templates` - List templates
- `POST /api/templates` - Create template
- `GET /api/templates/:id` - Get template
- `PUT /api/templates/:id` - Update template
- `DELETE /api/templates/:id` - Delete template
- `POST /api/templates/:id/preview` - Preview template

### Sequences
- `GET /api/sequences` - List sequences
- `POST /api/sequences` - Create sequence
- `GET /api/sequences/:id` - Get sequence details
- `PUT /api/sequences/:id` - Update sequence
- `DELETE /api/sequences/:id` - Delete sequence
- `POST /api/sequences/:id/steps` - Add step to sequence
- `GET /api/sequences/:id/analytics` - Sequence analytics

### Enrollments
- `GET /api/enrollments` - List enrollments
- `POST /api/enrollments` - Enroll contact in sequence
- `GET /api/enrollments/:id` - Get enrollment details
- `PUT /api/enrollments/:id` - Update enrollment
- `POST /api/enrollments/:id/pause` - Pause enrollment
- `POST /api/enrollments/:id/resume` - Resume enrollment
- `POST /api/enrollments/:id/stop` - Stop enrollment
- `POST /api/enrollments/bulk` - Bulk enroll contacts

### Events & Analytics
- `GET /api/events` - List events
- `GET /api/events/analytics/summary` - Analytics summary
- `GET /api/events/analytics/timeline` - Events timeline

### Scheduler Management
- `GET /api/scheduler/status` - Scheduler status
- `POST /api/scheduler/trigger` - Manually trigger email processing
- `POST /api/scheduler/test-email` - Send test email
- `GET /api/scheduler/smtp-status` - Check SMTP connection

## 🎯 Token System

Templates support dynamic token replacement:

### Supported Tokens
- `{{firstName}}` - Contact's first name
- `{{lastName}}` - Contact's last name
- `{{email}}` - Contact's email
- `{{company}}` - Contact's company
- `{{fullName}}` - Full name (firstName + lastName)
- `{{currentDate}}` - Current date
- `{{currentTime}}` - Current time

### Token Formats
- `{{token}}` - Double curly braces
- `{token}` - Single curly braces
- `[token]` - Square brackets

### Example Template
```html
Subject: Hi {{firstName}}, let's connect!

Hi {{firstName}},

I hope this email finds you well. I noticed you work at {{company}} and thought you might be interested in our solution.

Best regards,
Your Name
```

## 📊 Usage Examples

### 1. Create a Contact
```bash
curl -X POST http://localhost:3001/api/contacts \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "company": "Example Corp"
  }'
```

### 2. Create an Email Template
```bash
curl -X POST http://localhost:3001/api/templates \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Introduction Email",
    "subject": "Hi {{firstName}}, let'\''s connect!",
    "body": "Hi {{firstName}},\n\nI hope you'\''re doing well at {{company}}.\n\nBest regards,\nYour Name"
  }'
```

### 3. Create a Sequence
```bash
curl -X POST http://localhost:3001/api/sequences \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Outreach Sequence",
    "description": "3-step outreach sequence",
    "steps": [
      {
        "templateId": "template-id-1",
        "stepOrder": 1,
        "delayDays": 0
      },
      {
        "templateId": "template-id-2", 
        "stepOrder": 2,
        "delayDays": 3
      }
    ]
  }'
```

### 4. Enroll Contact in Sequence
```bash
curl -X POST http://localhost:3001/api/enrollments \
  -H "Content-Type: application/json" \
  -d '{
    "contactId": "contact-id",
    "sequenceId": "sequence-id",
    "startImmediately": true
  }'
```

## ⚙️ Scheduler Configuration

The email scheduler runs automatically and:
- **Processes emails**: Every minute
- **Cleanup tasks**: Daily at 2:00 AM
- **Health checks**: Every 30 minutes

### Manual Controls
```bash
# Trigger email processing manually
curl -X POST http://localhost:3001/api/scheduler/trigger

# Check scheduler status
curl http://localhost:3001/api/scheduler/status

# Send test email
curl -X POST http://localhost:3001/api/scheduler/test-email \
  -H "Content-Type: application/json" \
  -d '{"to": "test@example.com"}'
```

## 🔒 Security Features

- **Rate limiting**: 100 requests per 15 minutes per IP
- **Helmet.js**: Security headers
- **Input validation**: All inputs are validated
- **SQL injection protection**: Prisma ORM prevents SQL injection
- **XSS protection**: HTML sanitization for email content

## 📈 Monitoring & Analytics

### Key Metrics Tracked
- **Delivery rates**: Successful email deliveries
- **Open rates**: Email opens (requires tracking pixels)
- **Click rates**: Link clicks in emails
- **Reply rates**: Replies to sequence emails
- **Bounce rates**: Failed deliveries
- **Unsubscribe rates**: Opt-out requests

### Analytics Endpoints
- `/api/events/analytics/summary` - Overall performance
- `/api/sequences/:id/analytics` - Sequence-specific metrics
- `/api/scheduler/stats` - System performance

## 🚀 Deployment

### Local Development
```bash
npm run dev
```

### Production Deployment

1. **Environment Setup**
   ```bash
   NODE_ENV=production
   DATABASE_URL="postgresql://user:pass@host:5432/dbname" # For PostgreSQL
   ```

2. **Build and Start**
   ```bash
   npm install --production
   npx prisma generate
   npx prisma migrate deploy
   npm start
   ```

### Docker Deployment
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
RUN npx prisma generate
EXPOSE 3001
CMD ["npm", "start"]
```

### Cloud Platforms
- **Render**: Connect GitHub repo, auto-deploy
- **Railway**: One-click deployment
- **Fly.io**: Global edge deployment
- **Heroku**: Add Heroku Postgres addon

## 🔧 Troubleshooting

### Common Issues

1. **SMTP Connection Failed**
   - Verify SMTP credentials
   - Check firewall settings
   - Enable "Less secure app access" for Gmail

2. **Database Connection Error**
   - Ensure DATABASE_URL is correct
   - Run `npx prisma db push`

3. **Emails Not Sending**
   - Check scheduler status: `GET /api/scheduler/status`
   - Verify enrollments: `GET /api/enrollments`
   - Check SMTP status: `GET /api/scheduler/smtp-status`

4. **High Memory Usage**
   - Increase cleanup frequency
   - Limit concurrent email processing

### Debug Mode
```bash
NODE_ENV=development npm run dev
```

## 📝 Development

### Database Changes
```bash
# Make schema changes in prisma/schema.prisma
npx prisma db push          # Push changes to database
npx prisma generate         # Regenerate client
npx prisma studio          # Open database browser
```

### Adding New Features
1. Update Prisma schema if needed
2. Create/update routes in `src/routes/`
3. Add business logic in appropriate modules
4. Update API documentation

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -am 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For support and questions:
- Create an issue on GitHub
- Check the troubleshooting section
- Review API documentation

---

**Built with ❤️ for email marketing automation**
