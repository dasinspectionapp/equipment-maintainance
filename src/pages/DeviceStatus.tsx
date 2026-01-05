import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { API_BASE } from '../utils/api';
import { useTheme } from '../context/ThemeContext';

// Normalize function for case-insensitive matching
const normalize = (str: string): string => {
  return String(str || '').trim().toLowerCase().replace(/[_\s-]/g, '');
};

// Helper function to extract siteCode from action
function extractSiteCodeFromAction(action: any): string {
  if (!action) return '';
  
  // Check direct siteCode property first
  if (action.siteCode) {
    return String(action.siteCode).trim().toUpperCase();
  }
  
  // Check rowData for various siteCode field names
  const rowData = action.rowData || {};
  const siteCodeKeys = ['Site Code', 'SITE CODE', 'SiteCode', 'Site_Code', 'site code', 'site_code'];
  
  for (const key of siteCodeKeys) {
    if (rowData[key]) {
      return String(rowData[key]).trim().toUpperCase();
    }
  }
  
  // Case-insensitive search
  for (const key in rowData) {
    const normalizedKey = normalize(key);
    if (normalizedKey.includes('site') && normalizedKey.includes('code')) {
      return String(rowData[key]).trim().toUpperCase();
    }
  }
  
  return '';
}

// Format date to DD-MM-YYYY
function formatDate(dateString: string | Date | null | undefined): string {
  if (!dateString) return '-';
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    if (isNaN(date.getTime())) return '-';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  } catch {
    return '-';
  }
}

interface SiteStatusRow {
  siteCode: string;
  taskStatus: string;
  presentStatus: string;
  typeOfIssue?: string;
  remarks?: string;
  circle?: string;
  division?: string;
  subDivision?: string;
  hrn?: string;
  date?: string;
  dateLabel?: string;
  deviceStatus?: string;
  noOfDaysOffline?: number | string;
  attribute?: string;
}

