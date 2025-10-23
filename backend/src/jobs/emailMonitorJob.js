const cron = require('node-cron');
const EmailMonitorService = require('../services/emailMonitor');

let isRunning = false;

// Function to check for email replies
async function checkForReplies() {
  if (isRunning) {
    console.log('⏳ Email monitoring job already running, skipping...');
    return;
  }

  try {
    isRunning = true;
    console.log('🔍 Starting scheduled email reply check...');
    
    const monitor = new EmailMonitorService();
    const processedCount = await monitor.processReplyEmails();
    
    if (processedCount > 0) {
      console.log(`✅ Email monitoring: Found and processed ${processedCount} new replies`);
    } else {
      console.log('📭 Email monitoring: No new replies found');
    }
  } catch (error) {
    console.error('❌ Email monitoring job error:', error.message);
  } finally {
    isRunning = false;
  }
}

// Start the email monitoring scheduler
function startEmailMonitoring() {
  // Check if email monitoring is configured
  const isConfigured = !!(process.env.IMAP_HOST || process.env.SMTP_HOST) && 
                      !!(process.env.IMAP_USER || process.env.SMTP_USER) && 
                      !!(process.env.IMAP_PASSWORD || process.env.SMTP_PASSWORD);

  if (!isConfigured) {
    console.log('⚠️  Email monitoring not configured. Add IMAP credentials to .env file to enable automatic reply detection.');
    return;
  }

  console.log('📧 Starting email monitoring scheduler...');
  
  // Run every 5 minutes to check for new replies
  cron.schedule('*/5 * * * *', checkForReplies, {
    scheduled: true,
    timezone: "UTC"
  });

  console.log('✅ Email monitoring scheduler started (runs every 5 minutes)');
  
  // Run initial check after 30 seconds
  setTimeout(() => {
    console.log('🚀 Running initial email reply check...');
    checkForReplies();
  }, 30000);
}

// Stop the email monitoring (if needed)
function stopEmailMonitoring() {
  console.log('🛑 Email monitoring scheduler stopped');
}

// Manual trigger function
async function triggerManualCheck() {
  console.log('🔄 Manual email reply check triggered');
  return await checkForReplies();
}

module.exports = {
  startEmailMonitoring,
  stopEmailMonitoring,
  triggerManualCheck,
  checkForReplies
};
