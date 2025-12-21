// NOTIFICATION ROUTES - PRODUCTION READY
import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearReadNotifications
} from '../controllers/notificationController.js';
import { getAdmissionNotifications } from '../utils/admissionNotificationsFetcher.js';

const router = express.Router();

// Get user notifications (with pagination and filtering)
router.get('/', authMiddleware, getUserNotifications);

// Get system-wide admission notifications (no auth required)
router.get('/admission/feed', async (req, res) => {
  try {
    const { limit = 20, skip = 0 } = req.query;
    const result = await getAdmissionNotifications(parseInt(limit), parseInt(skip));
    
    if (result.success) {
      res.json({
        success: true,
        notifications: result.notifications,
        count: result.notifications.length
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('❌ Error fetching admission notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admission notifications'
    });
  }
});

// Mark single notification as read
router.put('/:notificationId/read', authMiddleware, markAsRead);

// Mark all notifications as read
router.put('/read-all', authMiddleware, markAllAsRead);

// Delete single notification
router.delete('/:notificationId', authMiddleware, deleteNotification);

// Clear all read notifications
router.delete('/clear-read', authMiddleware, clearReadNotifications);

export default router;
