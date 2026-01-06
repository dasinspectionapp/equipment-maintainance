# Agency Master - Quick Reference Card

## 📍 Access Location
**Menu:** Admin Panel → MASTERS → Agency Master

## 🔗 Routes
- **List:** `/dashboard/agency-master`
- **Create:** `/dashboard/agency-master/create`
- **Edit:** `/dashboard/agency-master/edit/:id`
- **View:** `/dashboard/agency-master/view/:id`

## 🔌 API Endpoints
```
POST   /api/masters/agencies              - Create
GET    /api/masters/agencies              - List (pagination)
GET    /api/masters/agencies/:id          - Get by ID
PUT    /api/masters/agencies/:id          - Update
PATCH  /api/masters/agencies/:id/status   - Toggle status
DELETE /api/masters/agencies/:id          - Delete
GET    /api/masters/agencies/sites/all    - Get sites
POST   /api/masters/agencies/check-expiry - Check expiry
```

## ⚙️ Required Fields
- Agency Name *
- Agency Code * (unique, uppercase)
- Agency Type * (AMC/Vendor/OEM)
- Contact Person *
- Mobile Number * (10 digits)
- Email * (valid format)
- AMC Start Date *
- AMC End Date * (> Start Date)
- Scope of Work * (Routine/Breakdown/Both)

## 🔐 Validation Rules
1. Agency Code must be unique
2. End Date > Start Date
3. Mobile: exactly 10 digits
4. Email: valid format

## 📧 Email Notifications
- On creation
- On status change
- On AMC expiry

## 🎯 Key Features
✅ Search by name/code  
✅ Filter by status/type  
✅ Pagination  
✅ Enable/Disable  
✅ Soft delete  
✅ Multi-site mapping  
✅ AMC tracking  
✅ Access control  

## 🚀 Quick Actions
| Action | Button | Location |
|--------|--------|----------|
| Create | + Add New Agency | Top right |
| Edit | Edit | Actions column |
| View | View | Actions column |
| Enable/Disable | Enable/Disable | Actions column |
| Delete | Delete | Actions column |

## 💾 Database
**Collection:** `AgencyMaster`  
**Indexes:** 6 (agencyCode, status, agencyType, circles, divisions, isDeleted)  
**Soft Delete:** Yes (isDeleted field)

## 📊 List Columns
1. Agency Code
2. Agency Name (+ Contact Person)
3. Type (AMC/Vendor/OEM)
4. Circles
5. AMC Validity
6. Status (Active/Inactive)
7. Actions

## 🛠️ Form Sections
1. **Agency Details** - Name, Code, Type, Status
2. **Contact Information** - Person, Mobile, Email, Alternate
3. **Area Mapping** - Circles, Divisions, Equipment
4. **Contract Details** - AMC Dates, Scope

## 🔍 Troubleshooting
| Error | Solution |
|-------|----------|
| Code already exists | Use unique code |
| Email not sent | Check Email Config |

## 📱 Files Modified/Created
**Backend (4 files):**
- `server/models/AgencyMaster.js`
- `server/controllers/agencyController.js`
- `server/routes/agencyRoutes.js`
- `server/server.js`

**Frontend (4 files):**
- `src/pages/AgencyMasterList.tsx`
- `src/pages/AgencyMasterForm.tsx`
- `src/App.tsx`
- `src/components/DashboardLayout.tsx`

## 📖 Documentation
1. `AGENCY_MASTER_IMPLEMENTATION.md` - Full guide
2. `AGENCY_MASTER_SETUP.md` - Testing guide
3. `AGENCY_MASTER_SUMMARY.md` - Executive summary
4. `QUICK_REFERENCE.md` - This card

## ✅ Status: PRODUCTION READY
All features implemented and tested!

