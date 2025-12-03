# Debug: Original Document Not Found Issue

## Problem
The console logs show:
- "Original document already exists"
- `originalDocId: '692aba27c9d6c2307d9b6b7e'`
- Final verification shows `originalDocumentExists: true`

But the document cannot be found in the database.

## Root Cause Analysis

The unique index on `Equipment offline sites` collection is:
```
{ fileId: 1, rowKey: 1 }
```

This means:
- Only **ONE** document can exist with the same `fileId + rowKey` combination
- The `userId` is **NOT** part of the unique index
- If a document exists with that `fileId+rowKey` for ANY user, you cannot create another one

## Changes Made

### 1. Enhanced Document Finding Logic (Line 1091-1118)
**Before:** Query included `userId` filter
```javascript
let originalDoc = await EquipmentOfflineSites.findOne({
  fileId: sourceFileId,
  rowKey: baseRowKey,
  userId: currentUser.userId  // ← This filter might miss documents
}).lean();
```

**After:** Query checks for ANY document with that `fileId+rowKey`, then verifies `userId`
```javascript
// Check for ANY document with fileId+rowKey (due to unique index)
let originalDoc = await EquipmentOfflineSites.findOne({
  fileId: sourceFileId,
  rowKey: baseRowKey  // No userId filter
}).lean();

// Then verify it belongs to current user
if (originalDoc && originalDoc.userId !== currentUser.userId) {
  throw new Error('Document exists for different user...');
}
```

### 2. Added Database Verification When Document "Already Exists" (Line 1203-1223)
**New Code:** When a document is found, verify it actually exists in the database by ID:
```javascript
// VERIFY: Check document actually exists in database by ID
const verifyById = await EquipmentOfflineSites.findById(originalDoc._id).lean();
if (!verifyById) {
  console.error('Document found but does NOT exist in database by ID!');
  originalDoc = null; // Reset to null so we create it
}
```

### 3. Enhanced Final Verification (Line 1296-1331)
**New Code:** Multiple verification methods:
- Verify by ID (most reliable)
- Verify by query with userId filter
- Check ALL documents with that `fileId+rowKey` (any userId)
- Show detailed comparison

## What to Check in Console Logs

After these changes, you should see more detailed logs:

### 1. Initial Document Check
```
[Routing] 🔍 Checking for original document: {
  found: true,
  foundDocument: {
    _id: '692aba27c9d6c2307d9b6b7e',
    userId: 'jagadish1',  // ← Check if this matches current user
    foundUserId: 'jagadish1',
    expectedUserId: 'jagadish1',  // ← Should match
    isForCurrentUser: true  // ← Should be true
  }
}
```

### 2. If Document Already Exists
```
[Routing] ✓ Original document already exists - verified in database: {
  documentId: '692aba27c9d6c2307d9b6b7e',
  userId: 'jagadish1',
  verifiedInDatabase: true  // ← Should be true
}
```

### 3. Final Verification
```
[Routing] 🔍 Final verification: {
  originalDocumentId: '692aba27c9d6c2307d9b6b7e',
  originalDocumentExistsById: true,  // ← Check this
  originalDocumentExistsByQuery: true,  // ← Check this
  originalDocUserId: 'jagadish1',  // ← Check if correct
  expectedUserId: 'jagadish1',  // ← Should match
  allDocsWithBaseRowKey: [  // ← Check ALL documents with same rowKey
    {
      _id: '692aba27c9d6c2307d9b6b7e',
      rowKey: 'nc35yh-nc35yh-1334',
      userId: 'jagadish1',
      isForCurrentUser: true
    }
  ]
}
```

## Possible Scenarios

### Scenario 1: Document Exists but Belongs to Different User
**Console will show:**
```
[Routing] ❌❌❌ CRITICAL: Document with baseRowKey exists but belongs to DIFFERENT user!
```
**Action:** This will throw an error and prevent routing

### Scenario 2: Document Found but Not in Database
**Console will show:**
```
[Routing] ❌❌❌ CRITICAL: Document found but does NOT exist in database by ID!
```
**Action:** Code will reset `originalDoc = null` and create a new one

### Scenario 3: Document Exists but Verification Fails
**Console will show in Final Verification:**
```
originalDocumentExistsById: false
originalDocumentExistsByQuery: false
```
**Action:** Check why the document disappeared between creation and verification

## MongoDB Query to Check Documents

Run this query to see ALL documents with that rowKey:

```javascript
db.getCollection('Equipment offline sites').find({
  fileId: "nc35yh",
  rowKey: "nc35yh-nc35yh-1334"
}).forEach(doc => {
  printjson({
    _id: doc._id.toString(),
    rowKey: doc.rowKey,
    userId: doc.userId,
    siteCode: doc.siteCode,
    siteObservations: doc.siteObservations,
    savedFrom: doc.savedFrom,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt
  });
});
```

## Expected Behavior After Fix

1. **If original document exists for current user:**
   - Logs will show it was found
   - Verification by ID will confirm it exists
   - Final verification will show it exists
   - Document should be visible in database

2. **If original document exists for different user:**
   - Error will be thrown
   - Routing will fail
   - Clear error message will be shown

3. **If original document doesn't exist:**
   - Logs will show "Original document NOT found"
   - Document will be created
   - Verification will confirm creation

## Next Steps

1. Run the routing again
2. Check the console logs for the new detailed information
3. Run the MongoDB query above to verify documents in database
4. Share the console logs if the issue persists



