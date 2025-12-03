# Issue: Original Document Not Visible in Database View

## Problem
- Console logs show: "Original document already exists" with ID `692aba26c9d6c2307d9b6b62`
- But in MongoDB Compass/VS Code MongoDB extension, only the routed document is visible
- Routed document ID: `692bc64345ddd5220fdba1a9`

## Root Cause Analysis

The console log shows:
```
[Routing] ✓ Original document already exists - verified in database: {
  documentId: '692aba26c9d6c2307d9b6b62',
  rowKey: 'nc35yh-nc35yh-990',
  userId: 'jagadish1',
  siteCode: '5W2922',
  verifiedInDatabase: true
}
```

This means:
1. ✅ The code found an existing document with ID `692aba26c9d6c2307d9b6b62`
2. ✅ The code verified it exists in the database
3. ❌ But it's not visible in your database viewer

## Possible Reasons

### 1. Document Was Created Earlier (Most Likely)
The original document might have been created from "MY OFFLINE SITES" page earlier, and now when routing, the system found it and reused it. But:
- It might have a different `savedFrom` value
- It might not match your current view filters
- It might be in a different state

### 2. View Filters Applied
Your MongoDB Compass or VS Code MongoDB extension might have filters applied:
- Filter by `userId` (showing only certain users)
- Filter by `siteCode` (different case sensitivity)
- Filter by `savedFrom` (excluding "MY OFFLINE SITES" documents)
- Date range filters

### 3. Different Collection/Database
You might be looking in a different database or collection.

## Solution: Find Both Documents

### Method 1: Search by Document IDs (Most Reliable)

Use the script: `find-both-documents-by-id.js`

**Update the IDs in the script:**
```javascript
const originalDocumentId = "692aba26c9d6c2307d9b6b62";
const routedDocumentId = "692bc64345ddd5220fdba1a9";
```

**Run in MongoDB Shell or Compass:**
```bash
mongosh < find-both-documents-by-id.js
```

### Method 2: Search by SiteCode

In MongoDB Compass, run this query:

**Filter:**
```json
{
  "siteCode": "5W2922"
}
```

This should show **ALL** documents with this siteCode (both original and routed).

### Method 3: Search by FileId and SiteCode

**Filter:**
```json
{
  "fileId": "nc35yh",
  "siteCode": "5W2922"
}
```

This should show both documents.

### Method 4: Search by RowKey Pattern

**Find Original:**
```json
{
  "fileId": "nc35yh",
  "rowKey": "nc35yh-nc35yh-990"
}
```

**Find Routed:**
```json
{
  "fileId": "nc35yh",
  "rowKey": { "$regex": "nc35yh-nc35yh-990-routed-" }
}
```

## Check MongoDB Compass Filters

1. **Open MongoDB Compass**
2. **Navigate to "Equipment offline sites" collection**
3. **Check the Filter bar at the top**
4. **Remove all filters** - Click "X" on any active filters
5. **Search for the original document by ID:**

   **Filter:**
   ```json
   {
     "_id": ObjectId("692aba26c9d6c2307d9b6b62")
   }
   ```

## Verify in Console Logs

Look for this log message after routing:

```
[Routing] ALL documents for this fileId+siteCode in database: {
  totalDocuments: 2,
  documents: [
    {
      _id: "692aba26c9d6c2307d9b6b62",
      isOriginal: true,
      userId: "jagadish1"
    },
    {
      _id: "692bc64345ddd5220fdba1a9",
      isRouted: true,
      userId: "arun1"
    }
  ]
}
```

This will tell you exactly what documents exist in the database.

## Expected Behavior

After routing, you should see in MongoDB:

1. **Original Document:**
   - `_id`: `692aba26c9d6c2307d9b6b62`
   - `rowKey`: `nc35yh-nc35yh-990` (no `-routed-` suffix)
   - `userId`: `jagadish1`
   - `siteCode`: `5W2922`
   - `savedFrom`: Either `"MY OFFLINE SITES"` (if created earlier) or `"Original document created on routing"`

2. **Routed Document:**
   - `_id`: `692bc64345ddd5220fdba1a9`
   - `rowKey`: `nc35yh-nc35yh-990-routed-arun1-1764476483127` (has `-routed-` suffix)
   - `userId`: `arun1`
   - `siteCode`: `5W2922`
   - `savedFrom`: `"Routed from Equipment to RTU/Communication"`

## Next Steps

1. ✅ Run the `find-both-documents-by-id.js` script to verify both documents exist
2. ✅ Check MongoDB Compass filters - remove any active filters
3. ✅ Search by `siteCode: "5W2922"` to see all documents for this site
4. ✅ Check the console logs for the "ALL documents" log message
5. ✅ Share the results if the original document still can't be found

## If Original Document Still Not Found

If after running all these queries, the original document with ID `692aba26c9d6c2307d9b6b62` still cannot be found, it means:

1. The document doesn't actually exist (despite what the console log said)
2. There's a database connection issue
3. The document was deleted after being found

In this case, we need to ensure the original document is **always created** during routing, even if one already exists.



