# Ownership Transfer & Document Creation - Test Document

## Overview
This document provides comprehensive test procedures to verify that ownership transfer and document creation are working correctly during routing operations.

---

## Prerequisites

### Before Testing:
1. ✅ Server is running on port 5000
2. ✅ MongoDB is connected (check for "MongoDB Connected" in console)
3. ✅ User is logged in as Equipment user (e.g., `jagadish1`)
4. ✅ Test file uploaded with site data
5. ✅ Target user exists (e.g., `arun1` for RTU/Communication)

### Test Data Required:
- **Source File ID**: `nc35yh` (or your test file)
- **Test Site Code**: `5W1597` (or any site from your file)
- **Current User**: `jagadish1` (Equipment role)
- **Target User**: `arun1` (RTU/Communication role)

---

## Test Case 1: Basic Ownership Transfer & Document Creation

### Steps:
1. Navigate to "MY OFFLINE SITES" page
2. Select a site with Status = "Pending"
3. Enter the following in Site Observations dialog:
   - **Type of Issue**: `RTU Issue`
   - **Remarks**: `Test ownership transfer`
   - **Status**: `Pending`
4. Click "Submit" to route to RTU/Communication Team

### Expected Console Logs:

#### 1. Action Creation
```
Creating action with assignment: {
  assignedToUserId: 'arun1',
  assignedToRole: 'RTU/Communication',
  assignedByUserId: 'jagadish1',
  routing: 'RTU/Communication Team',
  typeOfIssue: 'RTU Issue'
}
Action created successfully: { ... }
```

#### 2. Document Creation Check
```
[Routing] Checking if document creation should execute: {
  hasRowKey: true,
  willExecute: true
}
[Routing] Creating two documents - Original and Routed: {
  siteCode: '5W1597',
  currentUserId: 'jagadish1',
  routedUserId: 'arun1'
}
```

#### 3. Original Document Verification
```
[Routing] 🔍 Checking for original document: {
  found: true,
  foundUserId: 'jagadish1',
  isForCurrentUser: true
}
[Routing] ✓ Original document already exists - verified in database
```

#### 4. Ownership Transfer (NEW)
```
[Ownership Transfer] ========================================
[Ownership Transfer] 🔄 Starting ownership transfer process
[Ownership Transfer] Transfer Details: {
  originalDocumentId: '...',
  fromUserId: 'jagadish1',
  fromUserRole: 'Equipment',
  toUserId: 'arun1',
  toUserRole: 'RTU/Communication',
  siteCode: '5W1597'
}
[Ownership Transfer] 📝 Updating original document: {
  changes: {
    userId: { from: 'jagadish1', to: 'arun1' },
    taskStatus: { from: '', to: 'Pending at RTU/Communication Team' },
    savedFrom: {
      from: 'MY OFFLINE SITES',
      to: 'Ownership transferred from Equipment to RTU/Communication'
    }
  }
}
[Ownership Transfer] ✅✅✅ Ownership transfer completed successfully!
[Ownership Transfer] Transfer Summary: {
  previousOwner: 'jagadish1',
  newOwner: 'arun1',
  transferTimestamp: '...'
}
[Ownership Transfer] ✓✓✓ Verification PASSED: Document ownership successfully transferred
[Ownership Transfer] ========================================
```

#### 5. Routed Document Creation
```
[Routing] Creating routed document with assignedUserDoc: {
  hasAssignedUserDoc: true,
  assignedUserId: 'arun1'
}
[Routing] ✅ Routed document created: {
  documentId: '...',
  rowKey: '...-routed-arun1-...',
  userId: 'arun1'
}
[Routing] ✓✓✓ Verified: Routed document exists in database after save
```

#### 6. Final Verification
```
[Routing] 🔍 Final verification - COMPLETE DATABASE CHECK:
[Routing] Original document verification: {
  originalDocumentExistsById: true,
  originalDocumentExistsByQuery: true,
  originalDocUserId: 'arun1',
  originalSavedFrom: 'Ownership transferred from Equipment to RTU/Communication'
}
[Routing] Routed document verification: {
  routedDocumentExists: true,
  routedRowKey: '...-routed-arun1-...',
  routedUserId: 'arun1'
}
[Routing] ALL documents for this fileId+siteCode in database: {
  totalDocuments: 2,
  documents: [
    { _id: '...', rowKey: '...', userId: 'arun1', isOriginal: true },
    { _id: '...', rowKey: '...-routed-...', userId: 'arun1', isRouted: true }
  ]
}
[Routing] ✅✅✅ SUCCESS: Both documents verified in database!
```

---

## Test Case 2: Verify Documents in MongoDB Compass

### Steps:
1. Open MongoDB Compass
2. Connect to your MongoDB server
3. Select database: `das` (or your database name from console logs)
4. Open collection: `Equipment offline sites`
5. Use Filter:
   ```json
   {
     "fileId": "nc35yh",
     "siteCode": "5W1597"
   }
   ```
6. Verify results

