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
   * Check if user can send an email today under warmup limits
   */
  async canSendEmail(userId) {
    const settings = await this.getSettings(userId);
    
    if (!settings.isEnabled) return true;

    // Check if we need to reset for a new day
    const lastDate = new Date(settings.lastSentDate);
    const today = new Date();
    
    const isNewDay = lastDate.getUTCDate() !== today.getUTCDate() || 
                     lastDate.getUTCMonth() !== today.getUTCMonth() ||
                     lastDate.getUTCFullYear() !== today.getUTCFullYear();

    if (isNewDay) {
      // It's a new day, increment the daily limit if goal not reached
      let newBatchSize = settings.currentBatchSize;
      
      // Only increment if they actually hit their limit yesterday (or close to it)
      // This ensures we only "warm up" if we are actually sending
      if (settings.dailySentCount >= settings.currentBatchSize * 0.8) {
        newBatchSize = Math.min(settings.maxLimit, settings.currentBatchSize + settings.dailyIncrement);
      }

      const updatedSettings = await prisma.warmupSettings.update({
        where: { userId },
        data: {
          currentBatchSize: newBatchSize,
          dailySentCount: 0,
          lastSentDate: today
        }
      });
      
      return updatedSettings.dailySentCount < updatedSettings.currentBatchSize;
    }

    return settings.dailySentCount < settings.currentBatchSize;
  }

  /**
   * Increment the count of sent emails for today
   */
  async recordSentEmail(userId) {
    const settings = await prisma.warmupSettings.findUnique({
      where: { userId }
    });

    if (!settings || !settings.isEnabled) return;

    await prisma.warmupSettings.update({
      where: { userId },
      data: {
        dailySentCount: {
          increment: 1
        },
        lastSentDate: new Date()
      }
    });
  }
}

module.exports = new WarmupManager();
