# How Documents Appear in Database

## ✅ Yes, They Are TWO SEPARATE Documents

Both documents are stored as **independent, separate entries** in the `Equipment offline sites` MongoDB collection. They are **NOT** nested or combined - each has its own unique `_id` and all its own fields.

---

## Visual Representation in Database

### In MongoDB Collection: `Equipment offline sites`

```
┌─────────────────────────────────────────────────────────────────┐
│ Collection: Equipment offline sites                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Document #1 (Original)                                   │  │
│  │ _id: 692aba27c9d6c2307d9b6b7e                            │  │
│  │ ──────────────────────────────────────────────────────── │  │
│  │ fileId: "nc35yh"                                         │  │
│  │ rowKey: "nc35yh-nc35yh-1334"        ← No routing suffix │  │
│  │ siteCode: "LB1685"                                       │  │
│  │ userId: "jagadish1"                  ← Original user     │  │
│  │ siteObservations: "Pending"                              │  │
│  │ savedFrom: "MY OFFLINE SITES"                            │  │
│  │ createdAt: 2025-11-30T03:15:00.000Z                      │  │
│  │ ... (other fields)                                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Document #2 (Routed)                                     │  │
│  │ _id: 692bbd96900af8b321e412eb                            │  │
│  │ ──────────────────────────────────────────────────────── │  │
│  │ fileId: "nc35yh"                                         │  │
│  │ rowKey: "nc35yh-nc35yh-1334-routed-arun1-1764474262876" │  │
│  │                         ↑ Has routing suffix            │  │
│  │ siteCode: "LB1685"                                       │  │
│  │ userId: "arun1"                    ← Routed user         │  │
│  │ siteObservations: "Pending"                              │  │
│  │ savedFrom: "Routed from Equipment to RTU/Communication" │  │
│  │ createdAt: 2025-11-30T03:18:01.000Z                      │  │
│  │ ... (other fields)                                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Document #3 (Another site...)                            │  │
│  │ ...                                                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Document #4 (Another site...)                            │  │
│  │ ...                                                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ... (more documents)                                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## How They Appear in MongoDB Compass

### View: List View (Default)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Equipment offline sites Collection                                   │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ ┌────────────┬──────────────────────────┬──────────┬──────────────┐ │
│ │ _id        │ rowKey                   │ userId   │ siteCode     │ │
│ ├────────────┼──────────────────────────┼──────────┼──────────────┤ │
│ │ 692aba...  │ nc35yh-nc35yh-1334       │ jagadi.. │ LB1685       │ │ ← Doc 1
│ │ 692bbd...  │ ...-routed-arun1-...     │ arun1    │ LB1685       │ │ ← Doc 2
│ │ ...        │ ...                      │ ...      │ ...          │ │
│ └────────────┴──────────────────────────┴──────────┴──────────────┘ │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### View: Document View (Click on each row)

**When you click Document #1:**
```
Document: 692aba27c9d6c2307d9b6b7e
{
  "_id": ObjectId("692aba27c9d6c2307d9b6b7e"),
  "fileId": "nc35yh",
  "rowKey": "nc35yh-nc35yh-1334",
  "siteCode": "LB1685",
  "userId": "jagadish1",
  "siteObservations": "Pending",
  "savedFrom": "MY OFFLINE SITES",
  ...
}
```

**When you click Document #2:**
```
Document: 692bbd96900af8b321e412eb
{
  "_id": ObjectId("692bbd96900af8b321e412eb"),
  "fileId": "nc35yh",
  "rowKey": "nc35yh-nc35yh-1334-routed-arun1-1764474262876",
  "siteCode": "LB1685",
  "userId": "arun1",
  "siteObservations": "Pending",
  "savedFrom": "Routed from Equipment to RTU/Communication",
  ...
}
```

---

## How They Appear in MongoDB Shell

### Query: `db.getCollection('Equipment offline sites').find({})`

**Output:**
```javascript
{
  "_id": ObjectId("692aba27c9d6c2307d9b6b7e"),
  "fileId": "nc35yh",
  "rowKey": "nc35yh-nc35yh-1334",
  "userId": "jagadish1",
  ...
}

{
  "_id": ObjectId("692bbd96900af8b321e412eb"),
  "fileId": "nc35yh",
  "rowKey": "nc35yh-nc35yh-1334-routed-arun1-1764474262876",
  "userId": "arun1",
  ...
}
```

**These are TWO separate JSON objects - each is a different document!**

---

## Key Points

### ✅ Separate Documents
- Each document has its own `_id`
- Each document is a complete, independent record
- They are stored side-by-side in the same collection
- They can be queried, updated, or deleted independently

### ✅ Same Collection
- Both documents are in: `Equipment offline sites`
- They share the same `fileId` and `siteCode`
- But have different `rowKey` and `userId`

### ✅ Easy to Identify
- **Original**: `rowKey` does NOT contain `-routed-`
- **Routed**: `rowKey` DOES contain `-routed-`

---

## Query Examples

### Get ONLY Original Document
```javascript
db.getCollection('Equipment offline sites').find({
  fileId: "nc35yh",
  siteCode: "LB1685",
  rowKey: { $not: { $regex: "-routed-" } }
})
```
**Returns:** 1 document (the original)

### Get ONLY Routed Document
```javascript
db.getCollection('Equipment offline sites').find({
  fileId: "nc35yh",
  siteCode: "LB1685",
  rowKey: { $regex: "-routed-" }
})
```
**Returns:** 1 document (the routed)

### Get BOTH Documents
```javascript
db.getCollection('Equipment offline sites').find({
  fileId: "nc35yh",
  siteCode: "LB1685"
})
```
**Returns:** 2 documents (both original and routed)

---

## Summary

✅ **YES** - They show as **TWO SEPARATE DOCUMENTS** in the database
- Not nested
- Not combined
- Each has its own `_id`
- Each is a complete, independent record
- Both are in the same collection: `Equipment offline sites`

You can see them as two different rows in MongoDB Compass, two different objects in MongoDB Shell, and query them separately or together.



