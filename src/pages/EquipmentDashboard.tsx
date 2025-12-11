import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

type UploadedFile = {
  fileId: string;
  name: string;
  uploadType?: string;
  uploadedAt?: string;
  createdAt?: string;
};

type OnlineOfflineRow = Record<string, any>;
type MergedRow = Record<string, any> & {
  __statusDate?: Date | null;
  __deviceStatus?: string;
  __equipLRSwitchStatus?: string;
  __rtuLRSwitchStatus?: string;
};

function getCurrentUser() {
  try {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function normalize(str: string): string {
  return String(str || '').trim().toLowerCase();
}

// Helper function to format a Date to YYYY-MM-DD string (local timezone, no time component)
function formatDateToISO(date: Date | null): string {
  if (!date || isNaN(date.getTime())) return '';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function pickLatestUpload(files: UploadedFile[], predicate: (f: UploadedFile) => boolean): UploadedFile | undefined {
  return files
    .filter(predicate)
    .sort((a, b) => {
      const ta = a.uploadedAt || a.createdAt;
      const tb = b.uploadedAt || b.createdAt;
      const da = ta ? new Date(ta).getTime() : 0;
      const db = tb ? new Date(tb).getTime() : 0;
      return db - da;
    })[0];
}

export default function EquipmentDashboard() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const role = user?.role || '';
  const userDivisions: string[] = Array.isArray(user?.division)
    ? user.division
    : user?.division
    ? [user.division]
    : [];

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [mergedRows, setMergedRows] = useState<MergedRow[]>([]);
  const [divisionFilter, setDivisionFilter] = useState<string>('');
  const [subDivisionFilter, setSubDivisionFilter] = useState<string>('');
  const [circleFilter, setCircleFilter] = useState<string>('');
  const [snapshotDateLabel, setSnapshotDateLabel] = useState<string>(''); // latest date detected from data (yyyy-MM-dd)
  const [selectedDate, setSelectedDate] = useState<string>(''); // value bound to the Date picker
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Trigger to refresh dashboard when ViewData is updated

  // Listen for ViewData updates to refresh dashboard
  useEffect(() => {
    const handleViewDataUpdate = () => {
      console.log('ViewData updated, refreshing dashboard...');
      // Trigger a refresh by updating a state that causes the data fetch to re-run
      setRefreshTrigger(prev => prev + 1);
    };

    window.addEventListener('viewDataUpdated', handleViewDataUpdate);
    return () => {
      window.removeEventListener('viewDataUpdated', handleViewDataUpdate);
    };
  }, []);

  useEffect(() => {
    (async () => {
      // Allow both Equipment and CCR roles
      if (role !== 'Equipment' && role !== 'CCR') {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('Authentication required. Please sign in again.');
        }

        // 1) Fetch all uploads
        const uploadsRes = await fetch('http://localhost:5000/api/uploads', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!uploadsRes.ok) {
          throw new Error('Failed to fetch uploads list.');
        }
        const uploadsJson = await uploadsRes.json();
        const files: UploadedFile[] = uploadsJson.files || [];

        // 2) Find latest Device Status Upload file (where user edits are saved)
        // Use same logic as ViewData: uploadType === 'device-status-upload'
        const deviceStatusFile = pickLatestUpload(files, (f) => {
          const name = normalize(f.name || '');
          const uploadTypeValue = f.uploadType;
          const uploadType = uploadTypeValue ? String(uploadTypeValue).toLowerCase().trim() : '';
          
          // STRICT: Only files with uploadType === 'device-status-upload'
          const isByType = uploadType === 'device-status-upload';
          
          // Also check filename patterns as fallback
          const isByName = 
            name.includes('device status') ||
            name.includes('device_status') ||
            name.includes('devicestatus');
          
          // Exclude ONLINE-OFFLINE and RTU-TRACKER files
          const isOnlineOfflineFileName = name.includes('online-offline') || 
                                         name.includes('online_offline') ||
                                         name.includes('onlineoffline');
          const normalizedFileName = name.replace(/[-_\s]/g, '');
          const isRtuTrackerFileName = 
            name.includes('rtu-tracker') || 
            name.includes('rtu_tracker') ||
            name.includes('rtu tracker') ||
            name.includes('rtutracker') ||
            normalizedFileName.includes('rtutracker') ||
            /rtu.*tracker/i.test(f.name || '');
          
          const isNotOnlineOffline = !isOnlineOfflineFileName && uploadType !== 'online-offline-data';
          const isNotRtuTracker = !isRtuTrackerFileName && uploadType !== 'rtu-tracker';
          
          const shouldInclude = (isByType || isByName) && isNotOnlineOffline && isNotRtuTracker;
          
          if (shouldInclude) {
            console.log(`CCR Dashboard - Found Device Status Upload file: ${f.name} (uploadType: ${uploadTypeValue})`);
          }
          
          return shouldInclude;
        });
        
        if (!deviceStatusFile) {
          console.warn('CCR Dashboard - No Device Status Upload file found.');
          console.warn('CCR Dashboard - Available files:', files.map(f => ({ 
            name: f.name, 
            uploadType: f.uploadType,
            fileId: f.fileId 
          })));
        } else {
          console.log(`CCR Dashboard - Using Device Status Upload file: ${deviceStatusFile.name} (fileId: ${deviceStatusFile.fileId}, uploadType: ${deviceStatusFile.uploadType})`);
        }

        // 3) Find latest ONLINE-OFFLINE file
        const onlineOfflineFile = pickLatestUpload(files, (f) => {
          const name = normalize(f.name || '');
          const type = normalize(f.uploadType || '');
          const isByName =
            name.includes('online-offline') ||
            name.includes('online_offline') ||
            name.includes('onlineoffline');
          const isByType = type === 'online-offline-data';
          return isByName || isByType;
        });

        if (!onlineOfflineFile) {
          throw new Error('No ONLINE-OFFLINE file found.');
        }

        // 3) Fetch Device Status Upload file data (if available) - this contains user edits
        let deviceStatusRows: any[] = [];
        let deviceStatusHeaders: string[] = [];
        let mainSiteCodeHeader = '';
        
        if (deviceStatusFile) {
          console.log('CCR Dashboard - Fetching Device Status Upload file:', deviceStatusFile.name);
          try {
            const dsRes = await fetch(`http://localhost:5000/api/uploads/${deviceStatusFile.fileId}`, {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });
            const dsJson = await dsRes.json();
            if (dsJson?.success && dsJson.file) {
              deviceStatusRows = Array.isArray(dsJson.file.rows) ? dsJson.file.rows : [];
              deviceStatusHeaders = dsJson.file.headers && dsJson.file.headers.length 
                ? dsJson.file.headers 
                : (deviceStatusRows[0] ? Object.keys(deviceStatusRows[0]) : []);
              
              // Find SITE CODE header in Device Status Upload file
              mainSiteCodeHeader = deviceStatusHeaders.find((h: string) => {
                const n = normalize(h);
                return n === 'site code' || n === 'sitecode' || n === 'site_code';
              }) || '';
              
              console.log('CCR Dashboard - Device Status Upload file loaded:', {
                rows: deviceStatusRows.length,
                headers: deviceStatusHeaders.length,
                siteCodeHeader: mainSiteCodeHeader
              });
            }
          } catch (error) {
            console.warn('CCR Dashboard - Failed to load Device Status Upload file, using ONLINE-OFFLINE only:', error);
          }
        }

        // 4) Fetch ONLINE-OFFLINE file data
        const ooRes = await fetch(`http://localhost:5000/api/uploads/${onlineOfflineFile.fileId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const ooJson = await ooRes.json();
        if (!ooJson?.success || !ooJson.file) {
          throw new Error('Failed to load ONLINE-OFFLINE data file.');
        }

        const ooData = ooJson.file;
        const ooRows: OnlineOfflineRow[] = Array.isArray(ooData.rows) ? ooData.rows : [];
        const ooHeaders: string[] =
          ooData.headers && ooData.headers.length ? ooData.headers : ooRows[0] ? Object.keys(ooRows[0]) : [];

        // 5) Identify columns in ONLINE-OFFLINE
        const siteCodeHeader =
          ooHeaders.find((h) => {
            const n = normalize(h);
            return n === 'site code' || n === 'sitecode' || n === 'site_code';
          }) || '';
        
        console.log(`CCR Dashboard - Site Code Header: "${siteCodeHeader}"`);
        if (!siteCodeHeader) {
          console.error(`CCR Dashboard - ERROR: Site Code header not found! Available headers:`, ooHeaders.slice(0, 10));
        } else {
          // Log sample site codes from first few rows
          const sampleSiteCodes = ooRows.slice(0, 5).map(row => String(row[siteCodeHeader] || '').trim()).filter(sc => sc);
          console.log(`CCR Dashboard - Sample site codes (first 5):`, sampleSiteCodes);
        }

        const deviceStatusHeader =
          ooHeaders.find((h) => {
            const n = normalize(h);
            return (
              n === 'device status' ||
              n === 'device_status' ||
              n === 'devicestatus' ||
              (n.includes('device') && n.includes('status'))
            );
          }) || '';

        // Try to detect Equipment L/R switch status column with flexible matching
        const equipLRSwitchHeader =
          ooHeaders.find((h) => {
            const n = normalize(h);
            return (
              // Common explicit names
              n === 'equipment l/r switch status' ||
              n === 'equipment_l/r_switch_status' ||
              n === 'equipmentlr switch status'.replace(' ', '') ||
              // Flexible: contains some form of "equipment" or "eqpt"/"equip", "l/r"/"lr", and "switch" or "status"
              ((n.includes('equipment') || n.includes('equip') || n.includes('eqpt')) &&
                (n.includes('l/r') || n.includes('lr') || n.includes('l r')) &&
                (n.includes('switch') || n.includes('status'))) ||
              // Fallback: any column that looks like "L/R switch status" without equipment prefix
              ((n.includes('l/r') || n.includes('lr') || n.includes('l r')) &&
                n.includes('switch') &&
                n.includes('status'))
            );
          }) || '';

        const rtuLRSwitchHeader =
          ooHeaders.find((h) => {
            const n = normalize(h);
            return (
              // Common explicit names
              n === 'rtu l/r switch status' ||
              n === 'rtu_l/r_switch_status' ||
              // Flexible: contains "rtu", some L/R marker and "switch"/"status"
              (n.includes('rtu') &&
                (n.includes('l/r') || n.includes('lr') || n.includes('l r')) &&
                (n.includes('switch') || n.includes('status')))
            );
          }) || '';

        // Date parsing helpers
        const parseDateFromString = (value: string): Date | null => {
          const str = value.trim();
          
          // Try DD-MM-YYYY or DD/MM/YYYY format first (most common in Indian date format)
          const ddmmyyyyPattern = /^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/;
          const ddmmyyyyMatch = str.match(ddmmyyyyPattern);
          if (ddmmyyyyMatch) {
            const day = parseInt(ddmmyyyyMatch[1], 10);
            const month = parseInt(ddmmyyyyMatch[2], 10) - 1; // Month is 0-indexed
            const year = parseInt(ddmmyyyyMatch[3], 10);
            const date = new Date(year, month, day);
            // Validate the date (check if it's a valid date and matches input)
            if (!isNaN(date.getTime()) && date.getDate() === day && date.getMonth() === month && date.getFullYear() === year) {
              return date;
            }
          }
          
          // Try YYYY-MM-DD or YYYY/MM/DD format
          const yyyymmddPattern = /^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/;
          const yyyymmddMatch = str.match(yyyymmddPattern);
          if (yyyymmddMatch) {
            const year = parseInt(yyyymmddMatch[1], 10);
            const month = parseInt(yyyymmddMatch[2], 10) - 1; // Month is 0-indexed
            const day = parseInt(yyyymmddMatch[3], 10);
            const date = new Date(year, month, day);
            // Validate the date
            if (!isNaN(date.getTime()) && date.getDate() === day && date.getMonth() === month && date.getFullYear() === year) {
              return date;
            }
          }
          
          return null;
        };

        const parseCellDate = (raw: any, isDateColumn: boolean = false): Date | null => {
          if (raw === null || raw === undefined || raw === '') return null;
          
          // If it's already a Date object, validate and return
          if (raw instanceof Date) {
            if (!isNaN(raw.getTime())) {
              return raw;
            }
            return null;
          }

          const str = String(raw).trim();
          
          // First priority: Try parsing as string date (DD-MM-YYYY, YYYY-MM-DD, etc.)
          // This handles cases where Excel exports dates as strings
          const fromString = parseDateFromString(str);
          if (fromString && !isNaN(fromString.getTime())) {
            const year = fromString.getFullYear();
            if (year >= 1900 && year <= 2100) {
              return fromString;
            }
          }

          // Second priority: Try Excel serial number conversion (only if it's clearly a number)
          // Excel serial numbers are typically 1-100000+ (days since 1900-01-01)
          const numValue = typeof raw === 'number' ? raw : (str && !isNaN(Number(str)) && str.indexOf('-') === -1 && str.indexOf('/') === -1 ? parseFloat(str) : NaN);
          
          if (Number.isFinite(numValue) && numValue > 0 && numValue < 1000000) {
            // Only treat as Excel serial if:
            // 1. It's explicitly in a date column, OR
            // 2. It's a large number (> 10000) that looks like a serial date (not a year)
            if (isDateColumn || (numValue > 10000 && numValue < 100000)) {
              // Excel serial date conversion
              // Excel serial 1 = 1900-01-01
              // Excel incorrectly treats 1900 as a leap year (serial 60 = 1900-02-29, serial 61 = 1900-03-01)
              // For serial >= 61, subtract 1 to account for the fake leap day
              let excelDate: Date;
              if (numValue >= 61) {
                excelDate = new Date(1900, 0, numValue - 1);
              } else {
                excelDate = new Date(1900, 0, numValue);
              }
              if (!isNaN(excelDate.getTime())) {
                const year = excelDate.getFullYear();
                if (year >= 1900 && year <= 2100) {
                  return excelDate;
                }
              }
            }
          }

          // Third priority: Try native Date parsing as a final fallback (e.g. ISO strings)
          const native = new Date(str);
          if (!isNaN(native.getTime())) {
            const year = native.getFullYear();
            if (year >= 1900 && year <= 2100) {
              return native;
            }
          }

          return null;
        };

        // Determine the latest date present in the ONLINE-OFFLINE data.
        // Find DATE columns: columns with header "DATE" or headers that are dates (e.g., "17-11-2025")
        const dateHeaderNames: string[] = [];
        const dateHeaderMap = new Map<string, Date>(); // Map header name to parsed date
        
        ooHeaders.forEach((h) => {
          const normalized = normalize(h);
          // Check if header is exactly "date"
          if (normalized === 'date') {
            dateHeaderNames.push(h);
            console.log(`CCR Dashboard - Found DATE column: "${h}"`);
            
            // If header is "DATE", read the date from row 2 (first data row, index 0 in ooRows)
            // But also check if there are multiple different dates in this column
            if (ooRows.length > 0) {
              const row2DateValue = ooRows[0][h]; // First row in ooRows is actually row 2 of the Excel
              const parsedRow2Date = parseCellDate(row2DateValue, true);
              if (parsedRow2Date && !isNaN(parsedRow2Date.getTime())) {
                dateHeaderMap.set(h, parsedRow2Date);
                console.log(`CCR Dashboard - Date from row 2 in "${h}" column: ${formatDateToISO(parsedRow2Date)}`);
                
                // Check if there are other dates in this DATE column (scan first 10 rows)
                const uniqueDatesInColumn = new Set<string>();
                ooRows.slice(0, 10).forEach((row) => {
                  const cellValue = row[h];
                  const parsed = parseCellDate(cellValue, true);
                  if (parsed && !isNaN(parsed.getTime())) {
                    uniqueDatesInColumn.add(formatDateToISO(parsed));
                  }
                });
                if (uniqueDatesInColumn.size > 1) {
                  console.log(`CCR Dashboard - WARNING: Multiple dates found in "${h}" column (first 10 rows):`, Array.from(uniqueDatesInColumn));
                  console.log(`CCR Dashboard - Using date from row 2: ${formatDateToISO(parsedRow2Date)}`);
                }
              } else {
                console.log(`CCR Dashboard - Could not parse date from row 2 in "${h}" column. Value:`, row2DateValue);
              }
            }
          } else {
            // Check if header IS a date (e.g., "17-11-2025", "18-11-2025", "20-11-2025")
            // Try multiple parsing approaches
            let headerDate = parseDateFromString(h);
            
            // If direct parsing failed, try trimming and cleaning the header
            if (!headerDate || isNaN(headerDate.getTime())) {
              const cleaned = String(h).trim().replace(/\s+/g, ' ');
              headerDate = parseDateFromString(cleaned);
            }
            
            // If still failed, try removing any prefix/suffix (e.g., "DATE 17-11-2025" -> "17-11-2025")
            if (!headerDate || isNaN(headerDate.getTime())) {
              const dateMatch = String(h).match(/(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/);
              if (dateMatch) {
                headerDate = parseDateFromString(dateMatch[1]);
              }
            }
            
            if (headerDate && !isNaN(headerDate.getTime())) {
              dateHeaderNames.push(h);
              dateHeaderMap.set(h, headerDate);
              console.log(`CCR Dashboard - Found date header: "${h}" -> ${formatDateToISO(headerDate)}`);
            }
          }
        });
        
        // FALLBACK: If no date headers found, scan ALL headers for date-like patterns
        if (dateHeaderNames.length === 0) {
          console.log('CCR Dashboard - No date headers found, scanning all headers for date patterns...');
          ooHeaders.forEach((h) => {
            const str = String(h).trim();
            // Look for patterns like: DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD, etc.
            const datePatterns = [
              /(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/,  // DD-MM-YYYY or DD/MM/YYYY
              /(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/,  // YYYY-MM-DD or YYYY/MM/DD
            ];
            
            for (const pattern of datePatterns) {
              const match = str.match(pattern);
              if (match) {
                let headerDate: Date | null = null;
                if (pattern.source.includes('\\d{4}') && pattern.source.startsWith('(\\d{4})')) {
                  // YYYY-MM-DD format
                  headerDate = parseDateFromString(`${match[1]}-${match[2]}-${match[3]}`);
                } else {
                  // DD-MM-YYYY format
                  headerDate = parseDateFromString(`${match[1]}-${match[2]}-${match[3]}`);
                }
                
                if (headerDate && !isNaN(headerDate.getTime())) {
                  if (!dateHeaderNames.includes(h)) {
                    dateHeaderNames.push(h);
                    dateHeaderMap.set(h, headerDate);
                    console.log(`CCR Dashboard - Found date header (fallback): "${h}" -> ${formatDateToISO(headerDate)}`);
                  }
                  break;
                }
              }
            }
          });
        }

        // Find the latest date from headers (when headers are dates) or from row 2 (when header is "DATE")
        let latestDateValue: Date | null = null;
        
        // Check dates from dateHeaderMap (includes dates from row 2 for DATE columns)
        dateHeaderMap.forEach((date) => {
          if (!latestDateValue || date.getTime() > latestDateValue.getTime()) {
            latestDateValue = date;
          }
        });
        
        // If no dates found in dateHeaderMap, scan cell values in DATE columns as fallback
        if (latestDateValue === null && dateHeaderNames.length > 0) {
          ooRows.forEach((row) => {
            dateHeaderNames.forEach((h) => {
              // Only parse cell values if we don't already have a date for this header
              if (!dateHeaderMap.has(h)) {
                const raw = row[h];
                const parsed = parseCellDate(raw, true);
                if (parsed && !isNaN(parsed.getTime())) {
                  if (!latestDateValue || parsed.getTime() > latestDateValue.getTime()) {
                    latestDateValue = parsed;
                  }
                }
              }
            });
          });
        }
        console.log('CCR Dashboard - ONLINE-OFFLINE headers:', ooHeaders);
        console.log('CCR Dashboard - Date headers found:', Array.from(dateHeaderMap.entries()).map(([h, d]) => `${h} -> ${formatDateToISO(d)}`));
        console.log('CCR Dashboard - Number of date header columns:', dateHeaderNames.length);
        console.log('CCR Dashboard - Date header names:', dateHeaderNames);
        console.log('CCR Dashboard - Total ONLINE-OFFLINE rows:', ooRows.length);
        
        // Show dates from row 2 for DATE columns
        const datesFromRow2 = Array.from(dateHeaderMap.entries())
          .filter(([h]) => normalize(h) === 'date')
          .map(([h, d]) => `"${h}": ${formatDateToISO(d)}`);
        if (datesFromRow2.length > 0) {
          console.log('CCR Dashboard - Dates from row 2 for DATE columns:', datesFromRow2);
        }
        
        // Critical: Show all DATE columns found and their row 2 dates
        console.log('CCR Dashboard - ====== DATE COLUMN ANALYSIS ======');
        console.log('CCR Dashboard - Total DATE columns found:', dateHeaderNames.length);
        dateHeaderNames.forEach((dateHeader, index) => {
          const row2Value = ooRows.length > 0 ? ooRows[0][dateHeader] : 'N/A';
          const hasDateInMap = dateHeaderMap.has(dateHeader);
          const dateFromMap = hasDateInMap ? formatDateToISO(dateHeaderMap.get(dateHeader)!) : 'NONE';
          console.log(`CCR Dashboard - DATE column #${index + 1}: "${dateHeader}"`);
          console.log(`CCR Dashboard -   Row 2 value:`, row2Value);
          console.log(`CCR Dashboard -   Date in map:`, dateFromMap);
        });
        console.log('CCR Dashboard - ====================================');
        
        // Critical: Check if "20-11-2025" header is detected (latest date)
        const header20Nov = dateHeaderNames.find(h => {
          const parsed = parseDateFromString(h);
          return parsed && formatDateToISO(parsed) === '2025-11-20';
        });
        if (header20Nov) {
          console.log('CCR Dashboard - Found 20-11-2025 header:', header20Nov);
          // Ensure latestDateValue is set to 20-11-2025 if it's the latest
          const date20Nov = dateHeaderMap.get(header20Nov);
          if (date20Nov instanceof Date) {
            if (latestDateValue === null) {
              latestDateValue = date20Nov;
              console.log('CCR Dashboard - Set latestDateValue to 20-11-2025');
            } else if (latestDateValue instanceof Date && date20Nov.getTime() > latestDateValue.getTime()) {
              latestDateValue = date20Nov;
              console.log('CCR Dashboard - Set latestDateValue to 20-11-2025');
            }
          }
        }
        
        // Also check for other dates for debugging
        const header17Nov = dateHeaderNames.find(h => {
          const parsed = parseDateFromString(h);
          return parsed && formatDateToISO(parsed) === '2025-11-17';
        });
        const header18Nov = dateHeaderNames.find(h => {
          const parsed = parseDateFromString(h);
          return parsed && formatDateToISO(parsed) === '2025-11-18';
        });
        console.log('CCR Dashboard - Header for 2025-11-17 found:', header17Nov || 'NOT FOUND');
        console.log('CCR Dashboard - Header for 2025-11-18 found:', header18Nov || 'NOT FOUND');
        
        // Check if headers contain "17" or "18" in any form
        const headersWith17 = ooHeaders.filter(h => String(h).includes('17'));
        const headersWith18 = ooHeaders.filter(h => String(h).includes('18'));
        console.log('CCR Dashboard - Headers containing "17":', headersWith17);
        console.log('CCR Dashboard - Headers containing "18":', headersWith18);
        console.log(
          'CCR Dashboard - Computed latestDateValue:',
          latestDateValue ? formatDateToISO(latestDateValue) : 'NONE'
        );
        
        // Debug: Test parsing "17-11-2025" specifically
        const testDate = parseDateFromString('17-11-2025');
        console.log('CCR Dashboard - Test parse "17-11-2025":', testDate ? formatDateToISO(testDate) : 'FAILED');
        
        // Debug: Show sample of first row to understand structure
        if (ooRows.length > 0) {
          console.log('CCR Dashboard - Sample first row keys:', Object.keys(ooRows[0]));
          console.log('CCR Dashboard - Sample first row (first 10 columns):', 
            Object.entries(ooRows[0]).slice(0, 10).reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {})
          );
          
          // Check all DATE columns and their row 2 values
          dateHeaderNames.forEach((dateHeader) => {
            const row2Value = ooRows[0][dateHeader];
            console.log(`CCR Dashboard - DATE column "${dateHeader}" - Row 2 value:`, row2Value, 'Type:', typeof row2Value);
            if (dateHeaderMap.has(dateHeader)) {
              console.log(`CCR Dashboard - DATE column "${dateHeader}" - Parsed date:`, formatDateToISO(dateHeaderMap.get(dateHeader)!));
            } else {
              console.log(`CCR Dashboard - DATE column "${dateHeader}" - No date in dateHeaderMap`);
            }
          });
          
          // Check if row 2 has multiple different dates in DATE columns
          const datesInRow2 = new Set<string>();
          dateHeaderNames.forEach((dateHeader) => {
            const row2Value = ooRows[0][dateHeader];
            const parsed = parseCellDate(row2Value, true);
            if (parsed) {
              datesInRow2.add(formatDateToISO(parsed));
            }
          });
          console.log('CCR Dashboard - Unique dates found in row 2 across all DATE columns:', Array.from(datesInRow2));
        }

        // 5) Identify division/sub-division columns in ONLINE-OFFLINE
        const divisionHeader =
          ooHeaders.find((h) => {
            const n = normalize(h);
            return n === 'division';
          }) || '';

        const subDivisionHeader =
          ooHeaders.find((h) => {
            const n = normalize(h);
            return n === 'sub division' || n === 'subdivision' || n === 'sub_division';
          }) || '';

        const circleHeader =
          ooHeaders.find((h) => {
            const n = normalize(h);
            return n === 'circle' || n === 'circle name' || n === 'circle_name' || n === 'circlename';
          }) || '';

        // 6) Build array of ONLINE-OFFLINE rows with their DATE values
        // Store all rows (not just one per SITE CODE) so we can filter by specific dates
        // Handle both cases:
        // - Single DATE column with different date values per row
        // - Multiple DATE columns (one per date snapshot) - expand each row into multiple rows
        const ooRowsWithDates: Array<{ row: OnlineOfflineRow; dateValue: Date | null; siteCode: string }> = [];
        const dateValueCounts = new Map<string, number>(); // For debugging: count dates found
        const rawDateSamples: Array<{ raw: any; parsed: string | null; siteCode: string }> = []; // Sample raw values
        
        // Check if we have multiple DATE columns (indicating date snapshots as columns)
        const hasMultipleDateColumns = dateHeaderNames.length > 1;
        
        // If no date headers found, try to find dates in cell values
        if (dateHeaderNames.length === 0) {
          console.log('CCR Dashboard - No date headers detected, scanning cell values for dates...');
          // Scan first few rows to find columns that contain dates
          const potentialDateColumns = new Map<string, Set<string>>(); // column -> set of dates found
          
          ooRows.slice(0, 20).forEach((row) => {
            ooHeaders.forEach((header) => {
              const value = row[header];
              if (value !== null && value !== undefined && value !== '') {
                const parsed = parseCellDate(value, false);
                if (parsed && !isNaN(parsed.getTime())) {
                  const dateKey = formatDateToISO(parsed);
                  if (!potentialDateColumns.has(header)) {
                    potentialDateColumns.set(header, new Set());
                  }
                  potentialDateColumns.get(header)!.add(dateKey);
                }
              }
            });
          });
          
          // Find columns that consistently contain dates (at least 5 rows with dates)
          potentialDateColumns.forEach((dates, header) => {
            if (dates.size > 0) {
              console.log(`CCR Dashboard - Column "${header}" contains dates:`, Array.from(dates).sort());
              // Use the most common date as the date for this column
              const dateCounts = new Map<string, number>();
              ooRows.slice(0, 50).forEach((row) => {
                const value = row[header];
                const parsed = parseCellDate(value, false);
                if (parsed && !isNaN(parsed.getTime())) {
                  const dateKey = formatDateToISO(parsed);
                  dateCounts.set(dateKey, (dateCounts.get(dateKey) || 0) + 1);
                }
              });
              
              if (dateCounts.size > 0) {
                // Use the most common date
                let mostCommonDate = '';
                let maxCount = 0;
                dateCounts.forEach((count, date) => {
                  if (count > maxCount) {
                    maxCount = count;
                    mostCommonDate = date;
                  }
                });
                
                if (maxCount >= 5) {
                  // This column consistently has dates, treat it as a date column
                  const parsedDate = parseDateFromString(mostCommonDate);
                  if (parsedDate && !isNaN(parsedDate.getTime())) {
                    dateHeaderNames.push(header);
                    dateHeaderMap.set(header, parsedDate);
                    console.log(`CCR Dashboard - Detected date column from cell values: "${header}" -> ${mostCommonDate} (${maxCount} occurrences)`);
                  }
                }
              }
            }
          });
        }
        
        ooRows.forEach((row) => {
          const sc = String(row[siteCodeHeader] || '').trim();
          if (!sc) return;
          
          if (hasMultipleDateColumns) {
            // Multiple DATE columns: create one entry per DATE column
            // When headers are dates (e.g., "17-11-2025"), use the date from header
            // When header is "DATE", parse date from cell values
            dateHeaderNames.forEach((dateHeader) => {
              let finalDate: Date | null = null;
              
              // Check if we have a date for this header (either from header name or from row 2)
              if (dateHeaderMap.has(dateHeader)) {
                // We have a date for this header (either header is a date, or we read it from row 2)
                finalDate = dateHeaderMap.get(dateHeader)!;
                const dateKeyFromHeader = formatDateToISO(finalDate);
                
                // Debug: Log when processing date headers (first few per date)
                const existingCount = ooRowsWithDates.filter(e => e.dateValue && formatDateToISO(e.dateValue) === dateKeyFromHeader).length;
                if (existingCount < 3) {
                  console.log(`CCR Dashboard - Processing date header "${dateHeader}" -> ${dateKeyFromHeader} for site ${sc} (entry #${existingCount + 1})`);
                }
              } else {
                // Header is "DATE" but we couldn't get date from row 2 - try parsing from cell value as fallback
                const raw = row[dateHeader];
                const parsed = parseCellDate(raw, true); // isDateColumn = true
                if (parsed && !isNaN(parsed.getTime())) {
                  finalDate = parsed;
                }
              }
              
              // Only create entry if we have a valid date
              // For date headers, always create entry (date is always valid)
              // For "DATE" headers, only create if cell value parsed successfully
              if (finalDate && !isNaN(finalDate.getTime())) {
                const dateKey = formatDateToISO(finalDate);
                dateValueCounts.set(dateKey, (dateValueCounts.get(dateKey) || 0) + 1);
                
                // Create a copy of the row with all data
                // When header is a date, the row contains status data for that date
                // When header is "DATE", the row contains the date value in that column
                const rowForDate = { ...row };
                
                // If this is a date header column, we keep all columns (status columns are separate)
                // If this is a "DATE" column, we remove other DATE columns to avoid confusion
                // But keep all status columns intact
                if (!dateHeaderMap.has(dateHeader)) {
                  // This is a "DATE" column, remove other DATE columns
                  dateHeaderNames.forEach((otherDateHeader) => {
                    if (otherDateHeader !== dateHeader && !dateHeaderMap.has(otherDateHeader)) {
                      delete rowForDate[otherDateHeader];
                    }
                  });
                }
                // If it's a date header, keep all columns as they contain the status data for that date
                
                ooRowsWithDates.push({ row: rowForDate, dateValue: finalDate, siteCode: sc });
                
                if (rawDateSamples.length < 10) {
                  const raw = row[dateHeader];
                  rawDateSamples.push({ raw, parsed: dateKey, siteCode: sc });
                }
                
                // Debug: Log entry creation for all dates (first 3 per date)
                const entriesForThisDate = ooRowsWithDates.filter(e => e.dateValue && formatDateToISO(e.dateValue) === dateKey).length;
                if (entriesForThisDate <= 3) {
                  console.log(`CCR Dashboard - Created entry for ${dateKey}:`, {
                    siteCode: sc,
                    dateHeader,
                    dateValue: formatDateToISO(finalDate),
                    hasDeviceStatus: !!deviceStatusHeader,
                    deviceStatusValue: rowForDate[deviceStatusHeader] || 'N/A',
                    entryNumber: entriesForThisDate + 1
                  });
                }
              }
            });
          } else if (dateHeaderNames.length > 0) {
            // Single DATE column: use the date value from header, row 2, or cell
            const dateHeader = dateHeaderNames[0];
            let rowDateValue: Date | null = null;
            
            // Check if we have a date for this header (from header name or from row 2)
            if (dateHeaderMap.has(dateHeader)) {
              // We have a date (either header is a date, or we read it from row 2)
              rowDateValue = dateHeaderMap.get(dateHeader)!;
            } else {
              // Header is "DATE" but we couldn't get date from row 2 - parse from cell value as fallback
              const raw = row[dateHeader];
              const parsed = parseCellDate(raw, true); // isDateColumn = true
              if (parsed && !isNaN(parsed.getTime())) {
                rowDateValue = parsed;
              }
            }
            
            if (rowDateValue && !isNaN(rowDateValue.getTime())) {
              // Track date counts for debugging
              const dateKey = formatDateToISO(rowDateValue);
              dateValueCounts.set(dateKey, (dateValueCounts.get(dateKey) || 0) + 1);
              
              // Store sample raw values for debugging (first 10 rows)
              if (rawDateSamples.length < 10) {
                const raw = row[dateHeader];
                rawDateSamples.push({ raw, parsed: dateKey, siteCode: sc });
              }
            } else if (rawDateSamples.length < 10) {
              // Also log rows where parsing failed
              const raw = row[dateHeader];
              rawDateSamples.push({ raw, parsed: null, siteCode: sc });
            }
            
            ooRowsWithDates.push({ row, dateValue: rowDateValue, siteCode: sc });
          } else {
            // No DATE column found, add row without date
            ooRowsWithDates.push({ row, dateValue: null, siteCode: sc });
          }
        });
        
        // Debug: log date value counts and samples
        console.log('CCR Dashboard - Number of DATE columns found:', dateHeaderNames.length);
        console.log('CCR Dashboard - DATE column names:', dateHeaderNames);
        console.log('CCR Dashboard - Has multiple DATE columns?', hasMultipleDateColumns);
        console.log('CCR Dashboard - Date value counts from ONLINE-OFFLINE rows:', Array.from(dateValueCounts.entries()).sort());
        console.log('CCR Dashboard - All unique dates found:', Array.from(dateValueCounts.keys()).sort());
        console.log('CCR Dashboard - Sample raw DATE values:', rawDateSamples);
        console.log('CCR Dashboard - Total ONLINE-OFFLINE rows with dates:', ooRowsWithDates.filter(e => e.dateValue !== null).length, 'out of', ooRowsWithDates.length);
        console.log('CCR Dashboard - Total ONLINE-OFFLINE rows processed:', ooRowsWithDates.length);
        
        // Debug: Count entries by date
        const entriesByDate = new Map<string, number>();
        const entriesByDateAndSite = new Map<string, Set<string>>(); // date -> set of site codes
        ooRowsWithDates.forEach(entry => {
          if (entry.dateValue) {
            const dateKey = formatDateToISO(entry.dateValue);
            entriesByDate.set(dateKey, (entriesByDate.get(dateKey) || 0) + 1);
            if (!entriesByDateAndSite.has(dateKey)) {
              entriesByDateAndSite.set(dateKey, new Set());
            }
            entriesByDateAndSite.get(dateKey)!.add(entry.siteCode);
          }
        });
        console.log('CCR Dashboard - ====== ENTRY CREATION SUMMARY ======');
        console.log('CCR Dashboard - Total entries created:', ooRowsWithDates.length);
        console.log('CCR Dashboard - Entries by date:', Array.from(entriesByDate.entries()).sort());
        console.log('CCR Dashboard - Entries for 2025-11-17:', entriesByDate.get('2025-11-17') || 0);
        console.log('CCR Dashboard - Entries for 2025-11-18:', entriesByDate.get('2025-11-18') || 0);
        console.log('CCR Dashboard - Unique site codes per date:', 
          Array.from(entriesByDateAndSite.entries()).map(([date, sites]) => 
            `${date}: ${sites.size} sites, ${entriesByDate.get(date) || 0} entries`
          ).sort()
        );
        
        // Debug: Show which date headers were processed
        if (hasMultipleDateColumns) {
          console.log('CCR Dashboard - Processing multiple date columns. Date headers processed:', dateHeaderNames);
          dateHeaderNames.forEach((dateHeader) => {
            const headerDate = dateHeaderMap.get(dateHeader);
            if (headerDate) {
              const dateKey = formatDateToISO(headerDate);
              const count = entriesByDate.get(dateKey) || 0;
              console.log(`CCR Dashboard -   "${dateHeader}" -> ${dateKey}: ${count} entries`);
            }
          });
        }
        console.log('CCR Dashboard - ====================================');
        
        // Check specifically for 17-11-2025 in raw data
        const ooRowsWith17Nov = ooRowsWithDates.filter((entry) => {
          if (!entry.dateValue) return false;
          return formatDateToISO(entry.dateValue) === '2025-11-17';
        });
        console.log('CCR Dashboard - Rows with 2025-11-17 in ONLINE-OFFLINE data:', ooRowsWith17Nov.length);
        
        // Also check raw DATE values that might be 17-11-2025 but parsed incorrectly
        if (dateHeaderNames.length > 0) {
          const dateHeader = dateHeaderNames[0];
          const rawValuesFor17 = ooRows.filter((row) => {
            const raw = row[dateHeader];
            const str = String(raw).trim();
            // Check if raw value contains "17" and "11" and "2025" in any format
            return str.includes('17') && str.includes('11') && str.includes('2025');
          });
          console.log('CCR Dashboard - Raw DATE values that might be 17-11-2025:', rawValuesFor17.length);
          if (rawValuesFor17.length > 0) {
            console.log('CCR Dashboard - Sample raw values for 17-11-2025:', rawValuesFor17.slice(0, 5).map((row) => ({
              raw: row[dateHeader],
              siteCode: row[siteCodeHeader],
            })));
          }
        }
        
        // Show a few examples of raw values and their conversions
        const conversionExamples: Array<{ raw: any; rawType: string; parsed: string | null; siteCode: string }> = [];
        ooRowsWithDates.slice(0, 20).forEach((entry) => {
          if (dateHeaderNames.length > 0) {
            const dateHeader = dateHeaderNames[0];
            const raw = entry.row[dateHeader];
            const parsed = entry.dateValue;
            if (raw !== undefined && raw !== null) {
              const yyyy = parsed ? parsed.getFullYear() : null;
              const mm = parsed ? String(parsed.getMonth() + 1).padStart(2, '0') : null;
              const dd = parsed ? String(parsed.getDate()).padStart(2, '0') : null;
              const parsedStr = parsed ? `${yyyy}-${mm}-${dd}` : null;
              conversionExamples.push({
                raw,
                rawType: typeof raw,
                parsed: parsedStr,
                siteCode: entry.siteCode,
              });
            }
          }
        });
        console.log('CCR Dashboard - Conversion examples (first 20):', conversionExamples);

        // 7) Create a map of Device Status Upload data by SITE CODE (for merging user edits)
        const deviceStatusMap = new Map<string, any>();
        if (deviceStatusFile && deviceStatusRows.length > 0 && mainSiteCodeHeader) {
          deviceStatusRows.forEach((row: any) => {
            const sc = String(row[mainSiteCodeHeader] || '').trim();
            if (sc) {
              deviceStatusMap.set(sc, row);
            }
          });
          console.log('CCR Dashboard - Created Device Status Upload map with', deviceStatusMap.size, 'site codes');
        }

        // 8) Convert ONLINE-OFFLINE rows with dates to MergedRow format and merge with Device Status Upload
        // Merge Device Status Upload data to preserve user edits
        const merged: MergedRow[] = [];
        const seenSiteCodeDate = new Set<string>(); // Track SITE CODE + DATE combinations to avoid duplicates
        let duplicateCount = 0; // Track how many duplicates we skip
        let mergedWithDeviceStatusCount = 0; // Track how many rows were merged with Device Status Upload data
        
        let skippedNoDate = 0;
        let skippedNoSiteCode = 0;
        let processedCount = 0;
        
        console.log(`CCR Dashboard - Starting merge process with ${ooRowsWithDates.length} entries from ONLINE-OFFLINE`);
        
        // Check first 10 entries in detail
        const sampleEntries = ooRowsWithDates.slice(0, 10).map((e, idx) => {
          const dateKey = e.dateValue ? formatDateToISO(e.dateValue) : 'NONE';
          const dateValid = e.dateValue ? !isNaN(e.dateValue.getTime()) : false;
          const scValid = e.siteCode && e.siteCode.trim() !== '';
          const uniqueKey = (dateValid && scValid) ? `${e.siteCode}::${dateKey}` : 'INVALID';
          return {
            index: idx,
            siteCode: e.siteCode || 'MISSING',
            hasDate: !!e.dateValue,
            dateValue: dateKey,
            dateValid,
            scValid,
            uniqueKey,
            willSkip: !dateValid || !scValid
          };
        });
        console.log(`CCR Dashboard - First 10 entries analysis:`, sampleEntries);
        
        ooRowsWithDates.forEach((ooEntry, index) => {
          // Only process entries with valid dates
          if (!ooEntry.dateValue) {
            skippedNoDate++;
            if (index < 5) {
              console.log(`CCR Dashboard - Skipping entry ${index}: no dateValue`, ooEntry);
            }
            return; // Skip entries without valid dates
          }
          
          // Check if date is valid
          if (isNaN(ooEntry.dateValue.getTime())) {
            skippedNoDate++;
            if (index < 5) {
              console.log(`CCR Dashboard - Skipping entry ${index}: invalid date`, ooEntry.dateValue);
            }
            return; // Skip entries with invalid dates
          }
          
          const sc = ooEntry.siteCode;
          if (!sc || sc.trim() === '') {
            skippedNoSiteCode++;
            if (index < 5) {
              console.log(`CCR Dashboard - Skipping entry ${index}: no site code`, ooEntry);
            }
            return; // Skip entries without site code
          }
          
          // Create a unique key: SITE CODE + DATE
          const dateKey = formatDateToISO(ooEntry.dateValue);
          const uniqueKey = `${sc}::${dateKey}`;
          
          // Only add if we haven't seen this SITE CODE + DATE combination before
          if (!seenSiteCodeDate.has(uniqueKey)) {
            seenSiteCodeDate.add(uniqueKey);
            processedCount++;
            
            // Start with ONLINE-OFFLINE row data
            const mergedRow: any = { ...ooEntry.row };
            
            // Merge Device Status Upload data if available (preserves user edits)
            const deviceStatusRow = deviceStatusMap.get(sc);
            if (deviceStatusRow) {
              mergedWithDeviceStatusCount++;
              
              // Find DEVICE STATUS column in Device Status Upload file
              const dsDeviceStatusHeader = deviceStatusHeaders.find((h: string) => {
                const n = normalize(h);
                return n === 'device status' || n === 'device_status' || n === 'devicestatus' ||
                       (n.includes('device') && n.includes('status'));
              });
              
              // Find EQUIPMENT L/R SWITCH STATUS column in Device Status Upload file
              // Handle both "EQUIPMENT" and "EQUIPEMNT" (typo) and any suffix like "_3"
              const dsEquipLRSwitchHeader = deviceStatusHeaders.find((h: string) => {
                const n = normalize(h);
                const matches = n === 'equipment l/r switch status' ||
                       n === 'equipment_l/r_switch_status' ||
                       n === 'equipmentl/rswitchstatus' ||
                       n === 'equipemnt l/r switch status' ||
                       n === 'equipemnt_l/r_switch_status' ||
                       n.startsWith('equipment l/r switch status') ||
                       n.startsWith('equipemnt l/r switch status') ||
                       ((n.includes('equipment') || n.includes('equipemnt') || n.includes('equip')) &&
                        (n.includes('l/r') || n.includes('lr') || n.includes('l r')) &&
                        (n.includes('switch') || n.includes('status')));
                if (matches) {
                  console.log(`CCR Dashboard - Matched EQUIPMENT L/R SWITCH STATUS column: "${h}" (normalized: "${n}")`);
                }
                return matches;
              });
              
              if (dsEquipLRSwitchHeader) {
                console.log(`CCR Dashboard - Found EQUIPMENT L/R SWITCH STATUS column in Device Status Upload: "${dsEquipLRSwitchHeader}"`);
              } else {
                console.log(`CCR Dashboard - EQUIPMENT L/R SWITCH STATUS column not found in Device Status Upload headers:`, deviceStatusHeaders);
                console.log(`CCR Dashboard - Searching for columns containing:`, {
                  hasEquip: deviceStatusHeaders.filter(h => normalize(h).includes('equip')),
                  hasLR: deviceStatusHeaders.filter(h => normalize(h).includes('l/r') || normalize(h).includes('lr')),
                  hasSwitch: deviceStatusHeaders.filter(h => normalize(h).includes('switch'))
                });
              }
              
              // If Device Status Upload has DEVICE STATUS, use it (preserves user edits)
              if (dsDeviceStatusHeader) {
                const dsDeviceStatus = String(deviceStatusRow[dsDeviceStatusHeader] || '').trim();
                if (dsDeviceStatus) {
                  // Override ONLINE-OFFLINE DEVICE STATUS with Device Status Upload value
                  if (deviceStatusHeader) {
                    mergedRow[deviceStatusHeader] = dsDeviceStatus;
                  }
                  // Also set in the merged row's __deviceStatus field
                  mergedRow.__deviceStatus = dsDeviceStatus;
                  console.log(`CCR Dashboard - Using Device Status Upload DEVICE STATUS for ${sc}: ${dsDeviceStatus}`);
                }
              }
              
              // If Device Status Upload has EQUIPMENT L/R SWITCH STATUS, use it (preserves user edits)
              if (dsEquipLRSwitchHeader) {
                const dsEquipLRSwitch = String(deviceStatusRow[dsEquipLRSwitchHeader] || '').trim();
                console.log(`CCR Dashboard - Device Status Upload EQUIPMENT L/R SWITCH STATUS for ${sc}: "${dsEquipLRSwitch}" (from column "${dsEquipLRSwitchHeader}")`);
                if (dsEquipLRSwitch) {
                  // Override ONLINE-OFFLINE EQUIPMENT L/R SWITCH STATUS with Device Status Upload value
                  if (equipLRSwitchHeader) {
                    mergedRow[equipLRSwitchHeader] = dsEquipLRSwitch;
                    console.log(`CCR Dashboard - Set mergedRow[${equipLRSwitchHeader}] = "${dsEquipLRSwitch}"`);
                  }
                  // Also set in the merged row's __equipLRSwitchStatus field
                  mergedRow.__equipLRSwitchStatus = dsEquipLRSwitch;
                  console.log(`CCR Dashboard - Set mergedRow.__equipLRSwitchStatus = "${dsEquipLRSwitch}" for site ${sc}`);
                } else {
                  console.log(`CCR Dashboard - Device Status Upload EQUIPMENT L/R SWITCH STATUS is empty for ${sc}`);
                }
              } else {
                // Try to find it by checking all columns that might match
                const possibleColumns = deviceStatusHeaders.filter((h: string) => {
                  const n = normalize(h);
                  return (n.includes('equip') || n.includes('equipemnt')) && 
                         (n.includes('l/r') || n.includes('lr')) && 
                         (n.includes('switch') || n.includes('status'));
                });
                if (possibleColumns.length > 0) {
                  console.log(`CCR Dashboard - Possible EQUIPMENT L/R SWITCH STATUS columns found but not matched:`, possibleColumns);
                }
              }
              
              // Merge other columns from Device Status Upload (preserve user edits)
              // Skip columns we've already handled explicitly (DEVICE STATUS and EQUIPMENT L/R SWITCH STATUS)
              deviceStatusHeaders.forEach((col: string) => {
                // Skip if we've already handled this column explicitly
                if (col === dsDeviceStatusHeader || col === dsEquipLRSwitchHeader) {
                  return;
                }
                
                const dsValue = deviceStatusRow[col];
                // Only override if Device Status Upload has a non-empty value
                if (dsValue !== undefined && dsValue !== null && String(dsValue).trim() !== '') {
                  mergedRow[col] = dsValue;
                }
              });
            }
            
            merged.push({
              ...mergedRow, // Include merged columns
              __statusDate: ooEntry.dateValue,
              __deviceStatus: mergedRow.__deviceStatus || (ooEntry.row && deviceStatusHeader ? String(ooEntry.row[deviceStatusHeader] || '').trim() : ''),
              __equipLRSwitchStatus: mergedRow.__equipLRSwitchStatus || (ooEntry.row && equipLRSwitchHeader ? String(ooEntry.row[equipLRSwitchHeader] || '').trim() : ''),
              __rtuLRSwitchStatus: ooEntry.row && rtuLRSwitchHeader ? String(ooEntry.row[rtuLRSwitchHeader] || '').trim() : '',
              __circleHeader: circleHeader,
              __divisionHeader: divisionHeader,
              __subDivisionHeader: subDivisionHeader,
            } as MergedRow);
          } else {
            duplicateCount++;
          }
        });
        
        console.log(`CCR Dashboard - Merged ${mergedWithDeviceStatusCount} rows with Device Status Upload data`);
        console.log(`CCR Dashboard - ====== PROCESSING SUMMARY ======`);
        console.log(`CCR Dashboard - Total ONLINE-OFFLINE entries: ${ooRowsWithDates.length}`);
        console.log(`CCR Dashboard - Skipped (no date): ${skippedNoDate}`);
        console.log(`CCR Dashboard - Skipped (no site code): ${skippedNoSiteCode}`);
        console.log(`CCR Dashboard - Processed (unique): ${processedCount}`);
        console.log(`CCR Dashboard - Duplicates skipped: ${duplicateCount}`);
        console.log(`CCR Dashboard - Final merged rows: ${merged.length}`);
        console.log(`CCR Dashboard - =================================`);
        
        // Detailed breakdown
        const totalSkipped = skippedNoDate + skippedNoSiteCode;
        const totalShouldProcess = ooRowsWithDates.length - totalSkipped;
        console.log(`CCR Dashboard - Breakdown: ${ooRowsWithDates.length} total = ${skippedNoDate} (no date) + ${skippedNoSiteCode} (no site code) + ${totalShouldProcess} (should process)`);
        console.log(`CCR Dashboard - Of ${totalShouldProcess} that should process: ${processedCount} unique + ${duplicateCount} duplicates = ${processedCount + duplicateCount}`);
        
        if (merged.length === 0 && ooRowsWithDates.length > 0) {
          console.error(`CCR Dashboard - ERROR: ${ooRowsWithDates.length} entries processed but 0 merged rows created!`);
          console.error(`CCR Dashboard - Skipped: ${skippedNoDate} (no date) + ${skippedNoSiteCode} (no site code) = ${totalSkipped} total skipped`);
          console.error(`CCR Dashboard - Should have processed: ${totalShouldProcess}, but only ${processedCount} were unique`);
          
          // Show sample of entries that should have been processed
          if (totalShouldProcess > 0 && totalShouldProcess <= 10) {
            console.error(`CCR Dashboard - Sample entries that should have been processed:`, 
              ooRowsWithDates
                .filter(e => e.dateValue && !isNaN(e.dateValue.getTime()) && e.siteCode && e.siteCode.trim())
                .slice(0, 5)
                .map(e => ({
                  siteCode: e.siteCode,
                  date: formatDateToISO(e.dateValue!),
                  uniqueKey: `${e.siteCode}::${formatDateToISO(e.dateValue!)}`
                }))
            );
          }
        }
        
        // Debug: Verify merged data for specific site codes
        const testSiteCodes = ['5W2925', '%W2932'];
        testSiteCodes.forEach(testSc => {
          const testRow = merged.find((r: any) => {
            const sc = String((r as any)['SITE CODE'] || (r as any)['Site Code'] || (r as any)['site code'] || '').trim();
            return sc === testSc;
          });
          if (testRow) {
            console.log(`CCR Dashboard - Merged row for ${testSc}:`, {
              __deviceStatus: (testRow as MergedRow).__deviceStatus,
              __equipLRSwitchStatus: (testRow as MergedRow).__equipLRSwitchStatus,
              hasDeviceStatusRow: deviceStatusMap.has(testSc)
            });
          } else {
            console.log(`CCR Dashboard - No merged row found for ${testSc}`);
          }
        });

        // Debug: log deduplication results
        if (duplicateCount > 0) {
          console.log(`CCR Dashboard - Removed ${duplicateCount} duplicate rows (same SITE CODE + DATE combination)`);
        }
        
        // Debug: log dates in merged rows and collect all available dates
        const mergedDateCounts = new Map<string, number>();
        const allDatesSet = new Set<string>();
        const rowsWith17Nov: MergedRow[] = [];
        const rowsWith18Nov: MergedRow[] = [];
        merged.forEach((row) => {
          const d = row.__statusDate as Date | null;
          if (d && !isNaN(d.getTime())) {
            const dateKey = formatDateToISO(d);
            mergedDateCounts.set(dateKey, (mergedDateCounts.get(dateKey) || 0) + 1);
            allDatesSet.add(dateKey);
            
            // Collect sample rows for debugging
            if (dateKey === '2025-11-17' && rowsWith17Nov.length < 3) {
              rowsWith17Nov.push(row);
            }
            if (dateKey === '2025-11-18' && rowsWith18Nov.length < 3) {
              rowsWith18Nov.push(row);
            }
          }
        });
        
        console.log('CCR Dashboard - ====== MERGED ROWS SUMMARY ======');
        console.log('CCR Dashboard - Total merged rows:', merged.length);
        console.log('CCR Dashboard - Merged rows with dates:', merged.filter(r => r.__statusDate !== null).length);
        // Store all available dates, sorted in descending order (latest first)
        const allDates = Array.from(allDatesSet).sort().reverse();
        console.log('CCR Dashboard - Dates in merged rows:', Array.from(mergedDateCounts.entries()).sort());
        console.log('CCR Dashboard - All available dates for selection:', allDates);
        console.log('CCR Dashboard - Rows with 2025-11-17 in merged:', mergedDateCounts.get('2025-11-17') || 0);
        console.log('CCR Dashboard - Rows with 2025-11-18 in merged:', mergedDateCounts.get('2025-11-18') || 0);
        if (rowsWith17Nov.length > 0) {
          console.log('CCR Dashboard - Sample merged rows with 2025-11-17:', rowsWith17Nov.map(r => ({
            siteCode: (r as any)[siteCodeHeader] || 'N/A',
            date: formatDateToISO(r.__statusDate as Date | null),
            deviceStatus: (r as MergedRow).__deviceStatus,
            equipLR: (r as MergedRow).__equipLRSwitchStatus,
            division: (r as any)[divisionHeader] || 'N/A'
          })));
        }
        if (rowsWith18Nov.length > 0) {
          console.log('CCR Dashboard - Sample merged rows with 2025-11-18:', rowsWith18Nov.map(r => ({
            siteCode: (r as any)[siteCodeHeader] || 'N/A',
            date: formatDateToISO(r.__statusDate as Date | null),
            deviceStatus: (r as MergedRow).__deviceStatus,
            equipLR: (r as MergedRow).__equipLRSwitchStatus,
            division: (r as any)[divisionHeader] || 'N/A'
          })));
        }
        console.log('CCR Dashboard - ====================================');
        
        console.log(`CCR Dashboard - Total merged rows created: ${merged.length}`);
        console.log(`CCR Dashboard - Duplicate rows skipped: ${duplicateCount}`);
        console.log(`CCR Dashboard - Rows merged with Device Status Upload: ${mergedWithDeviceStatusCount}`);
        
        if (merged.length === 0) {
          console.warn('CCR Dashboard - WARNING: No merged rows created!');
          console.warn('CCR Dashboard - ONLINE-OFFLINE rows with dates:', ooRowsWithDates.length);
          console.warn('CCR Dashboard - Device Status Upload rows:', deviceStatusRows.length);
        }
        
        setMergedRows(merged);
        
        // Find the latest date from the merged rows (these are the actual dates that will be used for filtering)
        let actualLatestDate: Date | null = null;
        const datesInMerged = new Set<string>();
        merged.forEach((row) => {
          const d = row.__statusDate as Date | null;
          if (d && !isNaN(d.getTime())) {
            const iso = formatDateToISO(d);
            datesInMerged.add(iso);
            if (!actualLatestDate || d.getTime() > actualLatestDate.getTime()) {
              actualLatestDate = d;
            }
          }
        });
        
        console.log(`CCR Dashboard - Dates found in merged rows:`, Array.from(datesInMerged).sort());
        console.log(`CCR Dashboard - Latest date in merged rows:`, actualLatestDate ? formatDateToISO(actualLatestDate) : 'NONE');
        
        // Set snapshot date label (used in the Date picker) based on the latest date found in merged rows
        // Also set selectedDate directly to ensure it's set on initial load
        // BUT: Only set selectedDate if we have merged rows with that date, otherwise leave it empty to show all data
        if (actualLatestDate && !isNaN((actualLatestDate as Date).getTime())) {
          const iso = formatDateToISO(actualLatestDate);
          setSnapshotDateLabel(iso);
          
          // Only set selectedDate if we have rows with this date
          const rowsWithThisDate = merged.filter((row) => {
            const d = row.__statusDate as Date | null;
            return d && !isNaN(d.getTime()) && formatDateToISO(d) === iso;
          });
          
          if (rowsWithThisDate.length > 0) {
            setSelectedDate(iso);
            console.log(`CCR Dashboard - Set selectedDate to latest date: ${iso} (${rowsWithThisDate.length} rows have this date)`);
          } else {
            console.warn(`CCR Dashboard - WARNING: Latest date ${iso} found but no rows have this date! Leaving selectedDate empty.`);
            setSelectedDate('');
          }
        } else {
          // Fallback to latestDateValue if no dates in merged rows
          // Use latestDateValue from ONLINE-OFFLINE data (calculated before merging)
          if (latestDateValue && !isNaN((latestDateValue as Date).getTime())) {
            const iso = formatDateToISO(latestDateValue);
            setSnapshotDateLabel(iso);
            
            // If merged rows exist, check if any have this date
            // If no merged rows, still set the date as default (user wants to see data for this date)
            if (merged.length > 0) {
              const rowsWithThisDate = merged.filter((row) => {
                const d = row.__statusDate as Date | null;
                return d && !isNaN(d.getTime()) && formatDateToISO(d) === iso;
              });
              
              if (rowsWithThisDate.length > 0) {
                setSelectedDate(iso);
                console.log(`CCR Dashboard - Using latestDateValue: ${iso} (${rowsWithThisDate.length} rows have this date)`);
              } else {
                // Even if no merged rows have this date, set it as default (data might be filtered out for other reasons)
                setSelectedDate(iso);
                console.log(`CCR Dashboard - Set selectedDate to latestDateValue ${iso} (no merged rows have this date, but setting as default)`);
              }
            } else {
              // No merged rows yet, but set the date as default anyway
              setSelectedDate(iso);
              console.log(`CCR Dashboard - Set selectedDate to latestDateValue ${iso} (no merged rows yet, but this is the latest date in data)`);
            }
          } else {
            setSnapshotDateLabel('');
            setSelectedDate('');
            console.log('CCR Dashboard - No date found, leaving selectedDate empty to show all data');
          }
        }
      } catch (err: any) {
        console.error('Error loading Equipment Dashboard data:', err);
        setError(err?.message || 'Failed to load dashboard data.');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [role, refreshTrigger]);

  const { divisionHeaderKey, subDivisionHeaderKey, circleHeaderKey } = useMemo(() => {
    const sample = mergedRows[0] as any;
    return {
      divisionHeaderKey: sample?.__divisionHeader as string | undefined,
      subDivisionHeaderKey: sample?.__subDivisionHeader as string | undefined,
      circleHeaderKey: sample?.__circleHeader as string | undefined,
    };
  }, [mergedRows]);

  // Keep the selected date in sync with the latest date from the data
  // When new data loads, always update to the latest date found
  // This ensures both Equipment and CCR roles have the latest date selected by default
  useEffect(() => {
    if (snapshotDateLabel) {
      // Always update to the latest date when data is loaded
      // Only update if selectedDate is empty or different from snapshotDateLabel
      if (!selectedDate || selectedDate !== snapshotDateLabel) {
        console.log(`CCR Dashboard - Setting selectedDate to latest date: ${snapshotDateLabel}`);
      setSelectedDate(snapshotDateLabel);
    }
    }
  }, [snapshotDateLabel, selectedDate]);

  // Default Division filter to the user's registered division (first division) if available
  // For Equipment role: filter by user's division
  // For CCR role: show all divisions by default (no filter)
  useEffect(() => {
    // Allow both Equipment and CCR roles
    if (role !== 'Equipment' && role !== 'CCR') return;
    if (divisionFilter) return;
    if (!divisionHeaderKey) return;
    
    // For CCR role, don't set default division filter - show all divisions
    if (role === 'CCR') {
      return;
    }
    
    // For Equipment role, set default to user's division
    if (!userDivisions || userDivisions.length === 0) return;

    const preferred = String(userDivisions[0] || '').trim();
    if (!preferred) return;

    // Only set as default if that division actually exists in the merged data
    const hasDivision = mergedRows.some((row) => {
      const v = String((row as any)[divisionHeaderKey] || '').trim();
      return v.toLowerCase() === preferred.toLowerCase();
    });

    if (hasDivision) {
      setDivisionFilter(preferred);
    }
  }, [role, divisionFilter, divisionHeaderKey, mergedRows, userDivisions]);

  const filteredRows = useMemo(() => {
    console.log(`CCR Dashboard - filteredRows useMemo: mergedRows.length=${mergedRows.length}, selectedDate="${selectedDate}", divisionFilter="${divisionFilter}", subDivisionFilter="${subDivisionFilter}", circleFilter="${circleFilter}"`);
    
    if (mergedRows.length === 0) {
      console.warn('CCR Dashboard - mergedRows is empty!');
      return [];
    }

    const filtered = mergedRows.filter((row) => {
      // Circle filter
      if (circleHeaderKey && circleFilter) {
        const v = normalize((row as any)[circleHeaderKey]);
        if (v !== normalize(circleFilter)) return false;
      }

      // Division filter
      if (divisionHeaderKey && divisionFilter) {
        const v = normalize((row as any)[divisionHeaderKey]);
        if (v !== normalize(divisionFilter)) return false;
      }

      // Sub Division filter
      if (subDivisionHeaderKey && subDivisionFilter) {
        const v = normalize((row as any)[subDivisionHeaderKey]);
        if (v !== normalize(subDivisionFilter)) return false;
      }

      // Date filter: if user has selected a date, only include rows where DATE exactly matches the selected date
      if (selectedDate) {
        const d = row.__statusDate as Date | null;
        if (!d || isNaN(d.getTime())) {
          return false;
        }
        // Normalize to local date (ignore time components)
        const rowIso = formatDateToISO(d);
        
        // Only include rows where DATE exactly equals the selected date
        if (rowIso !== selectedDate) return false;
      }

      return true;
    });
    
    // Debug: log filtering results
    console.log(`CCR Dashboard - Filtering results: ${filtered.length} rows after filtering from ${mergedRows.length} total rows`);
      
      // Show all unique dates in merged rows
      const allDatesInMerged = new Map<string, number>();
    const rowsWithoutDates = mergedRows.filter((row) => {
        const d = row.__statusDate as Date | null;
        if (d && !isNaN(d.getTime())) {
          const dateKey = formatDateToISO(d);
          allDatesInMerged.set(dateKey, (allDatesInMerged.get(dateKey) || 0) + 1);
        return false;
      }
      return true;
    });
    
    if (rowsWithoutDates.length > 0) {
      console.warn(`CCR Dashboard - WARNING: ${rowsWithoutDates.length} rows have no valid date!`);
    }
    
    if (selectedDate) {
      // Count rows with the selected date in ALL merged rows
      const rowsWithSelectedDate = mergedRows.filter((row) => {
        const d = row.__statusDate as Date | null;
        if (d && !isNaN(d.getTime())) {
          return formatDateToISO(d) === selectedDate;
        }
        return false;
      });
      
      console.log(`CCR Dashboard - Selected date: ${selectedDate}`);
      console.log(`CCR Dashboard - Rows with date ${selectedDate} in merged rows:`, rowsWithSelectedDate.length);
      console.log(`CCR Dashboard - Filtered rows after all filters:`, filtered.length);
      
      if (rowsWithSelectedDate.length === 0) {
        console.warn(`CCR Dashboard - WARNING: No rows found with selected date ${selectedDate}!`);
      }
    }
    
      const availableDatesArray = Array.from(allDatesInMerged.entries()).sort();
    console.log(`CCR Dashboard - All available dates in merged rows (${availableDatesArray.length} unique dates):`, availableDatesArray.map(([date, count]) => `${date}: ${count} rows`));
      
      // Show breakdown by date
      availableDatesArray.forEach(([date, count]) => {
        console.log(`CCR Dashboard -   Date ${date}: ${count} rows`);
      });
    
    // Log sample of filtered rows
    if (filtered.length > 0) {
      console.log(`CCR Dashboard - Sample filtered rows (first 3):`, filtered.slice(0, 3).map((r: any) => ({
        siteCode: (r as any)['SITE CODE'] || (r as any)['Site Code'] || 'N/A',
        deviceStatus: r.__deviceStatus,
        equipLRSwitch: r.__equipLRSwitchStatus,
        date: r.__statusDate ? formatDateToISO(r.__statusDate) : 'N/A'
      })));
    } else {
      console.warn(`CCR Dashboard - WARNING: No filtered rows! This will result in zero counts.`);
    }
    
    return filtered;
  }, [
    mergedRows,
    divisionHeaderKey,
    subDivisionHeaderKey,
    divisionFilter,
    subDivisionFilter,
    circleFilter,
    selectedDate,
  ]);

  const divisionOptions = useMemo(() => {
    if (!divisionHeaderKey) return [];
    const set = new Set<string>();
    mergedRows.forEach((row) => {
      const v = String((row as any)[divisionHeaderKey] || '').trim();
      if (v) set.add(v);
    });
    return Array.from(set).sort();
  }, [mergedRows, divisionHeaderKey]);

  const subDivisionOptions = useMemo(() => {
    if (!subDivisionHeaderKey) return [];
    const set = new Set<string>();
    mergedRows.forEach((row) => {
      const v = String((row as any)[subDivisionHeaderKey] || '').trim();
      if (v) set.add(v);
    });
    return Array.from(set).sort();
  }, [mergedRows, subDivisionHeaderKey]);

  const circleOptions = useMemo(() => {
    if (!circleHeaderKey) return [];
    const set = new Set<string>();
    mergedRows.forEach((row) => {
      const v = String((row as any)[circleHeaderKey] || '').trim();
      if (v) set.add(v);
    });
    return Array.from(set).sort();
  }, [mergedRows, circleHeaderKey]);

  // Compute card counts from filtered rows
  const {
    onlineCount,
    offlineCount,
    localCount,
    remoteCount,
    switchIssueCount,
    rtuLocalCount,
  } = useMemo(() => {
    console.log(`CCR Dashboard - Computing counts from ${filteredRows.length} filtered rows`);
    
    let online = 0;
    let offline = 0;
    let local = 0;
    let remote = 0;
    let switchIssue = 0;
    let rtuLocal = 0;

    filteredRows.forEach((row) => {
      const dsRaw = row.__deviceStatus || '';
      const ds = normalize(dsRaw);
      if (ds === 'online') online += 1;
      if (ds === 'offline') offline += 1;

      const equipRaw = row.__equipLRSwitchStatus || '';
      const equipLR = normalize(equipRaw);
      
      // Get site code from row (try multiple possible column names)
      const siteCode = (row as any)['SITE CODE'] || 
                       (row as any)['Site Code'] || 
                       (row as any)['site code'] || 
                       (row as any)['SITE_CODE'] ||
                       (row as any)['SiteCode'] ||
                       'UNKNOWN';
      
      // Debug: Log first few rows to verify values (especially for site code 5W2925 or %W2932)
      if (siteCode === '5W2925' || siteCode === '%W2932' || (local + remote + switchIssue < 5 && equipRaw)) {
        console.log(`CCR Dashboard - Count check for ${siteCode}: __equipLRSwitchStatus="${equipRaw}" (normalized: "${equipLR}")`);
      }
      
      // Treat any value containing "local" as LOCAL
      if (equipLR.includes('local')) {
        local += 1;
        if (siteCode === '5W2925' || siteCode === '%W2932' || local <= 3) {
          console.log(`CCR Dashboard - Counting LOCAL for ${siteCode}: "${equipRaw}" (normalized: "${equipLR}")`);
        }
      }
      // Treat any value containing "remote" as REMOTE
      if (equipLR.includes('remote')) {
        remote += 1;
        if (siteCode === '5W2925' || siteCode === '%W2932') {
          console.log(`CCR Dashboard - Counting REMOTE for ${siteCode}: "${equipRaw}"`);
        }
      }
      // Treat any value that mentions both "switch" and "issue" (or is exactly "switchissue") as SWITCH ISSUE
      if (
        equipLR === 'switchissue' ||
        (equipLR.includes('switch') && equipLR.includes('issue'))
      ) {
        switchIssue += 1;
        if (siteCode === '5W2925' || siteCode === '%W2932') {
          console.log(`CCR Dashboard - Counting SWITCH ISSUE for ${siteCode}: "${equipRaw}"`);
        }
      }

      const rtuRaw = row.__rtuLRSwitchStatus || '';
      const rtuLR = normalize(rtuRaw);
      // Count any value in RTU L/R SWITCH STATUS that contains "local"
      if (rtuLR.includes('local')) {
        rtuLocal += 1;
        if (siteCode === '5W2925' || siteCode === '%W2932' || rtuLocal <= 3) {
          console.log(`CCR Dashboard - Counting RTU LOCAL for ${siteCode}: "${rtuRaw}" (normalized: "${rtuLR}")`);
        }
      }
    });

    const counts = {
      onlineCount: online,
      offlineCount: offline,
      localCount: local,
      remoteCount: remote,
      switchIssueCount: switchIssue,
      rtuLocalCount: rtuLocal,
    };
    
    console.log(`CCR Dashboard - Final counts:`, counts);
    
    return counts;
  }, [filteredRows]);

  // Calculate trend data by date for ONLINE & OFFLINE
  // Use mergedRows filtered by Circle, Division, Sub Division (but NOT by Date) to show all historical dates
  const onlineOfflineTrendData = useMemo(() => {
    const dateMap = new Map<string, { date: string; online: number; offline: number }>();
    
    // Filter by Circle, Division, Sub Division (but NOT by Date) to get all dates
    const rowsForTrend = mergedRows.filter((row) => {
      // Circle filter
      if (circleHeaderKey && circleFilter) {
        const v = normalize((row as any)[circleHeaderKey]);
        if (v !== normalize(circleFilter)) return false;
      }

      // Division filter
      if (divisionHeaderKey && divisionFilter) {
        const v = normalize((row as any)[divisionHeaderKey]);
        if (v !== normalize(divisionFilter)) return false;
      }

      // Sub Division filter
      if (subDivisionHeaderKey && subDivisionFilter) {
        const v = normalize((row as any)[subDivisionHeaderKey]);
        if (v !== normalize(subDivisionFilter)) return false;
      }

      return true;
    });
    
    rowsForTrend.forEach((row) => {
      const d = row.__statusDate as Date | null;
      if (!d || isNaN(d.getTime())) return;
      
      const dateKey = formatDateToISO(d);
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, { date: dateKey, online: 0, offline: 0 });
      }
      
      const entry = dateMap.get(dateKey)!;
      const dsRaw = row.__deviceStatus || '';
      const ds = normalize(dsRaw);
      if (ds === 'online') entry.online += 1;
      if (ds === 'offline') entry.offline += 1;
    });
    
    return Array.from(dateMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(item => ({
        ...item,
        dateLabel: new Date(item.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
      }));
  }, [mergedRows, circleHeaderKey, circleFilter, divisionHeaderKey, divisionFilter, subDivisionHeaderKey, subDivisionFilter]);

  // Calculate trend data by date for LOCAL & REMOTE
  // Use mergedRows filtered by Circle, Division, Sub Division (but NOT by Date) to show all historical dates
  const localRemoteTrendData = useMemo(() => {
    const dateMap = new Map<string, { date: string; local: number; remote: number }>();
    
    // Filter by Circle, Division, Sub Division (but NOT by Date) to get all dates
    const rowsForTrend = mergedRows.filter((row) => {
      // Circle filter
      if (circleHeaderKey && circleFilter) {
        const v = normalize((row as any)[circleHeaderKey]);
        if (v !== normalize(circleFilter)) return false;
      }

      // Division filter
      if (divisionHeaderKey && divisionFilter) {
        const v = normalize((row as any)[divisionHeaderKey]);
        if (v !== normalize(divisionFilter)) return false;
      }

      // Sub Division filter
      if (subDivisionHeaderKey && subDivisionFilter) {
        const v = normalize((row as any)[subDivisionHeaderKey]);
        if (v !== normalize(subDivisionFilter)) return false;
      }

      return true;
    });
    
    rowsForTrend.forEach((row) => {
      const d = row.__statusDate as Date | null;
      if (!d || isNaN(d.getTime())) return;
      
      const dateKey = formatDateToISO(d);
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, { date: dateKey, local: 0, remote: 0 });
      }
      
      const entry = dateMap.get(dateKey)!;
      const equipRaw = row.__equipLRSwitchStatus || '';
      const equipLR = normalize(equipRaw);
      if (equipLR.includes('local')) entry.local += 1;
      if (equipLR.includes('remote')) entry.remote += 1;
    });
    
    return Array.from(dateMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(item => ({
        ...item,
        dateLabel: new Date(item.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
      }));
  }, [mergedRows, circleHeaderKey, circleFilter, divisionHeaderKey, divisionFilter, subDivisionHeaderKey, subDivisionFilter]);

  // Allow both Equipment and CCR roles
  if (role !== 'Equipment' && role !== 'CCR') {
    return (
      <div className="p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-2">CCR Status Dashboard</h2>
        <p className="text-gray-600">This dashboard is available for Equipment and CCR role users only.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-2">CCR Status Dashboard</h2>
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">CCR Status</h2>
          <p className="text-gray-600 text-sm">
            Live overview of device and switch status from the latest ONLINE-OFFLINE data merged with View Data.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-white rounded-lg shadow p-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Circle</label>
          <select
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
            value={circleFilter}
            onChange={(e) => setCircleFilter(e.target.value)}
          >
            <option value="">All</option>
            {circleOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Division</label>
          <select
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
            value={divisionFilter}
            onChange={(e) => setDivisionFilter(e.target.value)}
          >
            <option value="">All</option>
            {divisionOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Sub Division</label>
          <select
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
            value={subDivisionFilter}
            onChange={(e) => setSubDivisionFilter(e.target.value)}
          >
            <option value="">All</option>
            {subDivisionOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Date</label>
          <input
            type="date"
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
            value={selectedDate || ''}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
      </div>

      {/* 1 x 6 clickable cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <DashboardCard
          title="ONLINE"
          value={onlineCount}
          gradient="from-emerald-500 to-emerald-600"
          onClick={() => {
            const params = new URLSearchParams();
            params.set('status', 'ONLINE');
            if (selectedDate) params.set('date', selectedDate);
            navigate(`/dashboard/device-status-table?${params.toString()}`);
          }}
          icon={
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <DashboardCard
          title="OFFLINE"
          value={offlineCount}
          gradient="from-rose-500 to-rose-600"
          onClick={() => {
            const params = new URLSearchParams();
            params.set('status', 'OFFLINE');
            if (selectedDate) params.set('date', selectedDate);
            navigate(`/dashboard/device-status-table?${params.toString()}`);
          }}
          icon={
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <DashboardCard
          title="LOCAL"
          value={localCount}
          gradient="from-sky-500 to-sky-600"
          onClick={() => {
            const params = new URLSearchParams();
            params.set('status', 'LOCAL');
            if (selectedDate) params.set('date', selectedDate);
            navigate(`/dashboard/device-status-table?${params.toString()}`);
          }}
          icon={
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <DashboardCard
          title="REMOTE"
          value={remoteCount}
          gradient="from-indigo-500 to-indigo-600"
          onClick={() => {
            const params = new URLSearchParams();
            params.set('status', 'REMOTE');
            if (selectedDate) params.set('date', selectedDate);
            navigate(`/dashboard/device-status-table?${params.toString()}`);
          }}
          icon={
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
          }
        />
        <DashboardCard
          title="SWITCH ISSUE"
          value={switchIssueCount}
          gradient="from-amber-500 to-amber-600"
          onClick={() => {
            const params = new URLSearchParams();
            params.set('status', 'SWITCH ISSUE');
            if (selectedDate) params.set('date', selectedDate);
            navigate(`/dashboard/device-status-table?${params.toString()}`);
          }}
          icon={
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          }
        />
        <DashboardCard
          title="RTU LOCAL"
          value={rtuLocalCount}
          gradient="from-purple-500 to-purple-600"
          onClick={() => {
            const params = new URLSearchParams();
            params.set('status', 'RTU LOCAL');
            if (selectedDate) params.set('date', selectedDate);
            navigate(`/dashboard/device-status-table?${params.toString()}`);
          }}
          icon={
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
          }
        />
      </div>

      {/* Trend Analysis Charts - Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ONLINE & OFFLINE Trend Chart */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="mb-4">
            <h3 className="text-xl font-bold text-gray-800">Device Status Trend</h3>
            <p className="text-sm text-gray-600 mt-1">ONLINE vs OFFLINE over time</p>
          </div>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart
              data={onlineOfflineTrendData}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
              <XAxis 
                dataKey="dateLabel" 
                tick={{ fill: '#6b7280', fontSize: 11 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis 
                tick={{ fill: '#6b7280', fontSize: 12 }}
                label={{ value: 'Count', angle: -90, position: 'insideLeft', fill: '#6b7280', style: { fontSize: '12px', fontWeight: 600 } }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#ffffff', 
                  border: '1px solid #e5e7eb', 
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  padding: '12px'
                }}
                labelStyle={{ fontWeight: 600, marginBottom: '4px', color: '#374151' }}
              />
              <Legend 
                wrapperStyle={{ paddingTop: '10px' }}
                iconType="circle"
              />
              <Line 
                type="monotone" 
                dataKey="online" 
                stroke="#10b981" 
                strokeWidth={3}
                dot={{ fill: '#10b981', r: 4, strokeWidth: 2, stroke: '#ffffff' }}
                activeDot={{ r: 6, stroke: '#10b981', strokeWidth: 2 }}
                name="ONLINE"
                animationDuration={1000}
              />
              <Line 
                type="monotone" 
                dataKey="offline" 
                stroke="#f43f5e" 
                strokeWidth={3}
                dot={{ fill: '#f43f5e', r: 4, strokeWidth: 2, stroke: '#ffffff' }}
                activeDot={{ r: 6, stroke: '#f43f5e', strokeWidth: 2 }}
                name="OFFLINE"
                animationDuration={1000}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* LOCAL & REMOTE Trend Chart */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="mb-4">
            <h3 className="text-xl font-bold text-gray-800">Switch Status Trend</h3>
            <p className="text-sm text-gray-600 mt-1">LOCAL vs REMOTE over time</p>
          </div>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart
              data={localRemoteTrendData}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
              <XAxis 
                dataKey="dateLabel" 
                tick={{ fill: '#6b7280', fontSize: 11 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis 
                tick={{ fill: '#6b7280', fontSize: 12 }}
                label={{ value: 'Count', angle: -90, position: 'insideLeft', fill: '#6b7280', style: { fontSize: '12px', fontWeight: 600 } }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#ffffff', 
                  border: '1px solid #e5e7eb', 
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  padding: '12px'
                }}
                labelStyle={{ fontWeight: 600, marginBottom: '4px', color: '#374151' }}
              />
              <Legend 
                wrapperStyle={{ paddingTop: '10px' }}
                iconType="circle"
              />
              <Line 
                type="monotone" 
                dataKey="local" 
                stroke="#0ea5e9" 
                strokeWidth={3}
                dot={{ fill: '#0ea5e9', r: 4, strokeWidth: 2, stroke: '#ffffff' }}
                activeDot={{ r: 6, stroke: '#0ea5e9', strokeWidth: 2 }}
                name="LOCAL"
                animationDuration={1000}
              />
              <Line 
                type="monotone" 
                dataKey="remote" 
                stroke="#6366f1" 
                strokeWidth={3}
                dot={{ fill: '#6366f1', r: 4, strokeWidth: 2, stroke: '#ffffff' }}
                activeDot={{ r: 6, stroke: '#6366f1', strokeWidth: 2 }}
                name="REMOTE"
                animationDuration={1000}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function DashboardCard({
  title,
  value,
  gradient,
  icon,
  onClick,
}: {
  title: string;
  value: number;
  gradient: string;
  icon?: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex flex-col items-start justify-between rounded-xl bg-gradient-to-br ${gradient} px-4 py-5 text-left text-white shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all overflow-hidden`}
    >
      {/* Background decorative element */}
      <div className="absolute top-0 right-0 opacity-20">
        {icon}
      </div>
      
      {/* Content */}
      <div className="relative z-10 w-full">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold uppercase tracking-wide text-white/90">
            {title}
          </div>
          <div className="opacity-90">
            {icon}
          </div>
        </div>
        <div className="text-3xl font-bold">{value}</div>
      </div>
    </button>
  );
}


