/**
 * Socket.io Hook for Real-Time Notifications
 * Handles WebSocket connection and real-time communication with the backend
 * ENHANCED: Proper notification handling and broadcast support
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';

export interface NotificationData {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'payment' | 'application';
  category: 'general' | 'payment' | 'application' | 'deadline' | 'scholarship' | 'admission_update' | 'form';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  actionUrl?: string;
  metadata?: any;
  createdAt: Date;
  readAt?: Date;
  scheduledDeletionAt?: Date;
  isRealTime?: boolean;
}

export const useSocket = () => {
  const { user, isAuthenticated } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Connect to Socket.io server
  const connect = useCallback(() => {
    if (!isAuthenticated || !user?.id) {
      console.log('🔌 Socket: Not connecting - user not authenticated');
      return;
    }

    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

    console.log('🔌 Connecting to Socket.io server...', { userId: user.id });

    socketRef.current = io(API_BASE_URL, {
      transports: ['websocket', 'polling'],
      upgrade: true,
      rememberUpgrade: true,
      timeout: 20000,
      forceNew: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    const socket = socketRef.current;

    // Connection events
    socket.on('connect', () => {
      console.log('✅ Socket connected:', socket.id);
      setIsConnected(true);

      // Join user-specific room for notifications
      socket.emit('join-user-room', user.id);
      console.log(`👤 Joined user room: ${user.id}`);
    });

    socket.on('disconnect', (reason: string) => {
      console.log('❌ Socket disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (error: Error) => {
      console.error('❌ Socket connection error:', error);
      setIsConnected(false);
    });

    socket.on('reconnect', (attemptNumber: number) => {
      console.log(`🔄 Socket reconnected after ${attemptNumber} attempts`);
      setIsConnected(true);
      // Re-join user room after reconnect
      if (user?.id) {
        socket.emit('join-user-room', user.id);
      }
    });

    // User-specific notification events
    socket.on('notification', (notificationData: any) => {
      console.log('📢 Real-time notification received:', notificationData);

      const notification: NotificationData = {
        id: notificationData.id || `notif_${Date.now()}`,
        title: notificationData.title,
        message: notificationData.message,
        type: notificationData.type || 'info',
        category: notificationData.category || 'general',
        priority: notificationData.priority || 'normal',
        actionUrl: notificationData.actionUrl,
        metadata: notificationData.metadata,
        createdAt: new Date(notificationData.createdAt || Date.now()),
        isRealTime: true
      };

      // Add to notifications state
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);

      // Show browser notification if permission granted
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.message,
          icon: '/glinax-icon.png',
          tag: notification.category,
          requireInteraction: notification.priority === 'urgent'
        });
      }
    });

    // Broadcast notification events (for system announcements)
    socket.on('broadcast-notification', (notificationData: any) => {
      console.log('📣 Broadcast notification received:', notificationData);

      const notification: NotificationData = {
        id: notificationData.id || `broadcast_${Date.now()}`,
        title: notificationData.title,
        message: notificationData.message,
        type: notificationData.type || 'info',
        category: notificationData.category || 'general',
        priority: notificationData.priority || 'normal',
        actionUrl: notificationData.actionUrl,
        metadata: notificationData.metadata,
        createdAt: new Date(notificationData.createdAt || Date.now()),
        isRealTime: true
      };

      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);

      // Show browser notification for broadcast
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.message,
          icon: '/glinax-icon.png',
          badge: '/glinax-badge.png'
        });
      }
    });
  }, [user?.id, isAuthenticated]);

  // Mark notification as read via API and schedule deletion after 5 seconds (persistent)
  const markAsRead = useCallback(async (notificationId: string) => {
    const now = new Date();
    const optimisticDeletion = new Date(now.getTime() + 5 * 1000);

    // Optimistic UI update
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? {
        ...n,
        readAt: now,
        scheduledDeletionAt: optimisticDeletion,
        metadata: { ...n.metadata, read: true }
      } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));

    // Call backend to persist read + 5s deletion scheduling
    try {
      const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:5000/api';
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const resp = await fetch(`${API_BASE_URL}/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers,
        credentials: 'include'
      });

      if (!resp.ok) throw new Error(`Failed to mark as read: ${resp.status}`);

      const data = await resp.json();
      const serverDeletionAt = data?.scheduledDeletionAt ? new Date(data.scheduledDeletionAt) : optimisticDeletion;

      // Sync scheduledDeletionAt with server's value
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, scheduledDeletionAt: serverDeletionAt } : n)
      );
    } catch (err) {
      console.error('❌ Mark-as-read API failed:', err);
      // Rollback optimistic changes if needed (keep as read but remove deletion schedule)
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, scheduledDeletionAt: undefined } : n)
      );
    }

    // Local removal after 5 seconds for seamless UX
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      console.log(`🗑️ Auto-deleted read notification (UI): ${notificationId}`);
    }, 5 * 1000);
  }, []);

  // Remove a single notification
  const removeNotification = useCallback((notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  // Clear all notifications
  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  // Auto-connect when authenticated
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      connect();
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [isAuthenticated, user?.id, connect]);

  // Periodic cleanup job - check for scheduled deletions every 10 seconds
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = new Date();
      setNotifications(prev => {
        const toDelete = prev.filter(n => 
          n.scheduledDeletionAt && n.scheduledDeletionAt <= now
        );
        
        if (toDelete.length > 0) {
          console.log(`🗑️ Auto-cleanup: Removing ${toDelete.length} expired notifications`);
          return prev.filter(n => 
            !n.scheduledDeletionAt || n.scheduledDeletionAt > now
          );
        }
        
        return prev;
      });
    }, 10 * 1000); // Check every 10 seconds

    return () => clearInterval(cleanupInterval);
  }, []);

  return {
    isConnected,
    notifications,
    unreadCount,
    markAsRead,
    removeNotification,
    clearAllNotifications,
    requestNotificationPermission: () => {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  };
};

export default useSocket;
