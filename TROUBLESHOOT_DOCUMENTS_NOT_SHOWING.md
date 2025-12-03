# Troubleshooting: Documents Not Showing in MongoDB Compass

## Problem
The console logs show documents exist and verification passes, but they're not visible in MongoDB Compass.

## Common Causes & Solutions

### 1. ✅ Wrong Database Selected

**Issue:** You might be connected to a different database than where documents are saved.

**Check:**
- Look at the database name in MongoDB Compass (left sidebar, top)
- Check server console logs for: `database: EquipmentOfflineSites.db.name`

**Solution:**
1. In MongoDB Compass, check all databases in the left sidebar
2. Look for the database name shown in console logs
3. Navigate to that database and check the `Equipment offline sites` collection

---

### 2. ✅ Filters Applied in MongoDB Compass

**Issue:** Active filters might be hiding documents.

**Check:**
- Look at the Filter bar in MongoDB Compass
- Check if any filter text is entered

**Solution:**
1. Clear all filters (click "X" or delete filter text)
2. Press Enter to refresh the view
3. Documents should now appear

---

### 3. ✅ Collection Name Case Sensitivity

**Issue:** Collection name might be different (case-sensitive).

**Check:**
- Look at the collection name shown in console logs
- Compare with collection name in MongoDB Compass

**Solution:**
- Collection name should be exactly: `Equipment offline sites` (with space and capital E)

---

### 4. ✅ View Not Refreshed

**Issue:** MongoDB Compass might be showing cached/old data.

**Solution:**
1. Click the refresh button in MongoDB Compass
2. Or close and reopen the collection view
3. Or press F5 to refresh

---

### 5. ✅ Documents in Different Collection

**Issue:** Documents might be saved to a different collection name.

**Check Console Logs:**
Look for:
```
collection: EquipmentOfflineSites.collection.name
```

**Solution:**
- Search for the collection name shown in logs
- Or check all collections in the database

---

### 6. ✅ Database Connection Issue

**Issue:** Server is saving to one database, Compass is viewing another.

**Check:**
1. Server console shows: `MongoDB Connected: <host>`
2. MongoDB Compass is connected to the same host

**Solution:**
- Verify both are using the same MongoDB URI
- Check environment variables (`.env` file) for `MONGODB_URI`

---

### 7. ✅ Documents Actually Don't Exist

**Issue:** Verification might be checking cached/memory data, not actual database.

**New Enhanced Verification:**
The updated code now includes:
- Direct database query (bypassing Mongoose)
- Database and collection name logging
- Comparison between Mongoose and direct queries

**Check Console Logs:**
After routing, look for:
```
[Routing] 🔍 DIRECT DATABASE QUERY (bypassing Mongoose): {
  database: "your_database_name",
  collection: "Equipment offline sites",
  totalDocuments: 2,  // ← Should be 2
  documents: [...]
}
```

---

## How to Verify Documents Exist

### Method 1: Check Console Logs

After routing, check server console for:

```
[Routing] 🔍 DIRECT DATABASE QUERY (bypassing Mongoose): {
  database: "equipment",
  collection: "Equipment offline sites",
  totalDocuments: 2,  // ← This number
  documents: [
    { _id: "...", rowKey: "...", isOriginal: true },
    { _id: "...", rowKey: "...", isRouted: true }
  ]
}
```

**If `totalDocuments: 2`** → Both documents exist in database
**If `totalDocuments: 1`** → Only one document exists
**If `totalDocuments: 0`** → No documents exist

### Method 2: Direct MongoDB Query

In MongoDB Shell or Compass Shell, run:

```javascript
// Connect to the database
use your_database_name;

// Find all documents for the site
db.getCollection('Equipment offline sites').find({
  fileId: "nc35yh",
  siteCode: "5W2922"
}).forEach(doc => {
  printjson({
    _id: doc._id.toString(),
    rowKey: doc.rowKey,
    userId: doc.userId,
    siteCode: doc.siteCode
  });
  print("---");
});
```

### Method 3: Check Database Name

Run this in MongoDB Shell:

```javascript
// List all databases
show dbs;

// Check current database
db.getName();

// Switch to your database
use your_database_name;

// List collections
show collections;

// Count documents in collection
db.getCollection('Equipment offline sites').countDocuments({
  fileId: "nc35yh",
  siteCode: "5W2922"
});
```

---

## Debugging Steps

### Step 1: Check Server Console Logs

After routing, check for:
1. ✅ `database: EquipmentOfflineSites.db.name` - Shows database name
2. ✅ `collection: EquipmentOfflineSites.collection.name` - Shows collection name
3. ✅ `DIRECT DATABASE QUERY` - Shows actual database query results
4. ✅ `totalDocuments: X` - Shows how many documents exist

### Step 2: Verify Database Connection

In MongoDB Compass:
1. Check connection string in top-left
2. Verify it matches your server's `MONGODB_URI`
3. Check database name in left sidebar

### Step 3: Clear All Filters

In MongoDB Compass:
1. Remove any filter text
2. Remove any sort settings
3. Refresh the view

### Step 4: Search by Document ID

In MongoDB Compass Filter:
```json
{ "_id": ObjectId("692aba26c9d6c2307d9b6b62") }
```

If this doesn't find it, the document doesn't exist in this database/collection.

---

## Enhanced Logging Added

The code now includes:

1. **Database Name Logging:**
   ```
   database: EquipmentOfflineSites.db.name
   ```

2. **Collection Name Logging:**
   ```
   collection: EquipmentOfflineSites.collection.name
   ```

3. **Direct Database Query:**
   - Bypasses Mongoose
   - Queries MongoDB directly
   - Shows actual database contents

4. **Comparison:**
   - Compares Mongoose results vs direct query results
   - Warns if they differ

---

## Quick Checklist

- [ ] Check console logs for database name
- [ ] Verify MongoDB Compass is connected to same database
- [ ] Clear all filters in MongoDB Compass
- [ ] Check collection name matches exactly: `Equipment offline sites`
- [ ] Refresh MongoDB Compass view
- [ ] Check `DIRECT DATABASE QUERY` logs for `totalDocuments`
- [ ] Try searching by document ID directly
- [ ] Verify both server and Compass use same MongoDB URI

---

## What to Do Next

1. **Run a routing operation** and check the enhanced console logs
2. **Look for the `DIRECT DATABASE QUERY` log** - this shows the actual database contents
3. **Compare the database name** in logs vs MongoDB Compass
4. **Share the console logs** if documents still don't appear

The enhanced logging will now show you exactly:
- Which database documents are saved to
- Which collection they're in
- How many documents actually exist
- Whether Mongoose and direct queries match



