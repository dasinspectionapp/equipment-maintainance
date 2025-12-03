# Fix: Original Document Not Being Created

## Problem
When Equipment user updates site observation as "Pending" and routes directly, only ONE document is created in Equipment Offline Sites collection - the routed document. The original document (belonging to Equipment user) is missing.

**Example from Database:**
```json
{
  "rowKey": "nc35yh-nc35yh-1428-routed-arun1-1764466700755",
  "userId": "arun1",
  "siteCode": "LB1904",
  "savedFrom": "Routed from Equipment to RTU/Communication"
}
```

**Missing:** Original document with:
- `rowKey`: "nc35yh-nc35yh-1428" (base rowKey, no routing suffix)
- `userId`: Equipment user's ID

---

## Root Cause

When Equipment user saves site observation as "Pending" and routes simultaneously:
1. The document might be saved AFTER routing happens
2. Or the original document creation is failing silently
3. Or the original document is being created but then overwritten

The ownership transfer code tries to find/create the original document, but if it doesn't exist, it should create it first. However, the original document is not persisting.

---

## Fix Applied

### Changes in `server/controllers/actionController.js`

1. **Enhanced Document Finding Logic:**
   - Strategy 1: Find by base rowKey (original documents without routing suffix)
   - Strategy 2: Find by userId and filter out routed documents
   - Strategy 3: Find any Pending document and filter out routed ones
   - All strategies prioritize finding original documents (without routing suffix)

2. **Enhanced Original Document Creation:**
   - Always uses `baseRowKey` (without routing suffix) for original document
   - Verifies original document exists before creating routed document
   - Adds comprehensive logging to track document creation

3. **Verification After Creation:**
   - After creating routed document, verifies both documents exist
   - Logs verification results for debugging

---

## Expected Behavior After Fix

### When Equipment Routes to RTU:

**Document 1 - Original (Equipment user):**
```json
{
  "fileId": "nc35yh",
  "rowKey": "nc35yh-nc35yh-1428",  // Base rowKey, NO routing suffix
  "siteCode": "LB1904",
  "userId": "equipment_user_id",   // Equipment user
  "siteObservations": "Pending",
  "taskStatus": "Pending at Equipment Team",
  "savedFrom": "Original document created before routing"
}
```

**Document 2 - Routed (RTU user):**
```json
{
  "fileId": "nc35yh",
  "rowKey": "nc35yh-nc35yh-1428-routed-rtu_user-1764466700755",  // With routing suffix
  "siteCode": "LB1904",
  "userId": "rtu_user_id",  // RTU user
  "siteObservations": "Pending",
  "taskStatus": "Pending at RTU/Communication Team",
  "savedFrom": "Routed from Equipment to RTU/Communication"
}
```

---

## Testing Steps

1. **Clear test data** (if any exists):
   ```javascript
   db.equipmentofflinesites.deleteMany({
     fileId: "nc35yh",
     siteCode: "LB1904"
   });
   ```

2. **Perform routing:**
   - Log in as Equipment user
   - Update site observation as "Pending"
   - Route to RTU Team
   - Click Submit

3. **Verify in Database:**
   ```javascript
   // Should return 2 documents
   db.equipmentofflinesites.find({
     fileId: "nc35yh",
     siteCode: "LB1904"
   }).sort({ createdAt: 1 });
   ```

4. **Check logs** for:
   - "Original Equipment Offline Sites document created"
   - "New Equipment Offline Sites document created for ownership transfer"
   - Verification logs showing both documents exist

---

## Database Queries for Verification

### Check Original Document Exists:
```javascript
db.equipmentofflinesites.findOne({
  fileId: "nc35yh",
  siteCode: "LB1904",
  rowKey: "nc35yh-nc35yh-1428",  // Base rowKey, no routing suffix
  userId: "equipment_user_id"
})
```

### Check Routed Document Exists:
```javascript
db.equipmentofflinesites.findOne({
  fileId: "nc35yh",
  siteCode: "LB1904",
  rowKey: { $regex: /-routed-/ },  // Has routing suffix
  userId: "rtu_user_id"
})
```

### Count All Documents for Site:
```javascript
db.equipmentofflinesites.find({
  fileId: "nc35yh",
  siteCode: "LB1904"
}).count()
// Expected: 2 (original + routed)
```

---

## Key Points

1. **Original document** uses BASE rowKey (no routing suffix)
2. **Routed document** uses BASE rowKey + routing suffix
3. **Both documents** should always exist in database
4. **Original document** belongs to Equipment user (original owner)
5. **Routed document** belongs to routed user (RTU user)

---

## If Issue Persists

Check server logs for:
- "Equipment Offline Sites document not found - ensuring original document exists"
- "✓ Original Equipment Offline Sites document created"
- Any error messages during document creation
- Verification logs showing document existence

Check database for:
- Document with base rowKey (no routing suffix)
- Document with routing suffix
- Both should have same fileId and siteCode

---

*Fix implemented - Original document creation enhanced*


