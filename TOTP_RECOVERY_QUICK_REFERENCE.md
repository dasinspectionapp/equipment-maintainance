# TOTP Recovery - Quick Reference Guide

## 🚨 Admin TOTP Recovery Methods

### Method 1: Recovery Codes (Fastest - If Codes Saved)
**Use when:** You saved your 8 recovery codes during TOTP setup.

**Steps:**
1. Login page → Enter User ID + Password
2. When OTP is required, use recovery code instead
3. Use endpoint: `POST /api/auth/recovery-login`
   ```json
   {
     "userId": "admin",
     "password": "your-password",
     "recoveryCode": "YOUR_CODE_HERE"
   }
   ```
4. After login, go to Settings and set up TOTP again

---

### Method 2: Another Admin Resets (Recommended)
**Use when:** Multiple admins exist in the system.

**Steps:**
1. Another admin logs in
2. Navigate to: **User Management**
3. Find the locked-out admin user
4. Click **"Reset TOTP"** button (orange button)
5. Locked-out admin can now login with just password
6. Locked-out admin sets up TOTP again in Settings

---

### Method 3: Self-Reset (If Already Logged In)
**Use when:** Admin is already logged in and wants to reset their own TOTP.

**Steps:**
1. Go to **Settings** page
2. Scroll to "Two-Factor Authentication (TOTP)" section
3. If TOTP is enabled, you'll see **"Reset My TOTP"** button (orange)
4. Click it and confirm
5. Set up TOTP again immediately

**Note:** This only works if you're already logged in. If locked out, use Method 1, 2, or 4.

---

### Method 4: Emergency Recovery Script (Server Access Required)
**Use when:** No recovery codes, no other admin, and you have server access.

**Prerequisites:**
- Server/database access
- Node.js installed
- MongoDB connection

**Steps:**
```bash
# Navigate to server directory
cd server

# Run emergency recovery script
node utils/emergencyTotpRecovery.js <userId>

# Example:
node utils/emergencyTotpRecovery.js admin
```

**What it does:**
- Connects to MongoDB
- Finds the user
- Resets TOTP (clears secret, disables TOTP)
- Keeps `adminAllowsTotp = true` so you can set up again

**After running:**
- Login with User ID + Password (no OTP required)
- Immediately set up TOTP again in Settings
- Save new recovery codes!

---

### Method 5: Direct Database Access (Advanced)
**Use when:** You have direct MongoDB access.

**MongoDB Command:**
```javascript
use your_database_name

db.users.updateOne(
  { userId: "admin" },
  {
    $set: {
      totpEnabled: false,
      adminAllowsTotp: true
    },
    $unset: {
      totpSecret: "",
      recoveryCodes: ""
    }
  }
)
```

---

## 📋 Recovery Decision Tree

```
Lost TOTP Access?
│
├─ Have Recovery Codes?
│  └─ YES → Use Method 1 (Recovery Codes)
│
├─ Multiple Admins?
│  └─ YES → Use Method 2 (Another Admin Resets)
│
├─ Already Logged In?
│  └─ YES → Use Method 3 (Self-Reset)
│
├─ Have Server Access?
│  └─ YES → Use Method 4 (Emergency Script)
│
└─ Have Database Access?
   └─ YES → Use Method 5 (Direct Database)
```

---

## ⚠️ Important Notes

1. **After ANY recovery method:**
   - ✅ Login immediately
   - ✅ Go to Settings
   - ✅ Set up TOTP again
   - ✅ **SAVE NEW RECOVERY CODES** (you won't see them again!)

2. **Prevention:**
   - Always save recovery codes in a secure location
   - Keep at least 2 admin accounts
   - Ensure at least one admin has recovery codes saved
   - Test recovery procedures periodically

3. **Security:**
   - Emergency script and database methods bypass security
   - Use only in genuine emergencies
   - Ensure server/database access is secure
   - Document who has access to recovery methods

---

## 🔧 API Endpoints Reference

### Recovery Login
```
POST /api/auth/recovery-login
Body: {
  userId: "admin",
  password: "password",
  recoveryCode: "CODE1234"
}
```

### Reset Own TOTP (Logged In)
```
POST /api/auth/totp/reset-self
Headers: Authorization: Bearer <token>
```

### Admin Reset User TOTP
```
POST /api/admin/totp/reset
Headers: Authorization: Bearer <admin-token>
Body: {
  userId: "target-user-id"
}
```

---

## 📞 Emergency Contacts

- **System Administrator:** [Your contact]
- **Database Administrator:** [Your contact]
- **IT Support:** [Your contact]

---

**Last Updated:** [Current Date]
**Version:** 1.0

