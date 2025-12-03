# How to Verify Both Documents Are in Database

## Quick Verification

After routing, both documents should exist in the `Equipment offline sites` collection:

1. **Original Document** - For the current user (Equipment user)
   - `rowKey`: Base rowKey (e.g., `"nc35yh-nc35yh-1334"`)
   - `userId`: Original user (e.g., `"jagadish1"`)
   - No routing suffix in `rowKey`

2. **Routed Document** - For the assigned user (RTU user)
   - `rowKey`: Modified rowKey with routing suffix (e.g., `"nc35yh-nc35yh-1334-routed-arun1-1764474262876"`)
   - `userId`: Assigned user (e.g., `"arun1"`)
   - Has routing suffix `-routed-` in `rowKey`

---

## Method 1: MongoDB Compass Query

### Step 1: Open MongoDB Compass
- Connect to your database
- Navigate to `Equipment offline sites` collection

### Step 2: Run Query for Original Document

**Filter:**
```json
{
  "fileId": "nc35yh",
  "siteCode": "LB1685",
  "userId": "jagadish1",
  "rowKey": { "$not": { "$regex": "-routed-" } }
}
```

**Expected Result:**
- Should find **1 document**
- `rowKey` should NOT contain `-routed-`
- `userId` should be `jagadish1`

### Step 3: Run Query for Routed Document

**Filter:**
```json
{
  "fileId": "nc35yh",
  "siteCode": "LB1685",
  "userId": "arun1",
  "rowKey": { "$regex": "-routed-" }
}
```

**Expected Result:**
- Should find **1 document**
- `rowKey` should contain `-routed-`
- `userId` should be `arun1`

### Step 4: Check All Documents for This Site

**Filter:**
```json
{
  "fileId": "nc35yh",
  "siteCode": "LB1685"
}
```

**Sort by:** `createdAt` (Ascending)

**Expected Result:**
- Should find **2 documents**
- First document: Original (no `-routed-` in rowKey)
- Second document: Routed (has `-routed-` in rowKey)

---

## Method 2: MongoDB Shell Script

Use the provided script: `verify-both-documents.js`

### Steps:

1. **Open MongoDB Shell** (mongosh) or MongoDB Compass Shell

2. **Update the configuration** in the script:
   ```javascript
   const fileId = "nc35yh";  // Your fileId
   const siteCode = "LB1685";  // Your siteCode
   const originalUserId = "jagadish1";  // Original user
   const routedUserId = "arun1";  // Routed user
   ```

3. **Run the script:**
   ```bash
   mongosh < verify-both-documents.js
   ```
   
   Or copy-paste the script content into MongoDB Compass Shell

4. **Check the output:**
   - Should show both documents found
   - Summary should say "✅ SUCCESS: Both documents exist in database!"

---

## Method 3: Check Server Console Logs

After routing, check the server console for:

### 1. Original Document Creation/Finding
```
[Routing] ✅✅✅ Original document CREATED successfully: {
  documentId: '692aba27c9d6c2307d9b6b7e',
  rowKey: 'nc35yh-nc35yh-1334',
  userId: 'jagadish1',
  siteCode: 'LB1685'
}
```

OR

```
[Routing] ✓ Original document already exists - verified in database: {
  documentId: '692aba27c9d6c2307d9b6b7e',
  verifiedInDatabase: true
}
```

### 2. Routed Document Creation
```
[Routing] ✅ Routed document created: {
  documentId: '692bbd96900af8b321e412eb',
  rowKey: 'nc35yh-nc35yh-1334-routed-arun1-1764474262876',
  userId: 'arun1',
  originalDocId: '692aba27c9d6c2307d9b6b7e'
}
```

### 3. Final Verification
```
[Routing] 🔍 Final verification: {
  originalDocumentExistsById: true,  // ← Should be true
  originalDocumentExistsByQuery: true,  // ← Should be true
  routedDocumentExists: true,  // ← Should be true
  originalDocUserId: 'jagadish1',
  routedDocumentId: '692bbd96900af8b321e412eb'
}
```

---

