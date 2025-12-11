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

function getCurrentUser() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user;
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

type FilterDef = { label: string; keys: string[] };
const FILTER_DEFS: FilterDef[] = [
  { label: "CIRCLE", keys: [
    "CIRCLE", "CIRCLE NAME", "THE CIRCLE", "CIRCLE_NAME", "CIRCLENAME", "CIRCLE-NAME"
  ] },
  { label: "DIVISION", keys: ["DIVISION"] },
  { label: "SUB DIVISION", keys: ["SUB DIVISION", "SUBDIVISION"] },
  { label: "DEVICE STATUS", keys: ["DEVICE STATUS", "DEVICE_STATUS"] },
];

export default function MyDivisionData() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [allRows, setAllRows] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(PAGE_SIZE_OPTIONS[0]);
  const [user, setUser] = useState<any>(getCurrentUser());
  const role = getCurrentUserRole();
  const userDivisions = user?.division || []; // Array of user's assigned divisions

  // Edit mode: allow editing ANY row
  const [isEditMode, setIsEditMode] = useState(false);
  const [edits, setEdits] = useState<Record<string, any>>({});
  const [filters, setFilters] = useState<Record<string, string>>({});

  // Fetch fresh user data if divisions are missing
  useEffect(() => {
    const currentDivisions = user?.division || [];
    if ((!currentDivisions || currentDivisions.length === 0)) {
      const token = localStorage.getItem('token');
      if (token) {
        console.log('MY DIVISION DATA - Divisions missing, fetching fresh user profile...');
        fetch(`${API_BASE}/api/auth/profile`, {
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
            console.log('MY DIVISION DATA - Refreshed user data with divisions:', freshUser.division);
          }
        })
        .catch(err => console.error('MY DIVISION DATA - Failed to fetch user profile:', err));
      }
    }
    
    console.log('MY DIVISION DATA - Current user data:', {
      role: role,
      divisions: currentDivisions,
      hasDivisions: currentDivisions && currentDivisions.length > 0,
      userId: user?.userId
    });
  }, [user, role]);

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
          const currentRole = getCurrentUserRole();
          console.log('=== MY DIVISION DATA FILE FILTERING ===');
          console.log('Current user role:', currentRole);
          console.log('User divisions:', userDivisions);
          
          const files = (json.files || [])
            .filter((f: any) => {
              const uploadTypeValue = f.uploadType;
              const fileName = String(f.name || '').toLowerCase();
              
              // For Equipment role: Only show Device Status Upload files
              // STRICT: Only show files with uploadType === 'device-status-upload' (explicitly set)
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
              
              // Hide files with uploadType === 'online-offline-data' or 'rtu-tracker' OR matching filename patterns
              const shouldHide = shouldHideByType || isOnlineOfflineFileName || isRtuTrackerFileName;
              
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
  }, [userDivisions]);

  // Listen for ViewData updates to refresh data
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  useEffect(() => {
    const handleViewDataUpdate = (event: any) => {
      const { fileId } = event.detail || {};
      // Only refresh if the updated file matches the currently selected file
      if (fileId === selectedFile) {
        console.log('MyDivisionData: ViewData updated, refreshing data...');
        setRefreshTrigger(prev => prev + 1);
      }
    };

    window.addEventListener('viewDataUpdated', handleViewDataUpdate as EventListener);
    return () => {
      window.removeEventListener('viewDataUpdated', handleViewDataUpdate as EventListener);
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
          let rtuTrackerColumnsList: string[] = []; // Track RTU-TRACKER columns separately for verification
          
          // Find SITE CODE column in main file (used by ONLINE-OFFLINE and RTU-TRACKER)
          const normalizeHeader = (h: string) => h.trim().toLowerCase();
          const mainSiteCodeHeader = hdrs.find((h: string) => {
            const normalized = normalizeHeader(h);
            return normalized === 'site code' || normalized === 'sitecode' || normalized === 'site_code';
          });
          
          console.log('MY DIVISION DATA - Main SITE CODE header:', mainSiteCodeHeader);
          
          // ===== START OF MERGING LOGIC FROM ViewData.tsx =====
          // This section merges ONLINE-OFFLINE and RTU-TRACKER data into the main file
          // The logic is identical to ViewData.tsx lines 368-2085
          
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
                  console.log(`MY DIVISION DATA - ONLINE-OFFLINE file found by filename: ${f.name} (uploadType: ${uploadTypeValue})`);
                  return true; // Include if filename matches, regardless of uploadType
                }
                
                // Also include if it's ONLINE-OFFLINE DATA type AND has "online-offline" in filename
                return isOnlineOfflineType && isOnlineOfflineFileName;
              });
              
              console.log('MY DIVISION DATA - ONLINE-OFFLINE files found:', onlineOfflineFiles.map((f: any) => ({ name: f.name, uploadType: f.uploadType, fileId: f.fileId })));
              
              // Sort by upload date (latest first) and get the most recent ONLINE-OFFLINE file
              const latestOnlineOfflineFile = onlineOfflineFiles.sort((a: any, b: any) => {
                const dateA = a.uploadedAt ? new Date(a.uploadedAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
                const dateB = b.uploadedAt ? new Date(b.uploadedAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
                return dateB - dateA; // Latest first
              })[0];
              
              if (latestOnlineOfflineFile) {
                console.log('MY DIVISION DATA - Found ONLINE-OFFLINE DATA file:', latestOnlineOfflineFile.name);
                
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
                  
                  console.log('MY DIVISION DATA - ONLINE-OFFLINE headers:', onlineOfflineHeaders);
                  console.log('MY DIVISION DATA - ONLINE-OFFLINE rows count:', onlineOfflineRows.length);
                  
                  // Find SITE CODE column in ONLINE-OFFLINE file
                  const onlineOfflineSiteCodeHeader = onlineOfflineHeaders.find((h: string) => {
                    const normalized = normalizeHeader(h);
                    return normalized === 'site code' || normalized === 'sitecode' || normalized === 'site_code';
                  });
                  
                  console.log('MY DIVISION DATA - ONLINE-OFFLINE SITE CODE header:', onlineOfflineSiteCodeHeader);
                  
                  // Find all date columns in ONLINE-OFFLINE file (columns with dates in their names like "DATE 15-11-2025")
                  const parseDateFromColumnName = (columnName: string): Date | null => {
                    // Try to extract date from column name
                    // Patterns: "DATE 15-11-2025", "Date 14-11-2025", "15-11-2025", etc.
                    const datePatterns = [
                      /(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/, // DD-MM-YYYY or DD/MM/YYYY
                      /(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/, // YYYY-MM-DD or YYYY/MM/DD
                    ];
                    
                    for (const pattern of datePatterns) {
                      const match = columnName.match(pattern);
                      if (match) {
                        if (pattern.source.includes('\\d{4}') && pattern.source.startsWith('(\\d{4})')) {
                          // YYYY-MM-DD format
                          const year = parseInt(match[1]);
                          const month = parseInt(match[2]) - 1;
                          const day = parseInt(match[3]);
                          return new Date(year, month, day);
                        } else {
                          // DD-MM-YYYY format
                          const day = parseInt(match[1]);
                          const month = parseInt(match[2]) - 1;
                          const year = parseInt(match[3]);
                          return new Date(year, month, day);
                        }
                      }
                    }
                    return null;
                  };
                  
                  // Find all date columns
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
                  
                  // Find the latest date column
                  let latestDateColumn: string | null = null;
                  if (dateColumns.length > 0) {
                    dateColumns.sort((a, b) => b.date.getTime() - a.date.getTime()); // Latest first
                    latestDateColumn = dateColumns[0].name;
                    console.log('MY DIVISION DATA - Date columns found:', dateColumns.map(d => ({ name: d.name, date: d.date.toLocaleDateString() })));
                    console.log('MY DIVISION DATA - Latest date column:', latestDateColumn, 'Date:', dateColumns[0].date.toLocaleDateString());
                  } else {
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
                      console.log('MY DIVISION DATA - Using fallback date column:', latestDateColumn);
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
                      console.log('MY DIVISION DATA - Column after NO OF DAYS OFFLINE found:', columnAfterNoOfDaysOffline);
                    }
                  }
                  
                  console.log('MY DIVISION DATA - DEVICE STATUS header found:', deviceStatusHeader);
                  console.log('MY DIVISION DATA - EQUIPMENT L/R SWITCH STATUS header found:', equipmentLRSwitchStatusHeader);
                  console.log('MY DIVISION DATA - NO OF DAYS OFFLINE header found:', noOfDaysOfflineHeader);
                  console.log('MY DIVISION DATA - Column after NO OF DAYS OFFLINE:', columnAfterNoOfDaysOffline);
                  
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
                      console.log('MY DIVISION DATA - Added latest date column to display:', latestDateCol.name, 'Date:', latestDateCol.date.toLocaleDateString());
                      
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
                          console.log('MY DIVISION DATA - Added column from latest date group:', col);
                        }
                      });
                      
                      console.log(`MY DIVISION DATA - Found ${dateColumns.length} date columns total, showing only latest date group: ${latestDateCol.name}`);
                      console.log('MY DIVISION DATA - Latest date group columns:', onlineOfflineColumns);
                      console.log('MY DIVISION DATA - All date columns (for reference):', dateColumns.map(d => ({ name: d.name, date: d.date.toLocaleDateString() })));
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
                  
                  console.log('MY DIVISION DATA - ONLINE-OFFLINE columns to insert:', onlineOfflineColumns);
                  
                  if (mainSiteCodeHeader && onlineOfflineSiteCodeHeader && onlineOfflineColumns.length > 0) {
                    // Create a map of ONLINE-OFFLINE data by SITE CODE
                    // Include ALL rows from ONLINE-OFFLINE file (not just those with data in latest date column)
                    const onlineOfflineMap = new Map<string, any>();
                    
                    // Process ALL rows - don't filter out rows without data in latest date column
                    // This ensures old data (rows with data in older date columns) is also included
                    let filteredRows = [...onlineOfflineRows];
                    console.log(`MY DIVISION DATA - Processing all ${filteredRows.length} rows from ONLINE-OFFLINE file (including rows with data in older date columns)`);
                    
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
                    
                    console.log('MY DIVISION DATA - Mapped ONLINE-OFFLINE data for', onlineOfflineMap.size, 'unique SITE CODEs');
                    
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
                    
                    console.log('MY DIVISION DATA - Merged ONLINE-OFFLINE data into', mergedCount, 'rows');
                    
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
                        console.log('MY DIVISION DATA - Inserted ONLINE-OFFLINE columns before SITE CODE at index', siteCodeIndex);
                      }
                    } else {
                      // If SITE CODE not found, add at the end, maintaining order
                      const columnsToAdd = onlineOfflineColumns.filter(col => !hdrs.includes(col));
                      if (columnsToAdd.length > 0) {
                        hdrs = [...hdrs, ...columnsToAdd];
                        console.log('MY DIVISION DATA - SITE CODE not found, added ONLINE-OFFLINE columns at the end in order:', columnsToAdd);
                      }
                    }
                  } else {
                    console.warn('MY DIVISION DATA - Cannot merge ONLINE-OFFLINE data:', {
                      hasMainSiteCode: !!mainSiteCodeHeader,
                      hasOnlineOfflineSiteCode: !!onlineOfflineSiteCodeHeader,
                      columnsToInsertCount: onlineOfflineColumns.length
                    });
                  }
                } else {
                  console.warn('MY DIVISION DATA - ONLINE-OFFLINE file data fetch failed or no data');
                }
              } else {
                console.log('MY DIVISION DATA - No ONLINE-OFFLINE DATA file found');
              }
            }
          } catch (error) {
            console.error('MY DIVISION DATA - Error fetching ONLINE-OFFLINE DATA:', error);
            // Continue with main file data even if ONLINE-OFFLINE fetch fails
          }
          
          // Fetch RTU-TRACKER files (uploadType === 'rtu-tracker')
          // IMPORTANT: This MUST run independently of ONLINE-OFFLINE processing
          console.log('MY DIVISION DATA - === STARTING RTU-TRACKER FILE FETCH ===');
          try {
            const rtuTrackerRes = await fetch(`${API_BASE}/api/uploads`, {
              headers: {
                'Authorization': token ? `Bearer ${token}` : ''
              }
            });
            const rtuTrackerJson = await rtuTrackerRes.json();
            
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
                return shouldInclude;
              });
              
              console.log('MY DIVISION DATA - RTU-TRACKER files found:', rtuTrackerFiles.length);
              
              // Sort by upload date (latest first) and get the most recent RTU-TRACKER file
              const latestRtuTrackerFile = rtuTrackerFiles.sort((a: any, b: any) => {
                const dateA = a.uploadedAt ? new Date(a.uploadedAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
                const dateB = b.uploadedAt ? new Date(b.uploadedAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
                return dateB - dateA; // Latest first
              })[0];
              
              // Fetch RTU-TRACKER file data
              if (latestRtuTrackerFile) {
                console.log('MY DIVISION DATA - Found RTU-TRACKER file:', latestRtuTrackerFile.name);
                
                try {
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
                    
                    console.log('MY DIVISION DATA - RTU-TRACKER headers:', rtuTrackerHeaders);
                    console.log('MY DIVISION DATA - RTU-TRACKER rows count:', rtuTrackerRows.length);
                    
                    // Find SITE CODE column in RTU-TRACKER file
                    const normalizeHeaderForRtuTracker = (h: string) => h.trim().toLowerCase();
                    const rtuTrackerSiteCodeHeader = rtuTrackerHeaders.find((h: string) => {
                      const normalized = normalizeHeaderForRtuTracker(h);
                      return normalized === 'site code' || normalized === 'sitecode' || normalized === 'site_code';
                    });
                    
                    console.log('MY DIVISION DATA - RTU-TRACKER SITE CODE header:', rtuTrackerSiteCodeHeader);
                    
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
                    const rtuTrackerDateColumns: Array<{ name: string; date: Date; index: number }> = [];
                    rtuTrackerHeaders.forEach((h: string, index: number) => {
                      const normalized = normalizeHeaderForRtuTracker(h);
                      const hasDateKeyword = normalized.includes('date') || normalized.includes('time');
                      if (hasDateKeyword) {
                        const date = parseDateFromColumnName(h);
                        if (date && !isNaN(date.getTime())) {
                          rtuTrackerDateColumns.push({ name: h, date, index });
                        }
                      }
                    });
                    
                    // Find the latest date column
                    let latestRtuTrackerDateColumn: string | null = null;
                    let latestRtuTrackerDateColumnIndex: number = -1;
                    if (rtuTrackerDateColumns.length > 0) {
                      rtuTrackerDateColumns.sort((a, b) => b.date.getTime() - a.date.getTime()); // Latest first
                      latestRtuTrackerDateColumn = rtuTrackerDateColumns[0].name;
                      latestRtuTrackerDateColumnIndex = rtuTrackerDateColumns[0].index;
                      console.log('MY DIVISION DATA - RTU-TRACKER latest date column found:', latestRtuTrackerDateColumn);
                    } else {
                      console.error('MY DIVISION DATA - Cannot find latest date column - no date columns found!');
                    }
                    
                    // Find ALL columns after the latest date column
                    let rtuTrackerColumnsToInsert: string[] = [];
                    // Reset the higher-scope tracking variable for this RTU-TRACKER file
                    rtuTrackerColumnsList = [];
                    
                    // Determine start index: use latest date column if found, otherwise use SITE CODE position
                    let startIndex = -1;
                    if (latestRtuTrackerDateColumnIndex !== -1 && latestRtuTrackerDateColumnIndex + 1 < rtuTrackerHeaders.length) {
                      startIndex = latestRtuTrackerDateColumnIndex + 1;
                      console.log('MY DIVISION DATA - Using latest date column + 1 as start index:', startIndex);
                    } else if (rtuTrackerSiteCodeHeader) {
                      // Fallback: if no date columns found, use all columns after SITE CODE
                      const siteCodeIndex = rtuTrackerHeaders.indexOf(rtuTrackerSiteCodeHeader);
                      if (siteCodeIndex !== -1 && siteCodeIndex + 1 < rtuTrackerHeaders.length) {
                        startIndex = siteCodeIndex + 1;
                        console.log('MY DIVISION DATA - FALLBACK: Using SITE CODE + 1 as start index:', startIndex);
                      }
                    }
                    
                    if (startIndex !== -1 && startIndex < rtuTrackerHeaders.length) {
                      // Get all columns after the start index (either latest date or SITE CODE)
                      // Exclude SITE CODE column and any date columns (but include all other columns until end)
                      for (let i = startIndex; i < rtuTrackerHeaders.length; i++) {
                        const header = rtuTrackerHeaders[i];
                        const normalizedHeader = normalizeHeaderForRtuTracker(header);
                        
                        // Skip SITE CODE column (we don't want to duplicate it)
                        if (normalizedHeader === 'site code' || normalizedHeader === 'sitecode' || normalizedHeader === 'site_code') {
                          continue; // Skip SITE CODE but continue to next columns
                        }
                        
                        // Skip date columns (we only want data columns, not date columns)
                        const isDateColumn = normalizedHeader.includes('date') || normalizedHeader.includes('time');
                        if (isDateColumn) {
                          continue;
                        }
                        
                        // Include this column
                        rtuTrackerColumnsToInsert.push(header);
                        rtuTrackerColumnsList.push(header); // Also track in higher-scope variable
                      }
                      
                      console.log('MY DIVISION DATA - RTU-TRACKER columns after latest date FOUND:', rtuTrackerColumnsToInsert);
                    }
                    
                    // If we found columns to insert and SITE CODE exists in both files
                    if (mainSiteCodeHeader && rtuTrackerSiteCodeHeader && rtuTrackerColumnsToInsert.length > 0) {
                      console.log('MY DIVISION DATA - All merge conditions met - proceeding with RTU-TRACKER merge');
                      // Filter rows: only include rows where the latest date column has a value
                      let filteredRtuTrackerRows = [...rtuTrackerRows];
                      if (latestRtuTrackerDateColumn) {
                        filteredRtuTrackerRows = rtuTrackerRows.filter((row: any) => {
                          const dateValue = row[latestRtuTrackerDateColumn!];
                          return dateValue !== null && dateValue !== undefined && String(dateValue).trim() !== '';
                        });
                        console.log(`MY DIVISION DATA - Filtered RTU-TRACKER rows: ${filteredRtuTrackerRows.length} rows have data in latest date column "${latestRtuTrackerDateColumn}"`);
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
                      
                      console.log('MY DIVISION DATA - Mapped RTU-TRACKER data for', rtuTrackerMap.size, 'unique SITE CODEs');
                      
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
                      
                      console.log('MY DIVISION DATA - Merged RTU-TRACKER columns into', mergedRtuTrackerCount, 'rows');
                      
                      // Add RTU-TRACKER columns to columns to insert (before SITE CODE)
                      rtuTrackerColumnsToInsert.forEach((col: string) => {
                        if (!columnsToInsert.includes(col)) {
                          columnsToInsert.push(col);
                          onlineOfflineColumnsToPreserve.push(col);
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
                          console.log('MY DIVISION DATA - Inserted RTU-TRACKER columns before SITE CODE at index', siteCodeIndexInHeaders);
                        } else {
                          // If SITE CODE not found, add at the end
                          hdrs = [...hdrs, ...rtuTrackerColumnsToAdd];
                          console.log('MY DIVISION DATA - RTU-TRACKER columns added at the end (SITE CODE not found):', rtuTrackerColumnsToAdd);
                        }
                      }
                      
                      // Ensure RTU-TRACKER columns are in onlineOfflineColumnsToPreserve
                      rtuTrackerColumnsToInsert.forEach((col: string) => {
                        if (!onlineOfflineColumnsToPreserve.includes(col)) {
                          onlineOfflineColumnsToPreserve.push(col);
                        }
                      });
                    } else {
                      console.error('MY DIVISION DATA - Cannot merge RTU-TRACKER data - merge conditions not met');
                    }
                  } else {
                    console.error('MY DIVISION DATA - RTU-TRACKER file data fetch failed or no data');
                  }
                } catch (error) {
                  console.error('MY DIVISION DATA - ERROR fetching RTU-TRACKER file:', error);
                  // Continue even if RTU-TRACKER fetch fails
                }
              } else {
                console.error('MY DIVISION DATA - NO RTU-TRACKER FILE FOUND');
              }
            }
          } catch (error) {
            console.error('MY DIVISION DATA - ERROR: Exception while fetching RTU-TRACKER files:', error);
            // Continue with main file data even if RTU-TRACKER fetch fails
          }
          
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
              console.warn('MY DIVISION DATA - SITE CODE not found in headers, skipping reordering');
              return headers;
            }
            
            const reordered = [...headers];
            const siteCodeHeader = reordered.splice(siteCodeIndex, 1)[0];
            
            // Remove ONLINE-OFFLINE and RTU-TRACKER columns if they exist (we know which ones they are)
            const columnsToMove: string[] = [];
            if (columnsToPreserve.length > 0) {
              // Find and remove each column to preserve (ONLINE-OFFLINE and RTU-TRACKER)
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
                  // Even if not found, add it to columnsToMove so it gets added back
                  columnsToMove.push(col);
                }
              });
            }
            
            // Find and remove ATTRIBUTE if it exists
            let attributeHeader: string | null = null;
            if (attributeIndex !== -1) {
              let adjustedIndex = attributeIndex;
              if (adjustedIndex > siteCodeIndex) adjustedIndex--; // SITE CODE was removed
              adjustedIndex -= columnsToMove.filter(col => {
                const originalIndex = headers.indexOf(col);
                return originalIndex !== -1 && originalIndex < attributeIndex;
              }).length; // Columns before ATTRIBUTE were removed
              
              if (adjustedIndex >= 0 && adjustedIndex < reordered.length) {
                attributeHeader = reordered.splice(adjustedIndex, 1)[0];
              }
            }
            
            // Insert ATTRIBUTE, then SITE CODE right after it, then ONLINE-OFFLINE and RTU-TRACKER columns
            // All at the end of the column list
            if (attributeHeader) {
              // Add ATTRIBUTE, then SITE CODE right after it, then ONLINE-OFFLINE and RTU-TRACKER columns
              reordered.push(attributeHeader);
              reordered.push(siteCodeHeader);
              // Add all columns (ONLINE-OFFLINE + RTU-TRACKER) after SITE CODE
              reordered.push(...columnsToMove);
            } else {
              // If no ATTRIBUTE, add SITE CODE at the end, then ONLINE-OFFLINE and RTU-TRACKER columns
              reordered.push(siteCodeHeader);
              reordered.push(...columnsToMove);
            }
            
            return reordered;
          };
          
          // CRITICAL FINAL UPDATE: Ensure onlineOfflineColumnsToPreserve contains ALL columns
          const allColumnsToPreserve = new Set<string>();
          
          // Add ONLINE-OFFLINE columns FIRST (they MUST be preserved)
          onlineOfflineColumnsList.forEach(col => {
            allColumnsToPreserve.add(col);
          });
          
          // Add RTU-TRACKER columns
          const nonOnlineOfflineColumns = columnsToInsert.filter(col => !onlineOfflineColumnsList.includes(col));
          const allRtuTrackerColumns = new Set([...nonOnlineOfflineColumns, ...rtuTrackerColumnsList]);
          const finalRtuTrackerColumns = Array.from(allRtuTrackerColumns);
          finalRtuTrackerColumns.forEach(col => {
            allColumnsToPreserve.add(col);
            if (!columnsToInsert.includes(col)) {
              columnsToInsert.push(col);
            }
            if (!onlineOfflineColumnsToPreserve.includes(col)) {
              onlineOfflineColumnsToPreserve.push(col);
            }
          });
          
          // Add all columns from columnsToInsert
          columnsToInsert.forEach(col => {
            allColumnsToPreserve.add(col);
          });
          
          // Add all columns from onlineOfflineColumnsToPreserve
          onlineOfflineColumnsToPreserve.forEach(col => {
            allColumnsToPreserve.add(col);
          });
          
          // Update onlineOfflineColumnsToPreserve with the complete set
          onlineOfflineColumnsToPreserve = Array.from(allColumnsToPreserve);
          
          // Verify all columns are in headers before reordering
          onlineOfflineColumnsToPreserve.forEach(col => {
            if (!hdrs.includes(col)) {
              const siteCodeIdx = hdrs.indexOf(mainSiteCodeHeader || '');
              if (siteCodeIdx !== -1) {
                hdrs.splice(siteCodeIdx, 0, col);
              } else {
                hdrs.push(col);
              }
            }
          });
          
          hdrs = reorderHeaders(hdrs, onlineOfflineColumnsToPreserve);
          
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
                  result.push(header);
                  seen.add(normalized);
                  firstSLNoFound = true;
                }
              } else {
                result.push(header);
              }
            });
            
            return result;
          };
          
          // Remove duplicate SL.No columns
          hdrs = removeDuplicateSLNoColumns(hdrs);
          
          // Add missing columns to rows with empty values
          const missingColumnsInRows: string[] = [];
          hdrs.forEach((header: string) => {
            const hasColumn = fileRows.length === 0 || fileRows[0].hasOwnProperty(header);
            if (!hasColumn) {
              missingColumnsInRows.push(header);
            }
          });
          
          if (missingColumnsInRows.length > 0) {
            fileRows = fileRows.map((row: any) => {
              const updatedRow = { ...row };
              missingColumnsInRows.forEach(col => {
                if (!updatedRow.hasOwnProperty(col)) {
                  updatedRow[col] = '';
                }
              });
              return updatedRow;
            });
          }
          
          // ===== END OF MERGING LOGIC FROM ViewData.tsx =====
          
          // Find DIVISION column in the data (after all merging is complete)
          const divisionHeader = hdrs.find((h: string) => {
            const normalized = normalizeHeader(h);
            return normalized === 'division';
          });
          
          console.log('MY DIVISION DATA - Division header found:', divisionHeader);
          console.log('MY DIVISION DATA - User divisions:', userDivisions);
          
          // Filter rows by user's assigned divisions (case-insensitive)
          // This filtering happens AFTER all merging is complete
          if (divisionHeader && userDivisions.length > 0) {
            const normalizedUserDivisions = userDivisions.map((div: string) => normalize(div));
            console.log('MY DIVISION DATA - Normalized user divisions:', normalizedUserDivisions);
            
            const originalRowCount = fileRows.length;
            fileRows = fileRows.filter((row: any) => {
              const rowDivision = String(row[divisionHeader] || '').trim();
              const normalizedRowDivision = normalize(rowDivision);
              
              // Check if row's division matches any of user's divisions (case-insensitive)
              const matches = normalizedUserDivisions.some((userDiv: string) => 
                normalizedRowDivision === userDiv
              );
              
              return matches;
            });
            
            console.log(`MY DIVISION DATA - Filtered ${fileRows.length} rows matching user divisions out of ${originalRowCount} total rows`);
          } else {
            if (!divisionHeader) {
              console.warn('MY DIVISION DATA - No DIVISION column found in data. Showing all rows.');
            }
            if (userDivisions.length === 0) {
              console.warn('MY DIVISION DATA - No user divisions found. Showing all rows.');
            }
          }
          
          setAllRows(fileRows);
          setRows(fileRows);
          setHeaders(hdrs);
          setCurrentPage(1);
          
          console.log('MY DIVISION DATA - State set successfully');
        }
      } catch (error) {
        console.error('Error fetching file data:', error);
        setRows([]);
        setHeaders([]);
      }
    })();
  }, [selectedFile, userDivisions, refreshTrigger]);

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

    const title = 'My Division Data Export';
    const fileName = (uploadedFiles.find(f=>f.id===selectedFile)?.name||'data');
    
    // Get user information
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const userName = currentUser?.fullName || currentUser?.userId || 'Unknown User';
    const userRole = currentUser?.role || getCurrentUserRole() || 'Unknown Role';
    const userDesignation = currentUser?.designation || currentUser?.Designation || 'N/A';
    const userDivisionsStr = (currentUser?.division || []).join(', ') || 'N/A';
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
        font-size: 11px; 
        color: #666; 
        margin: 2px 0;
      }
      table { 
        width: 100%; 
        border-collapse: collapse; 
        margin-top: 10px;
        font-size: 9px;
      }
      th { 
        background: linear-gradient(90deg, #dbeafe 0%, #bae6fd 100%);
        border: 1px solid #94a3b8;
        padding: 4px;
        text-align: center;
        font-weight: bold;
        font-size: 9px;
      }
      td { 
        border: 1px solid #94a3b8;
        padding: 3px;
        text-align: center;
        font-size: 9px;
      }
      tr:nth-child(even) { background-color: #f0f9ff; }
    `;

    w.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <style>${styles}</style>
        </head>
        <body>
          <div class="header-section">
            <h3>${title}</h3>
            <div class="meta"><strong>File:</strong> ${fileName}</div>
            <div class="meta"><strong>User:</strong> ${userName} (${userRole})</div>
            <div class="meta"><strong>Designation:</strong> ${userDesignation}</div>
            <div class="meta"><strong>Division:</strong> ${userDivisionsStr}</div>
            <div class="meta"><strong>Downloaded:</strong> ${downloadTime}</div>
            <div class="meta"><strong>Total Records:</strong> ${sortedRows.length}</div>
          </div>
          <table>
            <thead>
              <tr>
                ${headers.map((h: string) => `<th>${h}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${sortedRows.map((row: any) => `
                <tr>
                  ${headers.map((h: string) => `<td>${String(row[h] ?? '')}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `);
    w.document.close();
    setTimeout(() => w.print(), 250);
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
        <h2 className="text-2xl font-bold mb-2 text-gray-800">My Division Data</h2>
        <p className="text-gray-500">No files uploaded yet. Please upload from Upload tab.</p>
        {userDivisions.length > 0 && (
          <p className="text-sm text-gray-600 mt-2">Your assigned divisions: {userDivisions.join(', ')}</p>
        )}
      </div>
    );
  }

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">My Division Data</h2>
      {userDivisions.length > 0 && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-gray-700">
            <strong>Showing data for your assigned divisions:</strong> {userDivisions.join(', ')}
          </p>
        </div>
      )}
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


