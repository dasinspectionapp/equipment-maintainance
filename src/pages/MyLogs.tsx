import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import BackButton from '../components/BackButton';

interface ActivityLog {
  id: string;
  timestamp: string;
  date: string;
  time: string;
  action: string;
  typeOfIssue?: string;
  routingTeam?: string;
  remarks?: string;
  siteName?: string;
  siteCode?: string;
  rowKey?: string;
  sourceFileId?: string;
  photosCount?: number;
  photos?: string[]; // Photo data URLs
  status?: string;
  priority?: string;
  assignedToUserId?: string;
  assignedToRole?: string;
  userName?: string; // Name of the user who performed the action
}

function getCurrentUser() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user || {};
  } catch {
    return {};
  }
}

export default function MyLogs() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [timeRange, setTimeRange] = useState<string>('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [selectedLogPhotos, setSelectedLogPhotos] = useState<string[] | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const user = getCurrentUser();

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = () => {
    try {
      const userId = user?.userId || user?.userId || 'unknown';
      const storageKey = `activityLogs_${userId}`;
      const savedLogs = localStorage.getItem(storageKey);
      
      if (savedLogs) {
        const parsedLogs = JSON.parse(savedLogs);
        // Parse timestamp into date and time fields if they don't exist
        const processedLogs = parsedLogs.map((log: any) => {
          if (!log.date || !log.time) {
            const timestamp = log.timestamp ? new Date(log.timestamp) : new Date();
            log.date = timestamp.toISOString().split('T')[0];
            log.time = timestamp.toTimeString().split(' ')[0]; // HH:MM:SS format
            log.id = log.id || `${log.timestamp}_${Math.random()}`;
          }
          return log as ActivityLog;
        });
        // Sort by timestamp descending (newest first)
        const sortedLogs = processedLogs.sort((a: ActivityLog, b: ActivityLog) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        setLogs(sortedLogs);
      } else {
        setLogs([]);
      }
    } catch (error) {
      console.error('Error loading logs:', error);
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate date range based on time range selection
  const getDateRange = () => {
    const now = new Date();
    let fromDate = '';
    let toDate = now.toISOString().split('T')[0]; // Today
    
    if (timeRange === 'This Day') {
      fromDate = now.toISOString().split('T')[0];
    } else if (timeRange === 'This Week') {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
      fromDate = startOfWeek.toISOString().split('T')[0];
    } else if (timeRange === 'This Month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      fromDate = startOfMonth.toISOString().split('T')[0];
    } else if (timeRange === 'Customized Date Range') {
      fromDate = filterDateFrom;
      toDate = filterDateTo || toDate;
    }
    
    return { fromDate, toDate };
  };

  // Filter logs based on search and filters
  const filteredLogs = logs.filter(log => {
    // Exclude "Action is required" logs if they have been routed (routingTeam is set)
    const actionLower = (log.action || '').toLowerCase();
    const isActionRequired = actionLower.includes('action is required') || actionLower.includes('action required');
    const hasRoutingTeam = log.routingTeam && log.routingTeam.trim() !== '';
    
    if (isActionRequired && hasRoutingTeam) {
      return false; // Exclude routed "Action is required" logs
    }
    
    // Exclude "Site observation updated" logs (but allow "Site Observation - Resolved")
    const isSiteObservationUpdated = actionLower.includes('site observation updated') && 
                                      !actionLower.includes('resolved');
    
    if (isSiteObservationUpdated) {
      return false; // Exclude "Site observation updated" logs
    }
    
    const matchesSearch = !searchQuery || 
      Object.values(log).some(value => 
        String(value || '').toLowerCase().includes(searchQuery.toLowerCase())
      );
    
    const matchesAction = !filterAction || 
      (log.action && log.action.toLowerCase().includes(filterAction.toLowerCase()));
    
    // Date range filtering
    let matchesDateRange = true;
    if (timeRange) {
      const { fromDate, toDate } = getDateRange();
      // Use date field if available, otherwise parse from timestamp
      const logDate = log.date || (log.timestamp ? new Date(log.timestamp).toISOString().split('T')[0] : '');
      if (fromDate && logDate) {
        matchesDateRange = new Date(logDate) >= new Date(fromDate);
      }
      if (toDate && matchesDateRange && logDate) {
        matchesDateRange = new Date(logDate) <= new Date(toDate);
      }
    }
    
    return matchesSearch && matchesDateRange && matchesAction;
  });

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / rowsPerPage));
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [rowsPerPage, searchQuery, timeRange, filterDateFrom, filterDateTo, filterAction]);

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const formatTime = (timeString: string) => {
    try {
      const [hours, minutes] = timeString.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    } catch {
      return timeString;
    }
  };

  const downloadCSV = () => {
    const headers = ['Date', 'Time', 'Site Code', 'Action', 'Type of Issue', 'Routing Team', 'Remarks', 'Status'];
    const csvRows = [headers.join(',')].concat(
      filteredLogs.map((log) => {
        // Format action with user name for routing actions
        const actionText = log.action || '';
        const isRoutedAction = actionText.toLowerCase().includes('routed to') || 
                              actionText.toLowerCase().includes('auto-routed');
        const displayAction = isRoutedAction && log.userName 
          ? `${log.userName} ${actionText}` 
          : actionText;
        
        return [
          log.date,
          log.time,
          `"${String(log.siteCode || '').replace(/"/g,'""')}"`,
          `"${String(displayAction).replace(/"/g,'""')}"`,
          `"${String(log.typeOfIssue || '').replace(/"/g,'""')}"`,
          `"${String(log.routingTeam || '').replace(/"/g,'""')}"`,
          `"${String(log.remarks || '').replace(/"/g,'""')}"`,
          `"${String(log.status || '').replace(/"/g,'""')}"`
        ].join(',');
      })
    );
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `my-logs-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadXLSX = () => {
    const headers = ['Date', 'Time', 'Site Code', 'Action', 'Type of Issue', 'Routing Team', 'Remarks', 'Status'];
    const aoa = [
      headers,
      ...filteredLogs.map((log) => {
        // Format action with user name for routing actions
        const actionText = log.action || '';
        const isRoutedAction = actionText.toLowerCase().includes('routed to') || 
                              actionText.toLowerCase().includes('auto-routed');
        const displayAction = isRoutedAction && log.userName 
          ? `${log.userName} ${actionText}` 
          : actionText;
        
        return [
          log.date,
          log.time,
          log.siteCode || '',
          displayAction,
          log.typeOfIssue || '',
          log.routingTeam || '',
          log.remarks || '',
          log.status || ''
        ];
      })
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Activity Logs');
    XLSX.writeFile(wb, `my-logs-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const downloadPDF = () => {
    const w = window.open('', '_blank');
    if (!w) return;

    const userName = user?.fullName || user?.userId || 'Unknown User';
    const userRole = user?.role || 'Unknown Role';
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
        font-size: 9px; 
        word-wrap: break-word; 
        white-space: normal; 
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
      .footer {
        margin-top: 10px;
        padding-top: 8px;
        border-top: 2px solid #3b82f6;
        font-size: 9px;
        color: #64748b;
        text-align: center;
      }
    `;

    const headers = ['Date', 'Time', 'Site Code', 'Action', 'Type of Issue', 'Routing Team', 'Remarks', 'Status'];
    const thead = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
    const tbody = filteredLogs.map((log, idx) => {
      const isEven = idx % 2 === 0;
      // Format action with user name for routing actions
      const actionText = log.action || '';
      const isRoutedAction = actionText.toLowerCase().includes('routed to') || 
                            actionText.toLowerCase().includes('auto-routed');
      const displayAction = isRoutedAction && log.userName 
        ? `${log.userName} ${actionText}` 
        : actionText;
      
      return `<tr style="background-color: ${isEven ? '#f0f9ff' : '#ffffff'}">${[
        log.date,
        log.time,
        log.siteCode || '',
        displayAction,
        log.typeOfIssue || '',
        log.routingTeam || '',
        log.remarks || '',
        log.status || ''
      ].map(cell => `<td>${String(cell)}</td>`).join('')}</tr>`;
    }).join('');

    w.document.write(`
      <html>
        <head>
          <title>MY LOGS Export</title>
          <meta charset="utf-8" />
          <style>${styles}</style>
        </head>
        <body>
          <div class="header-section">
            <h3>MY LOGS Export</h3>
            <div class="meta">Date: ${downloadTime}</div>
            <div class="user-info">
              <strong>Exported by:</strong> ${userName} &nbsp;|&nbsp; 
              <strong>Role:</strong> ${userRole} &nbsp;|&nbsp; 
              <strong>Total Records:</strong> ${filteredLogs.length}
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead>${thead}</thead>
              <tbody>${tbody}</tbody>
            </table>
          </div>
          <div class="footer">
            Generated on ${downloadTime} | ${userName} (${userRole}) | Total Records: ${filteredLogs.length}
          </div>
        </body>
      </html>
    `);
    w.document.close();
    w.focus();
    w.print();
  };

  const handleDownloadSelect = (val: string) => {
    if (!val) return;
    if (val === 'pdf') downloadPDF();
    if (val === 'xlsx') downloadXLSX();
    if (val === 'csv') downloadCSV();
  };

  const clearAllLogs = () => {
    if (confirm('Are you sure you want to clear all logs? This action cannot be undone.')) {
      try {
        const userId = user?.userId || user?.userId || 'unknown';
        const storageKey = `activityLogs_${userId}`;
        localStorage.removeItem(storageKey);
        setLogs([]);
        alert('All logs have been cleared.');
      } catch (error) {
        console.error('Error clearing logs:', error);
        alert('Failed to clear logs.');
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading logs...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackButton />
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">MY LOGS</h2>
        <div className="flex gap-2">
          <button
            onClick={clearAllLogs}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
          >
            Clear All Logs
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className={`grid grid-cols-1 gap-4 ${timeRange === 'Customized Date Range' ? 'md:grid-cols-6' : 'md:grid-cols-4'}`}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Time Range</label>
            <select
              value={timeRange}
              onChange={(e) => {
                setTimeRange(e.target.value);
                if (e.target.value !== 'Customized Date Range') {
                  setFilterDateFrom('');
                  setFilterDateTo('');
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
            >
              <option value="">All Time</option>
              <option value="This Day">This Day</option>
              <option value="This Week">This Week</option>
              <option value="This Month">This Month</option>
              <option value="Customized Date Range">Customized Date Range</option>
            </select>
          </div>
          {timeRange === 'Customized Date Range' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                />
              </div>
            </>
          )}
          {timeRange !== 'Customized Date Range' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Action Type</label>
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
              >
                <option value="">All Actions</option>
                <option value="routed">Routed</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
          )}
          {timeRange === 'Customized Date Range' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Action Type</label>
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
              >
                <option value="">All Actions</option>
                <option value="routed">Routed</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
          )}
          <div className="flex items-end">
            <label className="block text-sm font-medium text-gray-700 mb-1 mr-2">Download:</label>
            <select
              className="border border-gray-300 rounded px-2 py-2 min-w-[140px] bg-white text-sm"
              defaultValue=""
              onChange={(e) => { handleDownloadSelect(e.target.value); e.currentTarget.value = ''; }}
              disabled={filteredLogs.length === 0}
            >
              <option value="" disabled>Select format</option>
              <option value="pdf">PDF</option>
              <option value="xlsx">XLSX</option>
              <option value="csv">CSV</option>
            </select>
          </div>
        </div>
        {filteredLogs.length > 0 && (
          <div className="mt-2 text-sm text-gray-600">
            Showing {filteredLogs.length} of {logs.length} logs
            {timeRange && (
              <span className="ml-2">
                ({timeRange === 'This Day' && 'Today'}
                {timeRange === 'This Week' && 'This Week'}
                {timeRange === 'This Month' && 'This Month'}
                {timeRange === 'Customized Date Range' && `From ${filterDateFrom || 'N/A'} to ${filterDateTo || 'N/A'}`})
              </span>
            )}
          </div>
        )}
      </div>

      {/* Logs Table */}
      {filteredLogs.length === 0 ? (
        <div className="bg-white rounded-lg shadow-lg p-12 text-center">
          <div className="text-6xl mb-4">📋</div>
          <h3 className="text-2xl font-semibold text-gray-800 mb-2">No Logs Found</h3>
          <p className="text-gray-600">
            {logs.length === 0 
              ? 'You haven\'t performed any routing activities yet. Logs will appear here when you route actions.'
              : 'No logs match your search criteria. Try adjusting your filters.'}
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse border border-gray-300">
                <thead style={{ background: 'linear-gradient(to right, #2563eb, #1d4ed8)', position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-bold text-white uppercase tracking-wider border border-gray-300" style={{ position: 'sticky', top: 0, background: 'linear-gradient(to right, #2563eb, #1d4ed8)' }}>
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-white uppercase tracking-wider border border-gray-300" style={{ position: 'sticky', top: 0, background: 'linear-gradient(to right, #2563eb, #1d4ed8)' }}>
                      Time
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-white uppercase tracking-wider border border-gray-300" style={{ position: 'sticky', top: 0, background: 'linear-gradient(to right, #2563eb, #1d4ed8)' }}>
                      Site Code
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-white uppercase tracking-wider border border-gray-300" style={{ position: 'sticky', top: 0, background: 'linear-gradient(to right, #2563eb, #1d4ed8)' }}>
                      Action
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-white uppercase tracking-wider border border-gray-300" style={{ position: 'sticky', top: 0, background: 'linear-gradient(to right, #2563eb, #1d4ed8)' }}>
                      Type of Issue
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-white uppercase tracking-wider border border-gray-300" style={{ position: 'sticky', top: 0, background: 'linear-gradient(to right, #2563eb, #1d4ed8)' }}>
                      Routing Team
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-white uppercase tracking-wider border border-gray-300" style={{ position: 'sticky', top: 0, background: 'linear-gradient(to right, #2563eb, #1d4ed8)' }}>
                      Remarks
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-white uppercase tracking-wider border border-gray-300" style={{ position: 'sticky', top: 0, background: 'linear-gradient(to right, #2563eb, #1d4ed8)' }}>
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-white uppercase tracking-wider border border-gray-300" style={{ position: 'sticky', top: 0, background: 'linear-gradient(to right, #2563eb, #1d4ed8)' }}>
                      Photos
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {paginatedLogs.map((log, index) => (
                    <tr
                      key={log.id}
                      className="border-b border-gray-200 transition-colors duration-150 hover:cursor-pointer"
                      style={{
                        backgroundColor: index % 2 === 0 ? '#ffffff' : '#eff6ff',
                        transition: 'background-color 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#bfdbfe';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = index % 2 === 0 ? '#ffffff' : '#eff6ff';
                      }}
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 border border-gray-300">
                        {formatDate(log.date)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 border border-gray-300">
                        {formatTime(log.time)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 border border-gray-300">
                        {log.siteCode || '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 border border-gray-300">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                          {(() => {
                            // Check if action contains "Routed to" or "Auto-routed"
                            const actionText = log.action || '';
                            const isRoutedAction = actionText.toLowerCase().includes('routed to') || 
                                                  actionText.toLowerCase().includes('auto-routed');
                            
                            // If it's a routing action and we have userName, prepend it
                            if (isRoutedAction && log.userName) {
                              return `${log.userName} ${actionText}`;
                            }
                            
                            // Otherwise return action as is
                            return actionText;
                          })()}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 border border-gray-300">
                        {log.typeOfIssue || '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 border border-gray-300">
                        {log.routingTeam || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 border border-gray-300 max-w-xs">
                        <div className="truncate" title={log.remarks || ''}>
                          {log.remarks || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap border border-gray-300">
                        {log.status ? (
                          <span className={`px-2 py-1 text-xs font-semibold rounded ${
                            log.status === 'Completed' ? 'bg-green-100 text-green-800' :
                            log.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {log.status}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 border border-gray-300 text-center">
                        {log.photosCount && log.photosCount > 0 ? (
                          <button
                            onClick={() => {
                              // Get photos from log entry or use photosCount as fallback
                              const photos = log.photos && log.photos.length > 0 
                                ? log.photos 
                                : null;
                              
                              if (photos && photos.length > 0) {
                                setSelectedLogPhotos(photos);
                                setShowPhotoModal(true);
                              } else {
                                // If photos not stored, try to open in new window with message
                                alert('Photos are not available for this log entry. Photos are only available for logs created after this update.');
                              }
                            }}
                            className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium hover:bg-purple-200 cursor-pointer transition-colors"
                            title="Click to view photos"
                          >
                            {log.photosCount}
                          </button>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {filteredLogs.length > 0 && (
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-4">
                <button
                  className="bg-gray-200 px-4 py-1 rounded disabled:opacity-50 border border-gray-300"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <span className="font-medium text-gray-700">
                  Page {currentPage} of {totalPages} ({filteredLogs.length} total)
                </span>
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
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
          )}
        </>
      )}

      {/* Photo Viewer Modal */}
      {showPhotoModal && selectedLogPhotos && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 z-[200] flex items-center justify-center"
          style={{ padding: '20px' }}
          onClick={() => {
            setShowPhotoModal(false);
            setSelectedLogPhotos(null);
          }}
        >
          <div 
            className="bg-white rounded-lg shadow-xl p-5 flex flex-col"
            style={{ maxWidth: '90vw', maxHeight: '90vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">Photos ({selectedLogPhotos.length})</h3>
              <button
                onClick={() => {
                  setShowPhotoModal(false);
                  setSelectedLogPhotos(null);
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
                style={{ lineHeight: '1' }}
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <div className="flex flex-col gap-4 items-center">
                {selectedLogPhotos.map((photo, idx) => (
                  <div key={idx} className="w-full flex flex-col items-center">
                    {selectedLogPhotos.length > 1 && (
                      <div className="text-sm text-gray-600 mb-2">
                        Photo {idx + 1} of {selectedLogPhotos.length}
                      </div>
                    )}
                    <img
                      src={photo}
                      alt={`Photo ${idx + 1}`}
                      style={{
                        maxWidth: '100%',
                        maxHeight: '70vh',
                        objectFit: 'contain',
                        borderRadius: '8px',
                        boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
                      }}
                    />
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => {
                          // Open photo in new window for full view
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
                          // Download individual photo
                          const link = document.createElement('a');
                          link.href = photo;
                          link.download = `photo_log_${idx + 1}.jpg`;
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
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

