// PRODUCTION-READY NOTIFICATION CONTROLLER
// Real-time notifications for Ghanaian university applicants

import { getCollection } from '../config/db.js';
import { ObjectId } from 'mongodb';

// Create a new notification
export const createNotification = async (userId, notificationData) => {
  try {
    const notificationsCollection = await getCollection('notifications');
    
    const notification = {
      userId: userId,
      title: notificationData.title,
      message: notificationData.message,
      type: notificationData.type || 'info', // info, success, warning, error, payment, application
      category: notificationData.category || 'general', // general, payment, application, deadline, scholarship
      isRead: false,
      priority: notificationData.priority || 'normal', // low, normal, high, urgent
      actionUrl: notificationData.actionUrl || null,
      metadata: notificationData.metadata || {},
      createdAt: new Date(),
      readAt: null,
      scheduledDeletionAt: null,
      expiresAt: notificationData.expiresAt || null
    };

    const result = await notificationsCollection.insertOne(notification);
    console.log(`✅ Notification created for user ${userId}: ${notification.title}`);
    
    return {
      success: true,
      notificationId: result.insertedId.toString()
    };
  } catch (error) {
    console.error('❌ Create notification error:', error);
    return { success: false, error: error.message };
  }
};

// Get notifications for a user
export const getUserNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50, skip = 0, unreadOnly = false } = req.query;

    const notificationsCollection = await getCollection('notifications');
    
    // Build query
    const query = { 
      userId: userId,
      $or: [
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } }
      ]
    };
    
    if (unreadOnly === 'true') {
      query.isRead = false;
    }

    // Get notifications with pagination
    const notifications = await notificationsCollection
      .find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .toArray();

    // Get unread count
    const unreadCount = await notificationsCollection.countDocuments({
      userId: userId,
      isRead: false,
      $or: [
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } }
      ]
    });

    const formattedNotifications = notifications.map(notif => ({
      id: notif._id.toString(),
      title: notif.title,
      message: notif.message,
      type: notif.type,
      category: notif.category,
      isRead: notif.isRead,
      priority: notif.priority,
      actionUrl: notif.actionUrl,
      metadata: notif.metadata,
      createdAt: notif.createdAt,
      expiresAt: notif.expiresAt
    }));

    res.json({
      success: true,
      notifications: formattedNotifications,
      unreadCount,
      total: notifications.length,
      hasMore: notifications.length === parseInt(limit)
    });
  } catch (error) {
    console.error('❌ Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications'
    });
  }
};

// Mark notification as read
export const markAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { notificationId } = req.params;

    if (!ObjectId.isValid(notificationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification ID'
      });
    }

    const notificationsCollection = await getCollection('notifications');
    
    const now = new Date();
    const deletionTime = new Date(now.getTime() + 5 * 1000); // 5 seconds from now
    
    const result = await notificationsCollection.updateOne(
      { 
        _id: new ObjectId(notificationId),
        userId: userId 
      },
      { 
        $set: { 
          isRead: true,
          readAt: now,
          scheduledDeletionAt: deletionTime
        } 
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification marked as read',
      scheduledDeletionAt: deletionTime
    });
  } catch (error) {
    console.error('❌ Mark as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update notification'
    });
  }
};

