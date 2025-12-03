# CCR Approval Visibility Fix

## Problem
When a routed user (RTU/Communication, etc.) updates site observation status as "Resolved" and submits it, the CCR approval was not showing up in CCR Approval page. The issue was that CCR users are not division-specific, but the approval query was filtering by `assignedToUserId`, which meant only the specific CCR user assigned to the approval could see it.

## Solution
Modified the approval queries to allow **ANY CCR user** to see and manage **ALL CCR Resolution Approvals**, regardless of which CCR user was initially assigned.

## Changes Made

### 1. `server/controllers/approvalController.js`

#### `getMyApprovals` function (lines 467-508)
- **Before**: Filtered approvals by `assignedToUserId: userId` for all roles
- **After**: For CCR role, removed `assignedToUserId` filter - shows ALL CCR Resolution Approvals
- **Equipment role**: Still filters by `assignedToUserId` (division-specific)

#### `getApprovalStats` function (lines 554-592)
- **Before**: Filtered approvals by `assignedToUserId: userId` for all roles
- **After**: For CCR role, removed `assignedToUserId` filter - stats for ALL CCR Resolution Approvals

#### `getApprovalById` function (lines 522-549)
- **Before**: Only allowed viewing if `assignedToUserId === userId`
- **After**: CCR users can view ANY CCR Resolution Approval

#### `updateApprovalStatus` function (lines 90-462)
- **Before**: Only allowed updating if `assignedToUserId === userId`
- **After**: CCR users can update ANY CCR Resolution Approval

### 2. `server/controllers/equipmentOfflineSitesController.js`

#### Approval Creation Logic (lines 648-745)
- **Enhanced duplicate check**: Now checks for both existing Actions AND existing Approval documents
- **Improved site code matching**: Handles multiple site code field variations ('Site Code', 'SITE CODE')
- **Added notifications**: When a CCR approval is created, notifications are sent to ALL active CCR users (since any CCR user can approve)
- **Better logging**: Added detailed console logs for approval creation process

#### Import Added
- Added `Notification` model import to support sending notifications to all CCR users

## Key Points

1. **CCR users are NOT division-specific**: Any CCR user can see and approve any CCR Resolution Approval
2. **Approval assignment still tracked**: The `assignedToUserId` field is still set when creating approvals (for tracking purposes), but it doesn't restrict visibility
3. **Notifications**: All CCR users receive notifications when new CCR approvals are created
4. **Equipment role unchanged**: Equipment users still see only their assigned AMC Resolution Approvals (division-specific)

## Testing

To verify the fix works:

1. **As a routed user (RTU/Communication)**:
   - Resolve a site observation (set status to "Resolved")
   - Submit the update
   - Check server console for: `✅✅✅ CCR approval created` log

2. **As ANY CCR user**:
   - Navigate to Approvals page
   - Should see ALL pending CCR Resolution Approvals (not just ones assigned to you)
   - Should be able to open and approve any CCR approval
   - Check that pending approvals count matches total CCR approvals in database

3. **Database verification**:
   ```javascript
   // In MongoDB Compass or shell
   db.approvals.find({ 
     approvalType: "CCR Resolution Approval", 
     status: "Pending" 
   })
   ```
   - Count the pending CCR approvals
   - Verify this count matches what ANY CCR user sees in the UI

## Console Logs to Look For

When a routed user resolves:
```
[saveEquipmentOfflineSite] 🔄 Non-AMC user resolved - Creating CCR approval
[saveEquipmentOfflineSite] ✅✅✅ CCR approval created
[saveEquipmentOfflineSite] ✅ Notifications sent to all CCR users
```

When a CCR user fetches approvals:
```
[ApprovalController] CCR user fetching ALL CCR Resolution Approvals (not filtered by assignedToUserId)
```






