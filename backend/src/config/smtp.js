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

const resolvedAppUrl = (() => {
  const envUrl = process.env.APP_URL || 
                 process.env.BACKEND_URL || 
                 process.env.API_URL;
  
  // If APP_URL is set and not localhost, use it
  if (envUrl && !envUrl.includes('localhost')) {
    return envUrl.replace(/\/$/, '');
  }
  
  // In production, use the BACKEND domain (NOT the frontend domain!)
  // If we are on Hostinger, forced production URL is best for tracking
  const isHostinger = process.env.USER === 'u321303254' || process.env.HOME?.includes('hostingersite.com');
  
  if (process.env.NODE_ENV === 'production' || isHostinger) {
    return 'https://silver-tapir-929419.hostingersite.com';
  }
  
  // Fallback for development
  return 'http://localhost:3001';
})();

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
