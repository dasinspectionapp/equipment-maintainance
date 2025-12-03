# Approval Workflow Implementation

## Overview

When a routed user (RTU/Communication, O&M, AMC, etc.) updates Site Observation STATUS to **RESOLVED**, an approval workflow is triggered based on the user's role.

---

## Approval Workflow Rules

### Rule 1: Non-AMC Roles (RTU/Communication, O&M, Relay, etc.)
**When**: User with role **RTU/Communication**, **O&M**, **Relay**, or any other role (except AMC and CCR) resolves a site observation.

**Action**: 
- ✅ Create **CCR Resolution Approval** directly
- ✅ Assign to **CCR role user**

**Flow**:
```
RTU/O&M/Other User Resolves
    ↓
CCR Approval Created
    ↓
CCR User Approves/Rejects
```

---

### Rule 2: AMC Role
**When**: User with role **AMC** resolves a site observation.

**Action**: 
- ✅ Create **AMC Resolution Approval** (First Approval)
- ✅ Assign to **Equipment role user**
- ✅ When Equipment approves → Create **CCR Resolution Approval** (Second Approval)
- ✅ Assign to **CCR role user**

**Flow**:
```
AMC User Resolves
    ↓
Equipment Approval Created (First Approval)
    ↓
Equipment User Approves
    ↓
CCR Approval Created (Second Approval)
    ↓
CCR User Approves/Rejects
```

---

## Implementation Details

### Location
- **File**: `server/controllers/equipmentOfflineSitesController.js`
- **Function**: `saveEquipmentOfflineSite`
- **Section**: "Trigger Action Completion and Approval when Resolved"

### Trigger Condition
Approval workflow is triggered when:
1. `finalSiteObservations === ''` (Resolved = empty string)
2. Document exists (`offlineSite`)
3. Document is routed OR ownership was transferred:
   - `rowKey` contains `-routed-` suffix, OR
   - `savedFrom` contains "Ownership transferred" or "Routed from"

---

## Console Logging

### For AMC Users:

```
[saveEquipmentOfflineSite] 🔍 Approval workflow check: {
  currentUserRole: 'AMC',
  isRegularAction: true,
  actionId: '...',
  siteCode: '...'
}
[saveEquipmentOfflineSite] 🔄 AMC user resolved - Creating Equipment approval (First Approval)
[saveEquipmentOfflineSite] Found original Equipment user who routed this: {
  userId: 'jagadish1',
  fullName: 'Jagadish'
}
[saveEquipmentOfflineSite] Creating Equipment approval (First Approval for AMC): {
  originalActionId: '...',
  equipmentUserId: 'jagadish1',
  siteCode: '...'
}
[saveEquipmentOfflineSite] ✅✅✅ Equipment approval created (First Approval for AMC): {
  approvalId: '...',
  actionId: '...',
  equipmentUserId: 'jagadish1',
  siteCode: '...',
  note: 'When Equipment approves, CCR approval will be created automatically'
}
```

### For RTU/Communication/O&M Users:

```
[saveEquipmentOfflineSite] 🔍 Approval workflow check: {
  currentUserRole: 'RTU/Communication',
  isRegularAction: true,
  actionId: '...',
  siteCode: '...'
}
[saveEquipmentOfflineSite] 🔄 Non-AMC user resolved - Creating CCR approval: {
  userRole: 'RTU/Communication',
  userId: 'arun1'
}
[saveEquipmentOfflineSite] Creating CCR approval for resolved routed document: {
  originalActionId: '...',
  ccrUserId: '...',
  siteCode: '...',
  resolvedByRole: 'RTU/Communication'
}
[saveEquipmentOfflineSite] ✅✅✅ CCR approval created: {
  approvalId: '...',
  actionId: '...',
  siteCode: '...',
  resolvedByRole: 'RTU/Communication'
}
```

---

## Approval Document Structure

### AMC Resolution Approval (First Approval)
```javascript
{
  approvalType: 'AMC Resolution Approval',
  status: 'Pending',
  submittedByUserId: 'amc_user_id',
  submittedByRole: 'AMC',
  assignedToUserId: 'equipment_user_id',
  assignedToRole: 'Equipment',
  siteCode: '...',
  actionId: '...',
  equipmentOfflineSiteId: '...',
  metadata: {
    originalActionId: '...',
    approvalSequence: 'first'
  }
}
```

### CCR Resolution Approval (For Non-AMC or Second Approval for AMC)
```javascript
{
  approvalType: 'CCR Resolution Approval',
  status: 'Pending',
  submittedByUserId: 'resolving_user_id',
  submittedByRole: 'RTU/Communication' | 'O&M' | 'Equipment',
  assignedToUserId: 'ccr_user_id',
  assignedToRole: 'CCR',
  siteCode: '...',
  actionId: '...',
  equipmentOfflineSiteId: '...'
}
```

---

## User Finding Logic

### Equipment User (for AMC First Approval)
1. **Priority 1**: Find the Equipment user who originally routed the action
   - Check `action.assignedByUserId` and `action.assignedByRole === 'Equipment'`
2. **Priority 2**: If not found, get first available Equipment user
   - Query: `role: 'Equipment', status: 'approved', isActive: true`

### CCR User (for Final Approval)
- Get first available CCR user
- Query: `role: 'CCR', status: 'approved', isActive: true`

---

## Second Approval Creation (AMC → Equipment → CCR)

When Equipment user approves AMC Resolution Approval:
- **Location**: `server/controllers/approvalController.js`
- **Function**: `updateApprovalStatus`
- **Logic**: Already implemented (lines 176-325)