// Mark all notifications as read
export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    const notificationsCollection = await getCollection('notifications');
    
    const now = new Date();
    const deletionTime = new Date(now.getTime() + 5 * 1000); // 5 seconds from now
    
    const result = await notificationsCollection.updateMany(
      { 
        userId: userId,
        isRead: false 
      },
      { 
        $set: { 
          isRead: true,
          readAt: now,
          scheduledDeletionAt: deletionTime
        } 
      }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} notifications marked as read`,
      count: result.modifiedCount,
      scheduledDeletionAt: deletionTime
    });
  } catch (error) {
    console.error('❌ Mark all as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update notifications'
    });
  }
};

// Delete notification
export const deleteNotification = async (req, res) => {
  try {
    const userId = req.user.id;
    const { notificationId } = req.params;

    if (!ObjectId.isValid(notificationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification ID'
      });
    }

    const notificationsCollection = await getCollection('notifications');
    
    const result = await notificationsCollection.deleteOne({
      _id: new ObjectId(notificationId),
      userId: userId
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification deleted'
    });
  } catch (error) {
    console.error('❌ Delete notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification'
    });
  }
};

// Clear all read notifications
export const clearReadNotifications = async (req, res) => {
  try {
    const userId = req.user.id;

    const notificationsCollection = await getCollection('notifications');
    
    const result = await notificationsCollection.deleteMany({
      userId: userId,
      isRead: true
    });

    res.json({
      success: true,
      message: `${result.deletedCount} read notifications cleared`,
      count: result.deletedCount
    });
  } catch (error) {
    console.error('❌ Clear notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear notifications'
    });
  }
};

// Create system notifications (called internally) - ENHANCED WITH REAL-TIME PUSH
export const createSystemNotification = async (userId, type, data) => {
  const notificationTemplates = {
    welcome: {
      title: 'Welcome to Glinax! 🎓',
      message: 'Start exploring Ghanaian universities and get personalized admission guidance.',
      type: 'success',
      category: 'general',
      priority: 'normal'
    },
    admission_update: {
      title: data.title || 'University Admission Update',
      message: data.message || 'Important admission information available.',
      type: data.type || 'info',
      category: 'admission_update',
      priority: data.priority || 'normal',
      actionUrl: data.actionUrl,
      metadata: data.metadata || {}
    },
    payment_success: {
      title: 'Payment Successful ✅',
      message: `Your payment of GHS ${data.amount} has been processed successfully.`,
      type: 'success',
      category: 'payment',
      priority: 'high',
      metadata: { transactionId: data.transactionId, amount: data.amount }
    },
    payment_failed: {
      title: 'Payment Failed ❌',
      message: `Your payment of GHS ${data.amount} could not be processed. Please try again.`,
      type: 'error',
      category: 'payment',
      priority: 'high',
      metadata: { transactionId: data.transactionId, amount: data.amount, reason: data.reason }
    },
    deadline_reminder: {
      title: `Application Deadline Approaching ⏰`,
      message: `${data.universityName} application deadline is ${data.daysLeft} days away.`,
      type: 'warning',
      category: 'deadline',
      priority: 'high',
      metadata: { universityName: data.universityName, deadline: data.deadline }
    },
    scholarship_alert: {
      title: 'New Scholarship Available 💰',
      message: `${data.scholarshipName} is now open for applications.`,
      type: 'info',
      category: 'scholarship',
      priority: 'normal',
      metadata: { scholarshipName: data.scholarshipName, deadline: data.deadline }
    }
  };

  const template = notificationTemplates[type];
  if (!template) {
    console.error(`Unknown notification type: ${type}`);
    return { success: false, error: 'Unknown notification type' };
  }

  // Create the notification in database
  const result = await createNotification(userId, {
    ...template,
    ...data
  });

  if (result.success) {
    // Send real-time notification via Socket.io
    const notificationData = {
      id: result.notificationId,
      title: template.title,
      message: template.message,
      type: template.type,
      category: template.category,
      priority: template.priority,
      actionUrl: template.actionUrl,
      metadata: template.metadata,
      createdAt: new Date(),
      isRealTime: true
    };

    // Emit real-time notification if Socket.io is available on the global object
    try {
      if (global && global.io) {
        global.io.to(`user_${userId}`).emit('notification', notificationData);
        console.log(`📢 Emitted real-time notification to user_${userId}`);
      } else {
        console.log('ℹ️ Socket.io not initialized, skipping real-time emit');
      }
    } catch (err) {
      console.error('❌ Real-time emit error:', err);
    }
  }

  return result;
};

export default {
  createNotification,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearReadNotifications,
  createSystemNotification
};
