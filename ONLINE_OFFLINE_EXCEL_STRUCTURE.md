# ONLINE-OFFLINE.xlsx File Structure Guide

## Problem Identified

The current database shows **duplicate column names** (multiple "DATE", "DEVICE STATUS", etc.), which causes data loss because JavaScript objects can only store one value per key name.

## Correct Excel File Structure

The ONLINE-OFFLINE.xlsx file should follow one of these two structures:

### ✅ **Option 1: Date in Column Headers (RECOMMENDED)**

Each date should be in the column header name:

```
| Sl No. | CIRCLE | DIVISION | SUB DIVISION | SITE CODE | DATE 15-11-2025 | DEVICE STATUS | EQUIPMENT L/R SWITCH STATUS | NO OF DAYS OFFLINE | RTU L/R SWITCH STATUS | DATE 16-11-2025 | DEVICE STATUS | EQUIPMENT L/R SWITCH STATUS | NO OF DAYS OFFLINE | RTU L/R SWITCH STATUS | DATE 17-11-2025 | ... |
|--------|--------|----------|--------------|-----------|-----------------|---------------|----------------------------|-------------------|----------------------|-----------------|---------------|----------------------------|-------------------|----------------------|-----------------|------|
| 1      | NORTH  | RAJAJINAGAR |            | LB0976    | 45981           | OFFLINE       | LOCAL                      | 3                 | RTU LOCAL            | 45982           | ONLINE        | REMOTE                     | 2                 | REMOTE               | 45983           | ... |
```

**Key Points:**
- Each date column group has the date in the header: `"DATE 15-11-2025"`, `"DATE 16-11-2025"`, etc.
- This allows the system to identify which date each column belongs to
- All historical data is preserved

### ⚠️ **Option 2: Date in Row 2 (FALLBACK - NOT RECOMMENDED)**

If column headers are just "DATE", the system will try to read dates from row 2:

```
| Sl No. | CIRCLE | DIVISION | SUB DIVISION | SITE CODE | DATE | DEVICE STATUS | EQUIPMENT L/R SWITCH STATUS | NO OF DAYS OFFLINE | RTU L/R SWITCH STATUS | DATE | DEVICE STATUS | ... |
|--------|--------|----------|--------------|-----------|------|---------------|----------------------------|-------------------|----------------------|------|---------------|-----|
|        |        |          |              |           | 15-11-2025 |              |                            |                   |                      | 16-11-2025 |               | ... |
| 1      | NORTH  | RAJAJINAGAR |            | LB0976    | 45981 | OFFLINE       | LOCAL                      | 3                 | RTU LOCAL            | 45982 | ONLINE        | ... |
```

**Problems with this approach:**
- Row 2 must contain dates for each DATE column
- If row 2 is missing or has wrong data, dates won't be identified correctly
- Less reliable than Option 1

## Current Issue in Your Database

Your current database shows:
```json
"headers": [
  "DATE",           // First date column (no date in name)
  "DEVICE STATUS",
  ...
  "DATE",           // Second date column (duplicate name - DATA LOST!)
  "DEVICE STATUS",  // Duplicate name - DATA LOST!
  ...
]
```

**This means:**
- The Excel file has columns all named "DATE" (without dates in headers)
- When converted to JavaScript objects, duplicate keys overwrite each other
- Only the last date column's data is preserved
- All older date data is lost

## Solution

### Step 1: Fix Your Excel File

**Update the column headers to include dates:**

1. Open your ONLINE-OFFLINE.xlsx file
2. In Row 1 (header row), change:
   - `"DATE"` → `"DATE 15-11-2025"` (or whatever the actual date is)
   - `"DATE"` → `"DATE 16-11-2025"` (for the second date column)
   - `"DATE"` → `"DATE 17-11-2025"` (for the third date column)
   - And so on...

3. Make sure each date column group has unique headers:
   - First group: `DATE 15-11-2025`, `DEVICE STATUS`, `EQUIPMENT L/R SWITCH STATUS`, `NO OF DAYS OFFLINE`, `RTU L/R SWITCH STATUS`
   - Second group: `DATE 16-11-2025`, `DEVICE STATUS`, `EQUIPMENT L/R SWITCH STATUS`, `NO OF DAYS OFFLINE`, `RTU L/R SWITCH STATUS`
   - Third group: `DATE 17-11-2025`, `DEVICE STATUS`, `EQUIPMENT L/R SWITCH STATUS`, `NO OF DAYS OFFLINE`, `RTU L/R SWITCH STATUS`

### Step 2: Re-upload the File

After fixing the Excel file:
1. Delete the old upload from the system
2. Upload the corrected file
3. The system will now preserve all date columns with unique names

### Step 3: Verify

After re-uploading, check the database headers should look like:
```json
"headers": [
  "DATE 15-11-2025",  // ✅ Unique name
  "DEVICE STATUS",
  "EQUIPMENT L/R SWITCH STATUS",
  "NO OF DAYS OFFLINE",
  "RTU L/R SWITCH STATUS",
  "DATE 16-11-2025",  // ✅ Unique name
  "DEVICE STATUS",
  ...
]
```

## Code Fixes Applied

The upload code has been updated to:
1. **Handle duplicate column names** by making them unique (e.g., "DATE", "DATE_1", "DATE_2")
2. **Preserve all date columns** when extracting from ONLINE-OFFLINE file
3. **Include all rows** (not just those with data in latest date column)

However, **the Excel file structure still needs to be corrected** to include dates in column headers for proper identification.

## Recommended Excel File Format

```
Row 1 (Headers):
| Sl No. | CIRCLE | DIVISION | SUB DIVISION | SITE CODE | DATE 15-11-2025 | DEVICE STATUS | EQUIPMENT L/R SWITCH STATUS | NO OF DAYS OFFLINE | RTU L/R SWITCH STATUS | DATE 16-11-2025 | DEVICE STATUS | EQUIPMENT L/R SWITCH STATUS | NO OF DAYS OFFLINE | RTU L/R SWITCH STATUS | DATE 17-11-2025 | ... |

Row 2+ (Data):
| 1 | NORTH | RAJAJINAGAR | | LB0976 | 45981 | OFFLINE | LOCAL | 3 | RTU LOCAL | 45982 | ONLINE | REMOTE | 2 | REMOTE | 45983 | ... |
```

**Important:**
- Each date column group should have the date in the header name
- Use format: `DATE DD-MM-YYYY` or `DATE DD/MM/YYYY`
- Example: `DATE 15-11-2025`, `DATE 16-11-2025`, `DATE 17-11-2025`

## Summary

✅ **What's Fixed:**
- Upload code now handles duplicate column names
- All date columns are extracted and preserved
- All rows are processed (not just latest date)

⚠️ **What You Need to Do:**
- Update Excel file column headers to include dates (e.g., "DATE 15-11-2025")
- Re-upload the corrected file
- Verify all date columns are stored correctly


