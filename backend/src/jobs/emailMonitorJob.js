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

    const prisma = require('../db/prismaClient');
    const allConfigs = await prisma.emailConfig.findMany();
    let totalProcessed = 0;

    // Check each user's custom IMAP
    for (const config of allConfigs) {
      if (config.imapHost && config.imapUser && config.imapPassword) {
        try {
          const monitor = new EmailMonitorService(config);
          const processedCount = await monitor.processReplyEmails();
          totalProcessed += processedCount;
          if (processedCount > 0) {
            console.log(`✅ User ${config.userId}: Processed ${processedCount} new replies`);
          }
        } catch (err) {
          console.error(`❌ User ${config.userId}: Error checking replies:`, err.message);
        }
      }
    }

    // We only check user-specific IMAP configs now to avoid global fallback errors
    // If a global config is needed, it should be added to the emailConfig table for a system account

    if (totalProcessed > 0) {
      console.log(`✅ Email monitoring: Found and processed total ${totalProcessed} new replies`);
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
  console.log('🚀 Starting email monitoring scheduler...');

  // Run every 5 minutes to check for new replies
  cron.schedule('*/2 * * * *', checkForReplies, {
    scheduled: true,
    timezone: "UTC"
  });

  console.log('Email monitoring scheduler started (runs every 2 minutes)');

  // Run initial check after 60 seconds to avoid connection spike on startup
  setTimeout(() => {
    console.log('🔄 Initial email monitoring check...');
    checkForReplies().catch(err => console.error('Initial monitoring check failed:', err.message));
  }, 10000);
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
