const prisma = require('../db/prismaClient');

class WarmupManager {
  /**
   * Get or create warmup settings for a user
   */
  async getSettings(userId) {
    const rows = await prisma.query('SELECT * FROM warmup_settings WHERE userId = ? LIMIT 1', [userId]);
    if (rows.length > 0) {
      // Cast integers and booleans
      const s = rows[0];
      s.isEnabled = !!s.isEnabled;
      return s;
    }

    const id = require('crypto').randomBytes(8).toString('hex').toUpperCase();
    const now = new Date();
    await prisma.query(
      `INSERT INTO warmup_settings (id, userId, isEnabled, currentBatchSize, dailyIncrement, maxLimit, dailySentCount, lastSentDate, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, 0, 10, 5, 200, 0, now, now, now]
    );
    const newRows = await prisma.query('SELECT * FROM warmup_settings WHERE userId = ? LIMIT 1', [userId]);
    const s = newRows[0];
    s.isEnabled = !!s.isEnabled;
    return s;
  }

  /**
   * Update warmup settings
   */
  async updateSettings(userId, data) {
    const settings = await this.getSettings(userId);
    const updates = [];
    const values = [];
    if (data.isEnabled !== undefined) { updates.push('isEnabled = ?'); values.push(data.isEnabled ? 1 : 0); }
    if (data.currentBatchSize !== undefined) { updates.push('currentBatchSize = ?'); values.push(data.currentBatchSize); }
    if (data.dailyIncrement !== undefined) { updates.push('dailyIncrement = ?'); values.push(data.dailyIncrement); }
    if (data.maxLimit !== undefined) { updates.push('maxLimit = ?'); values.push(data.maxLimit); }
    
    if (updates.length > 0) {
      values.push(new Date(), userId);
      await prisma.query(`UPDATE warmup_settings SET ${updates.join(', ')}, updatedAt = ? WHERE userId = ?`, values);
    }
    return this.getSettings(userId);
  }

  /**
   * ATOMIC: Check if user can send an email and "claim" a slot by incrementing the count.
   */
  async claimWarmupSlot(userId) {
    const settings = await this.getSettings(userId);
    if (!settings.isEnabled) return true;

    const lastDate = new Date(settings.lastSentDate);
    const today = new Date();
    
    // Check if new day based on UTC boundaries for consistency
    const isNewDay = lastDate.getUTCDate() !== today.getUTCDate() || 
                     lastDate.getUTCMonth() !== today.getUTCMonth() ||
                     lastDate.getUTCFullYear() !== today.getUTCFullYear();

    if (isNewDay) {
      let newBatchSize = settings.currentBatchSize;
      if (settings.dailySentCount >= settings.currentBatchSize * 0.8) {
        newBatchSize = Math.min(settings.maxLimit, settings.currentBatchSize + settings.dailyIncrement);
      }
      
      // Use exact today date string for reliable concurrency check, avoiding DATETIME precision bugs
      const todayDateString = today.toISOString().split('T')[0];
      
      const result = await prisma.query(
        `UPDATE warmup_settings SET currentBatchSize = ?, dailySentCount = 1, lastSentDate = ? 
         WHERE userId = ? AND DATE(lastSentDate) != ?`,
        [newBatchSize, today, userId, todayDateString]
      );
      
      if (result && result.affectedRows > 0) return true;
      // Another process transitioned the day before us, so retry
      return await this.claimWarmupSlot(userId); 
    }

    // On same day, atomicity is guaranteed by ensuring the fetched dailySentCount matches
    const updateResult = await prisma.query(
      `UPDATE warmup_settings SET dailySentCount = dailySentCount + 1, lastSentDate = ? 
       WHERE userId = ? AND dailySentCount < currentBatchSize AND dailySentCount = ?`,
      [today, userId, settings.dailySentCount]
    );

    if (updateResult && updateResult.affectedRows > 0) return true;

    const currentSettings = await this.getSettings(userId);
    if (currentSettings.dailySentCount >= currentSettings.currentBatchSize) return false;
    // Lost the race but limit not reached, gracefully retry
    return await this.claimWarmupSlot(userId);
  }

  async refundWarmupSlot(userId) {
    await prisma.query(`UPDATE warmup_settings SET dailySentCount = dailySentCount - 1 WHERE userId = ? AND dailySentCount > 0`, [userId]);
  }
}

module.exports = new WarmupManager();
