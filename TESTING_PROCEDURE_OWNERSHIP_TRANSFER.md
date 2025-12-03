# Testing Procedure: Ownership Transfer & Routing Implementation

## Overview
This document provides comprehensive testing procedures for the ownership transfer feature when routing site observations. The ownership transfer creates separate Equipment Offline Sites documents for each routed user while maintaining an audit trail.

---

## Prerequisites

### Database Access
- MongoDB access (MongoDB Compass or similar tool)
- Collection: `equipmentofflinesites`
- Collection: `actions`

### User Roles Required for Testing
- Equipment User
- RTU User
- AMC User
- O&M User
- CCR User (optional)

### Test Data
- At least one uploaded file with site observations
- Site observations in "Pending" status
- Valid site codes

---

## Test Scenarios

## 1. Single Routing Test
**Scenario:** Equipment user routes a site observation to RTU team

### Step-by-Step Procedure

#### Step 1: Prepare Test Data
1. Log in as **Equipment User**
2. Navigate to **MY OFFLINE SITES** or **Dashboard**
3. Find a site observation with status **Pending**
4. Note down the following:
   - **Site Code**: ________________
   - **File ID**: ________________
   - **Row Key**: ________________
   - **Original User ID**: ________________

#### Step 2: Perform Routing
1. Click on the site observation
2. Update **Site Observations** to **Pending** (if not already)
3. Select **Type of Issue**: Choose appropriate type
4. Select **Routing**: Choose **RTU Team**
5. Add **Remarks** (optional): "Test routing from Equipment to RTU"
6. Click **Submit** or **Route**

#### Step 3: Verify Action Creation
**Where to Check:** Database - `actions` collection

**Expected Result:**
```json
{
  "assignedToUserId": "rtu_user_id",
  "assignedToRole": "RTU",
  "assignedByUserId": "equipment_user_id",
  "assignedByRole": "Equipment",
  "status": "Pending",
  "typeOfIssue": "selected_type",
  "routing": "RTU Team",
  "sourceFileId": "file_id_from_step_1",
  "rowKey": "row_key_from_step_1"
}
```

**Verification Query:**
```javascript
db.actions.find({
  assignedToUserId: "rtu_user_id",
  sourceFileId: "file_id_from_step_1",
  status: "Pending"
}).sort({ createdAt: -1 }).limit(1)
```

#### Step 4: Verify Equipment Offline Sites Documents
**Where to Check:** Database - `equipmentofflinesites` collection

**Expected Results:**

**Document 1 - Original (unchanged):**
```json
{
  "fileId": "file_id_from_step_1",
  "rowKey": "original_row_key",  // NO "-routed-" suffix
  "siteCode": "SITE_CODE",
  "userId": "equipment_user_id",
  "siteObservations": "Pending",
  "taskStatus": "Pending at Equipment Team"
}
```

**Document 2 - New (routed to RTU):**
```json
{
  "fileId": "file_id_from_step_1",
  "rowKey": "original_row_key-routed-rtu_user_id-timestamp",
  "siteCode": "SITE_CODE",
  "userId": "rtu_user_id",  // NEW OWNER
  "siteObservations": "Pending",
  "taskStatus": "Pending at RTU Team",
  "savedFrom": "Routed from Equipment to RTU"
}
```

**Verification Queries:**
```javascript
// Find original document
db.equipmentofflinesites.find({
  fileId: "file_id_from_step_1",
  siteCode: "SITE_CODE",
  userId: "equipment_user_id",
  rowKey: { $not: /-routed-/ }
})

// Find routed document
db.equipmentofflinesites.find({
  fileId: "file_id_from_step_1",
  siteCode: "SITE_CODE",
  userId: "rtu_user_id",
  rowKey: { $regex: /-routed-rtu_user_id-/ }
})
```

#### Step 5: Verify UI - Equipment User
**Where to Check:** Equipment User's Reports Tab

1. Log in as **Equipment User**
2. Navigate to **Reports** tab
3. Select **Type of Report**: **Pending**
4. **Expected Result:** Original site observation should still be visible
5. Verify **Site Code** matches the test data
6. Verify **Task Status** shows "Pending at Equipment Team" or similar

