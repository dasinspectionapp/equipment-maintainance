# Maintenance Fields Added to RMU Upload

## Summary (January 6, 2025)

### ✅ New Fields Added (2)

1. **MaintenanceFrequency** (Column 10)
   - Type: Dropdown (optional)
   - Options: 13 choices

2. **MaintenanceStartingDate** (Column 11)
   - Type: Date (optional)
   - Format: YYYY-MM-DD or DD/MM/YYYY

---

## Maintenance Frequency Options

The dropdown includes **13 options**:

### Standard Frequencies:
- Monthly
- Quarterly
- Half-Yearly
- Yearly

### Custom Intervals:
- 15 Days
- 2 Months
- 4 Months
- 5 Months
- 7 Months
- 8 Months
- 9 Months
- 10 Months
- 11 Months

---

## Updated Excel Template Structure

### Current: 14 Columns (was 12)

```
1.  Circle *
2.  Division *
3.  SubDivision
4.  SiteCode *
5.  HRN *
6.  RMU_Make
7.  Equipment Type *
8.  InstallationDate
9.  CommissioningDate
10. MaintenanceFrequency         ← NEW (Dropdown)
11. MaintenanceStartingDate      ← NEW (Date)
12. Latitude
13. Longitude
14. AgencyCode
```

---

## Field Details

### MaintenanceFrequency
- **Column:** J (10th column)
- **Required:** No (optional)
- **Type:** Dropdown list
- **Default:** Empty
- **Validation:** Must be one of the 13 predefined values if provided

### MaintenanceStartingDate
- **Column:** K (11th column)
- **Required:** No (optional)
- **Type:** Date
- **Format:** YYYY-MM-DD or DD/MM/YYYY
- **Default:** Empty

---

## Sample Data Updated

### Template Sample Row:
```
Circle: NORTH
Division: HEBBAL
SubDivision: S1
SiteCode: SITE001
HRN: HRN12345
RMU_Make: ABB
Equipment Type: RMU
InstallationDate: 2024-01-15
CommissioningDate: 2024-02-01
MaintenanceFrequency: Quarterly     ← NEW
MaintenanceStartingDate: 2024-03-01 ← NEW
Latitude: 12.9716
Longitude: 77.5946
AgencyCode: AMC001
```

---

## Files Modified (3 files)

### 1. Backend Model
**File:** `server/models/RMUMaster.js`

**Added:**
```javascript
maintenanceStartingDate: {
  type: Date
},

maintenanceFrequency: {
  type: String,
  enum: [
    'Monthly', 'Quarterly', 'Half-Yearly', 'Yearly',
    '2 Months', '4 Months', '5 Months', '7 Months',
    '8 Months', '9 Months', '10 Months', '11 Months',
    '15 Days', ''
  ]
}
```

---

### 2. Backend Controller
**File:** `server/controllers/rmuController.js`

**Changes:**
- ✅ Added 2 columns to template (14 columns total)
- ✅ Updated merge cells from A1:L1 to A1:N1
- ✅ Added MaintenanceFrequency dropdown validation
- ✅ Added sample data for both fields
- ✅ Updated parsing logic (columns 10 & 11)
- ✅ Added validation for maintenance frequency values

**Dropdown Added:**
```javascript
// Maintenance Frequency dropdown (Column J)
formulae: ['"Monthly,Quarterly,Half-Yearly,Yearly,2 Months,4 Months,5 Months,7 Months,8 Months,9 Months,10 Months,11 Months,15 Days"']
```

---

### 3. Frontend
**File:** `src/pages/RMUUpload.tsx`

**Changes:**
- ✅ Added fields to `ParsedData` interface
- ✅ Updated preview table header (now shows "Maintenance Freq.")
- ✅ Preview table displays maintenance frequency value

---

## Validation

### MaintenanceFrequency Validation:
- Must be one of: Monthly, Quarterly, Half-Yearly, Yearly, 2 Months, 4 Months, 5 Months, 7 Months, 8 Months, 9 Months, 10 Months, 11 Months, 15 Days
- Can be empty (optional field)
- Error message: "Invalid Maintenance Frequency"

### MaintenanceStartingDate Validation:
- Must be valid date format
- Can be empty (optional field)

---

## Usage Examples

### Example 1: Quarterly Maintenance
```
MaintenanceFrequency: Quarterly
MaintenanceStartingDate: 2024-03-01
```
*Means maintenance every 3 months starting March 1, 2024*

