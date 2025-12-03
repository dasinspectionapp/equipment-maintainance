# Quick Test Checklist - Ownership Transfer

## ⚡ 5-Minute Quick Test

### Step 1: Route a Site Observation (1 min)
1. Open "MY OFFLINE SITES"
2. Select any site with "Pending" status
3. Fill in:
   - Type of Issue: `RTU Issue`
   - Remarks: `Test check`
   - Status: `Pending`
4. Click "Submit" → Route to "RTU/Communication Team"

### Step 2: Check Console Logs (1 min)
Look for these key indicators:

✅ **MUST SEE:**
```
[Ownership Transfer] ✅✅✅ Ownership transfer completed successfully!
[Routing] ✅✅✅ SUCCESS: Both documents verified in database!
[Routing] ✅✅✅ FINAL VERIFICATION PASSED: Both documents persist in database
```

✅ **Check Count:**
```
totalDocuments: 2  ← Should be 2, not 1
```

✅ **Check Ownership:**
```
newOwner: 'arun1'  ← Should match assigned user
originalDocUserId: 'arun1'  ← Should match assigned user (after transfer)
```

### Step 3: Check MongoDB Compass (2 min)
1. Open MongoDB Compass
2. Database: `das`
3. Collection: `Equipment offline sites`
4. Filter: `{ "fileId": "nc35yh", "siteCode": "5W1597" }`
   (Replace with your test fileId and siteCode)

✅ **Expected:** 2 documents

✅ **Document 1 (Original):**
- `rowKey`: NO `-routed-` suffix
- `userId`: `arun1` (or assigned user)
- `savedFrom`: `Ownership transferred from Equipment to RTU/Communication`

✅ **Document 2 (Routed):**
- `rowKey`: HAS `-routed-` suffix
- `userId`: `arun1` (or assigned user)
- `savedFrom`: `Routed from Equipment to RTU/Communication`

### Step 4: Test Update (1 min)
1. Click the same site row again
2. Update remarks: `Updated test`
3. Save

✅ **MUST NOT SEE:**
```
❌ E11000 duplicate key error
❌ assignedUserDoc is not defined
```

✅ **MUST SEE:**
```
[saveEquipmentOfflineSite] Using existing record _id for update
[saveEquipmentOfflineSite] Updated record ID: ... updatedAt: ...
```

---

## ✅ Pass/Fail Criteria

### PASS if:
- [ ] Ownership transfer logs appear
- [ ] Console shows "SUCCESS: Both documents verified"
- [ ] MongoDB shows 2 documents
- [ ] Both documents have correct userId (assigned user)
- [ ] Update works without errors
- [ ] No duplicate key errors

### FAIL if:
- [ ] Only 1 document found
- [ ] Ownership transfer errors
- [ ] Duplicate key errors
- [ ] Documents not found in MongoDB
- [ ] Update fails

---

## 🐛 Quick Troubleshooting

**Problem**: Only 1 document in MongoDB
- **Check**: Console logs for creation errors
- **Check**: Both documents show in "ALL documents" log

**Problem**: Duplicate key error
- **Check**: Server restarted after code changes
- **Check**: Using document `_id` for updates (not `fileId + rowKey + userId`)

**Problem**: Ownership not transferred
- **Check**: Console shows "Ownership Transfer" section
- **Check**: Document `userId` changed in MongoDB

**Problem**: Update fails
- **Check**: Console shows "Using existing record _id for update"
- **Check**: Document found before update

---

## 📝 Test Result

**Date**: ___________

**Test Result**: ⬜ PASS  /  ⬜ FAIL

**Notes**:
_________________________________________
_________________________________________
_________________________________________

**Screenshot/Logs**: ____________________


