# Testing Quick Reference Guide
## Ownership Transfer & Routing

---

## Database Queries Quick Reference

### 1. Check All Documents for a Site Code
```javascript
db.equipmentofflinesites.find({
  fileId: "YOUR_FILE_ID",
  siteCode: "YOUR_SITE_CODE"
}).sort({ createdAt: 1 })
```

### 2. Check Original Document (No Routing Suffix)
```javascript
db.equipmentofflinesites.find({
  fileId: "YOUR_FILE_ID",
  siteCode: "YOUR_SITE_CODE",
  rowKey: { $not: /-routed-/ }
})
```

### 3. Check Routed Documents (Has Routing Suffix)
```javascript
db.equipmentofflinesites.find({
  fileId: "YOUR_FILE_ID",
  siteCode: "YOUR_SITE_CODE",
  rowKey: { $regex: /-routed-/ }
}).sort({ createdAt: 1 })
```

### 4. Check Documents for Specific User
```javascript
db.equipmentofflinesites.find({
  fileId: "YOUR_FILE_ID",
  siteCode: "YOUR_SITE_CODE",
  userId: "USER_ID"
})
```

### 5. Check All Actions for Routing
```javascript
db.actions.find({
  sourceFileId: "YOUR_FILE_ID",
  status: "Pending"
}).sort({ createdAt: -1 })
```

### 6. Verify RowKey Pattern
```javascript
db.equipmentofflinesites.find({
  fileId: "YOUR_FILE_ID",
  siteCode: "YOUR_SITE_CODE"
}).forEach(doc => {
  const parts = doc.rowKey.split('-routed-');
  print("RowKey: " + doc.rowKey);
  print("Base: " + (parts[0] || doc.rowKey));
  print("Routing: " + (parts[1] || "N/A"));
  print("User: " + doc.userId);
  print("---");
})
```

### 7. Count Documents per Site Code
```javascript
db.equipmentofflinesites.aggregate([
  {
    $match: {
      fileId: "YOUR_FILE_ID",
      siteCode: "YOUR_SITE_CODE"
    }
  },
  {
    $group: {
      _id: "$userId",
      count: { $sum: 1 },
      rowKeys: { $push: "$rowKey" }
    }
  }
])
```

### 8. Check for Duplicate Documents
```javascript
db.equipmentofflinesites.aggregate([
  {
    $match: {
      fileId: "YOUR_FILE_ID",
      siteCode: "YOUR_SITE_CODE",
      userId: "USER_ID"
    }
  },
  {
    $group: {
      _id: {
        userId: "$userId",
        baseRowKey: { $arrayElemAt: [{ $split: ["$rowKey", "-routed-"] }, 0] }
      },
      count: { $sum: 1 },
      docs: { $push: { id: "$_id", rowKey: "$rowKey", createdAt: "$createdAt" } }
    }
  },
  {
    $match: { count: { $gt: 1 } }
  }
])
```

---

## Verification Points Checklist

### ✅ Single Routing (Equipment → RTU)

| Check Point | Expected Result | Location |
|------------|----------------|----------|
| Original document exists | ✅ Unchanged, `userId` = Equipment | DB: equipmentofflinesites |
| New document created | ✅ `rowKey` contains `-routed-rtu_user_id-` | DB: equipmentofflinesites |
| New document userId | ✅ `userId` = RTU user | DB: equipmentofflinesites |
| Action created | ✅ `assignedToUserId` = RTU user | DB: actions |
| Equipment sees original | ✅ Visible in Pending Reports | UI: Equipment User |
| RTU sees routed | ✅ Visible in Pending Reports | UI: RTU User |

### ✅ Sequential Routing (Equipment → RTU → AMC)

| Check Point | Expected Result | Location |
|------------|----------------|----------|
| Total documents | ✅ 3 documents | DB: equipmentofflinesites |
| All have same base rowKey | ✅ Base rowKey consistent | DB: rowKey format |
| AMC document rowKey | ✅ Contains `-routed-amc_user_id-` | DB: equipmentofflinesites |
| AMC document userId | ✅ `userId` = AMC user | DB: equipmentofflinesites |
| Each user sees their doc | ✅ Correct document per user | UI: Reports |

### ✅ Parallel Routing (Equipment → AMC + O&M)

| Check Point | Expected Result | Location |
|------------|----------------|----------|
| Total documents | ✅ 3 documents (1 original + 2 routed) | DB: equipmentofflinesites |
| AMC document exists | ✅ `userId` = AMC user | DB: equipmentofflinesites |
| O&M document exists | ✅ `userId` = O&M user | DB: equipmentofflinesites |
| Base rowKey same | ✅ Both start with same base | DB: rowKey format |
| Different timestamps | ✅ Different timestamps in rowKey | DB: rowKey format |
| Equipment sees original | ✅ Visible until BOTH resolve | UI: Equipment User |
| AMC sees AMC doc | ✅ Visible in Pending Reports | UI: AMC User |
| O&M sees O&M doc | ✅ Visible in Pending Reports | UI: O&M User |

### ✅ Re-routing (RTU → AMC)

| Check Point | Expected Result | Location |
|------------|----------------|----------|
| Action reassigned | ✅ `assignedToUserId` = AMC | DB: actions |
| New document created | ✅ AMC document exists | DB: equipmentofflinesites |
| RTU document remains | ✅ Still exists (audit trail) | DB: equipmentofflinesites |
| RTU loses access | ✅ Not in RTU's Reports | UI: RTU User |
| AMC gains access | ✅ Visible in AMC's Reports | UI: AMC User |

