import RMUInspection from '../models/RMUInspection.js';
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to parse date fields from form submissions
// Handles various date formats: Date objects, ISO strings, DD-MM-YYYY, etc.
function parseDateField(dateValue) {
  if (!dateValue) return null;
  
  try {
    // If it's already a Date object, return it
    if (dateValue instanceof Date) {
      if (!isNaN(dateValue.getTime())) {
        return dateValue;
      }
      return null;
    }
    
    // If it's a string, try parsing it
    if (typeof dateValue === 'string') {
      const trimmed = dateValue.trim();
      if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;
      
      // Try DD-MM-YYYY or DD/MM/YYYY format first (common in forms)
      const parts = trimmed.split(/[-\/\.]/);
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const year = parseInt(parts[2], 10);
        
        if (!isNaN(day) && !isNaN(month) && !isNaN(year) && 
            day > 0 && day <= 31 && month > 0 && month <= 12 && 
            year >= 1900 && year <= 2100) {
          const date = new Date(year, month - 1, day);
          if (!isNaN(date.getTime()) && 
              date.getFullYear() === year && 
              date.getMonth() === month - 1 && 
              date.getDate() === day) {
            return date;
          }
        }
      }
      
      // Try ISO format (YYYY-MM-DD)
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        const date = new Date(trimmed);
        if (!isNaN(date.getTime()) && date.getFullYear() >= 1900 && date.getFullYear() <= 2100) {
          return date;
        }
      }
      
      // Try parsing as general date string
      const date = new Date(trimmed);
      if (!isNaN(date.getTime()) && date.getFullYear() >= 1900 && date.getFullYear() <= 2100) {
        return date;
      }
    }
    
    // If it's a number, be very conservative - only treat as Excel serial if clearly in range
    if (typeof dateValue === 'number') {
      const numValue = dateValue;
      
      // If it looks like a year, don't convert
      if (numValue >= 1900 && numValue <= 2100) {
        console.warn(`parseDateField: Number ${numValue} looks like a year, not converting`);
        return null;
      }
      
      // Only convert if it's clearly an Excel serial date (36526-73050 for 2000-2100 dates)
      if (numValue >= 36526 && numValue <= 73050) {
        const date = new Date(1900, 0, numValue - 2);
        if (!isNaN(date.getTime()) && date.getFullYear() >= 1900 && date.getFullYear() <= 2100) {
          return date;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing date field:', error, dateValue);
    return null;
  }
}

/**
 * Create or update RMU Inspection based on Site Code
 * If Site Code exists, update the existing record
 * Otherwise, create a new record
 */
export const submitInspection = async (req, res) => {
  try {
    const { siteCode, ...inspectionData } = req.body;

    if (!siteCode) {
      return res.status(400).json({
        success: false,
        error: 'Site Code is required'
      });
    }

    // Extract terminal data and organize it properly
    const terminals = {};
    const terminalKeys = ['od1', 'od2', 'vl1', 'vl2', 'vl3'];
    
    terminalKeys.forEach(prefix => {
      const terminalData = {};
      const fields = [
        'cablesConnected', 'connectedTo', 'loadAmpsR', 'loadAmpsY', 'loadAmpsB',
        'switchPosition', 'onOffMotors', 'healthinessSwitch', 'breakerStatus',
        'cableEntryDoors', 'cableClamped', 'localRemoteSwitch', 'vpisIndication',
        'mfmWorking', 'relayWorking', 'rmuSide24Pin', 'cableSize',
        'electricalOperation', 'remoteOperation', 'cableICFromOrOGTo'
      ];

      fields.forEach(field => {
        const key = `${prefix}_${field}`;
        if (inspectionData[key] !== undefined && inspectionData[key] !== '') {
          terminalData[field] = inspectionData[key];
        }
      });

      if (Object.keys(terminalData).length > 0) {
        terminals[prefix] = terminalData;
      }
    });

    // Prepare the inspection document
    const inspectionDoc = {
      siteCode,
      circle: inspectionData.circle || '',
      division: inspectionData.division || '',
      subDivision: inspectionData.subDivision || '',
      om: inspectionData.om || '',
      dateOfCommission: parseDateField(inspectionData.dateOfCommission),
      feederNumberAndName: inspectionData.feederNumberAndName || '',
      inspectionDate: parseDateField(inspectionData.inspectionDate) || new Date(),
      rmuMakeType: inspectionData.rmuMakeType || '',
      locationHRN: inspectionData.locationHRN || '',
      serialNo: inspectionData.serialNo || '',
      latLong: inspectionData.latLong || '',
      warrantyStatus: inspectionData.warrantyStatus || '',
      coFeederName: inspectionData.coFeederName || '',
      previousAMCDate: parseDateField(inspectionData.previousAMCDate),
      mfmMake: inspectionData.mfmMake || '',
      relayMakeModelNo: inspectionData.relayMakeModelNo || '',
      fpiMakeModelNo: inspectionData.fpiMakeModelNo || '',
      rtuMakeSlno: inspectionData.rtuMakeSlno || '',
      rmuStatus: inspectionData.rmuStatus || '',
      availability24V: inspectionData.availability24V || '',
      ptVoltageAvailability: inspectionData.ptVoltageAvailability || '',
      batteryChargerCondition: inspectionData.batteryChargerCondition || '',
      earthingConnection: inspectionData.earthingConnection || '',
      commAccessoriesAvailability: inspectionData.commAccessoriesAvailability || '',
      relayGroupChange: inspectionData.relayGroupChange || '',
      fpiStatus: inspectionData.fpiStatus || '',
      availability12V: inspectionData.availability12V || '',
      overallWiringIssue: inspectionData.overallWiringIssue || '',
      controlCard: inspectionData.controlCard || '',
      beddingCondition: inspectionData.beddingCondition || '',
      batteryStatus: inspectionData.batteryStatus || '',
      relayGroupChangeUpdate: inspectionData.relayGroupChangeUpdate || '',
      availability230V: inspectionData.availability230V || '',
      sf6Gas: inspectionData.sf6Gas || '',
      rmuLocationSameAsGIS: inspectionData.rmuLocationSameAsGIS || '',
      doorHydraulics: inspectionData.doorHydraulics || '',
      controlCabinetDoor: inspectionData.controlCabinetDoor || '',
      doorGasket: inspectionData.doorGasket || '',
      dummyLatchCommand: inspectionData.dummyLatchCommand || '',
      terminals,
      cableICFromOrOGTo: inspectionData.cableICFromOrOGTo || '',
      remarks: inspectionData.remarks || '',
      images: inspectionData.images || [],
      video: inspectionData.video || null,
      pdfFile: inspectionData.pdfFile || null,
      submittedBy: req.user ? req.user._id : null
    };

    // Use findOneAndUpdate with upsert option
    const inspection = await RMUInspection.findOneAndUpdate(
      { siteCode },
      inspectionDoc,
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true
      }
    );

    res.status(200).json({
      success: true,
      message: inspection.createdAt.getTime() === inspection.updatedAt.getTime() 
        ? 'RMU Inspection submitted successfully' 
        : 'RMU Inspection updated successfully',
      data: inspection
    });
  } catch (error) {
    console.error('Submit inspection error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server error'
    });
  }
};

