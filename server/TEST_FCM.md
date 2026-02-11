# Easy FCM Notification Test Guide

## Method 1: Using the Test Script (Easiest) ⭐

### Step 1: Update the Token
Open `test-fcm.js` and update these two lines at the top:
```javascript
const TOKEN = 'YOUR_TOKEN_HERE';  // Paste your login token
const USER_ID = 'jagadish1';      // Your user ID
```

### Step 2: Run the Script
```bash
cd server
node test-fcm.js
```

That's it! The script will:
- ✅ Check if server is running
- ✅ Send the notification
- ✅ Show you the results
- ✅ Tell you what to check on your device

---

## Method 2: Using Postman (Visual)

### Step 1: Open Postman

### Step 2: Create New Request
- Method: `POST`
- URL: `http://localhost:5000/api/fcm/send-notification`

### Step 3: Add Headers
Go to **Headers** tab, add:
- `Content-Type`: `application/json`
- `Authorization`: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5MDE5ODlhNDFmZTI0ODBlOWY5NTkxOSIsImlhdCI6MTc3MDgyODEyMCwiZXhwIjoxNzcxNDMyOTIwfQ.owJKeD24QICnvDsmu830pPIzWqLp8T3UHBmikT0KSrY`

### Step 4: Add Body
Go to **Body** tab:
- Select `raw`
- Select `JSON` from dropdown
- Paste this:
```json
{
  "userId": "jagadish1",
  "title": "Test Notification",
  "body": "This is a test push notification"
}
```

### Step 5: Click Send

---

## Method 3: Using Browser Console (Quick Test)

1. Open your browser
2. Press `F12` to open Developer Tools
3. Go to **Console** tab
4. Paste this:

```javascript
fetch('http://localhost:5000/api/fcm/send-notification', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5MDE5ODlhNDFmZTI0ODBlOWY5NTkxOSIsImlhdCI6MTc3MDgyODEyMCwiZXhwIjoxNzcxNDMyOTIwfQ.owJKeD24QICnvDsmu830pPIzWqLp8T3UHBmikT0KSrY'
  },
  body: JSON.stringify({
    userId: 'jagadish1',
    title: 'Test Notification',
    body: 'This is a test push notification'
  })
})
.then(res => res.json())
.then(data => console.log('✅ Success:', data))
.catch(err => console.error('❌ Error:', err));
```

---

## What to Check After Sending

### ✅ Success Response:
```json
{
  "success": true,
  "message": "Notification sent",
  "results": [...]
}
```

### 📱 On Your Mobile Device:
1. **App in Foreground**: Alert dialog should appear
2. **App in Background**: Notification should appear in system tray
3. **App Killed**: Notification should appear, tapping opens app

### 📊 Server Console:
Look for these logs:
```
[FCM] ✅ Push notification sent to user jagadish1
[FCM] 📤 Sent 1/1 push notifications
```

---

## Troubleshooting

### ❌ "Connection Refused"
**Solution**: Start the server
```bash
cd server
npm start
```

### ❌ "Unauthorized" or "401"
**Solution**: Token expired, login again and update token

### ❌ "No FCM tokens found"
**Solution**: 
- Make sure you're logged into the mobile app
- Check database: `db.fcmtokens.find({ userId: "jagadish1" })`

### ❌ Notification sent but not appearing on device
**Solution**: 
- Check notification permissions: Settings → Apps → [Your App] → Notifications
- Check if device has internet connection
- Check Android logs: `adb logcat | grep FCMService`

---

## Quick Checklist

- [ ] Server is running (`npm start` in server folder)
- [ ] You're logged into mobile app
- [ ] FCM token exists in database
- [ ] Notification permissions enabled on device
- [ ] Device has internet connection
- [ ] Token is not expired

---

## Need Help?

1. Check server console for error messages
2. Check Android logs: `adb logcat | grep FCMService`
3. Verify FCM token in database
4. Test with Firebase Console first

