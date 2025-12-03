import RMUInspection from '../models/RMUInspection.js';

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
        'electricalOperation', 'remoteOperation'
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

