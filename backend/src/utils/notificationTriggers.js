/**
 * Notification Triggers for Admission Updates
 * Handles real-time notifications for Ghanaian university admission events
 */

import { createSystemNotification } from '../controllers/notificationController.js';
import { getCollection } from '../config/db.js';
import { fetchLatestAdmissions } from './admissionScraper.js';

// Helper: get current academic year (e.g., 2025/2026)
const getAcademicYear = () => {
  const now = new Date();
  const currentYear = now.getFullYear();
  return now.getMonth() >= 8 ? `${currentYear}/${currentYear + 1}` : `${currentYear - 1}/${currentYear}`;
};

// Check for urgent admission updates and notify all users
export const checkAdmissionUpdates = async () => {
  try {
    console.log('🔍 Checking for admission updates (scraper-driven)...');

    // Fetch latest events from scraper (can be replaced with real scraping logic)
    const events = await fetchLatestAdmissions();
    if (!Array.isArray(events) || events.length === 0) {
      console.log('ℹ️ No admission events from scraper');
      return;
    }

    const usersCollection = await getCollection('users');
    const users = await usersCollection.find({}).toArray();

    // For each event create a notification per user if not recently sent
    let sentCount = 0;
    for (const event of events) {
      const title = event.title || `${event.university} update`;
      const message = event.message || '';

      for (const user of users) {
        const already = await checkRecentNotification(user._id.toString(), title, 24);
        if (already) continue;

        const payload = {
          title,
          message,
          type: event.priority || 'info',
          category: 'admission_update',
          priority: event.priority || 'normal',
          actionUrl: event.actionUrl || null,
          metadata: {
            university: event.university,
            event: event.event,
            year: getAcademicYear(),
            source: 'scraper'
          },
          expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days
        };

        await createSystemNotification(user._id.toString(), 'admission_update', payload);
        sentCount++;
      }
    }

    console.log(`✅ Sent ${sentCount} admission notifications (events: ${events.length}) to ${users.length} users`);

  } catch (error) {
    console.error('❌ Error checking admission updates:', error);
  }
};

// Check if user recently received similar notification
const checkRecentNotification = async (userId, title, hoursBack = 24) => {
  try {
    const notificationsCollection = await getCollection('notifications');
    const cutoffTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    const existing = await notificationsCollection.findOne({
      userId,
      title,
      createdAt: { $gte: cutoffTime }
    });

    return !!existing;
  } catch (error) {
    console.error('❌ Error checking recent notifications:', error);
    return false;
  }
};

// Notify users about specific university updates
export const notifyUniversityUpdate = async (universityName, updateType, details = {}) => {
  try {
    const usersCollection = await getCollection('users');
    const users = await usersCollection.find({}).toArray();

    const notificationTemplates = {
      admission_lists_released: {
        title: `🚨 ${universityName} Admission Lists Released!`,
        message: `Check your admission status for ${universityName} 2025/2026 academic year.`,
        priority: "urgent"
      },
      deadline_extended: {
        title: `📅 ${universityName} Deadline Extended`,
        message: `Application deadline for ${universityName} has been extended to ${details.newDeadline}.`,
        priority: "high"
      },
      new_program: {
        title: `✨ New Program at ${universityName}`,
        message: `${details.programName} is now available at ${universityName}.`,
        priority: "normal"
      },
      scholarship_announcement: {
        title: `💰 New Scholarship at ${universityName}`,
        message: `${details.scholarshipName} scholarship now available. Deadline: ${details.deadline}`,
        priority: "high"
      }
    };

    const template = notificationTemplates[updateType];
    if (!template) return;

    const year = getAcademicYear();
    for (const user of users) {
      await createSystemNotification(user._id.toString(), 'admission_update', {
        ...template,
        type: template.priority === 'urgent' ? 'urgent' : 'info',
        category: 'admission_update',
        priority: template.priority,
        metadata: {
          university: universityName,
          updateType,
          ...details,
          year
        },
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      });
    }

    console.log(`✅ Notified ${users.length} users about ${universityName} ${updateType}`);

  } catch (error) {
    console.error('❌ Error sending university update notifications:', error);
  }
};

// Schedule periodic checks (to be called by a cron job or scheduler)
export const scheduleAdmissionChecks = () => {
  // Check every 6 hours
  setInterval(checkAdmissionUpdates, 6 * 60 * 60 * 1000);

  // Initial check
  setTimeout(checkAdmissionUpdates, 60000); // 1 minute after startup
};

export default {
  checkAdmissionUpdates,
  notifyUniversityUpdate,
  scheduleAdmissionChecks
};
