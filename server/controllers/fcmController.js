import FCMToken from '../models/FCMToken.js';
import User from '../models/User.js';
import admin from '../config/firebaseAdmin.js';

/**
 * @desc    Register FCM token for a user
 * @route   POST /api/fcm/register-token
 * @access  Private
 */
export const registerFCMToken = async (req, res) => {
  try {
    const { fcmToken, userId, platform, deviceId } = req.body;
    const authenticatedUserId = req.user.userId;

    // Validate required fields
    if (!fcmToken) {
      return res.status(400).json({
        success: false,
        message: 'FCM token is required',
      });
    }

    // Use authenticated user's ID or provided userId
    const targetUserId = userId || authenticatedUserId;

    // Check if token already exists for this user
    let fcmTokenDoc = await FCMToken.findOne({
      userId: targetUserId,
      fcmToken: fcmToken,
    });

    if (fcmTokenDoc) {
      // Update existing token
      fcmTokenDoc.platform = platform || fcmTokenDoc.platform;
      fcmTokenDoc.deviceId = deviceId || fcmTokenDoc.deviceId;
      fcmTokenDoc.lastUpdated = new Date();
      await fcmTokenDoc.save();

      return res.status(200).json({
        success: true,
        message: 'FCM token updated successfully',
        data: fcmTokenDoc,
      });
    }

    // Create new token entry
    fcmTokenDoc = await FCMToken.create({
      userId: targetUserId,
      fcmToken: fcmToken,
      platform: platform || 'android',
      deviceId: deviceId || 'unknown',
      registeredAt: new Date(),
      lastUpdated: new Date(),
    });

    res.status(201).json({
      success: true,
      message: 'FCM token registered successfully',
      data: fcmTokenDoc,
    });
  } catch (error) {
    console.error('Error registering FCM token:', error);
    res.status(500).json({
      success: false,
      message: 'Error registering FCM token',
      error: error.message,
    });
  }
};

/**
 * @desc    Delete FCM token (on logout)
 * @route   POST /api/fcm/delete-token
 * @access  Private
 */
export const deleteFCMToken = async (req, res) => {
  try {
    const { fcmToken } = req.body;
    const userId = req.user.userId;

    if (!fcmToken) {
      return res.status(400).json({
        success: false,
        message: 'FCM token is required',
      });
    }

    // Delete token
    const result = await FCMToken.deleteOne({
      userId: userId,
      fcmToken: fcmToken,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'FCM token not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'FCM token deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting FCM token:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting FCM token',
      error: error.message,
    });
  }
};

/**
 * @desc    Send notification to a specific user
 * @route   POST /api/fcm/send-notification
 * @access  Private
 */
export const sendNotificationToUser = async (req, res) => {
  try {
    const { userId, title, body, data } = req.body;

    if (!userId || !title || !body) {
      return res.status(400).json({
        success: false,
        message: 'userId, title, and body are required',
      });
    }

    // Get all FCM tokens for the user
    const tokens = await FCMToken.find({ userId: userId });
    
    if (tokens.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No FCM tokens found for this user',
      });
    }

    const fcmTokens = tokens.map((token) => token.fcmToken);

    // Prepare message
    const message = {
      notification: {
        title: title,
        body: body,
      },
      data: data || {},
      android: {
        priority: 'high',
        notification: {
          channelId: 'default_channel',
          sound: 'default',
        },
      },
    };

    // Send to all devices
    const results = [];
    for (const token of fcmTokens) {
      try {
        const response = await admin.messaging().send({
          ...message,
          token: token,
        });
        results.push({ token, success: true, messageId: response });
      } catch (error) {
        console.error(`Error sending to token ${token}:`, error);
        // If token is invalid, delete it
        if (error.code === 'messaging/invalid-registration-token' || 
            error.code === 'messaging/registration-token-not-registered') {
          await FCMToken.deleteOne({ fcmToken: token });
        }
        results.push({ token, success: false, error: error.message });
      }
    }

    res.status(200).json({
      success: true,
      message: 'Notification sent',
      results: results,
    });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending notification',
      error: error.message,
    });
  }
};

/**
 * @desc    Send notification to multiple users
 * @route   POST /api/fcm/send-notification-multiple
 * @access  Private
 */
export const sendNotificationToMultipleUsers = async (req, res) => {
  try {
    const { userIds, title, body, data } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'userIds array is required',
      });
    }

    if (!title || !body) {
      return res.status(400).json({
        success: false,
        message: 'title and body are required',
      });
    }

    // Get all FCM tokens for the users
    const tokens = await FCMToken.find({ userId: { $in: userIds } });
    
    if (tokens.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No FCM tokens found for these users',
      });
    }

    const fcmTokens = tokens.map((token) => token.fcmToken);

    // Prepare multicast message
    const message = {
      notification: {
        title: title,
        body: body,
      },
      data: data || {},
      android: {
        priority: 'high',
        notification: {
          channelId: 'default_channel',
          sound: 'default',
        },
      },
    };

    // Send multicast message (more efficient for multiple tokens)
    const response = await admin.messaging().sendEachForMulticast({
      tokens: fcmTokens,
      ...message,
    });

    // Clean up invalid tokens
    if (response.failureCount > 0) {
      const invalidTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const token = fcmTokens[idx];
          if (resp.error?.code === 'messaging/invalid-registration-token' || 
              resp.error?.code === 'messaging/registration-token-not-registered') {
            invalidTokens.push(token);
          }
        }
      });

      if (invalidTokens.length > 0) {
        await FCMToken.deleteMany({ fcmToken: { $in: invalidTokens } });
      }
    }

    res.status(200).json({
      success: true,
      message: 'Notifications sent',
      successCount: response.successCount,
      failureCount: response.failureCount,
    });
  } catch (error) {
    console.error('Error sending notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending notifications',
      error: error.message,
    });
  }
};