### Expected Results:
- **Total Documents**: 2
- **Document 1 (Original)**:
  - `_id`: `692be9e3c9d6c2307d9b6bf7` (example)
  - `rowKey`: `nc35yh-nc35yh-710` (NO routing suffix)
  - `userId`: `arun1` (transferred ownership)
  - `savedFrom`: `Ownership transferred from Equipment to RTU/Communication`
  - `taskStatus`: `Pending at RTU/Communication Team`
  - `siteObservations`: `Pending`
  - `typeOfIssue`: `RTU Issue`
  - `isOriginal`: `true` (based on rowKey - no `-routed-` suffix)

- **Document 2 (Routed)**:
  - `_id`: `692be9f873ef53ff00dad81b` (example)
  - `rowKey`: `nc35yh-nc35yh-710-routed-arun1-1764485624813` (HAS routing suffix)
  - `userId`: `arun1`
  - `savedFrom`: `Routed from Equipment to RTU/Communication`
  - `taskStatus`: `Pending at RTU/Communication Team`
  - `siteObservations`: `Pending`
  - `typeOfIssue`: `RTU Issue`
  - `isRouted`: `true` (based on rowKey - has `-routed-` suffix)

---

## Test Case 3: Update Document After Ownership Transfer

### Steps:
1. After routing (from Test Case 1), stay on the same page
2. Click on the same site row again
3. Update the following:
   - **Remarks**: `Updated after ownership transfer`
   - Click "Save" or "Submit"

### Expected Console Logs:
```
[saveEquipmentOfflineSite] Updating record: {
  fileId: 'nc35yh',
  rowKey: 'nc35yh-nc35yh-710',
  userId: 'jagadish1',  // Original user making the request
  siteCode: '5W1597'
}
[saveEquipmentOfflineSite] ⚠️ Document found but userId mismatch - checking for ownership transfer: {
  foundUserId: 'arun1',
  requestedUserId: 'jagadish1',
  savedFrom: 'Ownership transferred from Equipment to RTU/Communication'
}
[saveEquipmentOfflineSite] ✓ Document has transferred ownership - will update using new owner userId
[saveEquipmentOfflineSite] Using existing record _id for update (handles ownership transfer): {
  documentId: '...',
  currentUserId: 'arun1',
  requestedUserId: 'jagadish1'
}
[saveEquipmentOfflineSite] Updated record ID: ... updatedAt: ...
```

### Expected Results:
- ✅ No duplicate key error
- ✅ Document updated successfully
- ✅ `remarks` field updated to `Updated after ownership transfer`
- ✅ `userId` remains `arun1` (ownership preserved)
- ✅ `lastSyncedAt` and `updatedAt` timestamps updated

---

## Test Case 4: Verify Both Documents Persist

### Steps:
1. Wait 2-3 seconds after routing completes
2. Check server console for "FINAL ASYNC VERIFICATION"
3. Verify in MongoDB Compass (as in Test Case 2)

### Expected Console Logs:
```
[Routing] 🔍 FINAL ASYNC VERIFICATION (after response sent): {
  timestamp: '...',
  database: 'das',
  collection: 'Equipment offline sites',
  totalDocuments: 2,
  documents: [
    { _id: '...', rowKey: '...', userId: 'arun1', isOriginal: true },
    { _id: '...', rowKey: '...-routed-...', userId: 'arun1', isRouted: true }
  ]
}
[Routing] ✅✅✅ FINAL VERIFICATION PASSED: Both documents persist in database
```

### Expected Results:
- ✅ Both documents still exist after 2 seconds
- ✅ Both documents have correct `userId` (`arun1`)
- ✅ Original document has ownership transfer indicator
- ✅ Routed document has routing suffix

---

## Test Case 5: Multiple Routing Scenarios

### Scenario 5A: Route to O&M Team

**Steps:**
1. Select a site with Device Type = "RMU"
2. Set Type of Issue = "Faulty/Spare Required"
3. Route to O&M Team

**Expected:**
- Ownership transferred to O&M user
- Both documents created
- Console logs show ownership transfer to O&M user

### Scenario 5B: Route to AMC Team

**Steps:**
1. Select a site with Device Type = "RMU"
2. Set Type of Issue = "Faulty/Spare Required"
3. Ensure Circle matches AMC user's circle
4. Route to AMC Team

**Expected:**
- Ownership transferred to AMC user
- Both documents created
- Console logs show ownership transfer to AMC user

---

## Verification Checklist

### ✅ Ownership Transfer Verification:
- [ ] Console shows "Ownership Transfer" section with all details
- [ ] `userId` changes from current user to assigned user
- [ ] `savedFrom` updates to "Ownership transferred from [role] to [role]"
- [ ] `taskStatus` updates to "Pending at [Team] Team"
- [ ] Verification shows "PASSED: Document ownership successfully transferred"

### ✅ Document Creation Verification:
- [ ] Original document exists in database
- [ ] Routed document exists in database
- [ ] Both documents have same `fileId` and `siteCode`
- [ ] Original document has NO routing suffix in `rowKey`
- [ ] Routed document HAS routing suffix in `rowKey` (`-routed-`)
- [ ] Both documents have `userId` = assigned user (after ownership transfer)
- [ ] Console shows "SUCCESS: Both documents verified in database!"