interface MultiSelectDropdownProps {
  label: string;
  options: string[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  loading?: boolean;
  placeholder?: string;
}

function getCurrentUser() {
  try {
    const stored = localStorage.getItem('user');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error parsing user data:', error);
  }
  return {};
}

function getCurrentUserRole() {
  try {
    const user = getCurrentUser();
    return user?.role || '';
  } catch {
    return '';
  }
}

export default function DeviceStatus() {
  const navigate = useNavigate();
  const [applicationType, setApplicationType] = useState<string>('OFFLINE SITES');
  const [selectedCircles, setSelectedCircles] = useState<string[]>([]);
  const [selectedDivisions, setSelectedDivisions] = useState<string[]>([]);
  const [selectedSubDivisions, setSelectedSubDivisions] = useState<string[]>([]);
  const [timeRange, setTimeRange] = useState<string>('All');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  const [siteStatuses, setSiteStatuses] = useState<SiteStatusRow[]>([]);
  const [allSiteStatuses, setAllSiteStatuses] = useState<SiteStatusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtersLoading, setFiltersLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [circleOptions, setCircleOptions] = useState<string[]>([]);
  const [divisionOptions, setDivisionOptions] = useState<string[]>([]);
  const [subDivisionOptions, setSubDivisionOptions] = useState<string[]>([]);

  // MultiSelectDropdown Component
  const MultiSelectDropdown = ({ label, options, selectedValues, onChange, loading, placeholder = 'Select options' }: MultiSelectDropdownProps) => {
    const { theme } = useTheme();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const ALL_OPTION = 'All';

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, []);

    const handleToggle = (value: string) => {
      if (value === ALL_OPTION) {
        onChange([]);
      } else {
        if (selectedValues.includes(value)) {
          onChange(selectedValues.filter(v => v !== value));
        } else {
          onChange([...selectedValues, value]);
        }
      }
    };

    const handleClearAll = (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange([]);
    };

    const isAllSelected = selectedValues.length === 0;

    return (
      <div className="relative" ref={dropdownRef}>
        <label className="block text-sm font-medium mb-2" style={{ color: theme.text }}>
          {label}
        </label>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-4 py-2.5 border rounded-lg text-left focus:outline-none focus:ring-2 transition-colors flex items-center justify-between"
          style={{
            backgroundColor: theme.inputBackground,
            borderColor: theme.inputBorder,
            color: theme.text,
          }}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = theme.primary}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = theme.inputBorder}
        >
          <span style={{ color: isAllSelected ? theme.textMuted : theme.text }}>
            {loading ? 'Loading...' : isAllSelected ? `${placeholder} (All)` : `${selectedValues.length} selected`}
          </span>
          <div className="flex items-center gap-2">
            {!isAllSelected && (
              <button
                type="button"
                onClick={handleClearAll}
                className="transition-colors"
                style={{ color: theme.icon }}
                onMouseEnter={(e) => e.currentTarget.style.color = theme.error}
                onMouseLeave={(e) => e.currentTarget.style.color = theme.icon}
                title="Clear All"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            <svg
              className={`w-5 h-5 transition-transform ${isOpen ? 'transform rotate-180' : ''}`}
              style={{ color: theme.icon }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {isOpen && (
          <div 
            className="absolute z-50 w-full mt-1 border rounded-lg shadow-lg max-h-60 overflow-auto"
            style={{
              backgroundColor: theme.surface,
              borderColor: theme.border,
            }}
          >
            {loading ? (
              <div className="px-4 py-3 text-sm text-center" style={{ color: theme.textMuted }}>Loading...</div>
            ) : options.length === 0 ? (
              <div className="px-4 py-3 text-sm text-center" style={{ color: theme.textMuted }}>No options available</div>
            ) : (
              <>
                <label
                  className="flex items-center px-4 py-2.5 cursor-pointer transition-colors border-b"
                  style={{
                    backgroundColor: isAllSelected ? theme.primary + '20' : 'transparent',
                    borderBottomColor: theme.border,
                  }}
                  onMouseEnter={(e) => !isAllSelected && (e.currentTarget.style.backgroundColor = theme.primary + '10')}
                  onMouseLeave={(e) => !isAllSelected && (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={() => handleToggle(ALL_OPTION)}
                    className="w-4 h-4 rounded focus:ring-2"
                    style={{
                      accentColor: theme.primary,
                      borderColor: theme.border,
                    }}
                  />
                  <span className="ml-3 text-sm" style={{ color: isAllSelected ? theme.primary : theme.text, fontWeight: isAllSelected ? '600' : 'normal' }}>
                    {ALL_OPTION}
                  </span>
                </label>
                {options.map((option) => {
                  const isSelected = selectedValues.includes(option);
                  return (
                    <label
                      key={option}
                      className="flex items-center px-4 py-2.5 cursor-pointer transition-colors"
                      style={{
                        backgroundColor: isSelected ? theme.primary + '20' : 'transparent',
                      }}
                      onMouseEnter={(e) => !isSelected && (e.currentTarget.style.backgroundColor = theme.primary + '10')}
                      onMouseLeave={(e) => !isSelected && (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggle(option)}
                        className="w-4 h-4 rounded focus:ring-2"
                        style={{
                          accentColor: theme.primary,
                          borderColor: theme.border,
                        }}
                      />
                      <span className="ml-3 text-sm" style={{ color: theme.text }}>{option}</span>
                    </label>
                  );
                })}
              </>
            )}
          </div>
        )}

        {!isAllSelected && selectedValues.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {selectedValues.slice(0, 3).map((value) => (
              <span
                key={value}
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
              >
                {value}
                <button
                  type="button"
                  onClick={() => handleToggle(value)}
                  className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-blue-200 focus:outline-none"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </span>
            ))}
            {selectedValues.length > 3 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                +{selectedValues.length - 3} more
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  // Fetch filter options
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        setFiltersLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
          setError('Authentication required');
          return;
        }

        const filtersUrl = `${API_BASE}/api/equipment-offline-sites/reports/filters?_t=${Date.now()}`;
        const response = await fetch(filtersUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          cache: 'no-store'
        });

        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.success) {
          setCircleOptions(data.data.circles || []);
          setDivisionOptions(data.data.divisions || []);
          setSubDivisionOptions(data.data.subDivisions || []);
        }
      } catch (err: any) {
        console.error('Error fetching filters:', err);
      } finally {
        setFiltersLoading(false);
      }
    };

    fetchFilters();
  }, []);

  // Fetch device status data
  useEffect(() => {
    const fetchDeviceStatus = async () => {
      try {
        setLoading(true);
        setError(null);
        const token = localStorage.getItem('token');
        if (!token) {
          setError('Authentication required');
          return;
        }

        const userRole = getCurrentUserRole();
        if (userRole !== 'CCR') {
          setError('This page is only accessible to CCR role users');
          return;
        }

        // First, fetch Device Status Upload file to get ALL site codes (like MY OFFLINE SITES does)
        const uploadsRes = await fetch(`${API_BASE}/api/uploads`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const uploadsJson = await uploadsRes.json();

        if (!uploadsJson?.success) {
          setError('Failed to fetch uploads');
          return;
        }

        // Find Device Status Upload file
        const deviceStatusFile = (uploadsJson.files || [])
          .filter((f: any) => {
            const uploadType = String(f.uploadType || '').toLowerCase().trim();
            const fileName = String(f.name || '').toLowerCase();
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
          })
          .sort((a: any, b: any) => {
            const dateA = a.uploadedAt ? new Date(a.uploadedAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
            const dateB = b.uploadedAt ? new Date(b.uploadedAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
            return dateB - dateA;
          })[0];

        if (!deviceStatusFile) {
          setError('No Device Status Upload file found');
          return;
        }

        // Log which Device Status Upload file is being used (to verify it's the latest)
        console.log('[DeviceStatus] Using Device Status Upload file:', {
          name: deviceStatusFile.name,
          uploadedAt: deviceStatusFile.uploadedAt,
          createdAt: deviceStatusFile.createdAt,
          fileId: deviceStatusFile.fileId
        });

        // Fetch Device Status file data
        const fileRes = await fetch(`${API_BASE}/api/uploads/${deviceStatusFile.fileId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const fileJson = await fileRes.json();

        if (!fileJson?.success || !fileJson.file) {
          setError('Failed to fetch file data');
          return;
        }

        const deviceStatusFileData = fileJson.file;
        let fileRows = Array.isArray(deviceStatusFileData.rows) ? deviceStatusFileData.rows : [];
        let hdrs = deviceStatusFileData.headers && deviceStatusFileData.headers.length 
          ? deviceStatusFileData.headers 
          : (fileRows[0] ? Object.keys(fileRows[0]) : []);

        // Find main SITE CODE header (same as MY OFFLINE SITES)
        const mainSiteCodeHeader = hdrs.find((h: string) => {
          const n = normalize(h);
          return n === 'sitecode' || n === 'site_code' || n === 'site code';
        });

        if (!mainSiteCodeHeader) {
          setError('Site Code column not found');
          return;
        }

        // Find other headers we need
        const circleHeader = hdrs.find((h: string) => {
          const n = normalize(h);
          return n === 'circle' || n === 'circle name' || n === 'the circle';
        });

        const divisionHeader = hdrs.find((h: string) => {
          const n = normalize(h);
          return n === 'division';
        });

        const subDivisionHeader = hdrs.find((h: string) => {
          const n = normalize(h);
          return n === 'subdivision' || n === 'sub division' || n === 'sub_division';
        });

        const hrnHeader = hdrs.find((h: string) => {
          const n = normalize(h);
          return n === 'hrn';
        });

        // Find ATTRIBUTE column in Device Status Upload file (it's usually in the main file, not ONLINE-OFFLINE)
        const attributeHeaderInMainFile = hdrs.find((h: string) => {
          const n = normalize(h);
          return n === 'attribute' || n === 'attributes';
        });

        console.log(`[DeviceStatus] Found ${fileRows.length} rows in Device Status Upload file`);
        console.log(`[DeviceStatus] ATTRIBUTE header in main file:`, attributeHeaderInMainFile);
        console.log(`[DeviceStatus] Available headers in main file:`, hdrs);

        // STEP 1: Merge ONLINE-OFFLINE data into fileRows (same as MY OFFLINE SITES)
        // This is critical - MY OFFLINE SITES merges data FIRST, then filters
        let mergedDeviceStatusColumn: string | undefined = undefined;
        let mergedNoOfDaysOfflineColumn: string | undefined = undefined;
        let mergedAttributeColumn: string | undefined = undefined;
        
        // Store ONLINE-OFFLINE data for reuse (to avoid fetching twice)
        let cachedOnlineOfflineData: any = null;
        let cachedOnlineOfflineRows: any[] = [];
        let cachedOnlineOfflineHeaders: string[] = [];
        
        try {
          // Find ONLINE-OFFLINE file
          const allOnlineOfflineFiles = (uploadsJson.files || [])
            .filter((f: any) => {
              const uploadType = String(f.uploadType || '').toLowerCase().trim();
              const fileName = String(f.name || '').toLowerCase();
              const isOnlineOfflineType = uploadType === 'online-offline-data';
              const isOnlineOfflineFileName = fileName.includes('online-offline') || 
                                             fileName.includes('online_offline') ||
                                             fileName.includes('onlineoffline');
              return isOnlineOfflineType || isOnlineOfflineFileName;
            });
          
          // Log all available ONLINE-OFFLINE files for debugging
          console.log('[DeviceStatus] Found', allOnlineOfflineFiles.length, 'ONLINE-OFFLINE files:');
          allOnlineOfflineFiles.forEach((f: any, idx: number) => {
            const uploadDate = f.uploadedAt || f.createdAt;
            console.log(`  ${idx + 1}. ${f.name} - Uploaded: ${uploadDate}`);
          });
          
          const onlineOfflineFile = allOnlineOfflineFiles
            .sort((a: any, b: any) => {
              const dateA = a.uploadedAt ? new Date(a.uploadedAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
              const dateB = b.uploadedAt ? new Date(b.uploadedAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
              return dateB - dateA;
            })[0];

          if (onlineOfflineFile) {
            // Log which ONLINE-OFFLINE file is being used for merging (to verify it's the latest)
            const uploadDate = onlineOfflineFile.uploadedAt || onlineOfflineFile.createdAt;
            console.log('[DeviceStatus] ===== ONLINE-OFFLINE FILE BEING USED =====');
            console.log('[DeviceStatus] File name:', onlineOfflineFile.name);
            console.log('[DeviceStatus] Upload date:', uploadDate);
            console.log('[DeviceStatus] File ID:', onlineOfflineFile.fileId);
            console.log('[DeviceStatus] ==========================================');
            
            const onlineOfflineRes = await fetch(`${API_BASE}/api/uploads/${onlineOfflineFile.fileId}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            const onlineOfflineJson = await onlineOfflineRes.json();

            if (onlineOfflineJson?.success && onlineOfflineJson.file) {
              // OPTIMIZATION: Cache the ONLINE-OFFLINE data for reuse later
              cachedOnlineOfflineData = onlineOfflineJson.file;
              cachedOnlineOfflineRows = Array.isArray(cachedOnlineOfflineData.rows) ? cachedOnlineOfflineData.rows : [];
              cachedOnlineOfflineHeaders = cachedOnlineOfflineData.headers && cachedOnlineOfflineData.headers.length 
                ? cachedOnlineOfflineData.headers 
                : (cachedOnlineOfflineRows[0] ? Object.keys(cachedOnlineOfflineRows[0]) : []);

              // Find SITE CODE column in ONLINE-OFFLINE file
              const onlineOfflineSiteCodeHeader = cachedOnlineOfflineHeaders.find((h: string) => {
                const n = normalize(h);
                return n === 'sitecode' || n === 'site_code' || n === 'site code';
              });

              // CRITICAL FIX: Find DEVICE STATUS column for the MOST RECENT DATE
              // The ONLINE-OFFLINE file has multiple DEVICE STATUS columns (one per date)
              // We need to find the one corresponding to the latest date, not just the first one
              
              // Helper function to parse date from column name
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
                      const parsedDate = new Date(year, month, day);
                      if (!isNaN(parsedDate.getTime())) {
                        return parsedDate;
                      }
                    } else {
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
              
              // Find all date columns with their indices
              const dateColumns: Array<{ name: string; date: Date; index: number }> = [];
              cachedOnlineOfflineHeaders.forEach((header: string, index: number) => {
                const date = parseDateFromColumnName(header);
                if (date) {
                  dateColumns.push({ name: header, date, index });
                }
              });
              
              // Sort by date (most recent first)
              dateColumns.sort((a, b) => b.date.getTime() - a.date.getTime());
              
              console.log('[DeviceStatus] Found date columns:', dateColumns.map(d => ({ name: d.name, date: d.date.toLocaleDateString() })));
              
              // Find DEVICE STATUS column after the most recent date
              let deviceStatusHeader: string | undefined = undefined;
              let noOfDaysOfflineHeader: string | undefined = undefined;
              
              if (dateColumns.length > 0) {
                const mostRecentDateIndex = dateColumns[0].index;
                console.log('[DeviceStatus] Most recent date:', dateColumns[0].name, 'at index', mostRecentDateIndex);
                
                // Look for DEVICE STATUS column after this date column
                for (let i = mostRecentDateIndex + 1; i < cachedOnlineOfflineHeaders.length; i++) {
                  const header = cachedOnlineOfflineHeaders[i];
                  const n = normalize(header);
                  
                  // Stop if we hit another date column
                  if (parseDateFromColumnName(header)) {
                    break;
                  }
                  
                  // Find DEVICE STATUS
                  if (!deviceStatusHeader && (n === 'device status' ||
                       n === 'device_status' ||
                       n === 'devicestatus' ||
                       (n.includes('device') && n.includes('status') && !n.includes('rtu')))) {
                    deviceStatusHeader = header;
                    console.log('[DeviceStatus] Found DEVICE STATUS for latest date at index', i, ':', header);
                  }
                  
                  // Find NO OF DAYS OFFLINE
                  if (!noOfDaysOfflineHeader && (n === 'no of days offline' ||
                       n === 'no_of_days_offline' ||
                       n === 'noofdaysoffline' ||
                       (n.includes('days') && n.includes('offline')) ||
                       (n.includes('day') && n.includes('offline')))) {
                    noOfDaysOfflineHeader = header;
                    console.log('[DeviceStatus] Found NO OF DAYS OFFLINE for latest date at index', i, ':', header);
                  }
                  
                  // Stop once we've found both
                  if (deviceStatusHeader && noOfDaysOfflineHeader) {
                    break;
                  }
                }
              }
              
              // Fallback: If we couldn't find columns after latest date, use the first occurrence
              if (!deviceStatusHeader) {
                deviceStatusHeader = cachedOnlineOfflineHeaders.find((h: string) => {
                  const n = normalize(h);
                  return n === 'device status' ||
                         n === 'device_status' ||
                         n === 'devicestatus' ||
                         (n.includes('device') && n.includes('status') && !n.includes('rtu'));
                });
                console.log('[DeviceStatus] Using fallback DEVICE STATUS header:', deviceStatusHeader);
              }
              
              if (!noOfDaysOfflineHeader) {
                noOfDaysOfflineHeader = cachedOnlineOfflineHeaders.find((h: string) => {
                  const n = normalize(h);
                  return n === 'no of days offline' ||
                         n === 'no_of_days_offline' ||
                         n === 'noofdaysoffline' ||
                         (n.includes('days') && n.includes('offline')) ||
                         (n.includes('day') && n.includes('offline'));
                });
              }

              const attributeHeader = cachedOnlineOfflineHeaders.find((h: string) => {
                const n = normalize(h);
                return n === 'attribute' || n === 'attributes';
              });

              console.log('[DeviceStatus] DEVICE STATUS header found:', deviceStatusHeader);
              console.log('[DeviceStatus] NO OF DAYS OFFLINE header found:', noOfDaysOfflineHeader);
              console.log('[DeviceStatus] ATTRIBUTE header found:', attributeHeader);

              // Build columns to merge: DEVICE STATUS, NO OF DAYS OFFLINE, and ATTRIBUTE
              const onlineOfflineColumns: string[] = [];
              if (deviceStatusHeader) {
                onlineOfflineColumns.push(deviceStatusHeader);
                mergedDeviceStatusColumn = deviceStatusHeader;
              }
              if (noOfDaysOfflineHeader) {
                onlineOfflineColumns.push(noOfDaysOfflineHeader);
                mergedNoOfDaysOfflineColumn = noOfDaysOfflineHeader;
              }
              if (attributeHeader) {
                onlineOfflineColumns.push(attributeHeader);
                mergedAttributeColumn = attributeHeader;
              }

              console.log('[DeviceStatus] ONLINE-OFFLINE columns to merge:', onlineOfflineColumns);

              if (mainSiteCodeHeader && onlineOfflineSiteCodeHeader && onlineOfflineColumns.length > 0) {
                // Create a map of ONLINE-OFFLINE data by SITE CODE (same as MY OFFLINE SITES)
                const onlineOfflineMap = new Map<string, any>();
                
                cachedOnlineOfflineRows.forEach((row: any) => {
                  const siteCode = String(row[onlineOfflineSiteCodeHeader] || '').trim().toUpperCase();
                  if (siteCode) {
                    // If multiple rows exist for same SITE CODE, keep the latest one
                    if (!onlineOfflineMap.has(siteCode)) {
                      onlineOfflineMap.set(siteCode, row);
                    }
                  }
                });
                
                console.log('[DeviceStatus] Mapped ONLINE-OFFLINE data for', onlineOfflineMap.size, 'unique SITE CODEs');
                
                // Merge data into main rows (same as MY OFFLINE SITES)
                let mergedCount = 0;
                fileRows = fileRows.map((row: any) => {
                  const siteCode = String(row[mainSiteCodeHeader] || '').trim().toUpperCase();
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
                
                console.log('[DeviceStatus] Merged ONLINE-OFFLINE data into', mergedCount, 'rows');
                
                // CRITICAL: Update headers to include merged columns (same as MY OFFLINE SITES)
                onlineOfflineColumns.forEach((col: string) => {
                  if (!hdrs.includes(col)) {
                    // Find SITE CODE index to insert after it
                    const siteCodeIndex = hdrs.indexOf(mainSiteCodeHeader);
                    if (siteCodeIndex !== -1) {
                      hdrs.splice(siteCodeIndex + 1, 0, col);
                    } else {
                      hdrs.push(col);
                    }
                    console.log(`[DeviceStatus] Added merged column "${col}" to headers`);
                  }
                });
                console.log('[DeviceStatus] Updated headers after merge:', hdrs);
              }
            }
          }
        } catch (error) {
          console.error('[DeviceStatus] Error merging ONLINE-OFFLINE data:', error);
          // Continue even if merge fails
        }

        // OPTIMIZATION: Fetch EquipmentOfflineSites, Actions, and Approvals in parallel
        // These API calls don't depend on each other, so we can fetch them simultaneously
        console.log('[DeviceStatus] Fetching EquipmentOfflineSites, Actions, and Approvals in parallel...');
        const [offlineSitesJson, actionsJson, approvalsJson] = await Promise.all([
          fetch(`${API_BASE}/api/equipment-offline-sites?includeApproved=true`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }).then(res => res.json()),
          
          fetch(`${API_BASE}/api/actions`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }).then(res => res.json()).catch(err => {
            console.warn('[DeviceStatus] Failed to fetch actions:', err);
            return { data: [], actions: [] };
          }),
          
          fetch(`${API_BASE}/api/approvals`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }).then(res => res.json()).catch(err => {
            console.warn('[DeviceStatus] Failed to fetch approvals:', err);
            return { data: [] };
          })
        ]);
        
        console.log('[DeviceStatus] Parallel fetch completed');

        const offlineSites = Array.isArray(offlineSitesJson?.data) ? offlineSitesJson.data : [];
        const actions = Array.isArray(actionsJson?.data) ? actionsJson.data : (Array.isArray(actionsJson?.actions) ? actionsJson.actions : []);
        const approvals = Array.isArray(approvalsJson?.data) ? approvalsJson.data : [];

        // Create a map of site codes from offline sites (for merging with file data)
        const offlineSitesMap: Record<string, any> = {};
        offlineSites.forEach((site: any) => {
          const code = String(site.siteCode || '').trim().toUpperCase();
          if (code) {
            // If multiple records exist for same siteCode, keep the most recent one
            if (!offlineSitesMap[code] || 
                (site.updatedAt && offlineSitesMap[code].updatedAt && 
                 new Date(site.updatedAt) > new Date(offlineSitesMap[code].updatedAt))) {
              offlineSitesMap[code] = site;
            }
          }
        });

        // Calculate most recent OFFLINE date for each site code
        // OPTIMIZATION: Reuse cached ONLINE-OFFLINE data instead of fetching again
        const mostRecentOfflineDateMap: Record<string, Date> = {};
        try {
          // Use cached ONLINE-OFFLINE data (already fetched above)
          if (cachedOnlineOfflineData && cachedOnlineOfflineRows.length > 0) {
            console.log('[DeviceStatus] Reusing cached ONLINE-OFFLINE data for offline date calculation (performance optimization)');
            
            const onlineOfflineRows = cachedOnlineOfflineRows;
            const onlineOfflineHeaders = cachedOnlineOfflineHeaders;

              // Find SITE CODE header
              const onlineOfflineSiteCodeHeader = onlineOfflineHeaders.find((h: string) => {
                const n = normalize(h);
                return n === 'sitecode' || n === 'site_code' || n === 'site code';
              });

              // Find all date columns (format: DD-MM-YYYY or "DATE DD-MM-YYYY")
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
                      const parsedDate = new Date(year, month, day);
                      if (!isNaN(parsedDate.getTime())) {
                        return parsedDate;
                      }
                    } else {
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
              
              const dateColumns: Array<{ name: string; date: Date }> = [];
              onlineOfflineHeaders.forEach((header: string) => {
                const date = parseDateFromColumnName(header);
                if (date) {
                  dateColumns.push({ name: header, date });
                }
              });

              // For each site code, find the date when it transitioned to OFFLINE
              onlineOfflineRows.forEach((row: any) => {
                const siteCode = onlineOfflineSiteCodeHeader 
                  ? String(row[onlineOfflineSiteCodeHeader] || '').trim().toUpperCase()
                  : '';
                
                if (!siteCode) return;

                const sortedDateColumns = [...dateColumns].sort((a, b) => a.date.getTime() - b.date.getTime());
                const statusByDate: Array<{ date: Date; status: string }> = [];
                
                for (const dateCol of sortedDateColumns) {
                  const dateIndex = onlineOfflineHeaders.indexOf(dateCol.name);
                  if (dateIndex === -1) continue;

                  let deviceStatusHeader: string | null = null;
                  for (let i = dateIndex + 1; i < onlineOfflineHeaders.length; i++) {
                    const nextHeader = onlineOfflineHeaders[i];
                    const normalizedNext = normalize(nextHeader);
                    const nextHeaderDate = parseDateFromColumnName(nextHeader);
                    if (nextHeaderDate) break;
                    
                    if ((normalizedNext.includes('device') && normalizedNext.includes('status') && 
                         !normalizedNext.includes('rtu'))) {
                      deviceStatusHeader = nextHeader;
                      break;
                    }
                  }

                  if (deviceStatusHeader) {
                    const deviceStatus = String(row[deviceStatusHeader] || '').trim().toUpperCase();
                    statusByDate.push({ date: dateCol.date, status: deviceStatus });
                  }
                }

                // Find the date to use: most recent transition from ONLINE to OFFLINE, or oldest OFFLINE date
                let targetDate: Date | null = null;
                
                for (let i = statusByDate.length - 1; i >= 1; i--) {
                  const prevStatus = statusByDate[i - 1].status;
                  const currStatus = statusByDate[i].status;
                  if (prevStatus === 'ONLINE' && currStatus === 'OFFLINE') {
                    targetDate = statusByDate[i].date;
                    break;
                  }
                }
                
                if (!targetDate) {
                  for (const statusEntry of statusByDate) {
                    if (statusEntry.status === 'OFFLINE') {
                      targetDate = statusEntry.date;
                      break;
                    }
                  }
                }
                
                if (targetDate) {
                  mostRecentOfflineDateMap[siteCode] = targetDate;
                }
              });
          } else {
            console.log('[DeviceStatus] No cached ONLINE-OFFLINE data available for offline date calculation');
          }
        } catch (err) {
          console.warn('[DeviceStatus] Error calculating ONLINE-OFFLINE dates:', err);
        }

        // Build site status rows from rows where:
        // 1. DEVICE STATUS = "OFFLINE" (in the LATEST uploaded data)
        // 2. NO OF DAYS OFFLINE >= 2
        // 3. ATTRIBUTE = "IN PRODUCTION" (from Device Status Upload file)
        // 
        // IMPORTANT BEHAVIOR:
        // - Only show sites where the CURRENT/LATEST Device Status is "OFFLINE"
        // - If a site was OFFLINE yesterday but is ONLINE today, it will NOT be shown
        // - This ensures the list reflects the current state from the most recent upload
        // 
        // Merge with EquipmentOfflineSites data if available
        let debugCount = 0;
        const statusRows: SiteStatusRow[] = fileRows
          .filter((row: any) => {
            const siteCode = String(row[mainSiteCodeHeader] || '').trim().toUpperCase();
            const offlineSite = offlineSitesMap[siteCode]; // Get database data if exists
            
            // Filter 1: DEVICE STATUS = "OFFLINE" (case-insensitive)
            // This checks the LATEST Device Status from the most recent upload
            // CRITICAL: If CCR has approved, check database deviceStatus (should be 'ONLINE')
            // Otherwise, check file deviceStatus from the latest upload
            let deviceStatus = mergedDeviceStatusColumn ? String(row[mergedDeviceStatusColumn] || '').trim() : '';
            
            // Special case: If CCR has approved this site, use the database deviceStatus
            // (which should reflect the approved ONLINE state)
            if (offlineSite?.ccrStatus === 'Approved' && offlineSite?.deviceStatus) {
              deviceStatus = String(offlineSite.deviceStatus).trim().toUpperCase();
              console.log('[DeviceStatus] Filter: CCR approved site, using database deviceStatus:', {
                siteCode,
                fileDeviceStatus: mergedDeviceStatusColumn ? String(row[mergedDeviceStatusColumn] || '').trim() : '',
                databaseDeviceStatus: deviceStatus,
                ccrStatus: offlineSite.ccrStatus
              });
            }
            
            const normalizedStatus = normalize(deviceStatus);
            const isOffline = normalizedStatus === 'offline';
            const isOnline = normalizedStatus === 'online';
            
            // DEBUG: Log status for specific site code
            if (siteCode === '3W2668') {
              console.log('[DeviceStatus] DEBUG - Site 3W2668 status check:', {
                siteCode,
                deviceStatus,
                normalizedStatus,
                isOffline,
                isOnline,
                mergedDeviceStatusColumn,
                rawValue: mergedDeviceStatusColumn ? row[mergedDeviceStatusColumn] : 'N/A'
              });
            }
            
            // CRITICAL FILTER: Exclude sites that are ONLINE in the latest data
            // This ensures:
            // - Yesterday OFFLINE + Today ONLINE = NOT shown in the list
            // - Yesterday OFFLINE + Today OFFLINE = shown in the list
            if (!isOffline) {
              // Log exclusion of ONLINE sites for debugging
              if (isOnline && debugCount < 10) {
                console.log('[DeviceStatus] Filter: Excluding site (latest status is ONLINE):', siteCode);
                debugCount++;
              }
              return false; // Don't show sites that are ONLINE in the latest upload
            }
            
            // Additional check: If CCR has approved and deviceStatus is 'ONLINE', exclude from list
            // (This check is redundant as we already checked isOffline above, but kept for clarity)
            if (offlineSite?.ccrStatus === 'Approved' && isOnline) {
              console.log('[DeviceStatus] Filter: Excluding site (CCR approved, device is ONLINE):', siteCode);
              return false;
            }
            
            // Filter 2: NO OF DAYS OFFLINE >= 2
            const noOfDaysOfflineValue = mergedNoOfDaysOfflineColumn ? row[mergedNoOfDaysOfflineColumn] : null;
            let noOfDaysOffline = 0;
            if (noOfDaysOfflineValue !== null && noOfDaysOfflineValue !== undefined && noOfDaysOfflineValue !== '') {
              if (typeof noOfDaysOfflineValue === 'number') {
                noOfDaysOffline = noOfDaysOfflineValue;
              } else if (typeof noOfDaysOfflineValue === 'string') {
                const cleaned = noOfDaysOfflineValue.trim().replace(/[^\d.]/g, '');
                noOfDaysOffline = parseFloat(cleaned) || 0;
              }
            }
            if (noOfDaysOffline < 2) return false;
            
            // Filter 3: ATTRIBUTE = "IN PRODUCTION" (case-insensitive) from Device Status Upload file
            // Check ATTRIBUTE in main file first (Device Status Upload file)
            let attributeKey = attributeHeaderInMainFile;
            if (!attributeKey) {
              // Fallback: check if ATTRIBUTE was merged from ONLINE-OFFLINE
              attributeKey = mergedAttributeColumn;
            }
            if (!attributeKey) {
              // Last resort: search in headers
              attributeKey = hdrs.find((h: string) => {
                const n = normalize(h);
                return n === 'attribute' || n === 'attributes';
              });
            }
            
            if (!attributeKey) {
              console.warn(`[DeviceStatus] ATTRIBUTE column not found for site ${row[mainSiteCodeHeader]}. Available headers:`, Object.keys(row));
              return false;
            }
            
            const attribute = String(row[attributeKey] || '').trim();
            const normalizedAttribute = normalize(attribute);
            // Normalize removes spaces, so "IN PRODUCTION" becomes "inproduction"
            // Compare with both "inproduction" (no space) and "in production" (with space)
            const isInProduction = normalizedAttribute === 'inproduction' || normalizedAttribute === 'in production';
            
            // Debug: Log first 10 ATTRIBUTE values to see what we're getting
            if (debugCount < 10) {
              console.log(`[DeviceStatus] Sample site ${row[mainSiteCodeHeader]}: ATTRIBUTE="${attribute}" (normalized="${normalizedAttribute}")`);
              debugCount++;
            }
            
            if (!isInProduction) {
              // Only log failures for first few sites to avoid console spam
              if (debugCount <= 10) {
                console.log(`[DeviceStatus] Site ${row[mainSiteCodeHeader]} failed ATTRIBUTE filter: actual="${attribute}" (normalized="${normalizedAttribute}"), required="inproduction" or "in production"`);
              }
              return false;
            }
            
            return true;
          })
          .map((row: any) => {
          const siteCode = String(row[mainSiteCodeHeader] || '').trim().toUpperCase();
          const offlineSite = offlineSitesMap[siteCode]; // Get database data if exists

          // Use file data for Division, Sub Division, HRN, Circle (from merged row)
          const division = divisionHeader ? String(row[divisionHeader] || '').trim() : '';
          const subDivision = subDivisionHeader ? String(row[subDivisionHeader] || '').trim() : '';
          const hrn = hrnHeader ? String(row[hrnHeader] || '').trim() : '';
          const circle = circleHeader ? String(row[circleHeader] || '').trim() : '';
          
          // Extract DEVICE STATUS, NO OF DAYS OFFLINE, and ATTRIBUTE from merged row
          // CRITICAL: If CCR has approved (ccrStatus === 'Approved'), use deviceStatus from database (should be 'ONLINE')
          // Otherwise, use deviceStatus from uploaded file
          let deviceStatus = mergedDeviceStatusColumn ? String(row[mergedDeviceStatusColumn] || '').trim() : '';
          if (offlineSite?.ccrStatus === 'Approved' && offlineSite?.deviceStatus) {
            // CCR has approved - use deviceStatus from database (should be 'ONLINE')
            deviceStatus = String(offlineSite.deviceStatus).trim().toUpperCase();
            console.log('[DeviceStatus] Using deviceStatus from database (CCR approved):', {
              siteCode,
              fileDeviceStatus: mergedDeviceStatusColumn ? String(row[mergedDeviceStatusColumn] || '').trim() : '',
              databaseDeviceStatus: deviceStatus,
              ccrStatus: offlineSite.ccrStatus
            });
          }
          const noOfDaysOfflineValue = mergedNoOfDaysOfflineColumn ? row[mergedNoOfDaysOfflineColumn] : null;
          let noOfDaysOffline: number | string = '-';
          if (noOfDaysOfflineValue !== null && noOfDaysOfflineValue !== undefined && noOfDaysOfflineValue !== '') {
            if (typeof noOfDaysOfflineValue === 'number') {
              noOfDaysOffline = noOfDaysOfflineValue;
            } else if (typeof noOfDaysOfflineValue === 'string') {
              const cleaned = noOfDaysOfflineValue.trim().replace(/[^\d.]/g, '');
              noOfDaysOffline = cleaned ? parseFloat(cleaned) : '-';
            }
          }
          
          // Find ATTRIBUTE column - check main file first, then merged ONLINE-OFFLINE data
          let attributeKey = attributeHeaderInMainFile;
          if (!attributeKey) {
            attributeKey = mergedAttributeColumn;
          }
          if (!attributeKey) {
            attributeKey = hdrs.find((h: string) => {
              const n = normalize(h);
              return n === 'attribute' || n === 'attributes';
            });
          }
          const attribute = attributeKey ? String(row[attributeKey] || '').trim() : '';

          // Get Task Status from database if available
          let taskStatus = offlineSite?.taskStatus || '';
          
          // If Task Status is blank in database, default to "Pending at Equipment Team"
          if (!taskStatus || taskStatus.trim() === '' || taskStatus === '-') {
            taskStatus = 'Pending at Equipment Team';
          }
          
          // Calculate Present Status based on Task Status
          let presentStatus = 'Pending at Equipment Team'; // Default
          let dateLabel = '';
          let dateValue: string | Date | null = null;
          
          // CRITICAL: First check if CCR has approved (regardless of taskStatus)
          // This ensures PRESENT STATUS updates correctly when CCR approves
          const ccrApproval = approvals.find((approval: any) => {
            const approvalSiteCode = String(approval.siteCode || '').trim().toUpperCase();
            return approvalSiteCode === siteCode &&
                   approval.approvalType === 'CCR Resolution Approval' &&
                   approval.assignedToRole === 'CCR';
          });
          
          const approvalAction = actions.find((action: any) => {
            const actionSiteCode = extractSiteCodeFromAction(action);
            return actionSiteCode === siteCode && 
                   (action.typeOfIssue === 'AMC Resolution Approval' || action.typeOfIssue === 'CCR Resolution Approval') &&
                   action.status === 'Completed' &&
                   (action.approvedByRole === 'CCR' || action.assignedToRole === 'CCR');
          });
          
          const ccrStatus = offlineSite?.ccrStatus || '';
          const approvalStatus = ccrApproval?.status || '';
          const isCCRApproved = ccrStatus === 'Approved' || approvalStatus === 'Approved';
          const isKeptForMonitoring = ccrStatus === 'Kept for Monitoring' || approvalStatus === 'Kept for Monitoring';
          const isRecheck = approvalStatus === 'Recheck Requested' ||
                           ccrStatus === 'Recheck' || 
                           ccrStatus === 'Recheck Requested';
          
          // If CCR has approved, show "Resolved and Approved" regardless of taskStatus
          if (isCCRApproved && (approvalAction || ccrApproval)) {
            presentStatus = 'Resolved and Approved';
            dateValue = ccrApproval?.approvedAt || approvalAction?.completedDate || ccrApproval?.updatedAt || approvalAction?.updatedAt || offlineSite?.updatedAt;
            dateLabel = 'CCR Approved Date';
          } else if (isKeptForMonitoring) {
            presentStatus = 'Kept for Monitoring';
            dateValue = offlineSite?.updatedAt || offlineSite?.createdAt;
            dateLabel = 'Date';
          } else if (isRecheck) {
            presentStatus = 'Recheck Initiated';
            dateValue = offlineSite?.updatedAt || offlineSite?.createdAt;
            dateLabel = 'Date';
          } else {
            // If CCR hasn't approved yet, calculate based on taskStatus
          
          // Check if Task Status is "Resolved" (greyed out)
          // Only consider it Resolved if taskStatus is explicitly "Resolved"
          // Note: Empty siteObservations alone does NOT mean Resolved - it could just be blank/not processed yet
          // We only show "Resolved at Equipment Team and Waiting for CCR Approval" when taskStatus is "Resolved"
          const isResolved = taskStatus && 
                            (taskStatus.toLowerCase().trim() === 'resolved' || 
                             taskStatus.toLowerCase().includes('resolved'));
          
          if (isResolved) {
            // CCR approval already checked above - if not approved, show waiting status
            if (!isCCRApproved && !isKeptForMonitoring && !isRecheck) {
              presentStatus = 'Resolved at Equipment Team and Waiting for CCR Approval';
              // Get Resolved Date (when Equipment team resolved it)
              const resolvedAction = actions.find((action: any) => {
                const actionSiteCode = extractSiteCodeFromAction(action);
                return actionSiteCode === siteCode && 
                       action.status === 'Completed' &&
                       (action.assignedByRole === 'Equipment' || action.assignedByRole === 'AMC');
              });
              dateValue = offlineSite?.updatedAt || resolvedAction?.completedDate || resolvedAction?.updatedAt || offlineSite?.createdAt;
              dateLabel = 'Resolved Date';
            }
            // If CCR approved/kept for monitoring/recheck, status already set above
          } else if (taskStatus && taskStatus.trim() !== '') {
            // CCR approval already checked above - if not approved, use taskStatus
            if (taskStatus.toLowerCase().includes('pending at')) {
              // For other "Pending at..." statuses, use the same value
              presentStatus = taskStatus;
              // If it's "Pending at Equipment Team", use most recent OFFLINE date
              if (taskStatus.toLowerCase().includes('pending at equipment team') || 
                  taskStatus.toLowerCase().includes('pending at equipment')) {
                const mostRecentOfflineDate = mostRecentOfflineDateMap[siteCode];
                if (mostRecentOfflineDate) {
                  dateValue = mostRecentOfflineDate;
                  dateLabel = 'Pending from Date';
                  console.log(`[DeviceStatus] Using offline date for ${siteCode} (taskStatus): ${formatDate(mostRecentOfflineDate)}`);
                } else {
                  console.log(`[DeviceStatus] No offline date found for ${siteCode} (taskStatus), using fallback`);
                  // Fallback to Date of Routing
                  const routingAction = actions.find((action: any) => {
                    const actionSiteCode = extractSiteCodeFromAction(action);
                    return actionSiteCode === siteCode;
                  });
                  dateValue = routingAction?.assignedDate || routingAction?.createdAt || offlineSite?.createdAt;
                  dateLabel = 'Pending from Date';
                }
              } else {
                // Get Date of Routing (first action assignedDate)
                const routingAction = actions.find((action: any) => {
                  const actionSiteCode = extractSiteCodeFromAction(action);
                  return actionSiteCode === siteCode;
                });
                dateValue = routingAction?.assignedDate || routingAction?.createdAt || offlineSite?.createdAt;
                dateLabel = 'Date of Routing';
              }
            } else {
              // For other task statuses, show as is
              presentStatus = taskStatus;
              // Get Date of Routing (first action assignedDate)
              const routingAction = actions.find((action: any) => {
                const actionSiteCode = extractSiteCodeFromAction(action);
                return actionSiteCode === siteCode;
              });
              dateValue = routingAction?.assignedDate || routingAction?.createdAt || offlineSite?.createdAt;
              dateLabel = 'Date of Routing';
            }
          } else {
            // No status - if Present Status is "Pending at Equipment Team", use most recent OFFLINE date
            if (presentStatus === 'Pending at Equipment Team') {
              const mostRecentOfflineDate = mostRecentOfflineDateMap[siteCode];
              if (mostRecentOfflineDate) {
                dateValue = mostRecentOfflineDate;
                dateLabel = 'Pending from Date';
                console.log(`[DeviceStatus] Using offline date for ${siteCode}: ${formatDate(mostRecentOfflineDate)}`);
              } else {
                console.log(`[DeviceStatus] No offline date found for ${siteCode}, using fallback`);
                // Fallback to Date of Routing if action exists
                const routingAction = actions.find((action: any) => {
                  const actionSiteCode = extractSiteCodeFromAction(action);
                  return actionSiteCode === siteCode;
                });
                if (routingAction) {
                  dateValue = routingAction?.assignedDate || routingAction?.createdAt;
                  dateLabel = 'Pending from Date';
                } else {
                  // Fallback to created date from offline site
                  dateValue = offlineSite?.createdAt;
                  dateLabel = 'Pending from Date';
                }
              }
            } else {
              // Get Date of Routing if action exists
              const routingAction = actions.find((action: any) => {
                const actionSiteCode = extractSiteCodeFromAction(action);
                return actionSiteCode === siteCode;
              });
              if (routingAction) {
                dateValue = routingAction?.assignedDate || routingAction?.createdAt;
                dateLabel = 'Date of Routing';
              } else {
                // Fallback to created date from offline site
                dateValue = offlineSite?.createdAt;
                dateLabel = 'Date';
              }
            }
          }
          } // Close the else block for CCR approval check

          return {
            siteCode,
            taskStatus: taskStatus || '-',
            presentStatus,
            typeOfIssue: offlineSite?.typeOfIssue || '-',
            remarks: offlineSite?.remarks || '-',
            circle: circle,
            division: division,
            subDivision: subDivision,
            hrn: hrn || '-',
            date: formatDate(dateValue),
            dateLabel: dateLabel || 'Date',
            deviceStatus: deviceStatus || '-',
            noOfDaysOffline: noOfDaysOffline,
            attribute: attribute || '-'
          };
        }).filter((row: SiteStatusRow | null): row is SiteStatusRow => row !== null);

        // Sort by site code
        statusRows.sort((a, b) => a.siteCode.localeCompare(b.siteCode));

        console.log(`[DeviceStatus] Total status rows: ${statusRows.length}`);

        setAllSiteStatuses(statusRows);
      } catch (err: any) {
        console.error('Error fetching device status:', err);
        setError(err.message || 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchDeviceStatus();
  }, []);

  // Apply filters
  useEffect(() => {
    let filtered = [...allSiteStatuses];

    // Filter by Application Type (OFFLINE SITES vs RTU TRACKER)
    // For OFFLINE SITES: Show all sites from EquipmentOfflineSites (they all have data)
    // For RTU TRACKER: Show sites that don't have offline site data (would need to implement separately)
    if (applicationType === 'OFFLINE SITES') {
      // All sites in allSiteStatuses are from EquipmentOfflineSites, so show all
      // No filtering needed - all sites are OFFLINE SITES
    } else if (applicationType === 'RTU TRACKER') {
      // For RTU TRACKER, filter out sites that have offline site data
      // This would require fetching from a different source (RTU Tracker data)
      // For now, show empty or implement RTU TRACKER logic separately
      filtered = [];
    }

    // Filter by Circle
    if (selectedCircles.length > 0) {
      filtered = filtered.filter(site => 
        site.circle && selectedCircles.some(circle => 
          normalize(site.circle || '') === normalize(circle)
        )
      );
    }

    // Filter by Division
    if (selectedDivisions.length > 0) {
      filtered = filtered.filter(site => 
        site.division && selectedDivisions.some(division => 
          normalize(site.division || '') === normalize(division)
        )
      );
    }

    // Filter by Sub Division
    if (selectedSubDivisions.length > 0) {
      filtered = filtered.filter(site => 
        site.subDivision && selectedSubDivisions.some(subDiv => 
          normalize(site.subDivision || '') === normalize(subDiv)
        )
      );
    }

    // Filter by search term
    if (searchTerm.trim() !== '') {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(site =>
        site.siteCode.toLowerCase().includes(searchLower) ||
        site.presentStatus.toLowerCase().includes(searchLower) ||
        site.taskStatus.toLowerCase().includes(searchLower) ||
        (site.division && site.division.toLowerCase().includes(searchLower)) ||
        (site.subDivision && site.subDivision.toLowerCase().includes(searchLower)) ||
        (site.hrn && site.hrn.toLowerCase().includes(searchLower)) ||
        (site.typeOfIssue && site.typeOfIssue.toLowerCase().includes(searchLower)) ||
        (site.remarks && site.remarks.toLowerCase().includes(searchLower)) ||
        (site.date && site.date.toLowerCase().includes(searchLower))
      );
    }

    // Filter by Time Range
    if (timeRange && timeRange !== 'All') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      filtered = filtered.filter(site => {
        if (!site.date || site.date === '-') return false;
        
        // Parse the date from site.date (format: DD-MM-YYYY or similar)
        const dateStr = site.date;
        let siteDate: Date | null = null;
        
        // Try to parse different date formats
        const dateFormats = [
          /(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/, // DD-MM-YYYY or DD/MM/YYYY
          /(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/, // YYYY-MM-DD or YYYY/MM/DD
        ];
        
        for (const format of dateFormats) {
          const match = dateStr.match(format);
          if (match) {
            if (format.source.includes('\\d{4}') && format.source.startsWith('(\\d{4})')) {
              // YYYY-MM-DD format
              const year = parseInt(match[1]);
              const month = parseInt(match[2]) - 1;
              const day = parseInt(match[3]);
              siteDate = new Date(year, month, day);
            } else {
              // DD-MM-YYYY format
              const day = parseInt(match[1]);
              const month = parseInt(match[2]) - 1;
              const year = parseInt(match[3]);
              siteDate = new Date(year, month, day);
            }
            break;
          }
        }
        
        // If parsing failed, try Date constructor
        if (!siteDate || isNaN(siteDate.getTime())) {
          siteDate = new Date(dateStr);
          if (isNaN(siteDate.getTime())) return false;
        }
        
        // Normalize to start of day
        const siteDateOnly = new Date(siteDate.getFullYear(), siteDate.getMonth(), siteDate.getDate());
        
        switch (timeRange) {
          case 'This Day':
            return siteDateOnly.getTime() === today.getTime();
          
          case 'This Week':
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
            return siteDateOnly >= weekStart && siteDateOnly <= today;
          
          case 'This Month':
            return siteDateOnly.getMonth() === today.getMonth() && 
                   siteDateOnly.getFullYear() === today.getFullYear();
          
          case 'Date Range':
            if (!startDate && !endDate) return true; // If no dates selected, show all
            
            const start = startDate ? new Date(startDate) : null;
            const end = endDate ? new Date(endDate) : null;
            
            if (start && end) {
              // Both dates selected - filter between them
              const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
              const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());
              return siteDateOnly >= startDateOnly && siteDateOnly <= endDateOnly;
            } else if (start) {
              // Only start date - show from start date onwards
              const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
              return siteDateOnly >= startDateOnly;
            } else if (end) {
              // Only end date - show up to end date
              const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());
              return siteDateOnly <= endDateOnly;
            }
            return true;
          
          default:
            return true;
        }
      });
    }

    setSiteStatuses(filtered);
  }, [applicationType, selectedCircles, selectedDivisions, selectedSubDivisions, searchTerm, timeRange, startDate, endDate, allSiteStatuses]);

  // Download functions
  function downloadCSV() {
    if (!siteStatuses.length) return;
    
    const dateColumnLabel = siteStatuses.some(site => site.presentStatus === 'Pending at Equipment Team') ? 'Pending from Date' : 'Date';
    const headers = [
      'SL NO',
      'Division',
      'Sub Division',
      'SITE CODE',
      'HRN',
      dateColumnLabel,
      'Present Status',
      'Remarks'
    ];
    
    const csvRows = [
      headers.join(','),
      ...siteStatuses.map((site, index) => {
        return [
          index + 1,
          `"${String(site.division || '').replace(/"/g, '""')}"`,
          `"${String(site.subDivision || '').replace(/"/g, '""')}"`,
          `"${String(site.siteCode || '').replace(/"/g, '""')}"`,
          `"${String(site.hrn || '').replace(/"/g, '""')}"`,
          `"${String(site.date || '').replace(/"/g, '""')}"`,
          `"${String(site.presentStatus || '').replace(/"/g, '""')}"`,
          `"${String(site.remarks || '').replace(/"/g, '""')}"`
        ].join(',');
      })
    ];
    
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `device-status-${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function downloadXLSX() {
    if (!siteStatuses.length) return;
    
    const dateColumnLabel = siteStatuses.some(site => site.presentStatus === 'Pending at Equipment Team') ? 'Pending from Date' : 'Date';
    const headers = [
      'SL NO',
      'Division',
      'Sub Division',
      'SITE CODE',
      'HRN',
      dateColumnLabel,
      'Present Status',
      'Remarks'
    ];
    
    const exportRows = siteStatuses.map((site, index) => [
      index + 1,
      site.division || '',
      site.subDivision || '',
      site.siteCode || '',
      site.hrn || '',
      site.date || '',
      site.presentStatus || '',
      site.remarks || ''
    ]);
    
    const ws = XLSX.utils.aoa_to_sheet([headers, ...exportRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Device Status');
    XLSX.writeFile(wb, `device-status-${new Date().getTime()}.xlsx`);
  }

  function downloadPDF() {
    if (!siteStatuses.length) return;
    
    const w = window.open('', '_blank');
    if (!w) return;

    const title = 'Device Status';
    const colPercent = (100 / 8).toFixed(2);
    
    // Get user information
    const currentUser = getCurrentUser();
    const userName = currentUser?.fullName || currentUser?.userId || 'Unknown User';
    const userRole = currentUser?.role || getCurrentUserRole() || 'Unknown Role';
    const userDesignation = currentUser?.designation || currentUser?.Designation || 'N/A';
    const userCircle = Array.isArray(currentUser?.circle) && currentUser.circle.length > 0 
      ? currentUser.circle.join(', ') 
      : 'N/A';
    
    const downloadTime = new Date().toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    const dateColumnLabel = siteStatuses.some(site => site.presentStatus === 'Pending at Equipment Team') ? 'Pending from Date' : 'Date';

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

    const headers = [
      'SL NO',
      'Division',
      'Sub Division',
      'SITE CODE',
      'HRN',
      dateColumnLabel,
      'Present Status',
      'Remarks'
    ];

    const thead = `<tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr>`;
    const tbody = siteStatuses.map((site, idx) => {
      const isEven = idx % 2 === 0;
      return `<tr style="background-color: ${isEven ? '#f0f9ff' : '#ffffff'}">
        <td>${idx + 1}</td>
        <td>${String(site.division || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
        <td>${String(site.subDivision || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
        <td>${String(site.siteCode || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
        <td>${String(site.hrn || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
        <td>${String(site.date || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
        <td>${String(site.presentStatus || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
        <td>${String(site.remarks || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
      </tr>`;
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
            <div class="meta">Date: ${downloadTime}</div>
            <div class="user-info">
              <strong>Downloaded by:</strong> ${userName} &nbsp;|&nbsp; 
              <strong>Role:</strong> ${userRole} &nbsp;|&nbsp; 
              <strong>Designation:</strong> ${userDesignation} &nbsp;|&nbsp; 
              <strong>Circle:</strong> ${userCircle}
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead>${thead}</thead>
              <tbody>${tbody}</tbody>
            </table>
          </div>
          <div class="footer">
            Generated on ${downloadTime} | ${userName} (${userRole}, ${userDesignation}, Circle: ${userCircle})
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
        <button
          onClick={() => navigate('/dashboard')}
          className="mt-4 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg shadow-lg p-3 text-white">
        <h2 className="text-xl font-bold">Device Status</h2>
        <p className="text-sm text-blue-100">Track site codes and their present status</p>
      </div>

      {/* Filters Section */}
      <div className="bg-white rounded-xl shadow-lg p-3">
        <h3 className="text-lg font-bold text-gray-800 mb-2">Filters</h3>
        
        <div className="flex flex-wrap items-end gap-4">
          {/* Application Type */}
          <div className="flex-shrink-0">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Application Type
            </label>
            <select
              value={applicationType}
              onChange={(e) => setApplicationType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="OFFLINE SITES">OFFLINE SITES</option>
              <option value="RTU TRACKER">RTU TRACKER</option>
            </select>
          </div>

          {/* Circle Dropdown */}
          <div className="flex-shrink-0">
            <MultiSelectDropdown
              label="Circle"
              options={circleOptions}
              selectedValues={selectedCircles}
              onChange={setSelectedCircles}
              loading={filtersLoading}
              placeholder="Select Circle"
            />
          </div>

          {/* Division Dropdown */}
          <div className="flex-shrink-0">
            <MultiSelectDropdown
              label="Division"
              options={divisionOptions}
              selectedValues={selectedDivisions}
              onChange={setSelectedDivisions}
              loading={filtersLoading}
              placeholder="Select Division"
            />
          </div>

          {/* Sub Division Dropdown */}
          <div className="flex-shrink-0">
            <MultiSelectDropdown
              label="Sub Division"
              options={subDivisionOptions}
              selectedValues={selectedSubDivisions}
              onChange={setSelectedSubDivisions}
              loading={filtersLoading}
              placeholder="Select Sub Division"
            />
          </div>

          {/* Time Range Dropdown */}
          <div className="flex-shrink-0">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Time Range
            </label>
            <select
              value={timeRange}
              onChange={(e) => {
                setTimeRange(e.target.value);
                // Reset date range when switching away from Date Range
                if (e.target.value !== 'Date Range') {
                  setStartDate('');
                  setEndDate('');
                }
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="All">All</option>
              <option value="This Day">This Day</option>
              <option value="This Week">This Week</option>
              <option value="This Month">This Month</option>
              <option value="Date Range">Date Range</option>
            </select>
          </div>

          {/* Date Range Pickers - Show when "Date Range" is selected */}
          {timeRange === 'Date Range' && (
            <>
              <div className="flex-shrink-0">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="flex-shrink-0">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate || undefined}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </>
          )}
        </div>

        {/* Search Box */}
        <div className="mt-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Search
          </label>
          <input
            type="text"
            placeholder="Search by Division, Sub Division, HRN, Present Status, or Remarks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-2 border-b border-blue-800">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-white">Device Status Data</h3>
              <p className="text-xs text-blue-100">
                {siteStatuses.length > 0 ? `${siteStatuses.length} record(s) found` : 'No records to display'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-white font-medium">Download:</label>
              <select
                className="border border-gray-300 rounded px-3 py-1.5 min-w-[140px] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                defaultValue=""
                onChange={(e) => { handleDownloadSelect(e.target.value); e.currentTarget.value = ''; }}
                disabled={!siteStatuses.length}
              >
                <option value="" disabled>Select format</option>
                <option value="pdf">PDF</option>
                <option value="xlsx">Excel (XLSX)</option>
                <option value="csv">CSV</option>
              </select>
            </div>
          </div>
        </div>

        {siteStatuses.length === 0 ? (
          <div className="p-12 text-center bg-white">
            <p className="text-gray-500">No sites found matching the selected filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
            <table className="min-w-full bg-white border-collapse border border-gray-300">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border border-gray-300">
                    SL NO
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border border-gray-300">
                    Division
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border border-gray-300">
                    Sub Division
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border border-gray-300">
                    SITE CODE
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border border-gray-300">
                    HRN
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border border-gray-300">
                    {siteStatuses.some(site => site.presentStatus === 'Pending at Equipment Team') ? 'Pending from Date' : 'Date'}
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border border-gray-300">
                    Present Status
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border border-gray-300">
                    Remarks
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {siteStatuses.map((site, index) => {
                  const isWaitingForApproval = site.presentStatus.includes('Waiting for CCR') || site.presentStatus.includes('Waiting for CCR approval');
                  const isApproved = site.presentStatus.includes('Resolved and Approved');
                  
                  return (
                    <tr key={site.siteCode} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border border-gray-300 text-center">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border border-gray-300 text-center">
                        {site.division || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border border-gray-300 text-center">
                        {site.subDivision || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border border-gray-300 text-center">
                        {site.siteCode}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border border-gray-300 text-center">
                        {site.hrn || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border border-gray-300 text-center">
                        <div className="flex flex-col">
                          <span className="text-xs text-gray-500">{site.dateLabel || 'Date'}</span>
                          <span className="font-medium">{site.date || '-'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm border border-gray-300 text-center">
                        <span 
                          className={`px-2 py-1 rounded ${
                            isApproved 
                              ? 'bg-green-100 text-green-800' 
                              : isWaitingForApproval
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {site.presentStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 border border-gray-300 text-center" style={{ whiteSpace: 'pre-wrap', maxWidth: '300px' }}>
                        {site.remarks || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="text-sm text-gray-600">
        Total Sites: {siteStatuses.length} / {allSiteStatuses.length}
      </div>
    </div>
  );
}

