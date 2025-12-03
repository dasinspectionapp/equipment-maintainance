import Location from '../models/Location.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads/kml directory exists
const kmlDir = path.join(__dirname, '..', 'uploads', 'kml');
if (!fs.existsSync(kmlDir)) {
  fs.mkdirSync(kmlDir, { recursive: true });
}

// Helper function to normalize column names (case-insensitive)
function normalizeColumnName(colName) {
  return colName ? colName.trim().toLowerCase().replace(/[^a-z0-9]/g, '') : '';
}

// Convert locations array to KML format
function generateKML(locations) {
  const kmlHeader = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Locations</name>
`;

  const placemarks = locations.map(loc => {
    const name = (loc.name || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const description = (loc.description || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const longitude = loc.longitude || 0;
    const latitude = loc.latitude || 0;
    
    return `    <Placemark>
      <name>${name}</name>
      <description>${description}</description>
      <Point>
        <coordinates>${longitude},${latitude},0</coordinates>
      </Point>
    </Placemark>`;
  }).join('\n');

  const kmlFooter = `  </Document>
</kml>`;

  return kmlHeader + placemarks + '\n' + kmlFooter;
}

// @desc    Upload Excel file and process locations
// @route   POST /api/admin/upload-excel
// @access  Admin only
export const uploadExcel = async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const file = Array.isArray(req.files.file) ? req.files.file[0] : req.files.file;
    const fileExtension = path.extname(file.name).toLowerCase();

    // Validate file type
    if (fileExtension !== '.xlsx' && fileExtension !== '.xls') {
      return res.status(400).json({
        success: false,
        error: 'Invalid file type. Only .xlsx and .xls files are allowed'
      });
    }

    // Validate MIME type
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel' // .xls
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file type. Only Excel files are allowed'
      });
    }

    // Save uploaded file temporarily
    const tempDir = path.join(__dirname, '..', 'uploads', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFilePath = path.join(tempDir, `temp-${Date.now()}-${file.name}`);
    await file.mv(tempFilePath);

    try {
      // Read Excel file
      const workbook = XLSX.readFile(tempFilePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

      if (data.length < 2) {
        throw new Error('Excel file must contain at least a header row and one data row');
      }

      // Get headers from first row
      const headers = data[0].map(h => h ? String(h).trim() : '');
      const normalizedHeaders = headers.map(h => normalizeColumnName(h));

      // Find column indices (case-insensitive)
      // Name can be "Name" or "Site Code"
      const nameIdx = normalizedHeaders.findIndex(h => h === 'name' || h === 'sitecode');
      const latitudeIdx = normalizedHeaders.findIndex(h => h === 'latitude');
      const longitudeIdx = normalizedHeaders.findIndex(h => h === 'longitude');
      // Description can be "Description" or "HRN"
      const descriptionIdx = normalizedHeaders.findIndex(h => h === 'description' || h === 'hrn');

      // Validate required columns
      if (nameIdx === -1) {
        throw new Error('Required column "Name" or "Site Code" not found in Excel file');
      }
      if (latitudeIdx === -1) {
        throw new Error('Required column "Latitude" not found in Excel file');
      }
      if (longitudeIdx === -1) {
        throw new Error('Required column "Longitude" not found in Excel file');
      }

      // Process rows
      const locations = [];
      const errors = [];
      let processedCount = 0;
      let updatedCount = 0;
      let insertedCount = 0;

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        
        // Skip empty rows
        if (!row || row.length === 0 || (row[nameIdx] === null || row[nameIdx] === undefined || String(row[nameIdx]).trim() === '')) {
          continue;
        }

        try {
          const name = String(row[nameIdx] || '').trim().toUpperCase();
          const latitude = parseFloat(row[latitudeIdx]);
          const longitude = parseFloat(row[longitudeIdx]);
          const description = descriptionIdx !== -1 ? String(row[descriptionIdx] || '').trim() : '';

          // Validate data
          if (!name) {
            errors.push(`Row ${i + 1}: Name is required`);
            continue;
          }

          if (isNaN(latitude) || latitude < -90 || latitude > 90) {
            errors.push(`Row ${i + 1}: Invalid latitude value`);
            continue;
          }

          if (isNaN(longitude) || longitude < -180 || longitude > 180) {
            errors.push(`Row ${i + 1}: Invalid longitude value`);
            continue;
          }

          locations.push({
            name,
            latitude,
            longitude,
            description
          });

          // Upsert to database
          const existing = await Location.findOne({ name });
          if (existing) {
            await Location.findOneAndUpdate(
              { name },
              {
                latitude,
                longitude,
                description,
                updatedAt: new Date()
              }
            );
            updatedCount++;
          } else {
            await Location.create({
              name,
              latitude,
              longitude,
              description
            });
            insertedCount++;
          }

          processedCount++;
        } catch (rowError) {
          errors.push(`Row ${i + 1}: ${rowError.message || 'Error processing row'}`);
        }
      }

      if (locations.length === 0) {
        throw new Error('No valid location data found in Excel file');
      }

      // Generate KML file
      const kmlContent = generateKML(locations);
      const kmlFileName = `locations-${Date.now()}.kml`;
      const kmlFilePath = path.join(kmlDir, kmlFileName);
      fs.writeFileSync(kmlFilePath, kmlContent, 'utf8');

      // Update all locations with KML file path
      const relativeKmlPath = `uploads/kml/${kmlFileName}`;
      await Location.updateMany(
        { name: { $in: locations.map(l => l.name) } },
        { kmlFilePath: relativeKmlPath }
      );

      // Clean up temp file
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }

      res.json({
        success: true,
        message: `Successfully processed ${processedCount} location(s)`,
        data: {
          processed: processedCount,
          inserted: insertedCount,
          updated: updatedCount,
          errors: errors.length > 0 ? errors : undefined,
          kmlFilePath: relativeKmlPath,
          locations: locations.length
        }
      });
    } catch (parseError) {
      // Clean up temp file on error
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      throw parseError;
    }
  } catch (error) {
    console.error('Error uploading Excel file:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process Excel file'
    });
  }
};

// @desc    Get all locations
// @route   GET /api/admin/locations
// @access  Admin only
export const getAllLocations = async (req, res) => {
  try {
    const locations = await Location.find({})
      .sort({ name: 1 })
      .lean();

    res.json({
      success: true,
      locations
    });
  } catch (error) {
    console.error('Error fetching locations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch locations'
    });
  }
};

// Helper function to extract content from CDATA (used by multiple functions)
function extractFromCDATA(text) {
  if (!text) return '';
  
  // Handle CDATA wrapper: <![CDATA[...]]>
  const cdataMatch = text.match(/<!\[CDATA\[(.*?)\]\]>/s);
  if (cdataMatch) {
    return cdataMatch[1].trim();
  }
  
  // Handle HTML-encoded CDATA: &lt;![CDATA[...]]&gt;
  const encodedCdataMatch = text.match(/&lt;!\[CDATA\[(.*?)\]\]&gt;/s);
  if (encodedCdataMatch) {
    return encodedCdataMatch[1].trim();
  }
  
  return text.trim();
}

// @desc    Get locations by site codes (for Equipment users)
// @route   POST /api/locations/by-site-codes
// @access  Authenticated users (Equipment, Admin, etc.)
export const getLocationsBySiteCodes = async (req, res) => {
  try {
    console.log('getLocationsBySiteCodes called with body:', req.body);
    const { siteCodes } = req.body;

    if (!siteCodes || !Array.isArray(siteCodes) || siteCodes.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'siteCodes array is required'
      });
    }

    // Normalize site codes for case-insensitive matching
    const normalizedSiteCodes = siteCodes.map(code => String(code).trim().toUpperCase());
    console.log('Normalized site codes:', normalizedSiteCodes);
    
    // Build query to match site codes - handle both plain and CDATA-wrapped names
    // Some entries might have CDATA wrapper: "<![CDATA[3W1575]]>"
    const queryConditions = normalizedSiteCodes.map(code => ({
      $or: [
        { name: code },
        { name: `<![CDATA[${code}]]>` },
        { name: { $regex: new RegExp(`^<!\\[CDATA\\[${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]\\]>$`, 'i') } }
      ]
    }));
    
    // Find locations where name matches any of the provided site codes (case-insensitive)
    const locations = await Location.find({
      $or: queryConditions
    })
      .select('name latitude longitude description')
      .lean();
    
    // Clean up CDATA wrappers from names in the results
    const cleanedLocations = locations.map(loc => ({
      ...loc,
      name: extractFromCDATA(loc.name || '').toUpperCase() || loc.name
    }));

    console.log(`Found ${cleanedLocations.length} locations for ${normalizedSiteCodes.length} site codes`);
    console.log('Locations:', cleanedLocations);

    res.json({
      success: true,
      locations: cleanedLocations
    });
  } catch (error) {
    console.error('Error fetching locations by site codes:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch locations'
    });
  }
};

// Helper function to extract Site Code from description HTML (Earth Point format)
function extractSiteCodeFromDescription(description) {
  if (!description) return '';
  
  let decodedDescription = extractFromCDATA(description);
  
  // Parse HTML table to extract Site Code
  // Earth Point format: <table><tr><td><b>Site Code</b></td><td>3W1575</td></tr>...
  // Or if Name column: <table><tr><td colspan='2'><b>3W1575</b></td></tr>...
  const siteCodePatterns = [
    /<b>Site\s+Code<\/b><\/td>\s*<td[^>]*>([^<]+)<\/td>/i,
    /Site\s+Code[^<]*<\/td>\s*<td[^>]*>([^<]+)<\/td>/i,
    /<td[^>]*colspan[^>]*><b>([^<]+)<\/b><\/td>/i, // Name in colspan header
    /<b>([A-Z0-9]+)<\/b>/i // Simple bold tag (fallback)
  ];
  
  for (const pattern of siteCodePatterns) {
    const match = decodedDescription.match(pattern);
    if (match && match[1]) {
      const siteCode = match[1].trim();
      // Validate it looks like a site code (alphanumeric, reasonable length)
      if (siteCode && siteCode.length > 0 && siteCode.length < 50) {
        return siteCode;
      }
    }
  }
  
  return '';
}

// Helper function to parse KML and extract locations using regex
function parseKMLFile(kmlText) {
  const locations = [];
  
  // Remove XML namespaces and normalize
  const normalizedKml = kmlText.replace(/xmlns[^=]*="[^"]*"/gi, '');
  
  // Find all Placemark elements using regex
  const placemarkRegex = /<Placemark[^>]*>([\s\S]*?)<\/Placemark>/gi;
  let placemarkMatch;
  
  while ((placemarkMatch = placemarkRegex.exec(normalizedKml)) !== null) {
    const placemarkContent = placemarkMatch[1];
    
    // Extract name (Site Code) - handle CDATA
    const nameMatch = placemarkContent.match(/<name[^>]*>([\s\S]*?)<\/name>/i);
    let name = nameMatch && nameMatch[1] ? nameMatch[1].trim() : '';
    name = extractFromCDATA(name); // Remove CDATA wrapper
    
    // Extract description (HRN) - handle CDATA
    const descriptionMatch = placemarkContent.match(/<description[^>]*>([\s\S]*?)<\/description>/i);
    let description = descriptionMatch && descriptionMatch[1] ? descriptionMatch[1].trim() : '';
    description = extractFromCDATA(description); // Remove CDATA wrapper
    
    // If name is empty or looks like "ROW: X", try to extract from description
    if (!name || name.match(/^ROW:\s*\d+$/i)) {
      const siteCodeFromDesc = extractSiteCodeFromDescription(description);
      if (siteCodeFromDesc) {
        name = siteCodeFromDesc;
      }
    }
    
    // Extract coordinates - try to find in <coordinates> tag
    let coordText = '';
    const coordMatch = placemarkContent.match(/<coordinates[^>]*>([\s\S]*?)<\/coordinates>/i);
    if (coordMatch && coordMatch[1]) {
      coordText = coordMatch[1].trim();
    }
    
    if (name && coordText) {
      // Parse: longitude,latitude,altitude (altitude is optional)
      // Handle multiple coordinates (space-separated) - take the first one
      const firstCoord = coordText.split(/\s+/)[0];
      const parts = firstCoord.split(',');
      
      if (parts.length >= 2) {
        const longitude = parseFloat(parts[0].trim());
        const latitude = parseFloat(parts[1].trim());
        
        if (!isNaN(latitude) && !isNaN(longitude) && 
            latitude >= -90 && latitude <= 90 && 
            longitude >= -180 && longitude <= 180) {
          // Clean up name - remove any remaining CDATA markers or HTML
          const cleanName = name.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&lt;!\[CDATA\[|&gt;/g, '').trim();
          
          locations.push({
            name: cleanName.toUpperCase(),
            latitude,
            longitude,
            description: description || ''
          });
        }
      }
    }
  }
  
  return locations;
}

// @desc    Upload KML file and process locations
// @route   POST /api/admin/upload-kml
// @access  Admin only
export const uploadKML = async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const file = Array.isArray(req.files.file) ? req.files.file[0] : req.files.file;
    const fileExtension = path.extname(file.name).toLowerCase();

    // Validate file type
    if (fileExtension !== '.kml') {
      return res.status(400).json({
        success: false,
        error: 'Invalid file type. Only .kml files are allowed'
      });
    }

    // Validate MIME type
    const allowedTypes = [
      'application/vnd.google-earth.kml+xml',
      'application/xml',
      'text/xml',
      'text/plain'
    ];

    if (!allowedTypes.includes(file.mimetype) && file.mimetype !== 'application/octet-stream') {
      // Allow application/octet-stream as some systems may not set proper MIME type
      console.warn(`Unexpected MIME type: ${file.mimetype}, but allowing .kml extension`);
    }

    // Read KML file content
    const kmlText = file.data.toString('utf8');

    // Parse KML file
    let locations;
    try {
      locations = parseKMLFile(kmlText);
    } catch (parseError) {
      return res.status(400).json({
        success: false,
        error: `Failed to parse KML file: ${parseError.message}`
      });
    }

    if (locations.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid location data found in KML file. Ensure the file contains Placemark elements with name and coordinates.'
      });
    }

    // Process locations: upsert to database
    const errors = [];
    let processedCount = 0;
    let updatedCount = 0;
    let insertedCount = 0;

    for (const loc of locations) {
      try {
        const existing = await Location.findOne({ name: loc.name });
        if (existing) {
          await Location.findOneAndUpdate(
            { name: loc.name },
            {
              latitude: loc.latitude,
              longitude: loc.longitude,
              description: loc.description,
              updatedAt: new Date()
            }
          );
          updatedCount++;
        } else {
          await Location.create({
            name: loc.name,
            latitude: loc.latitude,
            longitude: loc.longitude,
            description: loc.description
          });
          insertedCount++;
        }
        processedCount++;
      } catch (rowError) {
        errors.push(`${loc.name}: ${rowError.message || 'Error processing location'}`);
      }
    }

    // Generate KML file from processed locations (for consistency)
    const kmlContent = generateKML(locations);
    const kmlFileName = `locations-${Date.now()}.kml`;
    const kmlFilePath = path.join(kmlDir, kmlFileName);
    fs.writeFileSync(kmlFilePath, kmlContent, 'utf8');

    // Update all locations with KML file path
    const relativeKmlPath = `uploads/kml/${kmlFileName}`;
    await Location.updateMany(
      { name: { $in: locations.map(l => l.name) } },
      { kmlFilePath: relativeKmlPath }
    );

    res.json({
      success: true,
      message: `Successfully processed ${processedCount} location(s)`,
      data: {
        processed: processedCount,
        inserted: insertedCount,
        updated: updatedCount,
        errors: errors.length > 0 ? errors : undefined,
        kmlFilePath: relativeKmlPath,
        locations: locations.length
      }
    });
  } catch (error) {
    console.error('Error uploading KML file:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process KML file'
    });
  }
};

// @desc    Upload temporary KML file for navigation
// @route   POST /api/locations/temp-kml
// @access  Authenticated users
export const uploadTempKML = async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const file = Array.isArray(req.files.file) ? req.files.file[0] : req.files.file;
    const fileExtension = path.extname(file.name).toLowerCase();

    // Validate file type
    if (fileExtension !== '.kml') {
      return res.status(400).json({
        success: false,
        error: 'Invalid file type. Only .kml files are allowed'
      });
    }

    // Save to temp directory
    const tempDir = path.join(__dirname, '..', 'uploads', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const timestamp = Date.now();
    const fileName = `navigate-${timestamp}.kml`;
    const filePath = path.join(tempDir, fileName);

    // Move file to temp directory
    await file.mv(filePath);

    // Return URL that can be accessed via API endpoint (for proper Content-Type headers)
    const kmlUrl = `http://localhost:5000/api/locations/temp-kml/${fileName}`;

    // Schedule cleanup after 1 hour
    setTimeout(() => {
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (cleanupError) {
          console.warn('Error cleaning up temp KML file:', cleanupError);
        }
      }
    }, 3600000); // 1 hour

    res.json({
      success: true,
      kmlUrl,
      url: kmlUrl
    });
  } catch (error) {
    console.error('Error uploading temporary KML file:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload temporary KML file'
    });
  }
};

// @desc    Get temporary KML file for navigation
// @route   GET /api/locations/temp-kml/:fileName
// @access  Authenticated users
export const getTempKML = async (req, res) => {
  try {
    const { fileName } = req.params;
    
    // Validate filename to prevent directory traversal
    if (!fileName || fileName.includes('..') || !fileName.endsWith('.kml')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file name'
      });
    }

    const tempDir = path.join(__dirname, '..', 'uploads', 'temp');
    const filePath = path.join(tempDir, fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    // Set proper headers to trigger Google Earth and prevent caching
    res.setHeader('Content-Type', 'application/vnd.google-earth.kml+xml');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Send the file
    res.sendFile(path.resolve(filePath));
  } catch (error) {
    console.error('Error getting temporary KML file:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get temporary KML file'
    });
  }
};

