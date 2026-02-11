import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  registerFCMToken,
  deleteFCMToken,
  sendNotificationToUser,
  sendNotificationToMultipleUsers,
} from '../controllers/fcmController.js';

const router = express.Router();

/**
 * @route   POST /api/fcm/register-token
 * @desc    Register FCM token for a user
 * @access  Private
 */
router.post('/register-token', protect, registerFCMToken);

/**
 * @route   POST /api/fcm/delete-token
 * @desc    Delete FCM token (on logout)
 * @access  Private
 */
router.post('/delete-token', protect, deleteFCMToken);

/**
 * @route   POST /api/fcm/send-notification
 * @desc    Send notification to a specific user
 * @access  Private (Admin only - optional)
 */
router.post('/send-notification', protect, sendNotificationToUser);

/**
 * @route   POST /api/fcm/send-notification-multiple
 * @desc    Send notification to multiple users
 * @access  Private (Admin only - optional)
 */
router.post('/send-notification-multiple', protect, sendNotificationToMultipleUsers);

export default router;