#### Step 6: Verify UI - RTU User
**Where to Check:** RTU User's Reports Tab & My Actions

1. Log in as **RTU User**
2. Navigate to **Reports** tab
3. Select **Type of Report**: **Pending**
4. **Expected Result:** Routed site observation should be visible
5. Verify **Site Code** matches the test data
6. Verify **Task Status** shows "Pending at RTU Team"
7. Navigate to **My Actions**
8. **Expected Result:** Action should be visible in pending actions

#### Step 7: Verify Logs
**Where to Check:** Server console logs

**Expected Log Entries:**
```
Ownership Transfer - Starting: {
  siteCode: "SITE_CODE",
  rowKey: "...",
  currentUser: { userId: "...", role: "Equipment" },
  targetUser: { userId: "...", role: "RTU" }
}

Creating new Equipment Offline Sites document for ownership transfer: {
  siteCode: "SITE_CODE",
  sourceDocumentId: "...",
  newRowKey: "...",
  routingFrom: { userId: "...", role: "Equipment" },
  routingTo: { userId: "...", role: "RTU" }
}

✓ New Equipment Offline Sites document created for ownership transfer: {
  siteCode: "SITE_CODE",
  previousOwner: "...",
  newOwner: "..."
}
```

### Success Criteria
- ✅ Action created successfully
- ✅ Original Equipment Offline Sites document unchanged
- ✅ New Equipment Offline Sites document created with RTU user as owner
- ✅ RowKey format: `original-routed-rtu_user_id-timestamp`
- ✅ Equipment user still sees original document in Pending Reports
- ✅ RTU user sees routed document in Pending Reports and My Actions

---

## 2. Sequential Routing Test
**Scenario:** Equipment → RTU → AMC → O&M (chain routing)

### Step-by-Step Procedure

#### Step 1: Initial Routing (Equipment → RTU)
1. Follow **Single Routing Test** Steps 1-2
2. Route from **Equipment** to **RTU**
3. Note down the **rowKey** of the new RTU document: ________________

#### Step 2: Second Routing (RTU → AMC)
1. Log in as **RTU User**
2. Navigate to **My Actions** or **Reports → Pending**
3. Find the site observation routed from Equipment
4. Click **Reroute** or **Route** button
5. Select **Routing**: **AMC Team**
6. Add **Remarks**: "Test routing from RTU to AMC"
7. Click **Submit**

#### Step 3: Verify Documents After RTU → AMC Routing
**Where to Check:** Database - `equipmentofflinesites` collection

**Expected Documents:**

1. **Original Document (Equipment):**
   - `rowKey`: `original_row_key` (no routing suffix)
   - `userId`: Equipment user
   - Status: Unchanged

2. **RTU Document:**
   - `rowKey`: `original_row_key-routed-rtu_user_id-timestamp1`
   - `userId`: RTU user
   - Status: Unchanged

3. **AMC Document (NEW):**
   - `rowKey`: `original_row_key-routed-amc_user_id-timestamp2`
   - `userId`: AMC user
   - Status: Pending at AMC Team

**Verification Query:**
```javascript
db.equipmentofflinesites.find({
  fileId: "file_id",
  siteCode: "SITE_CODE"
}).sort({ createdAt: 1 })
```

**Expected Count:** 3 documents

#### Step 4: Third Routing (AMC → O&M)
1. Log in as **AMC User**
2. Navigate to **My Actions**
3. Find the site observation routed from RTU
4. Click **Reroute**
5. Select **Routing**: **O&M Team**
6. Click **Submit**

#### Step 5: Verify Final Documents
**Where to Check:** Database - `equipmentofflinesites` collection

**Expected Documents:**

1. **Original (Equipment)**
2. **RTU Document**
3. **AMC Document**
4. **O&M Document (NEW):**
   - `rowKey`: `original_row_key-routed-om_user_id-timestamp3`
   - `userId`: O&M user

**Verification Query:**
```javascript
db.equipmentofflinesites.find({
  fileId: "file_id",
  siteCode: "SITE_CODE"
}).sort({ createdAt: 1 })
```

**Expected Count:** 4 documents

#### Step 6: Verify Reports for Each User
**Where to Check:** Each user's Reports → Pending