### ✅ Update After Routing Verification:
- [ ] Can update document after ownership transfer
- [ ] No duplicate key errors
- [ ] Update uses document's `_id` (not `fileId + rowKey + userId`)
- [ ] Document updates successfully
- [ ] Ownership preserved (userId remains transferred user)

### ✅ Database Verification:
- [ ] Both documents visible in MongoDB Compass
- [ ] Documents persist after 2+ seconds
- [ ] All fields correctly set
- [ ] Timestamps are correct

---

## Expected Console Output Summary

### Successful Test Output Should Include:

1. **Action Creation**: ✅ Action created successfully
2. **Document Check**: ✅ Document creation will execute
3. **Original Document**: ✅ Found/created and verified
4. **Ownership Transfer**: ✅ Completed and verified
5. **Routed Document**: ✅ Created and verified
6. **Final Verification**: ✅ Both documents exist (2 documents)
7. **Final Async Verification**: ✅ Both documents persist
8. **Update (if tested)**: ✅ Updated successfully without errors

---

## Error Scenarios to Watch For

### ❌ Common Errors (Should NOT Occur):

1. **`assignedUserDoc is not defined`**
   - **Fix Applied**: Variable now properly scoped
   - **If Seen**: Server needs restart

2. **`E11000 duplicate key error`**
   - **Fix Applied**: Using document `_id` for updates
   - **If Seen**: Check if update query is using correct identifier

3. **Only 1 document found instead of 2**
   - **Fix Applied**: Both documents created before response
   - **If Seen**: Check console for creation errors

4. **Original document not found**
   - **Fix Applied**: Original created/found before routing
   - **If Seen**: Check unique index constraints

5. **Update fails after ownership transfer**
   - **Fix Applied**: Using `_id` instead of `fileId + rowKey + userId`
   - **If Seen**: Check if `existingRecord` is being used correctly

---

## Test Results Template

### Test Execution Date: ___________

### Test Case Results:

| Test Case | Status | Notes |
|-----------|--------|-------|
| 1. Basic Ownership Transfer | ⬜ Pass / ⬜ Fail | |
| 2. MongoDB Compass Verification | ⬜ Pass / ⬜ Fail | |
| 3. Update After Transfer | ⬜ Pass / ⬜ Fail | |
| 4. Persistence Verification | ⬜ Pass / ⬜ Fail | |
| 5A. O&M Routing | ⬜ Pass / ⬜ Fail | |
| 5B. AMC Routing | ⬜ Pass / ⬜ Fail | |

### Issues Found:
- 
- 
- 

### Screenshots/Logs:
- Attach console logs showing successful ownership transfer
- Attach MongoDB Compass screenshots showing both documents
- Attach any error logs if issues found

---

## Quick Verification Script

Run this in MongoDB Shell to quickly verify documents:

```javascript
// Connect to database
use das;

// Find documents for a specific site
db.getCollection('Equipment offline sites').find({
  fileId: "nc35yh",
  siteCode: "5W1597"
}).forEach(doc => {
  print("\n--- Document ---");
  print("_id: " + doc._id);
  print("rowKey: " + doc.rowKey);
  print("userId: " + doc.userId);
  print("savedFrom: " + doc.savedFrom);
  print("taskStatus: " + doc.taskStatus);
  print("isOriginal: " + (!doc.rowKey.includes('-routed-')));
  print("isRouted: " + (doc.rowKey.includes('-routed-')));
});

// Count documents
print("\nTotal documents: " + db.getCollection('Equipment offline sites').countDocuments({
  fileId: "nc35yh",
  siteCode: "5W1597"
}));
```

**Expected Output:**
```
--- Document ---
_id: ObjectId("...")
rowKey: nc35yh-nc35yh-710
userId: arun1
savedFrom: Ownership transferred from Equipment to RTU/Communication
taskStatus: Pending at RTU/Communication Team
isOriginal: true
isRouted: false

--- Document ---
_id: ObjectId("...")
rowKey: nc35yh-nc35yh-710-routed-arun1-1764485624813
userId: arun1
savedFrom: Routed from Equipment to RTU/Communication
taskStatus: Pending at RTU/Communication Team
isOriginal: false
isRouted: true

Total documents: 2
```

---

## Success Criteria

✅ **Test is PASSED if:**
1. Ownership transfer completes successfully
2. Both documents are created in database
3. Both documents are visible in MongoDB Compass
4. Documents persist after 2+ seconds
5. Updates work without duplicate key errors
6. All console logs show success messages

❌ **Test is FAILED if:**
1. Only 1 document exists
2. Ownership transfer fails
3. Duplicate key errors occur
4. Documents disappear after creation
5. Updates fail after ownership transfer
6. Console shows critical errors

---

## Support

If you encounter any issues:
1. Check server console for detailed error messages
2. Verify MongoDB connection
3. Check database name matches (should be `das`)
4. Ensure user documents exist for both users
5. Review the implementation documentation: `OWNERSHIP_TRANSFER_IMPLEMENTATION.md`

---

**Last Updated**: 2025-11-30
**Version**: 1.0


