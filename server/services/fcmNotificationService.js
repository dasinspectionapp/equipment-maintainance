/**
 * FCM Notification Service
 * Sends push notifications via FCM when notifications are created
 */

import FCMToken from '../models/FCMToken.js';
import admin from '../config/firebaseAdmin.js';

/**
 * Send FCM push notification to a user
 * @param {string} userId - User ID to send notification to
 * @param {string} title - Notification title
 * @param {string} body - Notification body/message
 * @param {object} data - Additional data payload (optional)
 * @returns {Promise<boolean>} - Returns true if notification was sent successfully
 */
export async function sendFCMPushNotification(userId, title, body, data = {}) {
  try {
    // Get all FCM tokens for the user
    const tokens = await FCMToken.find({ userId: userId });
    
    if (tokens.length === 0) {
      console.log(`[FCM] No FCM tokens found for user: ${userId}`);
      return false;
    }

    const fcmTokens = tokens.map((token) => token.fcmToken);

    // Prepare FCM message
    const message = {
      notification: {
        title: title,
        body: body,
      },
      data: {
        ...data,
        // Add notification metadata
        notificationTitle: title,
        notificationBody: body,
        timestamp: new Date().toISOString(),
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'default_channel',
          sound: 'default',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK', // For React Native, this will open the app
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
        console.log(`[FCM] ✅ Push notification sent to user ${userId}, token: ${token.substring(0, 20)}...`);
      } catch (error) {
        console.error(`[FCM] ❌ Error sending to token ${token.substring(0, 20)}...:`, error.message);
        
        // If token is invalid, delete it
        if (error.code === 'messaging/invalid-registration-token' || 
            error.code === 'messaging/registration-token-not-registered') {
          await FCMToken.deleteOne({ fcmToken: token });
          console.log(`[FCM] 🗑️ Deleted invalid token for user: ${userId}`);
        }
        results.push({ token, success: false, error: error.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`[FCM] 📤 Sent ${successCount}/${fcmTokens.length} push notifications to user: ${userId}`);
    
    return successCount > 0;
  } catch (error) {
    console.error(`[FCM] ❌ Error sending push notification to user ${userId}:`, error);
    return false;
  }
}

/**
 * Send FCM push notifications to multiple users
 * @param {string[]} userIds - Array of user IDs
 * @param {string} title - Notification title
 * @param {string} body - Notification body/message
 * @param {object} data - Additional data payload (optional)
 * @returns {Promise<number>} - Returns number of successful sends
 */
export async function sendFCMPushNotificationToMultipleUsers(userIds, title, body, data = {}) {
  try {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return 0;
    }

    // Get all FCM tokens for the users
    const tokens = await FCMToken.find({ userId: { $in: userIds } });
    
    if (tokens.length === 0) {
      console.log(`[FCM] No FCM tokens found for users: ${userIds.join(', ')}`);
      return 0;
    }

    const fcmTokens = tokens.map((token) => token.fcmToken);

    // Prepare multicast message
    const message = {
      notification: {
        title: title,
        body: body,
      },
      data: {
        ...data,
        notificationTitle: title,
        notificationBody: body,
        timestamp: new Date().toISOString(),
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'default_channel',
          sound: 'default',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
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
        console.log(`[FCM] 🗑️ Deleted ${invalidTokens.length} invalid tokens`);
      }
    }

    console.log(`[FCM] 📤 Sent ${response.successCount}/${fcmTokens.length} push notifications to ${userIds.length} users`);
    return response.successCount;
  } catch (error) {
    console.error(`[FCM] ❌ Error sending push notifications to multiple users:`, error);
    return 0;
  }
}

