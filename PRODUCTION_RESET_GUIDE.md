# Production Data Reset Guide

## Before Going to Production

Before deploying your application to production, you should reset all test/development data related to offline sites. This guide shows you two methods to do this.

---

## Method 1: Automated Script (Recommended)

Use the automated reset script to clean all data in one go.

### Steps:

1. **Navigate to server directory:**
   ```bash
   cd server
   ```

2. **Run the reset script:**
   ```bash
   node reset-production-data.js
   ```

3. **Review what will be deleted:**
   - The script will show you counts of all data that will be deleted
   - It will ask for confirmation before proceeding

4. **Confirm deletion:**
   - Type `CONFIRM` when prompted (or comment out confirmation in script for automated deployment)

### What Gets Deleted:
- ✅ All ONLINE-OFFLINE DATA files
- ✅ All Device Status Upload files  
- ✅ All RTU Tracker files
- ✅ Equipment Offline Sites (database records)
- ✅ RTU Tracker Sites (database records)
- ✅ Actions (routing/task data)
- ✅ Approvals (CCR/Equipment approvals)
- ✅ User Data States (saved states)
- ✅ Equipment Reports
- ✅ RTU Tracker Approvals
- ✅ Notifications (related to offline sites)

### What Gets Preserved:
- ✅ Users & Accounts
- ✅ Settings & Configurations
- ✅ Admin Upload Fields
- ✅ Email Configurations
- ✅ Landing Page Slides
- ✅ E-Library Resources

---

## Method 2: Manual Reset (via MongoDB)

If you prefer manual control, you can delete collections directly in MongoDB.

### Using MongoDB Compass:

1. **Connect to your MongoDB database**

2. **Delete these collections** (or delete all documents in each):
   ```
   uploads
   equipmentofflinesites
   rtutrackersites
   actions
   approvals
   userdatastates
   equipmentreports
   rtutrackerappro vals
   notifications (filter by application: "Distribution Automation System")
   ```

### Using MongoDB Shell:

```javascript
// Connect to your database
use your_database_name

// Delete all uploads
db.uploads.deleteMany({})

// Delete equipment offline sites
db.equipmentofflinesites.deleteMany({})

// Delete RTU tracker sites
db.rtutrackersites.deleteMany({})

// Delete actions
db.actions.deleteMany({})

// Delete approvals
db.approvals.deleteMany({})

// Delete user data states
db.userdatastates.deleteMany({})

// Delete equipment reports
db.equipmentreports.deleteMany({})

// Delete RTU tracker approvals
db.rtutrackerapprovls.deleteMany({})

// Delete notifications
db.notifications.deleteMany({ 
  application: { $in: ["Distribution Automation System", "Equipment Maintenance"] } 
})
```

---

## Method 3: Selective Reset (Keep Some Data)

If you want to keep certain files or data, modify the reset script:

### Keep Specific Files:

Edit `reset-production-data.js` and add filters:

```javascript
// Example: Keep files uploaded after a certain date
const onlineOfflineResult = await Upload.deleteMany({
  uploadType: 'online-offline-data',
  uploadedAt: { $lt: new Date('2025-01-01') } // Delete only before Jan 1, 2025
});
```

### Keep Certain Users' Data:

```javascript
// Example: Keep data for specific divisions
const offlineSitesResult = await EquipmentOfflineSites.deleteMany({
  division: { $ne: 'Koramangala' } // Keep Koramangala, delete others
});
```

---

## After Reset

### 1. Verify Data is Cleared

Check your application:
- ✅ MY OFFLINE SITES tab should be empty
- ✅ Dashboard should show 0 offline sites
- ✅ No pending approvals
- ✅ No actions in MY APPROVALS

### 2. Upload Fresh Production Data

When you're ready to start production:

1. **Upload your first ONLINE-OFFLINE.xlsx file**
   - Go to Admin panel → Upload Files
   - Select `ONLINE-OFFLINE DATA` as upload type
   - Upload your production ONLINE-OFFLINE.xlsx

2. **Verify the data appears correctly**
   - Check Dashboard shows correct counts
   - Check MY OFFLINE SITES shows current offline sites
   - Verify all columns are displayed correctly

### 3. User Testing

Have each role test their access:
- **Equipment:** Can see MY OFFLINE SITES, can edit Site Observations
- **CCR:** Can see dashboard, can approve resolutions
- **O&M/RTU/AMC:** Can see assigned actions

---

## Production Checklist

Before going live, ensure:

- [ ] All test data is deleted using reset script
- [ ] Production ONLINE-OFFLINE.xlsx file is uploaded
- [ ] Dashboard shows correct offline count
- [ ] MY OFFLINE SITES shows correct sites
- [ ] All users can login
- [ ] Notifications are working
- [ ] Email configurations are set (if using email)
- [ ] Backup of database is taken
- [ ] Environment variables are set correctly for production
- [ ] MongoDB connection string points to production database
- [ ] Server is deployed and running
- [ ] SSL/HTTPS is configured
- [ ] Admin accounts are secured

---

## Rollback Plan

If something goes wrong after reset:

### If you have a backup:
```bash
# Restore from MongoDB backup
mongorestore --uri="your_connection_string" --db=your_database dump/
```

### If you don't have a backup:
- You'll need to re-upload all files
- Users and settings are preserved
- Offline site tracking will start fresh

---

## Troubleshooting

### Script fails with connection error:
- Check `MONGO_URI` in `.env` file
- Ensure MongoDB is running
- Verify network access to database

### Script doesn't delete all data:
- Check if collections use different names
- Run script with `--force` flag (if implemented)
- Manually verify in MongoDB Compass

### Application still shows old data:
- Clear browser cache (Ctrl+Shift+Delete)
- Clear localStorage: Open browser console and run `localStorage.clear()`
- Restart the server

---

## Support

If you encounter issues during production reset:
1. Check the console logs for error messages
2. Verify MongoDB connection
3. Ensure all required models are imported in reset script
4. Contact your database administrator if needed

---

**⚠️ IMPORTANT:** Always take a backup before running the reset script in production!

```bash
# Create backup before reset
mongodump --uri="your_connection_string" --out=backup_before_reset
```