---

## RowKey Pattern Verification

### Pattern Structure
```
originalRowKey-routed-userId-timestamp
```

### Examples

**Original:**
```
file123-sitecode001
```

**After Single Routing (Equipment → RTU):**
```
file123-sitecode001-routed-rtu_user_001-1699123456789
```

**After Sequential Routing (RTU → AMC):**
```
file123-sitecode001-routed-amc_user_001-1699123567890
```

**After Parallel Routing (Equipment → AMC + O&M):**
```
file123-sitecode001-routed-amc_user_001-1699123456789
file123-sitecode001-routed-om_user_001-1699123456790
```

**Important:** Base rowKey (`file123-sitecode001`) should be consistent across all routed documents.

---

## Common Verification Commands

### Find Original Document
```javascript
db.equipmentofflinesites.findOne({
  fileId: "FILE_ID",
  siteCode: "SITE_CODE",
  rowKey: { $not: /-routed-/ }
})
```

### Find All Routed Documents
```javascript
db.equipmentofflinesites.find({
  fileId: "FILE_ID",
  siteCode: "SITE_CODE",
  rowKey: { $regex: /-routed-/ }
}).sort({ createdAt: 1 })
```

### Verify No Duplicates for User
```javascript
db.equipmentofflinesites.find({
  fileId: "FILE_ID",
  siteCode: "SITE_CODE",
  userId: "USER_ID",
  rowKey: { $regex: /-routed-USER_ID-/ }
}).count()
// Should return 1 or 0, not more
```

### Check Base RowKey Consistency
```javascript
db.equipmentofflinesites.find({
  fileId: "FILE_ID",
  siteCode: "SITE_CODE"
}).forEach(doc => {
  const base = doc.rowKey.includes('-routed-') 
    ? doc.rowKey.split('-routed-')[0] 
    : doc.rowKey;
  print("Base: " + base);
})
// All should print the same base
```

---

## Log Messages to Look For

### Successful Ownership Transfer
```
✓ New Equipment Offline Sites document created for ownership transfer: {
  siteCode: "...",
  previousOwner: "...",
  newOwner: "..."
}
```

### Already Owned by Target User
```
Equipment Offline Sites document already owned by assigned user: {
  message: 'No ownership transfer needed'
}
```

### Missing Document Handling
```
Equipment Offline Sites document not found - creating initial document
✓ Initial Equipment Offline Sites document created
```

### Concurrent Routing Protection
```
Equipment Offline Sites document already exists for target user (concurrent routing handled): {
  message: 'Duplicate routing prevented'
}
```

### Error (Non-blocking)
```
❌ Error creating Equipment Offline Sites document for ownership transfer: {
  message: 'Routing action was still created successfully, but ownership document creation failed'
}
```

---

## UI Verification Points

### Reports Tab - Pending

**Location:** `Reports → Type of Report: Pending`

**For Each User:**
1. ✅ Only documents where `userId` matches current user
2. ✅ Only documents with `siteObservations != ''` (Pending)
3. ✅ Documents are not resolved (taskStatus != 'Resolved')

### My Actions Page

**Location:** `My Actions` or `Dashboard → My Actions`

**Verification:**
1. ✅ Actions where `assignedToUserId` matches current user
2. ✅ Actions with `status = 'Pending'`
3. ✅ Re-routed actions appear for new user, disappear for old user

---

## Test Data Cleanup

### Delete Test Documents
```javascript
// Delete all test documents
db.equipmentofflinesites.deleteMany({
  fileId: "test_file_001",
  siteCode: /^TEST/
})

// Delete all test actions
db.actions.deleteMany({
  sourceFileId: "test_file_001"
})
```

### Verify Cleanup
```javascript
// Should return 0
db.equipmentofflinesites.countDocuments({
  fileId: "test_file_001"
})

db.actions.countDocuments({
  sourceFileId: "test_file_001"
})
```

---

## Quick Test Execution Flow

### Test 1: Single Routing
1. Route Equipment → RTU
2. Check DB: 2 documents (original + RTU)
3. Check UI: Equipment sees original, RTU sees routed

### Test 2: Sequential Routing
1. Route Equipment → RTU → AMC
2. Check DB: 3 documents
3. Check UI: Each user sees their document

### Test 3: Parallel Routing
1. Route Equipment → AMC + O&M (simultaneously)
2. Check DB: 3 documents (original + 2 routed)
3. Check UI: Equipment sees original, each routed user sees their doc
4. Resolve AMC → Equipment still sees original
5. Resolve O&M → Equipment no longer sees original

### Test 4: Re-routing
1. Route Equipment → RTU
2. Re-route RTU → AMC
3. Check DB: 3 documents (original + RTU + AMC)
4. Check UI: RTU loses access, AMC gains access

---

## Key Success Indicators

✅ **Database:**
- Original document NEVER modified
- New documents created with unique rowKeys
- All documents share same fileId and siteCode
- Base rowKey consistent across routing chain

✅ **Actions:**
- Action created/updated correctly
- Assigned user matches Equipment Offline Sites userId

✅ **UI:**
- Each user sees only their documents
- Routing appears in My Actions
- Reports show correct pending items

✅ **Logs:**
- Clear ownership transfer logs
- Error logs non-blocking
- Detailed debugging information

---

*Quick Reference Guide - Keep this handy during testing!*


