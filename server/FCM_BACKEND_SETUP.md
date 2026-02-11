# FCM Backend Setup Guide

This guide explains how to set up the Firebase Cloud Messaging backend for your server.

## 📋 Prerequisites

1. Firebase project with Cloud Messaging enabled
2. Firebase Admin SDK service account key
3. Node.js server with MongoDB

## 🔧 Setup Steps

### 1. Install Firebase Admin SDK

```bash
cd server
npm install firebase-admin
```

### 2. Get Firebase Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Project Settings** (gear icon)
4. Go to **Service Accounts** tab
5. Click **Generate New Private Key**
6. Save the JSON file as `serviceAccountKey.json`
7. Place it in `server/config/serviceAccountKey.json`

### 3. Add to .gitignore

**IMPORTANT**: Never commit the service account key to git!

Add to `server/.gitignore`:
```
config/serviceAccountKey.json
```

### 4. Verify Setup

The server will automatically initialize Firebase Admin when it starts. Check the console for:
- ✅ `Firebase Admin initialized successfully` - Setup is correct
- ⚠️ `Firebase Admin service account key not found` - Follow step 2

## 📁 Files Created

1. **`server/routes/fcmRoutes.js`** - FCM API routes
2. **`server/controllers/fcmController.js`** - FCM business logic
3. **`server/models/FCMToken.js`** - MongoDB model for storing FCM tokens
4. **`server/config/firebaseAdmin.js`** - Firebase Admin initialization

## 🔌 API Endpoints

### Register FCM Token
**POST** `/api/fcm/register-token`

**Headers:**
```
Authorization: Bearer <user_token>
Content-Type: application/json
```

**Body:**
```json
{
  "fcmToken": "string",
  "userId": "string (optional)",
  "platform": "android",
  "deviceId": "string (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "message": "FCM token registered successfully",
  "data": {
    "userId": "user123",
    "fcmToken": "token...",
    "platform": "android",
    "deviceId": "unknown",
    "registeredAt": "2024-01-01T00:00:00.000Z",
    "lastUpdated": "2024-01-01T00:00:00.000Z"
  }
}
```

### Delete FCM Token
**POST** `/api/fcm/delete-token`

**Headers:**
```
Authorization: Bearer <user_token>
Content-Type: application/json
```

**Body:**
```json
{
  "fcmToken": "string"
}
```

**Response:**
```json
{
  "success": true,
  "message": "FCM token deleted successfully"
}
```

### Send Notification to User
**POST** `/api/fcm/send-notification`

**Headers:**
```
Authorization: Bearer <user_token>
Content-Type: application/json
```

**Body:**
```json
{
  "userId": "user123",
  "title": "Notification Title",
  "body": "Notification body text",
  "data": {
    "screen": "dashboard",
    "customKey": "customValue"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Notification sent",
  "results": [
    {
      "token": "fcm_token_1",
      "success": true,
      "messageId": "message_id"
    }
  ]
}
```

### Send Notification to Multiple Users
**POST** `/api/fcm/send-notification-multiple`

**Headers:**
```
Authorization: Bearer <user_token>
Content-Type: application/json
```

**Body:**
```json
{
  "userIds": ["user1", "user2", "user3"],
  "title": "Notification Title",
  "body": "Notification body text",
  "data": {
    "screen": "dashboard"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Notifications sent",
  "successCount": 3,
  "failureCount": 0
}
```

## 💾 Database Schema

The `FCMToken` model stores:
- `userId` - User ID (indexed)
- `fcmToken` - FCM token (unique, indexed)
- `platform` - 'android' or 'ios'
- `deviceId` - Device identifier
- `registeredAt` - Registration timestamp
- `lastUpdated` - Last update timestamp

## 🔄 Automatic Cleanup

The backend automatically:
- Updates existing tokens instead of creating duplicates
- Deletes invalid tokens when sending fails
- Handles token refresh by updating existing entries

## 📝 Example Usage

### Send notification when action is routed

```javascript
import { sendNotificationToUser } from './controllers/fcmController.js';

// In your action routing logic
await sendNotificationToUser({
  userId: targetUserId,
  title: 'New Action Assigned',
  body: `You have a new action: ${actionTitle}`,
  data: {
    screen: 'approvals',
    actionId: action._id,
  },
});
```

### Send notification to multiple users

```javascript
import { sendNotificationToMultipleUsers } from './controllers/fcmController.js';

// Send to all users in a division
await sendNotificationToMultipleUsers({
  userIds: divisionUserIds,
  title: 'System Update',
  body: 'New features are available',
  data: {
    screen: 'dashboard',
  },
});
```

## 🧪 Testing

### Test Token Registration

```bash
curl -X POST http://localhost:5000/api/fcm/register-token \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fcmToken": "test_token_123",
    "platform": "android"
  }'
```

### Test Sending Notification

```bash
curl -X POST http://localhost:5000/api/fcm/send-notification \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "title": "Test Notification",
    "body": "This is a test notification"
  }'
```

## 🔒 Security Notes

1. **Service Account Key**: Never commit to git or expose publicly
2. **Authentication**: All endpoints require valid JWT token
3. **Token Validation**: Invalid tokens are automatically cleaned up
4. **User Verification**: Users can only register/delete their own tokens

## 🐛 Troubleshooting

### Firebase Admin Not Initialized
- Check if `serviceAccountKey.json` exists in `server/config/`
- Verify the JSON file is valid
- Check file permissions

### Notifications Not Sending
- Verify Firebase project has Cloud Messaging enabled
- Check service account has proper permissions
- Verify FCM tokens are registered in database
- Check Firebase Console for delivery reports

### Invalid Token Errors
- Tokens are automatically cleaned up on send failure
- Users need to re-register tokens after app reinstall
- Token refresh is handled automatically

## 📚 Additional Resources

- [Firebase Admin SDK Documentation](https://firebase.google.com/docs/admin/setup)
- [FCM HTTP v1 API](https://firebase.google.com/docs/cloud-messaging/migrate-v1)
- [FCM Token Management](https://firebase.google.com/docs/cloud-messaging/manage-tokens)

