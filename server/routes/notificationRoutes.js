import express from 'express';
import {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
  createNotification
} from '../controllers/notificationController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// All notification routes require authentication
router.get('/', protect, getUserNotifications);
router.get('/unread-count', protect, getUnreadCount);
router.put('/:notificationId/read', protect, markAsRead);
router.put('/mark-all-read', protect, markAllAsRead);
router.delete('/all', protect, deleteAllNotifications);
router.delete('/:notificationId', protect, deleteNotification);
router.post('/create', protect, createNotification);

export default router;

