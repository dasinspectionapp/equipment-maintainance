# Hide Approved Rows in MY OFFLINE SITES Fix

## Problem

When a CCR approval status is "Approved" in the Approvals collection, the corresponding row should be **hidden** in the "MY OFFLINE SITES" tab on the frontend, but the document should **remain in the database**.

## Solution

Updated both API endpoints that fetch equipment offline sites data to check the Approvals collection and exclude documents that have approved CCR Resolution Approvals.

## Changes Made

### 1. `getAllEquipmentOfflineSites` Function (Line 1270)

**Added logic to:**
- Query the Approvals collection for approved CCR Resolution Approvals
- Extract `equipmentOfflineSiteId` and `siteCode` from approved approvals
- Exclude documents that match approved approvals (by `_id` or `siteCode`)

**Key Changes:**
- Queries `Approval.find({ approvalType: 'CCR Resolution Approval', status: 'Approved' })`
- Gets list of `approvedSiteIds` and `approvedSiteCodes`
- Adds exclusion conditions to the query to filter out matching documents

### 2. `getEquipmentOfflineSitesByFile` Function (Line 1346)

**Added logic to:**
- Query the Approvals collection for approved CCR Resolution Approvals
- Extract `equipmentOfflineSiteId` and `siteCode` from approved approvals
- Exclude documents that match approved approvals in the query
- Track excluded records separately for frontend filtering

**Key Changes:**
- Queries approved approvals before building the main query
- Excludes documents by `_id` (matching `equipmentOfflineSiteId`) or `siteCode`
- Calculates `excludedCount` including both `ccrStatus === 'Approved'` and approved approvals
- Returns `excludedRowKeys` to help frontend filter rows

## How It Works

1. **Query Approved Approvals:**
   ```javascript
   const approvedApprovals = await Approval.find({
     approvalType: 'CCR Resolution Approval',
     status: 'Approved'
   }).select('equipmentOfflineSiteId siteCode').lean();
   ```

2. **Extract IDs and Site Codes:**
   ```javascript
   const approvedSiteIds = approvedApprovals
     .map(a => a.equipmentOfflineSiteId)
     .filter(id => id !== null && id !== undefined);
   
   const approvedSiteCodes = approvedApprovals
     .map(a => a.siteCode)
     .filter(code => code && code.trim() !== '')
     .map(code => code.trim().toUpperCase());
   ```

3. **Add Exclusion to Query:**
   ```javascript
   // Include only documents where:
   // - _id is NOT in approvedSiteIds AND
   // - siteCode is NOT in approvedSiteCodes
   if (approvedSiteIds.length > 0) {
     inclusionConditions.push({ _id: { $nin: approvedSiteIds } });
   }
   if (approvedSiteCodes.length > 0) {
     inclusionConditions.push({ siteCode: { $nin: approvedSiteCodes } });
   }
   ```

4. **Exclude by Both Criteria:**
   - Documents with `_id` matching an approved approval's `equipmentOfflineSiteId` are excluded
   - Documents with `siteCode` matching an approved approval's `siteCode` are excluded
   - Documents must pass BOTH checks (not match either exclusion) to be included

## Filtering Logic

### Documents Included:
- ✅ `ccrStatus !== 'Approved'` (or null/undefined/empty)
- ✅ `_id` NOT in list of approved approval `equipmentOfflineSiteIds`
- ✅ `siteCode` NOT in list of approved approval `siteCodes`

### Documents Excluded:
- ❌ `ccrStatus === 'Approved'`
- ❌ `_id` matches any approved approval's `equipmentOfflineSiteId`
- ❌ `siteCode` matches any approved approval's `siteCode`

## Testing

1. **Create a CCR Resolution Approval** with status "Approved"
2. **Check MY OFFLINE SITES tab** - the corresponding row should NOT appear
3. **Check database** - the document should still exist in EquipmentOfflineSites collection
4. **Check Reports** - can still access by passing `includeApproved=true` query parameter

## Notes

- Documents are **NOT deleted** from the database, only filtered out from the API response
- Both `equipmentOfflineSiteId` and `siteCode` are checked to ensure comprehensive filtering
- The filtering works even if the `ccrStatus` field wasn't updated in EquipmentOfflineSites
- Frontend will automatically hide rows that aren't in the API response

## Files Modified

- `server/controllers/equipmentOfflineSitesController.js`:
  - `getAllEquipmentOfflineSites` function (lines 1270-1344)
  - `getEquipmentOfflineSitesByFile` function (lines 1346-1474)






