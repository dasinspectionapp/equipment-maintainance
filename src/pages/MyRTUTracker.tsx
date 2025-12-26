import { useEffect, useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { API_BASE } from '../utils/api';
import { compressImage } from '../utils/imageCompression';

const PAGE_SIZE_OPTIONS = [25, 50, 75, 100];

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: Date | string;
}

function getCurrentUser() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user || {};
  } catch {
    return {};
  }
}

function getCurrentUserRole() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user?.role || '';
  } catch {
    return '';
  }
}

function normalize(str: string): string {
  return str.trim().toLowerCase();
}

// Helper function to convert Excel serial date to DD-MM-YYYY format
function convertExcelSerialToDate(value: any): string | any {
  // If value is null, undefined, or empty string, return as is
  if (value === null || value === undefined || value === '') {
    return value;
  }

  // If it's already a string that looks like a date (DD-MM-YYYY, etc.), return as is
  if (typeof value === 'string') {
    const trimmed = value.trim();
    // Check if it's already in a date format (contains dashes or slashes)
    if (trimmed.includes('-') || trimmed.includes('/') || trimmed.includes('.')) {
      return trimmed;
    }
    // Check if it's a numeric string (Excel serial)
    if (/^\d+$/.test(trimmed)) {
      const numValue = parseFloat(trimmed);
      // If it looks like a year (1900-2100), don't treat as Excel serial
      if (numValue >= 1900 && numValue <= 2100) {
        return trimmed;
      }
      // Check if it's in Excel serial range (1-1000000)
      // Excel serial dates: 1 = Jan 1, 1900, ~36526 = Jan 1, 2000, ~45975 = Nov 14, 2025
      // Excel incorrectly treats 1900 as a leap year, so for dates >= 60, we subtract 1 day
      if (numValue >= 1 && numValue <= 1000000) {
        let excelDate: Date;
        // Excel serial dates: 1 = Jan 1, 1900 (day 1 of year 1900)
        // For serial < 60: dates are before the false leap day, so use serial directly
        // For serial >= 60: Excel incorrectly includes Feb 29, 1900, so subtract 1
        if (numValue < 60) {
          excelDate = new Date(1900, 0, numValue);
        } else {
          excelDate = new Date(1900, 0, numValue - 1);
        }
        const resultYear = excelDate.getFullYear();
        if (!isNaN(excelDate.getTime()) && resultYear >= 1900 && resultYear <= 2100) {
          return excelDate.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }
      }
    }
    return trimmed;
  }

  // If it's a number, check if it's an Excel serial date
  if (typeof value === 'number') {
    const numValue = value;
    // If it looks like a year (1900-2100), don't treat as Excel serial
    if (numValue >= 1900 && numValue <= 2100) {
      return numValue;
    }
    // Check if it's in Excel serial range (1-1000000)
    // Excel serial dates: 1 = Jan 1, 1900, ~36526 = Jan 1, 2000, ~45975 = Nov 14, 2025
    // Excel incorrectly treats 1900 as a leap year, so for dates >= 60, we subtract 1 day
    if (numValue >= 1 && numValue <= 1000000) {
      let excelDate: Date;
      // Excel serial dates: 1 = Jan 1, 1900 (day 1 of year 1900)
      // For serial < 60: dates are before the false leap day, so use serial directly
      // For serial >= 60: Excel incorrectly includes Feb 29, 1900, so subtract 1
      if (numValue < 60) {
        excelDate = new Date(1900, 0, numValue);
      } else {
        excelDate = new Date(1900, 0, numValue - 1);
      }
      const resultYear = excelDate.getFullYear();
      if (!isNaN(excelDate.getTime()) && resultYear >= 1900 && resultYear <= 2100) {
        return excelDate.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
      }
    }
  }

  // Return as is if no conversion needed
  return value;
}

function generateRowKey(fileId: string, row: any, headers: string[]): string {
  // First try to use row.id if available
  if (row.id) {
    return `${fileId}-${row.id}`;
  }
  
  // Otherwise, use the first 3 header values in order (stable)
  if (headers.length >= 3) {
    const keyParts: string[] = [];
    for (let i = 0; i < Math.min(3, headers.length); i++) {
      const header = headers[i];
      const value = row[header] ?? '';
      keyParts.push(String(value));
    }
    if (keyParts.some(v => v)) {
      return `${fileId}-${keyParts.join('|')}`;
    }
  }
  
  // Fallback: use all header values
  const keyParts: string[] = [];
  for (const header of headers) {
    const value = row[header] ?? '';
    keyParts.push(String(value));
  }
  return `${fileId}-${keyParts.join('|')}`;
}

