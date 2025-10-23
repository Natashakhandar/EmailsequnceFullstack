# Email Sequencing Backend

A powerful Node.js backend for automated email sequencing and marketing automation. Built with Express, Prisma, and MySQL for scalability and reliability.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
npx prisma migrate dev

# Start development server
npm run dev
```

The server will start on `http://localhost:3001`

## 📁 Project Structure

```
backend/
├── src/                    # Source code
│   ├── routes/            # API routes
│   ├── mailer/            # Email sending logic
│   ├── jobs/              # Background jobs & scheduler
│   ├── middleware/        # Authentication & validation
│   ├── config/            # Configuration files
│   ├── db/                # Database client
│   └── utils/             # Utility functions
├── prisma/                # Database schema & migrations
├── docs/                  # Documentation & guides
└── package.json           # Dependencies & scripts
```

## 📚 Documentation

All detailed documentation has been organized in the [`docs/`](./docs/) folder:

### 📖 **Core Documentation**
- **[Complete README](./docs/README.md)** - Full setup guide and features
- **[API Documentation](./docs/TRIGGER_SYSTEM_API.md)** - Complete API reference
- **[Email Activity API](./docs/EMAIL_ACTIVITY_API.md)** - Email tracking endpoints

### 🔧 **Implementation Guides**
- **[Signature Implementation](./docs/SIGNATURE_IMPLEMENTATION.md)** - Email signature system
- **[Email Formatting Guide](./docs/EMAIL_FORMATTING_GUIDE.md)** - Email template formatting
- **[Tracking Features](./docs/TRACKING_FEATURES.md)** - Email tracking implementation

### 🛠️ **Technical References**
- **[Admin Management](./docs/ADMIN_MANAGEMENT.md)** - Admin user management
- **[Profile Routes](./docs/PROFILE_ROUTES_SUMMARY.md)** - User profile endpoints
- **[Payload Examples](./docs/PAYLOAD_EXAMPLES.md)** - API request/response examples

### 🐛 **Fix Documentation**
- **[Single Email Integrity Fix](./docs/SINGLE_EMAIL_INTEGRITY_FIX.md)** - Email splitting prevention
- **[Template Truncation Fix](./docs/TEMPLATE_TRUNCATION_FIX.md)** - Template size limits fix
- **[Email Fixes Summary](./docs/EMAIL_FIXES_SUMMARY.md)** - All email-related fixes
- **[Final Fixes Summary](./docs/FINAL_FIXES_SUMMARY.md)** - Complete fix documentation
- **[Fixes Summary](./docs/FIXES_SUMMARY.md)** - General fixes overview

## 🔑 Key Features

- ✅ **Contact Management** - Store and manage prospect information
- ✅ **Email Templates** - Create reusable templates with token replacement  
- ✅ **Sequence Builder** - Multi-step email sequences with custom delays
- ✅ **Automated Scheduling** - Background email sending with cron jobs
- ✅ **Event Tracking** - Track opens, clicks, replies, bounces
- ✅ **Unsubscribe Handling** - One-click unsubscribe management
- ✅ **SMTP Integration** - Works with any SMTP provider
- ✅ **Analytics & Reporting** - Comprehensive email analytics
- ✅ **REST API** - Full API for frontend integration

## 🛡️ Production Ready

This backend includes:
- Comprehensive logging and error handling
- Email integrity safeguards
- Database schema optimizations
- Authentication and authorization
- Rate limiting and security middleware
- Background job processing
- Email delivery confirmation

## 📞 Support

For detailed setup instructions, API documentation, and troubleshooting guides, please refer to the documentation in the [`docs/`](./docs/) folder.