### Example 2: Monthly Maintenance
```
MaintenanceFrequency: Monthly
MaintenanceStartingDate: 2024-01-15
```
*Means maintenance every month starting January 15, 2024*

### Example 3: Custom Interval
```
MaintenanceFrequency: 5 Months
MaintenanceStartingDate: 2024-02-01
```
*Means maintenance every 5 months starting February 1, 2024*

### Example 4: 15 Days Interval
```
MaintenanceFrequency: 15 Days
MaintenanceStartingDate: 2024-01-01
```
*Means maintenance every 15 days starting January 1, 2024*

### Example 5: No Maintenance Schedule
```
MaintenanceFrequency: (empty)
MaintenanceStartingDate: (empty)
```
*No maintenance schedule defined*

---

## Database Impact

### Schema Updated:
- ✅ 2 new fields added to RMUMaster collection
- ✅ Both fields are optional (not required)
- ✅ MaintenanceFrequency has enum validation

### Existing Records:
- Will have empty/null values for new fields
- No migration needed (optional fields)
- Can be updated via edit or re-upload

---

## Preview Table Updated

### Columns Shown (6):
1. Site Code
2. HRN
3. Circle
4. Division
5. Equipment Type (with blue badge)
6. Maintenance Freq. ← NEW

*Note: Shows first 10 valid rows*

---

## Dropdown Implementation

### Excel Dropdown Features:
- ✅ Cell dropdown in Column J (MaintenanceFrequency)
- ✅ 13 predefined options
- ✅ Optional (can leave empty)
- ✅ Prevents typing errors
- ✅ User-friendly selection

### Dropdown Values Order:
1. Monthly
2. Quarterly
3. Half-Yearly
4. Yearly
5. 2 Months
6. 4 Months
7. 5 Months
8. 7 Months
9. 8 Months
10. 9 Months
11. 10 Months
12. 11 Months
13. 15 Days

---

## Benefits

1. **Maintenance Scheduling** - Plan maintenance activities
2. **Frequency Flexibility** - Multiple interval options
3. **Starting Date Tracking** - Know when to begin
4. **Compliance** - Track regulatory requirements
5. **Resource Planning** - Allocate maintenance resources

---

## Use Cases

### Use Case 1: Regular Quarterly Inspection
```
Frequency: Quarterly
Starting Date: 2024-04-01
→ Maintenance due: Apr 1, Jul 1, Oct 1, Jan 1
```

### Use Case 2: Annual Major Maintenance
```
Frequency: Yearly
Starting Date: 2024-12-15
→ Maintenance due: Every December 15
```

### Use Case 3: Short Interval Critical Equipment
```
Frequency: 15 Days
Starting Date: 2024-01-01
→ Maintenance due: Every 15 days from Jan 1
```

### Use Case 4: Custom 5-Month Cycle
```
Frequency: 5 Months
Starting Date: 2024-03-01
→ Maintenance due: Mar, Aug, Jan (next year)
```

---

## Testing Status

✅ **No linter errors**  
✅ Model updated with new fields  
✅ Controller updated with dropdown and parsing  
✅ Frontend interface updated  
✅ Template generation updated  
✅ Validation logic added  
✅ Sample data includes new fields  

---

## Next Steps

1. **Restart backend** (to load updated model)
2. **Download new template** (with 14 columns)
3. **Test maintenance fields**:
   - Select from dropdown
   - Enter starting date
   - Upload and verify

---

## Summary

### Template Changes:
- **Columns:** 12 → 14 (+2)
- **Dropdowns:** 2 (Equipment Type, Maintenance Frequency)
- **Mandatory Fields:** Still 5 (no change)
- **Optional Fields:** +2 (Maintenance Frequency & Starting Date)

### Maintenance Frequency Options:
- **Total:** 13 options
- **Standard:** 4 (Monthly, Quarterly, Half-Yearly, Yearly)
- **Custom Months:** 8 (2, 4, 5, 7, 8, 9, 10, 11 months)
- **Special:** 1 (15 Days)

---

## Status

✅ **Maintenance Fields Successfully Added**  
✅ **No Errors**  
✅ **Ready to Use**

**Date:** January 6, 2025  
**New Fields:** 2  
**Total Columns:** 14  
**Status:** Complete

