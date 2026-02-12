# FCM Notifications Not Working on Production Server

## Problem
FCM notifications work on localhost but not on production server (https://bescomdas.vcaan.in/)

## Common Causes & Solutions

### 1. ✅ Check Production Server Has Firebase Service Account Key

**Issue**: Production server might be missing `serviceAccountKey.json`

**Solution**:
```bash
# On production server, check if file exists:
ls -la server/config/serviceAccountKey.json

# If missing, upload it:
# 1. Download from Firebase Console
# 2. Upload to: server/config/serviceAccountKey.json
# 3. Restart server
```

**Check server logs**:
- Look for: `✅ Firebase Admin initialized successfully`
- If you see: `⚠️ Firebase Admin service account key not found` → File is missing

---

### 2. ✅ Check FCM Tokens Are Registered with Production Server

**Issue**: Mobile app might have registered tokens with localhost backend

**Solution**:
1. **Force re-registration of FCM tokens**:
   - Logout from mobile app
   - Clear app data (or reinstall)
   - Login again
   - This will register new token with production server

2. **Check database**:
   ```javascript
   // In MongoDB, check FCM tokens:
   db.fcmtokens.find({ userId: "your-user-id" })
   
   // Verify tokens exist for production users
   ```

3. **Verify token registration endpoint**:
   - Check mobile app logs: `[FCM] Token sent to backend successfully`
   - Verify API call goes to: `https://bescomdas.vcaan.in/api/fcm/register-token`
   - NOT: `http://localhost:5000/api/fcm/register-token`

---

### 3. ✅ Check Mobile App API Configuration

**Issue**: Mobile app might still be using localhost API

**Check**:
1. Open mobile app logs
2. Look for: `PRODUCTION MODE → API Base URL: https://bescomdas.vcaan.in/api`
3. If you see localhost → App is in development mode

**Solution**:
- **For Production APK/AAB**: Make sure you built with `__DEV__ = false`
- **For Development**: The app will use localhost (this is expected)

**Force Production URL** (if needed):
```typescript
// In Mobile/utils/api.ts
// Temporarily force production URL:
export const API_BASE = "https://bescomdas.vcaan.in/api";
```

---

### 4. ✅ Check Production Server Can Reach Firebase

**Issue**: Production server might have network/firewall restrictions

**Test**:
```bash
# On production server, test Firebase connectivity:
curl -I https://fcm.googleapis.com

# Should return: HTTP/2 200 or similar
```

**If blocked**:
- Check firewall rules
- Allow outbound HTTPS to `*.googleapis.com`
- Check proxy settings

---

### 5. ✅ Check Server Logs for FCM Errors

**On production server**, check logs when sending notification:

**Good logs**:
```
[FCM] ✅ Push notification sent to user jagadish1, token: abc123...
[FCM] 📤 Sent 1/1 push notifications to user: jagadish1
```

**Error logs**:
```
[FCM] ❌ Error sending push notification to user jagadish1: ...
[FCM] No FCM tokens found for user: jagadish1
Firebase Admin not initialized
```

---

### 6. ✅ Verify Firebase Project Configuration

**Check**:
1. **Mobile app** uses correct `google-services.json`:
   - File: `Mobile/android/app/google-services.json`
   - Should match your Firebase project

2. **Backend** uses correct `serviceAccountKey.json`:
   - File: `server/config/serviceAccountKey.json`
   - Should be from SAME Firebase project

3. **Both must be from the same Firebase project!**

---

### 7. ✅ Test FCM from Production Server

**Create test script on production server**:
```javascript
// server/test-fcm-production.js
import fetch from 'node-fetch';

const API_BASE = 'https://bescomdas.vcaan.in/api';
const USER_ID = 'jagadish1';
const TOKEN = 'your-production-token-here'; // Get from login

async function testFCM() {
  try {
    const response = await fetch(`${API_BASE}/fcm/send-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`
      },
      body: JSON.stringify({
        userId: USER_ID,
        title: 'Production Test',
        body: 'Testing FCM from production server',
        data: { test: 'true' }
      })
    });

    const data = await response.json();
    console.log('Response:', data);
  } catch (error) {
    console.error('Error:', error);
  }
}

testFCM();
```

---

## 🔍 Step-by-Step Debugging

### Step 1: Check Server Configuration
```bash
# SSH into production server
cd /path/to/server
ls -la config/serviceAccountKey.json  # Should exist
cat config/firebaseAdmin.js  # Check initialization
```

### Step 2: Check Server Logs
```bash
# Restart server and watch logs
npm start
# Look for: "✅ Firebase Admin initialized successfully"
```

### Step 3: Check Database
```javascript
// Connect to MongoDB
use your-database-name
db.fcmtokens.find().pretty()
// Verify tokens exist for your user
```

### Step 4: Test from Mobile App
1. Open mobile app
2. Check logs: `[FCM] Token sent to backend successfully`
3. Verify URL in logs: Should be `https://bescomdas.vcaan.in/api/fcm/register-token`

### Step 5: Test Notification Sending
```bash
# On production server
node test-fcm-production.js
# Check server logs for FCM send results
```

---

## ✅ Quick Fix Checklist

- [ ] `serviceAccountKey.json` exists on production server
- [ ] Server logs show: `✅ Firebase Admin initialized successfully`
- [ ] FCM tokens exist in database for production users
- [ ] Mobile app uses production API URL (not localhost)
- [ ] Mobile app re-registered tokens after switching to production
- [ ] Firebase project matches between mobile and backend
- [ ] Production server can reach Firebase (no firewall blocks)
- [ ] Server logs show successful FCM sends (not errors)

---

## 🚨 Most Common Issue

**FCM tokens registered with localhost instead of production**

**Fix**:
1. Logout from mobile app
2. Clear app data / Reinstall
3. Login again
4. Token will be registered with production server
5. Test notification again

---

## 📞 Still Not Working?

Check these in order:
1. Server logs when sending notification
2. Database for FCM tokens
3. Mobile app logs for token registration
4. Network connectivity from server to Firebase
5. Firebase project configuration


