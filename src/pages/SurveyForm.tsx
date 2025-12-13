import { useState, useRef, useEffect } from 'react';
import AutocompleteInput from '../components/AutocompleteInput';
import { API_BASE } from '../utils/api';

export default function SurveyForm() {
  const [images, setImages] = useState<string[]>([]);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Video recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordedVideo, setRecordedVideo] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const recordingVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoFileInputRef = useRef<HTMLInputElement>(null);

  // PDF upload states
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfPreview, setPdfPreview] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const pdfFileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    // Fields 1-14: Basic Information
    siteCode: '',
    circle: '',
    division: '',
    subDivision: '',
    om: '',
    dateOfCommission: '',
    feederNumberAndName: '',
    inspectionDate: '',
    rmuMakeType: '',
    locationHRN: '',
    serialNo: '',
    latLong: '',
    warrantyStatus: '',
    coFeederName: '',
    
    // Fields 15-19: Additional Details
    previousAMCDate: '',
    mfmMake: '',
    relayMakeModelNo: '',
    fpiMakeModelNo: '',
    rtuMakeSlno: '',
    
    // Field 20: RMU Status
    rmuStatus: '',
    
    // Fields 21-26
    availability24V: '',
    ptVoltageAvailability: '',
    batteryChargerCondition: '',
    earthingConnection: '',
    commAccessoriesAvailability: '',
    relayGroupChange: '',
    
    // Field 27: FPI Status
    fpiStatus: '',
    
    // Fields 28-33
    availability12V: '',
    overallWiringIssue: '',
    controlCard: '',
    beddingCondition: '',
    batteryStatus: '',
    relayGroupChangeUpdate: '',
    
    // Fields 34-39
    availability230V: '',
    sf6Gas: '',
    rmuLocationSameAsGIS: '',
    doorHydraulics: '',
    controlCabinetDoor: '',
    doorGasket: '',
    
    // Field 40
    dummyLatchCommand: '',
    
    // Fields 41-59: Table data for OD1, OD2, VL1, VL2, VL3
    od1_cablesConnected: '',
    od1_connectedTo: '',
    od1_loadAmpsR: '',
    od1_loadAmpsY: '',
    od1_loadAmpsB: '',
    od1_switchPosition: '',
    od1_onOffMotors: '',
    od1_healthinessSwitch: '',
    od1_breakerStatus: '',
    od1_cableEntryDoors: '',
    od1_cableClamped: '',
    od1_localRemoteSwitch: '',
    od1_vpisIndication: '',
    od1_mfmWorking: '',
    od1_rmuSide24Pin: '',
    od1_cableSize: '',
    od1_electricalOperation: '',
    od1_remoteOperation: '',
    
    od2_cablesConnected: '',
    od2_connectedTo: '',
    od2_loadAmpsR: '',
    od2_loadAmpsY: '',
    od2_loadAmpsB: '',
    od2_switchPosition: '',
    od2_onOffMotors: '',
    od2_healthinessSwitch: '',
    od2_breakerStatus: '',
    od2_cableEntryDoors: '',
    od2_cableClamped: '',
    od2_localRemoteSwitch: '',
    od2_vpisIndication: '',
    od2_mfmWorking: '',
    od2_rmuSide24Pin: '',
    od2_cableSize: '',
    od2_electricalOperation: '',
    od2_remoteOperation: '',
    
    vl1_cablesConnected: '',
    vl1_connectedTo: '',
    vl1_loadAmpsR: '',
    vl1_loadAmpsY: '',
    vl1_loadAmpsB: '',
    vl1_switchPosition: '',
    vl1_onOffMotors: '',
    vl1_healthinessSwitch: '',
    vl1_breakerStatus: '',
    vl1_cableEntryDoors: '',
    vl1_cableClamped: '',
    vl1_localRemoteSwitch: '',
    vl1_vpisIndication: '',
    vl1_relayWorking: '',
    vl1_rmuSide24Pin: '',
    vl1_cableSize: '',
    vl1_electricalOperation: '',
    vl1_remoteOperation: '',
    
    vl2_cablesConnected: '',
    vl2_connectedTo: '',
    vl2_loadAmpsR: '',
    vl2_loadAmpsY: '',
    vl2_loadAmpsB: '',
    vl2_switchPosition: '',
    vl2_onOffMotors: '',
    vl2_healthinessSwitch: '',
    vl2_breakerStatus: '',
    vl2_cableEntryDoors: '',
    vl2_cableClamped: '',
    vl2_localRemoteSwitch: '',
    vl2_vpisIndication: '',
    vl2_relayWorking: '',
    vl2_rmuSide24Pin: '',
    vl2_cableSize: '',
    vl2_electricalOperation: '',
    vl2_remoteOperation: '',
    
    vl3_cablesConnected: '',
    vl3_connectedTo: '',
    vl3_loadAmpsR: '',
    vl3_loadAmpsY: '',
    vl3_loadAmpsB: '',
    vl3_switchPosition: '',
    vl3_onOffMotors: '',
    vl3_healthinessSwitch: '',
    vl3_breakerStatus: '',
    vl3_cableEntryDoors: '',
    vl3_cableClamped: '',
    vl3_localRemoteSwitch: '',
    vl3_vpisIndication: '',
    vl3_relayWorking: '',
    vl3_rmuSide24Pin: '',
    vl3_cableSize: '',
    vl3_electricalOperation: '',
    vl3_remoteOperation: '',
    
    // Field 60: Cable IC From or OG To - separated for each terminal
    od1_cableICFromOrOGTo: '',
    od2_cableICFromOrOGTo: '',
    vl1_cableICFromOrOGTo: '',
    vl2_cableICFromOrOGTo: '',
    vl3_cableICFromOrOGTo: '',
    
    // Remarks
    remarks: '',
  });

  // Helper function to parse date from various formats and convert to YYYY-MM-DD for date inputs
  const parseDateForInput = (dateValue: any): string => {
    if (!dateValue) return '';
    
    try {
      // Handle string dates
      if (typeof dateValue === 'string') {
        const trimmed = dateValue.trim();
        
        // If it's already in YYYY-MM-DD format, return as is
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
          return trimmed;
        }
        
        // Handle DD-MM-YYYY format (from Excel) - e.g., "10-11-2025", "29-10-2025"
        const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (ddmmyyyyMatch) {
          const [, day, month, year] = ddmmyyyyMatch;
          const dayNum = parseInt(day, 10);
          const monthNum = parseInt(month, 10);
          const yearNum = parseInt(year, 10);
          // Validate: day should be 1-31, month 1-12, year 1900-2100
          if (dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12 && yearNum >= 1900 && yearNum <= 2100) {
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          }
        }
        
        // Handle YYYY-MM-DD format but with slashes or other separators
        const yyyymmddMatch = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
        if (yyyymmddMatch) {
          const [, year, month, day] = yyyymmddMatch;
          const yearNum = parseInt(year, 10);
          if (yearNum >= 1900 && yearNum <= 2100) {
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          }
        }
        
        // Handle ISO date strings with invalid years (like +045244-12-31T18:30:00.000Z)
        // These are Excel serial dates that were incorrectly converted to ISO format
        if (trimmed.includes('T') || trimmed.includes('Z')) {
          // Check for malformed dates with very large years (like +045244, 45958, 44307)
          // Extract the number from patterns like +045244-12-31 or 45244-12-31
          const invalidYearMatch = trimmed.match(/[\+\-]?0*(\d{5,})[\-\/](\d{1,2})[\-\/](\d{1,2})/);
          if (invalidYearMatch) {
            const serialDateNum = parseInt(invalidYearMatch[1], 10);
            // Excel serial dates are typically in range 1-100000 (representing dates from 1900-2173)
            if (serialDateNum > 1 && serialDateNum < 1000000) {
              try {
                // Excel serial date: days since January 1, 1900
                // Excel incorrectly treats 1900 as a leap year, so we adjust
                // Excel epoch: December 30, 1899 (since Excel thinks 1900 is a leap year)
                const excelEpoch = new Date(Date.UTC(1899, 11, 30)); // Dec 30, 1899 UTC
                const millisecondsPerDay = 24 * 60 * 60 * 1000;
                // Excel serial date 1 = Jan 1, 1900, but we adjust for the leap year bug
                const excelDate = new Date(excelEpoch.getTime() + (serialDateNum - 1) * millisecondsPerDay);
                
                if (!isNaN(excelDate.getTime())) {
                  const year = excelDate.getFullYear();
                  if (year >= 1900 && year <= 2100) {
                    const monthStr = String(excelDate.getMonth() + 1).padStart(2, '0');
                    const dayStr = String(excelDate.getDate()).padStart(2, '0');
                    console.log(`✅ Converted Excel serial date ${serialDateNum} to ${year}-${monthStr}-${dayStr}`);
                    return `${year}-${monthStr}-${dayStr}`;
                  }
                }
              } catch (e) {
                console.warn('Failed to convert Excel serial date:', serialDateNum, e);
              }
            }
            // If conversion failed, skip this invalid date
            console.warn('⚠️ Skipping invalid date with large year:', trimmed);
            return '';
          }
          
          // Try normal ISO date parsing for valid dates
          const date = new Date(trimmed);
          if (!isNaN(date.getTime())) {
            const year = date.getFullYear();
            if (year >= 1900 && year <= 2100) {
              const monthStr = String(date.getMonth() + 1).padStart(2, '0');
              const dayStr = String(date.getDate()).padStart(2, '0');
              return `${year}-${monthStr}-${dayStr}`;
            }
          }
        }
      }
      
      // Handle Date objects
      if (dateValue instanceof Date) {
        if (!isNaN(dateValue.getTime())) {
          const year = dateValue.getFullYear();
          if (year >= 1900 && year <= 2100) {
            const monthStr = String(dateValue.getMonth() + 1).padStart(2, '0');
            const dayStr = String(dateValue.getDate()).padStart(2, '0');
            return `${year}-${monthStr}-${dayStr}`;
          } else {
            console.warn('Date object with invalid year:', year, dateValue);
            return '';
          }
        }
      }
      
      // Try parsing as Date object as last resort
      const date = new Date(dateValue);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        // Check if year is reasonable (between 1900 and 2100)
        if (year >= 1900 && year <= 2100) {
          const monthStr = String(date.getMonth() + 1).padStart(2, '0');
          const dayStr = String(date.getDate()).padStart(2, '0');
          return `${year}-${monthStr}-${dayStr}`;
        } else {
          console.warn('Could not parse date - invalid year:', year, dateValue);
          return '';
        }
      }
      
      // If all parsing fails, return empty string
      console.warn('Could not parse date:', dateValue);
      return '';
    } catch (error) {
      console.error('Error parsing date:', dateValue, error);
      return '';
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Auto-load data when Site Code changes and loses focus
    if (name === 'siteCode') {
      // Clear load error when Site Code changes
      setLoadDataError(null);
    }
  };

  // Function to load existing inspection data by Site Code
  const loadInspectionData = async (siteCode: string) => {
    if (!siteCode.trim()) {
      return;
    }

    setIsLoadingData(true);
    setLoadDataError(null);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required. Please login again.');
      }

      const response = await fetch(`${API_BASE}/api/inspection/sitecode/${encodeURIComponent(siteCode)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        // If inspection not found, it's a new record - that's fine
        if (response.status === 404) {
          setIsLoadingData(false);
          return;
        }
        throw new Error(data.error || 'Failed to load inspection data');
      }

      if (data.success && data.data) {
        const inspection = data.data;
        
        // Log the raw API response to see what fields have data
        console.log('🔍 Raw API Response - Full inspection object:', inspection);
        console.log('🔍 Raw API Response - Fields 27-40 check:', {
          hasFpiStatus: inspection.fpiStatus !== undefined && inspection.fpiStatus !== null,
          fpiStatus: inspection.fpiStatus,
          hasAvailability12V: inspection.availability12V !== undefined && inspection.availability12V !== null,
          availability12V: inspection.availability12V,
          hasControlCard: inspection.controlCard !== undefined && inspection.controlCard !== null,
          controlCard: inspection.controlCard,
          hasBatteryStatus: inspection.batteryStatus !== undefined && inspection.batteryStatus !== null,
          batteryStatus: inspection.batteryStatus,
          hasSf6Gas: inspection.sf6Gas !== undefined && inspection.sf6Gas !== null,
          sf6Gas: inspection.sf6Gas,
          hasDoorGasket: inspection.doorGasket !== undefined && inspection.doorGasket !== null,
          doorGasket: inspection.doorGasket,
          hasDummyLatchCommand: inspection.dummyLatchCommand !== undefined && inspection.dummyLatchCommand !== null,
          dummyLatchCommand: inspection.dummyLatchCommand,
          hasTerminals: inspection.terminals !== undefined && inspection.terminals !== null,
          terminals: inspection.terminals,
          hasRemarks: inspection.remarks !== undefined && inspection.remarks !== null,
          remarks: inspection.remarks
        });
        
        // Parse dates first for debugging
        const parsedDateOfCommission = parseDateForInput(inspection.dateOfCommission);
        const parsedInspectionDate = parseDateForInput(inspection.inspectionDate);
        const parsedPreviousAMCDate = parseDateForInput(inspection.previousAMCDate);
        
        // Debug: Log date values
        console.log('📅 Date parsing debug:', {
          dateOfCommission: {
            raw: inspection.dateOfCommission,
            parsed: parsedDateOfCommission,
            type: typeof inspection.dateOfCommission
          },
          inspectionDate: {
            raw: inspection.inspectionDate,
            parsed: parsedInspectionDate,
            type: typeof inspection.inspectionDate
          },
          previousAMCDate: {
            raw: inspection.previousAMCDate,
            parsed: parsedPreviousAMCDate,
            type: typeof inspection.previousAMCDate
          }
        });
        
        // Populate form fields
        const formFields: any = {
          siteCode: inspection.siteCode || '',
          circle: inspection.circle || '',
          division: inspection.division || '',
          subDivision: inspection.subDivision || '',
          om: inspection.om || '',
          dateOfCommission: parsedDateOfCommission,
          feederNumberAndName: inspection.feederNumberAndName || '',
          inspectionDate: parsedInspectionDate,
          rmuMakeType: inspection.rmuMakeType || '',
          locationHRN: inspection.locationHRN || '',
          serialNo: inspection.serialNo || '',
          latLong: inspection.latLong || '',
          warrantyStatus: inspection.warrantyStatus || '',
          coFeederName: inspection.coFeederName || '',
          previousAMCDate: parseDateForInput(inspection.previousAMCDate),
          mfmMake: inspection.mfmMake || '',
          relayMakeModelNo: inspection.relayMakeModelNo || '',
          fpiMakeModelNo: inspection.fpiMakeModelNo || '',
          rtuMakeSlno: inspection.rtuMakeSlno || '',
          rmuStatus: inspection.rmuStatus || '',
          availability24V: inspection.availability24V || '',
          ptVoltageAvailability: inspection.ptVoltageAvailability || '',
          batteryChargerCondition: inspection.batteryChargerCondition || '',
          earthingConnection: inspection.earthingConnection || '',
          commAccessoriesAvailability: inspection.commAccessoriesAvailability || '',
          relayGroupChange: inspection.relayGroupChange || '',
          fpiStatus: inspection.fpiStatus !== undefined && inspection.fpiStatus !== null ? String(inspection.fpiStatus) : '',
          availability12V: inspection.availability12V !== undefined && inspection.availability12V !== null ? String(inspection.availability12V) : '',
          overallWiringIssue: inspection.overallWiringIssue !== undefined && inspection.overallWiringIssue !== null ? String(inspection.overallWiringIssue) : '',
          controlCard: inspection.controlCard !== undefined && inspection.controlCard !== null ? String(inspection.controlCard) : '',
          beddingCondition: inspection.beddingCondition !== undefined && inspection.beddingCondition !== null ? String(inspection.beddingCondition) : '',
          batteryStatus: inspection.batteryStatus !== undefined && inspection.batteryStatus !== null ? String(inspection.batteryStatus) : '',
          relayGroupChangeUpdate: inspection.relayGroupChangeUpdate !== undefined && inspection.relayGroupChangeUpdate !== null ? String(inspection.relayGroupChangeUpdate) : '',
          availability230V: inspection.availability230V !== undefined && inspection.availability230V !== null ? String(inspection.availability230V) : '',
          sf6Gas: inspection.sf6Gas !== undefined && inspection.sf6Gas !== null ? String(inspection.sf6Gas) : '',
          rmuLocationSameAsGIS: inspection.rmuLocationSameAsGIS !== undefined && inspection.rmuLocationSameAsGIS !== null ? String(inspection.rmuLocationSameAsGIS) : '',
          doorHydraulics: inspection.doorHydraulics !== undefined && inspection.doorHydraulics !== null ? String(inspection.doorHydraulics) : '',
          controlCabinetDoor: inspection.controlCabinetDoor !== undefined && inspection.controlCabinetDoor !== null ? String(inspection.controlCabinetDoor) : '',
          doorGasket: inspection.doorGasket !== undefined && inspection.doorGasket !== null ? String(inspection.doorGasket) : '',
          dummyLatchCommand: inspection.dummyLatchCommand !== undefined && inspection.dummyLatchCommand !== null ? String(inspection.dummyLatchCommand) : '',
          remarks: inspection.remarks !== undefined && inspection.remarks !== null ? String(inspection.remarks) : ''
        };

        // Populate terminal data (OD1, OD2, VL1, VL2, VL3)
        // Initialize all terminal fields first to ensure they're always set
        const terminalKeys = ['od1', 'od2', 'vl1', 'vl2', 'vl3'];
        const terminalFields = [
          'cablesConnected', 'connectedTo', 'loadAmpsR', 'loadAmpsY', 'loadAmpsB',
          'switchPosition', 'onOffMotors', 'healthinessSwitch', 'breakerStatus',
          'cableEntryDoors', 'cableClamped', 'localRemoteSwitch', 'vpisIndication',
          'mfmWorking', 'relayWorking', 'rmuSide24Pin', 'cableSize',
          'electricalOperation', 'remoteOperation', 'cableICFromOrOGTo'
        ];

        // Initialize all terminal fields to empty strings first
        terminalKeys.forEach(prefix => {
          terminalFields.forEach(field => {
            const key = `${prefix}_${field}`;
            formFields[key] = '';
          });
        });

        // Then populate with actual data if it exists
        if (inspection.terminals) {
          terminalKeys.forEach(prefix => {
            const terminalData = inspection.terminals[prefix];
            if (terminalData) {
              terminalFields.forEach(field => {
                const key = `${prefix}_${field}`;
                const value = terminalData[field];
                if (value !== null && value !== undefined && value !== '') {
                  formFields[key] = value;
                }
              });
            }
          });
        }

        // Debug: Log all data being loaded - expand all values for visibility
        console.log('📋 Raw inspection data - Field 27 (fpiStatus):', inspection.fpiStatus);
        console.log('📋 Raw inspection data - Field 28 (availability12V):', inspection.availability12V);
        console.log('📋 Raw inspection data - Field 29 (overallWiringIssue):', inspection.overallWiringIssue);
        console.log('📋 Raw inspection data - Field 30 (controlCard):', inspection.controlCard);
        console.log('📋 Raw inspection data - Field 31 (beddingCondition):', inspection.beddingCondition);
        console.log('📋 Raw inspection data - Field 32 (batteryStatus):', inspection.batteryStatus);
        console.log('📋 Raw inspection data - Field 33 (relayGroupChangeUpdate):', inspection.relayGroupChangeUpdate);
        console.log('📋 Raw inspection data - Field 34 (availability230V):', inspection.availability230V);
        console.log('📋 Raw inspection data - Field 35 (sf6Gas):', inspection.sf6Gas);
        console.log('📋 Raw inspection data - Field 36 (rmuLocationSameAsGIS):', inspection.rmuLocationSameAsGIS);
        console.log('📋 Raw inspection data - Field 37 (doorHydraulics):', inspection.doorHydraulics);
        console.log('📋 Raw inspection data - Field 38 (controlCabinetDoor):', inspection.controlCabinetDoor);
        console.log('📋 Raw inspection data - Field 39 (doorGasket):', inspection.doorGasket);
        console.log('📋 Raw inspection data - Field 40 (dummyLatchCommand):', inspection.dummyLatchCommand);
        console.log('📋 Raw inspection data - Terminals:', inspection.terminals);
        console.log('📋 Raw inspection data - Remarks:', inspection.remarks);
        console.log('📋 Full inspection object:', inspection);
        
        // Count how many fields have values
        const fieldsWithValues = Object.keys(formFields).filter(key => {
          const value = formFields[key];
          return value !== null && value !== undefined && value !== '';
        });
        
        console.log(`📋 FormFields summary: ${fieldsWithValues.length} fields with values out of ${Object.keys(formFields).length} total fields`);
        console.log('📋 FormFields - Field 27 (fpiStatus):', formFields.fpiStatus);
        console.log('📋 FormFields - Field 28 (availability12V):', formFields.availability12V);
        console.log('📋 FormFields - Field 29 (overallWiringIssue):', formFields.overallWiringIssue);
        console.log('📋 FormFields - Field 30 (controlCard):', formFields.controlCard);
        console.log('📋 FormFields - Field 31 (beddingCondition):', formFields.beddingCondition);
        console.log('📋 FormFields - Field 32 (batteryStatus):', formFields.batteryStatus);
        console.log('📋 FormFields - Field 33 (relayGroupChangeUpdate):', formFields.relayGroupChangeUpdate);
        console.log('📋 FormFields - Field 34 (availability230V):', formFields.availability230V);
        console.log('📋 FormFields - Field 35 (sf6Gas):', formFields.sf6Gas);
        console.log('📋 FormFields - Field 36 (rmuLocationSameAsGIS):', formFields.rmuLocationSameAsGIS);
        console.log('📋 FormFields - Field 37 (doorHydraulics):', formFields.doorHydraulics);
        console.log('📋 FormFields - Field 38 (controlCabinetDoor):', formFields.controlCabinetDoor);
        console.log('📋 FormFields - Field 39 (doorGasket):', formFields.doorGasket);
        console.log('📋 FormFields - Field 40 (dummyLatchCommand):', formFields.dummyLatchCommand);
        console.log('📋 FormFields - Terminal OD1 sample:', {
          od1_cablesConnected: formFields.od1_cablesConnected,
          od1_switchPosition: formFields.od1_switchPosition,
          od1_loadAmpsR: formFields.od1_loadAmpsR,
          od1_cableICFromOrOGTo: formFields.od1_cableICFromOrOGTo
        });
        console.log('📋 FormFields - Terminal VL1 sample:', {
          vl1_cablesConnected: formFields.vl1_cablesConnected,
          vl1_switchPosition: formFields.vl1_switchPosition,
          vl1_loadAmpsR: formFields.vl1_loadAmpsR,
          vl1_cableICFromOrOGTo: formFields.vl1_cableICFromOrOGTo
        });
        console.log('📋 FormFields - Remarks:', formFields.remarks);

        // Update form data - merge with existing state to preserve all field definitions
        try {
          setFormData(prev => {
            // Create a complete form data object with all fields
            const updated = { ...prev };
            
            // Update all fields from formFields
            Object.keys(formFields).forEach(key => {
              try {
                updated[key as keyof typeof updated] = formFields[key];
              } catch (err) {
                console.error(`Error setting field ${key}:`, err);
              }
            });
            
            console.log('📋 FormData after update - checking key fields:', {
              fpiStatus: updated.fpiStatus,
              availability12V: updated.availability12V,
              controlCard: updated.controlCard,
              batteryStatus: updated.batteryStatus,
              sf6Gas: updated.sf6Gas,
              doorGasket: updated.doorGasket,
              dummyLatchCommand: updated.dummyLatchCommand,
              od1_cablesConnected: updated.od1_cablesConnected,
              od1_switchPosition: updated.od1_switchPosition,
              remarks: updated.remarks
            });
            
            return updated;
          });
        } catch (error) {
          console.error('Error updating form data:', error);
          // Fallback: set form data directly
          setFormData(formFields);
        }

        // Load images if they exist
        if (inspection.images && Array.isArray(inspection.images) && inspection.images.length > 0) {
          setImages(inspection.images);
        }

        // Load video if it exists
        if (inspection.video) {
          // If video is base64 data URL, use it directly
          if (typeof inspection.video === 'string') {
            if (inspection.video.startsWith('data:') || inspection.video.startsWith('blob:')) {
              setRecordedVideo(inspection.video);
            } else if (inspection.video.startsWith('http://') || inspection.video.startsWith('https://')) {
              // Handle HTTP URLs
              setRecordedVideo(inspection.video);
            } else {
              // Assume it's base64 string - create data URL
              // Check if it already contains base64, prefix
              if (inspection.video.includes('base64,')) {
                setRecordedVideo(inspection.video);
              } else {
                // Create proper data URL for base64 video
                // MediaRecorder typically creates webm videos
                const videoDataUrl = `data:video/webm;base64,${inspection.video}`;
                setRecordedVideo(videoDataUrl);
              }
            }
          }
        }

        // Load PDF if it exists
        if (inspection.pdfFile) {
          // Convert base64 to File object for preview
          try {
            const byteCharacters = atob(inspection.pdfFile.split(',')[1] || inspection.pdfFile);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'application/pdf' });
            const file = new File([blob], 'inspection.pdf', { type: 'application/pdf' });
            setPdfFile(file);
            setPdfPreview(inspection.pdfFile);
          } catch (error) {
            console.error('Error loading PDF:', error);
          }
        }
      }
    } catch (error: any) {
      console.error('Load inspection data error:', error);
      setLoadDataError(error.message || 'Failed to load inspection data');
    } finally {
      setIsLoadingData(false);
    }
  };

  // Handle Site Code blur event
  const handleSiteCodeBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const siteCode = e.target.value.trim();
    if (siteCode) {
      loadInspectionData(siteCode);
    }
  };

  const handleRadioChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Camera functions
  const startCamera = async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment', // Use back camera if available
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      streamRef.current = stream;
      setIsCameraActive(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Ensure video plays and is visible
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play().catch(err => {
              console.error('Error playing video:', err);
            });
          }
        };
        // Also try to play immediately
        videoRef.current.play().catch(err => {
          console.error('Error playing video immediately:', err);
        });
      }
    } catch (error: any) {
      console.error('Error accessing camera:', error);
      setCameraError(error.message || 'Unable to access camera. Please check permissions.');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const captureImage = () => {
    if (videoRef.current) {
      setImages(prev => {
        if (prev.length >= 5) return prev;
        
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current!.videoWidth;
        canvas.height = videoRef.current!.videoHeight;
        
        const ctx = canvas.getContext('2d');
        if (ctx && videoRef.current) {
          ctx.drawImage(videoRef.current, 0, 0);
          const imageData = canvas.toDataURL('image/jpeg', 0.8);
          const newImages = [...prev, imageData];
          
          // Stop camera if we've reached 5 images
          if (newImages.length === 5) {
            setTimeout(() => stopCamera(), 100);
          }
          
          return newImages;
        }
        return prev;
      });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const remainingSlots = 5 - images.length;
      const filesToProcess = Array.from(files).slice(0, remainingSlots);
      
      filesToProcess.forEach(file => {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target?.result) {
              setImages(prev => {
                if (prev.length < 5) {
                  return [...prev, event.target!.result as string];
                }
                return prev;
              });
            }
          };
          reader.readAsDataURL(file);
        }
      });
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  // Video recording functions
  const startRecording = async () => {
    try {
      setRecordingError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: true
      });
      recordingStreamRef.current = stream;
      
      if (recordingVideoRef.current) {
        const video = recordingVideoRef.current;
        video.srcObject = stream;
        
        // Ensure video plays and is visible
        video.onloadedmetadata = () => {
          if (video) {
            video.play().catch(err => {
              console.error('Error playing recording video:', err);
            });
          }
        };
        
        // Also try to play immediately
        video.play().catch(err => {
          console.error('Error playing recording video immediately:', err);
          // Retry after a short delay
          setTimeout(() => {
            if (video && video.srcObject) {
              video.play().catch(e => console.error('Retry play failed:', e));
            }
          }, 100);
        });
      }
      
      // Try to get the best supported video format
      let mimeType = 'video/webm;codecs=vp8,opus'; // More compatible than vp9
      
      // Check for better codec support
      if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
        mimeType = 'video/webm;codecs=vp9,opus';
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
        mimeType = 'video/webm;codecs=vp8,opus';
      } else if (MediaRecorder.isTypeSupported('video/webm')) {
        mimeType = 'video/webm';
      } else if (MediaRecorder.isTypeSupported('video/mp4')) {
        mimeType = 'video/mp4';
      }
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType
      });
      mediaRecorderRef.current = mediaRecorder;
      
      const chunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const videoUrl = URL.createObjectURL(blob);
        setRecordedVideo(videoUrl);
        setIsRecording(false);
        setRecordingTime(0);
        
        // Stop all tracks
        if (recordingStreamRef.current) {
          recordingStreamRef.current.getTracks().forEach(track => track.stop());
          recordingStreamRef.current = null;
        }
        
        if (recordingVideoRef.current) {
          recordingVideoRef.current.srcObject = null;
        }
        
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
          if (newTime >= 60) {
            // Auto stop at 60 seconds
            stopRecording();
          }
          return newTime;
        });
      }, 1000);
      
    } catch (error: any) {
      console.error('Error starting recording:', error);
      setRecordingError(error.message || 'Unable to access camera/microphone. Please check permissions.');
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      const videoUrl = URL.createObjectURL(file);
      setRecordedVideo(videoUrl);
    }
    // Reset input so same file can be selected again
    if (videoFileInputRef.current) {
      videoFileInputRef.current.value = '';
    }
  };

  const removeVideo = () => {
    if (recordedVideo) {
      URL.revokeObjectURL(recordedVideo);
    }
    setRecordedVideo(null);
    setRecordingTime(0);
  };

  // PDF upload functions
  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setPdfError(null);

    if (!file) {
      return;
    }

    // Check file type
    if (file.type !== 'application/pdf') {
      setPdfError('Please upload a PDF file only.');
      if (pdfFileInputRef.current) {
        pdfFileInputRef.current.value = '';
      }
      return;
    }

    // Check file size (100KB = 100 * 1024 bytes)
    const maxSize = 100 * 1024; // 100KB in bytes
    if (file.size > maxSize) {
      setPdfError(`File size (${(file.size / 1024).toFixed(2)} KB) exceeds the maximum allowed size of 100 KB.`);
      if (pdfFileInputRef.current) {
        pdfFileInputRef.current.value = '';
      }
      return;
    }

    // File is valid
    setPdfFile(file);
    const fileUrl = URL.createObjectURL(file);
    setPdfPreview(fileUrl);
  };

  const removePdf = () => {
    if (pdfPreview) {
      URL.revokeObjectURL(pdfPreview);
    }
    setPdfFile(null);
    setPdfPreview(null);
    setPdfError(null);
    if (pdfFileInputRef.current) {
      pdfFileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) {
      return bytes + ' B';
    } else if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(2) + ' KB';
    } else {
      return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }
  };

  // Effect to ensure video plays when camera is active
  useEffect(() => {
    if (isCameraActive && videoRef.current && streamRef.current) {
      const video = videoRef.current;
      
      // Set up event listeners
      const handleLoadedMetadata = () => {
        video.play().catch(err => {
          console.error('Error playing video after metadata loaded:', err);
        });
      };
      
      const handlePlay = () => {
        console.log('Video is playing');
      };
      
      const handleError = (e: Event) => {
        console.error('Video element error:', e);
        setCameraError('Error displaying camera preview. Please try again.');
      };
      
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('play', handlePlay);
      video.addEventListener('error', handleError);
      
      // Ensure video is visible and plays
      if (video.srcObject !== streamRef.current) {
        video.srcObject = streamRef.current;
      }
      
      video.play().catch(err => {
        console.error('Error playing video:', err);
        // Try again after a short delay
        setTimeout(() => {
          video.play().catch(e => console.error('Retry play failed:', e));
        }, 100);
      });
      
      return () => {
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('error', handleError);
      };
    }
  }, [isCameraActive]);

  // Effect to ensure recording video preview plays when recording
  useEffect(() => {
    if (isRecording && recordingVideoRef.current && recordingStreamRef.current) {
      const video = recordingVideoRef.current;
      
      // Set up event listeners
      const handleLoadedMetadata = () => {
        video.play().catch(err => {
          console.error('Error playing recording video after metadata loaded:', err);
        });
      };
      
      const handlePlay = () => {
        console.log('Recording video preview is playing');
      };
      
      const handleError = (e: Event) => {
        console.error('Recording video element error:', e);
        setRecordingError('Error displaying recording preview. Recording will continue.');
      };
      
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('play', handlePlay);
      video.addEventListener('error', handleError);
      
      // Ensure video is visible and plays
      if (video.srcObject !== recordingStreamRef.current) {
        video.srcObject = recordingStreamRef.current;
      }
      
      video.play().catch(err => {
        console.error('Error playing recording video:', err);
        // Try again after a short delay
        setTimeout(() => {
          video.play().catch(e => console.error('Retry play failed:', e));
        }, 100);
      });
      
      return () => {
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('error', handleError);
      };
    }
  }, [isRecording]);
  
  // Cleanup camera and recording on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      stopRecording();
      if (recordedVideo) {
        URL.revokeObjectURL(recordedVideo);
      }
      if (pdfPreview) {
        URL.revokeObjectURL(pdfPreview);
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [loadDataError, setLoadDataError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.siteCode.trim()) {
      setSubmitError('Site Code is required');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required. Please login again.');
      }

      // Convert video blob URL to base64 if video exists
      let videoBase64 = null;
      if (recordedVideo) {
        try {
          // If it's already a data URL, use it directly
          if (recordedVideo.startsWith('data:')) {
            videoBase64 = recordedVideo;
          } 
          // If it's a blob URL, fetch and convert to base64
          else if (recordedVideo.startsWith('blob:')) {
            const response = await fetch(recordedVideo);
            const blob = await response.blob();
            videoBase64 = await blobToBase64(blob);
          }
          // Otherwise assume it's already base64 or URL
          else {
            videoBase64 = recordedVideo;
          }
        } catch (error) {
          console.error('Error converting video to base64:', error);
          // Continue without video if conversion fails
        }
      }

      // Prepare submission data
      const submissionData = {
        ...formData,
        images: images,
        video: videoBase64,
        pdfFile: pdfFile ? await fileToBase64(pdfFile) : null
      };

      const response = await fetch(`${API_BASE}/api/inspection/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(submissionData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit inspection');
      }

      console.log('RMU Inspection form submitted:', data);
      setSubmitSuccess(true);
      alert(data.message || 'RMU Inspection submitted successfully!');
      
      // Optionally reset form after successful submission
      // resetForm();
    } catch (error: any) {
      console.error('Submit inspection error:', error);
      setSubmitError(error.message || 'Failed to submit inspection. Please try again.');
      alert(error.message || 'Failed to submit inspection. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper function to convert File to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  // Helper function to convert Blob to base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const resetForm = () => {
    const resetData: any = {};
    Object.keys(formData).forEach(key => {
      resetData[key] = '';
    });
    setFormData(resetData);
    setImages([]);
    stopCamera();
    stopRecording();
    if (recordedVideo) {
      URL.revokeObjectURL(recordedVideo);
    }
    setRecordedVideo(null);
    setRecordingTime(0);
    removePdf();
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">RMU Inspection Report</h1>
      <p className="text-sm text-gray-600 mb-6">BANGALORE ELECTRICITY SUPPLY COMPANY LIMITED</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Fields 1-14: Basic Information */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4">Basic Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                1) Site Code:
                {isLoadingData && (
                  <span className="ml-2 text-xs text-blue-600">(Loading...)</span>
                )}
              </label>
              <AutocompleteInput
                name="siteCode"
                value={formData.siteCode}
                onChange={handleChange}
                onBlur={handleSiteCodeBlur}
                fieldName="siteCode"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter Site Code to load existing data"
              />
              {loadDataError && (
                <p className="mt-2 text-xs text-red-600 font-medium bg-red-50 px-2 py-1 rounded border border-red-200">{loadDataError}</p>
              )}
              {!loadDataError && !isLoadingData && formData.siteCode && (
                <p className="mt-2 text-xs text-green-600 font-medium bg-green-50 px-2 py-1 rounded border border-green-200">✓ Press Tab or click outside to load existing data</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                2) Circle:
              </label>
              <input
                type="text"
                name="circle"
                value={formData.circle}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                3) Division:
              </label>
              <input
                type="text"
                name="division"
                value={formData.division}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <span className="ml-2">Sub-Division:</span>
              </label>
              <input
                type="text"
                name="subDivision"
                value={formData.subDivision}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold text-xs">5</span>
                <span className="ml-2">O&M:</span>
              </label>
              <input
                type="text"
                name="om"
                value={formData.om}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold text-xs">6</span>
                <span className="ml-2">Date of Commission:</span>
              </label>
              <input
                type="date"
                name="dateOfCommission"
                value={formData.dateOfCommission}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold text-xs">7</span>
                <span className="ml-2">Feeder Number & Name:</span>
              </label>
              <input
                type="text"
                name="feederNumberAndName"
                value={formData.feederNumberAndName}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold text-xs">8</span>
                <span className="ml-2">Inspection Date:</span>
              </label>
              <input
                type="date"
                name="inspectionDate"
                value={formData.inspectionDate}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold text-xs">9</span>
                <span className="ml-2">RMU Make/Type:</span>
              </label>
              <input
                type="text"
                name="rmuMakeType"
                value={formData.rmuMakeType}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold text-xs">10</span>
                <span className="ml-2">Location/HRN:</span>
              </label>
              <input
                type="text"
                name="locationHRN"
                value={formData.locationHRN}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold text-xs">11</span>
                <span className="ml-2">Serial No:</span>
              </label>
              <input
                type="text"
                name="serialNo"
                value={formData.serialNo}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold text-xs">12</span>
                <span className="ml-2">Lat & Long:</span>
              </label>
              <input
                type="text"
                name="latLong"
                value={formData.latLong}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                placeholder="e.g., 12.9716° N, 77.5946° E"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold text-xs">13</span>
                <span className="ml-2">Warranty Status:</span>
              </label>
              <input
                type="text"
                name="warrantyStatus"
                value={formData.warrantyStatus}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold text-xs">14</span>
                <span className="ml-2">C/o Feeder name:</span>
              </label>
              <input
                type="text"
                name="coFeederName"
                value={formData.coFeederName}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Fields 15-19 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4">Additional Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                15) Previous AMC Date:
              </label>
              <input
                type="date"
                name="previousAMCDate"
                value={formData.previousAMCDate}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                16) MFM make:
              </label>
              <input
                type="text"
                name="mfmMake"
                value={formData.mfmMake}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                17) Relay Make & Model No:
              </label>
              <input
                type="text"
                name="relayMakeModelNo"
                value={formData.relayMakeModelNo}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                18) FPI Make & Model No:
              </label>
              <input
                type="text"
                name="fpiMakeModelNo"
                value={formData.fpiMakeModelNo}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                19) RTU Make & Slno:
              </label>
              <input
                type="text"
                name="rtuMakeSlno"
                value={formData.rtuMakeSlno}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Fields 20-26 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4">RMU Status & Conditions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                20) RMU Status:
              </label>
              <select
                name="rmuStatus"
                value={formData.rmuStatus || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select...</option>
                {['Working', 'Idler', 'Faulty'].map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                21) 24V Availability:
              </label>
              <select
                name="availability24V"
                value={formData.availability24V || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select...</option>
                {['YES', 'NO'].map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">22) PT Voltage(110V) availability:</label>
              <select
                name="ptVoltageAvailability"
                value={formData.ptVoltageAvailability || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select...</option>
                {['YES', 'NO'].map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">23) Battery charger condition:</label>
              <select
                name="batteryChargerCondition"
                value={formData.batteryChargerCondition || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select...</option>
                {['Healthy', 'Faulty'].map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">24) Earthing connection:</label>
              <select
                name="earthingConnection"
                value={formData.earthingConnection || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select...</option>
                {['Good', 'Poor', 'Disconnected'].map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">25) Comm. Accessories availability:</label>
              <select
                name="commAccessoriesAvailability"
                value={formData.commAccessoriesAvailability || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select...</option>
                {['Available', 'Not Available'].map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">26) Relay Group change from 1 to 2 command from CCR:</label>
              <select
                name="relayGroupChange"
                value={formData.relayGroupChange || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select...</option>
                {['Updating in relay', 'Not updating in relay'].map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Fields 27-40: RMU Status & Conditions (Continued) */}
        <div className="bg-white rounded-lg shadow-sm p-6" style={{ display: 'block', visibility: 'visible' }}>
          <h3 className="text-lg font-semibold mb-4">RMU Status & Conditions (Continued) - Fields 27-40</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Field 27 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">27) FPI Status:</label>
              <select
                name="fpiStatus"
                value={formData.fpiStatus || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select...</option>
                {['Good', 'Faulty', 'Battery Faulty'].map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            {/* Fields 28-33 */}
            <div key="field-28">
              <label className="block text-sm font-medium text-gray-700 mb-2">28) 12V Availability:</label>
              <select
                name="availability12V"
                value={formData.availability12V || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select...</option>
                {['YES', 'NO'].map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            <div key="field-29" style={{ minHeight: '80px' }}>
              <label className="block text-sm font-medium text-gray-700 mb-2">29) Over all Wiring issue:</label>
              <select
                name="overallWiringIssue"
                value={formData.overallWiringIssue || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select...</option>
                {['YES', 'NO', 'Can be rectify'].map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            <div key="field-30" style={{ minHeight: '80px' }}>
              <label className="block text-sm font-medium text-gray-700 mb-2">30) Control card:</label>
              <select
                name="controlCard"
                value={formData.controlCard || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select...</option>
                {['Healthy', 'Faulty'].map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            <div key="field-31" style={{ minHeight: '80px' }}>
              <label className="block text-sm font-medium text-gray-700 mb-2">31) Bedding condition:</label>
              <select
                name="beddingCondition"
                value={formData.beddingCondition || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select...</option>
                {['Good', 'Damaged', 'Poor'].map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            <div key="field-32" style={{ minHeight: '80px' }}>
              <label className="block text-sm font-medium text-gray-700 mb-2">32) Battery Status:</label>
              <select
                name="batteryStatus"
                value={formData.batteryStatus || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select...</option>
                {['Good', 'Faulty', 'Not Available'].map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            <div key="field-33" style={{ minHeight: '80px' }}>
              <label className="block text-sm font-medium text-gray-700 mb-2">33) Relay Group change from 1 to 2 command from CCR:</label>
              <select
                name="relayGroupChangeUpdate"
                value={formData.relayGroupChangeUpdate || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select...</option>
                {['Updating in relay', 'Not updating in relay'].map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
            <div key="field-34" style={{ minHeight: '80px' }}>
              <label className="block text-sm font-medium text-gray-700 mb-2">34) 230V Availability:</label>
              <select
                name="availability230V"
                value={formData.availability230V || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select...</option>
                {['YES', 'NO'].map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            <div key="field-35" style={{ minHeight: '80px' }}>
              <label className="block text-sm font-medium text-gray-700 mb-2">35) SF6 Gas:</label>
              <select
                name="sf6Gas"
                value={formData.sf6Gas || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select...</option>
                {['Green', 'Red'].map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            <div key="field-36" style={{ minHeight: '80px' }}>
              <label className="block text-sm font-medium text-gray-700 mb-2">36) RMU location same as GIS data?:</label>
              <select
                name="rmuLocationSameAsGIS"
                value={formData.rmuLocationSameAsGIS || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select...</option>
                {['YES', 'Shifted'].map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            <div key="field-37" style={{ minHeight: '80px' }}>
              <label className="block text-sm font-medium text-gray-700 mb-2">37) Door Hydraulics:</label>
              <select
                name="doorHydraulics"
                value={formData.doorHydraulics || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select...</option>
                {['Good', 'Faulty'].map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            <div key="field-38" style={{ minHeight: '80px' }}>
              <label className="block text-sm font-medium text-gray-700 mb-2">38) Control cabinet door:</label>
              <select
                name="controlCabinetDoor"
                value={formData.controlCabinetDoor || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select...</option>
                {['Good', 'Damaged', 'Poor'].map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            <div key="field-39" style={{ minHeight: '80px' }}>
              <label className="block text-sm font-medium text-gray-700 mb-2">39) Door Gasket:</label>
              <select
                name="doorGasket"
                value={formData.doorGasket || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select...</option>
                {['Good', 'Damaged', 'Poor'].map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            <div key="field-40" style={{ minHeight: '80px' }}>
              <label className="block text-sm font-medium text-gray-700 mb-2">40) Dummy Latch command from CCR:</label>
              <select
                name="dummyLatchCommand"
                value={formData.dummyLatchCommand || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select...</option>
                {['Working', 'Not Working'].map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Table Section for Fields 41-59 - OD1, OD2, VL1, VL2, VL3 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4">RMU Terminal Details</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse border border-gray-300">
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-4 py-2 text-left text-sm font-medium" style={{ position: 'sticky', top: 0, background: '#f3f4f6' }}>S.No</th>
                  <th className="border border-gray-300 px-4 py-2 text-left text-sm font-medium" style={{ position: 'sticky', top: 0, background: '#f3f4f6' }}>Description</th>
                  <th className="border border-gray-300 px-4 py-2 text-center text-sm font-medium" style={{ position: 'sticky', top: 0, background: '#f3f4f6' }}>OD1</th>
                  <th className="border border-gray-300 px-4 py-2 text-center text-sm font-medium" style={{ position: 'sticky', top: 0, background: '#f3f4f6' }}>OD2</th>
                  <th className="border border-gray-300 px-4 py-2 text-center text-sm font-medium" style={{ position: 'sticky', top: 0, background: '#f3f4f6' }}>VL1</th>
                  <th className="border border-gray-300 px-4 py-2 text-center text-sm font-medium" style={{ position: 'sticky', top: 0, background: '#f3f4f6' }}>VL2</th>
                  <th className="border border-gray-300 px-4 py-2 text-center text-sm font-medium" style={{ position: 'sticky', top: 0, background: '#f3f4f6' }}>VL3</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {/* Row 41: Cables connected status */}
                <tr>
                  <td className="border border-gray-300 px-4 py-2 text-sm">41</td>
                  <td className="border border-gray-300 px-4 py-2 text-sm">Cables connected status</td>
                  {['od1', 'od2', 'vl1', 'vl2', 'vl3'].map(prefix => (
                    <td key={prefix} className="border border-gray-300 px-4 py-2">
                      <div className="flex flex-col gap-2">
                        {['YES', 'NO'].map(option => (
                          <label key={option} className="flex items-center text-xs">
                            <input
                              type="radio"
                              name={`${prefix}_cablesConnected`}
                              value={option}
                              checked={formData[`${prefix}_cablesConnected` as keyof typeof formData] === option}
                              onChange={(e) => handleRadioChange(`${prefix}_cablesConnected`, e.target.value)}
                              className="mr-1"
                            />
                            {option}
                          </label>
                        ))}
                      </div>
                    </td>
                  ))}
                </tr>

                {/* Row 42: Connected to I/C or O/G */}
                <tr>
                  <td className="border border-gray-300 px-4 py-2 text-sm">42</td>
                  <td className="border border-gray-300 px-4 py-2 text-sm">Connected to I/C or O/G</td>
                  {['od1', 'od2', 'vl1', 'vl2', 'vl3'].map(prefix => (
                    <td key={prefix} className="border border-gray-300 px-4 py-2">
                      <div className="flex flex-col gap-1">
                        {(prefix.startsWith('vl') ? ['I/C', 'C/O', 'Load'] : ['I/C', 'O/G']).map(option => (
                          <label key={option} className="flex items-center text-xs">
                            <input
                              type="radio"
                              name={`${prefix}_connectedTo`}
                              value={option}
                              checked={formData[`${prefix}_connectedTo` as keyof typeof formData] === option}
                              onChange={(e) => handleRadioChange(`${prefix}_connectedTo`, e.target.value)}
                              className="mr-1"
                            />
                            {option}
                          </label>
                        ))}
                      </div>
                    </td>
                  ))}
                </tr>

                {/* Row 43-45: Load in Amps */}
                <tr>
                  <td className="border border-gray-300 px-4 py-2 text-sm">43</td>
                  <td className="border border-gray-300 px-4 py-2 text-sm">Load in Amps R Phase:</td>
                  {['od1', 'od2', 'vl1', 'vl2', 'vl3'].map(prefix => (
                    <td key={prefix} className="border border-gray-300 px-4 py-2">
                      <input
                        type="text"
                        name={`${prefix}_loadAmpsR`}
                        value={formData[`${prefix}_loadAmpsR` as keyof typeof formData] as string}
                        onChange={handleChange}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                        placeholder="Enter value"
                      />
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="border border-gray-300 px-4 py-2 text-sm">44</td>
                  <td className="border border-gray-300 px-4 py-2 text-sm">Load in Amps Y Phase:</td>
                  {['od1', 'od2', 'vl1', 'vl2', 'vl3'].map(prefix => (
                    <td key={prefix} className="border border-gray-300 px-4 py-2">
                      <input
                        type="text"
                        name={`${prefix}_loadAmpsY`}
                        value={formData[`${prefix}_loadAmpsY` as keyof typeof formData] as string}
                        onChange={handleChange}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                        placeholder="Enter value"
                      />
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="border border-gray-300 px-4 py-2 text-sm">45</td>
                  <td className="border border-gray-300 px-4 py-2 text-sm">Load in Amps B Phase:</td>
                  {['od1', 'od2', 'vl1', 'vl2', 'vl3'].map(prefix => (
                    <td key={prefix} className="border border-gray-300 px-4 py-2">
                      <input
                        type="text"
                        name={`${prefix}_loadAmpsB`}
                        value={formData[`${prefix}_loadAmpsB` as keyof typeof formData] as string}
                        onChange={handleChange}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                        placeholder="Enter value"
                      />
                    </td>
                  ))}
                </tr>

                {/* Row 46: Switch position */}
                <tr>
                  <td className="border border-gray-300 px-4 py-2 text-sm">46</td>
                  <td className="border border-gray-300 px-4 py-2 text-sm">Switch position</td>
                  {['od1', 'od2', 'vl1', 'vl2', 'vl3'].map(prefix => (
                    <td key={prefix} className="border border-gray-300 px-4 py-2">
                      <div className="flex flex-col gap-1">
                        {['Open', 'Close', 'Earth'].map(option => (
                          <label key={option} className="flex items-center text-xs">
                            <input
                              type="radio"
                              name={`${prefix}_switchPosition`}
                              value={option}
                              checked={formData[`${prefix}_switchPosition` as keyof typeof formData] === option}
                              onChange={(e) => handleRadioChange(`${prefix}_switchPosition`, e.target.value)}
                              className="mr-1"
                            />
                            {option}
                          </label>
                        ))}
                      </div>
                    </td>
                  ))}
                </tr>

                {/* Row 47: ON/OFF Motors working status */}
                <tr>
                  <td className="border border-gray-300 px-4 py-2 text-sm">47</td>
                  <td className="border border-gray-300 px-4 py-2 text-sm">ON/OFF Motors working status</td>
                  {['od1', 'od2', 'vl1', 'vl2', 'vl3'].map(prefix => (
                    <td key={prefix} className="border border-gray-300 px-4 py-2">
                      <div className="flex flex-col gap-1">
                        {['YES', 'NO', 'NA', 'Removed', 'Missing'].map(option => (
                          <label key={option} className="flex items-center text-xs">
                            <input
                              type="radio"
                              name={`${prefix}_onOffMotors`}
                              value={option}
                              checked={formData[`${prefix}_onOffMotors` as keyof typeof formData] === option}
                              onChange={(e) => handleRadioChange(`${prefix}_onOffMotors`, e.target.value)}
                              className="mr-1"
                            />
                            {option}
                          </label>
                        ))}
                      </div>
                    </td>
                  ))}
                </tr>

                {/* Row 48: Healthiness of switch Mechanisms */}
                <tr>
                  <td className="border border-gray-300 px-4 py-2 text-sm">48</td>
                  <td className="border border-gray-300 px-4 py-2 text-sm">Healthiness of switch Mechanisms</td>
                  {['od1', 'od2', 'vl1', 'vl2', 'vl3'].map(prefix => (
                    <td key={prefix} className="border border-gray-300 px-4 py-2">
                      <div className="flex flex-col gap-1">
                        {['Working', 'Not Working'].map(option => (
                          <label key={option} className="flex items-center text-xs">
                            <input
                              type="radio"
                              name={`${prefix}_healthinessSwitch`}
                              value={option}
                              checked={formData[`${prefix}_healthinessSwitch` as keyof typeof formData] === option}
                              onChange={(e) => handleRadioChange(`${prefix}_healthinessSwitch`, e.target.value)}
                              className="mr-1"
                            />
                            {option}
                          </label>
                        ))}
                      </div>
                    </td>
                  ))}
                </tr>

                {/* Row 49: Breaker Status */}
                <tr>
                  <td className="border border-gray-300 px-4 py-2 text-sm">49</td>
                  <td className="border border-gray-300 px-4 py-2 text-sm">Breaker Status</td>
                  {['od1', 'od2', 'vl1', 'vl2', 'vl3'].map(prefix => (
                    <td key={prefix} className="border border-gray-300 px-4 py-2">
                      <div className="flex flex-col gap-1">
                        {['Charged', 'Idle'].map(option => (
                          <label key={option} className="flex items-center text-xs">
                            <input
                              type="radio"
                              name={`${prefix}_breakerStatus`}
                              value={option}
                              checked={formData[`${prefix}_breakerStatus` as keyof typeof formData] === option}
                              onChange={(e) => handleRadioChange(`${prefix}_breakerStatus`, e.target.value)}
                              className="mr-1"
                            />
                            {option}
                          </label>
                        ))}
                      </div>
                    </td>
                  ))}
                </tr>

                {/* Row 50: Cable entry Doors status */}
                <tr>
                  <td className="border border-gray-300 px-4 py-2 text-sm">50</td>
                  <td className="border border-gray-300 px-4 py-2 text-sm">Cable entry Doors status</td>
                  {['od1', 'od2', 'vl1', 'vl2', 'vl3'].map(prefix => (
                    <td key={prefix} className="border border-gray-300 px-4 py-2">
                      <div className="flex flex-col gap-1">
                        {['Good', 'Damage', 'Missing'].map(option => (
                          <label key={option} className="flex items-center text-xs">
                            <input
                              type="radio"
                              name={`${prefix}_cableEntryDoors`}
                              value={option}
                              checked={formData[`${prefix}_cableEntryDoors` as keyof typeof formData] === option}
                              onChange={(e) => handleRadioChange(`${prefix}_cableEntryDoors`, e.target.value)}
                              className="mr-1"
                            />
                            {option}
                          </label>
                        ))}
                      </div>
                    </td>
                  ))}
                </tr>

                {/* Row 51: Is the cable are Clamped properly and Vermin proof */}
                <tr>
                  <td className="border border-gray-300 px-4 py-2 text-sm">51</td>
                  <td className="border border-gray-300 px-4 py-2 text-sm">Is the cable are Clamped properly and Vermin proof</td>
                  {['od1', 'od2', 'vl1', 'vl2', 'vl3'].map(prefix => (
                    <td key={prefix} className="border border-gray-300 px-4 py-2">
                      <div className="flex flex-col gap-1">
                        {['YES', 'NO'].map(option => (
                          <label key={option} className="flex items-center text-xs">
                            <input
                              type="radio"
                              name={`${prefix}_cableClamped`}
                              value={option}
                              checked={formData[`${prefix}_cableClamped` as keyof typeof formData] === option}
                              onChange={(e) => handleRadioChange(`${prefix}_cableClamped`, e.target.value)}
                              className="mr-1"
                            />
                            {option}
                          </label>
                        ))}
                      </div>
                    </td>
                  ))}
                </tr>

                {/* Row 52: Local/remote switch status */}
                <tr>
                  <td className="border border-gray-300 px-4 py-2 text-sm">52</td>
                  <td className="border border-gray-300 px-4 py-2 text-sm">Local/remote switch status</td>
                  {['od1', 'od2', 'vl1', 'vl2', 'vl3'].map(prefix => (
                    <td key={prefix} className="border border-gray-300 px-4 py-2">
                      <div className="flex flex-col gap-1">
                        {['Good', 'Faulty'].map(option => (
                          <label key={option} className="flex items-center text-xs">
                            <input
                              type="radio"
                              name={`${prefix}_localRemoteSwitch`}
                              value={option}
                              checked={formData[`${prefix}_localRemoteSwitch` as keyof typeof formData] === option}
                              onChange={(e) => handleRadioChange(`${prefix}_localRemoteSwitch`, e.target.value)}
                              className="mr-1"
                            />
                            {option}
                          </label>
                        ))}
                      </div>
                    </td>
                  ))}
                </tr>

                {/* Row 53: VPIS Indication */}
                <tr>
                  <td className="border border-gray-300 px-4 py-2 text-sm">53</td>
                  <td className="border border-gray-300 px-4 py-2 text-sm">VPIS Indication</td>
                  {['od1', 'od2', 'vl1', 'vl2', 'vl3'].map(prefix => (
                    <td key={prefix} className="border border-gray-300 px-4 py-2">
                      <div className="flex flex-col gap-1">
                        {['Good', 'Faulty'].map(option => (
                          <label key={option} className="flex items-center text-xs">
                            <input
                              type="radio"
                              name={`${prefix}_vpisIndication`}
                              value={option}
                              checked={formData[`${prefix}_vpisIndication` as keyof typeof formData] === option}
                              onChange={(e) => handleRadioChange(`${prefix}_vpisIndication`, e.target.value)}
                              className="mr-1"
                            />
                            {option}
                          </label>
                        ))}
                      </div>
                    </td>
                  ))}
                </tr>

                {/* Row 54: MFM Working condition (OD1, OD2 only) */}
                <tr>
                  <td className="border border-gray-300 px-4 py-2 text-sm">54</td>
                  <td className="border border-gray-300 px-4 py-2 text-sm">MFM Working condition</td>
                  {['od1', 'od2', 'vl1', 'vl2', 'vl3'].map(prefix => (
                    <td key={prefix} className="border border-gray-300 px-4 py-2">
                      {prefix.startsWith('vl') ? (
                        <span className="text-xs text-gray-400">-</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {['Good', 'Faulty'].map(option => (
                            <label key={option} className="flex items-center text-xs">
                              <input
                                type="radio"
                                name={`${prefix}_mfmWorking`}
                                value={option}
                                checked={formData[`${prefix}_mfmWorking` as keyof typeof formData] === option}
                                onChange={(e) => handleRadioChange(`${prefix}_mfmWorking`, e.target.value)}
                                className="mr-1"
                              />
                              {option}
                            </label>
                          ))}
                        </div>
                      )}
                    </td>
                  ))}
                </tr>

                {/* Row 55: Relay working condition (VL1, VL2, VL3 only) */}
                <tr>
                  <td className="border border-gray-300 px-4 py-2 text-sm">55</td>
                  <td className="border border-gray-300 px-4 py-2 text-sm">Relay working condition</td>
                  {['od1', 'od2', 'vl1', 'vl2', 'vl3'].map(prefix => (
                    <td key={prefix} className="border border-gray-300 px-4 py-2">
                      {prefix.startsWith('od') ? (
                        <span className="text-xs text-gray-400">-</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {['Good', 'Faulty'].map(option => (
                            <label key={option} className="flex items-center text-xs">
                              <input
                                type="radio"
                                name={`${prefix}_relayWorking`}
                                value={option}
                                checked={formData[`${prefix}_relayWorking` as keyof typeof formData] === option}
                                onChange={(e) => handleRadioChange(`${prefix}_relayWorking`, e.target.value)}
                                className="mr-1"
                              />
                              {option}
                            </label>
                          ))}
                        </div>
                      )}
                    </td>
                  ))}
                </tr>

                {/* Row 56: RMU side24 pin output as per requirement? */}
                <tr>
                  <td className="border border-gray-300 px-4 py-2 text-sm">56</td>
                  <td className="border border-gray-300 px-4 py-2 text-sm">RMU side24 pin output as per requirement?</td>
                  {['od1', 'od2', 'vl1', 'vl2', 'vl3'].map(prefix => (
                    <td key={prefix} className="border border-gray-300 px-4 py-2">
                      <div className="flex flex-col gap-1">
                        {['YES', 'NO'].map(option => (
                          <label key={option} className="flex items-center text-xs">
                            <input
                              type="radio"
                              name={`${prefix}_rmuSide24Pin`}
                              value={option}
                              checked={formData[`${prefix}_rmuSide24Pin` as keyof typeof formData] === option}
                              onChange={(e) => handleRadioChange(`${prefix}_rmuSide24Pin`, e.target.value)}
                              className="mr-1"
                            />
                            {option}
                          </label>
                        ))}
                      </div>
                    </td>
                  ))}
                </tr>

                {/* Row 57: Cable Size in Sqmm */}
                <tr>
                  <td className="border border-gray-300 px-4 py-2 text-sm">57</td>
                  <td className="border border-gray-300 px-4 py-2 text-sm">Cable Size in Sqmm</td>
                  {['od1', 'od2', 'vl1', 'vl2', 'vl3'].map(prefix => (
                    <td key={prefix} className="border border-gray-300 px-4 py-2">
                      <div className="flex flex-col gap-1">
                        {(prefix.startsWith('vl') ? ['400', '240', '95'] : ['400', '240']).map(option => (
                          <label key={option} className="flex items-center text-xs">
                            <input
                              type="radio"
                              name={`${prefix}_cableSize`}
                              value={option}
                              checked={formData[`${prefix}_cableSize` as keyof typeof formData] === option}
                              onChange={(e) => handleRadioChange(`${prefix}_cableSize`, e.target.value)}
                              className="mr-1"
                            />
                            {option}
                          </label>
                        ))}
                      </div>
                    </td>
                  ))}
                </tr>

                {/* Row 58: Electrical operation */}
                <tr>
                  <td className="border border-gray-300 px-4 py-2 text-sm">58</td>
                  <td className="border border-gray-300 px-4 py-2 text-sm">Electrical operation</td>
                  {['od1', 'od2', 'vl1', 'vl2', 'vl3'].map(prefix => (
                    <td key={prefix} className="border border-gray-300 px-4 py-2">
                      <div className="flex flex-col gap-1">
                        {['Operating', 'Not Operating'].map(option => (
                          <label key={option} className="flex items-center text-xs">
                            <input
                              type="radio"
                              name={`${prefix}_electricalOperation`}
                              value={option}
                              checked={formData[`${prefix}_electricalOperation` as keyof typeof formData] === option}
                              onChange={(e) => handleRadioChange(`${prefix}_electricalOperation`, e.target.value)}
                              className="mr-1"
                            />
                            {option}
                          </label>
                        ))}
                      </div>
                    </td>
                  ))}
                </tr>

                {/* Row 59: Remote operation */}
                <tr>
                  <td className="border border-gray-300 px-4 py-2 text-sm">59</td>
                  <td className="border border-gray-300 px-4 py-2 text-sm">Remote operation</td>
                  {['od1', 'od2', 'vl1', 'vl2', 'vl3'].map(prefix => (
                    <td key={prefix} className="border border-gray-300 px-4 py-2">
                      <div className="flex flex-col gap-1">
                        {['Operating', 'Not Operating'].map(option => (
                          <label key={option} className="flex items-center text-xs">
                            <input
                              type="radio"
                              name={`${prefix}_remoteOperation`}
                              value={option}
                              checked={formData[`${prefix}_remoteOperation` as keyof typeof formData] === option}
                              onChange={(e) => handleRadioChange(`${prefix}_remoteOperation`, e.target.value)}
                              className="mr-1"
                            />
                            {option}
                          </label>
                        ))}
                      </div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Field 60: Cable I/C from or O/G to - separated for each terminal */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4">60) Cable I/C from or O/G to:</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse border border-gray-300">
              <thead>
                <tr>
                  <th className="border border-gray-300 px-4 py-2 text-sm font-medium bg-gray-50 w-16">S.No</th>
                  <th className="border border-gray-300 px-4 py-2 text-sm font-medium bg-gray-50">Field</th>
                  <th className="border border-gray-300 px-4 py-2 text-sm font-medium bg-gray-50">OD1</th>
                  <th className="border border-gray-300 px-4 py-2 text-sm font-medium bg-gray-50">OD2</th>
                  <th className="border border-gray-300 px-4 py-2 text-sm font-medium bg-gray-50">VL1</th>
                  <th className="border border-gray-300 px-4 py-2 text-sm font-medium bg-gray-50">VL2</th>
                  <th className="border border-gray-300 px-4 py-2 text-sm font-medium bg-gray-50">VL3</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-300 px-4 py-2 text-sm">60</td>
                  <td className="border border-gray-300 px-4 py-2 text-sm">Cable I/C from or O/G to</td>
                  {['od1', 'od2', 'vl1', 'vl2', 'vl3'].map(prefix => (
                    <td key={prefix} className="border border-gray-300 px-4 py-2">
                      <input
                        type="text"
                        name={`${prefix}_cableICFromOrOGTo`}
                        value={formData[`${prefix}_cableICFromOrOGTo` as keyof typeof formData] as string}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        placeholder="e.g., DAS, Corporate Office"
                      />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Field 61: Remarks */}
        <div className="bg-white rounded-lg shadow-sm p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">61) Remarks/ Issues if any to be reported here with corresponding serial no:</label>
            <textarea
              name="remarks"
              value={formData.remarks}
              onChange={handleChange}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter remarks or issues..."
            />
        </div>

        {/* Fields 62, 63, 64: Side by side layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Field 62: Capture 5 images */}
        <div className="bg-white rounded-lg shadow-sm p-6">
            <label className="block text-sm font-medium text-gray-700 mb-4">62) Capture 5 images:</label>
            
            {/* Camera Section */}
            <div className="mb-6">
              <div className="flex gap-4 mb-4">
                <button
                  type="button"
                  onClick={startCamera}
                  disabled={isCameraActive || images.length >= 5}
                  className="px-6 py-3 text-base font-semibold text-white bg-green-600 hover:bg-green-700 rounded-md shadow-md disabled:opacity-50 disabled:cursor-not-allowed border-2 border-green-700"
                  style={{ backgroundColor: '#16a34a' }}
                >
                  Start Camera
                </button>
                {isCameraActive && (
                  <>
                    <button
                      type="button"
                      onClick={captureImage}
                      disabled={images.length >= 5}
                      className="px-6 py-3 text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-2 border-blue-700"
                    >
                      Capture Photo ({images.length}/5)
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="px-6 py-3 text-base font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md shadow-md transition-colors border-2 border-red-700"
                    >
                      Stop Camera
                    </button>
                  </>
                )}
              </div>

              {cameraError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {cameraError}
                </div>
              )}

              {isCameraActive && (
                <div className="mb-4 relative bg-black rounded-lg overflow-hidden" style={{ minHeight: '300px', maxHeight: '400px' }}>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full rounded-lg"
                    style={{ 
                      maxHeight: '400px', 
                      minHeight: '300px',
                      objectFit: 'contain',
                      display: 'block',
                      backgroundColor: '#000'
                    }}
                  />
                  {cameraError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white rounded-lg">
                      <div className="text-center p-4">
                        <svg className="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <p className="text-sm">{cameraError}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Manual Upload Section */}
            <div className="mb-6">
              <div className="flex items-center gap-4 mb-4">
                <span className="text-sm text-gray-600 font-medium">OR</span>
                <label 
                  className="px-6 py-3 text-base font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border-2 border-red-700 inline-block"
                  style={{ 
                    display: images.length >= 5 ? 'none' : 'inline-block',
                    backgroundColor: '#dc2626'
                  }}
                >
                  Upload Photos Manually
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileUpload}
                    disabled={images.length >= 5}
                    className="hidden"
                  />
                </label>
              </div>
              {images.length >= 5 && (
                <p className="text-sm text-green-600 font-medium">Maximum 5 images reached</p>
              )}
            </div>

            {/* Display Captured/Uploaded Images */}
            {images.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Captured/Uploaded Images ({images.length}/5):</h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {images.map((image, index) => (
                    <div key={index} className="relative border border-gray-300 rounded-lg overflow-hidden">
                      <img
                        src={image}
                        alt={`Capture ${index + 1}`}
                        className="w-full h-32 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-base font-bold hover:bg-red-700 shadow-lg border-2 border-red-700"
                        title="Remove image"
                      >
                        ×
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 text-center">
                        Image {index + 1}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </div>

        {/* Field 63: Capture 1 Minute Video */}
        <div className="bg-white rounded-lg shadow-sm p-6">
            <label className="block text-sm font-medium text-gray-700 mb-4">63) Capture 1 Minute Video:</label>
            
            {/* Video Recording Section */}
            <div className="mb-6">
              <div className="flex gap-4 mb-4">
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={isRecording || !!recordedVideo}
                  className="px-6 py-3 text-base font-semibold text-white bg-green-600 hover:bg-green-700 rounded-md shadow-md disabled:opacity-50 disabled:cursor-not-allowed border-2 border-green-700"
                  style={{ backgroundColor: '#16a34a' }}
                >
                  Start Recording
                </button>
                {isRecording && (
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="px-6 py-3 text-base font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md shadow-md border-2 border-red-700"
                  >
                    Stop Recording ({60 - recordingTime}s)
                  </button>
                )}
              </div>

              {recordingError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {recordingError}
                </div>
              )}

              {isRecording && (
                <div className="mb-4 relative bg-black rounded-lg overflow-hidden" style={{ minHeight: '300px', maxHeight: '400px' }}>
                  <video
                    ref={recordingVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full rounded-lg"
                    style={{ 
                      maxHeight: '400px', 
                      minHeight: '300px',
                      objectFit: 'contain',
                      display: 'block',
                      backgroundColor: '#000'
                    }}
                  />
                  {recordingError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white rounded-lg">
                      <div className="text-center p-4">
                        <svg className="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <p className="text-sm">{recordingError}</p>
                      </div>
                    </div>
                  )}
                  <div className="absolute bottom-4 left-0 right-0 text-center">
                    <p className="text-white text-sm font-medium bg-black bg-opacity-50 px-4 py-2 rounded-lg inline-block">
                      Recording: {recordingTime} / 60 seconds
                    </p>
                    <div className="w-full max-w-md mx-auto bg-gray-900 bg-opacity-50 rounded-full h-2 mt-2">
                      <div
                        className="bg-red-600 h-2 rounded-full transition-all duration-1000"
                        style={{ width: `${(recordingTime / 60) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Manual Video Upload Section */}
            <div className="mb-6">
              <div className="flex items-center gap-4 mb-4">
                <span className="text-sm text-gray-600 font-medium">OR</span>
                <label 
                  className="px-6 py-3 text-base font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border-2 border-red-700 inline-block"
                  style={{ 
                    display: recordedVideo ? 'none' : 'inline-block',
                    backgroundColor: '#dc2626'
                  }}
                >
                  Upload Video
                  <input
                    ref={videoFileInputRef}
                    type="file"
                    accept="video/*"
                    onChange={handleVideoUpload}
                    disabled={!!recordedVideo}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Display Recorded/Uploaded Video */}
            {recordedVideo && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-700">Recorded/Uploaded Video:</h4>
                  <button
                    type="button"
                    onClick={removeVideo}
                    className="px-6 py-3 text-base font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md shadow-md transition-colors border-2 border-red-700"
                  >
                    Remove Video
                  </button>
                </div>
                <div className="border border-gray-300 rounded-lg overflow-hidden">
                  <video
                    src={recordedVideo || undefined}
                    controls
                    className="w-full max-w-2xl"
                    style={{ maxHeight: '500px' }}
                  />
                </div>
              </div>
            )}
        </div>

        {/* Field 64: Upload Hard Copy (PDF) */}
        <div className="bg-white rounded-lg shadow-sm p-6">
            <label className="block text-sm font-medium text-gray-700 mb-4">64) Upload Hard Copy If Available:</label>
            
            {/* PDF Upload Section */}
            <div className="mb-6">
              <div className="flex items-center gap-4 mb-4">
                <label 
                  className="px-6 py-3 text-base font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border-2 border-red-700 inline-block"
                  style={{ 
                    display: pdfFile ? 'none' : 'inline-block',
                    backgroundColor: '#dc2626'
                  }}
                >
                  Upload PDF (Max 100KB)
                  <input
                    ref={pdfFileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handlePdfUpload}
                    disabled={!!pdfFile}
                    className="hidden"
                  />
                </label>
                {pdfFile && (
                  <button
                    type="button"
                    onClick={removePdf}
                    className="px-6 py-3 text-base font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md shadow-md transition-colors border-2 border-red-700"
                  >
                    Remove PDF
                  </button>
                )}
              </div>

              {pdfError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {pdfError}
                </div>
              )}

              {pdfFile && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        {pdfFile?.name}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Size: {pdfFile ? formatFileSize(pdfFile.size) : '0'} / 100 KB
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded">
                        ✓ Valid
                      </span>
                    </div>
                  </div>
                  
                  {pdfPreview && (
                    <div className="border border-gray-300 rounded-lg overflow-hidden">
                      <iframe
                        src={pdfPreview || undefined}
                        className="w-full"
                        style={{ height: '600px' }}
                        title="PDF Preview"
                      />
                    </div>
                  )}
                </div>
              )}

              {!pdfFile && (
                <div className="text-xs text-gray-500 mt-2">
                  <p>• File format: PDF only</p>
                  <p>• Maximum file size: 100 KB</p>
                </div>
              )}
            </div>
        </div>
        </div>

        {/* Submit Buttons */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={resetForm}
              className="px-8 py-3 text-base font-semibold text-gray-700 bg-white hover:bg-gray-50 rounded-md border-2 border-gray-400 shadow-md"
            >
              Clear Form
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-8 py-3 text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-md disabled:opacity-50 disabled:cursor-not-allowed border-2 border-blue-700"
              style={{ backgroundColor: '#2563eb' }}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Inspection'}
            </button>
          </div>
          {submitError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {submitError}
            </div>
          )}
          {submitSuccess && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              Inspection submitted successfully! The data has been saved to the database.
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
