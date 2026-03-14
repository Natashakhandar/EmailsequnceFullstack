const prisma = require('../db/prismaClient');

class WarmupManager {
  /**
   * Get or create warmup settings for a user
   */
  async getSettings(userId) {
    let settings = await prisma.warmupSettings.findUnique({
      where: { userId }
    });

    if (!settings) {
      settings = await prisma.warmupSettings.create({
        data: {
          userId,
          isEnabled: false,
          currentBatchSize: 10,
          dailyIncrement: 5,
          maxLimit: 200,
          dailySentCount: 0,
          lastSentDate: new Date()
        }
      });
    }

    return settings;
  }

  /**
   * Update warmup settings
   */
  async updateSettings(userId, data) {
    return await prisma.warmupSettings.upsert({
      where: { userId },
      update: data,
      create: {
        userId,
        ...data
      }
    });
  }

  /**
   * ATOMIC: Check if user can send an email and "claim" a slot by incrementing the count.
   * This prevents race conditions where multiple processes check the limit at once.
   * Returns true if slot was claimed, false otherwise.
   */
  async claimWarmupSlot(userId) {
    // 1. Get the CURRENT settings to see where we stand
    const settings = await this.getSettings(userId);
    
    if (!settings.isEnabled) return true;

    // 2. Check for Day Reset
    const lastDate = new Date(settings.lastSentDate);
    const today = new Date();
    
    const isNewDay = lastDate.getUTCDate() !== today.getUTCDate() || 
                     lastDate.getUTCMonth() !== today.getUTCMonth() ||
                     lastDate.getUTCFullYear() !== today.getUTCFullYear();

    if (isNewDay) {
      // It's a new day, handle increment logic
      let newBatchSize = settings.currentBatchSize;
      if (settings.dailySentCount >= settings.currentBatchSize * 0.8) {
        newBatchSize = Math.min(settings.maxLimit, settings.currentBatchSize + settings.dailyIncrement);
      }

      // ATOMIC RESET: Only update if someone else hasn't reset it yet
      const resetResult = await prisma.warmupSettings.updateMany({
        where: { 
          userId,
          lastSentDate: settings.lastSentDate // Date hasn't changed since we checked
        },
        data: {
          currentBatchSize: newBatchSize,
          dailySentCount: 1, 
          lastSentDate: today
        }
      });
      
      if (resetResult.count > 0) return true;
      
      // If we failed to reset, it means another process did it. 
      // Refresh settings and proceed to normal increment logic below.
      return await this.claimWarmupSlot(userId); 
    }

    // 3. ATOMIC INCREMENT: Only update if dailySentCount < currentBatchSize
    // This is the most critical part for strict enforcement
    const updateResult = await prisma.warmupSettings.updateMany({
      where: {
        userId,
        dailySentCount: {
          lt: settings.currentBatchSize
        },
        // Also ensure date is still today to avoid crossing reset boundaries
        lastSentDate: {
          gte: new Date(new Date().setHours(0,0,0,0))
        }
      },
      data: {
        dailySentCount: {
          increment: 1
        },
        lastSentDate: today
      }
    });

    return updateResult.count > 0;
  }

  /**
   * If an email failed to send, we can "refund" the warmup slot
   */
  async refundWarmupSlot(userId) {
    await prisma.warmupSettings.updateMany({
      where: { 
        userId,
        dailySentCount: { gt: 0 }
      },
      data: {
        dailySentCount: {
          decrement: 1
        }
      }
    });
  }
}

module.exports = new WarmupManager();
