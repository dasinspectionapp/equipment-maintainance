# FCM Notifications Production Checklist

## ✅ After Rebuilding Mobile App

After rebuilding with EAS, notifications **WILL work in production** IF all these are configured:

---

## 🔍 Pre-Deployment Checklist

### 1. ✅ Mobile App (After Rebuild)

- [x] **fcmService.ts** includes API base detection (✅ Already done)
- [x] **App rebuilds** with latest code (✅ You're doing this)
- [ ] **App installed** on device with new build
- [ ] **User logs in** to register FCM token with production server

**Status**: ✅ Ready after rebuild

---

### 2. ⚠️ Production Server Configuration

**CRITICAL**: These must be configured on production server:

#### A. Firebase Service Account Key

- [ ] **File exists**: `server/config/serviceAccountKey.json`
- [ ] **File is from correct Firebase project** (same as mobile app)
- [ ] **File is NOT in git** (should be in .gitignore)

**How to check:**
```bash
# On production server
ls -la server/config/serviceAccountKey.json

# Check server logs on startup
# Should see: "✅ Firebase Admin initialized successfully"
```

**If missing:**
1. Download from Firebase Console
2. Upload to: `server/config/serviceAccountKey.json`
3. Restart server

---

#### B. Server Logs Verification

**Check server startup logs:**
```
✅ Firebase Admin initialized successfully
```

**If you see:**
```
⚠️ Firebase Admin service account key not found
```
→ Service account key is missing!

---

#### C. Database Has FCM Tokens

**After user logs in on mobile app:**
- [ ] FCM token should be registered in database
- [ ] Check: `db.fcmtokens.find({ userId: "your-user-id" })`

**How tokens get registered:**
1. User logs in on mobile app
2. App calls: `POST https://bescomdas.vcaan.in/api/fcm/register-token`
3. Token saved to database

---

### 3. ✅ Mobile App API Configuration

**Check mobile app uses production URL:**
- [ ] App shows: `PRODUCTION MODE → API Base URL: https://bescomdas.vcaan.in/api`
- [ ] NOT: `http://localhost:5000/api`

**This is automatic** - app detects production mode (`__DEV__ = false`)

---

### 4. ✅ Firebase Project Configuration

**Both must use SAME Firebase project:**
- [ ] **Mobile app**: `Mobile/android/app/google-services.json` (from Firebase)
- [ ] **Backend**: `server/config/serviceAccountKey.json` (from same Firebase project)

**If different projects:**
- Notifications won't work
- Must use same Firebase project for both

---

## 🚀 Step-by-Step Deployment

### Step 1: Verify Production Server Setup

**On production server (`https://bescomdas.vcaan.in`):**

```bash
# Check service account key exists
ls -la server/config/serviceAccountKey.json

# Check server logs
# Should see: "✅ Firebase Admin initialized successfully"
```

**If missing:**
1. Download `serviceAccountKey.json` from Firebase Console
2. Upload to production server: `server/config/serviceAccountKey.json`
3. Restart server

---

### Step 2: Rebuild Mobile App

```bash
cd Mobile
eas build --platform android --profile production
```

**Wait for build to complete** (10-20 minutes)

---

### Step 3: Install New Build

1. Download APK from EAS
2. Install on device
3. **Important**: Uninstall old version first (or clear app data)

---

### Step 4: Test FCM Registration

1. **Login to app** on device
2. **Check mobile app logs** for:
   ```
   [FCM] API base changed or first time - registering token with: https://bescomdas.vcaan.in/api
   [FCM] Token sent to backend successfully
   ```

3. **Check database** (on production server):
   ```javascript
   db.fcmtokens.find({ userId: "your-user-id" })
   // Should show token registered
   ```

---

### Step 5: Test Notification

**From production server**, send test notification:

```bash
# Use test script
cd server
node test-fcm.js
```

**Or use Postman:**
```
POST https://bescomdas.vcaan.in/api/fcm/send-notification
Headers:
  Authorization: Bearer YOUR_TOKEN
Body:
  {
    "userId": "your-user-id",
    "title": "Test",
    "body": "Testing from production"
  }
```

**Expected result:**
- ✅ Notification appears on mobile device
- ✅ Server logs show: `[FCM] ✅ Push notification sent`

---

## ❌ Common Issues & Solutions

### Issue 1: "Firebase Admin not initialized"

**Cause**: `serviceAccountKey.json` missing on production server

**Fix**:
1. Download from Firebase Console
2. Upload to `server/config/serviceAccountKey.json`
3. Restart server

---

### Issue 2: "No FCM tokens found"

**Cause**: User hasn't logged in after rebuild, or token not registered

**Fix**:
1. User must login on mobile app
2. Check logs: `[FCM] Token sent to backend successfully`
3. Verify in database: `db.fcmtokens.find({ userId: "..." })`

---

### Issue 3: "Notifications not appearing"

**Possible causes:**
1. **App in foreground** - Shows alert dialog (not notification)
2. **Notifications disabled** - Check device settings
3. **Wrong Firebase project** - Mobile and backend must use same project
4. **Token invalid** - User needs to re-login

**Fix**:
- Check app state (foreground/background/killed)
- Check notification permissions
- Verify Firebase project matches
- Re-login to get new token

---

## ✅ Final Verification

After rebuild and deployment:

1. **Server logs show**: `✅ Firebase Admin initialized successfully`
2. **Mobile app logs show**: `[FCM] Token sent to backend successfully`
3. **Database has token**: `db.fcmtokens.find({ userId: "..." })`
4. **Test notification works**: Notification appears on device

---

## 📊 Summary

**Notifications WILL work in production IF:**

✅ Mobile app rebuilt with latest code  
✅ Production server has `serviceAccountKey.json`  
✅ Server logs show: `✅ Firebase Admin initialized successfully`  
✅ User logs in on mobile app (registers token)  
✅ Database has FCM token for user  
✅ Firebase project matches between mobile and backend  

**Most common issue**: Missing `serviceAccountKey.json` on production server!

---

## 🆘 Still Not Working?

1. Check server logs when sending notification
2. Check mobile app logs for token registration
3. Verify database has FCM tokens
4. Test with: `node server/test-fcm.js`


