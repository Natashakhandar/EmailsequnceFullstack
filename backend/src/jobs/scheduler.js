const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { sendEmail, sendSequenceEmail, verifyConnection } = require('../mailer/sendEmail');
const { startEmailMonitoring } = require('./emailMonitorJob');
const prisma = require('../db/prismaClient');

let isSchedulerRunning = false;
let schedulerTask = null;

// Check if the next email in sequence should be sent based on trigger conditions
async function shouldSendNextEmail(enrollment) {
  try {
    const { currentStep, lastSentStep, sequence, events } = enrollment;

    console.log(`🔍 Checking send conditions for enrollment ${enrollment.id}, step ${currentStep}`);

    // Prevent duplicate sends - check if current step was already sent
    if (lastSentStep && lastSentStep >= currentStep) {
      return {
        send: false,
        reason: `Step ${currentStep} already sent (lastSentStep: ${lastSentStep})`,
        action: 'wait'
      };
    }

    // Get current step configuration
    const currentStepConfig = sequence.steps.find(step => step.stepOrder === currentStep);
    if (!currentStepConfig) {
      return {
        send: false,
        reason: `No configuration found for step ${currentStep}`,
        action: 'complete'
      };
    }

    // Get sequence trigger configuration
    const sequenceTrigger = await prisma.sequenceTrigger.findUnique({
      where: { sequenceId: sequence.id },
      include: {
        triggerStep: true
      }
    });

    // For step 1 (intro email), always send if not already sent
    if (currentStep === 1) {
      return { send: true, reason: 'First step - ready to send' };
    }

    // If no trigger is configured, use delay-based logic (backward compatibility)
    if (!sequenceTrigger) {
      console.log('⚠️ No trigger configured, using delay-based logic');
      return await shouldSendNextEmailDelayBased(enrollment);
    }

    // Check if we've reached the trigger step
    if (currentStep === sequenceTrigger.triggerStep.stepOrder) {
      console.log(`🎯 Current step ${currentStep} is the trigger step`);

      // Find the previous step's sent event
      const previousStep = currentStep - 1;
      const previousStepSentEvent = events.find(event =>
        event.type === 'SENT' &&
        event.details &&
        JSON.parse(event.details).stepOrder === previousStep
      );

      if (!previousStepSentEvent) {
        return {
          send: false,
          reason: `Previous step ${previousStep} not sent yet`,
          action: 'wait'
        };
      }

      // Check if previous email was opened or replied
      const previousEmailId = previousStepSentEvent.emailId;
      const hasOpened = events.some(event =>
        event.type === 'OPENED' && event.emailId === previousEmailId
      );
      const hasReplied = events.some(event =>
        event.type === 'REPLIED' && event.emailId === previousEmailId
      );

      // If they replied, complete the sequence (don't send more emails)
      if (hasReplied) {
        return {
          send: false,
          reason: 'Contact replied - completing sequence',
          action: 'complete'
        };
      }

      // Check delay period for trigger step
      const sentTime = new Date(previousStepSentEvent.timestamp);
      const delayMs = (currentStepConfig.delayDays * 24 * 60 * 60 * 1000) +
        (currentStepConfig.delayHours * 60 * 60 * 1000) +
        (currentStepConfig.delayMinutes * 60 * 1000);
      const shouldSendAfter = new Date(sentTime.getTime() + delayMs);

      if (new Date() < shouldSendAfter) {
        return {
          send: false,
          reason: `Still within delay period. Will send after ${shouldSendAfter.toISOString()}`,
          action: 'wait'
        };
      }

      // Trigger step logic: send if previous email was opened
      if (hasOpened) {
        return {
          send: true,
          reason: `Trigger step ${currentStep}: Previous email was opened - sending trigger email`
        };
      } else {
        return {
          send: false,
          reason: `Trigger step ${currentStep}: Waiting for previous email to be opened`,
          action: 'wait'
        };
      }
    }

    // For steps after the trigger step, use delay-based logic
    if (currentStep > sequenceTrigger.triggerStep.stepOrder) {
      console.log(`📅 Step ${currentStep} is after trigger step, using delay-based logic`);
      return await shouldSendNextEmailDelayBased(enrollment);
    }

    // For steps before the trigger step, use delay-based logic
    console.log(`📅 Step ${currentStep} is before trigger step, using delay-based logic`);
    return await shouldSendNextEmailDelayBased(enrollment);

  } catch (error) {
    console.error('Error in shouldSendNextEmail:', error);
    return {
      send: false,
      reason: `Error checking conditions: ${error.message}`,
      action: 'wait'
    };
  }
}

