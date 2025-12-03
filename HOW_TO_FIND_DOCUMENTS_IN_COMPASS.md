# How to Find Documents in MongoDB Compass

## Based on Your Console Logs

According to your server console logs, the documents **DO EXIST** in the database. Here's exactly where to find them:

---

## ✅ What the Logs Show:

```
database: 'das'
collection: 'Equipment offline sites'
totalDocuments: 2
```

**Document 1 (Original):**
- `_id`: `692bdc12c9d6c2307d9b6b8e`
- `rowKey`: `nc35yh-nc35yh-702`
- `userId`: `jagadish1`
- `siteCode`: `3W1575`
- `fileId`: `nc35yh`

**Document 2 (Routed):**
- `_id`: `692bdca7451612d89f164503`
- `rowKey`: `nc35yh-nc35yh-702-routed-arun1-1764482215636`
- `userId`: `arun1`
- `siteCode`: `3W1575`
- `fileId`: `nc35yh`

---

## 🔍 Step-by-Step Instructions:

### Step 1: Open MongoDB Compass
- Launch MongoDB Compass application

### Step 2: Connect to Your Database
- Make sure you're connected to the same MongoDB server your Node.js app uses
- Check your `.env` file or server config for `MONGODB_URI`

### Step 3: Select the Database
- In the left sidebar, look for database name: **`das`**
- Click on it to expand

### Step 4: Open the Collection
- Under the `das` database, find collection: **`Equipment offline sites`**
- Click on it to open

### Step 5: Search for Documents

**Method 1: Search by FileId and SiteCode**
1. Click the "Filter" button (funnel icon) or press `Ctrl+F`
2. Enter this filter:
   ```json
   {
     "fileId": "nc35yh",
     "siteCode": "3W1575"
   }
   ```
3. Press Enter or click "Apply"
4. You should see **2 documents**

**Method 2: Search by Original Document ID**
1. Click the "Filter" button
2. Enter this filter:
   ```json
   {
     "_id": ObjectId("692bdc12c9d6c2307d9b6b8e")
   }
   ```
3. Press Enter
4. You should see the original document

**Method 3: Search by Routed Document ID**
1. Click the "Filter" button
2. Enter this filter:
   ```json
   {
     "_id": ObjectId("692bdca7451612d89f164503")
   }
   ```
3. Press Enter
4. You should see the routed document

**Method 4: Search by RowKey**
1. Click the "Filter" button
2. Enter this filter for original:
   ```json
   {
     "rowKey": "nc35yh-nc35yh-702"
   }
   ```
   OR for routed:
   ```json
   {
     "rowKey": "nc35yh-nc35yh-702-routed-arun1-1764482215636"
   }
   ```
3. Press Enter

---

## ⚠️ Common Issues:

### Issue 1: Wrong Database Selected
**Symptom:** Can't find the documents
**Solution:** 
- Check ALL databases in the left sidebar
- Look for database name: `das`
- The console log shows: `database: 'das'`

### Issue 2: Filters Still Applied
**Symptom:** Documents don't appear after filtering
**Solution:**
1. Clear all filters
2. Click the "X" on any filter bar
3. Refresh the collection view (press F5 or click refresh icon)

### Issue 3: Collection Name Different
**Symptom:** Can't find collection
**Solution:**
- Collection name is exactly: **`Equipment offline sites`** (with space and capital letters)
- Check for typos or case differences

### Issue 4: Connected to Wrong Server
**Symptom:** Database doesn't exist
**Solution:**
- Verify your MongoDB connection string
- Make sure Compass is connected to the same MongoDB instance as your server
- Check if you have multiple MongoDB instances running

---

## 📋 Quick Verification Checklist:

- [ ] MongoDB Compass is open and connected
- [ ] Database **`das`** exists and is selected
- [ ] Collection **`Equipment offline sites`** exists and is open
- [ ] All filters are cleared
- [ ] Using filter: `{ "fileId": "nc35yh", "siteCode": "3W1575" }`
- [ ] Expected: **2 documents** should appear

---

## 🔬 If Documents Still Don't Appear:

### 1. Check Database Name
Run this in MongoDB Shell:
```javascript
use das;
show collections;
db.getCollection('Equipment offline sites').countDocuments({
  fileId: "nc35yh",
  siteCode: "3W1575"
});
```

### 2. List All Databases
In MongoDB Compass, look at all databases in the left sidebar. The documents might be in a different database if:
- Your connection string changed
- Multiple MongoDB instances exist
- Database name is different in production vs development

### 3. Check Connection String
In your server code or `.env` file, check:
```
MONGODB_URI=mongodb://localhost:27017/das
```
Or similar. The database name should match `das`.

### 4. Refresh MongoDB Compass
- Close and reopen MongoDB Compass
- Reconnect to the database
- Refresh the collection view

---

## 📝 What to Look For:

When you find the documents, you should see:

**Original Document:**
```json
{
  "_id": ObjectId("692bdc12c9d6c2307d9b6b8e"),
  "fileId": "nc35yh",
  "rowKey": "nc35yh-nc35yh-702",
  "siteCode": "3W1575",
  "userId": "jagadish1",
  "savedFrom": "MY OFFLINE SITES",
  ...
}
```

**Routed Document:**
```json
{
  "_id": ObjectId("692bdca7451612d89f164503"),
  "fileId": "nc35yh",
  "rowKey": "nc35yh-nc35yh-702-routed-arun1-1764482215636",
  "siteCode": "3W1575",
  "userId": "arun1",
  "savedFrom": "Routed from Equipment to RTU/Communication",
  ...
}
```

---

## ✅ Success Indicators:

If everything is correct, you should:
1. See **2 documents** when filtering by `fileId` and `siteCode`
2. One document has `userId: "jagadish1"` (original)
3. One document has `userId: "arun1"` (routed)
4. The routed document has `-routed-` in its `rowKey`

---

## 🆘 Still Having Issues?

If documents still don't appear after following all steps:

1. **Check server console** - The next routing will show enhanced logs with database name
2. **Share a screenshot** - Of MongoDB Compass showing:
   - Database list (left sidebar)
   - Collection list under `das` database
   - Filter bar with any filters applied
3. **Share connection details** - Your `MONGODB_URI` (remove password) to verify database name

The enhanced logging will now show you exactly which database to check!


