require('dotenv').config();

const smtpConfig = {
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  // Additional security options
  tls: {
    rejectUnauthorized: false
  }
};

const resolvedAppUrl = (
  process.env.APP_URL ||
  process.env.BACKEND_URL ||
  process.env.API_URL ||
  'http://localhost:3001'
).replace(/\/$/, '');

const emailConfig = {
  from: {
    name: process.env.FROM_NAME || 'Email Sequencing System',
    address: process.env.FROM_EMAIL
  },
  replyTo: process.env.REPLY_TO_EMAIL,
  bounceAddress: process.env.BOUNCE_EMAIL,
  appUrl: resolvedAppUrl
};

module.exports = {
  smtpConfig,
  emailConfig
};