export default function MyRTUTracker() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const rowsRef = useRef<any[]>([]);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(PAGE_SIZE_OPTIONS[0]);
  const [user, setUser] = useState<any>(getCurrentUser());
  const userRole = user?.role || '';
  const userDivisions = user?.division || [];
  
  // Sync rowsRef with rows state
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);
  
  // State for the five columns functionality
  const [siteObservations, setSiteObservations] = useState<Record<string, string>>({});
  const [_siteObservationsLastModified, setSiteObservationsLastModified] = useState<Record<string, number>>({});
  const [taskStatus, setTaskStatus] = useState<Record<string, string>>({});
  const [typeOfIssue, setTypeOfIssue] = useState<Record<string, string>>({});
  const [viewPhotos, setViewPhotos] = useState<Record<string, string[]>>({});
  const [photoMetadata, setPhotoMetadata] = useState<Record<string, Array<{ latitude?: number; longitude?: number; timestamp?: string; location?: string }>>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [dateOfInspection, setDateOfInspection] = useState<Record<string, string>>({});
  // const _dataLoadedRef = useRef<string>(''); // Reserved for future use
  const isLoadingRef = useRef<boolean>(false);
  const [dataLoadTrigger, setDataLoadTrigger] = useState(0);
  
  // Refs to track latest state values for reliable saving
  const siteObservationsRef = useRef<Record<string, string>>({});
  const taskStatusRef = useRef<Record<string, string>>({});
  const typeOfIssueRef = useRef<Record<string, string>>({});
  const viewPhotosRef = useRef<Record<string, string[]>>({});
  const remarksRef = useRef<Record<string, string>>({});
  const photoMetadataRef = useRef<Record<string, Array<{ latitude?: number; longitude?: number; timestamp?: string; location?: string }>>>({});
  const dateOfInspectionRef = useRef<Record<string, string>>({});
  
  // Sync refs with state
  useEffect(() => {
    siteObservationsRef.current = siteObservations;
  }, [siteObservations]);
  
  useEffect(() => {
    dateOfInspectionRef.current = dateOfInspection;
  }, [dateOfInspection]);
  
  useEffect(() => {
    taskStatusRef.current = taskStatus;
  }, [taskStatus]);
  
  useEffect(() => {
    typeOfIssueRef.current = typeOfIssue;
  }, [typeOfIssue]);
  
  useEffect(() => {
    viewPhotosRef.current = viewPhotos;
  }, [viewPhotos]);
  
  useEffect(() => {
    remarksRef.current = remarks;
  }, [remarks]);
  
  useEffect(() => {
    photoMetadataRef.current = photoMetadata;
  }, [photoMetadata]);
  
  // Dialog states
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [selectedRowKeyForPhotos, setSelectedRowKeyForPhotos] = useState<string>('');
  const [showSiteObservationsDialog, setShowSiteObservationsDialog] = useState(false);
  const [selectedSiteObservationRowKey, setSelectedSiteObservationRowKey] = useState<string>('');
  const [siteObservationsDialogData, setSiteObservationsDialogData] = useState({
    remarks: '',
    typeOfIssue: '',
    specifyOther: '',
    typeOfSpare: [] as string[],
    specifySpareOther: '',
    dateOfInspection: '',
    previousValue: '', // Store previous value to restore on Cancel
    capturedPhotos: [] as Array<{ data: string; latitude?: number; longitude?: number; timestamp?: string; location?: string }>,
    uploadedPhotos: [] as File[],
    uploadedDocuments: [] as File[]
  });
  const [siteObservationsStatus, setSiteObservationsStatus] = useState<string>('');
  const [_isTypeOfSpareDropdownOpen, _setIsTypeOfSpareDropdownOpen] = useState(false);
  const [showSiteObservationsCameraPreview, setShowSiteObservationsCameraPreview] = useState(false);
  const [siteObservationsCameraStream, setSiteObservationsCameraStream] = useState<MediaStream | null>(null);
  const [siteObservationsCapturedImageData, setSiteObservationsCapturedImageData] = useState<string | null>(null);
  const [capturedPhotoMetadata, setCapturedPhotoMetadata] = useState<{ latitude?: number; longitude?: number; timestamp?: string; location?: string } | null>(null);
  const siteObservationsCameraStreamRef = useRef<MediaStream | null>(null);
  const [_isSubmittingSiteObservations, _setIsSubmittingSiteObservations] = useState(false);
  
  // Handle video element for Site Observations camera stream
  useEffect(() => {
    if (siteObservationsCameraStream && showSiteObservationsCameraPreview) {
      const video = document.getElementById('site-observations-camera-preview-video-rtu') as HTMLVideoElement;
      if (video) {
        video.srcObject = siteObservationsCameraStream;
        video.play().catch(err => console.error('Error playing video:', err));
      }
      siteObservationsCameraStreamRef.current = siteObservationsCameraStream;
    }
    
    // Cleanup: stop camera when component unmounts or dialog closes
    return () => {
      if (!showSiteObservationsCameraPreview && siteObservationsCameraStreamRef.current) {
        siteObservationsCameraStreamRef.current.getTracks().forEach(track => track.stop());
        siteObservationsCameraStreamRef.current = null;
        setSiteObservationsCameraStream(null);
      }
    };
  }, [siteObservationsCameraStream, showSiteObservationsCameraPreview]);
  
  // Function to save data to RTU Tracker Sites collection in database
  const saveToRTUTrackerSitesDB = useCallback(async () => {
    if (!selectedFile || isLoadingRef.current) {
      return;
    }
    
    // Only save for Equipment role users
    if (userRole !== 'Equipment') {
      return;
    }

    // Use refs to get latest values
    const currentRows = rowsRef.current;
    const currentHeaders = headers;

    if (!currentRows.length || !currentHeaders.length) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('No token found, cannot save to RTU Tracker Sites database');
        return;
      }

      // Prepare sites to save
      const sitesToSave: any[] = [];
      const currentSiteObservations = siteObservationsRef.current;
      const currentTaskStatus = taskStatusRef.current;
      const currentTypeOfIssue = typeOfIssueRef.current;
      const currentViewPhotos = viewPhotosRef.current;
      const currentRemarks = remarksRef.current;
      const currentPhotoMetadata = photoMetadataRef.current;
      const currentDateOfInspection = dateOfInspectionRef.current;

      // Get all rowKeys that have data
      const allRowKeys = new Set<string>();
      Object.keys(currentSiteObservations).forEach(key => allRowKeys.add(key));
      Object.keys(currentTaskStatus).forEach(key => allRowKeys.add(key));
      Object.keys(currentTypeOfIssue).forEach(key => allRowKeys.add(key));
      Object.keys(currentViewPhotos).forEach(key => allRowKeys.add(key));
      Object.keys(currentRemarks).forEach(key => allRowKeys.add(key));
      Object.keys(currentPhotoMetadata).forEach(key => allRowKeys.add(key));
      Object.keys(currentDateOfInspection).forEach(key => allRowKeys.add(key));

      // Find corresponding rows
      for (const rowKey of allRowKeys) {
        const row = currentRows.find((r: any) => {
          const key = generateRowKey(selectedFile, r, currentHeaders);
          return key === rowKey;
        });

        if (row) {
          // Extract site code
          const siteCodeHeader = currentHeaders.find((h: string) => {
            const normalized = h.trim().toLowerCase().replace(/[_\s-]/g, '');
            return normalized === 'sitecode' || normalized === 'site_code' || normalized === 'site code';
          });
          
          const siteCode = siteCodeHeader ? String(row[siteCodeHeader] || '').trim().toUpperCase() : '';
          
          if (siteCode) {
            sitesToSave.push({
              fileId: selectedFile,
              rowKey: rowKey,
              siteCode: siteCode,
              originalRowData: row,
              headers: currentHeaders,
              siteObservations: currentSiteObservations[rowKey] || '',
              taskStatus: currentTaskStatus[rowKey] || '',
              typeOfIssue: currentTypeOfIssue[rowKey] || '',
              viewPhotos: currentViewPhotos[rowKey] || [],
              photoMetadata: currentPhotoMetadata[rowKey] || [],
              remarks: currentRemarks[rowKey] || '',
              dateOfInspection: currentDateOfInspection[rowKey] || '',
              savedFrom: 'MY RTU TRACKER'
            });
          }
        }
      }

      if (sitesToSave.length > 0) {
        const response = await fetch(`${API_BASE}/api/rtu-tracker-sites/bulk`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ sites: sitesToSave })
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            console.log(`[saveToRTUTrackerSitesDB] Successfully saved ${result.saved} sites to database`);
          } else {
            console.error('Failed to save to RTU Tracker Sites database:', result.error);
          }
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error('Failed to save to RTU Tracker Sites database:', errorData);
        }
      }
    } catch (error) {
      console.error('Error saving to RTU Tracker Sites database:', error);
    }
  }, [selectedFile, rows, headers, userRole]);
  
  // Function to load data from RTU Tracker Sites database
  const loadFromRTUTrackerSitesDB = useCallback(async () => {
    if (!selectedFile || isLoadingRef.current) {
      return;
    }
    
    // Only load for Equipment role users
    if (userRole !== 'Equipment') {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('No token found, cannot load from RTU Tracker Sites database');
        return;
      }

      isLoadingRef.current = true;

      const response = await fetch(`${API_BASE}/api/rtu-tracker-sites/file/${selectedFile}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const data = result.data;
          
          // Convert map to individual state objects
          const loadedSiteObservations: Record<string, string> = {};
          const loadedTaskStatus: Record<string, string> = {};
          const loadedTypeOfIssue: Record<string, string> = {};
          const loadedViewPhotos: Record<string, string[]> = {};
          const loadedRemarks: Record<string, string> = {};
          const loadedPhotoMetadata: Record<string, any[]> = {};
          const loadedDateOfInspection: Record<string, string> = {};

          // Get sitesBySiteCode for fallback matching
          const sitesBySiteCode = data._bySiteCode || {};
          delete data._bySiteCode; // Remove from main data object
          
          Object.entries(data).forEach(([rowKey, siteData]: [string, any]) => {
            if (siteData.siteObservations) loadedSiteObservations[rowKey] = siteData.siteObservations;
            if (siteData.taskStatus) loadedTaskStatus[rowKey] = siteData.taskStatus;
            if (siteData.typeOfIssue) loadedTypeOfIssue[rowKey] = siteData.typeOfIssue;
            if (siteData.viewPhotos) loadedViewPhotos[rowKey] = siteData.viewPhotos;
            if (siteData.remarks) loadedRemarks[rowKey] = siteData.remarks;
            if (siteData.photoMetadata) loadedPhotoMetadata[rowKey] = siteData.photoMetadata;
            if (siteData.dateOfInspection) loadedDateOfInspection[rowKey] = siteData.dateOfInspection;
          });
          
          // Then, for each site in sitesBySiteCode, find matching rows by siteCode and populate data
          // This handles cases where rowKeys don't match due to header order differences
          const currentRows = rowsRef.current;
          const currentHeaders = headers.length > 0 ? headers : (currentRows[0] ? Object.keys(currentRows[0]) : []);
          
          if (currentRows.length > 0 && currentHeaders.length > 0) {
            const siteCodeHeader = currentHeaders.find((h: string) => {
              const normalized = normalize(h);
              return normalized === 'sitecode' || normalized === 'site_code' || normalized === 'site code';
            });
            
            if (siteCodeHeader) {
              let fallbackMatches = 0;
              currentRows.forEach((row: any) => {
                const siteCode = String(row[siteCodeHeader] || '').trim().toUpperCase();
                if (siteCode && sitesBySiteCode[siteCode]) {
                  const savedData = sitesBySiteCode[siteCode];
                  const currentRowKey = generateRowKey(selectedFile, row, currentHeaders);
                  
                  // Only use fallback if current rowKey doesn't have data
                  if (!loadedSiteObservations[currentRowKey] && savedData.siteObservations) {
                    fallbackMatches++;
                    console.log(`[loadFromRTUTrackerSitesDB] Fallback match: Site Code ${siteCode}, Current RowKey: ${currentRowKey}, Saved RowKey: ${savedData.rowKey}`);
                    
                    // Copy data to current rowKey
                    if (savedData.siteObservations) loadedSiteObservations[currentRowKey] = savedData.siteObservations;
                    if (savedData.taskStatus) loadedTaskStatus[currentRowKey] = savedData.taskStatus;
                    if (savedData.typeOfIssue) loadedTypeOfIssue[currentRowKey] = savedData.typeOfIssue;
                    if (savedData.viewPhotos) loadedViewPhotos[currentRowKey] = savedData.viewPhotos;
                    if (savedData.remarks) loadedRemarks[currentRowKey] = savedData.remarks;
                    if (savedData.photoMetadata) loadedPhotoMetadata[currentRowKey] = savedData.photoMetadata;
                    if (savedData.dateOfInspection) loadedDateOfInspection[currentRowKey] = savedData.dateOfInspection;
                  }
                }
              });
              console.log(`[loadFromRTUTrackerSitesDB] Applied ${fallbackMatches} fallback matches by siteCode`);
            }
          }
          
          // Store sitesBySiteCode for future reference
          (window as any).__rtuTrackerSitesBySiteCode = sitesBySiteCode;

          // Log sample of loaded data for debugging
          const sampleRowKeys = Object.keys(data).slice(0, 5);
          console.log(`[loadFromRTUTrackerSitesDB] Loaded ${Object.keys(data).length} total sites. Sample rowKeys:`, sampleRowKeys);
          sampleRowKeys.forEach(rowKey => {
            const siteData = data[rowKey];
            console.log(`[loadFromRTUTrackerSitesDB] Sample rowKey "${rowKey}":`, {
              siteObservations: siteData.siteObservations,
              taskStatus: siteData.taskStatus,
              photosCount: siteData.viewPhotos?.length || 0,
              hasRemarks: !!siteData.remarks,
              dateOfInspection: siteData.dateOfInspection
            });
          });
          
          // Also log all rowKeys to help debug matching issues
          console.log(`[loadFromRTUTrackerSitesDB] All loaded rowKeys:`, Object.keys(data));

          setSiteObservations(loadedSiteObservations);
          setTaskStatus(loadedTaskStatus);
          setTypeOfIssue(loadedTypeOfIssue);
          setViewPhotos(loadedViewPhotos);
          setRemarks(loadedRemarks);
          setPhotoMetadata(loadedPhotoMetadata);
          setDateOfInspection(loadedDateOfInspection);

          // Update refs
          siteObservationsRef.current = loadedSiteObservations;
          taskStatusRef.current = loadedTaskStatus;
          typeOfIssueRef.current = loadedTypeOfIssue;
          viewPhotosRef.current = loadedViewPhotos;
          remarksRef.current = loadedRemarks;
          photoMetadataRef.current = loadedPhotoMetadata;
          dateOfInspectionRef.current = loadedDateOfInspection;

          console.log(`[loadFromRTUTrackerSitesDB] Loaded ${Object.keys(data).length} sites from database`);
          console.log(`[loadFromRTUTrackerSitesDB] Stored ${Object.keys(sitesBySiteCode).length} sites by siteCode for fallback matching`);
          
          // Reset fallback ref and trigger fallback matching
          fallbackAppliedRef.current = '';
          setDataLoadTrigger(prev => prev + 1);
        }
      } else {
        console.warn('Failed to load from RTU Tracker Sites database');
      }
    } catch (error) {
      console.error('Error loading from RTU Tracker Sites database:', error);
    } finally {
      isLoadingRef.current = false;
    }
  }, [selectedFile, userRole]);
  
  // Save data to MongoDB whenever it changes - using debounced save
  useEffect(() => {
    if (!selectedFile || isLoadingRef.current) {
      return;
    }
    
    const timeoutId = setTimeout(() => {
      saveToRTUTrackerSitesDB();
    }, 500); // Increased debounce time for database saves
    
    return () => clearTimeout(timeoutId);
  }, [selectedFile, siteObservations, taskStatus, typeOfIssue, viewPhotos, remarks, photoMetadata, dateOfInspection, saveToRTUTrackerSitesDB]);
  
  // Load data from MongoDB when file changes
  useEffect(() => {
    if (!selectedFile) {
      setSiteObservations({});
      setTaskStatus({});
      setTypeOfIssue({});
      setViewPhotos({});
      setRemarks({});
      setPhotoMetadata({});
      setDateOfInspection({});
      return;
    }
    
    // Load from database for Equipment role
    if (userRole === 'Equipment') {
      loadFromRTUTrackerSitesDB();
    }
  }, [selectedFile, userRole, loadFromRTUTrackerSitesDB]);

  // Auto-refresh data periodically and on window focus to sync with mobile app updates
  useEffect(() => {
    if (!selectedFile || userRole !== 'Equipment') {
      return;
    }

    const refreshData = () => {
      console.log('[MyRTUTracker] Auto-refreshing data from database...');
      // Force refresh by resetting loading flag and fallback ref
      isLoadingRef.current = false;
      fallbackAppliedRef.current = ''; // Reset to allow fallback matching to run again
      loadFromRTUTrackerSitesDB();
    };

    // Refresh on window focus (when user switches back to the tab)
    const handleFocus = () => {
      refreshData();
    };
    window.addEventListener('focus', handleFocus);

    // Refresh every 10 seconds to pick up changes from mobile app
    const interval = setInterval(refreshData, 10000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [selectedFile, userRole, loadFromRTUTrackerSitesDB]);

  // Apply fallback matching by siteCode after rows and data are loaded
  const fallbackAppliedRef = useRef<string>('');
  useEffect(() => {
    console.log('[MyRTUTracker Fallback] useEffect triggered', {
      selectedFile,
      userRole,
      rowsCount: rows.length,
      headersCount: headers.length,
      dataLoadTrigger
    });
    
    if (!selectedFile || userRole !== 'Equipment' || rows.length === 0 || headers.length === 0) {
      console.log('[MyRTUTracker Fallback] Early return - missing prerequisites');
      return;
    }

    const sitesBySiteCode = (window as any).__rtuTrackerSitesBySiteCode || {};
    if (Object.keys(sitesBySiteCode).length === 0) {
      console.log('[MyRTUTracker Fallback] No sitesBySiteCode data available');
      return;
    }

    console.log(`[MyRTUTracker Fallback] Checking ${Object.keys(sitesBySiteCode).length} sites by siteCode`);
    console.log(`[MyRTUTracker Fallback] Available siteCodes:`, Object.keys(sitesBySiteCode).slice(0, 10));

    // Create a unique key for this file/rows combination to avoid re-applying
    const currentKey = `${selectedFile}-${rows.length}-${headers.length}`;
    if (fallbackAppliedRef.current === currentKey) {
      console.log('[MyRTUTracker Fallback] Already applied for this combination, skipping');
      return; // Already applied for this combination
    }

    const siteCodeHeader = headers.find((h: string) => {
      const normalized = normalize(h);
      return normalized === 'sitecode' || normalized === 'site_code' || normalized === 'site code';
    });

    if (!siteCodeHeader) {
      return;
    }

    let fallbackMatches = 0;
    const updatedSiteObservations = { ...siteObservationsRef.current };
    const updatedTaskStatus = { ...taskStatusRef.current };
    const updatedTypeOfIssue = { ...typeOfIssueRef.current };
    const updatedViewPhotos = { ...viewPhotosRef.current };
    const updatedRemarks = { ...remarksRef.current };
    const updatedPhotoMetadata = { ...photoMetadataRef.current };
    const updatedDateOfInspection = { ...dateOfInspectionRef.current };

    rows.forEach((row: any) => {
      const siteCode = String(row[siteCodeHeader] || '').trim().toUpperCase();
      if (siteCode && sitesBySiteCode[siteCode]) {
        const savedData = sitesBySiteCode[siteCode];
        const currentRowKey = generateRowKey(selectedFile, row, headers);

        // Check if we need to apply fallback
        // Apply if: 1) No data for current rowKey, OR 2) RowKey is different (mismatch)
        const hasDifferentRowKey = savedData.rowKey && savedData.rowKey !== currentRowKey;
        const hasNoData = !updatedSiteObservations[currentRowKey];
        const needsFallback = (hasNoData || hasDifferentRowKey) && savedData.siteObservations;
        
        if (needsFallback) {
          fallbackMatches++;
          console.log(`[MyRTUTracker Fallback] ✅ Applying fallback for Site Code ${siteCode}:`, {
            currentRowKey,
            savedRowKey: savedData.rowKey,
            siteObservations: savedData.siteObservations,
            taskStatus: savedData.taskStatus,
            hasPhotos: (savedData.viewPhotos?.length || 0) > 0,
            rowKeyMismatch: hasDifferentRowKey,
            hadNoData: hasNoData,
            willOverwrite: hasDifferentRowKey && !hasNoData
          });

          // Copy ALL data to current rowKey (overwrite if rowKey mismatch)
          if (savedData.siteObservations) updatedSiteObservations[currentRowKey] = savedData.siteObservations;
          if (savedData.taskStatus) updatedTaskStatus[currentRowKey] = savedData.taskStatus;
          if (savedData.typeOfIssue) updatedTypeOfIssue[currentRowKey] = savedData.typeOfIssue;
          if (savedData.viewPhotos) updatedViewPhotos[currentRowKey] = savedData.viewPhotos;
          if (savedData.remarks) updatedRemarks[currentRowKey] = savedData.remarks;
          if (savedData.photoMetadata) updatedPhotoMetadata[currentRowKey] = savedData.photoMetadata;
          if (savedData.dateOfInspection) updatedDateOfInspection[currentRowKey] = savedData.dateOfInspection;
        } else {
          // Log when fallback is not needed
          console.log(`[MyRTUTracker Fallback] ⏭️ Skipping Site Code ${siteCode}:`, {
            currentRowKey,
            savedRowKey: savedData.rowKey,
            hasData: !!updatedSiteObservations[currentRowKey],
            hasSavedData: !!savedData.siteObservations,
            rowKeyMatch: !hasDifferentRowKey
          });
        }
      }
    });

    if (fallbackMatches > 0) {
      console.log(`[MyRTUTracker Fallback] Applied ${fallbackMatches} fallback matches by siteCode`);
      setSiteObservations(updatedSiteObservations);
      setTaskStatus(updatedTaskStatus);
      setTypeOfIssue(updatedTypeOfIssue);
      setViewPhotos(updatedViewPhotos);
      setRemarks(updatedRemarks);
      setPhotoMetadata(updatedPhotoMetadata);
      setDateOfInspection(updatedDateOfInspection);
      fallbackAppliedRef.current = currentKey;
    }
  }, [rows, headers, selectedFile, userRole, dataLoadTrigger]);

  // Fetch fresh user data if divisions are missing
  useEffect(() => {
    const currentDivisions = user?.division || [];
    if ((userRole === 'Equipment' || userRole === 'RTU/Communication') && (!currentDivisions || currentDivisions.length === 0)) {
      const token = localStorage.getItem('token');
      if (token) {
        fetch(`${API_BASE}/api/auth/profile`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data) {
            const freshUser = {
              ...user,
              division: data.data.division || []
            };
            setUser(freshUser);
            localStorage.setItem('user', JSON.stringify(freshUser));
          }
        })
        .catch(err => console.error('Failed to fetch user profile:', err));
      }
    }
  }, [userRole]);

  // Fetch uploaded files - same as View Data (Device Status Upload files)
  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE}/api/uploads`, {
          headers: {
            'Authorization': token ? `Bearer ${token}` : ''
          }
        });
        const json = await res.json();
        if (json?.success) {
          const files = (json.files || [])
            .filter((f: any) => {
              const uploadTypeValue = f.uploadType;
              const fileName = String(f.name || '').toLowerCase();
              
              // For Equipment role: Only show Device Status Upload files (same as View Data)
              const currentRole = getCurrentUserRole();
              const isEquipmentRole = currentRole && currentRole.toLowerCase() === 'equipment';
              if (isEquipmentRole) {
                const uploadType = uploadTypeValue ? String(uploadTypeValue).toLowerCase().trim() : '';
                const isDeviceStatusUpload = uploadType === 'device-status-upload';
                
                const isOnlineOfflineFileName = fileName.includes('online-offline') || 
                                               fileName.includes('online_offline') ||
                                               fileName.includes('onlineoffline');
                
                const normalizedFileName = fileName.replace(/[-_\s]/g, '');
                const isRtuTrackerFileName = 
                  fileName.includes('rtu-tracker') || 
                  fileName.includes('rtu_tracker') ||
                  fileName.includes('rtu tracker') ||
                  fileName.includes('rtutracker') ||
                  normalizedFileName.includes('rtutracker') ||
                  /rtu.*tracker/i.test(f.name || '');
                
                return isDeviceStatusUpload && !isOnlineOfflineFileName && !isRtuTrackerFileName;
              }
              
              // For other roles: Filter out files with uploadType === 'online-offline-data' or 'rtu-tracker'
              let shouldHideByType = false;
              if (uploadTypeValue) {
                const uploadType = String(uploadTypeValue).toLowerCase().trim();
                shouldHideByType = uploadType === 'online-offline-data' || uploadType === 'rtu-tracker';
              }
              
              const isOnlineOfflineFileName = fileName.includes('online-offline') || 
                                             fileName.includes('online_offline') ||
                                             fileName.includes('onlineoffline');
              
              const normalizedFileName = fileName.replace(/[-_\s]/g, '');
              const isRtuTrackerFileName = 
                fileName.includes('rtu-tracker') || 
                fileName.includes('rtu_tracker') ||
                fileName.includes('rtu tracker') ||
                fileName.includes('rtutracker') ||
                normalizedFileName.includes('rtutracker') ||
                /rtu.*tracker/i.test(f.name || '');
              
              return !shouldHideByType && !isOnlineOfflineFileName && !isRtuTrackerFileName;
            })
            .map((f: any) => ({
              id: f.fileId || f._id || f.id,
              name: f.name,
              size: f.size || 0,
              type: f.type || '',
              uploadedAt: f.uploadedAt || f.createdAt || new Date()
            }));
          
          setUploadedFiles(files);
          // Automatically select the first file if available
          if (files.length > 0 && !selectedFile) {
            setSelectedFile(files[0].id);
          }
        }
      } catch (error) {
        console.error('Error fetching files:', error);
      }
    })();
  }, []);

  // Listen for ViewData updates to refresh data
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  useEffect(() => {
    const handleViewDataUpdate = (event: any) => {
      const { fileId } = event.detail || {};
      // Only refresh if the updated file matches the currently selected file
      if (fileId === selectedFile) {
        console.log('MyRTUTracker: ViewData updated, refreshing data...');
        setRefreshTrigger(prev => prev + 1);
      }
    };

    window.addEventListener('viewDataUpdated', handleViewDataUpdate as EventListener);
    return () => {
      window.removeEventListener('viewDataUpdated', handleViewDataUpdate as EventListener);
    };
  }, [selectedFile]);

  // Fetch and filter data - same as View Data (merge from all sources) but with PRODUCTION OBSERVATIONS = YES filter
  useEffect(() => {
    (async () => {
      if (!selectedFile) {
        setRows([]);
        setHeaders([]);
        return;
      }
      
      try {
        const token = localStorage.getItem('token');
        
        // Fetch the main file data (Device Status Upload file)
        const res = await fetch(`${API_BASE}/api/uploads/${selectedFile}`, {
          headers: {
            'Authorization': token ? `Bearer ${token}` : ''
          }
        });
        
        if (!res.ok) {
          console.error('MY RTU TRACKER - Fetch failed with status:', res.status);
          setRows([]);
          setHeaders([]);
          return;
        }
        
        const json = await res.json();
        if (json?.success && json.file) {
          const file = json.file;
          let fileRows = Array.isArray(file.rows) ? file.rows : [];
          let hdrs = file.headers && file.headers.length ? file.headers : (fileRows[0] ? Object.keys(fileRows[0]) : []);
          
          if (hdrs.length === 0) {
            console.error('MY RTU TRACKER - ERROR: No headers found!');
            setRows([]);
            setHeaders([]);
            return;
          }
          
          const normalizeHeader = (h: string) => h.trim().toLowerCase();
          
          // Variables to track merged columns
          let onlineOfflineColumnsToPreserve: string[] = [];
          let columnsToInsert: string[] = [];
          // let _onlineOfflineColumnsList: string[] = []; // Reserved for future use
          let rtuTrackerColumnsList: string[] = [];
          
          // Find SITE CODE column in main file
          const mainSiteCodeHeader = hdrs.find((h: string) => {
            const normalized = normalizeHeader(h);
            return normalized === 'site code' || normalized === 'sitecode' || normalized === 'site_code';
          });
          
          console.log('MY RTU TRACKER - Main SITE CODE header:', mainSiteCodeHeader);
          
          // Fetch ONLINE-OFFLINE DATA files and merge
          try {
            const onlineOfflineRes = await fetch(`${API_BASE}/api/uploads`, {
              headers: {
                'Authorization': token ? `Bearer ${token}` : ''
              }
            });
            const onlineOfflineJson = await onlineOfflineRes.json();
            
            if (onlineOfflineJson?.success) {
              const onlineOfflineFiles = (onlineOfflineJson.files || []).filter((f: any) => {
                const uploadTypeValue = f.uploadType;
                const fileName = String(f.name || '').toLowerCase();
                const isOnlineOfflineType = uploadTypeValue && String(uploadTypeValue).toLowerCase().trim() === 'online-offline-data';
                const isOnlineOfflineFileName = fileName.includes('online-offline') || 
                                               fileName.includes('online_offline') ||
                                               fileName.includes('onlineoffline');
                return isOnlineOfflineFileName || (isOnlineOfflineType && isOnlineOfflineFileName);
              });
              
              const latestOnlineOfflineFile = onlineOfflineFiles.sort((a: any, b: any) => {
                const dateA = a.uploadedAt ? new Date(a.uploadedAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
                const dateB = b.uploadedAt ? new Date(b.uploadedAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
                return dateB - dateA;
              })[0];
              
              if (latestOnlineOfflineFile) {
                const onlineOfflineDataRes = await fetch(`${API_BASE}/api/uploads/${latestOnlineOfflineFile.fileId}`, {
                  headers: {
                    'Authorization': token ? `Bearer ${token}` : ''
                  }
                });
                const onlineOfflineDataJson = await onlineOfflineDataRes.json();
                
                if (onlineOfflineDataJson?.success && onlineOfflineDataJson.file) {
                  const onlineOfflineData = onlineOfflineDataJson.file;
                  const onlineOfflineRows = Array.isArray(onlineOfflineData.rows) ? onlineOfflineData.rows : [];
                  const onlineOfflineHeaders = onlineOfflineData.headers && onlineOfflineData.headers.length 
                    ? onlineOfflineData.headers 
                    : (onlineOfflineRows[0] ? Object.keys(onlineOfflineRows[0]) : []);
                  
                  const onlineOfflineSiteCodeHeader = onlineOfflineHeaders.find((h: string) => {
                    const normalized = normalizeHeader(h);
                    return normalized === 'site code' || normalized === 'sitecode' || normalized === 'site_code';
                  });
                  
                  // Find date columns and get latest
                  const parseDateFromColumnName = (columnName: string): Date | null => {
                    const datePatterns = [
                      /(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/,
                      /(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/,
                    ];
                    for (const pattern of datePatterns) {
                      const match = columnName.match(pattern);
                      if (match) {
                        if (pattern.source.includes('\\d{4}') && pattern.source.startsWith('(\\d{4})')) {
                          const year = parseInt(match[1]);
                          const month = parseInt(match[2]) - 1;
                          const day = parseInt(match[3]);
                          return new Date(year, month, day);
                        } else {
                          const day = parseInt(match[1]);
                          const month = parseInt(match[2]) - 1;
                          const year = parseInt(match[3]);
                          return new Date(year, month, day);
                        }
                      }
                    }
                    return null;
                  };
                  
                  const dateColumns: Array<{ name: string; date: Date }> = [];
                  onlineOfflineHeaders.forEach((h: string) => {
                    const normalized = normalizeHeader(h);
                    if (normalized.includes('date') || normalized.includes('time')) {
                      const date = parseDateFromColumnName(h);
                      if (date && !isNaN(date.getTime())) {
                        dateColumns.push({ name: h, date });
                      }
                    }
                  });
                  
                  let latestDateColumn: string | null = null;
                  if (dateColumns.length > 0) {
                    dateColumns.sort((a, b) => b.date.getTime() - a.date.getTime());
                    latestDateColumn = dateColumns[0].name;
                  }
                  
                  // Find columns to merge: DEVICE STATUS, EQUIPMENT L/R SWITCH STATUS, NO OF DAYS OFFLINE
                  const deviceStatusHeader = onlineOfflineHeaders.find((h: string) => {
                    const normalized = normalizeHeader(h);
                    return normalized === 'device status' || normalized === 'device_status' || normalized === 'devicestatus' ||
                           (normalized.includes('device') && normalized.includes('status'));
                  });
                  
                  const equipmentLRSwitchStatusHeader = onlineOfflineHeaders.find((h: string) => {
                    const normalized = normalizeHeader(h);
                    return normalized === 'equipment l/r switch status' || normalized === 'equipment_l/r_switch_status' ||
                           (normalized.includes('equipment') && normalized.includes('switch') && normalized.includes('status'));
                  });
                  
                  const noOfDaysOfflineHeader = onlineOfflineHeaders.find((h: string) => {
                    const normalized = normalizeHeader(h);
                    return normalized === 'no of days offline' || normalized === 'no_of_days_offline' ||
                           (normalized.includes('days') && normalized.includes('offline'));
                  });
                  
                  const onlineOfflineColumns: string[] = [];
                  if (deviceStatusHeader) onlineOfflineColumns.push(deviceStatusHeader);
                  if (equipmentLRSwitchStatusHeader) onlineOfflineColumns.push(equipmentLRSwitchStatusHeader);
                  if (noOfDaysOfflineHeader) onlineOfflineColumns.push(noOfDaysOfflineHeader);
                  
                  // _onlineOfflineColumnsList = [...onlineOfflineColumns]; // Reserved for future use
                  onlineOfflineColumns.forEach(col => {
                    if (!columnsToInsert.includes(col)) columnsToInsert.push(col);
                    if (!onlineOfflineColumnsToPreserve.includes(col)) onlineOfflineColumnsToPreserve.push(col);
                  });
                  
                  if (mainSiteCodeHeader && onlineOfflineSiteCodeHeader && onlineOfflineColumns.length > 0) {
                    const onlineOfflineMap = new Map<string, any>();
                    let filteredRows = [...onlineOfflineRows];
                    if (latestDateColumn) {
                      filteredRows = onlineOfflineRows.filter((row: any) => {
                        const dateValue = row[latestDateColumn];
                        return dateValue !== null && dateValue !== undefined && String(dateValue).trim() !== '';
                      });
                    }
                    
                    filteredRows.forEach((row: any) => {
                      const siteCode = String(row[onlineOfflineSiteCodeHeader] || '').trim();
                      if (siteCode) {
                        if (onlineOfflineMap.has(siteCode)) {
                          const existingRow = onlineOfflineMap.get(siteCode);
                          const existingHasDate = latestDateColumn && existingRow[latestDateColumn] && 
                                                 String(existingRow[latestDateColumn]).trim() !== '';
                          const currentHasDate = latestDateColumn && row[latestDateColumn] && 
                                               String(row[latestDateColumn]).trim() !== '';
                          if (currentHasDate && !existingHasDate) {
                            onlineOfflineMap.set(siteCode, row);
                          }
                        } else {
                          onlineOfflineMap.set(siteCode, row);
                        }
                      }
                    });
                    
                    fileRows = fileRows.map((row: any) => {
                      const siteCode = String(row[mainSiteCodeHeader] || '').trim();
                      const onlineOfflineRow = onlineOfflineMap.get(siteCode);
                      const mergedRow = { ...row };
                      onlineOfflineColumns.forEach((col: string) => {
                        mergedRow[col] = onlineOfflineRow ? (onlineOfflineRow[col] ?? '') : '';
                      });
                      return mergedRow;
                    });
                    
                    const siteCodeIndex = hdrs.indexOf(mainSiteCodeHeader);
                    if (siteCodeIndex !== -1) {
                      const columnsToAdd = onlineOfflineColumns.filter(col => !hdrs.includes(col));
                      if (columnsToAdd.length > 0) {
                        hdrs = [
                          ...hdrs.slice(0, siteCodeIndex),
                          ...columnsToAdd,
                          ...hdrs.slice(siteCodeIndex)
                        ];
                      }
                    }
                  }
                }
              }
            }
          } catch (error) {
            console.error('MY RTU TRACKER - Error fetching ONLINE-OFFLINE DATA:', error);
          }
          
          // Fetch RTU-TRACKER files and merge
          try {
            const rtuTrackerRes = await fetch(`${API_BASE}/api/uploads`, {
              headers: {
                'Authorization': token ? `Bearer ${token}` : ''
              }
            });
            const rtuTrackerJson = await rtuTrackerRes.json();
            
            if (rtuTrackerJson?.success) {
              const rtuTrackerFiles = (rtuTrackerJson.files || []).filter((f: any) => {
                const uploadTypeValue = f.uploadType;
                const originalFileName = String(f.name || '').toLowerCase();
                const isRtuTrackerType = uploadTypeValue && String(uploadTypeValue).toLowerCase().trim() === 'rtu-tracker';
                const normalizedFileName = originalFileName.replace(/[-_\s]/g, '');
                const isRtuTrackerFileName = 
                  originalFileName.includes('rtu-tracker') || 
                  originalFileName.includes('rtu_tracker') ||
                  originalFileName.includes('rtu tracker') ||
                  originalFileName.includes('rtutracker') ||
                  normalizedFileName.includes('rtutracker') ||
                  /rtu.*tracker/i.test(f.name || '');
                return isRtuTrackerType || isRtuTrackerFileName;
              });
              
              const latestRtuTrackerFile = rtuTrackerFiles.sort((a: any, b: any) => {
                const dateA = a.uploadedAt ? new Date(a.uploadedAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
                const dateB = b.uploadedAt ? new Date(b.uploadedAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
                return dateB - dateA;
              })[0];
              
              if (latestRtuTrackerFile) {
                const rtuTrackerDataRes = await fetch(`${API_BASE}/api/uploads/${latestRtuTrackerFile.fileId}`, {
                  headers: {
                    'Authorization': token ? `Bearer ${token}` : ''
                  }
                });
                const rtuTrackerDataJson = await rtuTrackerDataRes.json();
                
                if (rtuTrackerDataJson?.success && rtuTrackerDataJson.file) {
                  const rtuTrackerData = rtuTrackerDataJson.file;
                  const rtuTrackerRows = Array.isArray(rtuTrackerData.rows) ? rtuTrackerData.rows : [];
                  const rtuTrackerHeaders = rtuTrackerData.headers && rtuTrackerData.headers.length 
                    ? rtuTrackerData.headers 
                    : (rtuTrackerRows[0] ? Object.keys(rtuTrackerRows[0]) : []);
                  
                  const rtuTrackerSiteCodeHeader = rtuTrackerHeaders.find((h: string) => {
                    const normalized = normalizeHeader(h);
                    return normalized === 'site code' || normalized === 'sitecode' || normalized === 'site_code';
                  });
                  
                  const parseDateFromColumnName = (columnName: string): Date | null => {
                    const datePatterns = [
                      /(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/,
                      /(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/,
                    ];
                    for (const pattern of datePatterns) {
                      const match = columnName.match(pattern);
                      if (match) {
                        if (pattern.source.includes('\\d{4}') && pattern.source.startsWith('(\\d{4})')) {
                          const year = parseInt(match[1]);
                          const month = parseInt(match[2]) - 1;
                          const day = parseInt(match[3]);
                          return new Date(year, month, day);
                        } else {
                          const day = parseInt(match[1]);
                          const month = parseInt(match[2]) - 1;
                          const year = parseInt(match[3]);
                          return new Date(year, month, day);
                        }
                      }
                    }
                    return null;
                  };
                  
                  const rtuTrackerDateColumns: Array<{ name: string; date: Date; index: number }> = [];
                  rtuTrackerHeaders.forEach((h: string, index: number) => {
                    const normalized = normalizeHeader(h);
                    if (normalized.includes('date') || normalized.includes('time')) {
                      const date = parseDateFromColumnName(h);
                      if (date && !isNaN(date.getTime())) {
                        rtuTrackerDateColumns.push({ name: h, date, index });
                      }
                    }
                  });
                  
                  let latestRtuTrackerDateColumn: string | null = null;
                  let latestRtuTrackerDateColumnIndex: number = -1;
                  if (rtuTrackerDateColumns.length > 0) {
                    rtuTrackerDateColumns.sort((a, b) => b.date.getTime() - a.date.getTime());
                    latestRtuTrackerDateColumn = rtuTrackerDateColumns[0].name;
                    latestRtuTrackerDateColumnIndex = rtuTrackerDateColumns[0].index;
                  }
                  
                  let rtuTrackerColumnsToInsert: string[] = [];
                  let startIndex = -1;
                  if (latestRtuTrackerDateColumnIndex !== -1 && latestRtuTrackerDateColumnIndex + 1 < rtuTrackerHeaders.length) {
                    startIndex = latestRtuTrackerDateColumnIndex + 1;
                  } else if (rtuTrackerSiteCodeHeader) {
                    const siteCodeIndex = rtuTrackerHeaders.indexOf(rtuTrackerSiteCodeHeader);
                    if (siteCodeIndex !== -1 && siteCodeIndex + 1 < rtuTrackerHeaders.length) {
                      startIndex = siteCodeIndex + 1;
                    }
                  }
                  
                  // First, find "CCR Date of Observation" column specifically from ALL RTU TRACKER headers
                  const ccrDateOfObservationHeader = rtuTrackerHeaders.find((h: string) => {
                    const normalized = normalizeHeader(h);
                    return normalized.includes('ccr') && normalized.includes('date') && normalized.includes('observation');
                  });
                  
                  // Add "CCR Date of Observation" if found (regardless of position)
                  if (ccrDateOfObservationHeader) {
                    if (!rtuTrackerColumnsToInsert.includes(ccrDateOfObservationHeader)) {
                      rtuTrackerColumnsToInsert.push(ccrDateOfObservationHeader);
                      rtuTrackerColumnsList.push(ccrDateOfObservationHeader);
                      console.log('MY RTU TRACKER - Found and added "CCR Date of Observation" column:', ccrDateOfObservationHeader);
                    }
                  }
                  
                  // Then add other columns (excluding date columns, site code, and CCR Date of Observation)
                  if (startIndex !== -1 && startIndex < rtuTrackerHeaders.length) {
                    for (let i = startIndex; i < rtuTrackerHeaders.length; i++) {
                      const header = rtuTrackerHeaders[i];
                      const normalizedHeader = normalizeHeader(header);
                      if (normalizedHeader === 'site code' || normalizedHeader === 'sitecode' || normalizedHeader === 'site_code') {
                        continue;
                      }
                      // Skip if this is the CCR Date of Observation (already added above)
                      if (header === ccrDateOfObservationHeader) {
                        continue;
                      }
                      // Skip date columns (like "DATE 20-11-2025") but keep "CCR Date of Observation"
                      const isDateColumn = (normalizedHeader.includes('date') || normalizedHeader.includes('time')) && 
                                          header !== ccrDateOfObservationHeader;
                      if (isDateColumn) {
                        continue;
                      }
                      // Don't add duplicates
                      if (!rtuTrackerColumnsToInsert.includes(header)) {
                        rtuTrackerColumnsToInsert.push(header);
                        rtuTrackerColumnsList.push(header);
                      }
                    }
                  }
                  
                  if (mainSiteCodeHeader && rtuTrackerSiteCodeHeader && rtuTrackerColumnsToInsert.length > 0) {
                    let filteredRtuTrackerRows = [...rtuTrackerRows];
                    if (latestRtuTrackerDateColumn) {
                      filteredRtuTrackerRows = rtuTrackerRows.filter((row: any) => {
                        const dateValue = row[latestRtuTrackerDateColumn!];
                        return dateValue !== null && dateValue !== undefined && String(dateValue).trim() !== '';
                      });
                    }
                    
                    const rtuTrackerMap = new Map<string, any>();
                    filteredRtuTrackerRows.forEach((row: any) => {
                      const siteCode = String(row[rtuTrackerSiteCodeHeader] || '').trim();
                      if (siteCode) {
                        if (rtuTrackerMap.has(siteCode)) {
                          const existingRow = rtuTrackerMap.get(siteCode);
                          const existingHasDate = latestRtuTrackerDateColumn && existingRow[latestRtuTrackerDateColumn] && 
                                                 String(existingRow[latestRtuTrackerDateColumn]).trim() !== '';
                          const currentHasDate = latestRtuTrackerDateColumn && row[latestRtuTrackerDateColumn] && 
                                               String(row[latestRtuTrackerDateColumn]).trim() !== '';
                          if (currentHasDate && !existingHasDate) {
                            rtuTrackerMap.set(siteCode, row);
                          }
                        } else {
                          rtuTrackerMap.set(siteCode, row);
                        }
                      }
                    });
                    
                    fileRows = fileRows.map((row: any) => {
                      const siteCode = String(row[mainSiteCodeHeader] || '').trim();
                      const rtuTrackerRow = rtuTrackerMap.get(siteCode);
                      const mergedRow = { ...row };
                      rtuTrackerColumnsToInsert.forEach((col: string) => {
                        let value = rtuTrackerRow ? (rtuTrackerRow[col] ?? '') : '';
                        // Convert Excel serial dates in date columns (especially "CCR Date of Observation")
                        const normalizedCol = normalize(col);
                        if (normalizedCol.includes('date') || normalizedCol.includes('time')) {
                          value = convertExcelSerialToDate(value);
                        }
                        mergedRow[col] = value;
                      });
                      return mergedRow;
                    });
                    
                    rtuTrackerColumnsToInsert.forEach((col: string) => {
                      if (!columnsToInsert.includes(col)) columnsToInsert.push(col);
                      if (!onlineOfflineColumnsToPreserve.includes(col)) onlineOfflineColumnsToPreserve.push(col);
                    });
                    
                    const siteCodeIndexInHeaders = hdrs.indexOf(mainSiteCodeHeader);
                    if (siteCodeIndexInHeaders !== -1) {
                      const rtuTrackerColumnsToAdd = rtuTrackerColumnsToInsert.filter(col => !hdrs.includes(col));
                      if (rtuTrackerColumnsToAdd.length > 0) {
                        hdrs = [
                          ...hdrs.slice(0, siteCodeIndexInHeaders),
                          ...rtuTrackerColumnsToAdd,
                          ...hdrs.slice(siteCodeIndexInHeaders)
                        ];
                      }
                    }
                  }
                }
              }
            }
          } catch (error) {
            console.error('MY RTU TRACKER - Error fetching RTU-TRACKER files:', error);
          }
          
          // Reorder headers: Move SITE CODE right after ATTRIBUTE (same as View Data)
          const reorderHeaders = (headers: string[], columnsToPreserve: string[]): string[] => {
            const normalizedHeaders = headers.map((h: string) => h.trim());
            const siteCodeIndex = normalizedHeaders.findIndex((h: string) => 
              h.toLowerCase() === 'site code' || h.toLowerCase() === 'sitecode' || h.toLowerCase() === 'site_code'
            );
            const attributeIndex = normalizedHeaders.findIndex((h: string) => 
              h.toLowerCase() === 'attribute' || h.toLowerCase() === 'attributes'
            );
            
            if (siteCodeIndex === -1) {
              return headers;
            }
            
            const reordered = [...headers];
            const siteCodeHeader = reordered.splice(siteCodeIndex, 1)[0];
            
            const columnsToMove: string[] = [];
            columnsToPreserve.forEach(col => {
              let colIndex = reordered.indexOf(col);
              if (colIndex === -1) {
                colIndex = reordered.findIndex((h: string) => h.trim().toLowerCase() === col.trim().toLowerCase());
              }
              if (colIndex === -1) {
                const normalizedCol = col.trim().toLowerCase().replace(/\s+/g, '');
                colIndex = reordered.findIndex((h: string) => {
                  const normalizedH = h.trim().toLowerCase().replace(/\s+/g, '');
                  return normalizedH === normalizedCol;
                });
              }
              if (colIndex !== -1) {
                reordered.splice(colIndex, 1);
                columnsToMove.push(col);
              } else {
                columnsToMove.push(col);
              }
            });
            
            let attributeHeader: string | null = null;
            if (attributeIndex !== -1) {
              let adjustedIndex = attributeIndex;
              if (adjustedIndex > siteCodeIndex) adjustedIndex--;
              adjustedIndex -= columnsToMove.filter(col => {
                const originalIndex = headers.indexOf(col);
                return originalIndex !== -1 && originalIndex < attributeIndex;
              }).length;
              if (adjustedIndex >= 0 && adjustedIndex < reordered.length) {
                attributeHeader = reordered.splice(adjustedIndex, 1)[0];
              }
            }
            
            if (attributeHeader) {
              reordered.push(attributeHeader);
              reordered.push(siteCodeHeader);
              reordered.push(...columnsToMove);
            } else {
              reordered.push(siteCodeHeader);
              reordered.push(...columnsToMove);
            }
            
            return reordered;
          };
          
          hdrs = reorderHeaders(hdrs, onlineOfflineColumnsToPreserve);
          
          // Find columns for filtering BEFORE removing them from display
          // Find ATTRIBUTE column for filtering (we'll remove it from display later)
          const attributeKey = hdrs.find((h: string) => {
            const norm = normalize(h);
            return norm === 'attribute' || norm === 'attributes';
          });
          
          // Find PRODUCTION OBSERVATIONS column for filtering
          const productionObsKey = hdrs.find((h: string) => {
            const norm = normalize(h);
            return (norm.includes('production') && norm.includes('observation')) ||
                   norm === 'productionobservations' || norm === 'production_observations' ||
                   norm === 'production observations';
          });
          
          // Find DIVISION column for filtering
          const divisionKey = hdrs.find((h: string) => {
            const norm = normalize(h);
            return norm === 'division' || norm === 'divisionname' || norm === 'division name' ||
                   norm.includes('division');
          });
          
          console.log('MY RTU TRACKER - Headers before removing columns:', hdrs);
          console.log('MY RTU TRACKER - ATTRIBUTE key (for filtering):', attributeKey);
          console.log('MY RTU TRACKER - PRODUCTION OBSERVATIONS key:', productionObsKey);
          console.log('MY RTU TRACKER - DIVISION key:', divisionKey);
          console.log('MY RTU TRACKER - Total rows before filtering:', fileRows.length);
          
          // Remove unwanted columns from display: CIRCLE, RTU MAKE, ATTRIBUTE, NO OF DAYS OFFLINE, DEVICE TYPE, RTU L/R SWITCH STATUS_3, EQUIPEMNT L/R SWITCH STATUS_3
          hdrs = hdrs.filter((h: string) => {
            const normalized = normalize(h);
            
            // Remove CIRCLE
            if (normalized === 'circle' || normalized === 'circle name' || normalized === 'circlename') {
              return false;
            }
            
            // Remove RTU MAKE
            if ((normalized.includes('rtu') && normalized.includes('make')) ||
                normalized === 'rtumake' || normalized === 'rtu_make') {
              return false;
            }
            
            // Remove ATTRIBUTE (from display, but we keep it in data for filtering)
            if (normalized === 'attribute' || normalized === 'attributes') {
              return false;
            }
            
            // Remove NO OF DAYS OFFLINE (handles all variations including with _3 suffix)
            if ((normalized.includes('days') && normalized.includes('offline')) ||
                normalized === 'noofdaysoffline' || normalized === 'no_of_days_offline' ||
                normalized === 'numberofdaysoffline' || normalized === 'number_of_days_offline' ||
                normalized === 'no of days offline' || normalized === 'number of days offline') {
              return false;
            }
            
            // Remove DEVICE TYPE
            if ((normalized.includes('device') && normalized.includes('type')) ||
                normalized === 'devicetype' || normalized === 'device_type' ||
                normalized === 'device type') {
              return false;
            }
            
            // Remove RTU L/R SWITCH STATUS_3 (handles variations with _3 suffix)
            if ((normalized.includes('rtu') && normalized.includes('l') && normalized.includes('r') && 
                 normalized.includes('switch') && normalized.includes('status') && normalized.includes('3')) ||
                (normalized.includes('rtu') && normalized.includes('switch') && normalized.includes('status') && normalized.includes('3'))) {
              return false;
            }
            
            // Remove DATE columns that match pattern "DATE DD-MM-YYYY" (e.g., "DATE 20-11-2025")
            // But keep "CCR Date of Observation" column
            if ((normalized.includes('date') || normalized.includes('time')) && 
                !normalized.includes('ccr') && 
                !normalized.includes('observation')) {
              // Check if it matches DATE DD-MM-YYYY pattern
              const datePattern = /^date\s+\d{1,2}[-\/]\d{1,2}[-\/]\d{4}$/i;
              if (datePattern.test(h.trim())) {
                console.log(`MY RTU TRACKER - Removing DATE column: ${h}`);
                return false;
              }
            }
            
            // Remove EQUIPEMNT L/R SWITCH STATUS_3 (note: handles typo "EQUIPEMNT" as well as "EQUIPMENT")
            if ((normalized.includes('equipemnt') && normalized.includes('l') && normalized.includes('r') && 
                 normalized.includes('switch') && normalized.includes('status') && normalized.includes('3')) ||
                (normalized.includes('equipment') && normalized.includes('l') && normalized.includes('r') && 
                 normalized.includes('switch') && normalized.includes('status') && normalized.includes('3')) ||
                (normalized.includes('equipemnt') && normalized.includes('switch') && normalized.includes('status') && normalized.includes('3')) ||
                (normalized.includes('equipment') && normalized.includes('switch') && normalized.includes('status') && normalized.includes('3'))) {
              return false;
            }
            
            return true;
          });
          
          console.log('MY RTU TRACKER - Final headers (after removing columns):', hdrs);
          console.log('MY RTU TRACKER - Headers count:', hdrs.length);
          
          // Insert the last five columns from MY OFFLINE SITES at the very end (after RTU TRACKER OBSERVATION)
          // Find the index of "RTU TRACKER OBSERVATION" column to insert after it
          const rtuTrackerObservationIndex = hdrs.findIndex((h: string) => {
            const norm = normalize(h);
            return (norm.includes('rtu') && norm.includes('tracker') && norm.includes('observation')) ||
                   norm === 'rtutrackerobservation' || norm === 'rtu_tracker_observation' ||
                   norm === 'rtu tracker observation' || norm === 'rtutrackerobservbation' ||
                   norm === 'rtu_tracker_observbation' || norm === 'rtu tracker observbation';
          });
          
          // Insert the five columns after RTU TRACKER OBSERVATION if it exists, otherwise at the end
          const newColumns = ['Site Observations', 'Task Status', 'Type of Issue', 'View Photos', 'Remarks'];
          if (rtuTrackerObservationIndex !== -1) {
            // Insert after RTU TRACKER OBSERVATION
            newColumns.forEach((col, idx) => {
              if (!hdrs.includes(col)) {
                hdrs.splice(rtuTrackerObservationIndex + 1 + idx, 0, col);
              }
            });
          } else {
            // If RTU TRACKER OBSERVATION not found, add all columns at the end
            newColumns.forEach(col => {
              if (!hdrs.includes(col)) {
                hdrs.push(col);
              }
            });
          }
          
          // Ensure all rows have these new columns (even if empty)
          fileRows = fileRows.map((row: any) => {
            const updatedRow = { ...row };
            const columnsToEnsure = ['Site Observations', 'Task Status', 'Type of Issue', 'View Photos', 'Remarks'];
            columnsToEnsure.forEach((col: string) => {
              if (!(col in updatedRow)) {
                updatedRow[col] = '';
              }
            });
            return updatedRow;
          });
          
          console.log('MY RTU TRACKER - Headers after adding last five columns:', hdrs);
          
          // Remove duplicate columns for Equipment role
          // Remove duplicate DEVICE STATUS_3 and NO OF DAYS OFFLINE_3 columns
          if (userRole === 'Equipment') {
            const columnsToRemove: number[] = [];
            
            // First pass: Find all DEVICE STATUS and NO OF DAYS OFFLINE columns
            const deviceStatusColumns: Array<{ index: number; header: string; hasSuffix: boolean }> = [];
            const noOfDaysOfflineColumns: Array<{ index: number; header: string; hasSuffix: boolean }> = [];
            
            hdrs.forEach((header: string, index: number) => {
              const normalized = normalize(header);
              
              // Check for DEVICE STATUS columns
              if ((normalized.includes('device') && normalized.includes('status')) ||
                  normalized === 'devicestatus' || normalized === 'device_status') {
                const hasSuffix = normalized.includes('3') || header.includes('_3');
                deviceStatusColumns.push({ index, header, hasSuffix });
              }
              
              // Check for NO OF DAYS OFFLINE columns
              if ((normalized.includes('days') && normalized.includes('offline')) ||
                  normalized === 'noofdaysoffline' || normalized === 'no_of_days_offline' ||
                  normalized === 'numberofdaysoffline' || normalized === 'number_of_days_offline') {
                const hasSuffix = normalized.includes('3') || header.includes('_3');
                noOfDaysOfflineColumns.push({ index, header, hasSuffix });
              }
            });
            
            // Remove DEVICE STATUS_3 if we have DEVICE STATUS without _3
            const hasDeviceStatusWithoutSuffix = deviceStatusColumns.some(col => !col.hasSuffix);
            if (hasDeviceStatusWithoutSuffix) {
              deviceStatusColumns.forEach(col => {
                if (col.hasSuffix) {
                  console.log(`MY RTU TRACKER - Removing duplicate DEVICE STATUS_3 column: ${col.header}`);
                  columnsToRemove.push(col.index);
                }
              });
            } else {
              // If we only have _3 versions, keep only the first one
              const _3Columns = deviceStatusColumns.filter(col => col.hasSuffix);
              if (_3Columns.length > 1) {
                _3Columns.slice(1).forEach(col => {
                  console.log(`MY RTU TRACKER - Removing duplicate DEVICE STATUS_3 column: ${col.header}`);
                  columnsToRemove.push(col.index);
                });
              }
            }
            
            // Remove NO OF DAYS OFFLINE_3 if we have NO OF DAYS OFFLINE without _3
            const hasNoOfDaysOfflineWithoutSuffix = noOfDaysOfflineColumns.some(col => !col.hasSuffix);
            if (hasNoOfDaysOfflineWithoutSuffix) {
              noOfDaysOfflineColumns.forEach(col => {
                if (col.hasSuffix) {
                  console.log(`MY RTU TRACKER - Removing duplicate NO OF DAYS OFFLINE_3 column: ${col.header}`);
                  columnsToRemove.push(col.index);
                }
              });
            } else {
              // If we only have _3 versions, keep only the first one
              const _3Columns = noOfDaysOfflineColumns.filter(col => col.hasSuffix);
              if (_3Columns.length > 1) {
                _3Columns.slice(1).forEach(col => {
                  console.log(`MY RTU TRACKER - Removing duplicate NO OF DAYS OFFLINE_3 column: ${col.header}`);
                  columnsToRemove.push(col.index);
                });
              }
            }
            
            // Remove duplicate columns (in reverse order to maintain indices)
            if (columnsToRemove.length > 0) {
              columnsToRemove.sort((a, b) => b - a);
              columnsToRemove.forEach(index => {
                const removedHeader = hdrs[index];
                hdrs.splice(index, 1);
                console.log(`MY RTU TRACKER - Removed duplicate column at index ${index}: ${removedHeader}`);
              });
              console.log('MY RTU TRACKER - Headers after removing duplicates:', hdrs);
            }
          }
          
          // Apply filters
          let filteredRows = fileRows;
          
          // Filter by ATTRIBUTE = "IN PRODUCTION" (for all roles)
          if (attributeKey && filteredRows.length > 0) {
            const beforeCount = filteredRows.length;
            
            filteredRows = filteredRows.filter((row: any) => {
              const attributeValue = String(row[attributeKey] || '').trim();
              const normalizedValue = normalize(attributeValue);
              // Match "in production" (case-insensitive)
              return normalizedValue === 'in production' || normalizedValue === 'inproduction';
            });
            
            console.log(`MY RTU TRACKER - ATTRIBUTE filter: ${beforeCount} rows -> ${filteredRows.length} rows (filtering for ATTRIBUTE = "IN PRODUCTION")`);
          } else {
            if (!attributeKey) {
              console.warn('MY RTU TRACKER - ATTRIBUTE column not found in data');
            }
          }
          
          // Filter by PRODUCTION OBSERVATIONS = YES (for all roles)
          if (productionObsKey && filteredRows.length > 0) {
            const beforeCount = filteredRows.length;
            
            filteredRows = filteredRows.filter((row: any) => {
              const prodObsValue = String(row[productionObsKey] || '').trim();
              const normalizedValue = normalize(prodObsValue);
              return normalizedValue === 'yes';
            });
            
            console.log(`MY RTU TRACKER - PRODUCTION OBSERVATIONS filter: ${beforeCount} rows -> ${filteredRows.length} rows (filtering for PRODUCTION OBSERVATIONS = YES)`);
          } else {
            if (!productionObsKey) {
              console.warn('MY RTU TRACKER - PRODUCTION OBSERVATIONS column not found in data');
              console.warn('MY RTU TRACKER - Available headers:', hdrs);
            }
          }
          
          // Filter by user's assigned DIVISION (for Equipment and RTU/Communication roles)
          if ((userRole === 'Equipment' || userRole === 'RTU/Communication')) {
            if (!divisionKey) {
              console.warn('MY RTU TRACKER - DIVISION column not found in data headers:', hdrs);
            } else if (userDivisions.length === 0) {
              console.warn('MY RTU TRACKER - User has no divisions assigned');
            } else {
              const beforeCount = filteredRows.length;
              
              filteredRows = filteredRows.filter((row: any) => {
                const rowDivision = String(row[divisionKey] || '').trim();
                const matches = userDivisions.some((div: string) => {
                  const userDiv = normalize(String(div));
                  const dataDiv = normalize(rowDivision);
                  
                  if (userDiv === dataDiv) {
                    return true;
                  }
                  
                  const lengthDiff = Math.abs(userDiv.length - dataDiv.length);
                  if (lengthDiff <= 2 && (userDiv.includes(dataDiv) || dataDiv.includes(userDiv))) {
                    return true;
                  }
                  
                  return false;
                });
                return matches;
              });
              
              console.log(`MY RTU TRACKER - Division filter: ${beforeCount} rows -> ${filteredRows.length} rows`);
            }
          }
          
          setHeaders(hdrs);
          setRows(filteredRows);
          setCurrentPage(1);
        } else {
          console.warn('MY RTU TRACKER - File fetch failed or no file data');
          setRows([]);
          setHeaders([]);
        }
      } catch (error) {
        console.error('MY RTU TRACKER - Error in data fetching:', error);
        setRows([]);
        setHeaders([]);
      }
    })();
  }, [selectedFile, userRole, userDivisions, refreshTrigger]);

  // Search and pagination
  const filteredRows = rows.filter((row) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return headers.some((header) => {
      const value = String(row[header] || '').toLowerCase();
      return value.includes(searchLower);
    });
  });

  const sortedRows = [...filteredRows];
  const totalPages = Math.ceil(sortedRows.length / rowsPerPage);
  const paginatedRows = sortedRows.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  // Download functions
  function downloadCSV() {
    if (!headers.length || !rows.length) return;
    
    const exportHeaders = headers;
    const exportRows = rows.map(row => 
      exportHeaders.map(h => {
        const value = row[h] ?? '';
        return String(value).replace(/,/g, ';');
      })
    );
    
    const csvContent = [
      exportHeaders.join(','),
      ...exportRows.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `my-rtu-tracker-${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function downloadXLSX() {
    if (!headers.length || !rows.length) return;
    
    const exportHeaders = headers;
    const exportRows = rows.map(row => 
      exportHeaders.map(h => row[h] ?? '')
    );
    
    const ws = XLSX.utils.aoa_to_sheet([exportHeaders, ...exportRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'MY RTU TRACKER');
    XLSX.writeFile(wb, `my-rtu-tracker-${new Date().getTime()}.xlsx`);
  }

  function downloadPDF() {
    if (!headers.length || !rows.length) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>MY RTU TRACKER</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { border-collapse: collapse; width: 100%; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #4CAF50; color: white; }
            tr:nth-child(even) { background-color: #f2f2f2; }
          </style>
        </head>
        <body>
          <h1>MY RTU TRACKER</h1>
          <table>
            <thead>
              <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${rows.map(row => 
                `<tr>${headers.map(h => `<td>${row[h] ?? ''}</td>`).join('')}</tr>`
              ).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
    
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.print();
  }

  function handleDownloadSelect(val: string) {
    if (!val) return;
    if (val === 'pdf') downloadPDF();
    if (val === 'xlsx') downloadXLSX();
    if (val === 'csv') downloadCSV();
  }

  const pageTitle = 'MY RTU TRACKER';

  if (!uploadedFiles.length) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold mb-2 text-gray-800">{pageTitle}</h2>
        <p className="text-gray-500">No Device Status Upload files available. Please upload from Upload tab.</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">{pageTitle}</h2>
      
      {/* Controls Row */}
      <div className="flex flex-wrap gap-2 md:gap-4 items-center mb-3 whitespace-nowrap inline-flex">
        <input
          className="border border-gray-300 border-[1px] rounded px-2 py-1 flex-1 min-w-[120px]"
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          disabled={!selectedFile}
        />
        {userRole === 'Equipment' && selectedFile && (
          <button
            onClick={async () => {
              console.log('[MyRTUTracker] Manual refresh triggered');
              // Force refresh by resetting loading flag and fallback ref
              isLoadingRef.current = false;
              fallbackAppliedRef.current = ''; // Reset to allow fallback matching to run again
              await loadFromRTUTrackerSitesDB();
            }}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
            title="Refresh data from database to sync with mobile app"
          >
            🔄 Refresh
          </button>
        )}
        <label className="block font-medium text-gray-700">Download:</label>
        <select
          className="border border-gray-300 rounded px-2 py-2 min-w-[140px] bg-white"
          defaultValue=""
          onChange={e => { handleDownloadSelect(e.target.value); e.currentTarget.value = ''; }}
          disabled={!selectedFile || !rows.length}
        >
          <option value="" disabled>Select format</option>
          <option value="pdf">PDF</option>
          <option value="xlsx">XLSX</option>
          <option value="csv">CSV</option>
        </select>
      </div>

      {headers.length === 0 ? (
        <div className="text-center py-8 text-gray-500 border rounded-lg">
          Loading data... (If this persists, check console for errors)
        </div>
      ) : (
        <div 
          className="border rounded-lg shadow bg-white max-h-[70vh] w-full"
          style={{ 
            overflowX: 'scroll', 
            overflowY: 'auto', 
            width: '100%',
            display: 'block'
          }}
        >
          <table
            className="border border-gray-300"
            style={{ 
              fontFamily: 'Times New Roman, Times, serif', 
              borderCollapse: 'collapse', 
              tableLayout: 'auto',
              width: 'auto',
              minWidth: '100%',
              display: 'table'
            }}
          >
            <thead style={{ fontFamily: 'Times New Roman, Times, serif', fontSize: 14, position: 'sticky', top: 0, zIndex: 10 }}>
              <tr style={{ background: 'linear-gradient(90deg, #dbeafe 0%, #bae6fd 100%)' }}>
                {headers.map(h => (
                  <th
                    key={h}
                    className="px-3 py-2 font-bold border border-gray-300 text-center"
                    style={{ fontFamily: 'Times New Roman, Times, serif', fontSize: 14, fontWeight: 'bold', textAlign: 'center', whiteSpace: 'pre-wrap', background: 'linear-gradient(90deg, #dbeafe 0%, #bae6fd 100%)', position: 'sticky', top: 0 }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody style={{ fontFamily: 'Times New Roman, Times, serif', fontSize: 12 }}>
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={headers.length} className="text-center py-8 text-gray-500 border border-gray-300">
                    No data found. {rows.length === 0 ? 'No rows available. Check console for filtering issues.' : `Total rows: ${rows.length}, but none match current filters/search.`}
                  </td>
                </tr>
              ) : paginatedRows.map((row, idx) => {
                const rowKey = generateRowKey(selectedFile, row, headers);
                const siteCodeHeader = headers.find((h: string) => {
                  const normalized = normalize(h);
                  return normalized === 'sitecode' || normalized === 'site_code' || normalized === 'site code';
                });
                const siteCode = siteCodeHeader ? String(row[siteCodeHeader] || '').trim().toUpperCase() : '';
                
                // Debug: Log rowKey and data lookup for first few rows
                if (idx < 3) {
                  console.log(`[MyRTUTracker Render] Row ${idx} - Site Code: ${siteCode}, RowKey: ${rowKey}`, {
                    hasSiteObservations: !!siteObservations[rowKey],
                    siteObservationsValue: siteObservations[rowKey],
                    hasTaskStatus: !!taskStatus[rowKey],
                    taskStatusValue: taskStatus[rowKey],
                    hasViewPhotos: !!(viewPhotos[rowKey] && viewPhotos[rowKey].length > 0),
                    photosCount: viewPhotos[rowKey]?.length || 0
                  });
                }
                const isEven = idx % 2 === 0;
                return (
                  <tr 
                    key={row.id || idx} 
                    className="transition-colors duration-150"
                    style={{ 
                      backgroundColor: isEven ? '#f0f9ff' : '#ffffff',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#93c5fd';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = idx % 2 === 0 ? '#f0f9ff' : '#ffffff';
                    }}
                  >
                    {headers.map(h => {
                      const normalizedH = normalize(h);
                      // Handle SL NO column
                      if (normalizedH === 'slno' || normalizedH === 'sl_no' || normalizedH === 'sl no' || 
                          normalizedH === 's.no' || normalizedH === 's no' || normalizedH === 'serial' || 
                          normalizedH === 'serialno' || normalizedH === 'serial_no' || normalizedH === 'serial no' ||
                          (normalizedH.includes('sl') && normalizedH.includes('no'))) {
                        const slNo = (currentPage - 1) * rowsPerPage + idx + 1;
                        return (
                          <td
                            key={h}
                            className="px-3 py-1 border border-gray-300 text-gray-700 text-center"
                            style={{ fontFamily: 'Times New Roman, Times, serif', fontSize: 12, textAlign: 'center', whiteSpace: 'pre-wrap' }}
                          >
                            {slNo}
                          </td>
                        );
                      }
                      // Handle Site Observations column
                      if (h === 'Site Observations') {
                        const isResolved = siteObservations[rowKey] === 'Resolved';
                        return (
                          <td
                            key={h}
                            className="px-3 py-1 border border-gray-300 text-center"
                            style={{ 
                              fontFamily: 'Times New Roman, Times, serif', 
                              fontSize: 12,
                              backgroundColor: isResolved ? '#f3f4f6' : 'transparent',
                              opacity: isResolved ? 0.7 : 1
                            }}
                          >
                            <select
                              value={siteObservations[rowKey] || ''}
                              onChange={(e) => {
                                if (isResolved) return;
                                const selectedValue = e.target.value;
                                
                                if (selectedValue.toLowerCase() === 'resolved' || selectedValue.toLowerCase() === 'pending') {
                                  // Don't update state yet - wait for Submit
                                  // Store the previous value to restore on Cancel
                                  const previousValue = siteObservations[rowKey] || '';
                                  setSelectedSiteObservationRowKey(rowKey);
                                  setSiteObservationsStatus(selectedValue.toLowerCase());
                                  setSiteObservationsDialogData({
                                    remarks: remarks[rowKey] || '',
                                    typeOfIssue: typeOfIssue[rowKey] || '',
                                    specifyOther: '',
                                    typeOfSpare: [],
                                    specifySpareOther: '',
                                    dateOfInspection: dateOfInspection[rowKey] || '',
                                    capturedPhotos: [],
                                    uploadedPhotos: [],
                                    uploadedDocuments: [],
                                    previousValue: previousValue // Store previous value to restore on Cancel
                                  });
                                  setShowSiteObservationsDialog(true);
                                } else if (selectedValue === '') {
                                  setSiteObservations(prev => {
                                    const updated = { ...prev };
                                    delete updated[rowKey];
                                    return updated;
                                  });
                                  setTaskStatus(prev => {
                                    const updated = { ...prev };
                                    delete updated[rowKey];
                                    return updated;
                                  });
                                  setTypeOfIssue(prev => {
                                    const updated = { ...prev };
                                    delete updated[rowKey];
                                    return updated;
                                  });
                                  setViewPhotos(prev => {
                                    const updated = { ...prev };
                                    delete updated[rowKey];
                                    return updated;
                                  });
                                  setRemarks(prev => {
                                    const updated = { ...prev };
                                    delete updated[rowKey];
                                    return updated;
                                  });
                                  delete siteObservationsRef.current[rowKey];
                                  delete taskStatusRef.current[rowKey];
                                  delete typeOfIssueRef.current[rowKey];
                                  delete viewPhotosRef.current[rowKey];
                                  delete remarksRef.current[rowKey];
                                  delete photoMetadataRef.current[rowKey];
                                  setTimeout(() => saveToRTUTrackerSitesDB(), 50);
                                } else {
                                  // For other values, update immediately
                                  setSiteObservations(prev => ({
                                    ...prev,
                                    [rowKey]: selectedValue
                                  }));
                                  siteObservationsRef.current = {
                                    ...siteObservationsRef.current,
                                    [rowKey]: selectedValue
                                  };
                                  setSiteObservationsLastModified((prev) => ({
                                    ...prev,
                                    [rowKey]: Date.now()
                                  }));
                                  setTimeout(() => saveToRTUTrackerSitesDB(), 50);
                                }
                              }}
                              disabled={isResolved}
                              className={`w-full px-2 py-1 border-0 rounded text-sm bg-transparent focus:outline-none focus:ring-0 ${
                                isResolved ? 'text-gray-500 cursor-not-allowed' : 'text-gray-700'
                              }`}
                              style={{ 
                                fontFamily: 'Times New Roman, Times, serif', 
                                fontSize: 12,
                                cursor: isResolved ? 'not-allowed' : 'pointer'
                              }}
                            >
                              <option value="">Select Status</option>
                              <option value="Resolved">Resolved</option>
                              <option value="Pending">Pending</option>
                            </select>
                          </td>
                        );
                      }
                      // Handle Task Status column
                      if (h === 'Task Status') {
                        const displayValue = taskStatus[rowKey] || '-';
                        return (
                          <td
                            key={h}
                            className="px-3 py-1 border border-gray-300 text-gray-700 text-center"
                            style={{ fontFamily: 'Times New Roman, Times, serif', fontSize: 12, textAlign: 'center', whiteSpace: 'pre-wrap' }}
                          >
                            {displayValue}
                          </td>
                        );
                      }
                      // Handle Type of Issue column
                      if (h === 'Type of Issue') {
                        const displayValue = typeOfIssue[rowKey] || '-';
                        return (
                          <td
                            key={h}
                            className="px-3 py-1 border border-gray-300 text-center"
                            style={{ fontFamily: 'Times New Roman, Times, serif', fontSize: 12 }}
                          >
                            {displayValue}
                          </td>
                        );
                      }
                      // Handle View Photos column
                      if (h === 'View Photos') {
                        const photosToDisplay = viewPhotos[rowKey] || [];
                        return (
                          <td
                            key={h}
                            className="px-3 py-1 border border-gray-300 text-center"
                            style={{ fontFamily: 'Times New Roman, Times, serif', fontSize: 12 }}
                          >
                            {photosToDisplay.length > 0 ? (
                              <button
                                onClick={() => {
                                  setSelectedRowKeyForPhotos(rowKey);
                                  setShowPhotoViewer(true);
                                }}
                                className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                                style={{ fontFamily: 'Times New Roman, Times, serif', fontSize: 12 }}
                              >
                                View ({photosToDisplay.length})
                              </button>
                            ) : (
                              <span className="text-gray-400 text-xs">No photos</span>
                            )}
                          </td>
                        );
                      }
                      // Handle Remarks column
                      if (h === 'Remarks') {
                        const displayRemarks = remarks[rowKey] || '-';
                        return (
                          <td
                            key={h}
                            className="px-3 py-1 border border-gray-300 text-center"
                            style={{ fontFamily: 'Times New Roman, Times, serif', fontSize: 12 }}
                          >
                            <div className="text-sm text-gray-700 whitespace-pre-wrap text-left">
                              {displayRemarks}
                            </div>
                          </td>
                        );
                      }
                      // Default cell rendering
                      return (
                        <td
                          key={h}
                          className="px-3 py-1 border border-gray-300 text-gray-700 text-center"
                          style={{ fontFamily: 'Times New Roman, Times, serif', fontSize: 12, textAlign: 'center', whiteSpace: 'pre-wrap' }}
                        >
                          {String(row[h] ?? '')}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {rows.length > 0 && (
        <div className="flex flex-col items-center gap-2 mt-6">
          <div className="flex items-center gap-4">
            <button 
              className="bg-gray-200 px-4 py-1 rounded disabled:opacity-50 border border-gray-300" 
              disabled={currentPage === 1} 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <span className="font-medium text-gray-700">Page {currentPage} of {totalPages}</span>
            <button 
              className="bg-gray-200 px-4 py-1 rounded disabled:opacity-50 border border-gray-300" 
              disabled={currentPage === totalPages} 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
            <label className="ml-4 block text-sm text-gray-700 font-medium">Rows per page:</label>
            <select 
              value={rowsPerPage} 
              onChange={e => setRowsPerPage(Number(e.target.value))} 
              className="border border-gray-300 rounded px-2 py-1 ml-1 focus:ring-blue-400 focus:border-blue-400" 
              style={{ fontFamily: 'inherit' }}
            >
              {PAGE_SIZE_OPTIONS.map(size => (<option key={size} value={size}>{size}</option>))}
            </select>
          </div>
        </div>
      )}
      
      {/* Site Observations Dialog */}
      {showSiteObservationsDialog && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-[200] flex items-center justify-center"
          style={{ padding: '20px' }}
        >
          <div 
            className="bg-white rounded-lg shadow-xl"
            style={{ 
              width: '90%',
              maxWidth: '600px',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
          >
            <div className="p-5">
              <h3 className="text-lg font-bold mb-4">
                Site Observations - {siteObservationsStatus === 'resolved' ? 'Resolved' : 'Pending'}
              </h3>
              
              {siteObservationsStatus === 'pending' && (
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type of Issue *</label>
                  <select
                    value={siteObservationsDialogData.typeOfIssue}
                    onChange={(e) => setSiteObservationsDialogData(prev => ({ ...prev, typeOfIssue: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-3 py-2"
                  >
                    <option value="">Select Type of Issue</option>
                    <option value="RTU Issue">RTU Issue</option>
                    <option value="CS Issue">CS Issue</option>
                    <option value="Faulty">Faulty</option>
                    <option value="Spare Required">Spare Required</option>
                    <option value="Others">Others</option>
                  </select>
                  {siteObservationsDialogData.typeOfIssue === 'Others' && (
                    <input
                      type="text"
                      placeholder="Specify issue type"
                      value={siteObservationsDialogData.specifyOther}
                      onChange={(e) => setSiteObservationsDialogData(prev => ({ ...prev, specifyOther: e.target.value }))}
                      className="w-full border border-gray-300 rounded px-3 py-2 mt-2"
                    />
                  )}
                </div>
              )}
              
              {siteObservationsStatus === 'resolved' && (
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date of Inspection *</label>
                  <input
                    type="date"
                    value={siteObservationsDialogData.dateOfInspection}
                    onChange={(e) => setSiteObservationsDialogData(prev => ({ ...prev, dateOfInspection: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-3 py-2"
                    required
                  />
                </div>
              )}
              
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {siteObservationsStatus === 'resolved' ? 'Remarks *' : 'Remarks'}
                </label>
                <textarea
                  value={siteObservationsDialogData.remarks}
                  onChange={(e) => setSiteObservationsDialogData(prev => ({ ...prev, remarks: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  rows={4}
                  placeholder="Enter remarks..."
                />
              </div>
              
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Photos</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        let stream: MediaStream;
                        try {
                          // Try to get back camera on mobile devices
                          stream = await navigator.mediaDevices.getUserMedia({
                            video: { facingMode: 'environment' } // Prefer back camera on mobile
                          });
                        } catch (e) {
                          // Fallback to any available camera
                          stream = await navigator.mediaDevices.getUserMedia({
                            video: true
                          });
                        }
                        setSiteObservationsCameraStream(stream);
                        setShowSiteObservationsCameraPreview(true);
                        setSiteObservationsCapturedImageData(null); // Reset any previous capture
                      } catch (error) {
                        console.error('Error accessing camera:', error);
                        alert('Could not access camera. Please check permissions or use Upload Photo instead.');
                        // Fallback to file input if getUserMedia fails
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.capture = 'environment';
                        input.onchange = async (e: any) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            try {
                              // Compress image to less than 1 MB
                              const compressedImage = await compressImage(file);
                              setSiteObservationsCapturedImageData(compressedImage);
                              setShowSiteObservationsCameraPreview(true);
                            } catch (error) {
                              console.error('Error compressing captured image:', error);
                              // Fallback to original if compression fails
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                setSiteObservationsCapturedImageData(event.target?.result as string);
                                setShowSiteObservationsCameraPreview(true);
                              };
                              reader.readAsDataURL(file);
                            }
                          }
                        };
                        input.click();
                      }
                    }}
                    className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
                  >
                    Capture Photo
                  </button>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setSiteObservationsDialogData(prev => ({
                        ...prev,
                        uploadedPhotos: [...prev.uploadedPhotos, ...files]
                      }));
                    }}
                    className="hidden"
                    id="upload-photo-rtu"
                  />
                  <label
                    htmlFor="upload-photo-rtu"
                    className="px-3 py-1 bg-green-500 text-white rounded text-sm cursor-pointer"
                  >
                    Upload Photo
                  </label>
                </div>
              </div>
              
              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    // Restore previous value on Cancel
                    if (selectedSiteObservationRowKey && siteObservationsDialogData.previousValue !== undefined) {
                      // Restore to previous value (could be empty string or previous status)
                      if (siteObservationsDialogData.previousValue) {
                        setSiteObservations(prev => ({
                          ...prev,
                          [selectedSiteObservationRowKey]: siteObservationsDialogData.previousValue
                        }));
                        siteObservationsRef.current = {
                          ...siteObservationsRef.current,
                          [selectedSiteObservationRowKey]: siteObservationsDialogData.previousValue
                        };
                      } else {
                        // If previous value was empty, remove it
                        setSiteObservations(prev => {
                          const updated = { ...prev };
                          delete updated[selectedSiteObservationRowKey];
                          return updated;
                        });
                        delete siteObservationsRef.current[selectedSiteObservationRowKey];
                      }
                    }
                    setShowSiteObservationsDialog(false);
                    setSelectedSiteObservationRowKey('');
                    setSiteObservationsStatus('');
                    setSiteObservationsDialogData({
                      remarks: '',
                      typeOfIssue: '',
                      specifyOther: '',
                      typeOfSpare: [],
                      specifySpareOther: '',
                      dateOfInspection: '',
                      previousValue: '',
                      capturedPhotos: [],
                      uploadedPhotos: [],
                      uploadedDocuments: []
                    });
                  }}
                  className="px-4 py-2 bg-gray-300 rounded"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (siteObservationsStatus === 'pending' && !siteObservationsDialogData.typeOfIssue) {
                      alert('Please select Type of Issue');
                      return;
                    }
                    if (siteObservationsStatus === 'resolved' && !siteObservationsDialogData.remarks.trim()) {
                      alert('Please enter remarks');
                      return;
                    }
                    if (siteObservationsStatus === 'resolved' && !siteObservationsDialogData.dateOfInspection.trim()) {
                      alert('Please select Date of Inspection');
                      return;
                    }
                    
                    // Prepare photo data
                    let photoData: string[] = [];
                    if (siteObservationsDialogData.capturedPhotos.length > 0) {
                      photoData = siteObservationsDialogData.capturedPhotos.map(p => p.data);
                    }
                    if (siteObservationsDialogData.uploadedPhotos.length > 0) {
                      const uploadedBase64 = await Promise.all(
                        siteObservationsDialogData.uploadedPhotos.map(async (file) => {
                          try {
                            // Compress image to less than 1 MB
                            return await compressImage(file);
                          } catch (error) {
                            console.error('Error compressing uploaded image:', error);
                            // Fallback to original if compression fails
                            return new Promise<string>((resolve, reject) => {
                              const reader = new FileReader();
                              reader.onload = (e) => resolve(e.target?.result as string);
                              reader.onerror = reject;
                              reader.readAsDataURL(file);
                            });
                          }
                        })
                      );
                      photoData = [...photoData, ...uploadedBase64];
                    }
                    
                    // Update states
                    setTaskStatus(prev => ({
                      ...prev,
                      [selectedSiteObservationRowKey]: siteObservationsStatus === 'resolved' ? 'Resolved' : 'Pending'
                    }));
                    
                    let issueDisplay = siteObservationsDialogData.typeOfIssue;
                    if (issueDisplay === 'Others') {
                      issueDisplay = siteObservationsDialogData.specifyOther || 'Others';
                    }
                    setTypeOfIssue(prev => ({
                      ...prev,
                      [selectedSiteObservationRowKey]: issueDisplay
                    }));
                    
                    setViewPhotos(prev => ({
                      ...prev,
                      [selectedSiteObservationRowKey]: photoData
                    }));
                    
                    setRemarks(prev => ({
                      ...prev,
                      [selectedSiteObservationRowKey]: siteObservationsDialogData.remarks
                    }));
                    
                    if (siteObservationsStatus === 'resolved') {
                      setDateOfInspection(prev => ({
                        ...prev,
                        [selectedSiteObservationRowKey]: siteObservationsDialogData.dateOfInspection
                      }));
                    }
                    
                    setSiteObservations(prev => ({
                      ...prev,
                      [selectedSiteObservationRowKey]: siteObservationsStatus === 'resolved' ? 'Resolved' : 'Pending'
                    }));
                    
                    // Save to MongoDB immediately after state update
                    if (userRole === 'Equipment') {
                      // Find the row to save
                      const row = rows.find((r: any) => {
                        const key = generateRowKey(selectedFile, r, headers);
                        return key === selectedSiteObservationRowKey;
                      });
                      
                      if (row) {
                        const siteCodeHeader = headers.find((h: string) => {
                          const normalized = h.trim().toLowerCase().replace(/[_\s-]/g, '');
                          return normalized === 'sitecode' || normalized === 'site_code' || normalized === 'site code';
                        });
                        
                        const siteCode = siteCodeHeader ? String(row[siteCodeHeader] || '').trim().toUpperCase() : '';
                        
                        if (siteCode) {
                          const token = localStorage.getItem('token');
                          if (token) {
                            fetch(`${API_BASE}/api/rtu-tracker-sites`, {
                              method: 'POST',
                              headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json'
                              },
                              body: JSON.stringify({
                                fileId: selectedFile,
                                rowKey: selectedSiteObservationRowKey,
                                siteCode: siteCode,
                                originalRowData: row,
                                headers: headers,
                                siteObservations: siteObservationsStatus === 'resolved' ? 'Resolved' : 'Pending',
                                taskStatus: siteObservationsStatus === 'resolved' ? 'Resolved' : 'Pending',
                                typeOfIssue: issueDisplay,
                                viewPhotos: photoData,
                                photoMetadata: siteObservationsDialogData.capturedPhotos.map(p => ({
                                  latitude: p.latitude,
                                  longitude: p.longitude,
                                  timestamp: p.timestamp,
                                  location: p.location
                                })),
                                remarks: siteObservationsDialogData.remarks,
                                dateOfInspection: siteObservationsStatus === 'resolved' ? siteObservationsDialogData.dateOfInspection : '',
                                savedFrom: 'MY RTU TRACKER'
                              })
                            }).catch(error => {
                              console.error('Error saving to RTU Tracker Sites database:', error);
                            });
                          }
                        }
                      }
                    }
                    
                    alert(`Site observation marked as ${siteObservationsStatus === 'resolved' ? 'Resolved' : 'Pending'} successfully!`);
                    
                    setShowSiteObservationsDialog(false);
                    setSelectedSiteObservationRowKey('');
                    setSiteObservationsStatus('');
                    setSiteObservationsDialogData({
                      remarks: '',
                      typeOfIssue: '',
                      specifyOther: '',
                      typeOfSpare: [],
                      specifySpareOther: '',
                      dateOfInspection: '',
                      previousValue: '',
                      capturedPhotos: [],
                      uploadedPhotos: [],
                      uploadedDocuments: []
                    });
                  }}
                  className="px-4 py-2 bg-blue-500 text-white rounded"
                >
                  Submit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Photo Viewer Dialog */}
      {showPhotoViewer && selectedRowKeyForPhotos && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 z-[200] flex items-center justify-center"
          style={{ padding: '20px' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPhotoViewer(false);
              setSelectedRowKeyForPhotos('');
            }
          }}
        >
          <div 
            className="bg-white rounded-lg shadow-xl flex flex-col"
            style={{ 
              width: '90%',
              maxWidth: '800px',
              maxHeight: '90vh'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-3 flex justify-between items-center border-b">
              <h3 className="text-lg font-bold">View Photos</h3>
              <button
                type="button"
                onClick={() => {
                  setShowPhotoViewer(false);
                  setSelectedRowKeyForPhotos('');
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            
            <div className="px-5 py-4 overflow-y-auto flex-grow">
              {(() => {
                const photosToShow = viewPhotos[selectedRowKeyForPhotos] || [];
                return photosToShow.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {photosToShow.map((photo, idx) => (
                      <div key={idx} className="relative bg-gray-100 rounded-lg overflow-hidden p-2">
                        <img
                          src={photo}
                          alt={`Photo ${idx + 1}`}
                          className="w-full h-auto object-contain"
                          style={{ maxHeight: '400px' }}
                        />
                        <div className="mt-2 flex gap-2 justify-center">
                          <button
                            onClick={() => {
                              const newWindow = window.open('', '_blank');
                              if (newWindow) {
                                newWindow.document.write(`
                                  <html>
                                    <head><title>Photo ${idx + 1}</title></head>
                                    <body style="margin:0;padding:20px;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#000">
                                      <img src="${photo}" alt="Photo ${idx + 1}" style="max-width:100%;max-height:100vh" />
                                    </body>
                                  </html>
                                `);
                                newWindow.document.close();
                              }
                            }}
                            className="px-3 py-1 bg-blue-500 text-white rounded text-xs"
                          >
                            View Photo
                          </button>
                          <button
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = photo;
                              link.download = `photo_${selectedRowKeyForPhotos}_${idx + 1}.jpg`;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }}
                            className="px-3 py-1 bg-green-500 text-white rounded text-xs"
                          >
                            Download
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">No photos available</div>
                );
              })()}
            </div>
            
            <div className="px-5 py-3 border-t flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowPhotoViewer(false);
                  setSelectedRowKeyForPhotos('');
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Site Observations Camera Preview Dialog */}
      {showSiteObservationsCameraPreview && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 z-[200] flex items-center justify-center"
          style={{ padding: '20px' }}
        >
          <div 
            className="bg-white rounded-lg shadow-xl"
            style={{ 
              width: '90%',
              maxWidth: '600px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Camera Preview */}
            <div className="p-4 flex-1 flex items-center justify-center" style={{ minHeight: '400px', backgroundColor: '#000' }}>
              {siteObservationsCapturedImageData ? (
                <img
                  src={siteObservationsCapturedImageData}
                  alt="Captured"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '400px',
                    objectFit: 'contain'
                  }}
                />
              ) : siteObservationsCameraStream ? (
                <video
                  id="site-observations-camera-preview-video-rtu"
                  autoPlay
                  playsInline
                  muted
                  style={{
                    maxWidth: '100%',
                    maxHeight: '400px',
                    objectFit: 'contain'
                  }}
                />
              ) : null}
            </div>

            {/* Action Buttons */}
            <div className="p-4 border-t border-gray-200 flex gap-3 justify-center">
              {siteObservationsCapturedImageData ? (
                <>
                  <button
                    type="button"
                    onClick={async () => {
                      // Get geolocation before saving (if not already captured)
                      let latitude: number | undefined = capturedPhotoMetadata?.latitude;
                      let longitude: number | undefined = capturedPhotoMetadata?.longitude;
                      let locationName: string | undefined = capturedPhotoMetadata?.location;
                      const timestamp = capturedPhotoMetadata?.timestamp || new Date().toISOString();
                      
                      // If metadata not available, get it now
                      if (!latitude || !longitude) {
                        try {
                          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                            navigator.geolocation.getCurrentPosition(resolve, reject, {
                              enableHighAccuracy: true,
                              timeout: 10000,
                              maximumAge: 0
                            });
                          });
                          
                          latitude = position.coords.latitude;
                          longitude = position.coords.longitude;
                          
                          // Try to get location name using reverse geocoding
                          if (!locationName) {
                            try {
                              const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`);
                              const data = await response.json();
                              if (data.display_name) {
                                locationName = data.display_name;
                              }
                            } catch (geoError) {
                              console.log('Could not get location name:', geoError);
                            }
                          }
                        } catch (geoError: any) {
                          console.log('Could not get geolocation:', geoError);
                          // Continue without location if permission denied
                        }
                      }
                      
                      // Save photo with metadata
                      setSiteObservationsDialogData(prev => ({
                        ...prev,
                        capturedPhotos: [...prev.capturedPhotos, {
                          data: siteObservationsCapturedImageData!,
                          latitude,
                          longitude,
                          timestamp,
                          location: locationName
                        }]
                      }));
                      setShowSiteObservationsCameraPreview(false);
                      setSiteObservationsCapturedImageData(null);
                      setCapturedPhotoMetadata(null);
                      // Stop camera stream when closing
                      if (siteObservationsCameraStreamRef.current) {
                        siteObservationsCameraStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
                        siteObservationsCameraStreamRef.current = null;
                        setSiteObservationsCameraStream(null);
                      }
                    }}
                    style={{
                      backgroundColor: '#10b981',
                      color: '#ffffff',
                      padding: '10px 24px',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      minWidth: '120px'
                    }}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSiteObservationsCameraPreview(false);
                      setSiteObservationsCapturedImageData(null);
                      setCapturedPhotoMetadata(null);
                      if (siteObservationsCameraStreamRef.current) {
                        siteObservationsCameraStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
                        siteObservationsCameraStreamRef.current = null;
                        setSiteObservationsCameraStream(null);
                      }
                    }}
                    style={{
                      backgroundColor: '#ef4444',
                      color: '#ffffff',
                      padding: '10px 24px',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      minWidth: '120px'
                    }}
                  >
                    Cancel
                  </button>
                </>
              ) : siteObservationsCameraStream ? (
                <>
                  <button
                    type="button"
                    onClick={async () => {
                      const video = document.getElementById('site-observations-camera-preview-video-rtu') as HTMLVideoElement;
                      if (video && video.videoWidth > 0 && video.videoHeight > 0) {
                        const canvas = document.createElement('canvas');
                        canvas.width = video.videoWidth;
                        canvas.height = video.videoHeight;
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                          // Draw video frame to canvas
                          ctx.drawImage(video, 0, 0);
                          
                          // Get geolocation when capturing
                          let latitude: number | undefined;
                          let longitude: number | undefined;
                          let locationName: string | undefined;
                          const timestamp = new Date().toISOString();
                          
                          try {
                            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                              navigator.geolocation.getCurrentPosition(resolve, reject, {
                                enableHighAccuracy: true,
                                timeout: 10000,
                                maximumAge: 0
                              });
                            });
                            
                            latitude = position.coords.latitude;
                            longitude = position.coords.longitude;
                            
                            // Try to get location name using reverse geocoding
                            try {
                              const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`);
                              const data = await response.json();
                              if (data.display_name) {
                                locationName = data.display_name;
                              }
                            } catch (geoError) {
                              console.log('Could not get location name:', geoError);
                            }
                          } catch (geoError: any) {
                            console.log('Could not get geolocation:', geoError);
                            // Continue without location if permission denied
                          }
                          
                          // Get the image data
                          const imageData = canvas.toDataURL('image/jpeg', 0.9);
                          
                          // Compress image to less than 1 MB
                          let compressedImageData = imageData;
                          try {
                            compressedImageData = await compressImage(imageData);
                          } catch (error) {
                            console.error('Error compressing captured image:', error);
                            // Fallback to original if compression fails
                          }
                          
                          setSiteObservationsCapturedImageData(compressedImageData);
                          setCapturedPhotoMetadata({
                            latitude,
                            longitude,
                            timestamp,
                            location: locationName
                          });
                          // Keep camera running for multiple captures
                        }
                      }
                    }}
                    style={{
                      backgroundColor: '#10b981',
                      color: '#ffffff',
                      padding: '10px 24px',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      minWidth: '120px'
                    }}
                  >
                    Capture
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      // Stop camera stream
                      if (siteObservationsCameraStreamRef.current) {
                        siteObservationsCameraStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
                        siteObservationsCameraStreamRef.current = null;
                        setSiteObservationsCameraStream(null);
                      }
                      setShowSiteObservationsCameraPreview(false);
                      setSiteObservationsCapturedImageData(null);
                      setCapturedPhotoMetadata(null);
                    }}
                    style={{
                      backgroundColor: '#ef4444',
                      color: '#ffffff',
                      padding: '10px 24px',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      minWidth: '120px'
                    }}
                  >
                    Cancel
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

