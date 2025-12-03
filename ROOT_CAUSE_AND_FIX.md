# Root Cause Analysis: Original Document Not Being Created

## Problem
When Equipment user updates site observation as "Pending" and routes to RTU:
- ✅ Routed document is created successfully
- ❌ Original document (belonging to Equipment user) is missing

## Root Cause

### Flow Analysis:
1. **Equipment user saves first** → Calls `/api/equipment-offline-sites` → Creates document with base rowKey
2. **Routing happens** → Calls `/api/actions/submit` → Should create routed document

### The Issue:
When routing happens, the code:
1. Tries to find original document
2. Uses found document as source to create routed document
3. BUT: The found document might not be the correct original document, OR
4. The original document creation logic might not be executing properly

### Critical Problem:
The code was using `equipmentSite` (found document) as source, but this might not be the verified original document. The code should use the **verified original document** (`verifyOriginalDoc`) as the source.

---

## Fix Applied

### Change 1: Use Verified Original Document as Source
- **Before:** Used `equipmentSite` (might be incorrect) as source
- **After:** Use `verifyOriginalDoc` (verified original) as source
- **Location:** Lines ~1580-1620 in `actionController.js`

### Change 2: Multiple Layers of Original Document Verification
1. **Layer 1:** Initial document creation (if not found)
2. **Layer 2:** Check if found document is routed (if so, find/create original)
3. **Layer 3:** Final safety check before creating routed document
4. **Layer 4:** Pre-routing verification (ensures original exists)

### Change 3: Enhanced Logging
- Added detailed logging at each step
- Logs show which document is being used as source
- Logs verify both documents exist after creation

---

## Expected Behavior After Fix

### When Equipment Routes to RTU:

**Step 1: Equipment saves first**
- Document created: `rowKey: "nc35yh-nc35yh-1498"`, `userId: "equipment_user"`

**Step 2: Routing happens**
- Finds original document: `rowKey: "nc35yh-nc35yh-1498"`
- Verifies it exists
- Creates routed document: `rowKey: "nc35yh-nc35yh-1498-routed-rtu_user-timestamp"`
- **Result:** Both documents exist

---

## Testing

### 1. Clear Test Data
```javascript
db.equipmentofflinesites.deleteMany({
  fileId: "nc35yh",
  siteCode: "LR1891"
});
```

### 2. Test Routing
1. Equipment user updates site observation as "Pending"
2. Equipment user routes to RTU
3. Check server logs for:
   - `"✓✓✓ Verified original document exists before creating routed document"`
   - `"Using verified original document as source"`
   - `"verification: { originalDocumentExists: true, routedDocumentExists: true }"`

### 3. Verify Database
```javascript
const docs = db.equipmentofflinesites.find({
  fileId: "nc35yh",
  siteCode: "LR1891"
}).sort({ createdAt: 1 }).toArray();

console.log('Total documents:', docs.length);
// Expected: 2

console.log('Document 1 (Original):', {
  _id: docs[0]._id,
  rowKey: docs[0].rowKey,
  userId: docs[0].userId,
  savedFrom: docs[0].savedFrom,
  hasRoutingSuffix: docs[0].rowKey.includes('-routed-')
});
// Expected: hasRoutingSuffix: false, userId: equipment_user

console.log('Document 2 (Routed):', {
  _id: docs[1]._id,
  rowKey: docs[1].rowKey,
  userId: docs[1].userId,
  savedFrom: docs[1].savedFrom,
  hasRoutingSuffix: docs[1].rowKey.includes('-routed-')
});
// Expected: hasRoutingSuffix: true, userId: rtu_user
```

---

## Key Code Changes

### File: `server/controllers/actionController.js`

**Line ~1580:** Use verified original document as source
```javascript
const sourceDocument = verifyOriginalDoc; // Use verified original, not equipmentSite
```

**Line ~1595-1611:** Enhanced logging showing source document
```javascript
console.log('Creating new Equipment Offline Sites document for ownership transfer:', {
  sourceDocumentId: sourceDocument._id.toString(),
  sourceUserId: sourceDocument.userId,
  message: 'Using verified original document as source'
});
```

**Line ~1622-1641:** Create routed document using verified original
```javascript
// Copy all data from verified original document
originalRowData: sourceDocument.originalRowData || rowData || {},
// ... other fields from sourceDocument
```

---

## If Issue Persists

### Check Server Logs For:
1. `"Ownership Transfer - Starting"`
2. `"✓ Original Equipment Offline Sites document created"`
3. `"✓✓✓ Verified original document exists before creating routed document"`
4. `"Using verified original document as source"`
5. `"verification: { originalDocumentExists: true }"`

### Check Database:
- Query: `{ fileId: "nc35yh", siteCode: "LR1891" }`
- Should return 2 documents
- First document: No routing suffix, Equipment user
- Second document: Has routing suffix, RTU user

---

*Fix implemented: Uses verified original document as source when creating routed document*


