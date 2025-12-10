import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { API_BASE } from '../utils/api';

const PAGE_SIZE_OPTIONS = [25, 50, 75, 100];

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: Date | string;
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

type FilterDef = { label: string; keys: string[] };
const FILTER_DEFS: FilterDef[] = [
  { label: "CIRCLE", keys: [
    "CIRCLE", "CIRCLE NAME", "THE CIRCLE", "CIRCLE_NAME", "CIRCLENAME", "CIRCLE-NAME"
  ] },
  { label: "DIVISION", keys: ["DIVISION"] },
  { label: "SUB DIVISION", keys: ["SUB DIVISION", "SUBDIVISION"] },
  { label: "DEVICE STATUS", keys: ["DEVICE STATUS", "DEVICE_STATUS"] },
];

export default function ViewData() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [allRows, setAllRows] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(PAGE_SIZE_OPTIONS[0]);
  const role = getCurrentUserRole();

  // Edit mode: allow editing ANY row
  const [isEditMode, setIsEditMode] = useState(false);
  const [edits, setEdits] = useState<Record<string, any>>({});
  const [filters, setFilters] = useState<Record<string, string>>({});

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
          
          // If current selected file was deleted, clear it
          if (selectedFile && !files.find((f: any) => f.id === selectedFile)) {
            setSelectedFile('');
            setRows([]);
            setHeaders([]);
            setAllRows([]);
          } else if (files.length === 1 && !selectedFile) {
            setSelectedFile(files[0].id);
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
        const res = await fetch(`${API_BASE}/api/uploads`, {
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
          
          // If current selected file was deleted, clear it
          if (selectedFile && !files.find((f: any) => f.id === selectedFile)) {
            setSelectedFile('');
            setRows([]);
            setHeaders([]);
            setAllRows([]);
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
        const res = await fetch(`${API_BASE}/api/uploads/${selectedFile}`, {
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
            const onlineOfflineRes = await fetch(`${API_BASE}/api/uploads`, {
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
                  // CRITICAL: Store dateColumns in a variable accessible later for extracting ALL date columns
                  let dateColumns: Array<{ name: string; date: Date }> = [];
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
                  
                  // Build columns to insert: For display, only include LATEST date column and its associated columns
                  // All date columns are still stored in database, but only latest date group is shown by default
                  const onlineOfflineColumns: string[] = [];
                  
                  // CRITICAL: For display, only include the LATEST date column and its associated columns
                  // All date columns are still stored in database, but only latest is shown by default
                  if (dateColumns && dateColumns.length > 0) {
                    // Sort to get latest date column
                    const sortedDateColumns = [...dateColumns].sort((a, b) => b.date.getTime() - a.date.getTime());
                    const latestDateCol = sortedDateColumns[0];
                    
                    // Find the index of the latest date column in headers
                    const latestDateIndex = onlineOfflineHeaders.indexOf(latestDateCol.name);
                    
                    if (latestDateIndex !== -1) {
                      // Add the latest date column
                      onlineOfflineColumns.push(latestDateCol.name);
                      console.log('Added latest date column to display:', latestDateCol.name, 'Date:', latestDateCol.date.toLocaleDateString());
                      
                      // Find the columns that belong to this latest date column group
                      // These are the columns that come after the latest date column
                      // Pattern: DATE, DEVICE STATUS, EQUIPMENT L/R SWITCH STATUS, NO OF DAYS OFFLINE, RTU L/R SWITCH STATUS
                      const columnsAfterLatestDate: string[] = [];
                      for (let i = latestDateIndex + 1; i < onlineOfflineHeaders.length; i++) {
                        const nextCol = onlineOfflineHeaders[i];
                        const normalizedNext = normalizeHeader(nextCol);
                        
                        // Stop if we hit another date column (start of next date group)
                        const isNextDateColumn = dateColumns.some(dc => dc.name === nextCol);
                        if (isNextDateColumn) break;
                        
                        // Add columns that match our expected pattern
                        if (normalizedNext.includes('device') && normalizedNext.includes('status') && !normalizedNext.includes('rtu')) {
                          columnsAfterLatestDate.push(nextCol);
                        } else if (normalizedNext.includes('equipment') && normalizedNext.includes('switch')) {
                          columnsAfterLatestDate.push(nextCol);
                        } else if ((normalizedNext.includes('days') && normalizedNext.includes('offline')) || 
                                   normalizedNext === 'noofdaysoffline' || normalizedNext === 'no_of_days_offline') {
                          columnsAfterLatestDate.push(nextCol);
                        } else if (normalizedNext.includes('rtu') && normalizedNext.includes('switch')) {
                          columnsAfterLatestDate.push(nextCol);
                          break; // RTU L/R SWITCH STATUS is usually the last in the group
                        }
                      }
                      
                      // Add the columns from latest date group
                      columnsAfterLatestDate.forEach(col => {
                        if (!onlineOfflineColumns.includes(col)) {
                          onlineOfflineColumns.push(col);
                          console.log('Added column from latest date group:', col);
                        }
                      });
                      
                      console.log(`Found ${dateColumns.length} date columns total, showing only latest date group: ${latestDateCol.name}`);
                      console.log('Latest date group columns:', onlineOfflineColumns);
                      console.log('All date columns (for reference):', dateColumns.map(d => ({ name: d.name, date: d.date.toLocaleDateString() })));
                    }
                  } else {
                    // Fallback: if no date columns found, use the first occurrence of standard columns
                    if (deviceStatusHeader) onlineOfflineColumns.push(deviceStatusHeader);
                    if (equipmentLRSwitchStatusHeader) onlineOfflineColumns.push(equipmentLRSwitchStatusHeader);
                    if (noOfDaysOfflineHeader) onlineOfflineColumns.push(noOfDaysOfflineHeader);
                  }
                  
                  // Note: We don't need to add "column after NO OF DAYS OFFLINE" separately
                  // because we're already including all columns from the latest date group above
                  
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
                    
                    // Merge data into main rows - only latest date column data is merged for display
                    let mergedCount = 0;
                    fileRows = fileRows.map((row: any) => {
                      const siteCode = String(row[mainSiteCodeHeader] || '').trim();
                      const onlineOfflineRow = onlineOfflineMap.get(siteCode);
                      
                      if (onlineOfflineRow) {
                        mergedCount++;
                        // Add the ONLINE-OFFLINE columns from ONLINE-OFFLINE data
                        // Only latest date column's data is included (onlineOfflineColumns contains only latest)
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
            const rtuTrackerRes = await fetch(`${API_BASE}/api/uploads`, {
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
                  const rtuTrackerDataRes = await fetch(`${API_BASE}/api/uploads/${latestRtuTrackerFile.fileId}`, {
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
          
          setAllRows(fileRows);
          setRows(fileRows);
          
          setHeaders(hdrs);
          setCurrentPage(1);
          
          console.log('State set successfully');
        }
      } catch (error) {
        console.error('Error fetching file data:', error);
        setRows([]);
        setHeaders([]);
      }
    })();
  }, [selectedFile]);

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

  // Toggle edit mode
  function handleToggleEditMode() {
    if (role !== 'CCR') return;
    setIsEditMode(prev => {
      const next = !prev;
      if (!next) {
        // Turning OFF: save all pending edits
        if (Object.keys(edits).length > 0) {
          const updatedAll = allRows.map(r => edits[r.id] ? { ...r, ...edits[r.id] } : r);
          setAllRows(updatedAll);
          setRows(updatedAll);
          // Persist edits to backend
          (async () => {
            try {
              const token = localStorage.getItem('token');
              await fetch(`${API_BASE}/api/uploads/${selectedFile}/rows`, {
                method: 'PUT',
                headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({ rows: updatedAll })
              });
            } catch {}
          })();
          setEdits({});
        }
      }
      return next;
    });
  }

  function handleCellChange(rowId: string, col: string, value: string) {
    setEdits(prev => ({
      ...prev,
      [rowId]: { ...(prev[rowId] || {}), [col]: value }
    }));
  }

  function handleSaveRow(row: any) {
    const patch = edits[row.id] || {};
    const updatedRow = { ...row, ...patch };
    const updatedAll = allRows.map(r => (r.id === row.id ? updatedRow : r));
    setAllRows(updatedAll);
    setRows(updatedAll);
    (async () => {
      try {
        const token = localStorage.getItem('token');
        await fetch(`${API_BASE}/api/uploads/${selectedFile}/rows`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
          },
          body: JSON.stringify({ rows: updatedAll })
        });
      } catch {}
    })();

    setEdits(prev => {
      const next = { ...prev };
      delete next[row.id];
      return next;
    });
  }

  function handleCancelRow(rowId: string) {
    setEdits(prev => {
      const next = { ...prev };
      delete next[rowId];
      return next;
    });
  }

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

    const title = 'View Data Export';
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
        <h2 className="text-2xl font-bold mb-2 text-gray-800">View Uploaded Data</h2>
        <p className="text-gray-500">No files uploaded yet. Please upload from Upload tab.</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">View Uploaded Data</h2>
      {/* Controls Row */}
      <div className="flex flex-wrap gap-2 md:gap-4 items-center mb-3 whitespace-nowrap inline-flex">
        <label className="block font-medium text-gray-700">Select File to View:</label>
        <select
          className="border border-gray-300 rounded px-2 py-1 min-w-[160px]"
          value={selectedFile}
          onChange={e => setSelectedFile(e.target.value)}
          disabled={uploadedFiles.length === 1}
        >
          {uploadedFiles.length > 1 && <option value="">-- Select File --</option>}
          {uploadedFiles.map(f => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
        <input
          className="border border-gray-300 border-[1px] rounded px-2 py-1 flex-1 min-w-[120px]"
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          disabled={!selectedFile}
        />
        <button
          className={`px-5 py-2 rounded-lg font-semibold shadow hover:brightness-110 transition disabled:opacity-50 inline-flex items-center !bg-green-600 !text-white mr-4`}
          onClick={handleToggleEditMode}
          disabled={role !== 'CCR' || !selectedFile || !rows.length}
          style={{backgroundColor:'#16a34a', color:'#fff', minWidth:95}}
        >
          {isEditMode ? 'DONE' : 'EDIT'}
        </button>
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
              {isEditMode && (
                <th className="px-3 py-2 font-bold border border-gray-300 text-center" style={{ fontFamily: 'Times New Roman, Times, serif', fontSize: 14, background: 'linear-gradient(90deg, #dbeafe 0%, #bae6fd 100%)', position: 'sticky', top: 0 }}>Actions</th>
              )}
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
                  return (
                    <td
                      key={h}
                      className="px-3 py-1 border border-gray-300 text-gray-700 text-center"
                      style={{ fontFamily: 'Times New Roman, Times, serif', fontSize: 12, textAlign: 'center', whiteSpace: 'pre-wrap' }}
                    >
                      {isEditMode && h !== 'id' ? (
                        <input
                          type="text"
                          value={edits[row.id]?.[h] ?? row[h] ?? ''}
                          onChange={e => handleCellChange(row.id, h, e.target.value)}
                          className="border-0 outline-none focus:ring-0 p-1 text-center w-full bg-white"
                          style={{ fontFamily: 'Times New Roman, Times, serif', fontSize: 12 }}
                        />
                      ) : (
                        String(row[h] ?? '')
                      )}
                    </td>
                  );
                })}
                {isEditMode && (
                  <td className="px-1 py-1 border-0 text-center" style={{ minWidth: 120 }}>
                    <button className="bg-green-600 text-white rounded px-2 py-1 mr-2" onClick={() => handleSaveRow(row)}>Save</button>
                    <button className="bg-red-600 text-white rounded px-2 py-1" onClick={() => handleCancelRow(row.id)}>Cancel</button>
                  </td>
                )}
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
    </div>
  );
}
