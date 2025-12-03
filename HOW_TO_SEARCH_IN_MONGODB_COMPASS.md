# How to Search in MongoDB Compass

## Step-by-Step Guide

### Step 1: Open MongoDB Compass
1. Launch MongoDB Compass application
2. Connect to your database (if not already connected)
3. Select your database from the left sidebar
4. Click on the collection: **`Equipment offline sites`**

---

## Method 1: Search by SiteCode (Finds Both Documents)

### Steps:
1. **Click on the collection** `Equipment offline sites`
2. **Look for the filter bar** at the top (it says "Filter" with a search icon)
3. **Click in the filter input box**
4. **Enter this filter:**
   ```json
   { "siteCode": "5W2922" }
   ```
5. **Press Enter** or click the "Find" button

### What You'll See:
- All documents with `siteCode: "5W2922"`
- Should show **2 documents**: Original and Routed

---

## Method 2: Search by Document ID (Find Specific Document)

### Steps:
1. **Click on the collection** `Equipment offline sites`
2. **Click in the filter input box**
3. **Enter this filter for Original Document:**
   ```json
   { "_id": ObjectId("692aba26c9d6c2307d9b6b62") }
   ```
   
   **OR for Routed Document:**
   ```json
   { "_id": ObjectId("692bc64345ddd5220fdba1a9") }
   ```
4. **Press Enter**

### What You'll See:
- The specific document with that ID

---

## Method 3: Search by FileId and SiteCode (Most Specific)

### Steps:
1. **Click in the filter input box**
2. **Enter this filter:**
   ```json
   { "fileId": "nc35yh", "siteCode": "5W2922" }
   ```
3. **Press Enter**

### What You'll See:
- Both documents with matching `fileId` and `siteCode`

---

## Method 4: Search for Original Document Only

### Steps:
1. **Click in the filter input box**
2. **Enter this filter (finds documents WITHOUT routing suffix):**
   ```json
   { "fileId": "nc35yh", "rowKey": "nc35yh-nc35yh-990" }
   ```
3. **Press Enter**

### What You'll See:
- The original document (no `-routed-` in rowKey)

---

## Method 5: Search for Routed Document Only

### Steps:
1. **Click in the filter input box**
2. **Enter this filter (finds documents WITH routing suffix):**
   ```json
   { "fileId": "nc35yh", "rowKey": { "$regex": "-routed-" } }
   ```
3. **Press Enter**

### What You'll See:
- All routed documents (have `-routed-` in rowKey)

---

## Method 6: Clear All Filters

If you can't see documents, you might have filters applied:

### Steps:
1. **Look at the filter bar**
2. **Check if there's any text in the filter input box**
3. **If yes, click the "X" button** next to it to clear
4. **Or delete all text** from the filter box
5. **Press Enter** to refresh

---

## Visual Guide

```
┌─────────────────────────────────────────────────────────────┐
│ MongoDB Compass                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Left Sidebar:          Main Panel:                         │
│  ┌─────────────┐       ┌─────────────────────────────────┐ │
│  │ Databases   │       │ Collection: Equipment offline   │ │
│  │   └─ Your DB│       │          sites                  │ │
│  │      └─ Col │       │                                 │ │
│  │         └─ 📁│       │  ┌───────────────────────────┐ │ │
│  │  Equipment  │       │  │ Filter: { "siteCode": ... }│ │ │ ← Filter Box
│  │  offline    │       │  └───────────────────────────┘ │ │
│  │  sites      │       │                                 │ │
│  └─────────────┘       │  Documents List:                │ │
│                        │  ┌───────────────────────────┐ │ │
│                        │  │ _id: 692aba...           │ │ │ ← Document 1
│                        │  │ rowKey: nc35yh-nc35yh-... │ │ │
│                        │  └───────────────────────────┘ │ │
│                        │  ┌───────────────────────────┐ │ │
│                        │  │ _id: 692bc6...           │ │ │ ← Document 2
│                        │  │ rowKey: ...-routed-...    │ │ │
│                        │  └───────────────────────────┘ │ │
│                        └─────────────────────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Filter Syntax Tips

### Basic Filter:
```json
{ "fieldName": "value" }
```

### Multiple Fields (AND condition):
```json
{ "field1": "value1", "field2": "value2" }
```

### Search with Regex (for patterns):
```json
{ "rowKey": { "$regex": "-routed-" } }
```

### Case-Insensitive Search:
```json
{ "siteCode": { "$regex": "^5w2922$", "$options": "i" } }
```

### Not Equal:
```json
{ "rowKey": { "$not": { "$regex": "-routed-" } } }
```

---

## Common Filters for Your Use Case

### 1. Find Both Documents for a Site:
```json
{ "siteCode": "5W2922" }
```

### 2. Find Original Document Only:
```json
{ "siteCode": "5W2922", "rowKey": { "$not": { "$regex": "-routed-" } } }
```

### 3. Find Routed Document Only:
```json
{ "siteCode": "5W2922", "rowKey": { "$regex": "-routed-" } }
```

### 4. Find by User:
```json
{ "userId": "jagadish1" }
```

### 5. Find by FileId:
```json
{ "fileId": "nc35yh" }
```

---

## Troubleshooting

### ❌ "No documents match"
**Solutions:**
- Check spelling and capitalization of field names
- Check if the value exists (try broader search first)
- Remove filters and search without any filter
- Check if you're in the correct collection

### ❌ "Syntax Error"
**Solutions:**
- Make sure JSON syntax is correct (quotes, commas, braces)
- Check for typos in field names
- Use double quotes `"` not single quotes `'`

### ❌ "Can't See Any Documents"
**Solutions:**
1. Clear all filters (click X or delete filter text)
2. Check if collection is empty
3. Refresh the view
4. Verify you're connected to the correct database

---

## Quick Actions in MongoDB Compass

1. **Sort Documents:** Click on column headers to sort
2. **View Document Details:** Click on any document row to see full details
3. **Edit Document:** Click "Edit" button when viewing a document
4. **Delete Document:** Click "Delete" button when viewing a document
5. **Export:** Use the export button to save documents

---

## Example: Finding Your Two Documents

### Step-by-Step for Your Case:

1. **Open MongoDB Compass**
2. **Navigate to:** `Equipment offline sites` collection
3. **Clear any existing filters** (if any)
4. **Enter in filter box:**
   ```json
   { "siteCode": "5W2922" }
   ```
5. **Press Enter**
6. **You should see 2 documents:**
   - Document 1: `rowKey` without `-routed-` (Original)
   - Document 2: `rowKey` with `-routed-` (Routed)

### If Only 1 Document Shows:

Try searching by the exact document ID:
```json
{ "_id": ObjectId("692aba26c9d6c2307d9b6b62") }
```

This will definitely find the original document if it exists.

---

## Need More Help?

If you still can't find the documents:
1. Check the server console logs for the exact `_id` values
2. Try searching without any filters first
3. Verify you're in the correct database and collection
4. Check if documents were created in a different database



