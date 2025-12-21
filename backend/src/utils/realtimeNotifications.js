/**
 * REAL-TIME NOTIFICATION SERVICE
 * Handles Socket.io broadcasting and notification delivery
 * Updated: December 15, 2025
 */

import { getCollection } from '../config/db.js';
import { ObjectId } from 'mongodb';

// Global io reference (set in server.js)
let io = null;

export const setIO = (ioInstance) => {
  io = ioInstance;
  console.log('✅ Socket.io instance configured for notifications');
};

/**
 * Send notification to a specific user via WebSocket
 * Falls back to database if user not connected
 */
export const sendUserNotification = async (userId, notification) => {
  try {
    // Prepare notification object
    const notificationData = {
      id: new ObjectId().toString(),
      title: notification.title,
      message: notification.message,
      type: notification.type || 'info',
      category: notification.category || 'general',
      priority: notification.priority || 'normal',
      actionUrl: notification.actionUrl || null,
      metadata: notification.metadata || {},
      createdAt: new Date(),
      isRead: false,
      expiresAt: notification.expiresAt || null
    };

    // 1. Try to send via WebSocket if user connected
    if (io) {
      io.to(`user_${userId}`).emit('notification', notificationData);
      console.log(`📢 Real-time notification sent to user ${userId} via WebSocket`);
    }

    // 2. Also save to database for persistence/offline retrieval
    const notificationsCollection = await getCollection('notifications');
    const result = await notificationsCollection.insertOne(notificationData);
    console.log(`💾 Notification saved to database: ${result.insertedId}`);

    return { success: true, notificationId: result.insertedId.toString() };
  } catch (error) {
    console.error('❌ Error sending notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Broadcast notification to all users
 */
export const broadcastNotification = async (notification) => {
  try {
    const notificationData = {
      id: new ObjectId().toString(),
      title: notification.title,
      message: notification.message,
      type: notification.type || 'info',
      category: notification.category || 'general',
      priority: notification.priority || 'normal',
      actionUrl: notification.actionUrl || null,
      metadata: notification.metadata || {},
      createdAt: new Date(),
      isRead: false,
      expiresAt: notification.expiresAt || null
    };

    // Send via WebSocket to all connected users
    if (io) {
      io.emit('broadcast-notification', notificationData);
      console.log(`📢 Broadcast notification sent to all connected users`);
    }

    // Save to database
    const notificationsCollection = await getCollection('notifications');
    const usersCollection = await getCollection('users');
    
    // Get all user IDs
    const users = await usersCollection.find({}, { projection: { _id: 1 } }).toArray();
    
    // Create notification for each user
    const notificationsToInsert = users.map(user => ({
      ...notificationData,
      userId: user._id.toString()
    }));

    if (notificationsToInsert.length > 0) {
      const result = await notificationsCollection.insertMany(notificationsToInsert);
      console.log(`💾 Broadcast notification saved for ${result.insertedIds.length} users`);
    }

    return { success: true, count: users.length };
  } catch (error) {
    console.error('❌ Error broadcasting notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send admission update notification to interested users
 */
export const sendAdmissionUpdate = async (universityName, updateType, details = {}) => {
  try {
    const notification = {
      title: `🚨 ${universityName} ${updateType}!`,
      message: details.message || `Important update for ${universityName}`,
      type: 'success',
      category: 'admission_update',
      priority: updateType.includes('List') ? 'urgent' : 'high',
      actionUrl: `/universities/${universityName.toLowerCase().replace(' ', '-')}`,
      metadata: {
        university: universityName,
        updateType: updateType,
        ...details
      },
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    };

    // Get users interested in this university
    const usersCollection = await getCollection('users');
    const interestedUsers = await usersCollection.find({
      $or: [
        { preferredUniversities: universityName },
        { savedUniversities: universityName },
        { interestedIn: universityName }
      ]
    }).toArray();

    console.log(`📚 Sending ${universityName} update to ${interestedUsers.length} interested users`);

    // Send to each user
    let sentCount = 0;
    for (const user of interestedUsers) {
      const result = await sendUserNotification(user._id.toString(), notification);
      if (result.success) sentCount++;
    }

    // Also broadcast if it's a critical update
    if (updateType.includes('List') || updateType.includes('Opening')) {
      await broadcastNotification(notification);
    }

    return { success: true, sentCount, totalInterested: interestedUsers.length };
  } catch (error) {
    console.error('❌ Error sending admission update:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send payment notification
 */
export const sendPaymentNotification = async (userId, status, amount, details = {}) => {
  try {
    const statusMessages = {
      'success': {
        title: '✅ Payment Successful!',
        message: `GHS ${amount} payment received. Transaction ID: ${details.reference || 'N/A'}`,
        type: 'success'
      },
      'pending': {
        title: '⏳ Payment Pending',
        message: `Your GHS ${amount} mobile money payment is waiting for approval. Check your phone.`,
        type: 'warning'
      },
      'failed': {
        title: '❌ Payment Failed',
        message: `Your GHS ${amount} payment could not be processed. ${details.reason || 'Please try again.'}`,
        type: 'error'
      }
    };

    const notification = statusMessages[status] || {
      title: '💳 Payment Update',
      message: `Payment status: ${status}`,
      type: 'info'
    };

    return await sendUserNotification(userId, {
      ...notification,
      category: 'payment',
      priority: status === 'failed' ? 'high' : 'normal',
      metadata: {
        amount,
        status,
        ...details
      }
    });
  } catch (error) {
    console.error('❌ Error sending payment notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send form-related notification
 */
export const sendFormNotification = async (userId, formName, eventType, details = {}) => {
  try {
    const eventMessages = {
      'purchase_success': {
        title: `✅ Form Purchase Complete!`,
        message: `You've successfully purchased the ${formName} application form. Download it from your dashboard.`,
        type: 'success'
      },
      'download_ready': {
        title: `📥 Form Ready to Download`,
        message: `Your ${formName} form is ready. Download it now!`,
        type: 'success'
      },
      'deadline_approaching': {
        title: `⏰ ${formName} Deadline Approaching`,
        message: `Don't forget to submit your ${formName} application before the deadline!`,
        type: 'warning'
      }
    };

    const notification = eventMessages[eventType] || {
      title: `📋 ${formName} Update`,
      message: `Update regarding ${formName}`,
      type: 'info'
    };

    return await sendUserNotification(userId, {
      ...notification,
      category: 'form',
      priority: eventType.includes('deadline') ? 'high' : 'normal',
      metadata: {
        formName,
        eventType,
        ...details
      }
    });
  } catch (error) {
    console.error('❌ Error sending form notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get unread notification count for user
 */
export const getUnreadCount = async (userId) => {
  try {
    const notificationsCollection = await getCollection('notifications');
    const count = await notificationsCollection.countDocuments({
      userId: userId,
      isRead: false,
      $or: [
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } }
      ]
    });
    return count;
  } catch (error) {
    console.error('❌ Error getting unread count:', error);
    return 0;
  }
};

/**
 * Mark notification as read
 */
export const markAsRead = async (notificationId) => {
  try {
    const notificationsCollection = await getCollection('notifications');
    const result = await notificationsCollection.updateOne(
      { _id: new ObjectId(notificationId) },
      { $set: { isRead: true, readAt: new Date() } }
    );
    return result.modifiedCount > 0;
  } catch (error) {
    console.error('❌ Error marking notification as read:', error);
    return false;
  }
};

export default {
  setIO,
  sendUserNotification,
  broadcastNotification,
  sendAdmissionUpdate,
  sendPaymentNotification,
  sendFormNotification,
  getUnreadCount,
  markAsRead
};