| User | Expected Result |
|------|----------------|
| Equipment | Should see original document |
| RTU | Should see RTU document |
| AMC | Should see AMC document |
| O&M | Should see O&M document (most recent) |

### Success Criteria
- ✅ All 4 documents exist in database
- ✅ Each document has unique rowKey with routing suffix
- ✅ Each user sees their own document in Pending Reports
- ✅ Original document remains unchanged
- ✅ Base rowKey is preserved in all routing suffixes

---

## 3. Parallel Routing Test
**Scenario:** Equipment user routes same site observation to AMC and O&M simultaneously

### Step-by-Step Procedure

#### Step 1: Prepare Test Data
1. Log in as **Equipment User**
2. Find a site observation with status **Pending**
3. Note down:
   - **Site Code**: ________________
   - **File ID**: ________________
   - **Row Key**: ________________

#### Step 2: First Parallel Route (Equipment → AMC)
1. Open the site observation
2. Select **Routing**: **AMC Team**
3. Click **Submit**
4. **Important:** Note the timestamp: ________________

#### Step 3: Second Parallel Route (Equipment → O&M)
**CRITICAL:** Perform this IMMEDIATELY after Step 2 (within seconds)

1. **Without refreshing the page**, or open the same site observation again
2. Select **Routing**: **O&M Team**
3. Click **Submit**
4. Note the timestamp: ________________

