# Routed SiteCode Exclusion Verification

## Problem

When a CCR role user approves a site code, it should disappear/hidden for ALL role users in MY OFFLINE SITES, including for routed documents (documents that were routed from Equipment to other roles like RTU/Communication, O&M, AMC, etc.).

## Analysis

### How Routing Works

1. **Original Document:**
   - `rowKey`: `nc35yh-nc35yh-712`
   - `userId`: Equipment user (e.g., `jagadish1`)
   - `siteCode`: `5W1599`

2. **Routed Document:**
   - `rowKey`: `nc35yh-nc35yh-712-routed-naresh1-1764488857070`
   - `userId`: Routed user (e.g., `naresh1` - RTU/Communication user)
   - `siteCode`: `5W1599` (SAME as original)

### Key Insight

**Both original and routed documents share the SAME `siteCode`**. This is critical because:
- When CCR approves a siteCode, the approval stores the `siteCode` (not the `rowKey`)
- When filtering, we exclude by `siteCode`, which automatically excludes BOTH original and routed documents

### Current Implementation

1. **Backend (`getEquipmentOfflineSitesByFile`):**
   - Fetches ALL approved approvals: `Approval.find({ approvalType: 'CCR Resolution Approval', status: 'Approved' })`
   - Extracts ALL siteCodes from these approvals: `approvedSiteCodesFromApprovals`
   - Returns `excludedSiteCodes: allExcludedSiteCodes` which includes ALL approved siteCodes

2. **Frontend (`MyData.tsx`):**
   - Fetches fresh `excludedSiteCodes` from API
   - Filters rows by comparing `row['SITE CODE']` (or variations) with `excludedSiteCodes`
   - Since both original and routed rows have the same siteCode, both are filtered

## Verification

### Test Case 1: Original Document Approved
- Equipment user creates document with siteCode "5W1599"
- CCR approves it
- Result: "5W1599" should be hidden for Equipment user ✅

### Test Case 2: Routed Document Approved
- Equipment user routes document with siteCode "5W1599" to RTU user
- RTU user resolves and CCR approves
- Result: "5W1599" should be hidden for:
  - Equipment user (original document) ✅
  - RTU user (routed document) ✅
  - ALL other users ✅

### Why This Works

1. **Approval stores siteCode:**
   ```javascript
   const approval = await Approval.create({
     siteCode: siteCodeUpper, // Same for original and routed
     approvalType: 'CCR Resolution Approval',
     status: 'Approved'
   });
   ```

2. **Backend returns ALL approved siteCodes:**
   ```javascript
   const approvedSiteCodesFromApprovals = approvedApprovals
     .map(a => a.siteCode) // Gets siteCode from ALL approvals
     .filter(code => code && code.trim() !== '')
     .map(code => code.trim().toUpperCase());
   ```

3. **Frontend filters by siteCode:**
   ```javascript
   const siteCode = (row['SITE CODE'] || ...).trim().toUpperCase();
   const shouldExclude = normalizedExcludedSiteCodes.includes(siteCode);
   ```
   - Original row with siteCode "5W1599" → excluded ✅
   - Routed row with siteCode "5W1599" → excluded ✅

## Conclusion

The current implementation **should already work** for routed siteCodes because:
- ✅ Approvals store siteCode (not rowKey)
- ✅ Both original and routed documents share the same siteCode
- ✅ Backend returns ALL approved siteCodes
- ✅ Frontend filters by siteCode (not rowKey)

However, if routed siteCodes are still showing, it might be due to:
1. **Cache issue**: Frontend not fetching fresh excludedSiteCodes
2. **SiteCode mismatch**: SiteCode normalization issue (case, whitespace, etc.)
3. **Timing issue**: Approval created but excludedSiteCodes not refreshed

## Enhanced Logging

Added detailed logging to verify:
- Which siteCodes are in excludedSiteCodes
- Which rows are being filtered
- Confirmation that both original and routed documents are handled

## Files Modified

- `server/controllers/equipmentOfflineSitesController.js`:
  - Enhanced logging for excludedSiteCodes calculation
  - Added note about routed documents sharing same siteCode

- `src/pages/MyData.tsx`:
  - Enhanced logging in file load filtering
  - Added note about filtering both original and routed siteCodes

## Testing

1. **Route a document** from Equipment to RTU/Communication user
2. **Resolve** as RTU user
3. **Approve** as CCR user
4. **Verify** that the siteCode is hidden for:
   - Equipment user (original document)
   - RTU/Communication user (routed document)
   - ALL other users
5. **Check console logs** to see:
   - `excludedSiteCodes: ['5W1599', ...]`
   - `[FILE LOAD] ❌ HIDING approved row - siteCode: "5W1599"`





