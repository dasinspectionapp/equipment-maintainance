# Fix for Approved Row Filtering Issue

## Problem

Site code `5W1572` has an approved CCR approval (status: "Approved") in the Approvals collection, but it's still showing in the MY OFFLINE SITES tab. The approval document shows:
- `siteCode`: "5W1572"
- `status`: "Approved"
- `approvalType`: "CCR Resolution Approval"
- `equipmentOfflineSiteId`: null

## Root Cause Analysis

The filtering logic was partially implemented but may have issues with:
1. Query structure mixing top-level conditions with `$and`
2. Case sensitivity in siteCode comparison
3. ObjectId handling for equipmentOfflineSiteId (when it's null, we rely on siteCode)

## Fix Applied

### 1. Restructured Query Building

**Before**: Mixed top-level query conditions with `$and` which could cause conflicts

**After**: Build all conditions in an array and combine with `$and` only when needed

```javascript
// Build base query conditions
const queryConditions = [{ userId }];
if (fileId) {
  queryConditions.push({ fileId });
}

// Add exclusion conditions
queryConditions.push({
  $or: [
    { ccrStatus: { $ne: 'Approved' } },
    { ccrStatus: { $exists: false } },
    { ccrStatus: null },
    { ccrStatus: '' }
  ]
});

// Add approval exclusion conditions
if (approvedSiteCodes.length > 0) {
  queryConditions.push({ siteCode: { $nin: approvedSiteCodes } });
}

// Combine with $and
const query = queryConditions.length > 1 ? { $and: queryConditions } : queryConditions[0];
```

### 2. Fixed ObjectId Handling

- Removed incorrect ObjectId conversion
- Use ObjectIds directly from MongoDB (Mongoose handles comparison automatically)

### 3. Added Comprehensive Logging

Added logging to track:
- Approved approvals found
- Exclusion criteria (approvedSiteIds and approvedSiteCodes)
- Final query structure
- Results returned

## Testing Steps

1. **Check Server Console Logs:**
   - Look for `[getAllEquipmentOfflineSites] Exclusion criteria:` or `[getEquipmentOfflineSitesByFile] Exclusion criteria:`
   - Verify that "5W1572" is in the `approvedSiteCodes` array
   - Check if `willExclude: true` for siteCode "5W1572"

2. **Verify Query:**
   - Check the `Final query` log to see the actual MongoDB query
   - Ensure `siteCode: { $nin: ['5W1572'] }` is in the query

3. **Check Results:**
   - Verify that siteCode "5W1572" is NOT in the returned results
   - Refresh MY OFFLINE SITES tab - the row should disappear

## Expected Console Output

```
[getAllEquipmentOfflineSites] Found approved CCR approvals: {
  count: 1,
  approvals: [{ equipmentOfflineSiteId: null, siteCode: '5W1572' }]
}
[getAllEquipmentOfflineSites] Exclusion criteria: {
  approvedSiteIdsCount: 0,
  approvedSiteCodesCount: 1,
  approvedSiteCodes: ['5W1572'],
  checkingSiteCode: '5W1572',
  willExclude: true
}
[getAllEquipmentOfflineSites] Final query: { "$and": [...] }
[getAllEquipmentOfflineSites] Found offline sites: {
  count: X,
  siteCodes: [...] // Should NOT include '5W1572'
}
```

## If Still Not Working

1. **Check siteCode format**: Ensure siteCode in EquipmentOfflineSites is stored in uppercase
2. **Check userId match**: Ensure the query filters by the correct userId
3. **Check fileId match**: If using `getEquipmentOfflineSitesByFile`, ensure fileId matches
4. **Verify approval status**: Double-check the approval status is exactly "Approved" (case-sensitive)

## Files Modified

- `server/controllers/equipmentOfflineSitesController.js`:
  - `getAllEquipmentOfflineSites` function (restructured query building)
  - `getEquipmentOfflineSitesByFile` function (already had correct structure)
  - Added comprehensive logging






