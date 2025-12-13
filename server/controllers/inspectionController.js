import RMUInspection from '../models/RMUInspection.js';
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
      .populate('submittedBy', 'fullName userId email')
      .lean(); // Use lean() to get plain JavaScript object

    if (!inspection) {
      return res.status(404).json({
        success: false,
        error: 'Inspection not found for this Site Code'
      });
    }

    // Ensure all fields are present, even if undefined/null
    // This ensures the frontend always receives all expected fields
    const inspectionData = {
      ...inspection,
      // Fields 27-40 - ensure they exist
      fpiStatus: inspection.fpiStatus || '',
      availability12V: inspection.availability12V || '',
      overallWiringIssue: inspection.overallWiringIssue || '',
      controlCard: inspection.controlCard || '',
      beddingCondition: inspection.beddingCondition || '',
      batteryStatus: inspection.batteryStatus || '',
      relayGroupChangeUpdate: inspection.relayGroupChangeUpdate || '',
      availability230V: inspection.availability230V || '',
      sf6Gas: inspection.sf6Gas || '',
      rmuLocationSameAsGIS: inspection.rmuLocationSameAsGIS || '',
      doorHydraulics: inspection.doorHydraulics || '',
      controlCabinetDoor: inspection.controlCabinetDoor || '',
      doorGasket: inspection.doorGasket || '',
      dummyLatchCommand: inspection.dummyLatchCommand || '',
      // Ensure terminals object exists
      terminals: inspection.terminals || {},
      // Ensure remarks exists
      remarks: inspection.remarks || ''
    };

    // Debug: Log what fields have values
    console.log('🔍 Server: Inspection data for siteCode:', siteCode);
    console.log('🔍 Server: Field 27 (fpiStatus):', inspectionData.fpiStatus);
    console.log('🔍 Server: Field 28 (availability12V):', inspectionData.availability12V);
    console.log('🔍 Server: Field 29 (overallWiringIssue):', inspectionData.overallWiringIssue);
    console.log('🔍 Server: Field 30 (controlCard):', inspectionData.controlCard);
    console.log('🔍 Server: Field 32 (batteryStatus):', inspectionData.batteryStatus);
    console.log('🔍 Server: Field 35 (sf6Gas):', inspectionData.sf6Gas);
    console.log('🔍 Server: Field 39 (doorGasket):', inspectionData.doorGasket);
    console.log('🔍 Server: Field 40 (dummyLatchCommand):', inspectionData.dummyLatchCommand);
    console.log('🔍 Server: Terminals:', inspectionData.terminals);
    console.log('🔍 Server: Remarks:', inspectionData.remarks);
    console.log('🔍 Server: Full inspection object keys:', Object.keys(inspectionData));

    res.status(200).json({
      success: true,
      data: inspectionData
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
              let value = row[colIndex];
              
              // Handle date fields
              if (dbField.includes('Date')) {
                try {
                  let parsedDate = null;
                  
                  // If it's already a Date object (from XLSX with cellDates: true)
                  if (value instanceof Date) {
                    parsedDate = value;
                  }
                  // Check if value is a number (Excel serial date)
                  else if (typeof value === 'number' && value > 0 && value < 1000000) {
                    // Excel serial date: days since January 1, 1900
                    // Excel incorrectly treats 1900 as a leap year, so we adjust
                    const excelEpoch = new Date(1899, 11, 30); // Dec 30, 1899
                    parsedDate = new Date(excelEpoch.getTime() + (value - 1) * 24 * 60 * 60 * 1000);
                  }
                  // Handle string dates
                  else if (typeof value === 'string') {
                    const trimmed = value.trim();
                    if (trimmed === '') return;
                    
                    // Try DD-MM-YYYY format first (common in Excel exports)
                    const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
                    if (ddmmyyyyMatch) {
                      const [, day, month, year] = ddmmyyyyMatch;
                      const dayNum = parseInt(day, 10);
                      const monthNum = parseInt(month, 10);
                      const yearNum = parseInt(year, 10);
                      if (dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12 && yearNum >= 1900 && yearNum <= 2100) {
                        parsedDate = new Date(yearNum, monthNum - 1, dayNum);
                      }
                    } else {
                      // Try other formats
                      parsedDate = new Date(trimmed);
                    }
                  }
                  
                  // Validate the parsed date
                  if (parsedDate && !isNaN(parsedDate.getTime())) {
                    const year = parsedDate.getFullYear();
                    // Only accept reasonable years
                    if (year >= 1900 && year <= 2100) {
                      inspectionData[dbField] = parsedDate;
                    } else {
                      console.warn(`Invalid date year ${year} for ${dbField}, storing as null:`, value);
                      inspectionData[dbField] = null;
                    }
                  } else {
                    inspectionData[dbField] = null;
                  }
                } catch (error) {
                  console.error(`Error parsing date for ${dbField}:`, value, error);
                  inspectionData[dbField] = null;
                }
              } else {
                // Non-date fields
                if (typeof value === 'string') {
                  const trimmed = value.trim();
                  if (trimmed === '') return;
                  inspectionData[dbField] = trimmed;
                } else {
                  inspectionData[dbField] = value;
                }
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

