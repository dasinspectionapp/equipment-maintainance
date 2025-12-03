# Frontend Filtering by SiteCode Fix

## Problem

Even though the backend is correctly filtering documents with approved CCR approvals, the rows are still showing in the MY OFFLINE SITES tab component. The backend logs show `willExclude: true` for siteCodes like "5W1572", "5W1599", and "LR1615", but these rows still appear in the frontend.

## Root Cause

The frontend was only filtering by `rowKey`, but:
1. Rows displayed in the frontend come from the original file data
2. The `rowKey` generated from file data might not match the `rowKey` stored in the database
3. Approvals are linked by `siteCode`, not `rowKey`
4. Multiple documents can exist for the same `siteCode` (original and routed)

## Solution

Updated both backend and frontend to filter by `siteCode` in addition to `rowKey`.

### Backend Changes

**1. `getEquipmentOfflineSitesByFile` function:**
- Now returns `excludedSiteCodes` array in addition to `excludedRowKeys`
- Extracts siteCodes from excluded records and approved approvals
- Returns both for frontend filtering

**2. `getAllEquipmentOfflineSites` function:**
- Also returns `excludedSiteCodes` array
- Queries approved approvals to get excluded siteCodes

### Frontend Changes

**1. `loadFromEquipmentOfflineSitesDB` function:**
- Now stores both `excludedRowKeys` and `excludedSiteCodes` in sessionStorage
- Filters rows by BOTH `rowKey` AND `siteCode`
- Excludes rows if either `rowKey` matches OR `siteCode` matches

**2. Filter rows useEffect:**
- Now checks both `excludedRowKeys` and `excludedSiteCodes` from sessionStorage
- Filters rows by siteCode (normalized to uppercase for comparison)
- Excludes rows if siteCode matches any in `excludedSiteCodes` array

## How It Works

1. **Backend returns excluded siteCodes:**
   ```javascript
   {
     excludedRowKeys: [...],
     excludedSiteCodes: ['5W1572', '5W1599', 'LR1615'],
     ...
   }
   ```

2. **Frontend stores in sessionStorage:**
   ```javascript
   sessionStorage.setItem(`excludedSiteCodes_${selectedFile}`, JSON.stringify(excludedSiteCodes));
   ```

3. **Frontend filters rows:**
   ```javascript
   const siteCode = (row['SITE CODE'] || row['Site Code'] || row['site code'] || '').trim().toUpperCase();
   const shouldExcludeBySiteCode = excludedSiteCodes.includes(siteCode);
   ```

4. **Row is hidden if:**
   - Its `rowKey` is in `excludedRowKeys`, OR
   - Its `siteCode` is in `excludedSiteCodes`

## Testing

1. **Approve a CCR Resolution Approval** with status "Approved" for a site (e.g., "5W1572")
2. **Refresh MY OFFLINE SITES tab** - the row should disappear
3. **Check browser console logs:**
   - Should see: `[FILTER ROWS] ❌ Hiding approved row - siteCode: 5W1572, excludedBySiteCode: true`
   - Should see: `[FILTER ROWS] ✅ Filtered X rows -> Y rows`

4. **Check server console logs:**
   - Should see: `excludedSiteCodes: ['5W1572', '5W1599', 'LR1615']`
   - Should see: `willExclude: true`

## Files Modified

- `server/controllers/equipmentOfflineSitesController.js`:
  - `getEquipmentOfflineSitesByFile`: Returns `excludedSiteCodes`
  - `getAllEquipmentOfflineSites`: Returns `excludedSiteCodes`
  
- `src/pages/MyData.tsx`:
  - `loadFromEquipmentOfflineSitesDB`: Stores and uses `excludedSiteCodes`
  - Filter rows useEffect: Filters by `siteCode` in addition to `rowKey`

## Key Improvements

1. ✅ **Dual filtering**: Filters by both `rowKey` and `siteCode`
2. ✅ **SiteCode normalization**: Converts to uppercase for consistent comparison
3. ✅ **Comprehensive exclusion**: Catches rows even if `rowKey` doesn't match
4. ✅ **Real-time filtering**: Filters immediately when data is loaded

The rows with approved CCR approvals should now be properly hidden from the MY OFFLINE SITES tab!