**Console Logs**:
```
[ApprovalController] Equipment approved AMC Resolution Approval - Creating CCR approval (Second Approval)
[ApprovalController] Selected CCR user for second approval: {
  userId: '...',
  fullName: '...'
}
[ApprovalController] CCR approval action created: {
  actionId: '...',
  assignedToUserId: '...'
}
[ApprovalController] ✅ CCR Resolution Approval (Second Approval) created successfully
```

---

## Complete Workflow Examples

### Example 1: RTU/Communication User Resolves

**Step 1**: RTU/Communication user marks site as Resolved
```
User: arun1 (RTU/Communication)
Action: Updates siteObservations to "Resolved"
```

**Step 2**: System creates CCR approval
```
✅ CCR Resolution Approval created
   - Assigned to: CCR user
   - Status: Pending
   - Submitted by: arun1 (RTU/Communication)
```

**Step 3**: CCR user approves/rejects
```
CCR user reviews and approves/rejects
```

---

### Example 2: AMC User Resolves

**Step 1**: AMC user marks site as Resolved
```
User: amc_user (AMC)
Action: Updates siteObservations to "Resolved"
```

**Step 2**: System creates Equipment approval (First Approval)
```
✅ AMC Resolution Approval created
   - Assigned to: Equipment user (jagadish1)
   - Status: Pending
   - Submitted by: amc_user (AMC)
```

**Step 3**: Equipment user approves
```
User: jagadish1 (Equipment)
Action: Approves AMC Resolution Approval
```

**Step 4**: System creates CCR approval (Second Approval)
```
✅ CCR Resolution Approval created (automatically)
   - Assigned to: CCR user
   - Status: Pending
   - Submitted by: jagadish1 (Equipment)
   - Note: This is the second approval
```

**Step 5**: CCR user approves/rejects
```
CCR user reviews and approves/rejects
```

---

## Verification

### Check Approvals in Database

**MongoDB Query**:
```javascript
// Find all approvals for a site
db.getCollection('Approvals').find({
  siteCode: "LB1653"
}).forEach(approval => {
  print("\n--- Approval ---");
  print("_id: " + approval._id);
  print("approvalType: " + approval.approvalType);
  print("status: " + approval.status);
  print("submittedByRole: " + approval.submittedByRole);
  print("assignedToRole: " + approval.assignedToRole);
  print("siteCode: " + approval.siteCode);
});
```

### Expected Results

**For RTU/Communication Resolution**:
- 1 Approval document
- `approvalType`: `CCR Resolution Approval`
- `submittedByRole`: `RTU/Communication`
- `assignedToRole`: `CCR`

**For AMC Resolution**:
- 2 Approval documents (after Equipment approves)
- First: `approvalType`: `AMC Resolution Approval`, `assignedToRole`: `Equipment`
- Second: `approvalType`: `CCR Resolution Approval`, `assignedToRole`: `CCR`

---

## Error Handling

### No Equipment User Found (AMC Case)
```
[saveEquipmentOfflineSite] ❌ No Equipment user found - Cannot create first approval for AMC resolution
```
**Impact**: Approval not created, but document save succeeds

### No CCR User Found
```
[saveEquipmentOfflineSite] ❌ No CCR user found - Cannot create approval
```
**Impact**: Approval not created, but document save succeeds

### Approval Already Exists
```
[saveEquipmentOfflineSite] Equipment approval already exists: { existingActionId: '...' }
[saveEquipmentOfflineSite] CCR approval already exists: { existingActionId: '...' }
```
**Impact**: Skips creation to prevent duplicates

---

## Key Features

### ✅ Role-Based Approval Routing
- Different approval paths based on resolving user's role
- AMC requires two-step approval
- Other roles require single-step approval

### ✅ Automatic Second Approval (AMC)
- When Equipment approves AMC Resolution Approval
- System automatically creates CCR Resolution Approval
- No manual intervention needed

### ✅ Comprehensive Logging
- All approval creation steps logged
- Easy to track approval workflow
- Clear error messages if issues occur

### ✅ Duplicate Prevention
- Checks for existing approvals before creating
- Prevents duplicate approval documents

---

## Testing Checklist

### Test Case 1: RTU/Communication User Resolves
- [ ] RTU/Communication user marks site as Resolved
- [ ] Console shows "Creating CCR approval"
- [ ] CCR Resolution Approval created in database
- [ ] Approval assigned to CCR user
- [ ] Approval visible in CCR user's "My Approvals"

### Test Case 2: AMC User Resolves
- [ ] AMC user marks site as Resolved
- [ ] Console shows "Creating Equipment approval (First Approval)"
- [ ] AMC Resolution Approval created in database
- [ ] Approval assigned to Equipment user
- [ ] Approval visible in Equipment user's "My Approvals"
- [ ] Equipment user approves
- [ ] Console shows "Creating CCR approval (Second Approval)"
- [ ] CCR Resolution Approval created automatically
- [ ] CCR approval visible in CCR user's "My Approvals"

### Test Case 3: O&M User Resolves
- [ ] O&M user marks site as Resolved
- [ ] Console shows "Creating CCR approval"
- [ ] CCR Resolution Approval created
- [ ] Approval assigned to CCR user

---

## Summary

✅ **Non-AMC Roles** → Direct CCR Approval  
✅ **AMC Role** → Equipment Approval (First) → CCR Approval (Second)  
✅ **Automatic Second Approval** → Created when Equipment approves AMC approval  
✅ **Comprehensive Logging** → All steps logged in console  
✅ **Error Handling** → Graceful handling of missing users  

The approval workflow is now fully implemented and ready for testing!