## Method 4: Direct MongoDB Query

### Query 1: Check Both Documents by SiteCode

```javascript
db.getCollection('Equipment offline sites').find({
  fileId: "nc35yh",
  siteCode: "LB1685"
}).sort({ createdAt: 1 }).forEach(doc => {
  printjson({
    _id: doc._id.toString(),
    rowKey: doc.rowKey,
    userId: doc.userId,
    siteCode: doc.siteCode,
    siteObservations: doc.siteObservations,
    savedFrom: doc.savedFrom,
    createdAt: doc.createdAt,
    isOriginal: !doc.rowKey.includes('-routed-'),
    isRouted: doc.rowKey.includes('-routed-')
  });
  print("---");
});
```

**Expected Output:**
```json
{
  "_id": "692aba27c9d6c2307d9b6b7e",
  "rowKey": "nc35yh-nc35yh-1334",
  "userId": "jagadish1",
  "siteCode": "LB1685",
  "isOriginal": true,
  "isRouted": false
}
---
{
  "_id": "692bbd96900af8b321e412eb",
  "rowKey": "nc35yh-nc35yh-1334-routed-arun1-1764474262876",
  "userId": "arun1",
  "siteCode": "LB1685",
  "isOriginal": false,
  "isRouted": true
}
---
```

---

## Troubleshooting

### ❌ Only Routed Document Found

**Possible Causes:**
1. Original document was not created before routing
2. Original document belongs to a different user
3. Unique index constraint prevented original creation

**Check Console Logs:**
- Look for: `[Routing] ❌❌❌ CRITICAL ERROR: Original document is missing`
- Look for: `[Routing] ❌ Original document NOT found in database after creation!`

**Solution:**
- Check server console logs for detailed error messages
- Verify the original document creation step completed successfully

### ❌ Only Original Document Found

**Possible Causes:**
1. Routed document creation failed
2. Error occurred after original creation but before routed creation

**Check Console Logs:**
- Look for: `[Routing] ❌❌❌ CRITICAL ERROR creating documents`
- Look for error messages after "Original document CREATED successfully"

**Solution:**
- Check server console logs for errors during routed document creation
- Verify user permissions and database connection

### ❌ Neither Document Found

**Possible Causes:**
1. Routing failed completely
2. Wrong fileId or siteCode used in query
3. Documents in different database/collection

**Solution:**
- Verify fileId and siteCode are correct
- Check if documents exist with different case (siteCode might be uppercase)
- Verify you're looking in the correct database and collection

### ❌ Documents Found but Wrong Users

**Possible Causes:**
1. Routing logic assigned to wrong user
2. User IDs don't match expected values

**Check:**
- Verify `userId` values in documents match expected users
- Check routing logic and user assignment code

---

## Expected Database State After Routing

```
Equipment offline sites Collection:
├── Document 1 (Original)
│   ├── _id: 692aba27c9d6c2307d9b6b7e
│   ├── fileId: "nc35yh"
│   ├── rowKey: "nc35yh-nc35yh-1334"  ← No routing suffix
│   ├── userId: "jagadish1"  ← Original user
│   ├── siteCode: "LB1685"
│   ├── siteObservations: "Pending"
│   └── savedFrom: "Original document created on routing"
│
└── Document 2 (Routed)
    ├── _id: 692bbd96900af8b321e412eb
    ├── fileId: "nc35yh"
    ├── rowKey: "nc35yh-nc35yh-1334-routed-arun1-1764474262876"  ← Has routing suffix
    ├── userId: "arun1"  ← Routed user
    ├── siteCode: "LB1685"
    ├── siteObservations: "Pending"
    └── savedFrom: "Routed from Equipment to RTU/Communication"
```

---

## Quick Reference: Document Identification

| Property | Original Document | Routed Document |
|----------|------------------|-----------------|
| `rowKey` | No `-routed-` suffix | Has `-routed-` suffix |
| `userId` | Original user | Assigned user |
| `savedFrom` | "Original document created on routing" | "Routed from X to Y" |
| `createdAt` | Earlier timestamp | Later timestamp |