/**
 * Get all RMU Inspections
 */
export const getInspections = async (req, res) => {
  try {
    const inspections = await RMUInspection.find()
      .sort({ updatedAt: -1 })
      .populate('submittedBy', 'fullName userId email');

    res.status(200).json({
      success: true,
      count: inspections.length,
      data: inspections
    });
  } catch (error) {
    console.error('Get inspections error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server error'
    });
  }
};

/**
 * Get single RMU Inspection by Site Code
 */
export const getInspectionBySiteCode = async (req, res) => {
  try {
    const { siteCode } = req.params;

    const inspection = await RMUInspection.findOne({ siteCode })
      .populate('submittedBy', 'fullName userId email');

    if (!inspection) {
      return res.status(404).json({
        success: false,
        error: 'Inspection not found for this Site Code'
      });
    }

    res.status(200).json({
      success: true,
      data: inspection
    });
  } catch (error) {
    console.error('Get inspection error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server error'
    });
  }
};

/**
 * Get unique values for a specific field (for autocomplete)
 */
export const getFieldAutocomplete = async (req, res) => {
  try {
    const { field } = req.query;

    console.log('Autocomplete request - field:', field, 'type:', typeof field);

    if (!field) {
      return res.status(400).json({
        success: false,
        error: 'Field name is required'
      });
    }

    // Clean the field name - remove any unwanted characters like ':1'
    const cleanField = String(field).split(':')[0].trim();

    console.log('Cleaned field name:', cleanField);

    // List of allowed fields for autocomplete
    const allowedFields = [
      'siteCode', 'circle', 'division', 'subDivision', 'om', 
      'feederNumberAndName', 'rmuMakeType', 'locationHRN', 'serialNo',
      'latLong', 'warrantyStatus', 'coFeederName', 'mfmMake',
      'relayMakeModelNo', 'fpiMakeModelNo', 'rtuMakeSlno',
      'relayGroupChange', 'relayGroupChangeUpdate', 'cableICFromOrOGTo'
    ];

    // Terminal fields pattern: od1_connectedTo, vl1_cableSize, etc.
    const terminalFieldsPattern = /^(od1|od2|vl1|vl2|vl3)_(connectedTo|cableSize|loadAmpsR|loadAmpsY|loadAmpsB)$/;

    // Check if field is in allowed list or matches terminal pattern
    const isAllowedField = allowedFields.includes(cleanField);
    const isTerminalField = terminalFieldsPattern.test(cleanField);
    
    if (!isAllowedField && !isTerminalField) {
      console.error('Field not allowed:', cleanField);
      return res.status(400).json({
        success: false,
        error: `Field '${cleanField}' not allowed for autocomplete`
      });
    }

    console.log('Fetching distinct values for field:', cleanField);
    
    // Build query to get distinct non-empty values
    const query = { [cleanField]: { $exists: true, $ne: '', $ne: null } };
    
    // Special handling for nested terminal fields
    let values = [];
    if (cleanField.includes('_')) {
      // Handle terminal fields like od1_connectedTo, vl1_cableSize, etc.
      const [terminalPrefix, terminalField] = cleanField.split('_');
      const inspections = await RMUInspection.find({
        [`terminals.${terminalPrefix}.${terminalField}`]: { $exists: true, $ne: '', $ne: null }
      }).select(`terminals.${terminalPrefix}.${terminalField}`);
      
      values = inspections
        .map(insp => insp.terminals?.[terminalPrefix]?.[terminalField])
        .filter(val => val && String(val).trim() !== '')
        .map(val => String(val).trim());
    } else {
      // Regular field - use distinct for better performance
      try {
        values = await RMUInspection.distinct(cleanField, query);
      } catch (distinctError) {
        console.error('Distinct query error, trying find:', distinctError.message);
        // Fallback: use find and extract unique values
        const inspections = await RMUInspection.find(query).select(cleanField);
        values = inspections
          .map(insp => insp[cleanField])
          .filter(val => val !== null && val !== undefined && String(val).trim() !== '')
          .map(val => String(val).trim());
      }
    }

    // Filter out empty strings, null, undefined and trim whitespace
    values = values
      .filter(val => val !== null && val !== undefined && val !== '' && String(val).trim() !== '')
      .map(val => String(val).trim())
      .filter((val, index, self) => self.indexOf(val) === index) // Remove duplicates
      .sort(); // Sort alphabetically

    console.log(`Found ${values.length} unique values for field '${cleanField}'`);

    res.status(200).json({
      success: true,
      field: cleanField,
      count: values.length,
      values
    });
  } catch (error) {
    console.error('Get field autocomplete error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Server error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * Download Survey Form Excel Template
 * @route GET /api/inspections/template
 * @access Admin only
 */
export const downloadTemplate = async (req, res) => {
  try {
    const workbook = XLSX.utils.book_new();

    const headers = [
      // Basic Information
      'Site Code',
      'Circle',
      'Division',
      'Sub Division',
      'OM',
      'Date of Commission',
      'Feeder Number and Name',
      'Inspection Date',
      'RMU Make Type',
      'Location HRN',
      'Serial No',
      'Lat Long',
      'Warranty Status',
      'CO Feeder Name',
      
      // Additional Details
      'Previous AMC Date',
      'MFM Make',
      'Relay Make Model No',
      'FPI Make Model No',
      'RTU Make SL No',
      
      // Status Fields
      'RMU Status',
      'Availability 24V',
      'PT Voltage Availability',
      'Battery Charger Condition',
      'Earthing Connection',
      'Comm Accessories Availability',
      'Relay Group Change',
      'FPI Status',
      'Availability 12V',
      'Overall Wiring Issue',
      'Control Card',
      'Bedding Condition',
      'Battery Status',
      'Relay Group Change Update',
      'Availability 230V',
      'SF6 Gas',
      'RMU Location Same as GIS',
      'Door Hydraulics',
      'Control Cabinet Door',
      'Door Gasket',
      'Dummy Latch Command',
      
      // Terminal Fields - Format: "Field Name - OD1", "Field Name - OD2", etc.
      'Cables Connected - OD1', 'Cables Connected - OD2', 'Cables Connected - VL1', 'Cables Connected - VL2', 'Cables Connected - VL3',
      'Connected To - OD1', 'Connected To - OD2', 'Connected To - VL1', 'Connected To - VL2', 'Connected To - VL3',
      'Load Amps R - OD1', 'Load Amps R - OD2', 'Load Amps R - VL1', 'Load Amps R - VL2', 'Load Amps R - VL3',
      'Load Amps Y - OD1', 'Load Amps Y - OD2', 'Load Amps Y - VL1', 'Load Amps Y - VL2', 'Load Amps Y - VL3',
      'Load Amps B - OD1', 'Load Amps B - OD2', 'Load Amps B - VL1', 'Load Amps B - VL2', 'Load Amps B - VL3',
      'Switch Position - OD1', 'Switch Position - OD2', 'Switch Position - VL1', 'Switch Position - VL2', 'Switch Position - VL3',
      'On Off Motors - OD1', 'On Off Motors - OD2', 'On Off Motors - VL1', 'On Off Motors - VL2', 'On Off Motors - VL3',
      'Healthiness Switch - OD1', 'Healthiness Switch - OD2', 'Healthiness Switch - VL1', 'Healthiness Switch - VL2', 'Healthiness Switch - VL3',
      'Breaker Status - OD1', 'Breaker Status - OD2', 'Breaker Status - VL1', 'Breaker Status - VL2', 'Breaker Status - VL3',
      'Cable Entry Doors - OD1', 'Cable Entry Doors - OD2', 'Cable Entry Doors - VL1', 'Cable Entry Doors - VL2', 'Cable Entry Doors - VL3',
      'Cable Clamped - OD1', 'Cable Clamped - OD2', 'Cable Clamped - VL1', 'Cable Clamped - VL2', 'Cable Clamped - VL3',
      'Local Remote Switch - OD1', 'Local Remote Switch - OD2', 'Local Remote Switch - VL1', 'Local Remote Switch - VL2', 'Local Remote Switch - VL3',
      'VPIS Indication - OD1', 'VPIS Indication - OD2', 'VPIS Indication - VL1', 'VPIS Indication - VL2', 'VPIS Indication - VL3',
      'MFM Working - OD1', 'MFM Working - OD2', 'MFM Working - VL1', 'MFM Working - VL2', 'MFM Working - VL3',
      'Relay Working - OD1', 'Relay Working - OD2', 'Relay Working - VL1', 'Relay Working - VL2', 'Relay Working - VL3',
      'RMU Side 24 Pin - OD1', 'RMU Side 24 Pin - OD2', 'RMU Side 24 Pin - VL1', 'RMU Side 24 Pin - VL2', 'RMU Side 24 Pin - VL3',
      'Cable Size - OD1', 'Cable Size - OD2', 'Cable Size - VL1', 'Cable Size - VL2', 'Cable Size - VL3',
      'Electrical Operation - OD1', 'Electrical Operation - OD2', 'Electrical Operation - VL1', 'Electrical Operation - VL2', 'Electrical Operation - VL3',
      'Remote Operation - OD1', 'Remote Operation - OD2', 'Remote Operation - VL1', 'Remote Operation - VL2', 'Remote Operation - VL3',
      'Cable IC From or OG To - OD1', 'Cable IC From or OG To - OD2', 'Cable IC From or OG To - VL1', 'Cable IC From or OG To - VL2', 'Cable IC From or OG To - VL3',
      
      // Other Fields
      'Remarks'
    ];

    const worksheet = XLSX.utils.aoa_to_sheet([headers]);
    worksheet['!cols'] = headers.map(() => ({ wch: 25 }));
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Survey Form');

    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Survey_Form_Template.xlsx"');
    res.setHeader('Content-Length', excelBuffer.length);
    res.send(excelBuffer);
  } catch (error) {
    console.error('Template download error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate template'
    });
  }
};

/**
 * Mass upload inspections from Excel file
 * @route POST /api/inspections/mass-upload
 * @access Admin only
 */
export const massUploadInspections = async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const file = Array.isArray(req.files.file) ? req.files.file[0] : req.files.file;
    const fileExtension = path.extname(file.name).toLowerCase();

    if (fileExtension !== '.xlsx' && fileExtension !== '.xls') {
      return res.status(400).json({
        success: false,
        error: 'Invalid file type. Only .xlsx and .xls files are allowed'
      });
    }

    const tempDir = path.join(__dirname, '..', 'uploads', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFilePath = path.join(tempDir, `survey-${Date.now()}-${file.name}`);
    await file.mv(tempFilePath);

    try {
      const workbook = XLSX.readFile(tempFilePath, { cellDates: true, cellNF: false, cellText: false });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false, dateNF: 'yyyy-mm-dd' });

      if (data.length < 2) {
        throw new Error('Excel file must contain at least a header row and one data row');
      }

      const headers = data[0].map(h => h ? String(h).trim() : '');
      
      const normalizeColumnName = (name) => {
        return name.toLowerCase().replace(/\s+/g, ' ').trim().replace(/\s+/g, '');
      };

      const normalizedHeaders = headers.map(h => normalizeColumnName(h));

      const fieldMapping = {
        'sitecode': 'siteCode',
        'circle': 'circle',
        'division': 'division',
        'subdivision': 'subDivision',
        'om': 'om',
        'dateofcommission': 'dateOfCommission',
        'feedernumberandname': 'feederNumberAndName',
        'inspectiondate': 'inspectionDate',
        'rmumaketype': 'rmuMakeType',
        'locationhrn': 'locationHRN',
        'serialno': 'serialNo',
        'latlong': 'latLong',
        'warrantystatus': 'warrantyStatus',
        'cofeedername': 'coFeederName',
        'previousamcdate': 'previousAMCDate',
        'mfmmake': 'mfmMake',
        'relaymakemodelno': 'relayMakeModelNo',
        'fpimakemodelno': 'fpiMakeModelNo',
        'rtumakeslno': 'rtuMakeSlno',
        'rmustatus': 'rmuStatus',
        'availability24v': 'availability24V',
        'ptvoltageavailability': 'ptVoltageAvailability',
        'batterychargercondition': 'batteryChargerCondition',
        'earthingconnection': 'earthingConnection',
        'commaccessoriesavailability': 'commAccessoriesAvailability',
        'relaygroupchange': 'relayGroupChange',
        'fpistatus': 'fpiStatus',
        'availability12v': 'availability12V',
        'overallwiringissue': 'overallWiringIssue',
        'controlcard': 'controlCard',
        'beddingcondition': 'beddingCondition',
        'batterystatus': 'batteryStatus',
        'relaygroupchangeupdate': 'relayGroupChangeUpdate',
        'availability230v': 'availability230V',
        'sf6gas': 'sf6Gas',
        'rmulocationsameasgis': 'rmuLocationSameAsGIS',
        'doorhydraulics': 'doorHydraulics',
        'controlcabinetdoor': 'controlCabinetDoor',
        'doorgasket': 'doorGasket',
        'dummylatchcommand': 'dummyLatchCommand',
        'remarks': 'remarks',
      };

      const terminalFields = ['od1', 'od2', 'vl1', 'vl2', 'vl3'];
      const terminalFieldMappings = {
        'cablesconnected': 'cablesConnected',
        'connectedto': 'connectedTo',
        'loadampsr': 'loadAmpsR',
        'loadampsy': 'loadAmpsY',
        'loadampsb': 'loadAmpsB',
        'switchposition': 'switchPosition',
        'onoffmotors': 'onOffMotors',
        'healthinessswitch': 'healthinessSwitch',
        'breakerstatus': 'breakerStatus',
        'cableentrydoors': 'cableEntryDoors',
        'cableclamped': 'cableClamped',
        'localremoteswitch': 'localRemoteSwitch',
        'vpisindication': 'vpisIndication',
        'mfmworking': 'mfmWorking',
        'relayworking': 'relayWorking',
        'rmuside24pin': 'rmuSide24Pin',
        'cablesize': 'cableSize',
        'electricaloperation': 'electricalOperation',
        'remoteoperation': 'remoteOperation',
        'cableicfromorogto': 'cableICFromOrOGTo'
      };

      const columnMap = {};
      
      normalizedHeaders.forEach((normalized, index) => {
        if (fieldMapping[normalized]) {
          columnMap[fieldMapping[normalized]] = index;
        } else {
          for (const terminal of terminalFields) {
            if (normalized.endsWith(`-${terminal}`) || normalized.includes(`-${terminal}`)) {
              const fieldPart = normalized.replace(`-${terminal}`, '').replace(/-/g, '');
              for (const [pattern, dbFieldName] of Object.entries(terminalFieldMappings)) {
                if (fieldPart === pattern || fieldPart.includes(pattern)) {
                  const dbField = `${terminal}_${dbFieldName}`;
                  if (!columnMap[dbField]) {
                    columnMap[dbField] = index;
                  }
                  break;
                }
              }
            }
          }
        }
      });

      if (columnMap.siteCode === undefined) {
        throw new Error('Required column "Site Code" not found in Excel file');
      }

      const results = {
        totalRows: data.length - 1,
        successful: 0,
        failed: 0,
        errors: []
      };

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length === 0) continue;

        try {
          const siteCode = row[columnMap.siteCode];
          if (!siteCode || String(siteCode).trim() === '') {
            results.failed++;
            results.errors.push(`Row ${i + 1}: Site Code is required`);
            continue;
          }

          const inspectionData = { siteCode: String(siteCode).trim() };

            Object.keys(fieldMapping).forEach(normalizedKey => {
            const dbField = fieldMapping[normalizedKey];
            const colIndex = columnMap[dbField];
            if (colIndex !== undefined && row[colIndex] !== null && row[colIndex] !== undefined) {
              let rawValue = row[colIndex];
              let value = String(rawValue).trim();
              if (value === '') return;
              
              if (dbField.includes('Date') && (rawValue || value)) {
                try {
                  // Check if raw value is already a Date object (from XLSX with cellDates: true)
                  if (rawValue instanceof Date) {
                    if (!isNaN(rawValue.getTime())) {
                      inspectionData[dbField] = rawValue;
                      console.log(`Date field ${dbField}: Using Date object:`, rawValue);
                      return;
                    }
                  }
                  
                  // FIRST: Try parsing as date string (DD-MM-YYYY, DD/MM/YYYY, etc.)
                  // This should be checked BEFORE Excel serial conversion
                  if (typeof value === 'string') {
                    const trimmed = value.trim();
                    const parts = trimmed.split(/[-\/\.]/);
                    if (parts.length === 3) {
                      const day = parseInt(parts[0], 10);
                      const month = parseInt(parts[1], 10);
                      const year = parseInt(parts[2], 10);
                      
                      if (!isNaN(day) && !isNaN(month) && !isNaN(year) && 
                          day > 0 && day <= 31 && month > 0 && month <= 12 && 
                          year >= 1900 && year <= 2100) {
                        const date = new Date(year, month - 1, day);
                        if (!isNaN(date.getTime()) && 
                            date.getFullYear() === year && 
                            date.getMonth() === month - 1 && 
                            date.getDate() === day) {
                          inspectionData[dbField] = date;
                          console.log(`Date field ${dbField}: Parsed DD-MM-YYYY format "${trimmed}" to:`, date);
                          return;
                        }
                      }
                    }
                    
                    // Try ISO format (YYYY-MM-DD)
                    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
                      const date = new Date(trimmed);
                      if (!isNaN(date.getTime()) && date.getFullYear() >= 1900 && date.getFullYear() <= 2100) {
                        inspectionData[dbField] = date;
                        console.log(`Date field ${dbField}: Parsed ISO format "${trimmed}" to:`, date);
                        return;
                      }
                    }
                  }
                  
                  // THEN: Check if value is an Excel serial date (numeric)
                  // BE VERY CONSERVATIVE: Only treat as Excel serial if it's clearly a serial number
                  // Excel serial dates for dates in 2000-2100 are typically 36526-73050
                  // Numbers like 2005, 2016, etc. are likely years or other values, NOT Excel serial dates
                  const numValue = typeof rawValue === 'number' ? rawValue : 
                                  (typeof value === 'string' && /^\d+$/.test(value)) ? parseFloat(value) : 
                                  (!isNaN(parseFloat(value)) && isFinite(parseFloat(value))) ? parseFloat(value) : null;
                  
                  if (numValue !== null && !isNaN(numValue)) {
                    // If it looks like a year (1900-2100), don't treat as Excel serial
                    if (numValue >= 1900 && numValue <= 2100) {
                      console.warn(`Date field ${dbField}: Number ${numValue} looks like a year, not treating as Excel serial date`);
                      // Don't return - continue to try parsing as date string below
                    } else if (numValue >= 36526 && numValue <= 73050) {
                      // This is clearly in the Excel serial range for dates 2000-2100
                      // Excel incorrectly treats 1900 as a leap year, so we adjust
                      const date = new Date(1900, 0, numValue - 2);
                      
                      // Validate the converted date
                      if (!isNaN(date.getTime()) && date.getFullYear() >= 1900 && date.getFullYear() <= 2100) {
                        inspectionData[dbField] = date;
                        console.log(`Date field ${dbField}: Converted Excel serial ${numValue} to:`, date);
                        return;
                      }
                    } else if (numValue > 0 && numValue < 36526) {
                      // Numbers less than 36526 (before year 2000) - could be Excel serial but be careful
                      // Only convert if it produces a reasonable date
                      let date;
                      if (numValue <= 60) {
                        date = new Date(1900, 0, numValue - 1);
                      } else {
                        date = new Date(1900, 0, numValue - 2);
                      }
                      
                      const resultYear = date.getFullYear();
                      // Only use if it produces a date in 1900-2100 range
                      if (!isNaN(date.getTime()) && resultYear >= 1900 && resultYear <= 2100) {
                        inspectionData[dbField] = date;
                        console.log(`Date field ${dbField}: Converted Excel serial ${numValue} to:`, date);
                        return;
                      } else {
                        console.warn(`Date field ${dbField}: Number ${numValue} produced invalid year ${resultYear}, not treating as Excel serial`);
                      }
                    } else {
                      console.warn(`Date field ${dbField}: Number ${numValue} is outside Excel serial range, not treating as date`);
                    }
                  }
                  
                  let date;
                  
                  // Try parsing as regular date string
                  // First, try DD-MM-YYYY or DD/MM/YYYY format (common in Excel)
                  if (typeof value === 'string') {
                    const trimmed = value.trim();
                    const parts = trimmed.split(/[-\/\.]/);
                    if (parts.length === 3) {
                      const day = parseInt(parts[0], 10);
                      const month = parseInt(parts[1], 10);
                      const year = parseInt(parts[2], 10);
                      
                      if (!isNaN(day) && !isNaN(month) && !isNaN(year) && 
                          day > 0 && day <= 31 && month > 0 && month <= 12 && 
                          year >= 1900 && year <= 2100) {
                        date = new Date(year, month - 1, day);
                        if (!isNaN(date.getTime()) && 
                            date.getFullYear() === year && 
                            date.getMonth() === month - 1 && 
                            date.getDate() === day) {
                          inspectionData[dbField] = date;
                          console.log(`Date field ${dbField}: Parsed DD-MM-YYYY format "${trimmed}" to:`, date);
                          return;
                        }
                      }
                    }
                  }
                  
                  // Then try parsing as ISO date string or other standard formats
                  date = new Date(value);
                  if (!isNaN(date.getTime()) && date.getFullYear() >= 1900 && date.getFullYear() <= 2100) {
                    inspectionData[dbField] = date;
                    console.log(`Date field ${dbField}: Parsed date string "${value}" to:`, date);
                    return;
                  }
                  
                  // If all parsing fails, log and skip
                  console.warn(`Date field ${dbField}: Could not parse value:`, rawValue, 'as:', value, 'type:', typeof rawValue);
                } catch (error) {
                  console.error(`Error parsing date for ${dbField}:`, error, 'value:', rawValue);
                }
              } else {
                inspectionData[dbField] = value;
              }
            }
          });

          const terminals = {};
          terminalFields.forEach(terminal => {
            const terminalData = {};
            Object.entries(terminalFieldMappings).forEach(([pattern, dbFieldName]) => {
              const dbField = `${terminal}_${dbFieldName}`;
              const colIndex = columnMap[dbField];
              if (colIndex !== undefined && row[colIndex] !== null && row[colIndex] !== undefined) {
                const value = String(row[colIndex]).trim();
                if (value !== '') {
                  terminalData[dbFieldName] = value;
                }
              }
            });
            if (Object.keys(terminalData).length > 0) {
              terminals[terminal] = terminalData;
            }
          });

          if (!inspectionData.inspectionDate) {
            inspectionData.inspectionDate = new Date();
          }

          const inspectionDoc = {
            siteCode: inspectionData.siteCode,
            circle: inspectionData.circle || '',
            division: inspectionData.division || '',
            subDivision: inspectionData.subDivision || '',
            om: inspectionData.om || '',
            dateOfCommission: inspectionData.dateOfCommission || null,
            feederNumberAndName: inspectionData.feederNumberAndName || '',
            inspectionDate: inspectionData.inspectionDate || new Date(),
            rmuMakeType: inspectionData.rmuMakeType || '',
            locationHRN: inspectionData.locationHRN || '',
            serialNo: inspectionData.serialNo || '',
            latLong: inspectionData.latLong || '',
            warrantyStatus: inspectionData.warrantyStatus || '',
            coFeederName: inspectionData.coFeederName || '',
            previousAMCDate: inspectionData.previousAMCDate || null,
            mfmMake: inspectionData.mfmMake || '',
            relayMakeModelNo: inspectionData.relayMakeModelNo || '',
            fpiMakeModelNo: inspectionData.fpiMakeModelNo || '',
            rtuMakeSlno: inspectionData.rtuMakeSlno || '',
            rmuStatus: inspectionData.rmuStatus || '',
            availability24V: inspectionData.availability24V || '',
            ptVoltageAvailability: inspectionData.ptVoltageAvailability || '',
            batteryChargerCondition: inspectionData.batteryChargerCondition || '',
            earthingConnection: inspectionData.earthingConnection || '',
            commAccessoriesAvailability: inspectionData.commAccessoriesAvailability || '',
            relayGroupChange: inspectionData.relayGroupChange || '',
            fpiStatus: inspectionData.fpiStatus || '',
            availability12V: inspectionData.availability12V || '',
            overallWiringIssue: inspectionData.overallWiringIssue || '',
            controlCard: inspectionData.controlCard || '',
            beddingCondition: inspectionData.beddingCondition || '',
            batteryStatus: inspectionData.batteryStatus || '',
            relayGroupChangeUpdate: inspectionData.relayGroupChangeUpdate || '',
            availability230V: inspectionData.availability230V || '',
            sf6Gas: inspectionData.sf6Gas || '',
            rmuLocationSameAsGIS: inspectionData.rmuLocationSameAsGIS || '',
            doorHydraulics: inspectionData.doorHydraulics || '',
            controlCabinetDoor: inspectionData.controlCabinetDoor || '',
            doorGasket: inspectionData.doorGasket || '',
            dummyLatchCommand: inspectionData.dummyLatchCommand || '',
            terminals: terminals,
            remarks: inspectionData.remarks || '',
            images: [],
            video: null,
            pdfFile: null,
            submittedBy: req.user ? req.user._id : null
          };

          await RMUInspection.findOneAndUpdate(
            { siteCode: inspectionData.siteCode },
            inspectionDoc,
            { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
          );

          results.successful++;
        } catch (rowError) {
          results.failed++;
          results.errors.push(`Row ${i + 1}: ${rowError.message || 'Unknown error'}`);
        }
      }

      fs.unlinkSync(tempFilePath);

      res.status(200).json({
        success: true,
        totalRows: results.totalRows,
        successful: results.successful,
        failed: results.failed,
        errors: results.errors,
        message: `Processed ${results.totalRows} rows. ${results.successful} successful, ${results.failed} failed.`
      });
    } catch (parseError) {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      throw parseError;
    }
  } catch (error) {
    console.error('Mass upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server error'
    });
  }
};

/**
 * Generate PDF from HTML content
 * @route POST /api/inspection/generate-pdf
 * @access Private
 */
export const generatePDF = async (req, res) => {
  try {
    const { html, siteCode } = req.body;

    if (!html) {
      return res.status(400).json({
        success: false,
        error: 'HTML content is required'
      });
    }

    // Try to use puppeteer if available, otherwise return error
    try {
      const puppeteer = await import('puppeteer').catch(() => null);
      
      if (!puppeteer) {
        // If puppeteer is not installed, return error with instructions
        return res.status(501).json({
          success: false,
          error: 'PDF generation library not installed. Please install puppeteer: npm install puppeteer'
        });
      }

      const browser = await puppeteer.default.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        }
      });
      
      await browser.close();

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="RMU_Inspection_${siteCode || 'report'}_${Date.now()}.pdf"`);
      res.send(pdf);
    } catch (pdfError) {
      console.error('PDF generation error:', pdfError);
      // If puppeteer fails, return error
      return res.status(500).json({
        success: false,
        error: 'Failed to generate PDF. Please ensure puppeteer is installed: npm install puppeteer'
      });
    }
  } catch (error) {
    console.error('Generate PDF error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate PDF'
    });
  }
};

