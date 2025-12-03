# Fixes Implemented for Ownership Transfer & Approval Issues

## Issues Identified

### Issue 1: Log Format Mismatch
**Problem:** Expected logs in testing document don't match actual console logs. Actual logs show `[bulkSaveEquipmentOfflineSites]` format.

**Root Cause:** When users update site observations directly (not through routing), it uses the bulk save endpoint which has different logging format. Ownership transfer logs only appear when routing happens through `submitRouting`.

**Fix Applied:** 
- Updated logging format in `submitRouting` to match expected format from testing document
- Logs now show: `Ownership Transfer - Starting:`, `Creating new Equipment Offline Sites document for ownership transfer:`, and `✓ New Equipment Offline Sites document created for ownership transfer:`

**Location:** `server/controllers/actionController.js` (lines ~1073-1200)

---

### Issue 2: Original UserId Not Showing
**Problem:** When updating Site observation as "Pending" and routing directly, the original userId is not showing in the document.

**Root Cause:** When routing happens directly from UI, the Equipment Offline Sites document might not exist yet, or it's created through bulk save which might not preserve the original userId correctly.

**Fix Applied:**
- Enhanced ownership transfer code to create initial document if not found
- The initial document is created with the current user's userId before routing
- Original document is preserved with correct userId for audit trail

**Location:** `server/controllers/actionController.js` (lines ~1133-1180)

**How It Works:**
1. When routing occurs, system first tries to find existing Equipment Offline Sites document
2. If not found, creates initial document for current user (original owner)
3. Then creates new document for routed user
4. Original document remains unchanged with original userId

---

### Issue 3: Approval Not Triggering When RTU Resolves
**Problem:** When Equipment routes to RTU user and RTU user updates site observation as "Resolved", the approval for CCR role is not being triggered.

**Root Cause:** When RTU resolves a site observation directly (by updating Equipment Offline Sites document), the related action status is NOT automatically updated to "Completed". The approval creation logic in `updateActionStatus` only triggers when action status is explicitly updated to "Completed".

**Fix Applied:**
- Added logic in `saveEquipmentOfflineSite` to detect when a routed document is resolved
- When resolved, system finds the related action and updates it to "Completed"
- Then triggers CCR approval creation automatically
- This ensures approvals are created even when resolution happens through direct document update

**Location:** `server/controllers/equipmentOfflineSitesController.js` (lines ~313-450)

**How It Works:**
1. When a site observation is resolved (`siteObservations === ''`)
2. System checks if this is a routed document (rowKey contains `-routed-`)
3. Finds the related action using `sourceFileId`, `rowKey`, and `userId`
4. Updates action status to "Completed"
5. Triggers CCR approval creation logic
6. Creates CCR approval action and Approval document

**Key Code Added:**
```javascript
// When resolved routed document detected
if (finalSiteObservations === '' && isRoutedDocument) {
  // Find related action
  // Update action to "Completed"
  // Create CCR approval
}
```

---

## Files Modified

### 1. `server/controllers/actionController.js`
- **Changes:**
  - Updated logging format to match testing document expectations
  - Enhanced original document creation logic
  - Improved ownership transfer logging

### 2. `server/controllers/equipmentOfflineSitesController.js`
- **Changes:**
  - Added imports: `User` and `Approval` models
  - Added approval triggering logic when routed documents are resolved
  - Enhanced resolution detection for routed documents

---

## Testing the Fixes

### Test 1: Verify Log Format
1. Route a site observation (Equipment → RTU)
2. Check server console logs
3. **Expected:** Logs should show:
   ```
   Ownership Transfer - Starting: { siteCode: "...", rowKey: "...", currentUser: {...}, targetUser: {...} }
   Creating new Equipment Offline Sites document for ownership transfer: { ... }
   ✓ New Equipment Offline Sites document created for ownership transfer: { previousOwner: "...", newOwner: "..." }
   ```

### Test 2: Verify Original UserId
1. Update site observation as "Pending" and route directly
2. Check database for original document
3. **Expected:** Original document should have correct userId (Equipment user)
4. **Expected:** Routed document should have new userId (RTU user)

### Test 3: Verify Approval Triggering
1. Route Equipment → RTU
2. Log in as RTU user
3. Update site observation as "Resolved"
4. Check database for:
   - Action status should be "Completed"
   - CCR approval action should be created
   - Approval document should be created
5. **Expected:** 
   - Action: `status: "Completed"`
   - New Action: `typeOfIssue: "CCR Resolution Approval"`, `assignedToRole: "CCR"`
   - Approval document: `approvalType: "CCR Resolution Approval"`, `status: "Pending"`

---

## Database Verification Queries

### Check Original Document
```javascript
db.equipmentofflinesites.find({
  fileId: "YOUR_FILE_ID",
  siteCode: "YOUR_SITE_CODE",
  rowKey: { $not: /-routed-/ }
})
```

### Check Routed Document
```javascript
db.equipmentofflinesites.find({
  fileId: "YOUR_FILE_ID",
  siteCode: "YOUR_SITE_CODE",
  rowKey: { $regex: /-routed-rtu_user-/ }
})
```

### Check Action After Resolution
```javascript
db.actions.find({
  sourceFileId: "YOUR_FILE_ID",
  assignedToUserId: "rtu_user_id",
  status: "Completed"
})
```

### Check CCR Approval Created
```javascript
db.actions.find({
  typeOfIssue: "CCR Resolution Approval",
  sourceFileId: "YOUR_FILE_ID",
  status: "Pending"
})
```

### Check Approval Document
```javascript
db.approvals.find({
  approvalType: "CCR Resolution Approval",
  status: "Pending"
}).sort({ createdAt: -1 })
```

---

## Expected Behavior After Fixes

### Scenario: Equipment → RTU → Resolved → CCR Approval

1. **Equipment routes to RTU:**
   - Original document created (if not exists): `userId: equipment_user`
   - Routed document created: `userId: rtu_user`, `rowKey: original-routed-rtu_user-timestamp`
   - Action created: `assignedToUserId: rtu_user`, `status: "Pending"`

2. **RTU resolves:**
   - Equipment Offline Sites document updated: `siteObservations: ""` (Resolved)
   - Action automatically updated: `status: "Completed"`
   - CCR approval action created: `typeOfIssue: "CCR Resolution Approval"`, `assignedToRole: "CCR"`
   - Approval document created: `approvalType: "CCR Resolution Approval"`, `status: "Pending"`

3. **CCR user sees approval:**
   - Approval appears in "My Approvals" page
   - Can approve/reject the resolution

---

## Important Notes

1. **Approval Triggering:** The approval is now triggered automatically when a routed document is resolved, regardless of whether the action status was updated through the UI or directly through document update.

2. **Original Document:** The original document is always preserved with the original userId for audit trail purposes.

3. **Log Format:** Logs now match the expected format in the testing document for easier verification.

4. **Error Handling:** All new code includes error handling that doesn't block the main operation (document save/action creation).

---

## Rollback Instructions

If issues occur, the fixes can be rolled back by:

1. **For Approval Triggering Fix:**
   - Remove the approval triggering code block in `saveEquipmentOfflineSite` (lines ~313-450)
   - Remove imports: `User` and `Approval` from `equipmentOfflineSitesController.js`

2. **For Logging Fix:**
   - Revert logging changes in `actionController.js` (lines ~1073-1200)

---

*Fixes implemented and ready for testing*


