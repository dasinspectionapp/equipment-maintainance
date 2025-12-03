# Hide Approved Rows for ALL Users - Final Fix

## Problem

Approved rows (with CCR approvals status = "Approved") should be hidden from the MY OFFLINE SITES tab for **ALL users**, not just Equipment users. Currently, the rows are still showing even after approval.

## Root Cause

1. Frontend filtering was restricted to Equipment users only (`userRole === 'Equipment'`)
2. The filtering logic was only running for Equipment role users
3. Other users (RTU/Communication, O&M, AMC, CCR) were not seeing the filtered results

## Solution

Updated the frontend to apply filtering for **ALL users**, regardless of their role:

### Changes Made

**1. File Loading Filtering (src/pages/MyData.tsx):**
- **Line 1977**: Removed `userRole === 'Equipment'` restriction
- Changed from: `if (userRole === 'Equipment' && selectedFile) {`
- Changed to: `if (selectedFile) {`
- Now filters rows for ALL users when loading file data

**2. Dynamic Filtering useEffect (src/pages/MyData.tsx):**
- **Line 917**: Removed `userRole !== 'Equipment'` check
- Changed from: `if (!selectedFile || userRole !== 'Equipment' || rows.length === 0 || headers.length === 0) {`
- Changed to: `if (!selectedFile || rows.length === 0 || headers.length === 0) {`
- Now filters rows for ALL users whenever rows change

**3. Backend Support:**
- The API endpoint `/api/equipment-offline-sites/file/:fileId` already returns `excludedSiteCodes` for all authenticated users
- No role restrictions - any authenticated user can fetch excludedSiteCodes
- Backend correctly identifies and returns excluded siteCodes: `['5W1599', 'LR1615', '5W1572']`

## How It Works Now

1. **When file data loads:**
   - Frontend checks sessionStorage for `excludedSiteCodes_${selectedFile}`
   - If not found, fetches from API: `/api/equipment-offline-sites/file/${selectedFile}`
   - Filters rows by comparing `siteCode` with `excludedSiteCodes`
   - Hides rows whose siteCode matches any in the excluded list

2. **When rows change:**
   - A separate useEffect monitors row changes
   - Re-filters rows using excludedSiteCodes from sessionStorage
   - Ensures approved rows stay hidden even after data updates

3. **For ALL users:**
   - Equipment users: See filtered rows
   - RTU/Communication users: See filtered rows
   - O&M users: See filtered rows
   - AMC users: See filtered rows
   - CCR users: See filtered rows
   - Any authenticated user: See filtered rows

## Testing

1. **Approve a CCR Resolution Approval** for siteCode "5W1599"
2. **Login as any user** (Equipment, RTU/Communication, O&M, AMC, CCR, etc.)
3. **Navigate to MY OFFLINE SITES tab**
4. **Verify** that the row with siteCode "5W1599" is **NOT visible**
5. **Check browser console** for logs:
   - `[FILE LOAD] Fetched excludedSiteCodes from API: ['5W1599', 'LR1615', '5W1572']`
   - `[FILE LOAD] ❌ HIDING approved row - siteCode: "5W1599"`
   - `[FILE LOAD] ✅ APPROVED ROWS FILTERED: X rows -> Y rows (EXCLUDED N approved rows)`

## Files Modified

- `src/pages/MyData.tsx`:
  - Removed `userRole === 'Equipment'` restriction in file loading filtering (line 1977)
  - Removed `userRole !== 'Equipment'` check in dynamic filtering useEffect (line 917)

## Expected Behavior

- ✅ Approved rows are hidden from MY OFFLINE SITES tab for **ALL users**
- ✅ Rows remain in database (only hidden from UI)
- ✅ Filtering happens automatically when file loads
- ✅ Filtering updates when rows change
- ✅ Works for all user roles

## Notes

- The backend already supports this - it returns `excludedSiteCodes` for all authenticated users
- No backend changes were needed
- The fix was purely frontend - removing role restrictions






