/**
 * NOTIFICATION CLEANUP JOB
 * Periodically deletes notifications that have been read for 30+ minutes
 * Run this as a cron job or scheduled task
 */

import { getCollection } from '../config/db.js';

export const cleanupReadNotifications = async () => {
  try {
    const notificationsCollection = await getCollection('notifications');
    const now = new Date();

    // Delete notifications scheduled for deletion
    const result = await notificationsCollection.deleteMany({
      scheduledDeletionAt: { $lte: now }
    });

    if (result.deletedCount > 0) {
      console.log(`✅ Cleanup: Deleted ${result.deletedCount} expired notifications`);
    }

    return {
      success: true,
      deletedCount: result.deletedCount
    };
  } catch (error) {
    console.error('❌ Notification cleanup error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Run cleanup every 10 seconds (to catch 5-second deletion deadlines)
export const startCleanupSchedule = () => {
  console.log('🔄 Starting notification cleanup scheduler (runs every 10 seconds)');
  
  // Run immediately on start
  cleanupReadNotifications();
  
  // Then run every 10 seconds
  setInterval(() => {
    cleanupReadNotifications();
  }, 10 * 1000);
};

// For manual execution
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanupReadNotifications()
    .then(result => {
      console.log('Cleanup result:', result);
      process.exit(0);
    })
    .catch(err => {
      console.error('Cleanup failed:', err);
      process.exit(1);
    });
}
