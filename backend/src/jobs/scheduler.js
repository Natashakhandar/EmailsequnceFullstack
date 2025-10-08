const cron = require('node-cron');
const prisma = require('../db/prismaClient');
const { sendSequenceEmail, verifyConnection } = require('../mailer/sendEmail');

let isSchedulerRunning = false;
let schedulerTask = null;

// Process due emails
async function processDueEmails() {
  if (isSchedulerRunning) {
    console.log('⏳ Email processing already in progress, skipping...');
    return;
  }

  try {
    isSchedulerRunning = true;
    console.log('🔄 Starting email processing cycle...');

    // Find all enrollments that are due for sending
    const dueEnrollments = await prisma.enrollment.findMany({
      where: {
        status: 'ACTIVE',
        nextSendAt: {
          lte: new Date()
        }
      },
      include: {
        contact: true,
        sequence: {
          include: {
            steps: {
              orderBy: { stepOrder: 'asc' }
            }
          }
        }
      },
      orderBy: {
        nextSendAt: 'asc'
      }
    });

    if (dueEnrollments.length === 0) {
      console.log('📭 No emails due for sending');
      return;
    }

    console.log(`📬 Found ${dueEnrollments.length} emails due for sending`);

    let successCount = 0;
    let errorCount = 0;

    // Process each enrollment
    for (const enrollment of dueEnrollments) {
      try {
        // Add a small delay between emails to avoid overwhelming SMTP server
        if (successCount > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
        }

        const result = await sendSequenceEmail(enrollment);
        
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
          console.log(`❌ Failed to send email for enrollment ${enrollment.id}: ${result.error || result.reason}`);
        }

      } catch (error) {
        errorCount++;
        console.error(`❌ Error processing enrollment ${enrollment.id}:`, error.message);
        
        // Mark enrollment as stopped on critical errors
        try {
          await prisma.enrollment.update({
            where: { id: enrollment.id },
            data: { 
              status: 'STOPPED',
              completedAt: new Date(),
              nextSendAt: null
            }
          });
        } catch (updateError) {
          console.error('Failed to update enrollment after error:', updateError);
        }
      }
    }

    console.log(`✅ Email processing completed: ${successCount} sent, ${errorCount} failed`);

  } catch (error) {
    console.error('❌ Critical error in email processing:', error);
  } finally {
    isSchedulerRunning = false;
  }
}

// Clean up old events (optional maintenance task)
async function cleanupOldEvents() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const deletedCount = await prisma.event.deleteMany({
      where: {
        timestamp: {
          lt: thirtyDaysAgo
        },
        type: {
          in: ['SENT', 'DELIVERED'] // Keep important events like REPLIED, UNSUBSCRIBED
        }
      }
    });

    if (deletedCount.count > 0) {
      console.log(`🧹 Cleaned up ${deletedCount.count} old events`);
    }
  } catch (error) {
    console.error('Error cleaning up old events:', error);
  }
}

// Clean up old unsubscribe tokens
async function cleanupOldTokens() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const deletedCount = await prisma.unsubscribeToken.deleteMany({
      where: {
        OR: [
          {
            usedAt: {
              lt: thirtyDaysAgo
            }
          },
          {
            createdAt: {
              lt: thirtyDaysAgo
            },
            usedAt: null
          }
        ]
      }
    });

    if (deletedCount.count > 0) {
      console.log(`🧹 Cleaned up ${deletedCount.count} old unsubscribe tokens`);
    }
  } catch (error) {
    console.error('Error cleaning up old tokens:', error);
  }
}

// Health check for SMTP connection
async function healthCheck() {
  try {
    const isConnected = await verifyConnection();
    if (!isConnected) {
      console.warn('⚠️ SMTP connection health check failed');
    }
  } catch (error) {
    console.error('Error in SMTP health check:', error);
  }
}

// Start the scheduler
function startScheduler() {
  if (schedulerTask) {
    console.log('⚠️ Scheduler is already running');
    return;
  }

  console.log('🚀 Starting email scheduler...');

  // Main email processing task - runs every minute
  schedulerTask = cron.schedule('* * * * *', async () => {
    await processDueEmails();
  }, {
    scheduled: false,
    timezone: process.env.SCHEDULER_TIMEZONE || 'UTC'
  });

  // Cleanup tasks - run daily at 2 AM
  cron.schedule('0 2 * * *', async () => {
    console.log('🧹 Running daily cleanup tasks...');
    await cleanupOldEvents();
    await cleanupOldTokens();
  }, {
    scheduled: true,
    timezone: process.env.SCHEDULER_TIMEZONE || 'UTC'
  });

  // SMTP health check - run every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    await healthCheck();
  }, {
    scheduled: true,
    timezone: process.env.SCHEDULER_TIMEZONE || 'UTC'
  });

  // Start the main scheduler
  schedulerTask.start();
  
  console.log('✅ Email scheduler started successfully');
  console.log('📅 Schedule: Every minute for email processing');
  console.log('🧹 Daily cleanup at 2:00 AM');
  console.log('🔍 SMTP health check every 30 minutes');

  // Run initial health check
  setTimeout(healthCheck, 5000); // Wait 5 seconds after startup
}

// Stop the scheduler
function stopScheduler() {
  if (schedulerTask) {
    schedulerTask.stop();
    schedulerTask = null;
    console.log('🛑 Email scheduler stopped');
  }
}

// Get scheduler status
function getSchedulerStatus() {
  return {
    isRunning: schedulerTask ? schedulerTask.getStatus() !== 'stopped' : false,
    isProcessing: isSchedulerRunning,
    nextRun: schedulerTask ? 'Every minute' : null
  };
}

// Manual trigger for email processing (for testing)
async function triggerEmailProcessing() {
  console.log('🔧 Manually triggering email processing...');
  await processDueEmails();
}

// Get pending emails count
async function getPendingEmailsCount() {
  try {
    const count = await prisma.enrollment.count({
      where: {
        status: 'ACTIVE',
        nextSendAt: {
          lte: new Date()
        }
      }
    });
    return count;
  } catch (error) {
    console.error('Error getting pending emails count:', error);
    return 0;
  }
}

// Get scheduler statistics
async function getSchedulerStats() {
  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      pendingEmails,
      activeEnrollments,
      todayEvents
    ] = await Promise.all([
      getPendingEmailsCount(),
      prisma.enrollment.count({
        where: { status: 'ACTIVE' }
      }),
      prisma.event.groupBy({
        by: ['type'],
        where: {
          timestamp: {
            gte: oneDayAgo
          }
        },
        _count: {
          type: true
        }
      })
    ]);

    const eventStats = todayEvents.reduce((acc, stat) => {
      acc[stat.type.toLowerCase()] = stat._count.type;
      return acc;
    }, {});

    return {
      status: getSchedulerStatus(),
      pendingEmails,
      activeEnrollments,
      last24Hours: {
        sent: eventStats.sent || 0,
        delivered: eventStats.delivered || 0,
        opened: eventStats.opened || 0,
        clicked: eventStats.clicked || 0,
        replied: eventStats.replied || 0,
        bounced: eventStats.bounced || 0,
        failed: eventStats.failed || 0
      }
    };
  } catch (error) {
    console.error('Error getting scheduler stats:', error);
    return {
      status: getSchedulerStatus(),
      pendingEmails: 0,
      activeEnrollments: 0,
      last24Hours: {},
      error: error.message
    };
  }
}

module.exports = {
  startScheduler,
  stopScheduler,
  getSchedulerStatus,
  triggerEmailProcessing,
  getPendingEmailsCount,
  getSchedulerStats,
  processDueEmails
};
