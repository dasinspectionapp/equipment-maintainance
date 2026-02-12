# FCM Production Fix - Quick Guide

## ✅ What Was Fixed

The mobile app now **automatically detects** when you switch from localhost to production and **re-registers FCM tokens** with the correct backend.

### Changes Made:
1. **Mobile App** (`Mobile/services/fcmService.ts`):
   - Now tracks the API base URL
   - Automatically re-registers token when API base changes
   - Ensures tokens are always registered with the current backend

---

## 🚀 Quick Fix Steps

### Step 1: Verify Production Server Setup

**On production server**, check:

```bash
# 1. Check if serviceAccountKey.json exists
ls -la server/config/serviceAccountKey.json

# 2. Check server logs for Firebase initialization
# Should see: "✅ Firebase Admin initialized successfully"
```

**If missing**:
1. Download `serviceAccountKey.json` from Firebase Console
2. Upload to: `server/config/serviceAccountKey.json`
3. Restart server

---

### Step 2: Re-register FCM Token on Mobile

**Option A: Automatic (Recommended)**
1. **Logout** from mobile app
2. **Login again**
3. App will automatically detect production API and register token

**Option B: Manual**
1. **Clear app data** (Settings → Apps → Your App → Clear Data)
2. **Reinstall app**
3. **Login**
4. Token will be registered with production server

---

### Step 3: Verify Token Registration

**Check mobile app logs**:
```
[FCM] API base changed or first time - registering token with: https://bescomdas.vcaan.in/api
[FCM] Token sent to backend successfully
```

**Check database** (MongoDB):
```javascript
db.fcmtokens.find({ userId: "your-user-id" })
// Should show token registered
```

---

### Step 4: Test Notification

**From production server**, test:
```bash
# Use the test script
cd server
node test-fcm.js
```

**Or use Postman**:
```
POST https://bescomdas.vcaan.in/api/fcm/send-notification
Headers:
  Authorization: Bearer YOUR_TOKEN
Body:
  {
    "userId": "jagadish1",
    "title": "Test",
    "body": "Testing from production"
  }
```

---

## 🔍 Troubleshooting

### Issue: Still not receiving notifications

**Check 1: Server Logs**
```bash
# On production server, check logs when sending notification
# Should see:
[FCM] ✅ Push notification sent to user...
[FCM] 📤 Sent 1/1 push notifications
```

**Check 2: Database**
```javascript
// Verify token exists
db.fcmtokens.find({ userId: "your-user-id" })
```

**Check 3: Mobile App API**
- Open mobile app logs
- Verify: `PRODUCTION MODE → API Base URL: https://bescomdas.vcaan.in/api`
- NOT: `http://localhost:5000/api`

**Check 4: Firebase Configuration**
- Mobile app: `Mobile/android/app/google-services.json` (correct project)
- Backend: `server/config/serviceAccountKey.json` (same project)

---

## ✅ Verification Checklist

- [ ] `serviceAccountKey.json` exists on production server
- [ ] Server logs show: `✅ Firebase Admin initialized successfully`
- [ ] Mobile app shows: `PRODUCTION MODE → API Base URL: https://bescomdas.vcaan.in/api`
- [ ] Mobile app logs show: `[FCM] Token sent to backend successfully`
- [ ] Database has FCM token for your user
- [ ] Test notification works from production server

---

## 📝 Summary

**The fix ensures**:
- ✅ FCM tokens are automatically re-registered when switching between localhost and production
- ✅ No manual token re-registration needed
- ✅ Works seamlessly when deploying to production

**What to do now**:
1. **Logout and login** on mobile app (to trigger token re-registration)
2. **Verify** server has `serviceAccountKey.json`
3. **Test** notification from production server

---

## 🆘 Still Not Working?

See detailed guide: `server/FCM_PRODUCTION_TROUBLESHOOTING.md`


