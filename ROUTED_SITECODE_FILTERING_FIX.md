# Routed SiteCode Filtering Fix for RTU/Communication Users

## Problem

When a CCR role user approves a routed site code (e.g., "5W1627"), it should disappear/hidden for ALL role users in MY OFFLINE SITES, including RTU/Communication users who view rows from actions. Currently, it's only hidden for Equipment role users but still visible for RTU/Communication users.

## Root Cause

RTU/Communication users don't see rows from file data - they see `actionsRows` (rows converted from actions). The filtering logic was only applied to file rows (`rows`), not to `actionsRows`. So when CCR approved a siteCode:
- ✅ File rows were filtered (for Equipment users)
- ❌ Action rows were NOT filtered (for RTU/Communication users)

## Solution

Added filtering for `actionsRows` in two places:

### 1. Actions Loading useEffect (lines 2425-2499)

When actions are loaded and converted to rows, filter them by `excludedSiteCodes`:
- Fetches fresh `excludedSiteCodes` from API
- Filters `actionRows` by comparing siteCode with `excludedSiteCodes`
- Sets filtered `actionsRows`

### 2. Dynamic Filtering useEffect (lines 917-1007)

When `actionsRows` change, re-filter them:
- Fetches fresh `excludedSiteCodes` from API
- Filters both `rows` (file rows) and `actionsRows` (action rows)
- Updates both `rows` and `actionsRows` state

### 3. Updated Dependencies

- Added `actionsRows` to the filtering useEffect dependency array
- Updated condition to check for `actionsRows` for RTU/Communication users

## How It Works Now

1. **RTU/Communication user loads actions:**
   - Actions are fetched from API
   - Converted to `actionRows`
   - **Filtered by `excludedSiteCodes`** (NEW!)
   - Set as `actionsRows`

2. **When CCR approves:**
   - Approval is created with `siteCode: "5W1627"`
   - Backend returns `excludedSiteCodes: ["5W1627", ...]`

3. **RTU/Communication user refreshes:**
   - Actions are re-fetched
   - **Filtered by fresh `excludedSiteCodes`**
   - Action row with siteCode "5W1627" is excluded
   - Row disappears from MY OFFLINE SITES tab

4. **Or when `actionsRows` change:**
   - Filtering useEffect runs
   - **Filters `actionsRows` by `excludedSiteCodes`**
   - Updates `actionsRows` state
   - Approved rows disappear

## Files Modified

- `src/pages/MyData.tsx`:
  - **Actions loading useEffect (lines 2425-2499):** Added filtering for `actionRows` by `excludedSiteCodes`
  - **Dynamic filtering useEffect (lines 917-1007):** Added filtering for `actionsRows` and updated dependencies
  - Updated condition to handle RTU/Communication users who use `actionsRows`

## Testing

1. **Route a document** from Equipment to RTU/Communication user (siteCode "5W1627")
2. **As RTU/Communication user:** Verify the row appears in MY OFFLINE SITES
3. **Resolve** as RTU user
4. **Approve** as CCR user
5. **As RTU/Communication user:** Refresh MY OFFLINE SITES tab
6. **Verify:** The row with siteCode "5W1627" should be **HIDDEN**
7. **Check console logs:**
   - `[ACTIONS LOAD] Filtering actionRows with excludedSiteCodes: ['5W1627', ...]`
   - `[ACTIONS LOAD] ❌ HIDING approved action row - siteCode: "5W1627"`
   - `[ACTIONS LOAD] ✅ FILTERED actionRows: X -> Y (EXCLUDED N approved action rows)`

## Expected Behavior

- ✅ Approved siteCodes are hidden for RTU/Communication users
- ✅ Approved siteCodes are hidden for O&M users
- ✅ Approved siteCodes are hidden for AMC users
- ✅ Approved siteCodes are hidden for Equipment users
- ✅ Approved siteCodes are hidden for ALL users
- ✅ Works for both original and routed documents (they share the same siteCode)





