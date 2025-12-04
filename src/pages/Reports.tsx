import { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LabelList } from 'recharts';

interface ReportRow {
  slNo: number;
  siteCode: string;
  taskStatus?: string;
  typeOfIssue?: string;
  remarks: string;
  updatedTimeAndDate: string;
  resolvedBy: string;
  ccrStatus?: string;
}

interface ReportDetails {
  circle?: string;
  division?: string;
  subDivision?: string;
  siteCode?: string;
  deviceType?: string;
  equipmentMake?: string;
  rtuMake?: string;
  hrn?: string;
  attribute?: string;
  deviceStatus?: string;
  noOfDaysOffline?: number;
  taskStatus?: string;
  typeOfIssue?: string;
  updatedAt?: string;
  viewPhotos?: (string | { data: string })[];
}

interface MultiSelectDropdownProps {
  label: string;
  options: string[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  loading?: boolean;
  placeholder?: string;
}

// Helper function to get current user from localStorage
function getCurrentUser() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user || {};
  } catch {
    return {};
  }
}

export default function Reports() {
  const [reportType, setReportType] = useState<string>('Resolved');
  
  // Reset LOCAL REMOTE date when switching report types
  useEffect(() => {
    if (reportType !== 'LOCAL REMOTE') {
      setLocalRemoteDate('');
    }
  }, [reportType]);
  const [selectedCircles, setSelectedCircles] = useState<string[]>([]);
  const [selectedDivisions, setSelectedDivisions] = useState<string[]>([]);
  const [selectedSubDivisions, setSelectedSubDivisions] = useState<string[]>([]);
  const [timeRange, setTimeRange] = useState<string>('All');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [localRemoteDate, setLocalRemoteDate] = useState<string>(''); // Single date for LOCAL REMOTE
  // const [latestDate, setLatestDate] = useState<string>(''); // Latest date from backend for LOCAL REMOTE
  
  const [circleOptions, setCircleOptions] = useState<string[]>([]);
  const [divisionOptions, setDivisionOptions] = useState<string[]>([]);
  const [subDivisionOptions, setSubDivisionOptions] = useState<string[]>([]);
  
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtersLoading, setFiltersLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ReportDetails | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [localRemoteData, setLocalRemoteData] = useState<any[]>([]);
  const [trendData, setTrendData] = useState<any[]>([]);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);

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

        const filtersUrl = `http://localhost:5000/api/equipment-offline-sites/reports/filters?_t=${Date.now()}`;
        console.log('Fetching filters from:', filtersUrl);
        
        const response = await fetch(filtersUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          cache: 'no-store'
        });

        console.log('Filters API response status:', response.status, response.statusText);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Filters API error response:', errorText);
          throw new Error(`Server error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Filters API response data:', data);
        
        if (data.success) {
          setCircleOptions(data.data.circles || []);
          setDivisionOptions(data.data.divisions || []);
          setSubDivisionOptions(data.data.subDivisions || []);
        } else {
          setError(data.error || 'Failed to load filter options');
        }
      } catch (err: any) {
        console.error('Error fetching filters:', err);
        const errorMessage = err.message || 'Failed to fetch filter options. Please check if the server is running.';
        setError(errorMessage);
      } finally {
        setFiltersLoading(false);
      }
    };

    fetchFilters();
  }, []);

  // Calculate date range based on time range selection
  const getDateRange = () => {
    const now = new Date();
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    switch (timeRange) {
      case 'This Day':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        break;
      case 'This Week':
        const dayOfWeek = now.getDay();
        const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Monday
        startDate = new Date(now.getFullYear(), now.getMonth(), diff);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'This Month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
      case 'Date Range':
        if (fromDate && toDate) {
          startDate = new Date(fromDate);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(toDate);
          endDate.setHours(23, 59, 59, 999);
        }
        break;
      default:
        // 'All' - no date filter
        return { startDate: null, endDate: null };
    }

    return { startDate, endDate };
  };

  // Fetch reports when filters change
  useEffect(() => {
    const fetchReports = async () => {
      try {
        setLoading(true);
        setError(null);
        const token = localStorage.getItem('token');
        if (!token) {
          setError('Authentication required');
          return;
        }

        // Build query parameters
        const params = new URLSearchParams();
        if (reportType) {
          params.append('reportType', reportType);
        }
        if (selectedCircles.length > 0) {
          selectedCircles.forEach(circle => params.append('circles', circle));
        }
        if (selectedDivisions.length > 0) {
          selectedDivisions.forEach(division => params.append('divisions', division));
        }
        if (selectedSubDivisions.length > 0) {
          selectedSubDivisions.forEach(subDivision => params.append('subDivisions', subDivision));
        }

        // Add date range parameters
        const { startDate, endDate } = getDateRange();
        if (startDate && endDate) {
          params.append('fromDate', startDate.toISOString());
          params.append('toDate', endDate.toISOString());
        }

        // Add timestamp to prevent caching
        params.append('_t', Date.now().toString());
        
        // Use different endpoint for LOCAL REMOTE reports
        let url: string;
          if (reportType === 'LOCAL REMOTE') {
          // LOCAL REMOTE reports use a different endpoint
          const localRemoteParams = new URLSearchParams();
          if (selectedCircles.length > 0) {
            localRemoteParams.append('circles', selectedCircles.join(','));
          }
          if (selectedDivisions.length > 0) {
            localRemoteParams.append('divisions', selectedDivisions.join(','));
          }
          // Use single date field for LOCAL REMOTE
          if (localRemoteDate) {
            localRemoteParams.append('date', localRemoteDate);
          }
          localRemoteParams.append('_t', Date.now().toString());
          url = `http://localhost:5000/api/equipment-offline-sites/reports/local-remote?${localRemoteParams.toString()}`;
        } else {
          url = `http://localhost:5000/api/equipment-offline-sites/reports?${params.toString()}`;
        }
        
        console.log('Fetching reports from:', url);
        
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          cache: 'no-store'
        });

        console.log('Reports API response status:', response.status, response.statusText);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Reports API error response:', errorText);
          throw new Error(`Server error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Reports API response data:', data);
        
        if (data.success) {
          // LOCAL REMOTE reports have a different data structure
          if (reportType === 'LOCAL REMOTE') {
            // Store the raw LOCAL REMOTE data and trendData for graphs
            // Backend returns: { division, online, offline, local, remote } and trendData array
            setLocalRemoteData(data.data || []);
            setTrendData(data.trendData || []);
            // Set latest date for date picker default (only on first load or if not set)
            if (data.latestDate) {
              setLatestDate(data.latestDate);
              // Only set default date if localRemoteDate is empty (first load)
              if (!localRemoteDate) {
                setLocalRemoteDate(data.latestDate);
              }
            }
            // Keep raw data for LOCAL REMOTE - will display with separate columns
            // Format date as DD-MM-YYYY for display
            const formatDate = (dateStr: string) => {
              if (!dateStr) return '';
              try {
                const date = new Date(dateStr);
                const day = String(date.getDate()).padStart(2, '0');
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const year = date.getFullYear();
                return `${day}-${month}-${year}`;
              } catch {
                return dateStr;
              }
            };
            const transformedData = (data.data || []).map((item: any, index: number) => ({
              slNo: index + 1,
              siteCode: item.division || '',
              online: item.online || 0,
              offline: item.offline || 0,
              local: item.local || 0,
              remote: item.remote || 0,
              updatedTimeAndDate: formatDate(data.latestDate || ''),
              resolvedBy: ''
            }));
            setReports(transformedData as any);
          } else {
            setLocalRemoteData([]);
            setTrendData([]);
            setReports(data.data || []);
          }
        } else {
          setError(data.error || 'Failed to load reports');
          setReports([]);
        }
      } catch (err: any) {
        console.error('Error fetching reports:', err);
        const errorMessage = err.message || 'Failed to fetch reports. Please check if the server is running.';
        setError(errorMessage);
        setReports([]);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
    // Reset to first page when filters change
    setCurrentPage(1);
  }, [reportType, selectedCircles, selectedDivisions, selectedSubDivisions, timeRange, fromDate, toDate, localRemoteDate]);
  
  // Calculate pagination
  const totalPages = Math.ceil(reports.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedReports = reports.slice(startIndex, endIndex);
  
  // Pagination handlers
  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };
  
  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };
  
  const handleRowsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setRowsPerPage(Number(e.target.value));
    setCurrentPage(1); // Reset to first page when changing rows per page
  };

  // Fetch detailed report information
  const fetchReportDetails = async (siteCode: string) => {
    try {
      setLoadingDetails(true);
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication required');
        return;
      }

      // Find the report in current list to get basic info
      const report = reports.find(r => r.siteCode === siteCode);
      if (!report) return;

      // Fetch full details from API
      const params = new URLSearchParams();
      params.append('siteCode', siteCode);
      params.append('reportType', reportType);

      const url = `http://localhost:5000/api/equipment-offline-sites/reports/details?${params.toString()}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      if (data.success && data.data) {
        console.log('Report details loaded:', {
          siteCode: data.data.siteCode,
          viewPhotos: data.data.viewPhotos,
          viewPhotosLength: Array.isArray(data.data.viewPhotos) ? data.data.viewPhotos.length : 'not an array',
          viewPhotosType: typeof data.data.viewPhotos
        });
        setSelectedReport(data.data);
        setIsDialogOpen(true);
      } else {
        setError(data.error || 'Failed to load report details');
      }
    } catch (err: any) {
      console.error('Error fetching report details:', err);
      setError(err.message || 'Failed to load report details');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleRowDoubleClick = (siteCode: string) => {
    fetchReportDetails(siteCode);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setSelectedReport(null);
  };

  // Download functions
  const downloadCSV = () => {
    if (!reports.length) return;
    
    // Include Task Status and Type of Issue columns only for Pending reports
    // LOCAL REMOTE has separate columns for ONLINE, OFFLINE, LOCAL, REMOTE
    const headers = reportType === 'Pending' 
      ? ['SlNo', 'Site Code', 'Task Status', 'Type of Issue', 'Remarks', 'Updated Time and Date', 'Pending At']
      : reportType === 'LOCAL REMOTE'
      ? ['SlNo', 'Division', 'ONLINE', 'OFFLINE', 'LOCAL', 'REMOTE']
      : ['SlNo', 'Site Code', 'Remarks', 'Updated Time and Date', 'Resolved By', 'CCR Status'];
    
    const csvRows = reports.map(report => {
      if (reportType === 'Pending') {
        return [
          report.slNo,
          report.siteCode,
          report.taskStatus || '',
          report.typeOfIssue || '',
          report.remarks || '',
          report.updatedTimeAndDate,
          report.resolvedBy
        ];
      } else if (reportType === 'LOCAL REMOTE') {
        return [
          report.slNo,
          report.siteCode, // This is actually division for LOCAL REMOTE
          (report as any).online || 0,
          (report as any).offline || 0,
          (report as any).local || 0,
          (report as any).remote || 0
        ];
      } else {
        return [
          report.slNo,
          report.siteCode,
          report.remarks || '',
          report.updatedTimeAndDate,
          report.resolvedBy,
          report.ccrStatus || 'Pending'
        ];
      }
    });
    
    const csvContent = [
      headers.join(','),
      ...csvRows.map(row => 
        row.map(cell => {
          const cellStr = String(cell || '');
          // Escape commas and quotes in CSV
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        }).join(',')
      )
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `reports-${reportType.toLowerCase()}-${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadXLSX = () => {
    if (!reports.length) return;
    
    // Include Task Status and Type of Issue columns only for Pending reports
    // LOCAL REMOTE has separate columns for ONLINE, OFFLINE, LOCAL, REMOTE
    const headers = reportType === 'Pending' 
      ? ['SlNo', 'Site Code', 'Task Status', 'Type of Issue', 'Remarks', 'Updated Time and Date', 'Pending At']
      : reportType === 'LOCAL REMOTE'
      ? ['SlNo', 'Division', 'ONLINE', 'OFFLINE', 'LOCAL', 'REMOTE']
      : ['SlNo', 'Site Code', 'Remarks', 'Updated Time and Date', 'Resolved By', 'CCR Status'];
    
    const data = reports.map(report => {
      if (reportType === 'Pending') {
        return [
          report.slNo,
          report.siteCode,
          report.taskStatus || '',
          report.typeOfIssue || '',
          report.remarks || '',
          report.updatedTimeAndDate,
          report.resolvedBy
        ];
      } else if (reportType === 'LOCAL REMOTE') {
        return [
          report.slNo,
          report.siteCode, // This is actually division for LOCAL REMOTE
          (report as any).online || 0,
          (report as any).offline || 0,
          (report as any).local || 0,
          (report as any).remote || 0
        ];
      } else {
        return [
          report.slNo,
          report.siteCode,
          report.remarks || '',
          report.updatedTimeAndDate,
          report.resolvedBy,
          report.ccrStatus || 'Pending'
        ];
      }
    });
    
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reports');
    XLSX.writeFile(wb, `reports-${reportType.toLowerCase()}-${new Date().getTime()}.xlsx`);
  };

  const downloadPDF = () => {
    if (!reports.length) return;
    
    const w = window.open('', '_blank');
    if (!w) return;

    const currentUser = getCurrentUser();
    const userName = currentUser?.fullName || currentUser?.userId || 'Unknown User';
    const userRole = currentUser?.role || 'Unknown Role';
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

    const title = `Reports - ${reportType}`;
    
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
        text-align: left; 
        font-size: 10px; 
        word-wrap: break-word; 
        white-space: normal; 
      }
      th { 
        background-color: #3b82f6; 
        color: white; 
        font-weight: bold;
        text-align: center;
      }
      tr:nth-child(even) { 
        background-color: #f0f9ff; 
      }
      tr:nth-child(odd) { 
        background-color: #ffffff; 
      }
      .footer {
        margin-top: 15px;
        padding-top: 8px;
        border-top: 1px solid #cbd5e1;
        font-size: 9px;
        color: #64748b;
        text-align: center;
      }
    `;

    // Include Task Status and Type of Issue columns only for Pending and LOCAL REMOTE reports
    const thead = reportType === 'Pending'
      ? `<tr>
          <th style="width: 5%;">SlNo</th>
          <th style="width: 12%;">Site Code</th>
          <th style="width: 15%;">Task Status</th>
          <th style="width: 18%;">Type of Issue</th>
          <th style="width: 20%;">Remarks</th>
          <th style="width: 15%;">Updated Time and Date</th>
          <th style="width: 15%;">Pending At</th>
        </tr>`
      : reportType === 'LOCAL REMOTE'
      ? `<tr>
          <th style="width: 8%;">SlNo</th>
          <th style="width: 20%;">Division</th>
          <th style="width: 15%;">ONLINE</th>
          <th style="width: 15%;">OFFLINE</th>
          <th style="width: 15%;">LOCAL</th>
          <th style="width: 15%;">REMOTE</th>
        </tr>`
      : `<tr>
          <th style="width: 5%;">SlNo</th>
          <th style="width: 12%;">Site Code</th>
          <th style="width: 28%;">Remarks</th>
          <th style="width: 20%;">Updated Time and Date</th>
          <th style="width: 20%;">Resolved By</th>
          <th style="width: 15%;">CCR Status</th>
        </tr>`;
    
    const tbody = reports.map((report, idx) => {
      const isEven = idx % 2 === 0;
      if (reportType === 'Pending') {
        return `<tr style="background-color: ${isEven ? '#f0f9ff' : '#ffffff'}">
          <td style="text-align: center;">${report.slNo}</td>
          <td>${report.siteCode || ''}</td>
          <td>${(report.taskStatus || '-').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
          <td>${(report.typeOfIssue || '-').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
          <td>${(report.remarks || '-').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
          <td>${report.updatedTimeAndDate || ''}</td>
          <td>${report.resolvedBy || 'N/A'}</td>
        </tr>`;
      } else if (reportType === 'LOCAL REMOTE') {
        return `<tr style="background-color: ${isEven ? '#f0f9ff' : '#ffffff'}">
          <td style="text-align: center;">${report.slNo}</td>
          <td>${report.siteCode || ''}</td>
          <td style="text-align: center;">${(report as any).online || 0}</td>
          <td style="text-align: center;">${(report as any).offline || 0}</td>
          <td style="text-align: center;">${(report as any).local || 0}</td>
          <td style="text-align: center;">${(report as any).remote || 0}</td>
        </tr>`;
      } else {
        return `<tr style="background-color: ${isEven ? '#f0f9ff' : '#ffffff'}">
          <td style="text-align: center;">${report.slNo}</td>
          <td>${report.siteCode || ''}</td>
          <td>${(report.remarks || '-').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
          <td>${report.updatedTimeAndDate || ''}</td>
          <td>${report.resolvedBy || 'N/A'}</td>
          <td>${report.ccrStatus || 'Pending'}</td>
        </tr>`;
      }
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
            Generated on ${downloadTime} | ${userName} (${userRole}, ${userDesignation}, Circle: ${userCircle}) | Total Records: ${reports.length}
          </div>
        </body>
      </html>
    `);
    w.document.close();
    w.focus();
    w.print();
  };

  const handleDownloadSelect = (format: string) => {
    if (!format) return;
    if (format === 'pdf') downloadPDF();
    if (format === 'xlsx') downloadXLSX();
    if (format === 'csv') downloadCSV();
  };

  // Download Dropdown Component
  const DownloadDropdown = ({ onSelect }: { onSelect: (format: string) => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

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

    const handleSelect = (format: string) => {
      onSelect(format);
      setIsOpen(false);
    };

    return (
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-4 py-2 bg-white text-blue-700 rounded-lg hover:bg-blue-50 transition-colors font-medium shadow-md border border-blue-200"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download
          <svg
            className={`w-4 h-4 transition-transform ${isOpen ? 'transform rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden">
            <button
              type="button"
              onClick={() => handleSelect('pdf')}
              className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors flex items-center gap-3 text-gray-700"
            >
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <span className="font-medium">PDF</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelect('xlsx')}
              className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors flex items-center gap-3 text-gray-700 border-t border-gray-100"
            >
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="font-medium">Excel (XLSX)</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelect('csv')}
              className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors flex items-center gap-3 text-gray-700 border-t border-gray-100"
            >
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="font-medium">CSV</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  // Multi-select dropdown component
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
        // If "All" is clicked, clear all selections
        onChange([]);
      } else {
        // If a regular option is clicked
        if (selectedValues.includes(value)) {
          // Deselect the option
          onChange(selectedValues.filter(v => v !== value));
        } else {
          // Select the option
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
                title="Select All"
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
                {/* "All" option */}
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
                {/* Regular options */}
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg shadow-lg p-6 text-white">
        <h2 className="text-3xl font-bold mb-2">Reports</h2>
        <p className="text-blue-100">View resolved and pending site reports</p>
      </div>

      {/* Filters Section */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Filters</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {/* Type of Report */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type of Report
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="Resolved">Resolved</option>
              <option value="Pending">Pending</option>
              <option value="LOCAL REMOTE">LOCAL REMOTE</option>
            </select>
          </div>

          {/* Circle Dropdown */}
          <MultiSelectDropdown
            label="Circle"
            options={circleOptions}
            selectedValues={selectedCircles}
            onChange={setSelectedCircles}
            loading={filtersLoading}
            placeholder="Select Circle"
          />

          {/* Division Dropdown */}
          <MultiSelectDropdown
            label="Division"
            options={divisionOptions}
            selectedValues={selectedDivisions}
            onChange={setSelectedDivisions}
            loading={filtersLoading}
            placeholder="Select Division"
          />

          {/* Sub Division Dropdown */}
          <MultiSelectDropdown
            label="Sub Division"
            options={subDivisionOptions}
            selectedValues={selectedSubDivisions}
            onChange={setSelectedSubDivisions}
            loading={filtersLoading}
            placeholder="Select Sub Division"
          />

          {/* Time Range / Date - Show Date for LOCAL REMOTE, Time Range for others */}
          {reportType === 'LOCAL REMOTE' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date
              </label>
              <input
                type="date"
                value={localRemoteDate}
                onChange={(e) => setLocalRemoteDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Time Range
                </label>
                <select
                  value={timeRange}
                  onChange={(e) => {
                    setTimeRange(e.target.value);
                    if (e.target.value !== 'Date Range') {
                      setFromDate('');
                      setToDate('');
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
            </>
          )}
        </div>

        {/* Date Range Pickers - Show only when Date Range is selected and not LOCAL REMOTE */}
        {timeRange === 'Date Range' && reportType !== 'LOCAL REMOTE' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4 pt-4 border-t border-gray-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                From Date
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                max={toDate || new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                To Date
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                min={fromDate || undefined}
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Reports Table */}
      <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-xl border border-gray-200 overflow-hidden">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 border-b border-blue-800">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold text-white">Reports Data</h3>
              <p className="text-sm text-blue-100 mt-1">
                {loading ? 'Loading reports...' : reports.length > 0 ? `${reports.length} record(s) found` : 'No records to display'}
              </p>
            </div>
            <div className="flex items-center gap-4">
              {loading && (
                <div className="flex items-center space-x-2 text-white">
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="text-sm font-medium">Loading...</span>
                </div>
              )}
              {!loading && reports.length > 0 && (
                <DownloadDropdown onSelect={handleDownloadSelect} />
              )}
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="p-6">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-400 rounded-lg shadow-sm">
              <div className="flex items-center">
                <svg className="h-5 w-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className="text-red-800 font-medium">{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && reports.length === 0 && (
            <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No reports found</h3>
              <p className="mt-1 text-sm text-gray-500">Try adjusting your filters to see more results.</p>
            </div>
          )}

          {!loading && reports.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                        SlNo
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                        {reportType === 'LOCAL REMOTE' ? 'Division' : 'Site Code'}
                      </th>
                      {reportType === 'Pending' && (
                        <>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                            Task Status
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                            Type of Issue
                          </th>
                        </>
                      )}
                      {reportType === 'LOCAL REMOTE' && (
                        <>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                            ONLINE
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                            OFFLINE
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                            LOCAL
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                            REMOTE
                          </th>
                        </>
                      )}
                      {reportType !== 'LOCAL REMOTE' && (
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                          Remarks
                        </th>
                      )}
                      {reportType !== 'LOCAL REMOTE' && (
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                          Updated Time and Date
                        </th>
                      )}
                      {reportType === 'Resolved' && (
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                          CCR Status
                        </th>
                      )}
                      {reportType !== 'LOCAL REMOTE' && (
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          {reportType === 'Pending' ? 'Pending At' : 'Resolved By'}
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedReports.map((report, index) => {
                      // Calculate actual index for alternating row colors
                      const actualIndex = startIndex + index;
                      return (
                      <tr 
                        key={report.slNo} 
                        onDoubleClick={() => handleRowDoubleClick(report.siteCode)}
                        className={`transition-colors cursor-pointer ${
                          actualIndex % 2 === 0 
                            ? 'bg-white hover:bg-blue-50' 
                            : 'bg-gray-50 hover:bg-blue-50'
                        }`}
                        title="Double-click to view details"
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border-r border-gray-100">
                          {startIndex + index + 1}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 border-r border-gray-100">
                          {report.siteCode}
                        </td>
                        {reportType === 'Pending' && (
                          <>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 border-r border-gray-100">
                              {report.taskStatus || <span className="text-gray-400 italic">-</span>}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700 border-r border-gray-100 max-w-xs">
                              <div className="truncate" title={report.typeOfIssue || '-'}>
                                {report.typeOfIssue || <span className="text-gray-400 italic">-</span>}
                              </div>
                            </td>
                          </>
                        )}
                        {reportType === 'LOCAL REMOTE' && (
                          <>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 border-r border-gray-100 text-center font-semibold">
                              {(report as any).online || 0}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 border-r border-gray-100 text-center font-semibold">
                              {(report as any).offline || 0}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 border-r border-gray-100 text-center font-semibold">
                              {(report as any).local || 0}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 border-r border-gray-100 text-center font-semibold">
                              {(report as any).remote || 0}
                            </td>
                          </>
                        )}
                        {reportType !== 'LOCAL REMOTE' && (
                          <td className="px-6 py-4 text-sm text-gray-700 border-r border-gray-100 max-w-xs">
                            <div className="truncate" title={report.remarks || '-'}>
                              {report.remarks || <span className="text-gray-400 italic">-</span>}
                            </div>
                          </td>
                        )}
                        {reportType !== 'LOCAL REMOTE' && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 border-r border-gray-100">
                            <div className="flex items-center">
                              <svg className="h-4 w-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              {report.updatedTimeAndDate}
                            </div>
                          </td>
                        )}
                        {reportType === 'Resolved' && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm border-r border-gray-100">
                            <span
                              className={
                                report.ccrStatus === 'Approved'
                                  ? 'inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700'
                                  : report.ccrStatus === 'Kept for Monitoring'
                                  ? 'inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700'
                                  : 'inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-700'
                              }
                            >
                              {report.ccrStatus || 'Pending'}
                            </span>
                          </td>
                        )}
                        {reportType !== 'LOCAL REMOTE' && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            <div className="flex items-center">
                              <svg className="h-4 w-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              <span className="font-medium">{report.resolvedBy}</span>
                            </div>
                          </td>
                        )}
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination Controls */}
              {reports.length > 0 && (
                <div className="mt-4 flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200">
                  <div className="flex items-center space-x-4">
                    {/* Previous Button */}
                    <button
                      onClick={handlePreviousPage}
                      disabled={currentPage === 1}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        currentPage === 1
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      Previous
                    </button>
                    
                    {/* Page Indicator */}
                    <span className="text-sm text-gray-700">
                      Page {currentPage} of {totalPages}
                    </span>
                    
                    {/* Next Button */}
                    <button
                      onClick={handleNextPage}
                      disabled={currentPage === totalPages}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        currentPage === totalPages
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      Next
                    </button>
                  </div>
                  
                  {/* Rows per page */}
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-700">Rows per page:</span>
                    <select
                      value={rowsPerPage}
                      onChange={handleRowsPerPageChange}
                      className="px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Charts Section for LOCAL REMOTE - After the table */}
      {reportType === 'LOCAL REMOTE' && !loading && reports.length > 0 && (
        <div className="space-y-6">
          {/* Bar Chart Analysis */}
          {trendData.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-2">Bar Chart Analysis</h3>
              <p className="text-sm text-gray-600 mb-4">All Status Trends (Combined)</p>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="online" fill="#22c55e" name="Online">
                    <LabelList dataKey="online" position="top" style={{ fill: '#22c55e', fontSize: '12px', fontWeight: 'bold' }} />
                  </Bar>
                  <Bar dataKey="offline" fill="#ef4444" name="Offline">
                    <LabelList dataKey="offline" position="top" style={{ fill: '#ef4444', fontSize: '12px', fontWeight: 'bold' }} />
                  </Bar>
                  <Bar dataKey="local" fill="#3b82f6" name="Local">
                    <LabelList dataKey="local" position="top" style={{ fill: '#3b82f6', fontSize: '12px', fontWeight: 'bold' }} />
                  </Bar>
                  <Bar dataKey="remote" fill="#f97316" name="Remote">
                    <LabelList dataKey="remote" position="top" style={{ fill: '#f97316', fontSize: '12px', fontWeight: 'bold' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Pie Charts */}
          {localRemoteData.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Device Status Distribution */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Device Status Distribution</h3>
                {(() => {
                  const totalOnline = localRemoteData.reduce((sum, item) => sum + (item.online || 0), 0);
                  const totalOffline = localRemoteData.reduce((sum, item) => sum + (item.offline || 0), 0);
                  const total = totalOnline + totalOffline;
                  const pieData = [
                    { name: 'ONLINE', value: totalOnline, percentage: total > 0 ? ((totalOnline / total) * 100).toFixed(1) : '0.0' },
                    { name: 'OFFLINE', value: totalOffline, percentage: total > 0 ? ((totalOffline / total) * 100).toFixed(1) : '0.0' }
                  ];
                  const COLORS = ['#22c55e', '#ef4444'];
                  
                  return (
                    <>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percentage }) => `${name}: ${percentage}%`}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {pieData.map((_entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="mt-4 space-y-2">
                        {pieData.map((item, index) => (
                          <div key={item.name} className="flex items-center justify-between">
                            <div className="flex items-center">
                              <div className="w-4 h-4 rounded-full mr-2" style={{ backgroundColor: COLORS[index] }}></div>
                              <span className="text-sm font-medium text-gray-700">{item.name}:</span>
                            </div>
                            <span className="text-sm font-semibold text-gray-900">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Switch Status Distribution */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Switch Status Distribution</h3>
                {(() => {
                  const totalLocal = localRemoteData.reduce((sum, item) => sum + (item.local || 0), 0);
                  const totalRemote = localRemoteData.reduce((sum, item) => sum + (item.remote || 0), 0);
                  const total = totalLocal + totalRemote;
                  const pieData = [
                    { name: 'LOCAL', value: totalLocal, percentage: total > 0 ? ((totalLocal / total) * 100).toFixed(1) : '0.0' },
                    { name: 'REMOTE', value: totalRemote, percentage: total > 0 ? ((totalRemote / total) * 100).toFixed(1) : '0.0' }
                  ];
                  const COLORS = ['#3b82f6', '#f97316'];
                  
                  return (
                    <>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percentage }) => `${name}: ${percentage}%`}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {pieData.map((_entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="mt-4 space-y-2">
                        {pieData.map((item, index) => (
                          <div key={item.name} className="flex items-center justify-between">
                            <div className="flex items-center">
                              <div className="w-4 h-4 rounded-full mr-2" style={{ backgroundColor: COLORS[index] }}></div>
                              <span className="text-sm font-medium text-gray-700">{item.name}:</span>
                            </div>
                            <span className="text-sm font-semibold text-gray-900">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Trends Analysis - Line Charts */}
          {trendData.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-6">Trends Analysis</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Device Status Trend */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-700 mb-4">Device Status Trend</h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis domain={[0, 'dataMax + 100']} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="offline" stroke="#ef4444" strokeWidth={2} name="Offline" />
                      <Line type="monotone" dataKey="online" stroke="#22c55e" strokeWidth={2} name="Online" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Equipment L/R Switch Status Trend */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-700 mb-4">Equipment L/R Switch Status Trend</h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis domain={[0, 'dataMax + 100']} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="local" stroke="#3b82f6" strokeWidth={2} name="Local" />
                      <Line type="monotone" dataKey="remote" stroke="#f97316" strokeWidth={2} name="Remote" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Details Dialog */}
      {isDialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={closeDialog}>
          <div 
            className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Dialog Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">Report Details</h3>
              <button
                onClick={closeDialog}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Dialog Content */}
            <div className="p-6 overflow-y-auto flex-1">
              {loadingDetails ? (
                <div className="flex items-center justify-center py-12">
                  <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="ml-3 text-gray-600">Loading details...</span>
                </div>
              ) : selectedReport ? (
                <div className="space-y-6">
                  {/* Basic Information Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="text-xs font-semibold text-gray-500 uppercase">CIRCLE</label>
                      <p className="mt-1 text-sm font-medium text-gray-900">{selectedReport.circle || '-'}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="text-xs font-semibold text-gray-500 uppercase">DIVISION</label>
                      <p className="mt-1 text-sm font-medium text-gray-900">{selectedReport.division || '-'}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="text-xs font-semibold text-gray-500 uppercase">SUB DIVISION</label>
                      <p className="mt-1 text-sm font-medium text-gray-900">{selectedReport.subDivision || '-'}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="text-xs font-semibold text-gray-500 uppercase">SITE CODE</label>
                      <p className="mt-1 text-sm font-medium text-gray-900">{selectedReport.siteCode || '-'}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="text-xs font-semibold text-gray-500 uppercase">DEVICE TYPE</label>
                      <p className="mt-1 text-sm font-medium text-gray-900">{selectedReport.deviceType || '-'}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="text-xs font-semibold text-gray-500 uppercase">EQUIPMENT MAKE</label>
                      <p className="mt-1 text-sm font-medium text-gray-900">{selectedReport.equipmentMake || '-'}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="text-xs font-semibold text-gray-500 uppercase">RTU MAKE</label>
                      <p className="mt-1 text-sm font-medium text-gray-900">{selectedReport.rtuMake || '-'}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="text-xs font-semibold text-gray-500 uppercase">HRN</label>
                      <p className="mt-1 text-sm font-medium text-gray-900">{selectedReport.hrn || '-'}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="text-xs font-semibold text-gray-500 uppercase">ATTRIBUTE</label>
                      <p className="mt-1 text-sm font-medium text-gray-900">{selectedReport.attribute || '-'}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="text-xs font-semibold text-gray-500 uppercase">DEVICE STATUS</label>
                      <p className="mt-1 text-sm font-medium text-gray-900">{selectedReport.deviceStatus || '-'}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="text-xs font-semibold text-gray-500 uppercase">NO OF DAYS OFFLINE</label>
                      <p className="mt-1 text-sm font-medium text-gray-900">{selectedReport.noOfDaysOffline !== undefined && selectedReport.noOfDaysOffline !== null ? selectedReport.noOfDaysOffline : '-'}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="text-xs font-semibold text-gray-500 uppercase">TASK STATUS</label>
                      <p className="mt-1 text-sm font-medium text-gray-900">{selectedReport.taskStatus || '-'}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="text-xs font-semibold text-gray-500 uppercase">TYPE OF ISSUE</label>
                      <p className="mt-1 text-sm font-medium text-gray-900">{selectedReport.typeOfIssue || '-'}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="text-xs font-semibold text-gray-500 uppercase">UPDATED AT</label>
                      <p className="mt-1 text-sm font-medium text-gray-900">{selectedReport.updatedAt || '-'}</p>
                    </div>
                  </div>

                  {/* View Photos Section */}
                  <div className="border-t border-gray-200 pt-6">
                    <label className="text-xs font-semibold text-gray-500 uppercase mb-4 block">VIEW PHOTOS</label>
                    {selectedReport.viewPhotos && Array.isArray(selectedReport.viewPhotos) && selectedReport.viewPhotos.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {selectedReport.viewPhotos.map((photo, index) => {
                          // Handle different photo formats
                          let photoSrc = '';
                          if (typeof photo === 'string') {
                            if (photo.startsWith('data:')) {
                              photoSrc = photo;
                            } else if (photo.startsWith('http://') || photo.startsWith('https://')) {
                              photoSrc = photo;
                            } else {
                              // Assume it's base64
                              photoSrc = `data:image/jpeg;base64,${photo}`;
                            }
                          } else if (photo && typeof photo === 'object' && 'data' in photo && typeof (photo as { data: string }).data === 'string') {
                            // Handle photo object with data property
                            const photoData = (photo as { data: string }).data;
                            photoSrc = photoData.startsWith('data:') ? photoData : `data:image/jpeg;base64,${photoData}`;
                          }
                          
                          if (!photoSrc) return null;
                          
                          return (
                            <div key={index} className="relative group">
                              <img
                                src={photoSrc}
                                alt={`Photo ${index + 1}`}
                                className="w-full h-48 object-cover rounded-lg border border-gray-200 cursor-pointer hover:shadow-lg transition-shadow"
                                onClick={() => window.open(photoSrc, '_blank')}
                                onError={(e) => {
                                  console.error('Error loading photo:', index, photo);
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-opacity rounded-lg flex items-center justify-center">
                                <svg className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                </svg>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-400 italic">
                        <svg className="mx-auto h-12 w-12 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p>No photos available</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">No details available</div>
              )}
            </div>

            {/* Dialog Footer */}
            <div className="bg-gray-50 px-6 py-4 flex justify-end border-t border-gray-200">
              <button
                onClick={closeDialog}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
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

