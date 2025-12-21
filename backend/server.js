import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import fetch from 'node-fetch';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { connectDB } from './src/config/db.js';
import authRoutes from './src/routes/auth.js';
import profileRoutes from './src/routes/profile.js';
import chatRoutes from './src/routes/chats.js';
import paymentRoutes from './src/routes/payments.js';
import paystackWebhookRoutes from './src/routes/paystackWebhook.js';
import formRoutes from './src/routes/forms.js';
import { createSystemNotification } from './src/controllers/notificationController.js';
import { setIO } from './src/utils/realtimeNotifications.js';

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST']
  }
});

// Set io instance for notification service
setIO(io);

// 1. CORS Configuration - Allow specific origins
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',  // Vite default port
  'http://localhost:5174',  // Vite alternate port
  process.env.FRONTEND_URL 
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`⚠️ CORS blocked origin: ${origin}`);
      callback(new Error('CORS not allowed'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-paystack-signature']
}));

// 2. Logging (So we see what's happening)
app.use((req, res, next) => {
  console.log(`📡 ${req.method} ${req.url}`);
  next();
});

// 3. Body Parsing - CRITICAL: Parse JSON for most routes
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const PORT = process.env.PORT || 5000;
connectDB().catch(console.error);


// Fix 1: Health Checks
app.get('/health', (req, res) => res.send('OK'));
app.get('/api/health', (req, res) => res.send('OK'));

// Fix 2: Config (Catches /api/config AND /api/config/anything)
app.use('/api/config', (req, res) => {
  res.json({
    success: true,
    data: {
      appName: "Glinax Bot",
      apiBaseUrl: process.env.BACKEND_URL || "https://glinax-backend.onrender.com/api",
      features: { enablePayments: true, enableUploads: true },
      // Add defaults for any specific keys frontend asks for
      api_base_url: process.env.BACKEND_URL || "https://glinax-backend.onrender.com/api",
      timeout: 10000
    }
  });
});

// Fix 3: Content/Pages (Catches /api/content/pages/home etc)
app.use('/api/content', (req, res) => {
  res.json({
    success: true,
    data: {
      hero: { title: "Welcome", subtitle: "Ask me anything about universities" },
      sections: []
    }
  });
});

// Fix 4: Universities List (Prevents crash on load)
app.get('/api/universities', (req, res) => {
  res.json({ success: true, data: [] });
});

// Fix 5: Demo Chat Endpoint (No Auth Required) - ENHANCED
// This is now handled by the chat routes - removed duplicate

// ==========================================

// Import assessment routes
import assessmentRoutes from './src/routes/assessments.js';
// Import notification routes
import notificationRoutes from './src/routes/notifications.js';
// Import notification triggers
import { scheduleAdmissionChecks } from './src/utils/notificationTriggers.js';
// Import notification cleanup scheduler
import { startCleanupSchedule } from './src/scripts/cleanupNotifications.js';
// Import admission notifications scheduler
import { startAdmissionNotificationsScheduler } from './src/scripts/admissionNotificationsScheduler.js';

// Real Routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/chat', chatRoutes); // Note: singular 'chat' not 'chats'
app.use('/api/assessments', assessmentRoutes);
app.use('/api/payments', paymentRoutes);
// CRITICAL: Paystack webhook route - must be registered to handle payment webhooks
app.use('/api/payments/webhook', paystackWebhookRoutes);
// Socket.io connection handling for real-time notifications
io.on('connection', (socket) => {
  console.log('👤 User connected:', socket.id);

  // Join user-specific room for notifications
  socket.on('join-user-room', (userId) => {
    socket.join(`user_${userId}`);
    console.log(`👤 User ${userId} joined their room`);
  });

  // Leave user room
  socket.on('leave-user-room', (userId) => {
    socket.leave(`user_${userId}`);
    console.log(`👤 User ${userId} left their room`);
  });

  socket.on('disconnect', () => {
    console.log('👤 User disconnected:', socket.id);
  });
});

// Make io available globally for sending notifications
global.io = io;

// Function to send real-time notifications
export const sendRealTimeNotification = (userId, notification) => {
  if (global.io) {
    global.io.to(`user_${userId}`).emit('notification', notification);
    console.log(`📢 Real-time notification sent to user ${userId}: ${notification.title}`);
  }
};

app.use('/api/forms', formRoutes);
app.use('/api/notifications', notificationRoutes);

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} with Socket.io`);
  // Start admission notification checks
  scheduleAdmissionChecks();
  // Start notification cleanup scheduler (deletes read notifications after 5 seconds)
  startCleanupSchedule();
  // Start admission notifications scheduler (fetches updates every 6 hours)
  startAdmissionNotificationsScheduler();
});
