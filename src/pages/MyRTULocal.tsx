import { useEffect, useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';

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


// Generate a stable row key based on headers and row data
function generateRowKey(fileId: string, row: any, headers: string[]): string {
  // For action rows, use sourceFileId if available
  const actualFileId = row._sourceFileId || fileId;
  
  // First try to use row.id if available
  if (row.id) {
    return `${actualFileId}-${row.id}`;
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
      return `${actualFileId}-${keyParts.join('|')}`;
    }
  }
  
  // Fallback: use all header values
  const keyParts: string[] = [];
  headers.forEach(header => {
    const value = row[header] ?? '';
    keyParts.push(String(value));
  });
  return `${actualFileId}-${keyParts.join('|')}`;
}

type FilterDef = { label: string; keys: string[] };
const FILTER_DEFS: FilterDef[] = [];

export default function MyRTULocal() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(PAGE_SIZE_OPTIONS[0]);
  const [user, setUser] = useState<any>(getCurrentUser());
  const userRole = user?.role || '';
  const userDivisions = user?.division || []; // Array of user's assigned divisions
  const [filters, setFilters] = useState<Record<string, string>>({});
  
  // State for the five columns from MY OFFLINE SITES
  const [siteObservations, setSiteObservations] = useState<Record<string, string>>({}); // Store site observations by row key
  const [taskStatus, setTaskStatus] = useState<Record<string, string>>({}); // Store task status by row key
  const [typeOfIssue, setTypeOfIssue] = useState<Record<string, string>>({}); // Store type of issue by row key
  const [viewPhotos, setViewPhotos] = useState<Record<string, string[]>>({}); // Store photos by row key
  const [photoMetadata, setPhotoMetadata] = useState<Record<string, Array<{ latitude?: number; longitude?: number; timestamp?: string; location?: string }>>>({}); // Store photo metadata by row key
  const [remarks, setRemarks] = useState<Record<string, string>>({}); // Store remarks by row key
  
  // Refs to track latest state values for reliable saving
  const siteObservationsRef = useRef<Record<string, string>>({});
  const taskStatusRef = useRef<Record<string, string>>({});
  const typeOfIssueRef = useRef<Record<string, string>>({});
  const viewPhotosRef = useRef<Record<string, string[]>>({});
  const remarksRef = useRef<Record<string, string>>({});
  const photoMetadataRef = useRef<Record<string, Array<{ latitude?: number; longitude?: number; timestamp?: string; location?: string }>>>({});
  
  // Sync refs with state
  useEffect(() => {
    siteObservationsRef.current = siteObservations;
  }, [siteObservations]);
  
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
  
  // Dialog state
  const [showPhotoViewer, setShowPhotoViewer] = useState(false); // Control photo viewer dialog visibility
  const [selectedRowKeyForPhotos, setSelectedRowKeyForPhotos] = useState<string>(''); // Track which row's photos to view
  const [showSiteObservationsDialog, setShowSiteObservationsDialog] = useState(false); // Control Site Observations dialog visibility
  const [selectedSiteObservationRowKey, setSelectedSiteObservationRowKey] = useState<string>(''); // Track which row's site observation was selected
  const [siteObservationsDialogData, setSiteObservationsDialogData] = useState({
    remarks: '',
    typeOfIssue: '',
    specifyOther: '',
    typeOfSpare: [] as string[],
    specifySpareOther: '',
    capturedPhotos: [] as Array<{ data: string; latitude?: number; longitude?: number; timestamp?: string; location?: string }>,
    uploadedPhotos: [] as File[],
    uploadedDocuments: [] as File[]
  }); // Store Site Observations dialog form data
  const [siteObservationsStatus, setSiteObservationsStatus] = useState<string>(''); // Track if dialog is for Resolved or Pending
  const [isTypeOfSpareDropdownOpen, setIsTypeOfSpareDropdownOpen] = useState(false); // Control Type of Spare dropdown visibility
  const [showSiteObservationsCameraPreview, setShowSiteObservationsCameraPreview] = useState(false); // Show camera preview for Site Observations dialog
  const [siteObservationsCameraStream, setSiteObservationsCameraStream] = useState<MediaStream | null>(null); // Camera stream for Site Observations
  const [siteObservationsCapturedImageData, setSiteObservationsCapturedImageData] = useState<string | null>(null); // Captured image data URL for Site Observations
  const [capturedPhotoMetadata, setCapturedPhotoMetadata] = useState<{ latitude?: number; longitude?: number; timestamp?: string; location?: string } | null>(null); // Metadata for captured photo
  const siteObservationsCameraStreamRef = useRef<MediaStream | null>(null); // Ref to track camera stream for Site Observations cleanup
  const [isSubmittingSiteObservations, setIsSubmittingSiteObservations] = useState(false); // Track Site Observations submission state

  // Function to save data to localStorage
  const saveToLocalStorage = useCallback(() => {
    if (!selectedFile) {
      return;
    }
    
    const storageKey = `myRTULocal_${selectedFile}`;
    try {
      const dataToSave = {
        siteObservations: siteObservationsRef.current,
        taskStatus: taskStatusRef.current,
        typeOfIssue: typeOfIssueRef.current,
        viewPhotos: viewPhotosRef.current,
        remarks: remarksRef.current,
        photoMetadata: photoMetadataRef.current
      };
      
      const hasData = Object.keys(dataToSave.siteObservations).length > 0 || 
                      Object.keys(dataToSave.taskStatus).length > 0 || 
                      Object.keys(dataToSave.typeOfIssue).length > 0 || 
                      Object.keys(dataToSave.viewPhotos).length > 0 || 
                      Object.keys(dataToSave.remarks).length > 0 || 
                      Object.keys(dataToSave.photoMetadata).length > 0;
      
      if (hasData) {
        localStorage.setItem(storageKey, JSON.stringify(dataToSave));
      }
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }, [selectedFile]);
  
  // Save data to localStorage whenever it changes - using debounced save
  useEffect(() => {
    if (!selectedFile) {
      return;
    }
    
    // Debounce save to avoid too frequent writes
    const timeoutId = setTimeout(() => {
      saveToLocalStorage();
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, [selectedFile, siteObservations, taskStatus, typeOfIssue, viewPhotos, remarks, photoMetadata, saveToLocalStorage]);
  
  // Refresh user data if divisions are missing
  useEffect(() => {
    const currentDivisions = user?.division || [];
    if (userRole === 'RTU/Communication' && (!currentDivisions || currentDivisions.length === 0)) {
      const token = localStorage.getItem('token');
      if (token) {
        console.log('MY RTU LOCAL - Divisions missing, fetching fresh user profile...');
        fetch('http://localhost:5000/api/auth/profile', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data) {
            const freshUser = {
              ...data.data,
              id: data.data._id || data.data.id,
              division: data.data.division || []
            };
            localStorage.setItem('user', JSON.stringify(freshUser));
            setUser(freshUser);
            console.log('MY RTU LOCAL - Refreshed user data with divisions:', freshUser.division);
          }
        })
        .catch(err => console.error('MY RTU LOCAL - Failed to fetch user profile:', err));
      }
    }
    
    console.log('MY RTU LOCAL - Current user data:', {
      role: userRole,
      divisions: currentDivisions,
      hasDivisions: currentDivisions && currentDivisions.length > 0,
      userId: user?.userId
    });
  }, [user, userRole]);

  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('http://localhost:5000/api/uploads', {
          headers: {
            'Authorization': token ? `Bearer ${token}` : ''
          }
        });
        const json = await res.json();
        if (json?.success) {
          // Debug: log all files received
          const currentRole = getCurrentUserRole();
          console.log('=== VIEW DATA FILE FILTERING ===');
          console.log('Current user role:', currentRole);
          console.log('Is Equipment role?', currentRole && currentRole.toLowerCase() === 'equipment');
          console.log('All files received:', json.files?.map((f: any) => ({ name: f.name, uploadType: f.uploadType })));
          
          const files = (json.files || [])
            .filter((f: any) => {
              const uploadTypeValue = f.uploadType;
              const fileName = String(f.name || '').toLowerCase();
              
              // For Equipment role: Only show Device Status Upload files
              // STRICT: Only show files with uploadType === 'device-status-upload' (explicitly set)
              const currentRole = getCurrentUserRole(); // Get fresh role check
              const isEquipmentRole = currentRole && currentRole.toLowerCase() === 'equipment';
              if (isEquipmentRole) {
                // Check uploadType - must be exactly 'device-status-upload'
                const uploadType = uploadTypeValue ? String(uploadTypeValue).toLowerCase().trim() : '';
                const isDeviceStatusUpload = uploadType === 'device-status-upload';
                
                // Check if filename suggests it's an ONLINE-OFFLINE DATA file
                const isOnlineOfflineFileName = fileName.includes('online-offline') || 
                                               fileName.includes('online_offline') ||
                                               fileName.includes('onlineoffline');
                
                // Check if filename suggests it's an RTU TRACKER file
                const normalizedFileName = fileName.replace(/[-_\s]/g, '');
                const isRtuTrackerFileName = 
                  fileName.includes('rtu-tracker') || 
                  fileName.includes('rtu_tracker') ||
                  fileName.includes('rtu tracker') ||
                  fileName.includes('rtutracker') ||
                  normalizedFileName.includes('rtutracker') ||
                  /rtu.*tracker/i.test(f.name || '');
                
                // Equipment role: STRICT - Only show files with uploadType === 'device-status-upload'
                // AND exclude ONLINE-OFFLINE and RTU-TRACKER files by filename
                const shouldShow = isDeviceStatusUpload && !isOnlineOfflineFileName && !isRtuTrackerFileName;
                
                if (!shouldShow) {
                  if (isRtuTrackerFileName) {
                    console.log(`  -> FILTERING OUT (Equipment role): ${f.name} (uploadType: "${uploadTypeValue}", RTU TRACKER file)`);
                  } else if (isOnlineOfflineFileName) {
                    console.log(`  -> FILTERING OUT (Equipment role): ${f.name} (uploadType: "${uploadTypeValue}", ONLINE-OFFLINE file)`);
                  } else if (!isDeviceStatusUpload) {
                    console.log(`  -> FILTERING OUT (Equipment role): ${f.name} (uploadType: "${uploadTypeValue}", not Device Status Upload - expected: "device-status-upload")`);
                  }
                } else {
                  console.log(`  -> Showing (Equipment role): ${f.name} (uploadType: "${uploadTypeValue}", Device Status Upload)`);
                }
                
                return shouldShow;
              }
              
              // For other roles: Filter out files with uploadType === 'online-offline-data' or 'rtu-tracker'
              // Also filter out files that appear to be ONLINE-OFFLINE DATA or RTU TRACKER based on filename
              let shouldHideByType = false;
              if (uploadTypeValue) {
                const uploadType = String(uploadTypeValue).toLowerCase().trim();
                shouldHideByType = uploadType === 'online-offline-data' || uploadType === 'rtu-tracker';
              }
              
              // Check if filename suggests it's an ONLINE-OFFLINE DATA file
              // This handles files uploaded before uploadType was added
              const isOnlineOfflineFileName = fileName.includes('online-offline') || 
                                             fileName.includes('online_offline') ||
                                             fileName.includes('onlineoffline');
              
              
              // Check if filename suggests it's an RTU TRACKER file
              // RTU TRACKER files should also be hidden from the file list (they're used for data extraction)
              // Improved matching to handle variations: RTU-TRACKER, RTU_TRACKER, RTU TRACKER, RTUTRACKER, etc.
              const normalizedFileName = fileName.replace(/[-_\s]/g, '');
              const isRtuTrackerFileName = 
                fileName.includes('rtu-tracker') || 
                fileName.includes('rtu_tracker') ||
                fileName.includes('rtu tracker') ||
                fileName.includes('rtutracker') ||
                normalizedFileName.includes('rtutracker') ||
                /rtu.*tracker/i.test(f.name || '');
              
              // Hide files with uploadType === 'online-offline-data' or 'rtu-tracker' OR matching filename patterns
              const shouldHide = shouldHideByType || isOnlineOfflineFileName || isRtuTrackerFileName;
              
              if (shouldHide) {
                if (isRtuTrackerFileName) {
                  console.log(`  -> FILTERING OUT: ${f.name} (uploadType: "${uploadTypeValue}", RTU TRACKER file - used for data extraction)`);
                } else {
                  console.log(`  -> FILTERING OUT: ${f.name} (uploadType: "${uploadTypeValue}", filename match: ${isOnlineOfflineFileName})`);
                }
              } else {
                console.log(`  -> Showing: ${f.name} (uploadType: "${uploadTypeValue}")`);
              }
              
              // Hide files with uploadType === 'online-offline-data' or 'rtu-tracker' or matching filename patterns
              return !shouldHide;
            })
            .map((f: any) => ({
            id: f.fileId,
            name: f.name,
            size: f.size || 0,
            type: f.type || '',
            uploadedAt: f.uploadedAt || f.createdAt,
          }));
          setUploadedFiles(files);
          
          // Auto-select first file if available
          if (files.length > 0 && !selectedFile) {
            setSelectedFile(files[0].id);
          } else if (selectedFile && !files.find((f: any) => f.id === selectedFile)) {
            // If current selected file was deleted, select first available
            if (files.length > 0) {
              setSelectedFile(files[0].id);
            } else {
              setSelectedFile('');
              setRows([]);
              setHeaders([]);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching uploaded files:', error);
      }
    })();
  }, []);

  // Refresh file list periodically and on window focus to detect deletions
  useEffect(() => {
    const refreshFiles = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('http://localhost:5000/api/uploads', {
          headers: {
            'Authorization': token ? `Bearer ${token}` : ''
          }
        });
        const json = await res.json();
        if (json?.success) {
          // Debug: log all files received
          const currentRole = getCurrentUserRole();
          console.log('=== VIEW DATA FILE FILTERING ===');
          console.log('Current user role:', currentRole);
          console.log('Is Equipment role?', currentRole && currentRole.toLowerCase() === 'equipment');
          console.log('All files received:', json.files?.map((f: any) => ({ name: f.name, uploadType: f.uploadType })));
          
          const files = (json.files || [])
            .filter((f: any) => {
              const uploadTypeValue = f.uploadType;
              const fileName = String(f.name || '').toLowerCase();
              
              // For Equipment role: Only show Device Status Upload files
              // STRICT: Only show files with uploadType === 'device-status-upload' (explicitly set)
              const currentRole = getCurrentUserRole(); // Get fresh role check
              const isEquipmentRole = currentRole && currentRole.toLowerCase() === 'equipment';
              if (isEquipmentRole) {
                // Check uploadType - must be exactly 'device-status-upload'
                const uploadType = uploadTypeValue ? String(uploadTypeValue).toLowerCase().trim() : '';
                const isDeviceStatusUpload = uploadType === 'device-status-upload';
                
                // Check if filename suggests it's an ONLINE-OFFLINE DATA file
                const isOnlineOfflineFileName = fileName.includes('online-offline') || 
                                               fileName.includes('online_offline') ||
                                               fileName.includes('onlineoffline');
                
                // Check if filename suggests it's an RTU TRACKER file
                const normalizedFileName = fileName.replace(/[-_\s]/g, '');
                const isRtuTrackerFileName = 
                  fileName.includes('rtu-tracker') || 
                  fileName.includes('rtu_tracker') ||
                  fileName.includes('rtu tracker') ||
                  fileName.includes('rtutracker') ||
                  normalizedFileName.includes('rtutracker') ||
                  /rtu.*tracker/i.test(f.name || '');
                
                // Equipment role: STRICT - Only show files with uploadType === 'device-status-upload'
                // AND exclude ONLINE-OFFLINE and RTU-TRACKER files by filename
                const shouldShow = isDeviceStatusUpload && !isOnlineOfflineFileName && !isRtuTrackerFileName;
                
                if (!shouldShow) {
                  if (isRtuTrackerFileName) {
                    console.log(`  -> FILTERING OUT (Equipment role): ${f.name} (uploadType: "${uploadTypeValue}", RTU TRACKER file)`);
                  } else if (isOnlineOfflineFileName) {
                    console.log(`  -> FILTERING OUT (Equipment role): ${f.name} (uploadType: "${uploadTypeValue}", ONLINE-OFFLINE file)`);
                  } else if (!isDeviceStatusUpload) {
                    console.log(`  -> FILTERING OUT (Equipment role): ${f.name} (uploadType: "${uploadTypeValue}", not Device Status Upload - expected: "device-status-upload")`);
                  }
                } else {
                  console.log(`  -> Showing (Equipment role): ${f.name} (uploadType: "${uploadTypeValue}", Device Status Upload)`);
                }
                
                return shouldShow;
              }
              
              // For other roles: Filter out files with uploadType === 'online-offline-data' or 'rtu-tracker'
              // Also filter out files that appear to be ONLINE-OFFLINE DATA or RTU TRACKER based on filename
              let shouldHideByType = false;
              if (uploadTypeValue) {
                const uploadType = String(uploadTypeValue).toLowerCase().trim();
                shouldHideByType = uploadType === 'online-offline-data' || uploadType === 'rtu-tracker';
              }
              
              // Check if filename suggests it's an ONLINE-OFFLINE DATA file
              // This handles files uploaded before uploadType was added
              const isOnlineOfflineFileName = fileName.includes('online-offline') || 
                                             fileName.includes('online_offline') ||
                                             fileName.includes('onlineoffline');
              
              
              // Check if filename suggests it's an RTU TRACKER file
              // RTU TRACKER files should also be hidden from the file list (they're used for data extraction)
              // Improved matching to handle variations: RTU-TRACKER, RTU_TRACKER, RTU TRACKER, RTUTRACKER, etc.
              const normalizedFileName = fileName.replace(/[-_\s]/g, '');
              const isRtuTrackerFileName = 
                fileName.includes('rtu-tracker') || 
                fileName.includes('rtu_tracker') ||
                fileName.includes('rtu tracker') ||
                fileName.includes('rtutracker') ||
                normalizedFileName.includes('rtutracker') ||
                /rtu.*tracker/i.test(f.name || '');
              
              // Hide files with uploadType === 'online-offline-data' or 'rtu-tracker' OR matching filename patterns
              const shouldHide = shouldHideByType || isOnlineOfflineFileName || isRtuTrackerFileName;
              
              if (shouldHide) {
                if (isRtuTrackerFileName) {
                  console.log(`  -> FILTERING OUT: ${f.name} (uploadType: "${uploadTypeValue}", RTU TRACKER file - used for data extraction)`);
                } else {
                  console.log(`  -> FILTERING OUT: ${f.name} (uploadType: "${uploadTypeValue}", filename match: ${isOnlineOfflineFileName})`);
                }
              } else {
                console.log(`  -> Showing: ${f.name} (uploadType: "${uploadTypeValue}")`);
              }
              
              // Hide files with uploadType === 'online-offline-data' or 'rtu-tracker' or matching filename patterns
              return !shouldHide;
            })
            .map((f: any) => ({
            id: f.fileId,
            name: f.name,
            size: f.size || 0,
            type: f.type || '',
            uploadedAt: f.uploadedAt || f.createdAt,
          }));
          setUploadedFiles(files);
          
          // Auto-select first file if available
          if (files.length > 0 && !selectedFile) {
            setSelectedFile(files[0].id);
          } else if (selectedFile && !files.find((f: any) => f.id === selectedFile)) {
            // If current selected file was deleted, select first available
            if (files.length > 0) {
              setSelectedFile(files[0].id);
            } else {
              setSelectedFile('');
              setRows([]);
              setHeaders([]);
            }
          }
        }
      } catch (error) {
        console.error('Error refreshing uploaded files:', error);
      }
    };

    // Refresh on window focus
    window.addEventListener('focus', refreshFiles);
    
    // Refresh every 5 seconds to detect deletions
    const interval = setInterval(refreshFiles, 5000);

    return () => {
      window.removeEventListener('focus', refreshFiles);
      clearInterval(interval);
    };
  }, [selectedFile]);

  useEffect(() => {
    if (!selectedFile) {
      setRows([]);
      setHeaders([]);
      return;
    }
    (async () => {
      try {
        const token = localStorage.getItem('token');
        
        // Fetch the main file data
        const res = await fetch(`http://localhost:5000/api/uploads/${selectedFile}`, {
          headers: {
            'Authorization': token ? `Bearer ${token}` : ''
          }
        });
        const json = await res.json();
        if (json?.success && json.file) {
          const file = json.file;
          let fileRows = Array.isArray(file.rows) ? file.rows : [];
          let hdrs = file.headers && file.headers.length ? file.headers : (fileRows[0] ? Object.keys(fileRows[0]) : []);
          
          // Track ONLINE-OFFLINE columns that we insert
          let onlineOfflineColumnsToPreserve: string[] = [];
          let columnsToInsert: string[] = []; // Columns to insert from ONLINE-OFFLINE and RTU-TRACKER files
          let onlineOfflineColumnsList: string[] = []; // Track ONLINE-OFFLINE columns separately for verification
          let rtuTrackerColumnsList: string[] = []; // Track RTU-TRACKER columns separately for verification (declared at higher scope)
          
          // Find SITE CODE column in main file (used by ONLINE-OFFLINE and RTU-TRACKER)
          const normalizeHeader = (h: string) => h.trim().toLowerCase();
          const mainSiteCodeHeader = hdrs.find((h: string) => {
            const normalized = normalizeHeader(h);
            return normalized === 'site code' || normalized === 'sitecode' || normalized === 'site_code';
          });
          
          console.log('Main SITE CODE header:', mainSiteCodeHeader);
          
          // Fetch ONLINE-OFFLINE DATA files
          try {
            const onlineOfflineRes = await fetch('http://localhost:5000/api/uploads', {
              headers: {
                'Authorization': token ? `Bearer ${token}` : ''
              }
            });
            const onlineOfflineJson = await onlineOfflineRes.json();
            
            if (onlineOfflineJson?.success) {
              // Find ONLINE-OFFLINE files (must have "online-offline" in filename, prefer ONLINE-OFFLINE DATA type)
              const onlineOfflineFiles = (onlineOfflineJson.files || []).filter((f: any) => {
                const uploadTypeValue = f.uploadType;
                const fileName = String(f.name || '').toLowerCase();
                const isOnlineOfflineType = uploadTypeValue && String(uploadTypeValue).toLowerCase().trim() === 'online-offline-data';
                const isOnlineOfflineFileName = fileName.includes('online-offline') || 
                                               fileName.includes('online_offline') ||
                                               fileName.includes('onlineoffline');
                
                // Must have "online-offline" in filename
                // Prefer ONLINE-OFFLINE DATA type, but include by filename if type is wrong
                if (isOnlineOfflineFileName) {
                  console.log(`ONLINE-OFFLINE file found by filename: ${f.name} (uploadType: ${uploadTypeValue})`);
                  return true; // Include if filename matches, regardless of uploadType
                }
                
                // Also include if it's ONLINE-OFFLINE DATA type AND has "online-offline" in filename
                return isOnlineOfflineType && isOnlineOfflineFileName;
              });
              
              console.log('ONLINE-OFFLINE files found:', onlineOfflineFiles.map((f: any) => ({ name: f.name, uploadType: f.uploadType, fileId: f.fileId })));
              
              // Sort by upload date (latest first) and get the most recent ONLINE-OFFLINE file
              const latestOnlineOfflineFile = onlineOfflineFiles.sort((a: any, b: any) => {
                const dateA = a.uploadedAt ? new Date(a.uploadedAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
                const dateB = b.uploadedAt ? new Date(b.uploadedAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
                return dateB - dateA; // Latest first
              })[0];
              
              if (latestOnlineOfflineFile) {
                console.log('Found ONLINE-OFFLINE DATA file:', latestOnlineOfflineFile.name);
                
                // Fetch the ONLINE-OFFLINE file data
                const onlineOfflineDataRes = await fetch(`http://localhost:5000/api/uploads/${latestOnlineOfflineFile.fileId}`, {
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
                  
                  console.log('ONLINE-OFFLINE headers:', onlineOfflineHeaders);
                  console.log('ONLINE-OFFLINE rows count:', onlineOfflineRows.length);
                  
                  // Find SITE CODE column in ONLINE-OFFLINE file
                  const onlineOfflineSiteCodeHeader = onlineOfflineHeaders.find((h: string) => {
                    const normalized = normalizeHeader(h);
                    return normalized === 'site code' || normalized === 'sitecode' || normalized === 'site_code';
                  });
                  
                  console.log('ONLINE-OFFLINE SITE CODE header:', onlineOfflineSiteCodeHeader);
                  
                  // Find all date columns in ONLINE-OFFLINE file (columns with dates in their names like "DATE 15-11-2025", "DATE 16-11-2025")
                  const parseDateFromColumnName = (columnName: string): Date | null => {
                    // Try to extract date from column name
                    // Patterns: "DATE 15-11-2025", "Date 16-11-2025", "15-11-2025", "16-11-2025", etc.
                    // Support multiple separators: -, /, and .
                    // Primary format: DD-MM-YYYY (e.g., 16-11-2025)
                    const datePatterns = [
                      /(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{4})/, // DD-MM-YYYY, DD/MM/YYYY, or DD.MM.YYYY (e.g., 16-11-2025)
                      /(\d{4})[-\/\.](\d{1,2})[-\/\.](\d{1,2})/, // YYYY-MM-DD, YYYY/MM/DD, or YYYY.MM.DD
                    ];
                    
                    for (const pattern of datePatterns) {
                      const match = columnName.match(pattern);
                      if (match) {
                        if (pattern.source.includes('\\d{4}') && pattern.source.startsWith('(\\d{4})')) {
                          // YYYY-MM-DD format (or YYYY/MM/DD or YYYY.MM.DD)
                          const year = parseInt(match[1]);
                          const month = parseInt(match[2]) - 1;
                          const day = parseInt(match[3]);
                          const parsedDate = new Date(year, month, day);
                          if (!isNaN(parsedDate.getTime())) {
                            return parsedDate;
                          }
                        } else {
                          // DD-MM-YYYY format (or DD/MM/YYYY or DD.MM.YYYY) - e.g., 16-11-2025
                          const day = parseInt(match[1]);
                          const month = parseInt(match[2]) - 1;
                          const year = parseInt(match[3]);
                          const parsedDate = new Date(year, month, day);
                          if (!isNaN(parsedDate.getTime())) {
                            return parsedDate;
                          }
                        }
                      }
                    }
                    return null;
                  };
                  
                  // Find all date columns - check ALL headers, not just those with "date" or "time" in name
                  // This ensures we catch date columns even if they're named differently
                  const dateColumns: Array<{ name: string; date: Date }> = [];
                  console.log('=== SCANNING ALL HEADERS FOR DATE COLUMNS ===');
                  console.log('Total headers to scan:', onlineOfflineHeaders.length);
                  
                  onlineOfflineHeaders.forEach((h: string) => {
                    const normalized = normalizeHeader(h);
                    // Try to parse date from any column name (not just those with "date" or "time" keyword)
                    const date = parseDateFromColumnName(h);
                    if (date && !isNaN(date.getTime())) {
                      dateColumns.push({ name: h, date });
                      console.log(`  ✓ Found date column: "${h}" -> Date: ${date.toLocaleDateString()}`);
                    } else {
                      // Also check if it has "date" or "time" keyword and try parsing again
                      if (normalized.includes('date') || normalized.includes('time')) {
                        console.log(`  ⚠ Column "${h}" has date/time keyword but couldn't parse date`);
                      }
                    }
                  });
                  
                  console.log(`Total date columns found: ${dateColumns.length}`);
                  
                  // Find the latest date column
                  let latestDateColumn: string | null = null;
                  if (dateColumns.length > 0) {
                    dateColumns.sort((a, b) => b.date.getTime() - a.date.getTime()); // Latest first
                    latestDateColumn = dateColumns[0].name;
                    console.log('=== DATE COLUMN ANALYSIS ===');
                    console.log('All date columns found:', dateColumns.map(d => ({ 
                      name: d.name, 
                      date: d.date.toLocaleDateString(),
                      timestamp: d.date.getTime()
                    })));
                    console.log('Latest date column:', latestDateColumn);
                    console.log('Latest date:', dateColumns[0].date.toLocaleDateString());
                    console.log('Latest date timestamp:', dateColumns[0].date.getTime());
                    
                    // Verify we're using the correct latest date
                    if (dateColumns.length > 1) {
                      const secondLatest = dateColumns[1];
                      console.log('Second latest date column:', secondLatest.name, 'Date:', secondLatest.date.toLocaleDateString());
                      if (dateColumns[0].date.getTime() <= secondLatest.date.getTime()) {
                        console.error('ERROR: Latest date is not actually the latest!');
                      }
                    }
                  } else {
                    console.warn('⚠ No date columns found in ONLINE-OFFLINE headers!');
                    console.warn('All headers:', onlineOfflineHeaders);
                    // Fallback: try to find any date column
                    const fallbackDateHeader = onlineOfflineHeaders.find((h: string) => {
                      const normalized = normalizeHeader(h);
                      return normalized.includes('date') || 
                             normalized.includes('time') || 
                             normalized === 'uploadedat' || 
                             normalized === 'createdat' ||
                             normalized === 'timestamp';
                    });
                    if (fallbackDateHeader) {
                      latestDateColumn = fallbackDateHeader;
                      console.log('Using fallback date column:', latestDateColumn);
                    } else {
                      console.error('ERROR: No date column found even with fallback!');
                    }
                  }
                  
                  // Find specific columns to fetch: DEVICE STATUS, EQUIPMENT L/R SWITCH STATUS, NO OF DAYS OFFLINE
                  const deviceStatusHeader = onlineOfflineHeaders.find((h: string) => {
                    const normalized = normalizeHeader(h);
                    return normalized === 'device status' ||
                           normalized === 'device_status' ||
                           normalized === 'devicestatus' ||
                           normalized.includes('device') && normalized.includes('status');
                  });
                  
                  const equipmentLRSwitchStatusHeader = onlineOfflineHeaders.find((h: string) => {
                    const normalized = normalizeHeader(h);
                    return normalized === 'equipment l/r switch status' ||
                           normalized === 'equipment_l/r_switch_status' ||
                           normalized === 'equipmentl/rswitchstatus' ||
                           (normalized.includes('equipment') && normalized.includes('switch') && normalized.includes('status')) ||
                           (normalized.includes('l/r') && normalized.includes('switch'));
                  });
                  
                  const noOfDaysOfflineHeader = onlineOfflineHeaders.find((h: string) => {
                    const normalized = normalizeHeader(h);
                    return normalized === 'no of days offline' ||
                           normalized === 'no_of_days_offline' ||
                           normalized === 'noofdaysoffline' ||
                           (normalized.includes('days') && normalized.includes('offline')) ||
                           (normalized.includes('day') && normalized.includes('offline'));
                  });
                  
                  // Find the column that comes after "NO OF DAYS OFFLINE" in ONLINE-OFFLINE.xlsx
                  let columnAfterNoOfDaysOffline: string | null = null;
                  if (noOfDaysOfflineHeader) {
                    const noOfDaysIndex = onlineOfflineHeaders.indexOf(noOfDaysOfflineHeader);
                    if (noOfDaysIndex !== -1 && noOfDaysIndex + 1 < onlineOfflineHeaders.length) {
                      // Get the next column after NO OF DAYS OFFLINE
                      columnAfterNoOfDaysOffline = onlineOfflineHeaders[noOfDaysIndex + 1];
                      console.log('Column after NO OF DAYS OFFLINE found:', columnAfterNoOfDaysOffline);
                      console.log('NO OF DAYS OFFLINE index:', noOfDaysIndex, 'Next column index:', noOfDaysIndex + 1);
                      console.log('All ONLINE-OFFLINE headers:', onlineOfflineHeaders);
                    } else {
                      console.log('NO OF DAYS OFFLINE is the last column, no column after it');
                    }
                  }
                  
                  console.log('DEVICE STATUS header found:', deviceStatusHeader);
                  console.log('EQUIPMENT L/R SWITCH STATUS header found:', equipmentLRSwitchStatusHeader);
                  console.log('NO OF DAYS OFFLINE header found:', noOfDaysOfflineHeader);
                  console.log('Column after NO OF DAYS OFFLINE:', columnAfterNoOfDaysOffline);
                  
                  // Build columns to insert: DEVICE STATUS, EQUIPMENT L/R SWITCH STATUS, NO OF DAYS OFFLINE, ALL DATE COLUMNS, and column after NO OF DAYS
                  const onlineOfflineColumns: string[] = [];
                  if (deviceStatusHeader) onlineOfflineColumns.push(deviceStatusHeader);
                  if (equipmentLRSwitchStatusHeader) onlineOfflineColumns.push(equipmentLRSwitchStatusHeader);
                  if (noOfDaysOfflineHeader) onlineOfflineColumns.push(noOfDaysOfflineHeader);
                  
                  // CRITICAL: Include ALL date columns to preserve historical data
                  // This ensures old data from older date columns is also stored in the database
                  if (dateColumns && dateColumns.length > 0) {
                    dateColumns.forEach(({ name }) => {
                      if (!onlineOfflineColumns.includes(name)) {
                        onlineOfflineColumns.push(name);
                        console.log('Added date column to extraction list:', name);
                      }
                    });
                    console.log(`Added ${dateColumns.length} date columns to preserve all historical data`);
                  }
                  
                  // Add the column after NO OF DAYS OFFLINE if it exists and is not already in the list
                  if (columnAfterNoOfDaysOffline && !onlineOfflineColumns.includes(columnAfterNoOfDaysOffline)) {
                    // Make sure it's not a date column or SITE CODE column (we don't want to duplicate those)
                    const normalizedNextCol = normalizeHeader(columnAfterNoOfDaysOffline);
                    const isDateColumn = normalizedNextCol.includes('date') || normalizedNextCol.includes('time');
                    const isSiteCodeColumn = normalizedNextCol === 'site code' || normalizedNextCol === 'sitecode' || normalizedNextCol === 'site_code';
                    
                    if (!isDateColumn && !isSiteCodeColumn) {
                      onlineOfflineColumns.push(columnAfterNoOfDaysOffline);
                      console.log('Added column after NO OF DAYS OFFLINE to extraction list:', columnAfterNoOfDaysOffline);
                    } else {
                      console.log('Skipped column after NO OF DAYS OFFLINE (it is a date column or SITE CODE):', columnAfterNoOfDaysOffline);
                    }
                  }
                  
                  // Store ONLINE-OFFLINE columns in the shared variable
                  onlineOfflineColumnsList = [...onlineOfflineColumns];
                  
                  // Add ONLINE-OFFLINE columns to the main columnsToInsert array
                  onlineOfflineColumns.forEach(col => {
                    if (!columnsToInsert.includes(col)) {
                      columnsToInsert.push(col);
                    }
                  });
                  
                  // Also add to onlineOfflineColumnsToPreserve
                  onlineOfflineColumns.forEach(col => {
                    if (!onlineOfflineColumnsToPreserve.includes(col)) {
                      onlineOfflineColumnsToPreserve.push(col);
                    }
                  });
                  
                  console.log('ONLINE-OFFLINE columns to insert:', onlineOfflineColumns);
                  console.log('All columns to insert so far:', columnsToInsert);
                  console.log('onlineOfflineColumnsToPreserve after ONLINE-OFFLINE:', onlineOfflineColumnsToPreserve);
                  
                  if (mainSiteCodeHeader && onlineOfflineSiteCodeHeader && onlineOfflineColumns.length > 0) {
                    // Create a map of ONLINE-OFFLINE data by SITE CODE
                    // Include ALL rows from ONLINE-OFFLINE file (not just those with data in latest date column)
                    const onlineOfflineMap = new Map<string, any>();
                    
                    // Process ALL rows - don't filter out rows without data in latest date column
                    // This ensures old data (rows with data in older date columns) is also included
                    let filteredRows = [...onlineOfflineRows];
                    console.log(`Processing all ${filteredRows.length} rows from ONLINE-OFFLINE file (including rows with data in older date columns)`);
                    
                    // Map by SITE CODE, keeping only one entry per SITE CODE
                    // If multiple rows exist for same SITE CODE, prefer the one with data in latest date column
                    filteredRows.forEach((row: any) => {
                      const siteCode = String(row[onlineOfflineSiteCodeHeader] || '').trim();
                      if (siteCode) {
                        // If we already have this SITE CODE, check if current row has data in latest date column
                        if (onlineOfflineMap.has(siteCode)) {
                          const existingRow = onlineOfflineMap.get(siteCode);
                          const existingHasDate = latestDateColumn && existingRow[latestDateColumn] && 
                                                 String(existingRow[latestDateColumn]).trim() !== '';
                          const currentHasDate = latestDateColumn && row[latestDateColumn] && 
                                               String(row[latestDateColumn]).trim() !== '';
                          
                          // Prefer row with data in latest date column
                          if (currentHasDate && !existingHasDate) {
                            onlineOfflineMap.set(siteCode, row);
                          }
                        } else {
                          onlineOfflineMap.set(siteCode, row);
                        }
                      }
                    });
                    
                    console.log('Mapped ONLINE-OFFLINE data for', onlineOfflineMap.size, 'unique SITE CODEs');
                    
                    // Merge data into main rows
                    let mergedCount = 0;
                    fileRows = fileRows.map((row: any) => {
                      const siteCode = String(row[mainSiteCodeHeader] || '').trim();
                      const onlineOfflineRow = onlineOfflineMap.get(siteCode);
                      
                      if (onlineOfflineRow) {
                        mergedCount++;
                        // Add the ONLINE-OFFLINE columns from ONLINE-OFFLINE data
                        const mergedRow = { ...row };
                        onlineOfflineColumns.forEach((col: string) => {
                          mergedRow[col] = onlineOfflineRow[col] ?? '';
                        });
                        return mergedRow;
                      }
                      // If no match, add empty values for the ONLINE-OFFLINE columns
                      const mergedRow = { ...row };
                      onlineOfflineColumns.forEach((col: string) => {
                        mergedRow[col] = '';
                      });
                      return mergedRow;
                    });
                    
                      console.log('Merged ONLINE-OFFLINE data into', mergedCount, 'rows');
                      console.log('Sample merged row (first row with data):', fileRows.find((r: any) => {
                        const siteCode = String(r[mainSiteCodeHeader] || '').trim();
                        return siteCode && onlineOfflineMap.has(siteCode);
                      }));
                      
                      // Insert the ONLINE-OFFLINE columns before SITE CODE in headers
                      // IMPORTANT: Maintain the order: DEVICE STATUS, EQUIPMENT L/R SWITCH STATUS, NO OF DAYS OFFLINE, [Column after NO OF DAYS]
                      const siteCodeIndex = hdrs.indexOf(mainSiteCodeHeader);
                      if (siteCodeIndex !== -1) {
                        // Only insert columns that aren't already in headers, maintaining order
                        const columnsToAdd = onlineOfflineColumns.filter(col => !hdrs.includes(col));
                        if (columnsToAdd.length > 0) {
                          // Insert columns in the exact order they appear in onlineOfflineColumns array
                          hdrs = [
                            ...hdrs.slice(0, siteCodeIndex),
                            ...columnsToAdd,
                            ...hdrs.slice(siteCodeIndex)
                          ];
                          console.log('Inserted ONLINE-OFFLINE columns before SITE CODE at index', siteCodeIndex);
                          console.log('ONLINE-OFFLINE columns inserted in order:', columnsToAdd);
                          console.log('Headers after ONLINE-OFFLINE insertion:', hdrs);
                          console.log('ONLINE-OFFLINE columns in headers (with indices):', onlineOfflineColumns.map(col => ({
                            col,
                            index: hdrs.indexOf(col)
                          })));
                          
                          // Verify the order is correct: DEVICE STATUS, EQUIPMENT L/R SWITCH STATUS, NO OF DAYS OFFLINE, [Column after NO OF DAYS]
                          const deviceStatusIdx = hdrs.indexOf(deviceStatusHeader || '');
                          const equipmentIdx = hdrs.indexOf(equipmentLRSwitchStatusHeader || '');
                          const noOfDaysIdx = hdrs.indexOf(noOfDaysOfflineHeader || '');
                          const columnAfterIdx = columnAfterNoOfDaysOffline ? hdrs.indexOf(columnAfterNoOfDaysOffline) : -1;
                          
                          console.log('Column order verification:');
                          console.log(`  DEVICE STATUS: index ${deviceStatusIdx}`);
                          console.log(`  EQUIPMENT L/R SWITCH STATUS: index ${equipmentIdx}`);
                          console.log(`  NO OF DAYS OFFLINE: index ${noOfDaysIdx}`);
                          console.log(`  Column after NO OF DAYS: index ${columnAfterIdx} (${columnAfterNoOfDaysOffline || 'N/A'})`);
                          
                          // Verify order is correct
                          if (deviceStatusIdx !== -1 && equipmentIdx !== -1 && noOfDaysIdx !== -1) {
                            if (deviceStatusIdx < equipmentIdx && equipmentIdx < noOfDaysIdx) {
                              console.log('✓ Column order is correct: DEVICE STATUS < EQUIPMENT < NO OF DAYS');
                              if (columnAfterIdx !== -1 && columnAfterIdx > noOfDaysIdx) {
                                console.log(`✓ Column after NO OF DAYS is correctly positioned after NO OF DAYS`);
                              } else if (columnAfterIdx === -1) {
                                console.log('⚠ Column after NO OF DAYS not found in headers (may have been skipped)');
                              } else {
                                console.warn(`⚠ Column after NO OF DAYS is at index ${columnAfterIdx}, but NO OF DAYS is at ${noOfDaysIdx} - order may be incorrect`);
                              }
                            } else {
                              console.warn('⚠ Column order may be incorrect');
                            }
                          }
                        } else {
                          console.log('ONLINE-OFFLINE columns already in headers');
                        }
                      } else {
                        // If SITE CODE not found, add at the end, maintaining order
                        const columnsToAdd = onlineOfflineColumns.filter(col => !hdrs.includes(col));
                        if (columnsToAdd.length > 0) {
                          hdrs = [...hdrs, ...columnsToAdd];
                          console.log('SITE CODE not found, added ONLINE-OFFLINE columns at the end in order:', columnsToAdd);
                        }
                      }
                      
                      // Verify ONLINE-OFFLINE columns are in onlineOfflineColumnsToPreserve
                      onlineOfflineColumns.forEach(col => {
                        if (!onlineOfflineColumnsToPreserve.includes(col)) {
                          onlineOfflineColumnsToPreserve.push(col);
                          console.warn(`Added missing ONLINE-OFFLINE column to preserve list: ${col}`);
                        }
                      });
                      console.log('Updated onlineOfflineColumnsToPreserve after ONLINE-OFFLINE merge:', onlineOfflineColumnsToPreserve);
                      console.log('Verifying ONLINE-OFFLINE columns are in headers:', onlineOfflineColumns.map(col => ({
                        col,
                        inHeaders: hdrs.includes(col),
                        index: hdrs.indexOf(col)
                      })));
                  } else {
                    console.warn('Cannot merge ONLINE-OFFLINE data:', {
                      hasMainSiteCode: !!mainSiteCodeHeader,
                      hasOnlineOfflineSiteCode: !!onlineOfflineSiteCodeHeader,
                      columnsToInsertCount: onlineOfflineColumns.length,
                      mainHeaders: hdrs,
                      onlineOfflineHeaders: onlineOfflineHeaders
                    });
                  }
                } else {
                  console.warn('ONLINE-OFFLINE file data fetch failed or no data');
                }
              } else {
                console.log('No ONLINE-OFFLINE DATA file found. Available files:', 
                  (onlineOfflineJson.files || []).map((f: any) => ({ name: f.name, uploadType: f.uploadType }))
                );
              }
            }
          } catch (error) {
            console.error('Error fetching ONLINE-OFFLINE DATA:', error);
            // Continue with main file data even if ONLINE-OFFLINE fetch fails
          }
          
          // Fetch RTU-TRACKER files (uploadType === 'rtu-tracker')
          // IMPORTANT: This MUST run independently of ONLINE-OFFLINE processing
          console.log('=== STARTING RTU-TRACKER FILE FETCH ===');
          try {
            const rtuTrackerRes = await fetch('http://localhost:5000/api/uploads', {
              headers: {
                'Authorization': token ? `Bearer ${token}` : ''
              }
            });
            const rtuTrackerJson = await rtuTrackerRes.json();
            
            console.log('RTU-TRACKER fetch response:', {
              success: rtuTrackerJson?.success,
              filesCount: rtuTrackerJson?.files?.length || 0,
              allFiles: rtuTrackerJson?.files?.map((f: any) => ({ name: f.name, uploadType: f.uploadType })) || []
            });
            
            if (rtuTrackerJson?.success) {
              // Find RTU-TRACKER files (must be RTU-TRACKER type or have "rtu-tracker" in filename)
              // Improved matching to handle variations: RTU-TRACKER, RTU_TRACKER, RTU TRACKER, RTUTRACKER, etc.
              const rtuTrackerFiles = (rtuTrackerJson.files || []).filter((f: any) => {
                const uploadTypeValue = f.uploadType;
                const originalFileName = String(f.name || '').toLowerCase();
                
                const isRtuTrackerType = uploadTypeValue && String(uploadTypeValue).toLowerCase().trim() === 'rtu-tracker';
                
                // More robust filename matching - handle various separators and case variations
                const normalizedFileName = originalFileName.replace(/[-_\s]/g, '');
                const isRtuTrackerFileName = 
                  originalFileName.includes('rtu-tracker') || 
                  originalFileName.includes('rtu_tracker') ||
                  originalFileName.includes('rtu tracker') ||
                  originalFileName.includes('rtutracker') ||
                  normalizedFileName.includes('rtutracker') ||
                  /rtu.*tracker/i.test(f.name || '');
                
                const shouldInclude = isRtuTrackerType || isRtuTrackerFileName;
                if (shouldInclude) {
                  console.log(`RTU-TRACKER file matched: ${f.name} (uploadType: ${uploadTypeValue}, typeMatch: ${isRtuTrackerType}, nameMatch: ${isRtuTrackerFileName})`);
                }
                
                // Include if uploadType is 'rtu-tracker' OR filename matches RTU-TRACKER pattern
                return shouldInclude;
              });
              
              console.log('=== RTU-TRACKER FILE PROCESSING START ===');
              console.log('RTU-TRACKER files found:', rtuTrackerFiles.length);
              console.log('RTU-TRACKER files details:', rtuTrackerFiles.map((f: any) => ({ name: f.name, uploadType: f.uploadType, fileId: f.fileId })));
              
              // Sort by upload date (latest first) and get the most recent RTU-TRACKER file
              const latestRtuTrackerFile = rtuTrackerFiles.sort((a: any, b: any) => {
                const dateA = a.uploadedAt ? new Date(a.uploadedAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
                const dateB = b.uploadedAt ? new Date(b.uploadedAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
                return dateB - dateA; // Latest first
              })[0];
              
              // Fetch RTU-TRACKER file data
              if (latestRtuTrackerFile) {
                console.log('Found RTU-TRACKER file:', latestRtuTrackerFile.name);
                console.log('RTU-TRACKER file ID:', latestRtuTrackerFile.fileId);
                
                try {
                  const rtuTrackerDataRes = await fetch(`http://localhost:5000/api/uploads/${latestRtuTrackerFile.fileId}`, {
                    headers: {
                      'Authorization': token ? `Bearer ${token}` : ''
                    }
                  });
                  const rtuTrackerDataJson = await rtuTrackerDataRes.json();
                  
                  console.log('RTU-TRACKER file fetch response:', {
                    success: rtuTrackerDataJson?.success,
                    hasFile: !!rtuTrackerDataJson?.file,
                    file: rtuTrackerDataJson?.file ? { name: rtuTrackerDataJson.file.name, headersCount: rtuTrackerDataJson.file.headers?.length, rowsCount: rtuTrackerDataJson.file.rows?.length } : null
                  });
                  
                  if (rtuTrackerDataJson?.success && rtuTrackerDataJson.file) {
                    const rtuTrackerData = rtuTrackerDataJson.file;
                    const rtuTrackerRows = Array.isArray(rtuTrackerData.rows) ? rtuTrackerData.rows : [];
                    const rtuTrackerHeaders = rtuTrackerData.headers && rtuTrackerData.headers.length 
                      ? rtuTrackerData.headers 
                      : (rtuTrackerRows[0] ? Object.keys(rtuTrackerRows[0]) : []);
                    
                    console.log('=== RTU-TRACKER FILE DATA ===');
                    console.log('RTU-TRACKER headers:', rtuTrackerHeaders);
                    console.log('RTU-TRACKER headers count:', rtuTrackerHeaders.length);
                    console.log('RTU-TRACKER rows count:', rtuTrackerRows.length);
                    if (rtuTrackerRows.length > 0) {
                      console.log('RTU-TRACKER first row sample:', rtuTrackerRows[0]);
                    }
                    
                    // Find SITE CODE column in RTU-TRACKER file
                    const normalizeHeaderForRtuTracker = (h: string) => h.trim().toLowerCase();
                    const rtuTrackerSiteCodeHeader = rtuTrackerHeaders.find((h: string) => {
                      const normalized = normalizeHeaderForRtuTracker(h);
                      return normalized === 'site code' || normalized === 'sitecode' || normalized === 'site_code';
                    });
                    
                    console.log('RTU-TRACKER SITE CODE header:', rtuTrackerSiteCodeHeader);
                    
                    // Parse date from column names to find latest date column
                    const parseDateFromColumnName = (columnName: string): Date | null => {
                      const datePatterns = [
                        /(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/, // DD-MM-YYYY or DD/MM/YYYY
                        /(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/, // YYYY-MM-DD or YYYY/MM/DD
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
                    
                    // Find all date columns in RTU-TRACKER file
                    console.log('=== RTU-TRACKER DATE COLUMN SEARCH ===');
                    console.log('Searching for date columns in RTU-TRACKER headers...');
                    const rtuTrackerDateColumns: Array<{ name: string; date: Date; index: number }> = [];
                    rtuTrackerHeaders.forEach((h: string, index: number) => {
                      const normalized = normalizeHeaderForRtuTracker(h);
                      const hasDateKeyword = normalized.includes('date') || normalized.includes('time');
                      if (hasDateKeyword) {
                        console.log(`  Header ${index}: "${h}" - contains date/time keyword, parsing date...`);
                        const date = parseDateFromColumnName(h);
                        if (date && !isNaN(date.getTime())) {
                          rtuTrackerDateColumns.push({ name: h, date, index });
                          console.log(`    ✓ Date found: ${date.toLocaleDateString()} - added to date columns`);
                        } else {
                          console.log(`    ✗ No valid date pattern found in header name`);
                        }
                      }
                    });
                    
                    console.log(`RTU-TRACKER date columns found: ${rtuTrackerDateColumns.length}`);
                    if (rtuTrackerDateColumns.length > 0) {
                      console.log('  Date columns:', rtuTrackerDateColumns.map(d => ({ name: d.name, date: d.date.toLocaleDateString(), index: d.index })));
                    } else {
                      console.error('  ✗ ERROR: No date columns found in RTU-TRACKER file!');
                      console.error('  All headers:', rtuTrackerHeaders.map((h: string, i: number) => `${i}: "${h}"`));
                    }
                    
                    // Find the latest date column
                    let latestRtuTrackerDateColumn: string | null = null;
                    let latestRtuTrackerDateColumnIndex: number = -1;
                    if (rtuTrackerDateColumns.length > 0) {
                      rtuTrackerDateColumns.sort((a, b) => b.date.getTime() - a.date.getTime()); // Latest first
                      latestRtuTrackerDateColumn = rtuTrackerDateColumns[0].name;
                      latestRtuTrackerDateColumnIndex = rtuTrackerDateColumns[0].index;
                      console.log('✓ RTU-TRACKER latest date column found:', latestRtuTrackerDateColumn);
                      console.log('  Latest date:', rtuTrackerDateColumns[0].date.toLocaleDateString());
                      console.log('  Latest date column index:', latestRtuTrackerDateColumnIndex);
                    } else {
                      console.error('✗ ERROR: Cannot find latest date column - no date columns found!');
                      console.error('  Will attempt fallback: use all columns after SITE CODE');
                    }
                    
                    // Find ALL columns after the latest date column
                    let rtuTrackerColumnsToInsert: string[] = [];
                    // Reset the higher-scope tracking variable for this RTU-TRACKER file
                    rtuTrackerColumnsList = [];
                    console.log('=== RTU-TRACKER COLUMN IDENTIFICATION ===');
                    console.log('Latest date column index:', latestRtuTrackerDateColumnIndex);
                    console.log('RTU-TRACKER headers length:', rtuTrackerHeaders.length);
                    console.log('Main SITE CODE header:', mainSiteCodeHeader);
                    console.log('RTU-TRACKER SITE CODE header:', rtuTrackerSiteCodeHeader);
                    
                    // Determine start index: use latest date column if found, otherwise use SITE CODE position
                    let startIndex = -1;
                    if (latestRtuTrackerDateColumnIndex !== -1 && latestRtuTrackerDateColumnIndex + 1 < rtuTrackerHeaders.length) {
                      startIndex = latestRtuTrackerDateColumnIndex + 1;
                      console.log('Using latest date column + 1 as start index:', startIndex);
                    } else if (rtuTrackerSiteCodeHeader) {
                      // Fallback: if no date columns found, use all columns after SITE CODE
                      const siteCodeIndex = rtuTrackerHeaders.indexOf(rtuTrackerSiteCodeHeader);
                      if (siteCodeIndex !== -1 && siteCodeIndex + 1 < rtuTrackerHeaders.length) {
                        startIndex = siteCodeIndex + 1;
                        console.log('FALLBACK: Using SITE CODE + 1 as start index:', startIndex);
                        console.log('  (No date columns found, using all columns after SITE CODE)');
                      }
                    }
                    
                    if (startIndex !== -1 && startIndex < rtuTrackerHeaders.length) {
                      // Get ALL columns after the start index (until end of headers)
                      const normalizeHeaderForRtuTracker = (h: string) => h.trim().toLowerCase();
                      
                      // Get all columns after the start index (either latest date or SITE CODE)
                      // Exclude SITE CODE column and any date columns (but include all other columns until end)
                      for (let i = startIndex; i < rtuTrackerHeaders.length; i++) {
                        const header = rtuTrackerHeaders[i];
                        const normalizedHeader = normalizeHeaderForRtuTracker(header);
                        
                        // Skip SITE CODE column (we don't want to duplicate it)
                        if (normalizedHeader === 'site code' || normalizedHeader === 'sitecode' || normalizedHeader === 'site_code') {
                          console.log(`  Skipping SITE CODE column at index ${i}: "${header}"`);
                          continue; // Skip SITE CODE but continue to next columns
                        }
                        
                        // Skip date columns (we only want data columns, not date columns)
                        const isDateColumn = normalizedHeader.includes('date') || normalizedHeader.includes('time');
                        if (isDateColumn) {
                          console.log(`  Skipping date column at index ${i}: "${header}"`);
                          continue;
                        }
                        
                        // Skip RTU TRACKER OBSERVATION/OBSERBATION column (not needed in MY RTU LOCAL)
                        const isRtuTrackerObservation = (normalizedHeader.includes('rtu') && normalizedHeader.includes('tracker') && 
                                                         (normalizedHeader.includes('observation') || normalizedHeader.includes('obserbation'))) ||
                                                        normalizedHeader === 'rtu tracker observation' ||
                                                        normalizedHeader === 'rtu tracker obserbation' ||
                                                        normalizedHeader === 'rtu_tracker_observation' ||
                                                        normalizedHeader === 'rtu_tracker_obserbation';
                        if (isRtuTrackerObservation) {
                          console.log(`  Skipping RTU TRACKER OBSERVATION/OBSERBATION column at index ${i}: "${header}"`);
                          continue;
                        }
                        
                        // Include this column
                        rtuTrackerColumnsToInsert.push(header);
                        rtuTrackerColumnsList.push(header); // Also track in higher-scope variable
                        console.log(`  ✓ Added RTU-TRACKER column at index ${i}: "${header}"`);
                      }
                      
                      console.log('✓ RTU-TRACKER columns after latest date FOUND:', rtuTrackerColumnsToInsert);
                      console.log('✓ RTU-TRACKER columns list updated:', rtuTrackerColumnsList);
                      console.log('  Total columns to insert:', rtuTrackerColumnsToInsert.length);
                      console.log('  Columns:', rtuTrackerColumnsToInsert);
                      console.log('  All headers at indices:', rtuTrackerHeaders.map((h: string, i: number) => `${i}: ${h}`));
                      
                      if (rtuTrackerColumnsToInsert.length === 0) {
                        console.warn('  WARNING: No RTU-TRACKER columns found after latest date (all columns were SITE CODE or date columns)');
                      }
                    } else {
                      console.error('✗ RTU-TRACKER columns after latest date NOT FOUND');
                      console.error('  Latest date column index:', latestRtuTrackerDateColumnIndex);
                      console.error('  Headers length:', rtuTrackerHeaders.length);
                      if (latestRtuTrackerDateColumnIndex === -1) {
                        console.error('  ERROR: No date column found in RTU-TRACKER file!');
                      } else if (latestRtuTrackerDateColumnIndex + 1 >= rtuTrackerHeaders.length) {
                        console.error('  ERROR: Latest date column is the last column! No column after it.');
                      }
                    }
                    
                    // If we found columns to insert and SITE CODE exists in both files
                    console.log('=== RTU-TRACKER MERGE CONDITIONS CHECK ===');
                    console.log('Main SITE CODE header exists:', !!mainSiteCodeHeader);
                    console.log('RTU-TRACKER SITE CODE header exists:', !!rtuTrackerSiteCodeHeader);
                    console.log('RTU-TRACKER columns to insert count:', rtuTrackerColumnsToInsert.length);
                    console.log('RTU-TRACKER columns to insert:', rtuTrackerColumnsToInsert);
                    
                    if (mainSiteCodeHeader && rtuTrackerSiteCodeHeader && rtuTrackerColumnsToInsert.length > 0) {
                      console.log('✓ All merge conditions met - proceeding with RTU-TRACKER merge');
                      // Filter rows: only include rows where the latest date column has a value
                      let filteredRtuTrackerRows = [...rtuTrackerRows];
                      if (latestRtuTrackerDateColumn) {
                        filteredRtuTrackerRows = rtuTrackerRows.filter((row: any) => {
                          const dateValue = row[latestRtuTrackerDateColumn!];
                          return dateValue !== null && dateValue !== undefined && String(dateValue).trim() !== '';
                        });
                        console.log(`Filtered RTU-TRACKER rows: ${filteredRtuTrackerRows.length} rows have data in latest date column "${latestRtuTrackerDateColumn}"`);
                      }
                      
                      // Map RTU-TRACKER data by SITE CODE
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
                      
                      console.log('Mapped RTU-TRACKER data for', rtuTrackerMap.size, 'unique SITE CODEs');
                      
                      // Merge RTU-TRACKER columns into main rows
                      let mergedRtuTrackerCount = 0;
                      fileRows = fileRows.map((row: any) => {
                        const siteCode = String(row[mainSiteCodeHeader] || '').trim();
                        const rtuTrackerRow = rtuTrackerMap.get(siteCode);
                        
                        const mergedRow = { ...row };
                        
                        if (rtuTrackerRow) {
                          mergedRtuTrackerCount++;
                          // Merge all RTU-TRACKER columns
                          rtuTrackerColumnsToInsert.forEach((col: string) => {
                            mergedRow[col] = rtuTrackerRow[col] ?? '';
                          });
                        } else {
                          // If no match, add empty values for all RTU-TRACKER columns
                          rtuTrackerColumnsToInsert.forEach((col: string) => {
                            mergedRow[col] = '';
                          });
                        }
                        
                        return mergedRow;
                      });
                      
                      console.log('Merged RTU-TRACKER columns into', mergedRtuTrackerCount, 'rows');
                      console.log('RTU-TRACKER columns merged:', rtuTrackerColumnsToInsert);
                      
                      // CRITICAL: Verify ONLINE-OFFLINE columns are still in headers BEFORE inserting RTU-TRACKER
                      console.log('=== VERIFYING ONLINE-OFFLINE COLUMNS BEFORE RTU-TRACKER INSERTION ===');
                      console.log('ONLINE-OFFLINE columns that should be in headers:', onlineOfflineColumnsList);
                      console.log('Current columnsToInsert:', columnsToInsert);
                      console.log('Current headers:', hdrs);
                      
                      // Check if ONLINE-OFFLINE columns are in headers
                      const onlineOfflineColumnsInHeadersBeforeRtuTracker = onlineOfflineColumnsList.filter(col => hdrs.includes(col));
                      const onlineOfflineColumnsMissingFromHeadersBeforeRtuTracker = onlineOfflineColumnsList.filter(col => !hdrs.includes(col));
                      
                      console.log('ONLINE-OFFLINE columns found in headers before RTU-TRACKER insertion:', onlineOfflineColumnsInHeadersBeforeRtuTracker);
                      if (onlineOfflineColumnsMissingFromHeadersBeforeRtuTracker.length > 0) {
                        console.error('ERROR: ONLINE-OFFLINE columns MISSING from headers before RTU-TRACKER insertion:', onlineOfflineColumnsMissingFromHeadersBeforeRtuTracker);
                        // Re-add missing ONLINE-OFFLINE columns to headers before inserting RTU-TRACKER
                        const siteCodeIdx = hdrs.indexOf(mainSiteCodeHeader || '');
                        onlineOfflineColumnsMissingFromHeadersBeforeRtuTracker.forEach(col => {
                          if (siteCodeIdx !== -1) {
                            hdrs.splice(siteCodeIdx, 0, col);
                            console.log(`Re-added missing ONLINE-OFFLINE column "${col}" to headers at index ${siteCodeIdx}`);
                          } else {
                            hdrs.push(col);
                            console.log(`Re-added missing ONLINE-OFFLINE column "${col}" to end of headers`);
                          }
                        });
                      }
                      
                      // Add RTU-TRACKER columns to columns to insert (before SITE CODE)
                      rtuTrackerColumnsToInsert.forEach((col: string) => {
                        if (!columnsToInsert.includes(col)) {
                          columnsToInsert.push(col);
                          onlineOfflineColumnsToPreserve.push(col);
                          console.log('✓ Added RTU-TRACKER column to columns to insert:', col);
                        } else {
                          console.log('RTU-TRACKER column already in columnsToInsert:', col);
                        }
                      });
                      
                      // Insert RTU-TRACKER columns before SITE CODE in headers
                      // Get columns that aren't already in headers
                      const rtuTrackerColumnsToAdd = rtuTrackerColumnsToInsert.filter(col => !hdrs.includes(col));
                      
                      if (rtuTrackerColumnsToAdd.length > 0) {
                        const siteCodeIndexInHeaders = hdrs.indexOf(mainSiteCodeHeader);
                        if (siteCodeIndexInHeaders !== -1) {
                          // Insert RTU-TRACKER columns right before SITE CODE (after ONLINE-OFFLINE columns if they exist)
                          // Maintain the order of RTU-TRACKER columns as they appear in the file
                          hdrs = [
                            ...hdrs.slice(0, siteCodeIndexInHeaders),
                            ...rtuTrackerColumnsToAdd,
                            ...hdrs.slice(siteCodeIndexInHeaders)
                          ];
                          console.log('✓ Inserted RTU-TRACKER columns before SITE CODE at index', siteCodeIndexInHeaders);
                          console.log('  RTU-TRACKER columns inserted:', rtuTrackerColumnsToAdd);
                          console.log('  Total RTU-TRACKER columns:', rtuTrackerColumnsToAdd.length);
                          console.log('Headers after RTU-TRACKER insertion:', hdrs);
                          rtuTrackerColumnsToAdd.forEach((col: string) => {
                            console.log(`  RTU-TRACKER column "${col}" index in headers:`, hdrs.indexOf(col));
                          });
                        } else {
                          // If SITE CODE not found, add at the end
                          hdrs = [...hdrs, ...rtuTrackerColumnsToAdd];
                          console.log('RTU-TRACKER columns added at the end (SITE CODE not found):', rtuTrackerColumnsToAdd);
                        }
                      } else {
                        console.log('RTU-TRACKER columns already in headers');
                        rtuTrackerColumnsToInsert.forEach((col: string) => {
                          console.log(`  RTU-TRACKER column "${col}" already in headers at index:`, hdrs.indexOf(col));
                        });
                      }
                      
                      // Ensure RTU-TRACKER columns are in onlineOfflineColumnsToPreserve
                      rtuTrackerColumnsToInsert.forEach((col: string) => {
                        if (!onlineOfflineColumnsToPreserve.includes(col)) {
                          onlineOfflineColumnsToPreserve.push(col);
                          console.log('✓ Added RTU-TRACKER column to preserve list:', col);
                        }
                      });
                      
                      // Also update columnsToInsert to ensure RTU-TRACKER columns are included
                      rtuTrackerColumnsToInsert.forEach((col: string) => {
                        if (!columnsToInsert.includes(col)) {
                          columnsToInsert.push(col);
                          console.log('✓ Added RTU-TRACKER column to columnsToInsert:', col);
                        }
                      });
                      
                      // CRITICAL: Verify ONLINE-OFFLINE columns are STILL in headers AFTER RTU-TRACKER insertion
                      console.log('=== VERIFYING ONLINE-OFFLINE COLUMNS AFTER RTU-TRACKER INSERTION ===');
                      const onlineOfflineColumnsInHeadersAfterRtuTracker = onlineOfflineColumnsList.filter(col => hdrs.includes(col));
                      const onlineOfflineColumnsMissingAfterRtuTracker = onlineOfflineColumnsList.filter(col => !hdrs.includes(col));
                      
                      console.log('ONLINE-OFFLINE columns found in headers after RTU-TRACKER insertion:', onlineOfflineColumnsInHeadersAfterRtuTracker);
                      if (onlineOfflineColumnsMissingAfterRtuTracker.length > 0) {
                        console.error('CRITICAL ERROR: ONLINE-OFFLINE columns MISSING from headers after RTU-TRACKER insertion:', onlineOfflineColumnsMissingAfterRtuTracker);
                        // Re-add missing ONLINE-OFFLINE columns immediately
                        const siteCodeIdx = hdrs.indexOf(mainSiteCodeHeader || '');
                        onlineOfflineColumnsMissingAfterRtuTracker.forEach(col => {
                          if (siteCodeIdx !== -1) {
                            hdrs.splice(siteCodeIdx, 0, col);
                            console.error(`CRITICAL: Re-added missing ONLINE-OFFLINE column "${col}" to headers at index ${siteCodeIdx}`);
                          } else {
                            hdrs.push(col);
                            console.error(`CRITICAL: Re-added missing ONLINE-OFFLINE column "${col}" to end of headers`);
                          }
                        });
                        console.log('Headers after re-adding ONLINE-OFFLINE columns:', hdrs);
                      }
                      
                      // CRITICAL: Ensure ONLINE-OFFLINE columns are ALWAYS in onlineOfflineColumnsToPreserve
                      onlineOfflineColumnsList.forEach(col => {
                        if (!onlineOfflineColumnsToPreserve.includes(col)) {
                          console.error(`CRITICAL: ONLINE-OFFLINE column "${col}" missing from preserve list, adding it`);
                          onlineOfflineColumnsToPreserve.push(col);
                        }
                        if (!columnsToInsert.includes(col)) {
                          console.error(`CRITICAL: ONLINE-OFFLINE column "${col}" missing from columnsToInsert, adding it`);
                          columnsToInsert.push(col);
                        }
                      });
                      
                      console.log('=== FINAL VERIFICATION AFTER RTU-TRACKER PROCESSING ===');
                      console.log('onlineOfflineColumnsToPreserve:', onlineOfflineColumnsToPreserve);
                      console.log('columnsToInsert:', columnsToInsert);
                      console.log('Verifying ALL columns are in preserve list:');
                      onlineOfflineColumnsList.forEach(col => {
                        const inPreserve = onlineOfflineColumnsToPreserve.includes(col);
                        const inColumnsToInsert = columnsToInsert.includes(col);
                        const inHeaders = hdrs.includes(col);
                        console.log(`  - ONLINE-OFFLINE "${col}": preserve=${inPreserve}, columnsToInsert=${inColumnsToInsert}, headers=${inHeaders}, index=${hdrs.indexOf(col)}`);
                      });
                      
                      // Verify all RTU-TRACKER columns
                      rtuTrackerColumnsToInsert.forEach((col: string) => {
                        const rtuTrackerInPreserve = onlineOfflineColumnsToPreserve.includes(col);
                        const rtuTrackerInColumnsToInsert = columnsToInsert.includes(col);
                        const rtuTrackerInHeaders = hdrs.includes(col);
                        console.log(`  - RTU-TRACKER "${col}": preserve=${rtuTrackerInPreserve}, columnsToInsert=${rtuTrackerInColumnsToInsert}, headers=${rtuTrackerInHeaders}, index=${hdrs.indexOf(col)}`);
                      });
                      
                      console.log('Final onlineOfflineColumnsToPreserve after RTU-TRACKER:', onlineOfflineColumnsToPreserve);
                      console.log('Final columnsToInsert after RTU-TRACKER:', columnsToInsert);
                      console.log('Final headers after RTU-TRACKER:', hdrs);
                    } else {
                      console.error('✗ Cannot merge RTU-TRACKER data - merge conditions not met:');
                      console.error('  hasMainSiteCode:', !!mainSiteCodeHeader, mainSiteCodeHeader);
                      console.error('  hasRtuTrackerSiteCode:', !!rtuTrackerSiteCodeHeader, rtuTrackerSiteCodeHeader);
                      console.error('  hasColumnsToInsert:', rtuTrackerColumnsToInsert.length > 0, rtuTrackerColumnsToInsert.length);
                      console.error('  RTU-TRACKER columns to insert:', rtuTrackerColumnsToInsert);
                      console.error('  All RTU-TRACKER headers:', rtuTrackerHeaders);
                      console.error('  Date columns found:', rtuTrackerDateColumns.map(d => d.name));
                      console.error('  Latest date column:', latestRtuTrackerDateColumn);
                      console.error('  Latest date column index:', latestRtuTrackerDateColumnIndex);
                      
                      // Even if we can't merge, try to add the columns to preserve list if we found them
                      if (rtuTrackerColumnsToInsert.length > 0) {
                        console.log('RTU-TRACKER columns found but merge conditions not met. Adding to preserve list anyway:', rtuTrackerColumnsToInsert);
                        rtuTrackerColumnsToInsert.forEach((col: string) => {
                          if (!columnsToInsert.includes(col)) {
                            columnsToInsert.push(col);
                          }
                          if (!onlineOfflineColumnsToPreserve.includes(col)) {
                            onlineOfflineColumnsToPreserve.push(col);
                          }
                          // Try to add to headers if not already there
                          if (!hdrs.includes(col)) {
                            const siteCodeIdx = hdrs.indexOf(mainSiteCodeHeader || '');
                            if (siteCodeIdx !== -1) {
                              hdrs.splice(siteCodeIdx, 0, col);
                              console.log(`Added RTU-TRACKER column "${col}" to headers at index ${siteCodeIdx}`);
                            } else {
                              hdrs.push(col);
                              console.log(`Added RTU-TRACKER column "${col}" to end of headers`);
                            }
                          }
                        });
                      }
                    }
                  } else {
                    console.error('✗ RTU-TRACKER file data fetch failed or no data');
                    console.error('  Response:', rtuTrackerDataJson);
                    console.error('  Success:', rtuTrackerDataJson?.success);
                    console.error('  Has file:', !!rtuTrackerDataJson?.file);
                  }
                } catch (error) {
                  console.error('✗ ERROR fetching RTU-TRACKER file:', error);
                  console.error('  File ID:', latestRtuTrackerFile?.fileId);
                  console.error('  File name:', latestRtuTrackerFile?.name);
                  // Continue even if RTU-TRACKER fetch fails
                }
              } else {
                console.error('=== NO RTU-TRACKER FILE FOUND ===');
                console.error('Available files count:', (rtuTrackerJson.files || []).length);
                console.error('Available files:', 
                  (rtuTrackerJson.files || []).map((f: any) => ({ name: f.name, uploadType: f.uploadType, fileId: f.fileId }))
                );
                console.error('RTU-TRACKER files filtered count:', rtuTrackerFiles.length);
                console.error('RTU-TRACKER files filtered details:', rtuTrackerFiles.map((f: any) => ({ name: f.name, uploadType: f.uploadType, fileId: f.fileId })));
                if (rtuTrackerFiles.length === 0) {
                  console.error('  ERROR: No RTU-TRACKER files found!');
                  console.error('  This might mean:');
                  console.error('    1. RTU-TRACKER.xlsx was not uploaded with uploadType "rtu-tracker"');
                  console.error('    2. RTU-TRACKER.xlsx filename does not contain "rtu-tracker" (case-insensitive)');
                  console.error('    3. RTU-TRACKER.xlsx file was deleted or not saved');
                  console.error('  Available files with uploadType "rtu-tracker":', 
                    (rtuTrackerJson.files || []).filter((f: any) => {
                      const uploadTypeValue = f.uploadType;
                      return uploadTypeValue && String(uploadTypeValue).toLowerCase().trim() === 'rtu-tracker';
                    }).map((f: any) => ({ name: f.name, uploadType: f.uploadType }))
                  );
                  console.error('  Available files with "rtu-tracker" in filename:', 
                    (rtuTrackerJson.files || []).filter((f: any) => {
                      const fileName = String(f.name || '').toLowerCase();
                      return fileName.includes('rtu-tracker') || fileName.includes('rtu_tracker') || fileName.includes('rtutracker');
                    }).map((f: any) => ({ name: f.name, uploadType: f.uploadType }))
                  );
                }
              }
              
              console.log('=== RTU-TRACKER FILE PROCESSING END ===');
            } else {
              console.error('ERROR: RTU-TRACKER fetch failed - response not successful:', rtuTrackerJson);
              console.error('Response details:', {
                success: rtuTrackerJson?.success,
                error: rtuTrackerJson?.error,
                message: rtuTrackerJson?.message
              });
            }
          } catch (error) {
            console.error('ERROR: Exception while fetching RTU-TRACKER files:', error);
            console.error('Error details:', error instanceof Error ? error.message : String(error));
            console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
            // Continue with main file data even if RTU-TRACKER fetch fails
          }
          
          // CRITICAL: Final verification of RTU-TRACKER columns before reordering
          console.log('=== CRITICAL: FINAL RTU-TRACKER VERIFICATION BEFORE REORDERING ===');
          console.log('Current columnsToInsert:', columnsToInsert);
          console.log('Current onlineOfflineColumnsToPreserve:', onlineOfflineColumnsToPreserve);
          console.log('Current onlineOfflineColumnsList:', onlineOfflineColumnsList);
          console.log('Current headers:', hdrs);
          console.log('Current headers length:', hdrs.length);
          
          // Get all non-ONLINE-OFFLINE columns (RTU-TRACKER)
          // Use both columnsToInsert filter AND rtuTrackerColumnsList for comprehensive coverage
          const allNonOnlineOfflineColumns = columnsToInsert.filter(col => !onlineOfflineColumnsList.includes(col));
          // Also include any columns from rtuTrackerColumnsList that might have been missed
          const allRtuTrackerColumns = new Set([...allNonOnlineOfflineColumns, ...rtuTrackerColumnsList]);
          const finalRtuTrackerColumns = Array.from(allRtuTrackerColumns);
          
          console.log('All non-ONLINE-OFFLINE columns (RTU-TRACKER) in columnsToInsert:', allNonOnlineOfflineColumns);
          console.log('All non-ONLINE-OFFLINE columns (RTU-TRACKER) in onlineOfflineColumnsToPreserve:', 
            onlineOfflineColumnsToPreserve.filter(col => !onlineOfflineColumnsList.includes(col))
          );
          console.log('RTU-TRACKER columns from tracked list:', rtuTrackerColumnsList);
          console.log('Final RTU-TRACKER columns (combined):', finalRtuTrackerColumns);
          
          // Verify RTU-TRACKER columns are in both columnsToInsert and onlineOfflineColumnsToPreserve
          finalRtuTrackerColumns.forEach(col => {
            const inColumnsToInsert = columnsToInsert.includes(col);
            const inPreserve = onlineOfflineColumnsToPreserve.includes(col);
            const inHeaders = hdrs.includes(col);
            console.log(`  - RTU-TRACKER column "${col}": columnsToInsert=${inColumnsToInsert}, preserve=${inPreserve}, headers=${inHeaders}, index=${hdrs.indexOf(col)}`);
            
            if (!inColumnsToInsert) {
              console.error(`    CRITICAL: Column "${col}" is NOT in columnsToInsert! Adding it.`);
              columnsToInsert.push(col);
            }
            if (!inPreserve) {
              console.error(`    CRITICAL: Column "${col}" is NOT in onlineOfflineColumnsToPreserve! Adding it.`);
              onlineOfflineColumnsToPreserve.push(col);
            }
            if (!inHeaders) {
              console.error(`    CRITICAL: Column "${col}" is NOT in headers! Adding it.`);
              const siteCodeIdx = hdrs.indexOf(mainSiteCodeHeader || '');
              if (siteCodeIdx !== -1) {
                hdrs.splice(siteCodeIdx, 0, col);
                console.error(`    Added column "${col}" to headers at index ${siteCodeIdx}`);
              } else {
                hdrs.push(col);
                console.error(`    Added column "${col}" to end of headers`);
              }
            }
          });
          
          console.log('=== AFTER RTU-TRACKER VERIFICATION ===');
          console.log('Updated columnsToInsert:', columnsToInsert);
          console.log('Updated onlineOfflineColumnsToPreserve:', onlineOfflineColumnsToPreserve);
          console.log('Updated headers:', hdrs);
          console.log('Updated headers length:', hdrs.length);
          
          // Reorder headers: Move SITE CODE right after ATTRIBUTE
          // Preserve ONLINE-OFFLINE and RTU-TRACKER columns that were inserted before SITE CODE
          const reorderHeaders = (headers: string[], columnsToPreserve: string[]): string[] => {
            const normalizedHeaders = headers.map((h: string) => h.trim());
            const siteCodeIndex = normalizedHeaders.findIndex((h: string) => 
              h.toLowerCase() === 'site code' || 
              h.toLowerCase() === 'sitecode' || 
              h.toLowerCase() === 'site_code'
            );
            const attributeIndex = normalizedHeaders.findIndex((h: string) => 
              h.toLowerCase() === 'attribute' || 
              h.toLowerCase() === 'attributes'
            );
            
            if (siteCodeIndex === -1) {
              // SITE CODE not found, return as is
              console.warn('SITE CODE not found in headers, skipping reordering');
              return headers;
            }
            
            const reordered = [...headers];
            const siteCodeHeader = reordered.splice(siteCodeIndex, 1)[0];
            
            console.log('=== REORDERING HEADERS ===');
            console.log('Current headers:', headers);
            console.log('Columns to preserve:', columnsToPreserve);
            console.log('SITE CODE found at index:', siteCodeIndex);
            console.log('ATTRIBUTE found at index:', attributeIndex);
            
            // Remove ONLINE-OFFLINE and RTU-TRACKER columns if they exist (we know which ones they are)
            const columnsToMove: string[] = [];
            if (columnsToPreserve.length > 0) {
              console.log(`Looking for ${columnsToPreserve.length} columns to preserve (ONLINE-OFFLINE + RTU-TRACKER):`, columnsToPreserve);
              
              // Find and remove each column to preserve (ONLINE-OFFLINE and RTU-TRACKER)
              // Use a more robust matching approach to handle case sensitivity and whitespace
              columnsToPreserve.forEach(col => {
                // Try exact match first
                let colIndex = reordered.indexOf(col);
                
                // If not found, try case-insensitive match
                if (colIndex === -1) {
                  colIndex = reordered.findIndex((h: string) => h.trim().toLowerCase() === col.trim().toLowerCase());
                }
                
                // If still not found, try fuzzy match (remove spaces, case-insensitive)
                if (colIndex === -1) {
                  const normalizedCol = col.trim().toLowerCase().replace(/\s+/g, '');
                  colIndex = reordered.findIndex((h: string) => {
                    const normalizedH = h.trim().toLowerCase().replace(/\s+/g, '');
                    return normalizedH === normalizedCol;
                  });
                }
                
                if (colIndex !== -1) {
                  const removedCol = reordered.splice(colIndex, 1)[0];
                  columnsToMove.push(col);
                  console.log(`Removed column for reordering: "${col}" (found as "${removedCol}" at index ${colIndex})`);
                } else {
                  console.warn(`Column not found in headers for reordering: "${col}"`);
                  console.warn(`Available headers:`, reordered);
                  // Even if not found, add it to columnsToMove so it gets added back
                  columnsToMove.push(col);
                  console.log(`Adding missing column "${col}" to columnsToMove anyway (will be added back)`);
                }
              });
            } else {
              console.warn('No columns to preserve - columnsToPreserve is empty!');
            }
            
            console.log('Columns removed for reordering:', columnsToMove);
            console.log('Headers after removing columns:', reordered);
            console.log('Number of columns removed:', columnsToMove.length);
            
            // Find and remove ATTRIBUTE if it exists
            let attributeHeader: string | null = null;
            if (attributeIndex !== -1) {
              // Adjust index after removing SITE CODE and columns to move
              let adjustedIndex = attributeIndex;
              if (adjustedIndex > siteCodeIndex) adjustedIndex--; // SITE CODE was removed
              adjustedIndex -= columnsToMove.filter(col => {
                const originalIndex = headers.indexOf(col);
                return originalIndex !== -1 && originalIndex < attributeIndex;
              }).length; // Columns before ATTRIBUTE were removed
              
              console.log(`ATTRIBUTE original index: ${attributeIndex}, adjusted index: ${adjustedIndex}`);
              
              if (adjustedIndex >= 0 && adjustedIndex < reordered.length) {
                attributeHeader = reordered.splice(adjustedIndex, 1)[0];
                console.log(`Removed ATTRIBUTE header: "${attributeHeader}"`);
              } else {
                console.warn(`ATTRIBUTE adjusted index ${adjustedIndex} is out of bounds, length: ${reordered.length}`);
              }
            } else {
              console.log('ATTRIBUTE not found in headers');
            }
            
            // Insert ATTRIBUTE, then SITE CODE right after it, then ONLINE-OFFLINE and RTU-TRACKER columns
            // All at the end of the column list
            if (attributeHeader) {
              // Add ATTRIBUTE, then SITE CODE right after it, then ONLINE-OFFLINE and RTU-TRACKER columns
              reordered.push(attributeHeader);
              reordered.push(siteCodeHeader);
              // Add all columns (ONLINE-OFFLINE + RTU-TRACKER) after SITE CODE
              reordered.push(...columnsToMove);
              console.log(`Added ATTRIBUTE, SITE CODE, and ${columnsToMove.length} columns (ONLINE-OFFLINE + RTU-TRACKER) to end`);
            } else {
              // If no ATTRIBUTE, add SITE CODE at the end, then ONLINE-OFFLINE and RTU-TRACKER columns
              reordered.push(siteCodeHeader);
              reordered.push(...columnsToMove);
              console.log(`Added SITE CODE and ${columnsToMove.length} columns (ONLINE-OFFLINE + RTU-TRACKER) to end (no ATTRIBUTE)`);
            }
            
            console.log('Reordered headers - Final order:', reordered);
            console.log('Final headers length:', reordered.length);
            console.log('ATTRIBUTE position:', attributeHeader ? reordered.indexOf(attributeHeader) : -1);
            console.log('SITE CODE position:', reordered.indexOf(siteCodeHeader));
            console.log('Columns moved to end:', columnsToMove);
            
            // Verify all columns are present
            columnsToPreserve.forEach(col => {
              const index = reordered.indexOf(col);
              console.log(`  - "${col}": ${index !== -1 ? `Found at index ${index}` : 'MISSING!'}`);
            });
            
            return reordered;
          };
          
          // CRITICAL FINAL UPDATE: Ensure onlineOfflineColumnsToPreserve contains ALL columns
          // This is the LAST chance to preserve BOTH ONLINE-OFFLINE and RTU-TRACKER columns before reordering
          // Merge onlineOfflineColumnsList and columnsToInsert to ensure nothing is lost
          const allColumnsToPreserve = new Set<string>();
          
          console.log('=== CRITICAL FINAL CHECK BEFORE REORDERING ===');
          console.log('ONLINE-OFFLINE columns list (MUST be preserved):', onlineOfflineColumnsList);
          console.log('All columns to insert:', columnsToInsert);
          console.log('Current onlineOfflineColumnsToPreserve:', onlineOfflineColumnsToPreserve);
          console.log('Current headers:', hdrs);
          console.log('Current headers length:', hdrs.length);
          
          // Identify RTU-TRACKER columns BEFORE merging
          // RTU-TRACKER columns are in columnsToInsert but NOT in onlineOfflineColumnsList
          // Also use the tracked rtuTrackerColumnsList for more reliable identification
          const nonOnlineOfflineColumns = columnsToInsert.filter(col => !onlineOfflineColumnsList.includes(col));
          console.log('RTU-TRACKER columns found in columnsToInsert BEFORE merge:', nonOnlineOfflineColumns);
          console.log('RTU-TRACKER columns found in onlineOfflineColumnsToPreserve BEFORE merge:', 
            onlineOfflineColumnsToPreserve.filter(col => !onlineOfflineColumnsList.includes(col))
          );
          console.log('RTU-TRACKER columns from tracked list (rtuTrackerColumnsList):', rtuTrackerColumnsList);
          console.log('Non-ONLINE-OFFLINE columns (RTU-TRACKER):', nonOnlineOfflineColumns);
          
          // CRITICAL: If rtuTrackerColumnsList has columns but they're not in columnsToInsert, add them
          rtuTrackerColumnsList.forEach(col => {
            if (!columnsToInsert.includes(col)) {
              console.error(`CRITICAL: RTU-TRACKER column "${col}" from tracked list is missing from columnsToInsert! Adding it.`);
              columnsToInsert.push(col);
            }
            // Also ensure it's in onlineOfflineColumnsToPreserve
            if (!onlineOfflineColumnsToPreserve.includes(col)) {
              console.error(`CRITICAL: RTU-TRACKER column "${col}" from tracked list is missing from onlineOfflineColumnsToPreserve! Adding it.`);
              onlineOfflineColumnsToPreserve.push(col);
            }
          });
          
          // RECALCULATE nonOnlineOfflineColumns AFTER adding missing RTU-TRACKER columns
          // This ensures we capture all RTU-TRACKER columns, including those from rtuTrackerColumnsList
          const updatedNonOnlineOfflineColumns = columnsToInsert.filter(col => !onlineOfflineColumnsList.includes(col));
          // Also merge with rtuTrackerColumnsList to ensure we have ALL RTU-TRACKER columns
          const allRtuTrackerColumnsFinal = new Set([...updatedNonOnlineOfflineColumns, ...rtuTrackerColumnsList]);
          const finalNonOnlineOfflineColumns = Array.from(allRtuTrackerColumnsFinal);
          
          console.log('=== UPDATED RTU-TRACKER COLUMN IDENTIFICATION AFTER FIX ===');
          console.log('Updated nonOnlineOfflineColumns (from columnsToInsert):', updatedNonOnlineOfflineColumns);
          console.log('RTU-TRACKER columns from tracked list:', rtuTrackerColumnsList);
          console.log('Final RTU-TRACKER columns (combined):', finalNonOnlineOfflineColumns);
          
          // CRITICAL: Add ONLINE-OFFLINE columns FIRST (they MUST be preserved)
          // This is non-negotiable - ONLINE-OFFLINE columns MUST be in the final set
          onlineOfflineColumnsList.forEach(col => {
            allColumnsToPreserve.add(col);
            console.log(`✓ Added ONLINE-OFFLINE column to preserve set: "${col}"`);
            
            // Also verify it's in headers - if not, add it immediately
            if (!hdrs.includes(col)) {
              console.error(`CRITICAL: ONLINE-OFFLINE column "${col}" is NOT in headers before final merge!`);
              const siteCodeIdx = hdrs.indexOf(mainSiteCodeHeader || '');
              if (siteCodeIdx !== -1) {
                hdrs.splice(siteCodeIdx, 0, col);
                console.error(`  Added "${col}" to headers at index ${siteCodeIdx}`);
              } else {
                hdrs.push(col);
                console.error(`  Added "${col}" to end of headers`);
              }
            }
          });
          
          // CRITICAL: Add RTU-TRACKER columns using the FINAL combined list
          // This ensures RTU-TRACKER columns are ALWAYS preserved, even if they weren't added to onlineOfflineColumnsToPreserve
          finalNonOnlineOfflineColumns.forEach(col => {
            allColumnsToPreserve.add(col);
            console.log(`✓ Added RTU-TRACKER column to preserve set: "${col}"`);
            
            // Also ensure it's in columnsToInsert and onlineOfflineColumnsToPreserve
            if (!columnsToInsert.includes(col)) {
              columnsToInsert.push(col);
              console.log(`  Added RTU-TRACKER column "${col}" to columnsToInsert`);
            }
            if (!onlineOfflineColumnsToPreserve.includes(col)) {
              onlineOfflineColumnsToPreserve.push(col);
              console.log(`  Added RTU-TRACKER column "${col}" to onlineOfflineColumnsToPreserve`);
            }
            
            // Also verify it's in headers - if not, add it immediately
            if (!hdrs.includes(col)) {
              console.error(`CRITICAL: RTU-TRACKER column "${col}" is NOT in headers before final merge!`);
              const siteCodeIdx = hdrs.indexOf(mainSiteCodeHeader || '');
              if (siteCodeIdx !== -1) {
                hdrs.splice(siteCodeIdx, 0, col);
                console.error(`  Added RTU-TRACKER column "${col}" to headers at index ${siteCodeIdx}`);
              } else {
                hdrs.push(col);
                console.error(`  Added RTU-TRACKER column "${col}" to end of headers`);
              }
            }
          });
          
          // Add all columns from columnsToInsert (this should include RTU-TRACKER, but we've already added them above)
          columnsToInsert.forEach(col => {
            allColumnsToPreserve.add(col);
            console.log(`✓ Added column from columnsToInsert to preserve set: "${col}"`);
          });
          
          // Add all columns from onlineOfflineColumnsToPreserve (in case something was missed)
          onlineOfflineColumnsToPreserve.forEach(col => {
            allColumnsToPreserve.add(col);
            console.log(`✓ Added column from onlineOfflineColumnsToPreserve to preserve set: "${col}"`);
          });
          
          // CRITICAL: Double-check that ALL ONLINE-OFFLINE columns are in the set
          const missingOnlineOfflineFromSet = onlineOfflineColumnsList.filter(col => !allColumnsToPreserve.has(col));
          if (missingOnlineOfflineFromSet.length > 0) {
            console.error('CRITICAL ERROR: ONLINE-OFFLINE columns missing from preserve set:', missingOnlineOfflineFromSet);
            missingOnlineOfflineFromSet.forEach(col => {
              allColumnsToPreserve.add(col);
              console.error(`  Force-added ONLINE-OFFLINE column "${col}" to preserve set`);
            });
          }
          
          // CRITICAL: Double-check that ALL RTU-TRACKER columns are in the set
          // Use the final combined list instead of the old nonOnlineOfflineColumns
          const missingRtuTrackerFromSet = finalNonOnlineOfflineColumns.filter(col => !allColumnsToPreserve.has(col));
          if (missingRtuTrackerFromSet.length > 0) {
            console.error('CRITICAL ERROR: RTU-TRACKER columns missing from preserve set:', missingRtuTrackerFromSet);
            missingRtuTrackerFromSet.forEach(col => {
              allColumnsToPreserve.add(col);
              console.error(`  Force-added RTU-TRACKER column "${col}" to preserve set`);
            });
          }
          
          // Also check rtuTrackerColumnsList specifically
          const missingFromRtuTrackerList = rtuTrackerColumnsList.filter(col => !allColumnsToPreserve.has(col));
          if (missingFromRtuTrackerList.length > 0) {
            console.error('CRITICAL ERROR: RTU-TRACKER columns from tracked list missing from preserve set:', missingFromRtuTrackerList);
            missingFromRtuTrackerList.forEach(col => {
              allColumnsToPreserve.add(col);
              console.error(`  Force-added RTU-TRACKER column "${col}" from tracked list to preserve set`);
            });
          }
          
          // Update onlineOfflineColumnsToPreserve with the complete set
          onlineOfflineColumnsToPreserve = Array.from(allColumnsToPreserve);
          
          // FINAL VERIFICATION: Ensure ALL ONLINE-OFFLINE columns are in the preserve list
          const finalMissingOnlineOffline = onlineOfflineColumnsList.filter(col => !onlineOfflineColumnsToPreserve.includes(col));
          if (finalMissingOnlineOffline.length > 0) {
            console.error('CRITICAL ERROR: ONLINE-OFFLINE columns STILL missing from preserve list:', finalMissingOnlineOffline);
            finalMissingOnlineOffline.forEach(col => {
              onlineOfflineColumnsToPreserve.push(col);
              console.error(`  Force-added ONLINE-OFFLINE column "${col}" to preserve list`);
            });
          }
          
          // FINAL VERIFICATION: Ensure ALL RTU-TRACKER columns are in the preserve list
          // Note: finalNonOnlineOfflineColumns is already declared above (line 1396), so use a different name here
          const finalNonOnlineOfflineColumnsFromPreserve = onlineOfflineColumnsToPreserve.filter(col => !onlineOfflineColumnsList.includes(col));
          const finalMissingNonOnlineOffline = finalNonOnlineOfflineColumns.filter(col => !onlineOfflineColumnsToPreserve.includes(col));
          if (finalMissingNonOnlineOffline.length > 0) {
            console.error('CRITICAL ERROR: RTU-TRACKER columns STILL missing from preserve list:', finalMissingNonOnlineOffline);
            finalMissingNonOnlineOffline.forEach(col => {
              onlineOfflineColumnsToPreserve.push(col);
              console.error(`  Force-added RTU-TRACKER column "${col}" to preserve list`);
            });
          }
          
          console.log('Columns to preserve (final, merged):', onlineOfflineColumnsToPreserve);
          console.log('Total columns to preserve:', onlineOfflineColumnsToPreserve.length);
          console.log('ONLINE-OFFLINE columns count:', onlineOfflineColumnsList.length);
          console.log('RTU-TRACKER columns count (from combined list):', finalNonOnlineOfflineColumns.length);
          console.log('RTU-TRACKER columns (from combined list):', finalNonOnlineOfflineColumns);
          console.log('RTU-TRACKER columns count (from preserve list):', finalNonOnlineOfflineColumnsFromPreserve.length);
          console.log('RTU-TRACKER columns (from preserve list):', finalNonOnlineOfflineColumnsFromPreserve);
          
          if (finalNonOnlineOfflineColumnsFromPreserve.length === 0 && finalNonOnlineOfflineColumns.length > 0) {
            console.error('CRITICAL ERROR: RTU-TRACKER columns were found in combined list but are NOT in final preserve list!');
            console.error('This should not happen - RTU-TRACKER columns should have been added above.');
            console.error('RTU-TRACKER columns that should be in preserve list:', finalNonOnlineOfflineColumns);
            // Force add them
            finalNonOnlineOfflineColumns.forEach(col => {
              if (!onlineOfflineColumnsToPreserve.includes(col)) {
                onlineOfflineColumnsToPreserve.push(col);
                console.error(`  Force-added RTU-TRACKER column "${col}" to preserve list`);
              }
            });
          }
          
          console.log('Current headers after final merge:', hdrs);
          console.log('Current headers length after final merge:', hdrs.length);
          
          // Verify RTU-TRACKER columns are in the preserve list
          // Use finalNonOnlineOfflineColumnsFromPreserve which is already calculated from onlineOfflineColumnsToPreserve
          console.log('RTU-TRACKER columns in preserve list:', finalNonOnlineOfflineColumnsFromPreserve);
          
          // Verify all ONLINE-OFFLINE columns are in headers before reordering
          console.log('Verifying ONLINE-OFFLINE columns are in headers:');
          onlineOfflineColumnsList.forEach(col => {
            let index = hdrs.indexOf(col);
            if (index === -1) {
              index = hdrs.findIndex((h: string) => h.trim().toLowerCase() === col.trim().toLowerCase());
            }
            console.log(`  - "${col}": ${index !== -1 ? `Found at index ${index}` : 'MISSING!'}`);
          });
          
          // Verify RTU-TRACKER columns are in headers before reordering
          console.log('Verifying RTU-TRACKER columns are in headers BEFORE reordering:');
          finalNonOnlineOfflineColumnsFromPreserve.forEach((col: string) => {
            let index = hdrs.indexOf(col);
            if (index === -1) {
              index = hdrs.findIndex((h: string) => h.trim().toLowerCase() === col.trim().toLowerCase());
            }
            if (index === -1) {
              const normalizedCol = col.trim().toLowerCase().replace(/\s+/g, '');
              index = hdrs.findIndex((h: string) => {
                const normalizedH = h.trim().toLowerCase().replace(/\s+/g, '');
                return normalizedH === normalizedCol;
              });
            }
            if (index !== -1) {
              console.log(`  ✓ "${col}": Found at index ${index} (as "${hdrs[index]}")`);
            } else {
              console.error(`  ✗ "${col}": MISSING from headers before reordering!`);
            }
          });
          
          // Verify all columns in onlineOfflineColumnsToPreserve are in headers before reordering
          const missingColumns = onlineOfflineColumnsToPreserve.filter(col => {
            let index = hdrs.indexOf(col);
            if (index === -1) {
              index = hdrs.findIndex((h: string) => h.trim().toLowerCase() === col.trim().toLowerCase());
            }
            if (index === -1) {
              const normalizedCol = col.trim().toLowerCase().replace(/\s+/g, '');
              index = hdrs.findIndex((h: string) => {
                const normalizedH = h.trim().toLowerCase().replace(/\s+/g, '');
                return normalizedH === normalizedCol;
              });
            }
            return index === -1;
          });
          
          if (missingColumns.length > 0) {
            console.warn('WARNING: Some columns are missing from headers before reordering:', missingColumns);
            // Add missing columns to headers right before SITE CODE
            const siteCodeIdx = hdrs.indexOf(mainSiteCodeHeader || '');
            missingColumns.forEach(col => {
              if (siteCodeIdx !== -1) {
                hdrs.splice(siteCodeIdx, 0, col);
                console.log(`Added missing column "${col}" to headers at index ${siteCodeIdx}`);
              } else {
                hdrs.push(col);
                console.log(`Added missing column "${col}" to end of headers`);
              }
            });
            console.log('Headers after adding missing columns:', hdrs);
          }
          
          // Final verification: check that all ONLINE-OFFLINE columns are in headers
          const stillMissing = onlineOfflineColumnsList.filter(col => {
            let index = hdrs.indexOf(col);
            if (index === -1) {
              index = hdrs.findIndex((h: string) => h.trim().toLowerCase() === col.trim().toLowerCase());
            }
            return index === -1;
          });
          if (stillMissing.length > 0) {
            console.error('ERROR: ONLINE-OFFLINE columns are still missing from headers after adding:', stillMissing);
          } else {
            console.log('SUCCESS: All ONLINE-OFFLINE columns are in headers before reordering');
          }
          
          // Log headers before reordering to debug
          console.log('=== BEFORE REORDERING ===');
          console.log('Headers:', hdrs);
          console.log('Headers length:', hdrs.length);
          console.log('Columns to preserve:', onlineOfflineColumnsToPreserve);
          console.log('Columns to preserve length:', onlineOfflineColumnsToPreserve.length);
          console.log('Verifying all columns are in headers BEFORE reordering:');
          
          // Check each column using multiple matching strategies
          onlineOfflineColumnsToPreserve.forEach(col => {
            // Try exact match
            let index = hdrs.indexOf(col);
            if (index === -1) {
              // Try case-insensitive match
              index = hdrs.findIndex((h: string) => h.trim().toLowerCase() === col.trim().toLowerCase());
            }
            if (index === -1) {
              // Try fuzzy match (remove spaces)
              const normalizedCol = col.trim().toLowerCase().replace(/\s+/g, '');
              index = hdrs.findIndex((h: string) => {
                const normalizedH = h.trim().toLowerCase().replace(/\s+/g, '');
                return normalizedH === normalizedCol;
              });
            }
            
            const isOnlineOffline = onlineOfflineColumnsList.includes(col);
            const columnType = isOnlineOffline ? 'ONLINE-OFFLINE' : 'RTU-TRACKER';
            if (index !== -1) {
              console.log(`  ✓ "${col}" (${columnType}): Found at index ${index} (as "${hdrs[index]}")`);
            } else {
              console.error(`  ✗ "${col}" (${columnType}): NOT FOUND in headers!`);
              console.error(`    Available headers:`, hdrs);
              // Add missing column to headers before reordering
              const siteCodeIdx = hdrs.indexOf(mainSiteCodeHeader || '');
              if (siteCodeIdx !== -1) {
                hdrs.splice(siteCodeIdx, 0, col);
                console.log(`    Added missing ${columnType} column "${col}" to headers at index ${siteCodeIdx}`);
              } else {
                hdrs.push(col);
                console.log(`    Added missing ${columnType} column "${col}" to end of headers`);
              }
            }
          });
          
          console.log('Headers after adding missing columns:', hdrs);
          
          hdrs = reorderHeaders(hdrs, onlineOfflineColumnsToPreserve);
          
          // Log headers after reordering to debug
          console.log('=== AFTER REORDERING ===');
          console.log('Headers:', hdrs);
          console.log('Headers length:', hdrs.length);
          console.log('Verifying all columns are still in headers AFTER reordering:');
          onlineOfflineColumnsToPreserve.forEach(col => {
            // Try multiple matching strategies
            let index = hdrs.indexOf(col);
            if (index === -1) {
              index = hdrs.findIndex((h: string) => h.trim().toLowerCase() === col.trim().toLowerCase());
            }
            if (index === -1) {
              const normalizedCol = col.trim().toLowerCase().replace(/\s+/g, '');
              index = hdrs.findIndex((h: string) => {
                const normalizedH = h.trim().toLowerCase().replace(/\s+/g, '');
                return normalizedH === normalizedCol;
              });
            }
            
            if (index !== -1) {
              console.log(`  ✓ "${col}": Found at index ${index} (as "${hdrs[index]}")`);
            } else {
              console.error(`  ✗ "${col}": MISSING after reordering!`);
              // This is a critical error - add it back
              hdrs.push(col);
              console.error(`    Added "${col}" back to headers`);
            }
          });
          
          // Remove duplicate SL.No columns, keeping only the first one
          const removeDuplicateSLNoColumns = (headers: string[]): string[] => {
            const normalizeHeader = (h: string) => h.trim().toLowerCase();
            const isSLNoColumn = (h: string): boolean => {
              const normalized = normalizeHeader(h);
              return normalized === 'slno' || 
                     normalized === 'sl_no' || 
                     normalized === 'sl no' || 
                     normalized === 's.no' || 
                     normalized === 's no' || 
                     normalized === 'serial' || 
                     normalized === 'serialno' || 
                     normalized === 'serial_no' || 
                     normalized === 'serial no' ||
                     (normalized.includes('sl') && normalized.includes('no')) ||
                     (normalized.includes('s') && normalized.includes('no') && normalized.includes('.')) ||
                     normalized === 'sl.no' ||
                     normalized === 'sl.no.' ||
                     normalized.startsWith('sl.') ||
                     normalized.startsWith('s.no');
            };
            
            const seen: Set<string> = new Set();
            const result: string[] = [];
            let firstSLNoFound = false;
            
            headers.forEach(header => {
              const normalized = normalizeHeader(header);
              if (isSLNoColumn(header)) {
                if (!firstSLNoFound) {
                  // Keep the first SL.No column
                  result.push(header);
                  seen.add(normalized);
                  firstSLNoFound = true;
                  console.log('Keeping first SL.No column:', header);
                } else {
                  // Skip duplicate SL.No columns
                  console.log('Removing duplicate SL.No column:', header);
                }
              } else {
                // Keep all non-SL.No columns
                result.push(header);
              }
            });
            
            return result;
          };
          
          // Remove duplicate SL.No columns
          const originalHeadersCount = hdrs.length;
          hdrs = removeDuplicateSLNoColumns(hdrs);
          const removedCount = originalHeadersCount - hdrs.length;
          
          if (removedCount > 0) {
            // Find which headers were removed (duplicate SL.No columns)
            const removedSLNoColumns: string[] = [];
            const normalizeHeader = (h: string) => h.trim().toLowerCase();
            const isSLNoColumn = (h: string): boolean => {
              const normalized = normalizeHeader(h);
              return normalized === 'slno' || 
                     normalized === 'sl_no' || 
                     normalized === 'sl no' || 
                     normalized === 's.no' || 
                     normalized === 's no' || 
                     normalized === 'serial' || 
                     normalized === 'serialno' || 
                     normalized === 'serial_no' || 
                     normalized === 'serial no' ||
                     (normalized.includes('sl') && normalized.includes('no')) ||
                     (normalized.includes('s') && normalized.includes('no') && normalized.includes('.')) ||
                     normalized === 'sl.no' ||
                     normalized === 'sl.no.' ||
                     normalized.startsWith('sl.') ||
                     normalized.startsWith('s.no');
            };
            
            // Find all SL.No columns in the current headers before removal
            // We need to check all possible headers (from fileRows) to find duplicates
            if (fileRows.length > 0) {
              const allPossibleHeaders = Object.keys(fileRows[0]);
              const allSLNoColumns = allPossibleHeaders.filter((h: string) => isSLNoColumn(h));
              
              // Keep only the first SL.No column, remove the rest
              if (allSLNoColumns.length > 1) {
                const firstSLNoColumn = allSLNoColumns[0];
                removedSLNoColumns.push(...allSLNoColumns.slice(1));
                
                console.log(`Found ${allSLNoColumns.length} SL.No columns. Keeping: ${firstSLNoColumn}, Removing:`, removedSLNoColumns);
                
                // Remove duplicate SL.No columns from rows
                fileRows = fileRows.map((row: any) => {
                  const cleanedRow = { ...row };
                  removedSLNoColumns.forEach(col => {
                    delete cleanedRow[col];
                  });
                  return cleanedRow;
                });
                
                console.log(`Cleaned ${removedSLNoColumns.length} duplicate SL.No columns from rows`);
              }
            }
            
            console.log('Remaining headers after removing duplicates:', hdrs);
          }
          
          // Update both allRows and rows with the cleaned data
          // Final verification: Ensure all columns in headers exist in rows
          console.log('=== FINAL VERIFICATION BEFORE SETTING STATE ===');
          console.log('Headers:', hdrs);
          console.log('Headers count:', hdrs.length);
          console.log('Rows count:', fileRows.length);
          
          // Check if all headers have corresponding data in rows
          const missingColumnsInRows: string[] = [];
          hdrs.forEach((header: string) => {
            const hasColumn = fileRows.length === 0 || fileRows[0].hasOwnProperty(header);
            if (!hasColumn) {
              missingColumnsInRows.push(header);
              console.warn(`Column "${header}" is in headers but missing from rows`);
            }
          });
          
          // Add missing columns to rows with empty values
          if (missingColumnsInRows.length > 0) {
            console.log('Adding missing columns to rows:', missingColumnsInRows);
            fileRows = fileRows.map((row: any) => {
              const updatedRow = { ...row };
              missingColumnsInRows.forEach(col => {
                if (!updatedRow.hasOwnProperty(col)) {
                  updatedRow[col] = '';
                }
              });
              return updatedRow;
            });
            console.log('Rows updated with missing columns');
          }
          
          // Verify ONLINE-OFFLINE and RTU-TRACKER columns are in headers
          console.log('=== VERIFYING ALL COLUMNS IN FINAL HEADERS ===');
          console.log('Verifying ONLINE-OFFLINE columns in final headers:');
          onlineOfflineColumnsList.forEach(col => {
            const index = hdrs.indexOf(col);
            console.log(`  - ONLINE-OFFLINE "${col}": ${index !== -1 ? `Found at index ${index}` : 'MISSING!'}`);
            if (index === -1) {
              console.error(`    CRITICAL: ONLINE-OFFLINE column "${col}" is MISSING from final headers!`);
            }
          });
          
          // Get RTU-TRACKER columns (non-ONLINE-OFFLINE columns)
          // These are columns in onlineOfflineColumnsToPreserve but NOT in onlineOfflineColumnsList
          const nonOnlineOfflineColumnsInFinalHeaders = onlineOfflineColumnsToPreserve.filter(col => 
            !onlineOfflineColumnsList.includes(col)
          );
          
          console.log('=== VERIFYING RTU-TRACKER COLUMNS IN FINAL HEADERS ===');
          console.log('RTU-TRACKER columns to verify:', nonOnlineOfflineColumnsInFinalHeaders);
          console.log('ONLINE-OFFLINE columns list (to exclude):', onlineOfflineColumnsList);
          console.log('All preserved columns:', onlineOfflineColumnsToPreserve);
          console.log('Current headers:', hdrs);
          console.log('Current headers count:', hdrs.length);
          
          if (nonOnlineOfflineColumnsInFinalHeaders.length === 0) {
            console.error('✗ ERROR: No RTU-TRACKER columns found in preserve list!');
            console.error('  This might mean:');
            console.error('    1. RTU-TRACKER columns were not added to onlineOfflineColumnsToPreserve');
            console.error('    2. RTU-TRACKER columns were lost during processing');
            console.error('    3. RTU-TRACKER files were not processed correctly');
            console.error('  Columns in columnsToInsert:', columnsToInsert);
            console.error('  Columns in onlineOfflineColumnsToPreserve:', onlineOfflineColumnsToPreserve);
            console.error('  ONLINE-OFFLINE columns:', onlineOfflineColumnsList);
          } else {
            console.log(`✓ Found ${nonOnlineOfflineColumnsInFinalHeaders.length} RTU-TRACKER column(s) to verify`);
          }
          
          // Verify each RTU-TRACKER column
          nonOnlineOfflineColumnsInFinalHeaders.forEach(col => {
            // Try multiple matching strategies
            let index = hdrs.indexOf(col);
            if (index === -1) {
              index = hdrs.findIndex((h: string) => h.trim().toLowerCase() === col.trim().toLowerCase());
            }
            if (index === -1) {
              const normalizedCol = col.trim().toLowerCase().replace(/\s+/g, '');
              index = hdrs.findIndex((h: string) => {
                const normalizedH = h.trim().toLowerCase().replace(/\s+/g, '');
                return normalizedH === normalizedCol;
              });
            }
            
            if (index !== -1) {
              console.log(`  ✓ "${col}" (RTU-TRACKER): Found at index ${index} (as "${hdrs[index]}")`);
            } else {
              console.error(`  ✗ "${col}" (RTU-TRACKER): MISSING from headers!`);
              console.error(`    CRITICAL: RTU-TRACKER column "${col}" is NOT in final headers!`);
              console.error(`    Available headers:`, hdrs);
              // Add missing RTU-TRACKER column to headers
              const siteCodeIdx = hdrs.indexOf(mainSiteCodeHeader || '');
              if (siteCodeIdx !== -1) {
                hdrs.splice(siteCodeIdx, 0, col);
                console.error(`    Added missing RTU-TRACKER column "${col}" to headers at index ${siteCodeIdx}`);
              } else {
                hdrs.push(col);
                console.error(`    Added missing RTU-TRACKER column "${col}" to end of headers`);
              }
            }
          });
          
          // Verify all preserved columns are in headers
          console.log('=== VERIFYING ALL PRESERVED COLUMNS IN FINAL HEADERS ===');
          console.log('Total preserved columns:', onlineOfflineColumnsToPreserve.length);
          console.log('ONLINE-OFFLINE columns:', onlineOfflineColumnsList.length);
          console.log('RTU-TRACKER columns:', nonOnlineOfflineColumnsInFinalHeaders.length);
          
          onlineOfflineColumnsToPreserve.forEach(col => {
            const index = hdrs.indexOf(col);
            const isOnlineOffline = onlineOfflineColumnsList.includes(col);
            const columnType = isOnlineOffline ? 'ONLINE-OFFLINE' : 'RTU-TRACKER';
            
            if (index === -1) {
              console.error(`ERROR: Column "${col}" (${columnType}) is MISSING from headers!`);
              // Try to add it back
              const siteCodeIdx = hdrs.indexOf(mainSiteCodeHeader || '');
              if (siteCodeIdx !== -1) {
                hdrs.splice(siteCodeIdx, 0, col);
                console.error(`  Added missing column "${col}" to headers at index ${siteCodeIdx}`);
              } else {
                hdrs.push(col);
                console.error(`  Added missing column "${col}" to end of headers`);
              }
            } else {
              console.log(`  ✓ "${col}" (${columnType}): Found at index ${index}`);
            }
          });
          
          // CRITICAL: Verify RTU-TRACKER columns specifically
          console.log('=== FINAL RTU-TRACKER VERIFICATION ===');
          console.log('RTU-TRACKER columns that should be in headers:', nonOnlineOfflineColumnsInFinalHeaders);
          console.log('Verifying each RTU-TRACKER column is in headers:');
          nonOnlineOfflineColumnsInFinalHeaders.forEach(col => {
            const inHeaders = hdrs.includes(col);
            const index = hdrs.indexOf(col);
            console.log(`  - "${col}": ${inHeaders ? `Found at index ${index}` : 'MISSING!'}`);
            if (!inHeaders) {
              console.error(`    CRITICAL: RTU-TRACKER column "${col}" is MISSING from final headers!`);
              // Add it immediately
              const siteCodeIdx = hdrs.indexOf(mainSiteCodeHeader || '');
              if (siteCodeIdx !== -1) {
                hdrs.splice(siteCodeIdx, 0, col);
                console.error(`    Added missing RTU-TRACKER column "${col}" to headers at index ${siteCodeIdx}`);
              } else {
                hdrs.push(col);
                console.error(`    Added missing RTU-TRACKER column "${col}" to end of headers`);
              }
            }
          });
          
          console.log('Final headers before setting state:', hdrs);
          console.log('Final headers length:', hdrs.length);
          console.log('Expected columns count:', onlineOfflineColumnsToPreserve.length);
          
          // Filter rows where RTU L/R SWITCH STATUS = "RTU LOCAL"
          // NOTE: We do NOT filter by DEVICE STATUS = OFFLINE - all rows are included regardless of DEVICE STATUS
          // Find "RTU L/R SWITCH STATUS" key - handle variations
          const normalize = (str: string): string => str.trim().toLowerCase();
          const rtuSwitchStatusKey = hdrs.find((h: string) => {
            const norm = normalize(h);
            return (norm.includes('rtu') && norm.includes('l') && norm.includes('r') && norm.includes('switch') && norm.includes('status')) ||
                   norm === 'rtul/rswitchstatus' || norm === 'rtu_l_r_switch_status' || 
                   norm === 'rtu l/r switch status' || norm === 'rtulrswitchstatus' ||
                   (norm.includes('rtu') && norm.includes('switch') && norm.includes('status')) ||
                   norm === 'rtuswitchstatus' || norm === 'rtu_switch_status';
          });
          
          // Start with all fileRows - do NOT filter by DEVICE STATUS = OFFLINE
          let filteredRows = fileRows;
          if (rtuSwitchStatusKey) {
            const beforeFilterCount = filteredRows.length;
            
            filteredRows = filteredRows.filter((row: any) => {
              const status = String(row[rtuSwitchStatusKey] || '').trim();
              // Normalize to handle variations: RTU LOCAL, RTU_LOCAL, RTULOCAL, rtu local, etc.
              const normalizedStatus = normalize(status);
              const matches = normalizedStatus === 'rtu local' || 
                              normalizedStatus === 'rtu_local' || 
                              normalizedStatus === 'rtulocal' ||
                              (normalizedStatus.includes('rtu') && normalizedStatus.includes('local'));
              return matches;
            });
            
            console.log(`MY RTU LOCAL - RTU L/R SWITCH STATUS filter: ${beforeFilterCount} rows -> ${filteredRows.length} rows (filtering for RTU LOCAL)`);
          } else {
            console.warn('MY RTU LOCAL - RTU L/R SWITCH STATUS column not found in data headers:', hdrs);
            console.warn('MY RTU LOCAL - Available headers:', hdrs);
          }
          
          // Filter by user's assigned DIVISION for RTU/Communication role
          if (userRole === 'RTU/Communication') {
            // Find division key - handle variations like "DIVISION", "DIVISION NAME", etc.
            const divisionKey = hdrs.find((h: string) => {
              const norm = normalize(h);
              return norm === 'division' || norm === 'divisionname' || norm === 'division name';
            });
            
            if (!divisionKey) {
              console.warn('MY RTU LOCAL - DIVISION column not found in data headers:', hdrs);
            } else if (userDivisions.length === 0) {
              console.warn('MY RTU LOCAL - User has no divisions assigned. User object:', user);
            } else {
              const beforeCount = filteredRows.length;
              console.log(`MY RTU LOCAL - Applying division filter (${userRole} role):`, {
                divisionKey,
                userDivisions,
                beforeCount
              });
              
              // Sample some divisions from data for debugging
              const sampleDivisions = Array.from(new Set(filteredRows.slice(0, 10).map((r: any) => String(r[divisionKey] || '').trim()))).filter(Boolean);
              console.log('MY RTU LOCAL - Sample divisions in data:', sampleDivisions);
              
              filteredRows = filteredRows.filter((row: any) => {
                const rowDivision = String(row[divisionKey] || '').trim();
                // Check if row's division matches any of user's assigned divisions (case-insensitive)
                // Handles variations like JAYANAGARA vs JAYANAGAR
                const matches = userDivisions.some((div: string) => {
                  const userDiv = normalize(String(div));
                  const dataDiv = normalize(rowDivision);
                  
                  // Exact match
                  if (userDiv === dataDiv) {
                    return true;
                  }
                  
                  // Check if one contains the other (handles JAYANAGARA vs JAYANAGAR)
                  // Only match if both are similar length (avoid false matches)
                  const lengthDiff = Math.abs(userDiv.length - dataDiv.length);
                  if (lengthDiff <= 1 && (userDiv.includes(dataDiv) || dataDiv.includes(userDiv))) {
                    return true;
                  }
                  
                  return false;
                });
                return matches;
              });
              
              console.log(`MY RTU LOCAL - Division filter applied: ${beforeCount} rows -> ${filteredRows.length} rows`);
              console.log(`MY RTU LOCAL - User divisions: [${userDivisions.map((d: string) => `"${d}"`).join(', ')}]`);
            }
          }
          
          // Add the five columns at the end: Site Observations, Task Status, Type of Issue, View Photos, Remarks
          const columnsToAdd = ['Site Observations', 'Task Status', 'Type of Issue', 'View Photos', 'Remarks'];
          columnsToAdd.forEach((col: string) => {
            if (!hdrs.includes(col)) {
              hdrs.push(col);
            }
          });
          
          // Filter out old date columns, keep only the latest date column
          const parseDateFromColumnName = (columnName: string): Date | null => {
            const datePatterns = [
              /(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/, // DD-MM-YYYY or DD/MM/YYYY
              /(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/, // YYYY-MM-DD or YYYY/MM/DD
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
          
          // Find all date columns in headers
          const allDateColumns: Array<{ name: string; date: Date; index: number }> = [];
          hdrs.forEach((h: string, index: number) => {
            const normalized = h.trim().toLowerCase();
            const hasDateKeyword = normalized.includes('date') || normalized.includes('time');
            if (hasDateKeyword) {
              const date = parseDateFromColumnName(h);
              if (date && !isNaN(date.getTime())) {
                allDateColumns.push({ name: h, date, index });
              }
            }
          });
          
          // Find the latest date column
          let latestDateColumnName: string | null = null;
          if (allDateColumns.length > 0) {
            allDateColumns.sort((a, b) => b.date.getTime() - a.date.getTime()); // Latest first
            latestDateColumnName = allDateColumns[0].name;
            console.log('MY RTU LOCAL - Latest date column found:', latestDateColumnName);
            console.log('MY RTU LOCAL - All date columns:', allDateColumns.map(d => ({ name: d.name, date: d.date.toLocaleDateString() })));
            
            // Remove all date columns except the latest one
            const dateColumnsToRemove = allDateColumns.filter(d => d.name !== latestDateColumnName);
            console.log('MY RTU LOCAL - Removing old date columns:', dateColumnsToRemove.map(d => d.name));
            
            // Remove old date columns from headers
            dateColumnsToRemove.forEach(col => {
              const index = hdrs.indexOf(col.name);
              if (index !== -1) {
                hdrs.splice(index, 1);
              }
            });
            
            // Remove old date columns from rows
            filteredRows = filteredRows.map((row: any) => {
              const newRow = { ...row };
              dateColumnsToRemove.forEach(col => {
                delete newRow[col.name];
              });
              return newRow;
            });
            
            console.log('MY RTU LOCAL - Removed', dateColumnsToRemove.length, 'old date column(s), kept latest:', latestDateColumnName);
          }
          
          // Remove specific columns for RTU/Communication role
          if (userRole === 'RTU/Communication') {
            const columnsToRemove = [
              'CIRCLE',
              'DEVICE TYPE',
              'EQUIPMENT MAKE',
              'ATTRIBUTE',
              'EQUIPMENT L/R SWITCH STATUS',
              'NO OF DAYS OFFLINE',
              'PRODUCTION OBSERVATIONS',
              'RTU TRACKER OBSERVATION'
            ];
            
            // Normalize function for case-insensitive matching (handles spaces, underscores, hyphens)
            const normalize = (str: string): string => {
              return str.trim().toLowerCase()
                .replace(/[_\-\s]+/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            };
            
            // Find and remove columns (case-insensitive matching with variations)
            const columnsToRemoveFromHeaders: string[] = [];
            hdrs.forEach((header: string) => {
              const normalizedHeader = normalize(header);
              const shouldRemove = columnsToRemove.some(col => {
                const normalizedCol = normalize(col);
                // Exact match after normalization
                if (normalizedHeader === normalizedCol) {
                  return true;
                }
                // Handle variations for EQUIPMENT L/R SWITCH STATUS
                if (normalizedCol.includes('equipment') && normalizedCol.includes('l') && normalizedCol.includes('r') && normalizedCol.includes('switch')) {
                  if (normalizedHeader.includes('equipment') && normalizedHeader.includes('l') && normalizedHeader.includes('r') && normalizedHeader.includes('switch')) {
                    return true;
                  }
                }
                // Handle variations for DEVICE TYPE
                if (normalizedCol.includes('device') && normalizedCol.includes('type')) {
                  if (normalizedHeader.includes('device') && normalizedHeader.includes('type')) {
                    return true;
                  }
                }
                // Handle variations for EQUIPMENT MAKE
                if (normalizedCol.includes('equipment') && normalizedCol.includes('make')) {
                  if (normalizedHeader.includes('equipment') && normalizedHeader.includes('make')) {
                    return true;
                  }
                }
                // Handle variations for NO OF DAYS OFFLINE
                if (normalizedCol.includes('no') && normalizedCol.includes('days') && normalizedCol.includes('offline')) {
                  if (normalizedHeader.includes('no') && normalizedHeader.includes('days') && normalizedHeader.includes('offline')) {
                    return true;
                  }
                }
                // Handle variations for PRODUCTION OBSERVATIONS
                if (normalizedCol.includes('production') && normalizedCol.includes('observations')) {
                  if (normalizedHeader.includes('production') && normalizedHeader.includes('observations')) {
                    return true;
                  }
                }
                // Handle variations for RTU TRACKER OBSERVATION
                if (normalizedCol.includes('rtu') && normalizedCol.includes('tracker') && normalizedCol.includes('observation')) {
                  if (normalizedHeader.includes('rtu') && normalizedHeader.includes('tracker') && normalizedHeader.includes('observation')) {
                    return true;
                  }
                }
                return false;
              });
              
              if (shouldRemove) {
                columnsToRemoveFromHeaders.push(header);
              }
            });
            
            // Remove columns from headers
            columnsToRemoveFromHeaders.forEach(col => {
              const index = hdrs.indexOf(col);
              if (index !== -1) {
                hdrs.splice(index, 1);
                console.log('MY RTU LOCAL - Removed column for RTU/Communication role:', col);
              }
            });
            
            // Remove columns from rows
            filteredRows = filteredRows.map((row: any) => {
              const newRow = { ...row };
              columnsToRemoveFromHeaders.forEach(col => {
                delete newRow[col];
              });
              return newRow;
            });
            
            console.log('MY RTU LOCAL - Removed', columnsToRemoveFromHeaders.length, 'column(s) for RTU/Communication role');
            console.log('MY RTU LOCAL - Removed columns:', columnsToRemoveFromHeaders);
          }
          
          // Remove RTU TRACKER OBSERVATION/OBSERBATION column for all users in MY RTU LOCAL
          // Note: Handle both "OBSERVATION" (correct spelling) and "OBSERBATION" (typo in data)
          const normalizeForRtuTracker = (str: string): string => {
            return str.trim().toLowerCase()
              .replace(/[_\-\s]+/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
          };
          
          const rtuTrackerObservationColumns: string[] = [];
          hdrs.forEach((header: string) => {
            const normalizedHeader = normalizeForRtuTracker(header);
            // Check if header matches RTU TRACKER OBSERVATION or OBSERBATION (case-insensitive, handles variations)
            // Handle both correct spelling "observation" and typo "obserbation"
            const hasRtuTracker = normalizedHeader.includes('rtu') && normalizedHeader.includes('tracker');
            const hasObservation = normalizedHeader.includes('observation') || normalizedHeader.includes('obserbation');
            
            if (hasRtuTracker && hasObservation) {
              rtuTrackerObservationColumns.push(header);
            } else if (normalizedHeader === 'rtu tracker observation' || 
                       normalizedHeader === 'rtu tracker obserbation' ||
                       normalizedHeader === 'rtu_tracker_observation' ||
                       normalizedHeader === 'rtu_tracker_obserbation' ||
                       normalizedHeader === 'rtutrackerobservation' ||
                       normalizedHeader === 'rtutrackerobserbation') {
              rtuTrackerObservationColumns.push(header);
            }
          });
          
          // Remove RTU TRACKER OBSERVATION columns from headers
          rtuTrackerObservationColumns.forEach(col => {
            const index = hdrs.indexOf(col);
            if (index !== -1) {
              hdrs.splice(index, 1);
              console.log('MY RTU LOCAL - Removed RTU TRACKER OBSERVATION column:', col);
            }
          });
          
          // Remove RTU TRACKER OBSERVATION columns from rows
          if (rtuTrackerObservationColumns.length > 0) {
            filteredRows = filteredRows.map((row: any) => {
              const newRow = { ...row };
              rtuTrackerObservationColumns.forEach(col => {
                delete newRow[col];
              });
              return newRow;
            });
            console.log('MY RTU LOCAL - Removed', rtuTrackerObservationColumns.length, 'RTU TRACKER OBSERVATION column(s) for all users');
          }
          
          setRows(filteredRows);
          
          setHeaders(hdrs);
          setCurrentPage(1);
          
          // Load saved data from localStorage
          const storageKey = `myRTULocal_${selectedFile}`;
          try {
            const savedData = localStorage.getItem(storageKey);
            if (savedData) {
              const parsed = JSON.parse(savedData);
              if (parsed.siteObservations) setSiteObservations(parsed.siteObservations);
              if (parsed.taskStatus) setTaskStatus(parsed.taskStatus);
              if (parsed.typeOfIssue) setTypeOfIssue(parsed.typeOfIssue);
              if (parsed.viewPhotos) setViewPhotos(parsed.viewPhotos);
              if (parsed.remarks) setRemarks(parsed.remarks);
              if (parsed.photoMetadata) setPhotoMetadata(parsed.photoMetadata);
            }
          } catch (error) {
            console.error('Error loading from localStorage:', error);
          }
          
          console.log('State set successfully');
        }
      } catch (error) {
        console.error('Error fetching file data:', error);
        setRows([]);
        setHeaders([]);
      }
    })();
  }, [selectedFile, userRole, userDivisions, user]);

  // Build filter lists
  // Resolve which actual header key exists for each filter
  // Robust case-insensitive, trimmed header matching
  const resolvedKeys: Record<string, string | undefined> = {};
  FILTER_DEFS.forEach(def => {
    resolvedKeys[def.label] = headers.find((h: string) => def.keys.map(normalize).includes(normalize(h)));
  });

  const filterOptions: Record<string, string[]> = {};
  FILTER_DEFS.forEach(def => {
    const key = resolvedKeys[def.label];
    if (!key) { filterOptions[def.label] = []; return; }
    filterOptions[def.label] = Array.from(new Set(rows.map(r => String(r[key] ?? "")).filter(Boolean)));
  });

  // Apply filters (all ANDed)
  const filteredRows = rows.filter(row =>
    FILTER_DEFS.every(def => {
      const key = resolvedKeys[def.label];
      if (!key) return true; // if that column not present, don't filter
      const val = filters[def.label];
      return !val || String(row[key]) === val;
    })
  );

  // Search within filtered
  const searchedRows = search
    ? filteredRows.filter(row =>
        Object.values(row).some(v => String(v).toLowerCase().includes(search.toLowerCase()))
      )
    : filteredRows;

  // Sort rows by date (newest first) - use _id if available (MongoDB ObjectIds contain timestamp)
  const sortedRows = [...searchedRows].sort((a, b) => {
    const aDate = a._id || a.id || '';
    const bDate = b._id || b.id || '';
    
    if (aDate && bDate) {
      return bDate.localeCompare(aDate);
    }
    
    if (aDate && !bDate) return -1;
    if (!aDate && bDate) return 1;
    
    return 0;
  });

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / rowsPerPage));
  const paginatedRows = sortedRows.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  useEffect(() => { setCurrentPage(1); }, [rowsPerPage, rows.length, search]);

  // Handle video element for Site Observations camera stream
  useEffect(() => {
    if (siteObservationsCameraStream && showSiteObservationsCameraPreview) {
      const video = document.getElementById('site-observations-camera-preview-video') as HTMLVideoElement;
      if (video) {
        video.srcObject = siteObservationsCameraStream;
        siteObservationsCameraStreamRef.current = siteObservationsCameraStream;
      }
    } else if (siteObservationsCameraStreamRef.current && !showSiteObservationsCameraPreview) {
      siteObservationsCameraStreamRef.current.getTracks().forEach(track => track.stop());
      siteObservationsCameraStreamRef.current = null;
    }
    
    return () => {
      if (siteObservationsCameraStreamRef.current) {
        siteObservationsCameraStreamRef.current.getTracks().forEach(track => track.stop());
        siteObservationsCameraStreamRef.current = null;
      }
    };
  }, [siteObservationsCameraStream, showSiteObservationsCameraPreview]);


  // Downloads
  function downloadCSV() {
    if (!headers.length) return;
    const csvRows = [headers.join(',')].concat(
      sortedRows.map(r => headers.map((h: string) => `"${String(r[h] ?? '').replace(/"/g,'""')}"`).join(','))
    );
    const blob = new Blob([csvRows.join('\n')], {type: 'text/csv'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = (uploadedFiles.find(f=>f.id===selectedFile)?.name||'data') + '.csv';
    link.click(); URL.revokeObjectURL(url);
  }

  function downloadXLSX() {
    if (!headers.length) return;
    const aoa = [headers, ...sortedRows.map(r => headers.map((h: string) => r[h] ?? ''))];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.writeFile(wb, (uploadedFiles.find(f=>f.id===selectedFile)?.name||'data') + '.xlsx');
  }

  function downloadPDF() {
    if (!headers.length) return;
    const w = window.open('', '_blank');
    if (!w) return;

    const title = 'MY RTU LOCAL Export';
    const fileName = (uploadedFiles.find(f=>f.id===selectedFile)?.name||'data');
    const colPercent = (100 / Math.max(1, headers.length)).toFixed(2);
    
    // Get user information
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const userName = currentUser?.fullName || currentUser?.userId || 'Unknown User';
    const userRole = currentUser?.role || getCurrentUserRole() || 'Unknown Role';
    const userDesignation = currentUser?.designation || currentUser?.Designation || 'N/A';
    const downloadTime = new Date().toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    const styles = `
      @page { 
        size: A4 landscape; 
        margin: 8mm;
      }
      body { 
        font-family: "Times New Roman", serif;
        margin: 0;
        padding: 10px;
      }
      .header-section {
        margin-bottom: 10px;
        padding-bottom: 8px;
        border-bottom: 2px solid #3b82f6;
      }
      h3 { 
        margin: 0 0 5px 0; 
        color: #1e40af;
        font-size: 16px;
      }
      .meta { 
        font-size: 10px; 
        color: #475569; 
        margin: 0 0 5px 0; 
      }
      .user-info {
        font-size: 10px;
        color: #0f172a;
        margin-top: 5px;
        padding: 5px;
        background-color: #f0f9ff;
        border-left: 3px solid #3b82f6;
      }
      .user-info strong {
        color: #1e40af;
      }
      table { 
        width: 100%; 
        border-collapse: collapse; 
        table-layout: fixed;
        margin-top: 10px;
      }
      th, td { 
        border: 1px solid #94a3b8; 
        padding: 6px 6px; 
        text-align: center; 
        font-size: 10px; 
        word-wrap: break-word; 
        white-space: normal; 
        width: ${colPercent}%; 
      }
      thead th { 
        font-weight: 700; 
        color: #ffffff; 
        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%);
        border: 1px solid #1e40af;
        padding: 8px 6px;
      }
      tbody tr:nth-child(even) { 
        background-color: #f0f9ff; 
      }
      tbody tr:nth-child(odd) { 
        background-color: #ffffff; 
      }
      tbody td { 
        color: #0f172a; 
      }
      .table-wrap { 
        width: 100%; 
      }
      .footer {
        margin-top: 10px;
        padding-top: 8px;
        border-top: 2px solid #3b82f6;
        font-size: 9px;
        color: #64748b;
        text-align: center;
      }
    `;

    const thead = `<tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr>`;
    const tbody = sortedRows.map((r, idx)=>{
      const isEven = idx % 2 === 0;
      return `<tr style="background-color: ${isEven ? '#f0f9ff' : '#ffffff'}">${headers.map(h=>`<td>${String(r[h]??'')}</td>`).join('')}</tr>`;
    }).join('');

    w.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <meta charset="utf-8" />
          <style>${styles}</style>
        </head>
        <body>
          <div class="header-section">
            <h3>${title}</h3>
            <div class="meta">File: ${fileName}</div>
            <div class="user-info">
              <strong>Downloaded by:</strong> ${userName} &nbsp;|&nbsp; 
              <strong>Role:</strong> ${userRole} &nbsp;|&nbsp; 
              <strong>Designation:</strong> ${userDesignation} &nbsp;|&nbsp; 
              <strong>Date & Time:</strong> ${downloadTime}
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead>${thead}</thead>
              <tbody>${tbody}</tbody>
            </table>
          </div>
          <div class="footer">
            Generated on ${downloadTime} | ${userName} (${userRole}, ${userDesignation})
          </div>
        </body>
      </html>
    `);
    w.document.close();
    w.focus();
    w.print();
  }

  function handleDownloadSelect(val: string) {
    if (!val) return;
    if (val === 'pdf') downloadPDF();
    if (val === 'xlsx') downloadXLSX();
    if (val === 'csv') downloadCSV();
  }

  if (!uploadedFiles.length) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold mb-2 text-gray-800">MY RTU LOCAL</h2>
        <p className="text-gray-500">No files uploaded yet. Please upload from Upload tab.</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">MY RTU LOCAL</h2>
      {/* Controls Row */}
      <div className="flex flex-wrap gap-2 md:gap-4 items-center mb-3 whitespace-nowrap inline-flex">
        <input
          className="border border-gray-300 border-[1px] rounded px-2 py-1 flex-1 min-w-[120px]"
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          disabled={!selectedFile}
        />
        {/* Download format select */}
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
      {/* Filters Row */}
      <div className="flex flex-wrap gap-8 items-center mb-6">
        {FILTER_DEFS.map(def => {
          const key = resolvedKeys[def.label];
          if (!key) return null;
          return (
            <div key={def.label} className="flex items-center gap-2">
              <label className="text-gray-700 text-sm font-medium">{def.label}:</label>
              <select
                className="border border-gray-300 rounded px-2 py-1 min-w-[140px] text-sm"
                value={filters[def.label] || ""}
                onChange={e => setFilters(prev => ({ ...prev, [def.label]: e.target.value }))}
              >
                <option value="">All</option>
                {filterOptions[def.label].map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
      <div className="overflow-auto border rounded-lg shadow bg-white max-h-[70vh]">
        <table
          className="min-w-full border border-gray-300"
          style={{ fontFamily: 'Times New Roman, Times, serif', borderCollapse: 'collapse', tableLayout: 'auto' }}
        >
          <thead style={{ fontFamily: 'Times New Roman, Times, serif', fontSize: 14, position: 'sticky', top: 0, zIndex: 10 }}>
            <tr style={{ background: 'linear-gradient(90deg, #dbeafe 0%, #bae6fd 100%)' }}>
              {headers.map((h: string) => (
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
            {paginatedRows.map((row, idx) => {
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
                    e.currentTarget.style.backgroundColor = isEven ? '#f0f9ff' : '#ffffff';
                  }}
                >
                {headers.map((h: string) => {
                  // Create a stable row key using selectedFile and row data
                  const rowKey = generateRowKey(selectedFile, row, headers);
                  
                  // Handle SL NO column - calculate sequential number starting from 1
                  const normalizedH = h.trim().toLowerCase();
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
                  
                  // Site Observations column
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
                            setSiteObservations(prev => ({ ...prev, [rowKey]: selectedValue }));
                            siteObservationsRef.current = { ...siteObservationsRef.current, [rowKey]: selectedValue };
                            
                            if (selectedValue.toLowerCase() === 'resolved' || selectedValue.toLowerCase() === 'pending') {
                              // Open dialog immediately
                              setSelectedSiteObservationRowKey(rowKey);
                              setSiteObservationsStatus(selectedValue.toLowerCase());
                              
                              // Pre-populate dialog data from existing data
                              const existingTypeOfIssue = typeOfIssue[rowKey] || '';
                              const existingRemarks = remarks[rowKey] || '';
                              
                              setSiteObservationsDialogData({
                                remarks: existingRemarks,
                                typeOfIssue: existingTypeOfIssue,
                                specifyOther: '',
                                typeOfSpare: [],
                                specifySpareOther: '',
                                capturedPhotos: [],
                                uploadedPhotos: [],
                                uploadedDocuments: []
                              });
                              setIsTypeOfSpareDropdownOpen(false);
                              
                              // Small delay to ensure state is updated before opening dialog
                              setTimeout(() => {
                                setShowSiteObservationsDialog(true);
                              }, 10);
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
                              setTimeout(() => saveToLocalStorage(), 50);
                            } else {
                              setTimeout(() => saveToLocalStorage(), 50);
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
                  
                  // Task Status column
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
                  
                  // Type of Issue column
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
                  
                  // View Photos column
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
                  
                  // Remarks column
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
                  
                  // Default for other columns
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
      {rows.length > 0 && (
        <div className="flex flex-col items-center gap-2 mt-6">
          <div className="flex items-center gap-4">
            <button className="bg-gray-200 px-4 py-1 rounded disabled:opacity-50 border border-gray-300" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>Previous</button>
            <span className="font-medium text-gray-700">Page {currentPage} of {totalPages}</span>
            <button className="bg-gray-200 px-4 py-1 rounded disabled:opacity-50 border border-gray-300" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>Next</button>
            <label className="ml-4 block text-sm text-gray-700 font-medium">Rows per page:</label>
            <select value={rowsPerPage} onChange={e => setRowsPerPage(Number(e.target.value))} className="border border-gray-300 rounded px-2 py-1 ml-1 focus:ring-blue-400 focus:border-blue-400" style={{ fontFamily: 'inherit' }}>
              {PAGE_SIZE_OPTIONS.map(size => (<option key={size} value={size}>{size}</option>))}
            </select>
          </div>
        </div>
      )}

      {/* Site Observations Dialog */}
      {showSiteObservationsDialog && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-center justify-center"
          style={{ padding: '20px' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowSiteObservationsDialog(false);
              setSelectedSiteObservationRowKey('');
              setSiteObservationsStatus('');
              setIsTypeOfSpareDropdownOpen(false);
              setSiteObservationsDialogData({
                remarks: '',
                typeOfIssue: '',
                specifyOther: '',
                typeOfSpare: [],
                specifySpareOther: '',
                capturedPhotos: [],
                uploadedPhotos: [],
                uploadedDocuments: []
              });
            }
          }}
        >
          <div 
            className="bg-white rounded-lg shadow-xl flex flex-col"
            style={{ 
              width: '100%',
              maxWidth: '500px',
              maxHeight: 'calc(100vh - 40px)',
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 pt-5 pb-3 flex-shrink-0">
              <h3 className="text-lg font-bold text-gray-800 text-center">Site Observations</h3>
            </div>
            
            {/* Scrollable Content Area */}
            <div 
              className="px-5 overflow-y-auto overflow-x-hidden flex-grow"
              style={{ 
                maxHeight: 'calc(100vh - 200px)',
                minHeight: 0
              }}
            >
              {/* Type of Issue - Only for Pending status */}
              {siteObservationsStatus === 'pending' && userRole !== 'AMC' && (
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1.5 text-center">
                  Type of Issue <span className="text-red-500">*</span>
                </label>
                <select
                    value={siteObservationsDialogData.typeOfIssue}
                    onChange={(e) => {
                      const newTypeOfIssue = e.target.value;
                      setSiteObservationsDialogData(prev => ({ 
                        ...prev, 
                        typeOfIssue: newTypeOfIssue,
                        specifyOther: newTypeOfIssue === 'Others' ? prev.specifyOther : '',
                        typeOfSpare: newTypeOfIssue === 'Spare Required' ? prev.typeOfSpare : [],
                        specifySpareOther: newTypeOfIssue === 'Spare Required' && prev.typeOfSpare.includes('OTHERS') ? prev.specifySpareOther : ''
                      }));
                      if (newTypeOfIssue !== 'Spare Required') {
                        setIsTypeOfSpareDropdownOpen(false);
                      }
                    }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="">Select Type of Issue</option>
                    {/* All 9 O&M Issue Types */}
                    <option value="Faulty">Faulty</option>
                    <option value="Bipassed">Bipassed</option>
                    <option value="Line Idel">Line Idel</option>
                    <option value="AT Jump cut">AT Jump cut</option>
                    <option value="Dismantled">Dismantled</option>
                    <option value="Replaced">Replaced</option>
                    <option value="Equipment Idle">Equipment Idle</option>
                    <option value="Spare Required">Spare Required</option>
                    <option value="AT-PT Chamber Flashover">AT-PT Chamber Flashover</option>
                    {/* Additional Issue Types */}
                    <option value="CS Issue">CS Issue</option>
                    <option value="RTU Issue">RTU Issue</option>
                    <option value="Others">Others</option>
                </select>
              </div>
              )}

              {/* Please Specify - Only when Others is selected */}
              {siteObservationsStatus === 'pending' && siteObservationsDialogData.typeOfIssue === 'Others' && (
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1.5 text-center">
                    Please Specify <span className="text-red-500">*</span>
                </label>
                  <input
                    type="text"
                    value={siteObservationsDialogData.specifyOther}
                    onChange={(e) => setSiteObservationsDialogData(prev => ({ ...prev, specifyOther: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="Please specify..."
                />
              </div>
              )}

              {/* Type of Spare - Only when Spare Required is selected */}
              {siteObservationsStatus === 'pending' && siteObservationsDialogData.typeOfIssue === 'Spare Required' && (
                <div className="mb-3 relative type-of-spare-dropdown">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5 text-center">
                    Type of Spare <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsTypeOfSpareDropdownOpen(!isTypeOfSpareDropdownOpen)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-left flex justify-between items-center bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <span className={siteObservationsDialogData.typeOfSpare.length === 0 ? 'text-gray-400' : 'text-gray-700'}>
                      {siteObservationsDialogData.typeOfSpare.length === 0 ? 'Select Type of Spare' : `${siteObservationsDialogData.typeOfSpare.length} selected`}
                    </span>
                    <span className="text-gray-400">▼</span>
                  </button>
                  
                  {isTypeOfSpareDropdownOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {[
                        'AT PT FUSES',
                        '24 V SMPS',
                        '12 V SMPS',
                        'DC TO DC CONVERTER',
                        'CONTROL CARD',
                        'BATTERY CHARGER',
                        'LT FUSE',
                        'TB',
                        'AC MCB',
                        'DC MCB',
                        'L/R SWITCH',
                        'SPRING RETURN ON/OFF SWITCH',
                        'RELAY',
                        'RELAY CELLS',
                        'SURGE ARRESTOR',
                        'AUX TRANSFORMER (AT)',
                        'POTENTIAL TRANSFORMER (PT)',
                        'CURRENT TRANSFORMER (CT)',
                        'MULTI FUNTION METER (MFM)',
                        'MOTOR',
                        'VPIS',
                        'SF6 GAS',
                        'EMERGENCY SWITCH',
                        'HYDRAULIC LIFT',
                        'PUSH BUTTON',
                        'FAULT PASSAGE INDICATOR (FPI)',
                        'FPI CELLS',
                        'HOOTER',
                        'LIMIT SWITCH',
                        'CABLE DOOR',
                        'CABLE BOOT',
                        'CABLE CLAMPS',
                        'VERMIN PROOF AGENT',
                        '12V BATTERY',
                        'AC PROPTECTOR',
                        'CMU BOARD',
                        'CONTROLLER',
                        'PTN BOARD',
                        'VOLTAGE CARD',
                        'CAPACITOR BANK',
                        'HMI',
                        'TRANSFORMER (230/30V)',
                        'OD OPERATING MECHANISM',
                        'VL OPERATING MECHNISM',
                        'OD AB3 CARD',
                        'VL AB3 CARD',
                        'OD AUXILIARY SWITCH',
                        'VL AUXILIARY SWITCH',
                        'MONO METER',
                        'NRV',
                        'DOOR HINGES',
                        'SURFACE HEATER',
                        'TRIPPING COIL',
                        'OPERATING HANDLE',
                        'EARTHING STRIPS',
                        'EARTHING PIPE',
                        'COAL & SALT MIX',
                        'BENTONITE',
                        'OTHERS'
                      ].map(option => (
                        <label
                          key={option}
                          className="flex items-center px-4 py-2 hover:bg-blue-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={siteObservationsDialogData.typeOfSpare.includes(option)}
                            onChange={() => {
                              setSiteObservationsDialogData(prev => {
                                const currentSpares = prev.typeOfSpare;
                                const isSelected = currentSpares.includes(option);
                                let newSpares: string[];
                                
                                if (isSelected) {
                                  newSpares = currentSpares.filter(s => s !== option);
                                } else {
                                  newSpares = [...currentSpares, option];
                                }
                                
                                const specifyOther = newSpares.includes('OTHERS') ? prev.specifySpareOther : '';
                                
                                return {
                                  ...prev,
                                  typeOfSpare: newSpares,
                                  specifySpareOther: specifyOther
                                };
                              });
                            }}
                            className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700">{option}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Please Specify Spare - Only when OTHERS is selected in Type of Spare */}
              {siteObservationsStatus === 'pending' && siteObservationsDialogData.typeOfIssue === 'Spare Required' && siteObservationsDialogData.typeOfSpare.includes('OTHERS') && (
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1.5 text-center">
                    Please Specify <span className="text-red-500">*</span>
                </label>
                  <input
                    type="text"
                    value={siteObservationsDialogData.specifySpareOther}
                    onChange={(e) => setSiteObservationsDialogData(prev => ({ ...prev, specifySpareOther: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="Please specify..."
                  />
                </div>
              )}

              {/* Remarks */}
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1.5 text-center">
                  Remarks {siteObservationsStatus === 'resolved' && <span className="text-red-500">*</span>}
                </label>
                <textarea
                  value={siteObservationsDialogData.remarks}
                  onChange={(e) => setSiteObservationsDialogData(prev => ({ ...prev, remarks: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
                  placeholder="Enter remarks..."
                />
              </div>

              {/* Capture Photo and Upload Photo in one row */}
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1.5 text-center">
                  Photo Options
                </label>
                <div className="flex gap-4 items-center justify-center flex-wrap">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        let stream: MediaStream | null = null;
                        try {
                          stream = await navigator.mediaDevices.getUserMedia({
                            video: { facingMode: 'environment' }
                          });
                        } catch (e) {
                          stream = await navigator.mediaDevices.getUserMedia({
                            video: true
                          });
                        }
                        setSiteObservationsCameraStream(stream);
                        setShowSiteObservationsCameraPreview(true);
                        setSiteObservationsCapturedImageData(null);
                      } catch (error) {
                        console.error('Error accessing camera:', error);
                        alert('Could not access camera. Please check permissions or use Upload Photo instead.');
                      }
                    }}
                    style={{
                      backgroundColor: '#3b82f6',
                      color: '#ffffff',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      fontSize: '14px',
                      fontWeight: '600',
                      display: 'inline-block',
                      minWidth: '130px',
                      textAlign: 'center',
                      marginRight: '16px',
                      border: 'none'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
                  >
                    Capture Photo
                  </button>
                  
                  <input
                    type="file"
                    id="upload-site-observations-photo"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      if (files.length > 0) {
                        setSiteObservationsDialogData(prev => ({
                          ...prev,
                          uploadedPhotos: [...prev.uploadedPhotos, ...files]
                        }));
                      }
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                  <label
                    htmlFor="upload-site-observations-photo"
                    style={{
                      backgroundColor: '#10b981',
                      color: '#ffffff',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      fontSize: '14px',
                      fontWeight: '600',
                      display: 'inline-block',
                      minWidth: '130px',
                      textAlign: 'center',
                      marginLeft: '16px'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#059669'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#10b981'}
                  >
                    Upload Photo
                  </label>
                </div>
              </div>
              
              {/* Photo Preview Section */}
              <div className="mb-3">
                {(siteObservationsDialogData.capturedPhotos.length > 0 || siteObservationsDialogData.uploadedPhotos.length > 0) && (
                  <div className="w-full">
                    <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
                      Photos ({siteObservationsDialogData.capturedPhotos.length + siteObservationsDialogData.uploadedPhotos.length})
                    </label>
                    <div className="flex flex-wrap gap-2 justify-center max-h-40 overflow-y-auto p-2 border border-gray-200 rounded">
                      {/* Captured Photos */}
                      {siteObservationsDialogData.capturedPhotos.map((photo, idx) => (
                        <div key={`captured-so-${idx}`} className="relative">
                          <img
                            src={photo.data}
                            alt={`Captured ${idx + 1}`}
                            className="w-16 h-16 object-cover rounded border border-gray-300"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setSiteObservationsDialogData(prev => ({
                                ...prev,
                                capturedPhotos: prev.capturedPhotos.filter((_, i) => i !== idx)
                              }));
                            }}
                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                            style={{ fontSize: '12px', lineHeight: '1' }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      {/* Uploaded Photos */}
                      {siteObservationsDialogData.uploadedPhotos.map((photo, idx) => (
                        <div key={`uploaded-so-${idx}`} className="relative">
                          <img
                            src={URL.createObjectURL(photo)}
                            alt={photo.name}
                            className="w-16 h-16 object-cover rounded border border-gray-300"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setSiteObservationsDialogData(prev => ({
                                ...prev,
                                uploadedPhotos: prev.uploadedPhotos.filter((_, i) => i !== idx)
                              }));
                            }}
                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                            style={{ fontSize: '12px', lineHeight: '1' }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Buttons - Fixed at bottom */}
            <div 
              className="px-5 pb-5 pt-4 border-t-2 border-gray-300 bg-gray-50 flex justify-end flex-shrink-0"
              style={{ 
                backgroundColor: '#f9fafb',
                minHeight: '70px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '20px'
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setShowSiteObservationsDialog(false);
                  setSelectedSiteObservationRowKey('');
                  setSiteObservationsStatus('');
                  setSiteObservationsDialogData({
                    remarks: '',
                    typeOfIssue: '',
                    specifyOther: '',
                    typeOfSpare: [],
                    specifySpareOther: '',
                    capturedPhotos: [],
                    uploadedPhotos: [],
                    uploadedDocuments: []
                  });
                  setSiteObservations(prev => {
                    const updated = { ...prev };
                    delete updated[selectedSiteObservationRowKey];
                    return updated;
                  });
                }}
                style={{
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  minWidth: '100px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (isSubmittingSiteObservations) return;
                  
                  if (siteObservationsStatus === 'pending' && userRole !== 'AMC') {
                    if (!siteObservationsDialogData.typeOfIssue) {
                    alert('Please select Type of Issue');
                    return;
                  }
                    if (siteObservationsDialogData.typeOfIssue === 'Others' && !siteObservationsDialogData.specifyOther.trim()) {
                      alert('Please specify the issue type');
                    return;
                  }
                  }
                  
                  if (siteObservationsStatus === 'resolved') {
                    if (!siteObservationsDialogData.remarks.trim()) {
                      alert('Please enter remarks');
                    return;
                    }
                  }

                  setIsSubmittingSiteObservations(true);

                  setTimeout(async () => {
                    try {
                      const findRowIndex = searchedRows.findIndex((r: any) => {
                        const currentRowKey = generateRowKey(selectedFile, r, headers);
                        return currentRowKey === selectedSiteObservationRowKey;
                      });

                      if (findRowIndex === -1) {
                        alert('Row not found. Please refresh and try again.');
                        setIsSubmittingSiteObservations(false);
                        return;
                      }

                      // Prepare photo data
                      let photoData: string[] = [];
                      
                      if (siteObservationsDialogData.capturedPhotos && siteObservationsDialogData.capturedPhotos.length > 0) {
                        photoData = siteObservationsDialogData.capturedPhotos.map(photo => photo.data);
                      }
                      
                      if (siteObservationsDialogData.uploadedPhotos && siteObservationsDialogData.uploadedPhotos.length > 0) {
                        const uploadedBase64 = await Promise.all(
                          siteObservationsDialogData.uploadedPhotos.map(file =>
                            new Promise<string>((resolve, reject) => {
                              const reader = new FileReader();
                              reader.onload = (e) => resolve(e.target?.result as string);
                              reader.onerror = reject;
                              reader.readAsDataURL(file);
                            })
                          )
                        );
                        photoData = [...photoData, ...uploadedBase64];
                      }

                      // Set Type of Issue - combine typeOfIssue with specifyOther if Others is selected
                      let issueDisplay = '';
                      if (siteObservationsDialogData.typeOfIssue === 'Others') {
                        issueDisplay = siteObservationsDialogData.specifyOther || '';
                      } else if (siteObservationsDialogData.typeOfIssue === 'Spare Required') {
                        const spareTypes = siteObservationsDialogData.typeOfSpare || [];
                        let spareDisplay = '';
                        if (spareTypes.length > 0) {
                          const spareTypesDisplay = spareTypes.map(spare => {
                            if (spare === 'OTHERS' && siteObservationsDialogData.specifySpareOther) {
                              return siteObservationsDialogData.specifySpareOther;
                            }
                            return spare;
                          });
                            spareDisplay = spareTypesDisplay.join(', ');
                        }
                        issueDisplay = spareDisplay ? `Spare Required - ${spareDisplay}` : 'Spare Required';
                      } else {
                        issueDisplay = siteObservationsDialogData.typeOfIssue || '';
                      }

                      // Update state
                      setTaskStatus(prev => ({ ...prev, [selectedSiteObservationRowKey]: 'Pending' }));
                      setTypeOfIssue(prev => ({ ...prev, [selectedSiteObservationRowKey]: issueDisplay }));
                      setViewPhotos(prev => ({ ...prev, [selectedSiteObservationRowKey]: photoData }));
                      setRemarks(prev => ({ ...prev, [selectedSiteObservationRowKey]: siteObservationsDialogData.remarks || '' }));
                      
                      taskStatusRef.current = { ...taskStatusRef.current, [selectedSiteObservationRowKey]: 'Pending' };
                      typeOfIssueRef.current = { ...typeOfIssueRef.current, [selectedSiteObservationRowKey]: issueDisplay };
                      viewPhotosRef.current = { ...viewPhotosRef.current, [selectedSiteObservationRowKey]: photoData };
                      remarksRef.current = { ...remarksRef.current, [selectedSiteObservationRowKey]: siteObservationsDialogData.remarks || '' };
                      
                      if (photoData.length > 0) {
                        const metadataArray = siteObservationsDialogData.capturedPhotos.map(photo => ({
                          latitude: photo.latitude,
                          longitude: photo.longitude,
                          timestamp: photo.timestamp,
                          location: photo.location
                        }));
                        setPhotoMetadata(prev => ({ ...prev, [selectedSiteObservationRowKey]: metadataArray }));
                        photoMetadataRef.current = { ...photoMetadataRef.current, [selectedSiteObservationRowKey]: metadataArray };
                      }

                      setTimeout(() => saveToLocalStorage(), 300);
                      
                      const statusMessage = siteObservationsStatus === 'pending' ? 'Pending' : 'Resolved';
                      alert(`Site observation marked as ${statusMessage} successfully!`);

                      setShowSiteObservationsDialog(false);
                      setSelectedSiteObservationRowKey('');
                      setSiteObservationsStatus('');
                      setSiteObservationsDialogData({
                      remarks: '',
                        typeOfIssue: '',
                        specifyOther: '',
                        typeOfSpare: [],
                        specifySpareOther: '',
                      capturedPhotos: [],
                      uploadedPhotos: [],
                      uploadedDocuments: []
                      });
                    } catch (error: any) {
                      console.error('Error submitting site observation:', error);
                      alert(error.message || 'Failed to submit site observation. Please try again.');
                    } finally {
                      setIsSubmittingSiteObservations(false);
                    }
                  }, 0);
                }}
                style={{
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: isSubmittingSiteObservations ? 'not-allowed' : 'pointer',
                  minWidth: '100px',
                  opacity: isSubmittingSiteObservations ? 0.7 : 1
                }}
                onMouseEnter={(e) => !isSubmittingSiteObservations && (e.currentTarget.style.backgroundColor = '#1d4ed8')}
                onMouseLeave={(e) => !isSubmittingSiteObservations && (e.currentTarget.style.backgroundColor = '#2563eb')}
                disabled={isSubmittingSiteObservations}
              >
                {isSubmittingSiteObservations ? 'Submitting...' : 'Submit'}
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
                  style={{ maxWidth: '100%', maxHeight: '500px' }}
                />
              ) : siteObservationsCameraStream ? (
                <video
                  id="site-observations-camera-preview-video"
                  autoPlay
                  playsInline
                  style={{ maxWidth: '100%', maxHeight: '500px' }}
                />
              ) : (
                <div className="text-white text-center">No camera stream available</div>
              )}
            </div>
            
            {/* Camera Controls */}
            <div className="p-4 border-t border-gray-300 flex justify-center gap-4">
              {!siteObservationsCapturedImageData && siteObservationsCameraStream && (
                <button
                  type="button"
                  onClick={async () => {
                    const video = document.getElementById('site-observations-camera-preview-video') as HTMLVideoElement;
                    if (video && siteObservationsCameraStream) {
                      const canvas = document.createElement('canvas');
                      canvas.width = video.videoWidth;
                      canvas.height = video.videoHeight;
                      const ctx = canvas.getContext('2d');
                      if (ctx) {
                        ctx.drawImage(video, 0, 0);
                        
                        // Get geolocation if available
                        let latitude: number | undefined;
                        let longitude: number | undefined;
                        let location: string | undefined;
                        
                        try {
                          if (navigator.geolocation) {
                            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                              navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
                            });
                            latitude = position.coords.latitude;
                            longitude = position.coords.longitude;
                            
                            // Try to get location name from reverse geocoding (simplified)
                            try {
                              const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}`);
                              const data = await response.json();
                              location = data.locality || data.principalSubdivision || '';
                            } catch (e) {
                              console.log('Could not get location name');
                            }
                          }
                        } catch (e) {
                          console.log('Geolocation not available');
                        }
                        
                        const timestamp = new Date().toISOString();
                        const imageData = canvas.toDataURL('image/jpeg', 0.9);
                        
                        setSiteObservationsCapturedImageData(imageData);
                        setCapturedPhotoMetadata({ latitude, longitude, timestamp, location });
                        
                        // Stop camera stream
                        if (siteObservationsCameraStream) {
                          siteObservationsCameraStream.getTracks().forEach(track => track.stop());
                          setSiteObservationsCameraStream(null);
                        }
                      }
                    }
                  }}
                  style={{
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    padding: '10px 20px',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    border: 'none'
                  }}
                >
                  Capture
                </button>
              )}
              
              {siteObservationsCapturedImageData && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setSiteObservationsDialogData(prev => ({
                        ...prev,
                        capturedPhotos: [...prev.capturedPhotos, {
                          data: siteObservationsCapturedImageData,
                          latitude: capturedPhotoMetadata?.latitude,
                          longitude: capturedPhotoMetadata?.longitude,
                          timestamp: capturedPhotoMetadata?.timestamp,
                          location: capturedPhotoMetadata?.location
                        }]
                      }));
                      setSiteObservationsCapturedImageData(null);
                      setCapturedPhotoMetadata(null);
                      setShowSiteObservationsCameraPreview(false);
                      if (siteObservationsCameraStream) {
                        siteObservationsCameraStream.getTracks().forEach(track => track.stop());
                        setSiteObservationsCameraStream(null);
                      }
                    }}
                    style={{
                      backgroundColor: '#10b981',
                      color: '#ffffff',
                      padding: '10px 20px',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      border: 'none'
                    }}
                  >
                    Use Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSiteObservationsCapturedImageData(null);
                      setCapturedPhotoMetadata(null);
                      if (siteObservationsCameraStream) {
                        const video = document.getElementById('site-observations-camera-preview-video') as HTMLVideoElement;
                        if (video && siteObservationsCameraStream) {
                          video.srcObject = siteObservationsCameraStream;
                        }
                      }
                    }}
                    style={{
                      backgroundColor: '#ef4444',
                      color: '#ffffff',
                      padding: '10px 20px',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      border: 'none'
                    }}
                  >
                    Retake
                  </button>
                </>
              )}
              
              <button
                type="button"
                onClick={() => {
                  setShowSiteObservationsCameraPreview(false);
                  setSiteObservationsCapturedImageData(null);
                  setCapturedPhotoMetadata(null);
                  if (siteObservationsCameraStream) {
                    siteObservationsCameraStream.getTracks().forEach(track => track.stop());
                    setSiteObservationsCameraStream(null);
                  }
                }}
                style={{
                  backgroundColor: '#6b7280',
                  color: '#ffffff',
                  padding: '10px 20px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  border: 'none'
                }}
              >
                Cancel
              </button>
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
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 pt-5 pb-3 flex-shrink-0 flex justify-between items-center border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-800">View Photos</h3>
              <button
                type="button"
                onClick={() => {
                  setShowPhotoViewer(false);
                  setSelectedRowKeyForPhotos('');
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
                style={{ lineHeight: '1' }}
              >
                ×
              </button>
            </div>
            
            {/* Photo Gallery */}
            <div 
              className="px-5 py-4 overflow-y-auto flex-grow"
              style={{ 
                maxHeight: 'calc(90vh - 100px)',
                minHeight: 0
              }}
            >
              {(() => {
                let photosToShow = viewPhotos[selectedRowKeyForPhotos] || [];
                
                return photosToShow.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {photosToShow.map((photo, idx) => {
                      return (
                        <div key={idx} className="relative bg-gray-100 rounded-lg overflow-hidden p-2">
                          <img
                            src={photo}
                            alt={`Photo ${idx + 1}`}
                            className="w-full h-auto object-contain"
                            style={{ maxHeight: '400px', display: 'block', margin: '0 auto' }}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle" fill="%23999"%3EImage not available%3C/text%3E%3C/svg%3E';
                            }}
                          />
                          <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
                            Photo {idx + 1} of {photosToShow.length}
                          </div>
                          <div className="mt-2 flex gap-2 justify-center">
                            <button
                              onClick={() => {
                                const newWindow = window.open('', '_blank');
                                if (newWindow) {
                                  newWindow.document.write(`
                                    <html>
                                      <head>
                                        <title>Photo ${idx + 1}</title>
                                        <style>
                                          body { margin: 0; padding: 20px; display: flex; justify-content: center; align-items: center; min-height: 100vh; background-color: #000; }
                                          img { max-width: 100%; max-height: 100vh; }
                                        </style>
                                      </head>
                                      <body>
                                        <img src="${photo}" alt="Photo ${idx + 1}" />
                                      </body>
                                    </html>
                                  `);
                                  newWindow.document.close();
                                }
                              }}
                              className="px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition-colors"
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
                              className="px-3 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600 transition-colors"
                            >
                              Download Photo
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No photos available
                  </div>
                );
              })()}
            </div>
            
            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-200 flex justify-end flex-shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowPhotoViewer(false);
                  setSelectedRowKeyForPhotos('');
                }}
                style={{
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  minWidth: '100px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1d4ed8'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
