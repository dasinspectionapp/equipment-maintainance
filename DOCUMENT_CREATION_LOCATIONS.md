# Where Two Documents Are Created in Database

## File Location
**File:** `server/controllers/actionController.js`  
**Function:** `submitRouting`  
**Collection:** `Equipment offline sites` (MongoDB)

---

## Execution Flow

### Step 1: Original Document Creation

**Location:** `server/controllers/actionController.js`  
**Lines:** 1124-1167

```javascript
// STEP 1: Create ORIGINAL document (for current user)
const newOriginalDoc = new EquipmentOfflineSites({
  fileId: sourceFileId,
  rowKey: baseRowKey,                    // Base rowKey (NO routing suffix)
  siteCode: siteCode.trim().toUpperCase(),
  userId: currentUser.userId,            // Current user (e.g., Equipment user)
  user: currentUserDoc ? currentUserDoc._id : null,
  originalRowData: rowData || {},
  headers: headers || [],
  siteObservations: 'Pending',
  ccrStatus: '',
  taskStatus: taskStatus || `Pending at ${currentUser.role} Team`,
  typeOfIssue: typeOfIssue || '',
  viewPhotos: photo ? (Array.isArray(photo) ? photo : [photo]) : [],
  photoMetadata: [],
  remarks: remarks || '',
  supportDocuments: [],
  deviceStatus: '',
  noOfDaysOffline: null,
  circle: circle || '',
  division: division || '',
  subDivision: '',
  status: 'Pending',
  savedFrom: 'Original document created on routing',
  lastSyncedAt: new Date(),
  createdAt: new Date(),
});

await newOriginalDoc.save();  // ← DATABASE SAVE #1: Original Document
```

**Database Save:** Line **1152** - `await newOriginalDoc.save();`

**Document Properties:**
- `rowKey`: Base rowKey (e.g., `"nc35yh-nc35yh-1498"`)
- `userId`: Current user (Equipment user)
- `savedFrom`: `"Original document created on routing"`

---

### Step 2: Routed Document Creation

**Location:** `server/controllers/actionController.js`  
**Lines:** 1242-1265

```javascript
// STEP 2: Create ROUTED document (for assigned user)
const routedDoc = new EquipmentOfflineSites({
  fileId: sourceFileId,
  rowKey: routedRowKey,                  // Modified rowKey WITH routing suffix
  siteCode: siteCode.trim().toUpperCase(),
  userId: assignedUser.userId,           // Assigned user (e.g., RTU user)
  user: assignedUserDoc ? assignedUserDoc._id : null,
  originalRowData: originalDoc.originalRowData || rowData || {},
  headers: originalDoc.headers || headers || [],
  siteObservations: 'Pending',
  ccrStatus: '',
  taskStatus: taskStatus || `Pending at ${targetRole} Team`,
  typeOfIssue: typeOfIssue || '',
  viewPhotos: originalDoc.viewPhotos || (photo ? (Array.isArray(photo) ? photo : [photo]) : []),
  photoMetadata: originalDoc.photoMetadata || [],
  remarks: remarks || originalDoc.remarks || '',
  supportDocuments: originalDoc.supportDocuments || [],
  deviceStatus: originalDoc.deviceStatus || '',
  noOfDaysOffline: originalDoc.noOfDaysOffline || null,
  circle: originalDoc.circle || circle || '',
  division: originalDoc.division || division || '',
  subDivision: originalDoc.subDivision || '',
  status: 'Pending',
  savedFrom: `Routed from ${currentUser.role} to ${targetRole}`,
  lastSyncedAt: new Date(),
  createdAt: new Date(),
});

await routedDoc.save();  // ← DATABASE SAVE #2: Routed Document
```

**Database Save:** Line **1265** - `await routedDoc.save();`

**Document Properties:**
- `rowKey`: Modified rowKey with routing suffix (e.g., `"nc35yh-nc35yh-1498-routed-rtu_user-1234567890"`)
- `userId`: Assigned user (RTU user)
- `savedFrom`: `"Routed from Equipment to RTU/Communication"`

---

## Complete Code Path

```
submitRouting(req, res, next)
  ↓
Line 897: Create Action document
  ↓
Line 1055-1270: Two-Document Creation Block
  ↓
  ├─ Line 1091-1109: Check if original document exists
  ├─ Line 1135-1167: CREATE ORIGINAL DOCUMENT ← First Database Write
  │    └─ Line 1152: await newOriginalDoc.save()
  │
  ├─ Line 1211-1234: Verify original document exists
  │
  └─ Line 1236-1265: CREATE ROUTED DOCUMENT ← Second Database Write
       └─ Line 1265: await routedDoc.save()
```

---

## Database Collection

**Collection Name:** `Equipment offline sites`  
**Model:** `EquipmentOfflineSites`  
**Schema File:** `server/models/EquipmentOfflineSites.js`

---

## Example Documents in Database

### Document 1: Original
```javascript
{
  _id: ObjectId("..."),
  fileId: "nc35yh",
  rowKey: "nc35yh-nc35yh-1498",              // NO routing suffix
  siteCode: "LR1891",
  userId: "equipment_user_id",               // Equipment user
  siteObservations: "Pending",
  savedFrom: "Original document created on routing",
  createdAt: ISODate("2025-11-30T03:18:00.000Z")
}
```

### Document 2: Routed
```javascript
{
  _id: ObjectId("..."),
  fileId: "nc35yh",
  rowKey: "nc35yh-nc35yh-1498-routed-rtu_user-1722395880000",  // WITH routing suffix
  siteCode: "LR1891",
  userId: "rtu_user_id",                     // RTU user
  siteObservations: "Pending",
  savedFrom: "Routed from Equipment to RTU/Communication",
  createdAt: ISODate("2025-11-30T03:18:01.000Z")
}
```

---

## MongoDB Query to Check Documents

```javascript
// Check all documents for a specific fileId and siteCode
db.getCollection('Equipment offline sites').find({
  fileId: "nc35yh",
  siteCode: "LR1891"
}).sort({ createdAt: 1 }).forEach(doc => {
  printjson({
    _id: doc._id,
    rowKey: doc.rowKey,
    userId: doc.userId,
    siteObservations: doc.siteObservations,
    savedFrom: doc.savedFrom,
    createdAt: doc.createdAt,
    isOriginal: !doc.rowKey.includes('-routed-'),
    isRouted: doc.rowKey.includes('-routed-')
  });
});
```

---

## Key Points

1. **Original Document** is created at **Line 1152** (`await newOriginalDoc.save()`)
2. **Routed Document** is created at **Line 1265** (`await routedDoc.save()`)
3. Both documents are saved to the same collection: `Equipment offline sites`
4. Both have the same `fileId` and `siteCode`
5. They differ by:
   - `rowKey` (original has base, routed has suffix)
   - `userId` (original = current user, routed = assigned user)
   - `savedFrom` (different messages)



