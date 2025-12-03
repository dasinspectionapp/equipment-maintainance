# How to Verify Documents Exist in Database

## Quick Verification Script

I've created a script to directly check if documents exist in the database.

### Step 1: Run the Verification Script

In your terminal, navigate to the project root and run:

```bash
node server/utils/verifyRoutingDocuments.js nc35yh 3W1575
```

Replace:
- `nc35yh` with your `fileId`
- `3W1575` with your `siteCode`

### Step 2: Check the Output

The script will show:
- ✅ Total documents found
- ✅ Original documents (with details)
- ✅ Routed documents (with details)
- ✅ Verification summary

---

## Manual Verification in MongoDB Compass

### Step 1: Open MongoDB Compass
- Launch MongoDB Compass

### Step 2: Connect to Database
- Connect to your MongoDB server (same as your Node.js app uses)

### Step 3: Select Database
- Look for database: **`das`** (check your console logs for the actual database name)
- Click on it

### Step 4: Open Collection
- Find collection: **`Equipment offline sites`**
- Click on it

### Step 5: Clear All Filters
- **IMPORTANT**: Clear any filters (click X on filter bar)
- Refresh the view (press F5 or click refresh icon)

### Step 6: Search for Documents

**Option A: Search by FileId and SiteCode**
```
Filter: { "fileId": "nc35yh", "siteCode": "3W1575" }
```

**Option B: Search by Document ID**
```
Filter: { "_id": ObjectId("692bdc12c9d6c2307d9b6b8e") }
```

**Option C: Search by RowKey**
```
Filter: { "rowKey": "nc35yh-nc35yh-702" }
```

### Step 7: Expected Results
- You should see **2 documents**:
  1. Original document (no `-routed-` in rowKey)
  2. Routed document (has `-routed-` in rowKey)

---

## Common Issues & Solutions

### Issue 1: Documents Not Found

**Possible Causes:**
1. Wrong database selected
2. Filters applied (clear them!)
3. Documents in different database
4. Documents were deleted

**Solution:**
1. Check console logs for database name
2. Clear all filters in MongoDB Compass
3. Check ALL databases in left sidebar
4. Run verification script to confirm

### Issue 2: Only One Document Found

**Possible Causes:**
1. Only original document exists (routed not created)
2. Only routed document exists (original not created)
3. One was deleted

**Solution:**
1. Check server console logs for creation errors
2. Look for `[Routing] ✅✅✅ SUCCESS` message
3. Check for any error messages

### Issue 3: Documents Show Then Disappear

**Possible Causes:**
1. Auto-refresh hiding them
2. Filter applied after viewing
3. Documents actually deleted by code

**Solution:**
1. Disable auto-refresh in MongoDB Compass
2. Clear all filters
3. Run verification script to check persistence

---

## Protection Added

### 1. Routed Documents Protection
- Routed documents (with `-routed-` in rowKey) are now **protected**
- `saveEquipmentOfflineSite` will **NOT** update routed documents
- Attempts to update routed documents will return an error

### 2. Final Async Verification
- After routing completes, the system checks documents again after 2 seconds
- This verifies documents persist after all operations complete
- Check console logs for: `[Routing] 🔍 FINAL ASYNC VERIFICATION`

---

## What to Check

### 1. Server Console Logs
Look for these messages:
```
[Routing] ✅✅✅ SUCCESS: Both documents verified in database!
[Routing] 🔍 FINAL ASYNC VERIFICATION (after response sent)
```

### 2. MongoDB Compass
- Database: `das` (or name shown in logs)
- Collection: `Equipment offline sites`
- Filter: `{ "fileId": "...", "siteCode": "..." }`
- Expected: 2 documents

### 3. Verification Script
Run the script to get detailed information:
```bash
node server/utils/verifyRoutingDocuments.js <fileId> <siteCode>
```

---

## Still Having Issues?

If documents still don't appear:

1. **Run the verification script** - This will show if documents actually exist
2. **Check database name** - Make sure MongoDB Compass is viewing the same database as your server
3. **Clear all filters** - Very important!
4. **Share console logs** - From the routing operation
5. **Share verification script output** - From running the script

The verification script will tell you exactly what's in the database!