// Fallback delay-based logic for backward compatibility
async function shouldSendNextEmailDelayBased(enrollment) {
  try {
    const { currentStep, sequence, events } = enrollment;

    // For subsequent steps, check conditions based on previous step
    const previousStep = currentStep - 1;

    // Find the last sent event for the previous step
    const previousStepSentEvent = events.find(event =>
      event.type === 'SENT' &&
      event.details &&
      JSON.parse(event.details).stepOrder === previousStep
    );

    if (!previousStepSentEvent) {
      return {
        send: false,
        reason: `Previous step ${previousStep} not sent yet`,
        action: 'wait'
      };
    }

    // Get current step configuration
    const currentStepConfig = sequence.steps.find(step => step.stepOrder === currentStep);
    if (!currentStepConfig) {
      return {
        send: false,
        reason: `No configuration found for step ${currentStep}`,
        action: 'complete'
      };
    }

    // Check delay period
    const sentTime = new Date(previousStepSentEvent.timestamp);
    const delayMs = (currentStepConfig.delayDays * 24 * 60 * 60 * 1000) +
      (currentStepConfig.delayHours * 60 * 60 * 1000) +
      (currentStepConfig.delayMinutes * 60 * 1000);
    const shouldSendAfter = new Date(sentTime.getTime() + delayMs);

    if (new Date() >= shouldSendAfter) {
      return { send: true, reason: `Delay period passed - sending step ${currentStep}` };
    } else {
      return {
        send: false,
        reason: `Still within delay period. Will send after ${shouldSendAfter.toISOString()}`,
        action: 'wait'
      };
    }

  } catch (error) {
    console.error('Error in shouldSendNextEmailDelayBased:', error);
    return {
      send: false,
      reason: `Error checking delay conditions: ${error.message}`,
      action: 'wait'
    };
  }
}

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
        },
        events: {
          orderBy: { timestamp: 'desc' }
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
        // Double-check status and lastSentStep just before processing to catch race conditions 
        // (especially between Local and Production instances)
        const freshEnrollment = await prisma.enrollment.findUnique({
          where: { id: enrollment.id }
        });
        
        if (!freshEnrollment || freshEnrollment.status !== 'ACTIVE' || 
            (freshEnrollment.lastSentStep && freshEnrollment.lastSentStep >= freshEnrollment.currentStep)) {
          console.log(`🔍 skipping enrollment ${enrollment.id} - already processed by another instance`);
          continue;
        }

        // Lock this enrollment immediately to prevent other instances from picking it up
        await prisma.enrollment.update({
          where: { id: enrollment.id },
          data: { lastSentStep: enrollment.currentStep }
        });

        // Add a small delay between emails to avoid overwhelming SMTP server
        if (successCount > 0) {
          await new Promise(resolve => setTimeout(resolve, 300)); 
        }
        
        // Check if this step should be sent based on sequence logic
        const shouldSend = await shouldSendNextEmail({ ...enrollment, lastSentStep: enrollment.currentStep });

        if (!shouldSend.send) {
          console.log(`⏭️ Skipping enrollment ${enrollment.id}: ${shouldSend.reason}`);

          // Update enrollment based on the reason
          if (shouldSend.action === 'complete') {
            await prisma.enrollment.update({
              where: { id: enrollment.id },
              data: {
                status: 'COMPLETED',
                completedAt: new Date(),
                nextSendAt: null
              }
            });
          } else if (shouldSend.action === 'wait') {
            // Update nextSendAt to check again later
            const nextCheck = new Date();
            nextCheck.setHours(nextCheck.getHours() + 1); // Check again in 1 hour
            await prisma.enrollment.update({
              where: { id: enrollment.id },
              data: { nextSendAt: nextCheck }
            });
          }
          continue;
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

  // Main email processing task - runs every 60 seconds to conserve DB connections on Hostinger
  schedulerTask = cron.schedule('0 * * * * *', async () => {
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

  // Start email monitoring for automatic reply detection
  startEmailMonitoring();

  console.log('✅ Email scheduler started successfully');
  console.log('📅 Schedule: Every minute for email processing');
  console.log('🧹 Daily cleanup at 2:00 AM');
  console.log('🔍 SMTP health check every 30 minutes');
  console.log('📧 Email monitoring for replies enabled');

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
    isRunning: schedulerTask ? true : false,
    isProcessing: isSchedulerRunning,
    nextRun: schedulerTask ? 'Every minute' : null,
    lastRun: new Date().toISOString()
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
