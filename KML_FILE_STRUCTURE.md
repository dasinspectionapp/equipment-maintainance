# KML File Structure and Excel Format

## Excel File Format (for Location Upload)

When uploading an Excel file through the Location Management in Admin panel, the file should have the following column headers:

### Required Columns:
1. **Name** (or **Site Code**) - The site code identifier (e.g., "3W1575", "3W1579")
2. **Latitude** - Latitude coordinate (e.g., 12.9204224)
3. **Longitude** - Longitude coordinate (e.g., 77.6208384)

### Optional Columns:
4. **Description** (or **HRN**) - HRN information (e.g., "Near Summanahalli muss")

### Excel File Example:

| Name    | Latitude   | Longitude  | Description              |
|---------|------------|------------|--------------------------|
| 3W1575  | 12.9204224 | 77.6208384 | Near Summanahalli muss   |
| 3W1579  | 12.9204224 | 77.6208384 | Near Summanahalli muss   |
| LB0744  | 12.9204224 | 77.6208384 | Near Summanahalli muss   |

**Note:** Column names are case-insensitive. You can use:
- "Name" or "Site Code" for the name column
- "Description" or "HRN" for the description column

---

## KML File Structure (if uploading KML directly)

If you're uploading a KML file directly through Admin Uploads, it should follow this structure:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Locations</name>
    
    <Placemark>
      <name>3W1575</name>
      <description>Near Summanahalli muss</description>
      <Point>
        <coordinates>77.6208384,12.9204224,0</coordinates>
      </Point>
    </Placemark>
    
    <Placemark>
      <name>3W1579</name>
      <description>Near Summanahalli muss</description>
      <Point>
        <coordinates>77.6208384,12.9204224,0</coordinates>
      </Point>
    </Placemark>
    
  </Document>
</kml>
```

### Important Notes for KML Files:
1. **`<name>`** = Site Code (e.g., "3W1575", "3W1579")
2. **`<description>`** = HRN information
3. **`<coordinates>`** = Format: **longitude,latitude,altitude** (e.g., "77.6208384,12.9204224,0")
   - **Order is important**: longitude comes first, then latitude
   - Altitude is optional (can be 0)

### KML File Structure Breakdown:
- Each location is wrapped in a `<Placemark>` element
- `<name>` contains the Site Code
- `<description>` contains the HRN
- `<Point><coordinates>` contains longitude,latitude,altitude

---

## How to Use:

### Option 1: Upload Excel File (Recommended)
1. Create an Excel file with columns: **Name** (or Site Code), **Latitude**, **Longitude**, **Description** (or HRN)
2. Go to Admin Panel → Location Management
3. Upload the Excel file
4. The system will automatically convert it to KML format

### Option 2: Upload KML File Directly
1. Create a KML file following the structure above
2. Go to Admin Panel → Admin Uploads
3. Create a field for KML/Location files
4. Upload the KML file
5. The system will use it directly

---

## Troubleshooting:

If site codes are not found:
1. Ensure Site Codes in KML `<name>` tags match exactly with the site codes in your table
2. Check for extra spaces or case differences
3. Verify coordinates are in correct format: longitude,latitude,altitude
4. Check browser console for detailed parsing logs


