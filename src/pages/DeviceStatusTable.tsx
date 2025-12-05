import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { API_BASE } from '../utils/api';

// Normalize function for case-insensitive matching
const normalize = (str: string): string => {
  return String(str || '').trim().toLowerCase().replace(/[_\s-]/g, '');
};

// Normalize header function (same as backend)
const normalizeHeader = (str: string): string => {
  return String(str || '').trim().toLowerCase().replace(/[_\s-]/g, '');
};

interface TableRow {
  slNo: number;
  siteCode: string;
  division: string;
  subDivision: string;
  hrn: string;
  deviceStatus: string;
  noOfDaysOffline?: number;
}

export default function DeviceStatusTable() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const deviceStatus = searchParams.get('status') || '';
  const selectedDate = searchParams.get('date') || '';
  
  const [tableData, setTableData] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDownloadDropdownOpen, setIsDownloadDropdownOpen] = useState(false);

  const isLocalOrRemote = normalize(deviceStatus) === 'local' || normalize(deviceStatus) === 'remote';

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const token = localStorage.getItem('token');
        if (!token) {
          setError('Authentication required');
          return;
        }

        const user = localStorage.getItem('user');
        if (!user) {
          setError('User data not found');
          return;
        }

        const userData = JSON.parse(user);
        const userDivisions = userData.division || [];

        // Fetch all uploads
        const uploadsRes = await fetch(`${API_BASE}/api/uploads`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const uploadsJson = await uploadsRes.json();

        if (!uploadsJson?.success) {
          setError('Failed to fetch uploads');
          return;
        }

        // Find latest ONLINE-OFFLINE file
        const onlineOfflineFiles = (uploadsJson.files || []).filter((f: any) => {
          const uploadType = String(f.uploadType || '').toLowerCase().trim();
          const fileName = String(f.name || '').toLowerCase();
          return uploadType === 'online-offline-data' || 
                 fileName.includes('online-offline') || 
                 fileName.includes('online_offline') ||
                 fileName.includes('onlineoffline');
        });

        if (onlineOfflineFiles.length === 0) {
          setError('No ONLINE-OFFLINE file found');
          return;
        }

        // Get latest file (we'll filter by date column inside the file, not by file upload date)
        const latestFile = onlineOfflineFiles.sort((a: any, b: any) => {
          const dateA = a.uploadedAt ? new Date(a.uploadedAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
          const dateB = b.uploadedAt ? new Date(b.uploadedAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
          return dateB - dateA;
        })[0];

        // Fetch ONLINE-OFFLINE file data
        const fileRes = await fetch(`${API_BASE}/api/uploads/${latestFile.fileId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const fileJson = await fileRes.json();

        if (!fileJson?.success || !fileJson.file) {
          setError('Failed to fetch file data');
          return;
        }

        const file = fileJson.file;
        const rows = Array.isArray(file.rows) ? file.rows : [];
        const headers = file.headers && file.headers.length ? file.headers : (rows[0] ? Object.keys(rows[0]) : []);

        // Parse date from column name (same logic as backend)
        const parseDateFromColumnName = (columnName: string): Date | null => {
          const datePatterns = [
            /(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/,
            /(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/,
          ];
          
          for (const pattern of datePatterns) {
            const match = String(columnName).match(pattern);
            if (match) {
              if (pattern.source.includes('\\d{4}') && pattern.source.startsWith('(\\d{4})')) {
                return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
              } else {
                return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
              }
            }
          }
          return null;
        };

        // Find all date columns
        const dateColumns: Array<{ name: string; date: Date; index: number }> = [];
        headers.forEach((h: string, index: number) => {
          const n = normalize(h);
          if (n.includes('date')) {
            const parsedDate = parseDateFromColumnName(h);
            if (parsedDate && !isNaN(parsedDate.getTime())) {
              dateColumns.push({ name: h, date: parsedDate, index });
            }
          }
        });

        // Find target date column (same logic as backend)
        let targetDateColumn: { name: string; date: Date; index: number } | null = null;
        let deviceStatusHeader: string | undefined = undefined;
        let equipLRSwitchStatusHeader: string | undefined = undefined;

        if (selectedDate) {
          // Parse the provided date (format: YYYY-MM-DD)
          const [year, month, day] = selectedDate.split('-').map(Number);
          const targetDate = new Date(year, month - 1, day);
          
          // Find the date column that matches the selected date
          targetDateColumn = dateColumns.find(dc => {
            const dcDate = dc.date;
            return dcDate.getFullYear() === targetDate.getFullYear() &&
                   dcDate.getMonth() === targetDate.getMonth() &&
                   dcDate.getDate() === targetDate.getDate();
          }) || null;
        } else {
          // If no date provided, use latest date column
          if (dateColumns.length > 0) {
            dateColumns.sort((a, b) => b.date.getTime() - a.date.getTime());
            targetDateColumn = dateColumns[0];
          }
        }

        // Find status headers based on target date column (same logic as backend)
        if (targetDateColumn) {
          const targetDateIndex = targetDateColumn.index;

          // Find columns after target date column (before next date column)
          for (let i = targetDateIndex + 1; i < headers.length; i++) {
            const nextCol = headers[i];
            const normalized = normalizeHeader(nextCol);
            
            // Stop if we hit another date column
            if (dateColumns.some(dc => dc.name === nextCol && dc.index !== targetDateIndex)) break;
            
            // Find DEVICE STATUS
            if (!deviceStatusHeader && normalized.includes('device') && normalized.includes('status') && !normalized.includes('rtu')) {
              deviceStatusHeader = nextCol;
            }
            
            // Find EQUIPMENT L/R SWITCH STATUS
            if (!equipLRSwitchStatusHeader && ((normalized.includes('equipment') && normalized.includes('switch')) || 
                (normalized.includes('l/r') && normalized.includes('switch')))) {
              equipLRSwitchStatusHeader = nextCol;
            }
            
            // Stop after finding both or hitting RTU column
            if (deviceStatusHeader && equipLRSwitchStatusHeader) break;
            if (normalized.includes('rtu') && normalized.includes('switch')) break;
          }
        } else {
          // Fallback: find first occurrence if no date columns found
          deviceStatusHeader = headers.find((h: string) => {
            const n = normalize(h);
            return n.includes('device') && n.includes('status') && !n.includes('rtu');
          });
          
          equipLRSwitchStatusHeader = headers.find((h: string) => {
            const n = normalize(h);
            return (n.includes('equipment') && n.includes('switch')) ||
                   (n.includes('l/r') && n.includes('switch'));
          });
        }

        // Find other headers
        const siteCodeHeader = headers.find((h: string) => {
          const n = normalize(h);
          return n === 'sitecode' || n === 'site_code';
        });
        const divisionHeader = headers.find((h: string) => {
          const n = normalize(h);
          return n === 'division';
        });
        const subDivisionHeader = headers.find((h: string) => {
          const n = normalize(h);
          return n === 'sub division' || n === 'subdivision' || n === 'sub_division';
        });
        const noOfDaysOfflineHeader = headers.find((h: string) => {
          const n = normalize(h);
          return n === 'noofdaysoffline' || (n.includes('days') && n.includes('offline'));
        });

        if (!siteCodeHeader) {
          setError('Site Code column not found');
          return;
        }

        // Find Device Status Upload file for HRN
        const deviceStatusUploadFile = (uploadsJson.files || [])
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

        let hrnMap: { [key: string]: string } = {};
        if (deviceStatusUploadFile) {
          const deviceStatusRes = await fetch(`${API_BASE}/api/uploads/${deviceStatusUploadFile.fileId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const deviceStatusJson = await deviceStatusRes.json();
          if (deviceStatusJson?.success && deviceStatusJson.file) {
            const deviceStatusRows = Array.isArray(deviceStatusJson.file.rows) ? deviceStatusJson.file.rows : [];
            const deviceStatusHeaders = deviceStatusJson.file.headers && deviceStatusJson.file.headers.length 
              ? deviceStatusJson.file.headers 
              : (deviceStatusRows[0] ? Object.keys(deviceStatusRows[0]) : []);
            
            const deviceStatusSiteCodeHeader = deviceStatusHeaders.find((h: string) => {
              const n = normalize(h);
              return n === 'sitecode' || n === 'site_code';
            });
            const hrnHeader = deviceStatusHeaders.find((h: string) => {
              const n = normalize(h);
              return n === 'hrn';
            });

            if (deviceStatusSiteCodeHeader && hrnHeader) {
              deviceStatusRows.forEach((row: any) => {
                const siteCode = String(row[deviceStatusSiteCodeHeader] || '').trim().toUpperCase();
                const hrn = String(row[hrnHeader] || '').trim();
                if (siteCode) {
                  hrnMap[normalize(siteCode)] = hrn;
                }
              });
            }
          }
        }

        // Filter rows based on device status and user divisions
        let filteredRows = rows.filter((row: any) => {
          // Filter by division
          if (divisionHeader && userDivisions.length > 0) {
            const rowDivision = String(row[divisionHeader] || '').trim();
            const matches = userDivisions.some((div: string) => {
              const userDiv = normalize(String(div));
              const dataDiv = normalize(rowDivision);
              return userDiv === dataDiv || 
                     (Math.abs(userDiv.length - dataDiv.length) <= 1 && 
                      (userDiv.includes(dataDiv) || dataDiv.includes(userDiv)));
            });
            if (!matches) return false;
          }

          // Filter by device status
          if (isLocalOrRemote && equipLRSwitchStatusHeader) {
            const status = String(row[equipLRSwitchStatusHeader] || '').trim();
            const normalizedStatus = normalize(status);
            const normalizedDeviceStatus = normalize(deviceStatus);
            // Match exact or if status contains the device status (e.g., "LOCAL" matches "LOCAL", "RTU LOCAL" contains "LOCAL")
            return normalizedStatus === normalizedDeviceStatus || 
                   normalizedStatus.includes(normalizedDeviceStatus) ||
                   normalizedDeviceStatus.includes(normalizedStatus);
          } else if (deviceStatusHeader) {
            const status = String(row[deviceStatusHeader] || '').trim();
            return normalize(status) === normalize(deviceStatus);
          }

          return false;
        });

        // Build table data
        const tableRows: TableRow[] = filteredRows.map((row: any, index: number) => {
          const siteCode = String(row[siteCodeHeader] || '').trim();
          const normalizedSiteCode = normalize(siteCode);
          const hrn = hrnMap[normalizedSiteCode] || '';

          const rowData: TableRow = {
            slNo: index + 1,
            siteCode: siteCode,
            division: divisionHeader ? String(row[divisionHeader] || '').trim() : '',
            subDivision: subDivisionHeader ? String(row[subDivisionHeader] || '').trim() : '',
            hrn: hrn,
            deviceStatus: isLocalOrRemote && equipLRSwitchStatusHeader
              ? String(row[equipLRSwitchStatusHeader] || '').trim()
              : deviceStatusHeader
              ? String(row[deviceStatusHeader] || '').trim()
              : ''
          };

          if (normalize(deviceStatus) === 'offline' && noOfDaysOfflineHeader) {
            const daysValue = row[noOfDaysOfflineHeader];
            let days = 0;
            if (typeof daysValue === 'number') {
              days = daysValue;
            } else if (typeof daysValue === 'string') {
              const cleaned = daysValue.trim().replace(/[^\d.]/g, '');
              days = parseFloat(cleaned) || 0;
            }
            rowData.noOfDaysOffline = days;
          }

          return rowData;
        });

        // Sort by No of Days Offline for OFFLINE status (ascending)
        if (normalize(deviceStatus) === 'offline') {
          tableRows.sort((a, b) => {
            const daysA = a.noOfDaysOffline || 0;
            const daysB = b.noOfDaysOffline || 0;
            return daysA - daysB;
          });
          // Reassign serial numbers after sorting
          tableRows.forEach((row, index) => {
            row.slNo = index + 1;
          });
        }

        setTableData(tableRows);
      } catch (err: any) {
        console.error('Error fetching device status data:', err);
        setError(err.message || 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    if (deviceStatus) {
      fetchData();
    }
  }, [deviceStatus, selectedDate]);

  const handleDownloadPDF = () => {
    if (!tableData.length) return;
    
    const w = window.open('', '_blank');
    if (!w) return;

    setIsDownloadDropdownOpen(false);

    // Get user information
    const user = localStorage.getItem('user');
    const userData = user ? JSON.parse(user) : {};
    const userName = userData?.fullName || userData?.userId || 'Unknown User';
    const userRole = userData?.role || 'Unknown Role';
    const userDesignation = userData?.designation || userData?.Designation || 'N/A';
    const userCircle = Array.isArray(userData?.circle) && userData.circle.length > 0 
      ? userData.circle.join(', ') 
      : (userData?.circle || 'N/A');
    
    const downloadTime = new Date().toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    // Format the selected date from "Device Status as on" field
    let selectedDateFormatted = '';
    if (selectedDate) {
      const dateObj = new Date(selectedDate);
      selectedDateFormatted = dateObj.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    }

    const title = `Device Status - ${deviceStatus.toUpperCase()}`;
    const colPercent = (100 / Math.max(1, isLocalOrRemote ? 6 : (normalize(deviceStatus) === 'offline' ? 7 : 6))).toFixed(2);

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

    // Build headers
    const headers = ['Sl No', 'Site Code', 'Division', 'Sub Division', 'HRN', 
                    isLocalOrRemote ? 'Equipment L/R Switch Status' : 'Device Status'];
    if (normalize(deviceStatus) === 'offline') {
      headers.push('No of Days Offline');
    }

    const thead = `<tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr>`;
    const tbody = tableData.map((row, idx) => {
      const isEven = idx % 2 === 0;
      const values = [
        row.slNo,
        row.siteCode,
        row.division,
        row.subDivision,
        row.hrn,
        row.deviceStatus
      ];
      if (normalize(deviceStatus) === 'offline') {
        values.push(row.noOfDaysOffline || '');
      }
      return `<tr style="background-color: ${isEven ? '#f0f9ff' : '#ffffff'}">${values.map(v => `<td>${String(v)}</td>`).join('')}</tr>`;
    }).join('');

    // Build date text
    let dateText = '';
    if (selectedDateFormatted) {
      dateText = `Device Status as on: ${selectedDateFormatted} | Downloaded on: ${downloadTime}`;
    } else {
      dateText = `Downloaded on: ${downloadTime}`;
    }

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
            <div class="meta">${dateText}</div>
            <div class="user-info">
              <strong>Downloaded by:</strong> ${userName} &nbsp;|&nbsp; 
              <strong>Role:</strong> ${userRole} &nbsp;|&nbsp; 
              <strong>Designation:</strong> ${userDesignation} &nbsp;|&nbsp; 
              <strong>Circle:</strong> ${userCircle} &nbsp;|&nbsp; 
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
            Generated on ${downloadTime} | ${userName} (${userRole}, ${userDesignation}, Circle: ${userCircle})
          </div>
        </body>
      </html>
    `);
    w.document.close();
    w.focus();
    w.print();
  };

  const handleDownloadExcel = () => {
    const ws = XLSX.utils.json_to_sheet(tableData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Device Status');
    XLSX.writeFile(wb, `Device-Status-${deviceStatus}-${new Date().toISOString().split('T')[0]}.xlsx`);
    setIsDownloadDropdownOpen(false);
  };

  const handleDownloadCSV = () => {
    const headers = ['Sl No', 'Site Code', 'Division', 'Sub Division', 'HRN', 
                    isLocalOrRemote ? 'Equipment L/R Switch Status' : 'Device Status'];
    if (normalize(deviceStatus) === 'offline') {
      headers.push('No of Days Offline');
    }

    const csvRows = [
      headers.join(','),
      ...tableData.map(row => {
        const values = [
          row.slNo,
          row.siteCode,
          row.division,
          row.subDivision,
          row.hrn,
          row.deviceStatus
        ];
        if (normalize(deviceStatus) === 'offline') {
          values.push(String(row.noOfDaysOffline || ''));
        }
        return values.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
      })
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Device-Status-${deviceStatus}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    setIsDownloadDropdownOpen(false);
  };

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
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">
          {deviceStatus.toUpperCase()} Device Status
        </h2>
        <div className="flex items-center gap-4">
          <div className="relative">
            <button
              onClick={() => setIsDownloadDropdownOpen(!isDownloadDropdownOpen)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              Download
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {isDownloadDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                <button
                  onClick={handleDownloadPDF}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded-t-lg"
                >
                  PDF
                </button>
                <button
                  onClick={handleDownloadExcel}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100"
                >
                  Excel (XLSX)
                </button>
                <button
                  onClick={handleDownloadCSV}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded-b-lg"
                >
                  CSV
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>

      {tableData.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">No {deviceStatus.toUpperCase()} devices found</p>
        </div>
      ) : (
        <div className="overflow-x-auto" id="device-status-table">
          <table className="min-w-full bg-white border-collapse border border-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border border-gray-300">Sl No</th>
                <th className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border border-gray-300">Site Code</th>
                <th className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border border-gray-300">Division</th>
                <th className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border border-gray-300">Sub Division</th>
                <th className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border border-gray-300">HRN</th>
                <th className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border border-gray-300">
                  {isLocalOrRemote ? 'Equipment L/R Switch Status' : 'Device Status'}
                </th>
                {normalize(deviceStatus) === 'offline' && (
                  <th className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border border-gray-300">No of Days Offline</th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tableData.map((row, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border border-gray-300 text-center">{row.slNo}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border border-gray-300 text-center">{row.siteCode}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border border-gray-300 text-center">{row.division}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border border-gray-300 text-center">{row.subDivision}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border border-gray-300 text-center">{row.hrn}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border border-gray-300 text-center">{row.deviceStatus}</td>
                  {normalize(deviceStatus) === 'offline' && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border border-gray-300 text-center">{row.noOfDaysOffline || ''}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

