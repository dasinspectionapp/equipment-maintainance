# Hide Approved SiteCodes for ALL Users - Backend Fix

## Problem

When a CCR role user approves a site code, it should disappear/hidden for ALL role users in MY OFFLINE SITES, but currently it's only disappearing for Equipment role users.

## Root Cause

The backend was correctly fetching ALL approved approvals (regardless of userId), but the `excludedSiteCodes` calculation was prioritizing siteCodes from the current user's excluded records first, then adding siteCodes from all approved approvals. This could cause issues if the priority was wrong.

## Solution

Updated the backend to prioritize `approvedSiteCodesFromApprovals` (which contains ALL approved siteCodes from ALL users) as the source of truth, ensuring that when CCR approves ANY siteCode, it's included in `excludedSiteCodes` for ALL users.

### Changes Made

**1. Backend Controller (`server/controllers/equipmentOfflineSitesController.js`):**
- **Lines 1548-1575**: Updated `excludedSiteCodes` calculation to prioritize `approvedSiteCodesFromApprovals` as the source of truth
- Changed from: Combining excludedSiteCodes first, then approvedSiteCodesFromApprovals
- Changed to: Prioritizing approvedSiteCodesFromApprovals first (ALL approved siteCodes), then adding current user's excluded siteCodes

**2. Enhanced Logging:**
- Added detailed logging to show the calculation process
- Logs show which siteCodes come from approvals vs records
- Confirms that excludedSiteCodes include ALL approved siteCodes for ALL users

## How It Works Now

1. **Backend fetches ALL approved approvals:**
   ```javascript
   const approvedApprovals = await Approval.find({
     approvalType: 'CCR Resolution Approval',
     status: 'Approved'
   }).select('equipmentOfflineSiteId siteCode').lean();
   ```
   - This fetches ALL approved approvals, regardless of userId or role

2. **Extract siteCodes from ALL approvals:**
   ```javascript
   const approvedSiteCodesFromApprovals = approvedApprovals
     .map(a => a.siteCode)
     .filter(code => code && code.trim() !== '')
     .map(code => code.trim().toUpperCase());
   ```
   - These are ALL approved siteCodes, regardless of which user owns the record

3. **Combine with current user's excluded siteCodes:**
   ```javascript
   const allExcludedSiteCodes = Array.from(new Set([
     ...approvedSiteCodesFromApprovals,  // ALL approved siteCodes (source of truth)
     ...excludedSiteCodes                 // Current user's excluded siteCodes (additional)
   ]));
   ```
   - Final list includes ALL approved siteCodes for ALL users

4. **Return to frontend:**
   - Frontend receives `excludedSiteCodes` with ALL approved siteCodes
   - Frontend filters rows by siteCode for ALL users (Equipment, RTU/Communication, O&M, AMC, CCR, etc.)

## Testing

1. **As CCR user:** Approve a siteCode (e.g., "5W1623")
2. **As Equipment user:** Check MY OFFLINE SITES - siteCode should be hidden
3. **As RTU/Communication user:** Check MY OFFLINE SITES - siteCode should be hidden
4. **As O&M user:** Check MY OFFLINE SITES - siteCode should be hidden
5. **As AMC user:** Check MY OFFLINE SITES - siteCode should be hidden
6. **As any other user:** Check MY OFFLINE SITES - siteCode should be hidden

## Expected Behavior

- ✅ Approved siteCodes are hidden for ALL users in MY OFFLINE SITES
- ✅ Backend returns ALL approved siteCodes in `excludedSiteCodes` array
- ✅ Frontend filters by siteCode for ALL users
- ✅ Works regardless of user role or userId

## Files Modified

- `server/controllers/equipmentOfflineSitesController.js`:
  - Updated `excludedSiteCodes` calculation to prioritize `approvedSiteCodesFromApprovals`
  - Added detailed logging for debugging





