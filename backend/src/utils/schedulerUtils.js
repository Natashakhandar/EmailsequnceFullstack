
/**
 * Utility functions for sequence scheduling
 */

/**
 * Calculates the next send date based on step configuration
 * @param {Object} stepConfig - The sequence step configuration
 * @param {Date} fromDate - The reference date (usually now or previous step send time)
 * @returns {Date} The calculated next send date
 */
function calculateNextSendDate(stepConfig, fromDate = new Date()) {
  const { 
    scheduleType = 'delay', 
    delayDays = 0, 
    delayHours = 0, 
    delayMinutes = 0, 
    dayOfWeek, 
    dayOfMonth 
  } = stepConfig;
  
  const nextDate = new Date(fromDate);

  if (scheduleType === 'weekly' && dayOfWeek !== null && dayOfWeek !== undefined) {
    // Target day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
    const targetDay = parseInt(dayOfWeek);
    const currentDay = nextDate.getDay();
    
    // Calculate days until next occurrence
    let daysUntil = (targetDay - currentDay + 7) % 7;
    
    // If it's today, we usually want the NEXT occurrence unless it's a brand new enrollment
    // But for sequence progression (Step 1 just sent), we definitely want the NEXT week's Monday.
    if (daysUntil === 0) {
      daysUntil = 7;
    }
    
    nextDate.setDate(nextDate.getDate() + daysUntil);
    // For weekly/monthly, we often want to send at a specific hour if not specified? 
    // Let's keep the existing hours/mins if they were set in the step?
    // Actually, usually it's "On Monday at X:Y". If delayHours is set, use it.
    nextDate.setHours(delayHours, delayMinutes, 0, 0);
    
  } else if (scheduleType === 'monthly' && dayOfMonth !== null && dayOfMonth !== undefined) {
    // Target day of month (1-31)
    const targetDay = parseInt(dayOfMonth);
    const currentMonth = nextDate.getMonth();
    const currentYear = nextDate.getFullYear();
    
    // Set to this month first
    nextDate.setDate(targetDay);
    nextDate.setHours(delayHours, delayMinutes, 0, 0);
    
    // If it's already past this day this month, move to next month
    if (nextDate <= fromDate) {
      nextDate.setMonth(currentMonth + 1);
      // Handle edge cases like 31st (auto-rolls to 1st of next next month if next month has 30 days)
      // JS Date auto-handles this, but if we want specifically "last day of month", that's different.
    }
  } else {
    // Default: 'delay' based logic
    nextDate.setDate(nextDate.getDate() + delayDays);
    nextDate.setHours(nextDate.getHours() + delayHours);
    nextDate.setMinutes(nextDate.getMinutes() + delayMinutes);
  }
  
  return nextDate;
}

module.exports = {
  calculateNextSendDate
};
