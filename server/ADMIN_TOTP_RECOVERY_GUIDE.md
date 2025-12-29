# Admin TOTP Recovery Guide

## Overview
If an admin loses access to their TOTP (Two-Factor Authentication), there are several recovery methods available.

## Recovery Methods

### Method 1: Use Recovery Codes (Recommended)
**When to use:** If you saved your recovery codes during TOTP setup.

**Steps:**
1. Go to login page
2. Enter User ID and Password
3. When prompted for OTP, click "Use Recovery Code" (if available) or use the recovery login endpoint
4. Enter one of your 8 recovery codes
5. You'll be logged in and can set up TOTP again

**Recovery Login Endpoint:**
```
POST /api/auth/recovery-login
Body: {
  userId: "admin",
  password: "your-password",
  recoveryCode: "YOUR_RECOVERY_CODE"
}
```

### Method 2: Another Admin Resets TOTP
**When to use:** If there are multiple admins in the system.

**Steps:**
1. Another admin logs in
2. Goes to User Management
3. Finds the locked-out admin user
4. Clicks "Reset TOTP" button
5. Locked-out admin can now login with just password and set up TOTP again

### Method 3: Emergency Recovery Script (Server Access Required)
**When to use:** If you have server/database access and no other recovery method works.

**Prerequisites:**
- Access to the server where the backend is running
- Node.js installed
- MongoDB connection access

**Steps:**
1. Navigate to server directory:
   ```bash
   cd server
   ```

2. Run the emergency recovery script:
   ```bash
   node utils/emergencyTotpRecovery.js <userId>
   ```
   
   Example:
   ```bash
   node utils/emergencyTotpRecovery.js admin
   ```

3. The script will:
   - Connect to MongoDB
   - Find the user
   - Reset TOTP (clears secret, disables TOTP, clears recovery codes)
   - Keep `adminAllowsTotp = true` so user can set up again

4. Admin can now login with just User ID + Password
5. Admin should immediately set up TOTP again in Settings

**Security Note:** This script bypasses all security checks. Use only in emergencies and ensure server access is secure.

### Method 4: Direct Database Access (Advanced)
**When to use:** If you have direct MongoDB access and other methods fail.

**MongoDB Command:**
```javascript
// Connect to MongoDB
use your_database_name

// Find and reset admin TOTP
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

**After reset:**
- Admin can login with User ID + Password
- Admin should immediately set up TOTP again

## Prevention Best Practices

1. **Save Recovery Codes Securely:**
   - Print recovery codes and store in a safe location
   - Store in a password manager
   - Keep a backup in a secure location

2. **Multiple Admins:**
   - Always have at least 2 admin accounts
   - Ensure at least one admin doesn't have TOTP enabled initially
   - Or ensure one admin has recovery codes saved

3. **Regular Backups:**
   - Backup recovery codes
   - Document admin user IDs

4. **Emergency Access:**
   - Keep server access credentials secure
   - Document emergency recovery procedures
   - Train at least one other person on recovery procedures

## Quick Reference

| Method | Requires | Speed | Security Level |
|--------|----------|-------|----------------|
| Recovery Codes | Saved codes | Fast | High |
| Another Admin | Multiple admins | Fast | High |
| Emergency Script | Server access | Medium | Medium |
| Database Direct | MongoDB access | Fast | Low (use carefully) |

## Important Notes

- **After recovery, immediately set up TOTP again** to restore security
- **Save new recovery codes** when setting up TOTP again
- **Test recovery procedures** periodically to ensure they work
- **Document recovery procedures** for your team

## Support

If none of these methods work, contact your system administrator or database administrator for assistance.

