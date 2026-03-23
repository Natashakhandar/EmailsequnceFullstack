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
    
    const isNewDay = lastDate.getUTCDate() !== today.getUTCDate() || 
                     lastDate.getUTCMonth() !== today.getUTCMonth() ||
                     lastDate.getUTCFullYear() !== today.getUTCFullYear();

    if (isNewDay) {
      let newBatchSize = settings.currentBatchSize;
      if (settings.dailySentCount >= settings.currentBatchSize * 0.8) {
        newBatchSize = Math.min(settings.maxLimit, settings.currentBatchSize + settings.dailyIncrement);
      }
      
      const result = await prisma.query(
        `UPDATE warmup_settings SET currentBatchSize = ?, dailySentCount = 1, lastSentDate = ? 
         WHERE userId = ? AND lastSentDate = ?`,
        [newBatchSize, today, userId, settings.lastSentDate]
      );
      if (result && result.affectedRows > 0) return true;
      return await this.claimWarmupSlot(userId); 
    }

    const updateResult = await prisma.query(
      `UPDATE warmup_settings SET dailySentCount = dailySentCount + 1, lastSentDate = ? 
       WHERE userId = ? AND dailySentCount < currentBatchSize AND lastSentDate >= ?`,
      [today, userId, new Date(new Date().setHours(0,0,0,0))]
    );
    return (updateResult && updateResult.affectedRows > 0);
  }

  async refundWarmupSlot(userId) {
    await prisma.query(`UPDATE warmup_settings SET dailySentCount = dailySentCount - 1 WHERE userId = ? AND dailySentCount > 0`, [userId]);
  }
}

module.exports = new WarmupManager();