**Alternative Method (if UI doesn't support):**
- Use API calls or test scripts to route to both simultaneously
- Open two browser windows/tabs and route simultaneously

#### Step 4: Verify Parallel Documents
**Where to Check:** Database - `equipmentofflinesites` collection

**Expected Documents:**

1. **Original Document (Equipment):**
   - `rowKey`: `original_row_key`
   - `userId`: Equipment user

2. **AMC Document:**
   - `rowKey`: `original_row_key-routed-amc_user_id-timestamp1`
   - `userId`: AMC user
   - Created at: timestamp1

3. **O&M Document:**
   - `rowKey`: `original_row_key-routed-om_user_id-timestamp2`
   - `userId`: O&M user
   - Created at: timestamp2

**Verification Query:**
```javascript
db.equipmentofflinesites.find({
  fileId: "file_id",
  siteCode: "SITE_CODE"
}).sort({ createdAt: 1 })
```

**Expected Count:** 3 documents

#### Step 5: Verify Base RowKey Consistency
**Where to Check:** Database

**Verification Query:**
```javascript
db.equipmentofflinesites.find({
  fileId: "file_id",
  siteCode: "SITE_CODE"
}).forEach(doc => {
  const baseKey = doc.rowKey.split('-routed-')[0];
  print("Document: " + doc.rowKey + " | Base: " + baseKey);
})
```

**Expected Result:** All documents should have the same base rowKey

#### Step 6: Verify Concurrent Routing Protection
**Test Duplicate Routing:**

1. Try to route from Equipment → AMC again (for same site)
2. **Expected Result:** 
   - Action may be created
   - But Equipment Offline Sites document should NOT be duplicated
   - Check logs for: "Equipment Offline Sites document already exists for target user"

**Verification Query:**
```javascript
db.equipmentofflinesites.find({
  fileId: "file_id",
  siteCode: "SITE_CODE",
  userId: "amc_user_id",
  rowKey: { $regex: /-routed-amc_user_id-/ }
}).count()
```

**Expected Count:** Should be 1 (not duplicated)

#### Step 7: Verify Reports
**Where to Check:** Each user's Reports → Pending

| User | Expected Result |
|------|----------------|
| Equipment | Should see original document |
| AMC | Should see AMC document |
| O&M | Should see O&M document |

**Important:** Both AMC and O&M users should see their respective documents independently.

#### Step 8: Test Resolution Impact
1. Log in as **AMC User**
2. Resolve the site observation (set Site Observations to empty or Resolved)
3. Log in as **Equipment User**
4. Check **Reports → Pending**
5. **Expected Result:** Original document should STILL be visible (O&M still pending)
6. Log in as **O&M User**
7. Resolve the site observation
8. Log in as **Equipment User** again
9. Check **Reports → Pending**
10. **Expected Result:** Original document should now be HIDDEN (both resolved)

### Success Criteria
- ✅ Both AMC and O&M documents created from same original
- ✅ Both have unique rowKeys with different timestamps
- ✅ Base rowKey is consistent across all documents
- ✅ Concurrent routing protection prevents duplicates
- ✅ Equipment user sees original until BOTH resolve
- ✅ Each routed user sees their own document

---

## 4. Re-routing Test
**Scenario:** RTU user reroutes an action to AMC user

### Step-by-Step Procedure

#### Step 1: Initial Setup
1. Follow **Single Routing Test** Steps 1-2 to create Equipment → RTU route
2. Verify RTU document exists

#### Step 2: Perform Re-routing
1. Log in as **RTU User**
2. Navigate to **My Actions**
3. Find the action routed from Equipment
4. Click **Reroute** button
5. Select **User/Role**: **AMC Team** or specific AMC user
6. Add **Remarks**: "Rerouting from RTU to AMC"
7. Click **Submit**

#### Step 3: Verify Action Update
**Where to Check:** Database - `actions` collection

**Verification Query:**
```javascript
db.actions.find({
  _id: ObjectId("action_id"),
  assignedToUserId: "amc_user_id",
  assignedToRole: "AMC"
})
```

**Expected Result:**
- Action `assignedToUserId` updated to AMC user
- Action `assignedToRole` updated to "AMC"
- Action `status` reset to "Pending"
- Action `remarks` includes reroute remarks

#### Step 4: Verify Equipment Offline Sites Documents
**Where to Check:** Database - `equipmentofflinesites` collection

**Expected Documents:**

1. **Original (Equipment):**
   - `rowKey`: `original_row_key`
   - `userId`: Equipment user
   - Status: Unchanged

2. **RTU Document:**
   - `rowKey`: `original_row_key-routed-rtu_user_id-timestamp1`
   - `userId`: RTU user
   - Status: Unchanged (remains for audit)

3. **AMC Document (NEW - from reroute):**
   - `rowKey`: `original_row_key-routed-amc_user_id-timestamp2`
   - `userId`: AMC user
   - `savedFrom`: "Rerouted from RTU to AMC"

**Verification Query:**
```javascript
db.equipmentofflinesites.find({
  fileId: "file_id",
  siteCode: "SITE_CODE"
}).sort({ createdAt: 1 })
```

#### Step 5: Verify Reports After Re-routing
**Where to Check:** Each user's Reports → Pending

| User | Expected Result |
|------|----------------|
| Equipment | Should see original document |
| RTU | Should NOT see the document (rerouted away) |
| AMC | Should see AMC document (new owner) |

#### Step 6: Verify My Actions
**Where to Check:** Each user's My Actions page

| User | Expected Result |
|------|----------------|
| RTU | Action should be REMOVED from list |
| AMC | Action should be ADDED to list |

### Success Criteria
- ✅ Action reassigned to AMC user
- ✅ New Equipment Offline Sites document created for AMC
- ✅ RTU document remains unchanged (audit trail)
- ✅ RTU user loses access to action and document
- ✅ AMC user gains access to action and document

---

## 5. Missing Document Handling Test
**Scenario:** Routing when Equipment Offline Sites document doesn't exist yet

### Step-by-Step Procedure

#### Step 1: Prepare Test Scenario
1. Find a site observation that has NOT been saved to Equipment Offline Sites yet
2. Or manually delete the Equipment Offline Sites document:
   ```javascript
   db.equipmentofflinesites.deleteOne({
     fileId: "test_file_id",
     siteCode: "TEST_SITE_CODE"
   })
   ```

#### Step 2: Perform Routing
1. Log in as **Equipment User**
2. Route to **RTU Team** (or any team)
3. **Note:** This tests the "missing document" handling

#### Step 3: Verify Document Creation
**Where to Check:** Database - `equipmentofflinesites` collection

**Expected Behavior:**

1. **Initial Document Created:**
   - System should create initial document for Equipment user
   - Then create routed document for target user

**Verification Query:**
```javascript
db.equipmentofflinesites.find({
  fileId: "test_file_id",
  siteCode: "TEST_SITE_CODE"
}).sort({ createdAt: 1 })
```

**Expected Result:** 2 documents
- First: Initial document for Equipment user
- Second: Routed document for target user

#### Step 4: Check Logs
**Where to Check:** Server console logs

**Expected Log Entry:**
```
Equipment Offline Sites document not found - creating initial document: {
  siteCode: "...",
  currentUserId: "..."
}

✓ Initial Equipment Offline Sites document created: {
  siteCode: "...",
  documentId: "..."
}
```

### Success Criteria
- ✅ Initial document created automatically
- ✅ Routed document created successfully
- ✅ No errors in routing process
- ✅ Logs indicate missing document handling

---

## 6. Self-Routing Test (Optional)
**Scenario:** User routes to themselves (if functionality is needed)

### Step-by-Step Procedure

#### Step 1: Perform Self-Routing
1. Log in as **Equipment User**
2. Route a site observation
3. Select **Routing**: **Equipment Team** (same team)
4. Or select same user
5. Click **Submit**

#### Step 2: Verify Behavior
**Where to Check:** Database and Logs

**Expected Result:**
- Action may be created
- Equipment Offline Sites document should NOT be duplicated
- Log should show: "Equipment Offline Sites document already owned by assigned user"

**Verification Query:**
```javascript
db.equipmentofflinesites.find({
  fileId: "file_id",
  siteCode: "SITE_CODE",
  userId: "equipment_user_id"
}).count()
```

**Expected Count:** Should remain same (no duplicate)

### Success Criteria
- ✅ No duplicate documents created
- ✅ System handles self-routing gracefully
- ✅ Appropriate log messages

---

## 7. Error Handling Test

### Step-by-Step Procedure

#### Test 1: Missing Required Fields
1. Try routing without `siteCode`, `rowKey`, or `sourceFileId`
2. **Expected Result:** Routing should still succeed, but ownership transfer should be skipped
3. **Check Logs:** Should see "Skipping ownership transfer - missing required fields"

#### Test 2: Database Error Simulation
1. Temporarily disconnect database or cause connection error
2. Try routing
3. **Expected Result:** 
   - Routing action should still be created
   - Ownership transfer may fail, but routing should succeed
   - Error should be logged but not thrown

#### Test 3: Invalid User
1. Try routing to non-existent user
2. **Expected Result:** Routing should fail before ownership transfer (normal validation)

### Success Criteria
- ✅ System remains stable during errors
- ✅ Routing action creation is not blocked by ownership transfer failures
- ✅ Errors are logged appropriately

---

## 8. Reports Verification Test

### Step-by-Step Procedure

#### Test 1: Pending Reports After Routing
1. Route a site observation from Equipment → RTU
2. Log in as **Equipment User**
3. Navigate to **Reports → Pending**
4. **Expected Result:** Original document visible

#### Test 2: Pending Reports After Resolution
1. Route Equipment → RTU
2. Log in as **RTU User**
3. Resolve the site observation (set Site Observations to empty)
4. Log in as **Equipment User**
5. Check **Reports → Pending**
6. **Expected Result:** Original document should be HIDDEN (resolved)

#### Test 3: Pending Reports with Parallel Routing
1. Route Equipment → AMC + O&M (parallel)
2. Log in as **AMC User**, resolve
3. Log in as **Equipment User**, check Reports
4. **Expected Result:** Original document should STILL be visible (O&M pending)
5. Log in as **O&M User**, resolve
6. Log in as **Equipment User**, check Reports again
7. **Expected Result:** Original document should now be HIDDEN (both resolved)

### Success Criteria
- ✅ Reports show correct documents per user
- ✅ Resolved documents are hidden appropriately
- ✅ Parallel routing handled correctly in reports

---

## Verification Checklist

### Database Verification

- [ ] Original Equipment Offline Sites document remains unchanged
- [ ] New documents created with correct `userId`
- [ ] RowKey format: `originalKey-routed-userId-timestamp`
- [ ] All documents have same `fileId` and `siteCode`
- [ ] Base rowKey consistent across routing chain
- [ ] No duplicate documents for same user
- [ ] `savedFrom` field correctly indicates routing source

### Action Verification

- [ ] Action created with correct `assignedToUserId`
- [ ] Action created with correct `assignedToRole`
- [ ] Action has correct `sourceFileId` and `rowKey`
- [ ] Re-routing updates action assignment correctly

### UI Verification

- [ ] Original user sees original document in Pending Reports
- [ ] Routed user sees routed document in Pending Reports
- [ ] Routed user sees action in My Actions
- [ ] Re-routed user gains access, previous user loses access
- [ ] Resolved documents disappear from Pending Reports

### Logs Verification

- [ ] Ownership transfer logs appear
- [ ] Document creation logs appear
- [ ] Error logs appear for failures (if any)
- [ ] Logs include siteCode, userIds, rowKeys for debugging

### Performance Verification

- [ ] Routing completes within acceptable time (< 5 seconds)
- [ ] Database queries are efficient (check with explain)
- [ ] No N+1 query problems
- [ ] Concurrent routing doesn't cause race conditions

---

## Common Issues & Troubleshooting

### Issue 1: Document Not Created
**Symptoms:** Routing succeeds but no Equipment Offline Sites document created

**Troubleshooting:**
1. Check logs for error messages
2. Verify `siteCode`, `rowKey`, `sourceFileId` are present
3. Check database connection
4. Verify `assignedUser` is valid

**Expected Log:**
```
Skipping ownership transfer - missing required fields: {
  hasSiteCode: true/false,
  hasRowKey: true/false,
  ...
}
```

### Issue 2: Duplicate Documents
**Symptoms:** Multiple documents for same user and siteCode

**Troubleshooting:**
1. Check concurrent routing protection
2. Verify rowKey uniqueness
3. Check for race conditions in parallel routing

**Fix:** System should prevent duplicates automatically

### Issue 3: Wrong User Assigned
**Symptoms:** Document created with incorrect userId

**Troubleshooting:**
1. Verify `assignedUser.userId` is correct
2. Check user lookup logic
3. Verify division/role matching

### Issue 4: Original Document Modified
**Symptoms:** Original document's userId changed

**Troubleshooting:**
1. Verify code creates NEW document, not updates existing
2. Check that original document remains unchanged
3. Verify rowKey is different for new document

**Fix:** Original should NEVER be modified

### Issue 5: Reports Not Showing Correctly
**Symptoms:** Users see wrong documents in Reports

**Troubleshooting:**
1. Verify Reports query filters by `userId`
2. Check resolved status filtering
3. Verify parallel routing logic in Reports

---

## Test Data Preparation Script

```javascript
// MongoDB Script for Test Data Preparation

// 1. Create test Equipment Offline Sites document
db.equipmentofflinesites.insertOne({
  fileId: "test_file_001",
  rowKey: "test_file_001-sitecode001",
  siteCode: "TEST001",
  userId: "equipment_user",
  siteObservations: "Pending",
  taskStatus: "Pending at Equipment Team",
  typeOfIssue: "Test Issue",
  createdAt: new Date(),
  updatedAt: new Date()
});

// 2. Verify document exists
db.equipmentofflinesites.find({
  fileId: "test_file_001",
  siteCode: "TEST001"
});

// 3. Clean up test data (after testing)
db.equipmentofflinesites.deleteMany({
  fileId: "test_file_001",
  siteCode: "TEST001"
});

db.actions.deleteMany({
  sourceFileId: "test_file_001"
});
```

---

## Test Execution Summary

| Test Scenario | Status | Notes |
|--------------|--------|-------|
| Single Routing | ⬜ Pending | |
| Sequential Routing | ⬜ Pending | |
| Parallel Routing | ⬜ Pending | |
| Re-routing | ⬜ Pending | |
| Missing Document | ⬜ Pending | |
| Self-Routing | ⬜ Pending | |
| Error Handling | ⬜ Pending | |
| Reports Verification | ⬜ Pending | |

**Test Executed By:** ________________  
**Date:** ________________  
**Version Tested:** ________________  

---

## Sign-off

**QA Tester:** ________________ Date: ________________  
**Developer:** ________________ Date: ________________  
**Product Owner:** ________________ Date: ________________  

---

*End of Testing Procedure Document*


