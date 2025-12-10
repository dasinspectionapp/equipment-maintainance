import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { API_BASE } from '../utils/api';

// Normalize function for case-insensitive matching
const normalize = (str: string): string => {
  return String(str || '').trim().toLowerCase().replace(/[_\s-]/g, '');
};

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

interface RTUTrackerRow {
  slNo: number;
  division: string;
  subDivision: string;
  ccrObservation: string;
  typeOfIssue: string;
  dateOfInspection: string;
  fieldTeamActionObservation: string;
  ccrStatus: string;
  ccrRemarks: string;
  siteCode: string;
}

export default function RTUTrackerStatus() {
  const [selectedCircles, setSelectedCircles] = useState<string[]>([]);
  const [selectedDivisions, setSelectedDivisions] = useState<string[]>([]);
  const [selectedSubDivisions, setSelectedSubDivisions] = useState<string[]>([]);
  const [timeRange, setTimeRange] = useState<string>('All');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filtersLoading, setFiltersLoading] = useState(false);
  const [circleOptions, setCircleOptions] = useState<string[]>([]);
  const [divisionOptions, setDivisionOptions] = useState<string[]>([]);
  const [subDivisionOptions, setSubDivisionOptions] = useState<string[]>([]);
  const [tableData, setTableData] = useState<RTUTrackerRow[]>([]);
  const [allTableData, setAllTableData] = useState<RTUTrackerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // MultiSelectDropdown Component
  const MultiSelectDropdown = ({ label, options, selectedValues, onChange, loading, placeholder = 'Select options' }: MultiSelectDropdownProps) => {
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
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400 transition-colors flex items-center justify-between"
        >
          <span className={isAllSelected ? 'text-gray-400' : 'text-gray-900'}>
            {loading ? 'Loading...' : isAllSelected ? `${placeholder} (All)` : `${selectedValues.length} selected`}
          </span>
          <div className="flex items-center gap-2">
            {!isAllSelected && (
              <button
                type="button"
                onClick={handleClearAll}
                className="text-gray-400 hover:text-red-500 transition-colors"
                title="Clear All"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'transform rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
            {loading ? (
              <div className="px-4 py-3 text-sm text-gray-500 text-center">Loading...</div>
            ) : options.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500 text-center">No options available</div>
            ) : (
              <>
                <label
                  className={`flex items-center px-4 py-2.5 cursor-pointer hover:bg-blue-50 transition-colors border-b border-gray-200 ${
                    isAllSelected ? 'bg-blue-50 font-medium' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={() => handleToggle(ALL_OPTION)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                  />
                  <span className={`ml-3 text-sm ${isAllSelected ? 'text-blue-700' : 'text-gray-900'}`}>
                    {ALL_OPTION}
                  </span>
                </label>
                {options.map((option) => {
                  const isSelected = selectedValues.includes(option);
                  return (
                    <label
                      key={option}
                      className={`flex items-center px-4 py-2.5 cursor-pointer hover:bg-blue-50 transition-colors ${
                        isSelected ? 'bg-blue-50' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggle(option)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                      />
                      <span className="ml-3 text-sm text-gray-900">{option}</span>
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

  // Check if user is CCR role
  useEffect(() => {
    const userRole = getCurrentUserRole();
    if (userRole !== 'CCR') {
      // Access denied - could show error message
    }
  }, []);

  // Fetch filter options
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        setFiltersLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
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

  // Fetch RTU Tracker data (similar to View Data - merge Device Status Upload + RTU Tracker)
  useEffect(() => {
    const fetchRTUTrackerData = async () => {
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

        // Fetch all uploads
        const uploadsRes = await fetch(`${API_BASE}/api/uploads`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const uploadsJson = await uploadsRes.json();

        if (!uploadsJson?.success) {
          setError('Failed to fetch uploads');
          return;
        }

        // Find Device Status Upload file (main file - same as View Data)
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
          setAllTableData([]);
          return;
        }

        // Fetch Device Status Upload file data
        const fileRes = await fetch(`${API_BASE}/api/uploads/${deviceStatusFile.fileId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const fileJson = await fileRes.json();

        if (!fileJson?.success || !fileJson.file) {
          setError('Failed to fetch file data');
          return;
        }

        const deviceStatusData = fileJson.file;
        let fileRows = Array.isArray(deviceStatusData.rows) ? deviceStatusData.rows : [];
        let hdrs = deviceStatusData.headers && deviceStatusData.headers.length 
          ? deviceStatusData.headers 
          : (fileRows[0] ? Object.keys(fileRows[0]) : []);

        // Find main SITE CODE header
        const mainSiteCodeHeader = hdrs.find((h: string) => {
          const n = normalize(h);
          return n === 'sitecode' || n === 'site_code' || n === 'site code';
        });

        if (!mainSiteCodeHeader) {
          setError('Site Code column not found');
          return;
        }

        // Find DIVISION and SUBDIVISION headers
        const divisionHeader = hdrs.find((h: string) => {
          const n = normalize(h);
          return n === 'division';
        });

        const subDivisionHeader = hdrs.find((h: string) => {
          const n = normalize(h);
          return n === 'subdivision' || n === 'sub division' || n === 'sub_division';
        });

        // Find PRODUCTION OBSERVATIONS column for filtering
        // Search in initial headers first
        let productionObsKey = hdrs.find((h: string) => {
          const n = normalize(h);
          return (n.includes('production') && n.includes('observation')) ||
                 n === 'productionobservations' || n === 'production_observations' ||
                 n === 'production observations';
        });
        
        console.log('RTU Tracker Status - PRODUCTION OBSERVATIONS column (initial search):', productionObsKey);
        console.log('RTU Tracker Status - Initial headers:', hdrs);

        // Variable to store merged RTU Tracker columns (needed for later search)
        let rtuTrackerColumnsToInsert: string[] = [];
        // Variable to store RTU TRACKER OBSERVATION column name from RTU Tracker file
        let rtuTrackerObservationHeaderName: string | undefined = undefined;

        // Parse date from column name helper
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

        // Merge RTU Tracker file data (similar to View Data)
        try {
          const rtuTrackerFile = (uploadsJson.files || [])
            .filter((f: any) => {
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
            })
            .sort((a: any, b: any) => {
              const dateA = a.uploadedAt ? new Date(a.uploadedAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
              const dateB = b.uploadedAt ? new Date(b.uploadedAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
              return dateB - dateA;
            })[0];

          if (rtuTrackerFile) {
            const rtuTrackerDataRes = await fetch(`${API_BASE}/api/uploads/${rtuTrackerFile.fileId}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            const rtuTrackerDataJson = await rtuTrackerDataRes.json();

            if (rtuTrackerDataJson?.success && rtuTrackerDataJson.file) {
              const rtuTrackerData = rtuTrackerDataJson.file;
              const rtuTrackerRows = Array.isArray(rtuTrackerData.rows) ? rtuTrackerData.rows : [];
              const rtuTrackerHeaders = rtuTrackerData.headers && rtuTrackerData.headers.length 
                ? rtuTrackerData.headers 
                : (rtuTrackerRows[0] ? Object.keys(rtuTrackerRows[0]) : []);

              const rtuTrackerSiteCodeHeader = rtuTrackerHeaders.find((h: string) => {
                const normalized = normalize(h);
                return normalized === 'site code' || normalized === 'sitecode' || normalized === 'site_code';
              });

              // Find RTU TRACKER OBSERVATION column name in RTU Tracker file (exact name)
              rtuTrackerObservationHeaderName = rtuTrackerHeaders.find((h: string) => {
                const norm = normalize(h);
                return (norm.includes('rtu') && norm.includes('tracker') && (norm.includes('observation') || norm.includes('observbation'))) ||
                       norm === 'rtutrackerobservation' || norm === 'rtu_tracker_observation' ||
                       norm === 'rtu tracker observation' || norm === 'rtutrackerobservbation' ||
                       norm === 'rtu_tracker_observbation' || norm === 'rtu tracker observbation';
              });
              console.log('RTU Tracker Status - RTU TRACKER OBSERVATION header name in RTU Tracker file:', rtuTrackerObservationHeaderName);
              console.log('RTU Tracker Status - All RTU Tracker headers:', rtuTrackerHeaders);

              // Find latest date column in RTU Tracker
              const rtuTrackerDateColumns: Array<{ name: string; date: Date; index: number }> = [];
              rtuTrackerHeaders.forEach((h: string, index: number) => {
                const normalized = normalize(h);
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

              // Get ALL columns after latest date column (like View Data does)
              rtuTrackerColumnsToInsert = [];
              let startIndex = -1;
              if (latestRtuTrackerDateColumnIndex !== -1 && latestRtuTrackerDateColumnIndex + 1 < rtuTrackerHeaders.length) {
                startIndex = latestRtuTrackerDateColumnIndex + 1;
              } else if (rtuTrackerSiteCodeHeader) {
                const siteCodeIndex = rtuTrackerHeaders.indexOf(rtuTrackerSiteCodeHeader);
                if (siteCodeIndex !== -1 && siteCodeIndex + 1 < rtuTrackerHeaders.length) {
                  startIndex = siteCodeIndex + 1;
                }
              }

              console.log('RTU Tracker Status - RTU Tracker headers:', rtuTrackerHeaders);
              console.log('RTU Tracker Status - Latest date column index:', latestRtuTrackerDateColumnIndex);
              console.log('RTU Tracker Status - Start index for columns:', startIndex);
              
              if (startIndex !== -1 && startIndex < rtuTrackerHeaders.length) {
                for (let i = startIndex; i < rtuTrackerHeaders.length; i++) {
                  const header = rtuTrackerHeaders[i];
                  const normalizedHeader = normalize(header);
                  
                  // Skip SITE CODE column
                  if (normalizedHeader === 'site code' || normalizedHeader === 'sitecode' || normalizedHeader === 'site_code') {
                    console.log(`RTU Tracker Status - Skipping SITE CODE column: "${header}"`);
                    continue;
                  }
                  
                  // Skip date columns
                  const isDateColumn = normalizedHeader.includes('date') || normalizedHeader.includes('time');
                  if (isDateColumn) {
                    console.log(`RTU Tracker Status - Skipping date column: "${header}"`);
                    continue;
                  }
                  
                  console.log(`RTU Tracker Status - Adding RTU Tracker column: "${header}"`);
                  rtuTrackerColumnsToInsert.push(header);
                }
              } else {
                console.warn('RTU Tracker Status - Cannot determine start index for RTU Tracker columns');
                console.warn('RTU Tracker Status - Latest date column index:', latestRtuTrackerDateColumnIndex);
                console.warn('RTU Tracker Status - RTU Tracker headers length:', rtuTrackerHeaders.length);
              }

              // Merge RTU Tracker data into main file rows (merge ALL columns, not just observation)
              if (rtuTrackerSiteCodeHeader && rtuTrackerColumnsToInsert.length > 0) {
                const rtuTrackerMap = new Map<string, any>();
                
                // Filter RTU Tracker rows by latest date column if available
                let filteredRtuTrackerRows = [...rtuTrackerRows];
                if (latestRtuTrackerDateColumn) {
                  filteredRtuTrackerRows = rtuTrackerRows.filter((row: any) => {
                    const dateValue = row[latestRtuTrackerDateColumn!];
                    return dateValue !== null && dateValue !== undefined && String(dateValue).trim() !== '';
                  });
                }

                filteredRtuTrackerRows.forEach((row: any) => {
                  const siteCode = String(row[rtuTrackerSiteCodeHeader] || '').trim().toUpperCase();
                  if (siteCode) {
                    if (rtuTrackerMap.has(siteCode)) {
                      const existingRow = rtuTrackerMap.get(siteCode);
                      const existingHasDate = latestRtuTrackerDateColumn && existingRow[latestRtuTrackerDateColumn!] && 
                                             String(existingRow[latestRtuTrackerDateColumn!]).trim() !== '';
                      const currentHasDate = latestRtuTrackerDateColumn && row[latestRtuTrackerDateColumn!] && 
                                           String(row[latestRtuTrackerDateColumn!]).trim() !== '';
                      if (currentHasDate && !existingHasDate) {
                        rtuTrackerMap.set(siteCode, row);
                      }
                    } else {
                      rtuTrackerMap.set(siteCode, row);
                    }
                  }
                });

                // Merge ALL RTU Tracker columns into main rows
                fileRows = fileRows.map((row: any) => {
                  const siteCode = String(row[mainSiteCodeHeader] || '').trim().toUpperCase();
                  const rtuTrackerRow = rtuTrackerMap.get(siteCode);
                  const mergedRow = { ...row };
                  
                  rtuTrackerColumnsToInsert.forEach((col: string) => {
                    if (rtuTrackerRow) {
                      mergedRow[col] = rtuTrackerRow[col] ?? '';
                    } else {
                      mergedRow[col] = '';
                    }
                  });
                  
                  return mergedRow;
                });

                // Add RTU Tracker columns to headers if not present
                const siteCodeIndex = hdrs.indexOf(mainSiteCodeHeader);
                if (siteCodeIndex !== -1) {
                  const rtuTrackerColumnsToAdd = rtuTrackerColumnsToInsert.filter(col => !hdrs.includes(col));
                  if (rtuTrackerColumnsToAdd.length > 0) {
                    hdrs = [
                      ...hdrs.slice(0, siteCodeIndex),
                      ...rtuTrackerColumnsToAdd,
                      ...hdrs.slice(siteCodeIndex)
                    ];
                  }
                } else {
                  rtuTrackerColumnsToInsert.forEach(col => {
                    if (!hdrs.includes(col)) {
                      hdrs.push(col);
                    }
                  });
                }

                console.log('RTU Tracker Status - Merged RTU Tracker columns:', rtuTrackerColumnsToInsert);
                console.log('RTU Tracker Status - Merged RTU Tracker column names:', rtuTrackerColumnsToInsert.map((c, i) => `${i}: "${c}"`));
              }
            }
          }
        } catch (error) {
          console.error('Error merging RTU Tracker data:', error);
          // Continue even if merge fails
        }

        // Re-search for PRODUCTION OBSERVATIONS column after merge (in case it was added during merge)
        if (!productionObsKey) {
          productionObsKey = hdrs.find((h: string) => {
            const n = normalize(h);
            return (n.includes('production') && n.includes('observation')) ||
                   n === 'productionobservations' || n === 'production_observations' ||
                   n === 'production observations';
          });
          console.log('RTU Tracker Status - PRODUCTION OBSERVATIONS column (after merge search):', productionObsKey);
        }

        // Also try searching in row keys if still not found
        if (!productionObsKey && fileRows.length > 0) {
          const firstRow = fileRows[0];
          productionObsKey = Object.keys(firstRow).find((key: string) => {
            const n = normalize(key);
            return (n.includes('production') && n.includes('observation')) ||
                   n === 'productionobservations' || n === 'production_observations' ||
                   n === 'production observations';
          });
          console.log('RTU Tracker Status - PRODUCTION OBSERVATIONS column (in row keys):', productionObsKey);
        }

        // Filter by PRODUCTION OBSERVATIONS = YES (case insensitive)
        if (productionObsKey) {
          const beforeCount = fileRows.length;
          fileRows = fileRows.filter((row: any) => {
            const prodObsValue = String(row[productionObsKey!] || '').trim();
            const normalizedValue = normalize(prodObsValue);
            const matches = normalizedValue === 'yes';
            
            // Debug first few rows
            if (beforeCount - fileRows.length < 5) {
              console.log(`RTU Tracker Status - Row PRODUCTION OBSERVATIONS value: "${prodObsValue}" (normalized: "${normalizedValue}") -> ${matches ? 'MATCH' : 'NO MATCH'}`);
            }
            
            return matches;
          });
          console.log(`RTU Tracker Status - PRODUCTION OBSERVATIONS filter: ${beforeCount} rows -> ${fileRows.length} rows (filtering for = YES)`);
        } else {
          console.warn('RTU Tracker Status - PRODUCTION OBSERVATIONS column not found');
          console.warn('RTU Tracker Status - Available headers:', hdrs);
          if (fileRows.length > 0) {
            console.warn('RTU Tracker Status - First row keys:', Object.keys(fileRows[0]));
          }
        }

        // Find RTU TRACKER OBSERVATION column in merged data
        // IMPORTANT: Must exclude PRODUCTION OBSERVATIONS column
        let rtuTrackerObservationKey: string | undefined = undefined;
        
        // Helper function to check if column is RTU TRACKER OBSERVATION (not PRODUCTION OBSERVATIONS)
        const isRTUTrackerObservation = (colName: string): boolean => {
          const norm = normalize(colName);
          // Must include 'rtu' AND 'tracker' AND ('observation' OR 'observbation')
          // Must NOT include 'production'
          const hasRTU = norm.includes('rtu');
          const hasTracker = norm.includes('tracker');
          const hasObservation = norm.includes('observation') || norm.includes('observbation');
          const hasProduction = norm.includes('production');
          
          return hasRTU && hasTracker && hasObservation && !hasProduction;
        };
        
        // Search in merged RTU Tracker columns first (most reliable)
        if (rtuTrackerColumnsToInsert && rtuTrackerColumnsToInsert.length > 0) {
          // First try exact match
          if (rtuTrackerObservationHeaderName && rtuTrackerColumnsToInsert.includes(rtuTrackerObservationHeaderName)) {
            rtuTrackerObservationKey = rtuTrackerObservationHeaderName;
            console.log('RTU Tracker Status - Found exact match in merged columns:', rtuTrackerObservationKey);
          } else {
            // Pattern matching - must exclude PRODUCTION OBSERVATIONS
            rtuTrackerObservationKey = rtuTrackerColumnsToInsert.find((col: string) => {
              return isRTUTrackerObservation(col);
            });
            console.log('RTU Tracker Status - Found via pattern match in merged columns:', rtuTrackerObservationKey);
          }
        }

        // If not found in merged columns, search in headers (excluding PRODUCTION OBSERVATIONS)
        if (!rtuTrackerObservationKey) {
          rtuTrackerObservationKey = hdrs.find((h: string) => {
            return isRTUTrackerObservation(h);
          });
          console.log('RTU Tracker Status - Found in headers:', rtuTrackerObservationKey);
        }

        // If still not found, try to find it in the first row (case-insensitive search)
        if (!rtuTrackerObservationKey && fileRows.length > 0) {
          const firstRow = fileRows[0];
          rtuTrackerObservationKey = Object.keys(firstRow).find((key: string) => {
            return isRTUTrackerObservation(key);
          }) || undefined;
          console.log('RTU Tracker Status - Found in first row keys:', rtuTrackerObservationKey);
        }

        // Final fallback: If we merged RTU Tracker columns but couldn't find observation column,
        // use the first merged column that is NOT PRODUCTION OBSERVATIONS
        if (!rtuTrackerObservationKey && rtuTrackerColumnsToInsert && rtuTrackerColumnsToInsert.length > 0) {
          // Find first column that is NOT PRODUCTION OBSERVATIONS
          rtuTrackerObservationKey = rtuTrackerColumnsToInsert.find((col: string) => {
            const norm = normalize(col);
            return !norm.includes('production');
          });
          
          if (rtuTrackerObservationKey) {
            console.warn('RTU Tracker Status - RTU TRACKER OBSERVATION not found by name, using first non-PRODUCTION column as fallback');
            console.log('RTU Tracker Status - Using fallback column:', rtuTrackerObservationKey);
          }
        }

        console.log('RTU Tracker Status - Final RTU TRACKER OBSERVATION column:', rtuTrackerObservationKey);
        console.log('RTU Tracker Status - All headers after merge (expanded):', JSON.stringify(hdrs, null, 2));
        if (fileRows.length > 0) {
          console.log('RTU Tracker Status - First row keys (expanded):', JSON.stringify(Object.keys(fileRows[0]), null, 2));
          console.log('RTU Tracker Status - First row sample (expanded):', JSON.stringify(fileRows[0], null, 2));
          
          // Also log all keys that contain "rtu", "tracker", or "observation"
          const observationKeys = Object.keys(fileRows[0]).filter(key => {
            const norm = normalize(key);
            return norm.includes('rtu') || norm.includes('tracker') || norm.includes('observation') || norm.includes('observbation');
          });
          console.log('RTU Tracker Status - Keys containing RTU/TRACKER/OBSERVATION:', observationKeys);
        }

        // Find latest date column for DATE OF INSPECTION
        const dateColumns: Array<{ name: string; date: Date; index: number }> = [];
        hdrs.forEach((header: string, index: number) => {
          const normalized = normalize(header);
          if (normalized.includes('date') || normalized.includes('time')) {
            const date = parseDateFromColumnName(header);
            if (date && !isNaN(date.getTime())) {
              dateColumns.push({ name: header, date, index });
            }
          }
        });
        dateColumns.sort((a, b) => b.date.getTime() - a.date.getTime());
        const latestDateColumn = dateColumns.length > 0 ? dateColumns[0].name : null;

        // Fetch RTU Tracker Approval data for TYPE OF ISSUE, DATE OF INSPECTION, FIELD TEAM ACTION/OBSERVATION, CCR STATUS, CCR REMARKS
        const rtuTrackerApprovalsRes = await fetch(`${API_BASE}/api/rtu-tracker-approvals`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const rtuTrackerApprovalsJson = await rtuTrackerApprovalsRes.json();
        const rtuTrackerApprovalsMap: Record<string, any> = {};
        
        if (rtuTrackerApprovalsJson?.success && Array.isArray(rtuTrackerApprovalsJson.data)) {
          rtuTrackerApprovalsJson.data.forEach((approval: any) => {
            const code = String(approval.siteCode || '').trim().toUpperCase();
            if (code) {
              // Use the latest approval for each site code (if multiple exist)
              if (!rtuTrackerApprovalsMap[code] || 
                  (approval.updatedAt && rtuTrackerApprovalsMap[code].updatedAt && 
                   new Date(approval.updatedAt) > new Date(rtuTrackerApprovalsMap[code].updatedAt))) {
                rtuTrackerApprovalsMap[code] = approval;
              }
            }
          });
        }

        // Also fetch EquipmentOfflineSites data for other fields (if needed)
        const offlineSitesRes = await fetch(`${API_BASE}/api/equipment-offline-sites?includeApproved=true`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const offlineSitesJson = await offlineSitesRes.json();
        const offlineSites = Array.isArray(offlineSitesJson?.data) ? offlineSitesJson.data : [];

        // Create a map of site codes from offline sites
        const offlineSitesMap: Record<string, any> = {};
        offlineSites.forEach((site: any) => {
          const code = String(site.siteCode || '').trim().toUpperCase();
          if (code) {
            if (!offlineSitesMap[code] || 
                (site.updatedAt && offlineSitesMap[code].updatedAt && 
                 new Date(site.updatedAt) > new Date(offlineSitesMap[code].updatedAt))) {
              offlineSitesMap[code] = site;
            }
          }
        });

        // Build table rows
        const rows: RTUTrackerRow[] = fileRows.map((row: any, index: number) => {
          const siteCode = mainSiteCodeHeader ? String(row[mainSiteCodeHeader] || '').trim().toUpperCase() : '';
          const rtuTrackerApproval = rtuTrackerApprovalsMap[siteCode] || {};

          const division = divisionHeader ? String(row[divisionHeader] || '').trim() : '';
          const subDivision = subDivisionHeader ? String(row[subDivisionHeader] || '').trim() : '';
          
          // RTU TRACKER OBSERVATION (maps to CCR OBSERVATION)
          // Try exact key first, then case-insensitive search
          let ccrObservation = '';
          if (rtuTrackerObservationKey) {
            ccrObservation = String(row[rtuTrackerObservationKey] || '').trim();
          } else {
            // Fallback: search in row keys case-insensitively
            const observationKey = Object.keys(row).find((key: string) => {
              const norm = normalize(key);
              return (norm.includes('rtu') && norm.includes('tracker') && (norm.includes('observation') || norm.includes('observbation')));
            });
            if (observationKey) {
              ccrObservation = String(row[observationKey] || '').trim();
              // Log first few matches for debugging
              if (index < 3) {
                console.log(`RTU Tracker Status - Found RTU TRACKER OBSERVATION via fallback for row ${index}:`, {
                  key: observationKey,
                  value: ccrObservation,
                  siteCode
                });
              }
            }
          }
          
          // Debug first few rows
          if (index < 3) {
            console.log(`RTU Tracker Status - Row ${index} (Site Code: ${siteCode}):`, {
              rtuTrackerObservationKey,
              ccrObservation,
              hasValue: ccrObservation !== '',
              allRowKeys: Object.keys(row),
              rtuTrackerApproval: rtuTrackerApproval
            });
          }

          // DATE OF INSPECTION - from RTU Tracker Approval (case insensitive site code matching)
          // Format: DD-MM-YYYY
          let dateOfInspection = '-';
          if (rtuTrackerApproval?.dateOfInspection) {
            const dateStr = rtuTrackerApproval.dateOfInspection;
            // If already in YYYY-MM-DD format, convert to DD-MM-YYYY
            if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
              const [year, month, day] = dateStr.split('-');
              dateOfInspection = `${day}-${month}-${year}`;
            } else if (dateStr.match(/^\d{2}-\d{2}-\d{4}$/)) {
              // Already in DD-MM-YYYY format
              dateOfInspection = dateStr;
            } else {
              // Try to parse as date and format
              const date = new Date(dateStr);
              if (!isNaN(date.getTime())) {
                dateOfInspection = formatDate(date);
              }
            }
          } else if (latestDateColumn && row[latestDateColumn]) {
            dateOfInspection = formatDate(new Date(row[latestDateColumn]));
          }

          // TYPE OF ISSUE - from RTU Tracker Approval (case insensitive site code matching)
          const typeOfIssue = rtuTrackerApproval?.typeOfIssue || '-';

          // FIELD TEAM ACTION/OBSERVATION - from RTU Tracker Approval fieldTeamAction (case insensitive site code matching)
          const fieldTeamActionObservation = rtuTrackerApproval?.fieldTeamAction || '-';

          // CCR STATUS - from RTU Tracker Approval ccrStatus (case insensitive site code matching)
          // Default to "Unattended" if no approval data exists, otherwise use the status from approval
          const ccrStatus = rtuTrackerApproval?.ccrStatus 
            ? rtuTrackerApproval.ccrStatus 
            : 'Unattended';

          // CCR REMARKS - from RTU Tracker Approval ccrRemarks (case insensitive site code matching)
          const ccrRemarks = rtuTrackerApproval?.ccrRemarks || '-';

          return {
            slNo: index + 1,
            division,
            subDivision,
            ccrObservation,
            typeOfIssue,
            dateOfInspection,
            fieldTeamActionObservation,
            ccrStatus,
            ccrRemarks,
            siteCode
          };
        });

        setAllTableData(rows);
      } catch (err: any) {
        console.error('Error fetching RTU Tracker data:', err);
        setError(err.message || 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchRTUTrackerData();
  }, []);

  // Apply filters
  useEffect(() => {
    let filtered = [...allTableData];

    // Filter by Circle (if circle data is available in rows)
    // Note: Circle might not be in RTU Tracker file, so this might need adjustment

    // Filter by Division
    if (selectedDivisions.length > 0) {
      filtered = filtered.filter(row => 
        row.division && selectedDivisions.some(division => 
          normalize(row.division) === normalize(division)
        )
      );
    }

    // Filter by Sub Division
    if (selectedSubDivisions.length > 0) {
      filtered = filtered.filter(row => 
        row.subDivision && selectedSubDivisions.some(subDiv => 
          normalize(row.subDivision) === normalize(subDiv)
        )
      );
    }

    // Filter by search term
    if (searchTerm.trim() !== '') {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(row =>
        row.division.toLowerCase().includes(searchLower) ||
        row.subDivision.toLowerCase().includes(searchLower) ||
        row.ccrObservation.toLowerCase().includes(searchLower) ||
        row.typeOfIssue.toLowerCase().includes(searchLower) ||
        row.fieldTeamActionObservation.toLowerCase().includes(searchLower) ||
        row.ccrStatus.toLowerCase().includes(searchLower) ||
        row.ccrRemarks.toLowerCase().includes(searchLower) ||
        row.siteCode.toLowerCase().includes(searchLower)
      );
    }

    // Filter by Time Range - filters based on Date of Inspection column
    if (timeRange && timeRange !== 'All') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      filtered = filtered.filter(row => {
        // Filter based on Date of Inspection column
        if (!row.dateOfInspection || row.dateOfInspection === '-') return false;
        
        // Parse the date from DD-MM-YYYY format (Date of Inspection format)
        const dateStr = row.dateOfInspection.trim();
        
        // Try DD-MM-YYYY format first
        let dateMatch = dateStr.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
        let day, month, year;
        
        if (dateMatch) {
          // DD-MM-YYYY format
          day = parseInt(dateMatch[1], 10);
          month = parseInt(dateMatch[2], 10) - 1; // Month is 0-indexed
          year = parseInt(dateMatch[3], 10);
        } else {
          // Try YYYY-MM-DD format (fallback)
          dateMatch = dateStr.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
          if (dateMatch) {
            year = parseInt(dateMatch[1], 10);
            month = parseInt(dateMatch[2], 10) - 1; // Month is 0-indexed
            day = parseInt(dateMatch[3], 10);
          } else {
            return false; // Invalid date format
          }
        }
        
        const siteDate = new Date(year, month, day);
        
        if (isNaN(siteDate.getTime())) return false;
        
        const siteDateOnly = new Date(siteDate.getFullYear(), siteDate.getMonth(), siteDate.getDate());
        
        switch (timeRange) {
          case 'This Day':
            return siteDateOnly.getTime() === today.getTime();
          
          case 'This Week':
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - today.getDay());
            return siteDateOnly >= weekStart && siteDateOnly <= today;
          
          case 'This Month':
            return siteDateOnly.getMonth() === today.getMonth() && 
                   siteDateOnly.getFullYear() === today.getFullYear();
          
          case 'Date Range':
            if (!startDate && !endDate) return true;
            
            const start = startDate ? new Date(startDate) : null;
            const end = endDate ? new Date(endDate) : null;
            
            if (start && end) {
              const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
              const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());
              return siteDateOnly >= startDateOnly && siteDateOnly <= endDateOnly;
            } else if (start) {
              const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
              return siteDateOnly >= startDateOnly;
            } else if (end) {
              const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());
              return siteDateOnly <= endDateOnly;
            }
            return true;
          
          default:
            return true;
        }
      });
    }

    // Update SLNO after filtering
    filtered = filtered.map((row, index) => ({
      ...row,
      slNo: index + 1
    }));

    setTableData(filtered);
  }, [selectedCircles, selectedDivisions, selectedSubDivisions, searchTerm, timeRange, startDate, endDate, allTableData]);

  // Download functions
  function downloadCSV() {
    if (!tableData.length) return;
    
    const headers = [
      'SLNO',
      'DIVISION',
      'SUBDIVISION',
      'SITE CODE',
      'CCR OBSERVATION',
      'TYPE OF ISSUE',
      'DATE OF INSPECTION',
      'FIELD TEAM ACTION/OBSERVATION',
      'CCR STATUS',
      'CCR REMARKS'
    ];
    
    const csvRows = [
      headers.join(','),
      ...tableData.map(row => {
        return [
          row.slNo,
          `"${String(row.division || '').replace(/"/g, '""')}"`,
          `"${String(row.subDivision || '').replace(/"/g, '""')}"`,
          `"${String(row.siteCode || '').replace(/"/g, '""')}"`,
          `"${String(row.ccrObservation || '').replace(/"/g, '""')}"`,
          `"${String(row.typeOfIssue || '').replace(/"/g, '""')}"`,
          `"${String(row.dateOfInspection || '').replace(/"/g, '""')}"`,
          `"${String(row.fieldTeamActionObservation || '').replace(/"/g, '""')}"`,
          `"${String(row.ccrStatus || '').replace(/"/g, '""')}"`,
          `"${String(row.ccrRemarks || '').replace(/"/g, '""')}"`
        ].join(',');
      })
    ];
    
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `rtu-tracker-status-${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function downloadXLSX() {
    if (!tableData.length) return;
    
    const headers = [
      'SLNO',
      'DIVISION',
      'SUBDIVISION',
      'SITE CODE',
      'CCR OBSERVATION',
      'TYPE OF ISSUE',
      'DATE OF INSPECTION',
      'FIELD TEAM ACTION/OBSERVATION',
      'CCR STATUS',
      'CCR REMARKS'
    ];
    
    const exportRows = tableData.map(row => [
      row.slNo,
      row.division || '',
      row.subDivision || '',
      row.siteCode || '',
      row.ccrObservation || '',
      row.typeOfIssue || '',
      row.dateOfInspection || '',
      row.fieldTeamActionObservation || '',
      row.ccrStatus || '',
      row.ccrRemarks || ''
    ]);
    
    const ws = XLSX.utils.aoa_to_sheet([headers, ...exportRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'RTU Tracker Status');
    XLSX.writeFile(wb, `rtu-tracker-status-${new Date().getTime()}.xlsx`);
  }

  function downloadPDF() {
    if (!tableData.length) return;
    
    const w = window.open('', '_blank');
    if (!w) return;

    const title = 'RTU Tracker Status';
    const colPercent = (100 / 10).toFixed(2);
    
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
      'SLNO',
      'DIVISION',
      'SUBDIVISION',
      'SITE CODE',
      'CCR OBSERVATION',
      'TYPE OF ISSUE',
      'DATE OF INSPECTION',
      'FIELD TEAM ACTION/OBSERVATION',
      'CCR STATUS',
      'CCR REMARKS'
    ];

    const thead = `<tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr>`;
    const tbody = tableData.map((row, idx) => {
      const isEven = idx % 2 === 0;
      return `<tr style="background-color: ${isEven ? '#f0f9ff' : '#ffffff'}">
        <td>${row.slNo}</td>
        <td>${String(row.division || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
        <td>${String(row.subDivision || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
        <td>${String(row.siteCode || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
        <td>${String(row.ccrObservation || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
        <td>${String(row.typeOfIssue || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
        <td>${String(row.dateOfInspection || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
        <td>${String(row.fieldTeamActionObservation || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
        <td>${String(row.ccrStatus || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
        <td>${String(row.ccrRemarks || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
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
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg shadow-lg px-4 py-2 text-white">
        <h2 className="text-lg font-bold">RTU Tracker Status</h2>
        <p className="text-xs text-blue-100">Track site codes and their present status</p>
      </div>

      {/* Filters Section */}
      <div className="bg-white rounded-xl shadow-lg p-3">
        <h3 className="text-base font-bold text-gray-800 mb-2">Filters</h3>
        
        <div className="flex flex-wrap items-end gap-4">
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
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-1.5 border-b border-blue-800">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-white">RTU Tracker Status Data</h3>
              <p className="text-xs text-blue-100">
                {tableData.length > 0 ? `${tableData.length} record(s) found` : 'No records to display'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-white font-medium">Download:</label>
              <select
                className="border border-gray-300 rounded px-3 py-1.5 min-w-[140px] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                defaultValue=""
                onChange={(e) => { handleDownloadSelect(e.target.value); e.currentTarget.value = ''; }}
                disabled={!tableData.length}
              >
                <option value="" disabled>Select format</option>
                <option value="pdf">PDF</option>
                <option value="xlsx">Excel (XLSX)</option>
                <option value="csv">CSV</option>
              </select>
            </div>
          </div>
        </div>

        {tableData.length === 0 ? (
          <div className="p-12 text-center bg-white">
            <p className="text-gray-500">No records found matching the selected filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
            <table className="min-w-full bg-white border-collapse border border-gray-300">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border border-gray-300">
                    SLNO
                  </th>
                  <th className="px-4 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border border-gray-300">
                    DIVISION
                  </th>
                  <th className="px-4 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border border-gray-300">
                    SUBDIVISION
                  </th>
                  <th className="px-4 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border border-gray-300">
                    SITE CODE
                  </th>
                  <th className="px-4 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border border-gray-300">
                    CCR OBSERVATION
                  </th>
                  <th className="px-4 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border border-gray-300">
                    TYPE OF ISSUE
                  </th>
                  <th className="px-4 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border border-gray-300">
                    DATE OF INSPECTION
                  </th>
                  <th className="px-4 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border border-gray-300">
                    FIELD TEAM ACTION/OBSERVATION
                  </th>
                  <th className="px-4 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border border-gray-300">
                    CCR STATUS
                  </th>
                  <th className="px-4 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border border-gray-300">
                    CCR REMARKS
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tableData.map((row) => (
                  <tr key={`${row.siteCode}-${row.slNo}`} className="hover:bg-gray-50">
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 border border-gray-300 text-center">
                      {row.slNo}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 border border-gray-300 text-center">
                      {row.division || '-'}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 border border-gray-300 text-center">
                      {row.subDivision || '-'}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 border border-gray-300 text-center">
                      {row.siteCode || '-'}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-700 border border-gray-300 text-center" style={{ whiteSpace: 'pre-wrap', maxWidth: '300px' }}>
                      {row.ccrObservation || '-'}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 border border-gray-300 text-center">
                      {row.typeOfIssue || '-'}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 border border-gray-300 text-center">
                      {row.dateOfInspection || '-'}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-700 border border-gray-300 text-center" style={{ whiteSpace: 'pre-wrap', maxWidth: '300px' }}>
                      {row.fieldTeamActionObservation || '-'}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm border border-gray-300 text-center">
                      <span 
                        className={`px-2 py-0.5 rounded ${
                          row.ccrStatus === 'Approved' 
                            ? 'bg-green-100 text-green-800' 
                            : row.ccrStatus === 'Pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : row.ccrStatus === 'Kept for Monitoring'
                            ? 'bg-blue-100 text-blue-800'
                            : row.ccrStatus === 'Unattended'
                            ? 'bg-gray-200 text-gray-800'
                            : row.ccrStatus === 'Attended & Cleared'
                            ? 'bg-green-100 text-green-800'
                            : row.ccrStatus === 'Attended & Not Cleared'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {row.ccrStatus || 'Unattended'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-700 border border-gray-300 text-center" style={{ whiteSpace: 'pre-wrap', maxWidth: '300px' }}>
                      {row.ccrRemarks || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="text-sm text-gray-600">
        Total Records: {tableData.length} / {allTableData.length}
      </div>
    </div>
  );
}
