# CCR Approval actionData Error Fix

## Problem

**Error**: `ReferenceError: actionData is not defined`
- **Location**: `server/controllers/actionController.js:1991`
- **Error Message**: `Error creating approval document for CCR Resolution Approval (generic): ReferenceError: actionData is not defined`

## Root Cause

At line 1991, the code was trying to access `actionData.sourceFileId`, but the variable `actionData` doesn't exist in that scope. The correct variable to use is `originalAction`, which is defined earlier in the function.

## Fix Applied

**File**: `server/controllers/actionController.js`

### Line 1991 - Before:
```javascript
fileId: actionData.sourceFileId || action.sourceFileId,
```

### Line 1991 - After:
```javascript
fileId: originalAction.sourceFileId || action.sourceFileId,
```

## Context

This error occurs in the "generic CCR approval creation" flow when a routed user completes a regular action (not an approval type action). The code flow is:

1. User completes an action with status "Completed"
2. System detects it's a regular action completed by a non-AMC/CCR user
3. System tries to create a CCR approval action
4. System tries to create the Approval document
5. **ERROR**: Line 1991 tries to use undefined `actionData` variable

## Additional Fix

Also fixed `assignedToDivision` to default to `'General'` instead of `null` if missing (line 1935), ensuring it always has a valid value since it's a required field.

## Testing

After this fix, when a routed user resolves a site observation:

1. Action is marked as "Completed"
2. CCR approval action is created successfully
3. Approval document is created successfully
4. **No more `actionData is not defined` error**

## Expected Console Output

**Before Fix**:
```
Error creating approval document for CCR Resolution Approval (generic): ReferenceError: actionData is not defined
```

**After Fix**:
```
CCR approval action created (generic): { actionId: ..., ... }
Approval document created for CCR Resolution Approval (generic): { approvalId: ..., actionId: ..., siteCode: ... }
```

The approval should now be created successfully and visible in the CCR Approvals page.






