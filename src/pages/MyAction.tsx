import { useEffect, useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { logActivity } from '../utils/activityLogger';
import { API_BASE } from '../utils/api';

// Helper function to add metadata overlay to captured photo
function addMetadataToPhoto(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, latitude?: number, longitude?: number, timestamp?: string, location?: string): void {
  const formattedTime = timestamp 
    ? new Date(timestamp).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      })
    : new Date().toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
  
  // Draw metadata overlay on the photo
  const padding = 10;
  const fontSize = Math.max(14, canvas.width / 40); // Responsive font size
  const lineHeight = fontSize * 1.4;
  const textX = padding;
  const textY = canvas.height - padding - (location ? lineHeight * 3 : lineHeight * 2);
  
  // Prepare text lines
  const timeText = `Time: ${formattedTime}`;
  const coordText = latitude && longitude 
    ? `Coordinates: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}` 
    : 'Coordinates: N/A';
  const locationText = location ? `Location: ${location}` : null;
  
  // Draw semi-transparent background for text
  const textWidth = Math.max(
    ctx.measureText(timeText).width,
    ctx.measureText(coordText).width,
    locationText ? ctx.measureText(locationText).width : 0
  ) + padding * 2;
  
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(
    textX - padding,
    textY - fontSize - padding,
    textWidth,
    (locationText ? lineHeight * 3 : lineHeight * 2) + padding * 2
  );
  
  // Draw text
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${fontSize}px Arial`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  
  ctx.fillText(timeText, textX, textY);
  ctx.fillText(coordText, textX, textY + lineHeight);
  if (locationText) {
    // Truncate location if too long
    const maxWidth = canvas.width - padding * 2;
    let displayLocation = locationText;
    if (ctx.measureText(displayLocation).width > maxWidth) {
      while (ctx.measureText(displayLocation + '...').width > maxWidth && displayLocation.length > 0) {
        displayLocation = displayLocation.slice(0, -1);
      }
      displayLocation += '...';
    }
    ctx.fillText(displayLocation, textX, textY + lineHeight * 2);
  }
}

interface ActionItem {
  _id: string;
  rowData: any;
  headers: string[];
  routing: string;
  typeOfIssue: string;
  remarks: string;
  photo?: string | string[];
  assignedToUserId: string;
  assignedToRole: string;
  assignedToDivision: string;
  assignedByUserId: string;
  status: 'Pending' | 'In Progress' | 'Completed';
  priority: 'High' | 'Medium' | 'Low';
  assignedDate: string;
  sourceFileId: string;
}

function getCurrentUser() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user || {};
  } catch {
    return {};
  }
}

interface User {
  userId: string;
  fullName: string;
  role: string;
  division: string[];
}

export default function MyAction() {
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [headers, setHeaders] = useState<string[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [reroutingActionId, setReroutingActionId] = useState<string | null>(null);
  const [showRerouteModal, setShowRerouteModal] = useState(false);
  const [selectedRerouteUser, setSelectedRerouteUser] = useState<{userId: string, role: string} | null>(null);
  const [rerouteModalData, setRerouteModalData] = useState({
    remarks: '',
    capturedPhotos: [] as string[],
    uploadedPhotos: [] as File[]
  });
  const [showCameraPreview, setShowCameraPreview] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedImageData, setCapturedImageData] = useState<string | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const [isRerouteSubmitting, setIsRerouteSubmitting] = useState(false);
  const user = getCurrentUser();

  // Handle camera stream
  useEffect(() => {
    if (cameraStream && showCameraPreview) {
      const video = document.getElementById('camera-preview-video-reroute') as HTMLVideoElement;
      if (video) {
        video.srcObject = cameraStream;
        video.play().catch(err => console.error('Error playing video:', err));
      }
      cameraStreamRef.current = cameraStream;
    }
    
    return () => {
      if (!showCameraPreview && cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach(track => track.stop());
        cameraStreamRef.current = null;
        setCameraStream(null);
      }
    };
  }, [cameraStream, showCameraPreview]);

  // Fetch users for rerouting
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        
        const response = await fetch(`${API_BASE}/api/auth/users`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const result = await response.json();
          if (result.success && Array.isArray(result.data)) {
            setUsers(result.data);
          }
        }
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };
    
    fetchUsers();
  }, []);

  // Fetch actions assigned to current user
  useEffect(() => {
    const fetchActions = async () => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('Authentication required. Please login again.');
        }

        const params = new URLSearchParams();

        const response = await fetch(`${API_BASE}/api/actions/my-actions?${params.toString()}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          // If 404, the route doesn't exist - this is expected if server wasn't restarted
          if (response.status === 404) {
            console.warn('API route not found. Make sure server has been restarted after adding action routes.');
            setActions([]);
            setHeaders([]);
            setIsLoading(false);
            return;
          }
          // Try to parse error response
          let errorMessage = 'Failed to fetch actions';
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch {
            errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          }
          throw new Error(errorMessage);
        }

        const data = await response.json();

        if (data.success && data.actions) {
          setActions(data.actions);
          
          // Extract headers from first action if available
          let extractedHeaders: string[] = [];
          if (data.actions.length > 0 && data.actions[0].headers && data.actions[0].headers.length > 0) {
            extractedHeaders = data.actions[0].headers;
          } else if (data.actions.length > 0 && data.actions[0].rowData) {
            // Fallback: derive headers from rowData keys
            extractedHeaders = Object.keys(data.actions[0].rowData);
          }
          
          // Remove specific columns: "Month of AMC First Half", "Month of AMC Second Half Year", and "Routings"
          const columnsToRemove = ['Month of AMC First Half', 'Month of AMC Second Half Year', 'Routings'];
          extractedHeaders = extractedHeaders.filter(header => !columnsToRemove.includes(header));
          
          setHeaders(extractedHeaders);
        } else {
          setActions([]);
          setHeaders([]);
        }
      } catch (error: any) {
        console.error('Error fetching actions:', error);
        console.error('Error details:', error.message);
        // Still show the page even if API call fails
        setActions([]);
        setHeaders([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchActions();
  }, []);

  // Search within actions
  const searchedActions = search
    ? actions.filter(action => {
        // Search in rowData fields
        if (action.rowData) {
          const matchesRowData = Object.values(action.rowData).some(val => 
            String(val || '').toLowerCase().includes(search.toLowerCase())
          );
          if (matchesRowData) return true;
        }
        // Search in other fields
        return (
          (action.routing && action.routing.toLowerCase().includes(search.toLowerCase())) ||
          (action.typeOfIssue && action.typeOfIssue.toLowerCase().includes(search.toLowerCase())) ||
          (action.remarks && action.remarks.toLowerCase().includes(search.toLowerCase())) ||
          (action.status && action.status.toLowerCase().includes(search.toLowerCase())) ||
          (action.priority && action.priority.toLowerCase().includes(search.toLowerCase()))
        );
      })
    : actions;

  // Sort actions by assignedDate descending (newest first)
  const sortedActions = [...searchedActions].sort((a, b) => {
    // If assignedDate exists, use it
    if (a.assignedDate && b.assignedDate) {
      return new Date(b.assignedDate).getTime() - new Date(a.assignedDate).getTime();
    }
    // If one has assignedDate, prioritize it
    if (a.assignedDate && !b.assignedDate) return -1;
    if (!a.assignedDate && b.assignedDate) return 1;
    // Fallback to _id (MongoDB ObjectIds contain timestamp)
    if (a._id && b._id) {
      return b._id.localeCompare(a._id); // ObjectIds are sortable chronologically
    }
    return 0;
  });

  const totalPages = Math.max(1, Math.ceil(sortedActions.length / rowsPerPage));
  const paginatedActions = sortedActions.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [rowsPerPage, search]);

  const getPriorityBadge = (priority?: string) => {
    switch (priority?.toLowerCase()) {
      case 'high':
        return <span className="px-2 py-1 bg-red-900 text-white rounded-full text-xs font-semibold">High</span>;
      case 'medium':
        return <span className="px-2 py-1 bg-orange-700 text-white rounded-full text-xs font-semibold">Medium</span>;
      case 'low':
        return <span className="px-2 py-1 bg-green-700 text-white rounded-full text-xs font-semibold">Low</span>;
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-semibold">-</span>;
    }
  };

  // Determine display headers - use headers from actions or fallback to rowData keys
  // Also filter out the columns to remove
  const columnsToRemove = ['Month of AMC First Half', 'Month of AMC Second Half Year', 'Routings'];
  const filteredHeaders = headers.length > 0 
    ? headers.filter(h => !columnsToRemove.includes(h))
    : (actions.length > 0 && actions[0].rowData 
        ? Object.keys(actions[0].rowData).filter(h => !columnsToRemove.includes(h))
        : []);
  
  const displayHeaders = [...filteredHeaders, 'Routing', 'Type of Issue', 'Remarks', 'View Photo', 'Priority', 'Status', 'Actions'];

  // Download functions
  function downloadCSV() {
    if (!filteredHeaders.length) return;
    const csvHeaders = [...filteredHeaders, 'Routing', 'Type of Issue', 'Remarks', 'View Photo', 'Priority', 'Status'];
    const csvRows = [csvHeaders.join(',')].concat(
      searchedActions.map((action) => {
        const rowData = action.rowData || {};
        return csvHeaders.map(h => {
          if (filteredHeaders.includes(h)) {
            return `"${String(rowData[h] ?? '').replace(/"/g,'""')}"`;
          } else if (h === 'Routing') {
            return `"${String(action.routing || '').replace(/"/g,'""')}"`;
          } else if (h === 'Type of Issue') {
            return `"${String(action.typeOfIssue || '').replace(/"/g,'""')}"`;
          } else if (h === 'Remarks') {
            return `"${String(action.remarks || '').replace(/"/g,'""')}"`;
          } else if (h === 'View Photo') {
            return `"${action.photo ? 'Photo Available' : 'No Photo'}"`;
          } else if (h === 'Priority') {
            return `"${String(action.priority || '').replace(/"/g,'""')}"`;
          } else if (h === 'Status') {
            return `"${String(action.status || '').replace(/"/g,'""')}"`;
          }
          return `""`;
        }).join(',');
      })
    );
    const blob = new Blob([csvRows.join('\n')], {type: 'text/csv'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; 
    link.download = 'my-actions.csv';
    link.click(); 
    URL.revokeObjectURL(url);
  }

  function downloadXLSX() {
    if (!filteredHeaders.length) return;
    const csvHeaders = [...filteredHeaders, 'Routing', 'Type of Issue', 'Remarks', 'View Photo', 'Priority', 'Status'];
    const aoa = [csvHeaders, ...searchedActions.map((action) => {
      const rowData = action.rowData || {};
      return csvHeaders.map(h => {
        if (filteredHeaders.includes(h)) {
          return rowData[h] ?? '';
        } else if (h === 'Routing') {
          return action.routing || '';
        } else if (h === 'Type of Issue') {
          return action.typeOfIssue || '';
        } else if (h === 'Remarks') {
          return action.remarks || '';
        } else if (h === 'View Photo') {
          return action.photo ? 'Photo Available' : 'No Photo';
        } else if (h === 'Priority') {
          return action.priority || '';
        } else if (h === 'Status') {
          return action.status || '';
        }
        return '';
      });
    })];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Actions');
    XLSX.writeFile(wb, 'my-actions.xlsx');
  }

  function downloadPDF() {
    if (!filteredHeaders.length) return;
    const w = window.open('', '_blank');
    if (!w) return;

    const title = 'My Action Export';
    const csvHeaders = [...filteredHeaders, 'Routing', 'Type of Issue', 'Remarks', 'View Photo', 'Priority', 'Status'];
    const colPercent = (100 / Math.max(1, csvHeaders.length)).toFixed(2);
    
    // Get user information
    const userName = user?.fullName || user?.userId || 'Unknown User';
    const userRole = user?.role || 'Unknown Role';
    const userDesignation = user?.designation || 'N/A';
    const userCircle = Array.isArray(user?.circle) && user.circle.length > 0 
      ? user.circle.join(', ') 
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

    const thead = `<tr>${csvHeaders.map(h=>`<th>${h}</th>`).join('')}</tr>`;
    const tbody = searchedActions.map((action, idx)=>{
      const rowData = action.rowData || {};
      const isEven = idx % 2 === 0;
      return `<tr style="background-color: ${isEven ? '#f0f9ff' : '#ffffff'}">${csvHeaders.map(h=>{
        if (filteredHeaders.includes(h)) {
          return `<td>${String(rowData[h]??'')}</td>`;
        } else if (h === 'Routing') {
          return `<td>${String(action.routing || '')}</td>`;
        } else if (h === 'Type of Issue') {
          return `<td>${String(action.typeOfIssue || '')}</td>`;
        } else if (h === 'Remarks') {
          return `<td>${String(action.remarks || '')}</td>`;
        } else if (h === 'View Photo') {
          return `<td>${action.photo ? 'Photo Available' : 'No Photo'}</td>`;
        } else if (h === 'Priority') {
          return `<td>${String(action.priority || '')}</td>`;
        } else if (h === 'Status') {
          return `<td>${String(action.status || '')}</td>`;
        }
        return `<td></td>`;
      }).join('')}</tr>`;
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

  const handleReroute = async (actionId: string, assignedToUserId: string, assignedToRole: string, rerouteRemarks?: string, reroutePhotos?: string[]) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${API_BASE}/api/actions/${actionId}/reroute`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          assignedToUserId, 
          assignedToRole,
          remarks: rerouteRemarks || '',
          photo: reroutePhotos || null
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reroute');
      }

      // Remove the action from local state since it's no longer assigned to current user
      setActions(prev => prev.filter(action => action._id !== actionId));

      setReroutingActionId(null);
      setShowRerouteModal(false);
      setSelectedRerouteUser(null);
      setRerouteModalData({ remarks: '', capturedPhotos: [], uploadedPhotos: [] });
      alert(data.message || 'Action rerouted successfully!');
    } catch (error: any) {
      console.error('Error rerouting:', error);
      alert(error.message || 'Failed to reroute');
      setReroutingActionId(null);
      setShowRerouteModal(false);
      setSelectedRerouteUser(null);
      setRerouteModalData({ remarks: '', capturedPhotos: [], uploadedPhotos: [] });
    }
  };

  const handleStatusUpdate = async (actionId: string, newStatus: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      // Find the action being updated to get its details for logging
      const actionToUpdate = actions.find(a => a._id === actionId);
      if (!actionToUpdate) {
        throw new Error('Action not found');
      }

      const response = await fetch(`${API_BASE}/api/actions/${actionId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update status');
      }

      // Update local state
      setActions(prev => prev.map(action => 
        action._id === actionId 
          ? { ...action, status: newStatus as any }
          : action
      ));

      // Log activity when action is resolved/completed
      if (newStatus === 'Completed') {
        // Extract site code from rowData
        const siteCode = actionToUpdate.rowData ? (
          actionToUpdate.rowData['Site Code'] || 
          actionToUpdate.rowData['SITE CODE'] || 
          actionToUpdate.rowData['Code'] ||
          actionToUpdate.rowData['CODE'] ||
          actionToUpdate.rowData['SiteCode'] ||
          ''
        ) : '';

        // Extract site name from rowData
        const siteName = actionToUpdate.rowData ? (
          actionToUpdate.rowData['Site Name'] || 
          actionToUpdate.rowData['SITE NAME'] || 
          actionToUpdate.rowData['SiteName'] ||
          actionToUpdate.rowData['Name'] ||
          ''
        ) : '';

        // Generate row key for logging (using action ID and source file ID)
        const rowKey = actionToUpdate.sourceFileId && actionToUpdate._id
          ? `${actionToUpdate.sourceFileId}_${actionToUpdate._id}`
          : undefined;

        // Count photos
        const photosCount = actionToUpdate.photo 
          ? (Array.isArray(actionToUpdate.photo) ? actionToUpdate.photo.length : 1)
          : 0;

        // Get photos from action
        const photos = actionToUpdate.photo 
          ? (Array.isArray(actionToUpdate.photo) ? actionToUpdate.photo : [actionToUpdate.photo])
          : [];

        logActivity({
          action: 'Action Resolved',
          typeOfIssue: actionToUpdate.typeOfIssue || '',
          routingTeam: actionToUpdate.routing || undefined,
          remarks: actionToUpdate.remarks || '',
          siteName: String(siteName),
          siteCode: String(siteCode),
          rowKey: rowKey,
          sourceFileId: actionToUpdate.sourceFileId,
          photosCount: photosCount,
          photos: photos.length > 0 ? photos : undefined,
          status: 'Resolved',
          priority: actionToUpdate.priority || 'Medium'
        });
      }

      alert('Status updated successfully!');
    } catch (error: any) {
      console.error('Error updating status:', error);
      alert(error.message || 'Failed to update status');
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">Loading actions...</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">My Action</h2>
        <p className="text-gray-600">
          View and manage actions assigned to you ({user?.fullName || user?.userId || 'User'})
        </p>
      </div>

      {/* Controls Row */}
      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2 md:gap-4 items-center mb-3 whitespace-nowrap inline-flex">
          <input
            className="border border-gray-300 border-[1px] rounded px-2 py-1 flex-1 min-w-[120px]"
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {/* Download format select */}
          <label className="block font-medium text-gray-700">Download:</label>
          <select
            className="border border-gray-300 rounded px-2 py-2 min-w-[140px] bg-white"
            defaultValue=""
            onChange={e => { handleDownloadSelect(e.target.value); e.currentTarget.value = ''; }}
            disabled={!filteredHeaders.length || !searchedActions.length}
          >
            <option value="" disabled>Select format</option>
            <option value="pdf">PDF</option>
            <option value="xlsx">XLSX</option>
            <option value="csv">CSV</option>
          </select>
        </div>
      )}

      {/* Actions Table */}
      {searchedActions.length === 0 ? (
        <div className="bg-white rounded-lg shadow-lg p-12 text-center">
          <div className="text-6xl mb-4">⚡</div>
          <h3 className="text-2xl font-semibold text-gray-800 mb-2">No Actions Found</h3>
          <p className="text-gray-600">
            You don't have any actions assigned yet. Actions will appear here when they are routed to you.
          </p>
        </div>
      ) : (
        <>
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
                  {displayHeaders.map((header) => (
                    <th
                      key={header}
                      className="px-3 py-2 font-bold border border-gray-300 text-center"
                      style={{ fontFamily: 'Times New Roman, Times, serif', fontSize: 14, fontWeight: 'bold', textAlign: 'center', whiteSpace: 'pre-wrap', background: 'linear-gradient(90deg, #dbeafe 0%, #bae6fd 100%)', position: 'sticky', top: 0 }}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody style={{ fontFamily: 'Times New Roman, Times, serif', fontSize: 12 }}>
                {paginatedActions.map((action, idx) => {
                  const isEven = idx % 2 === 0;
                  
                  // Determine background color based on priority
                  let baseBackgroundColor = isEven ? '#f0f9ff' : '#ffffff';
                  const priority = (action.priority || 'Medium').toLowerCase();
                  
                  if (priority === 'high') {
                    baseBackgroundColor = isEven ? '#fee2e2' : '#fef2f2'; // Light red
                  } else if (priority === 'medium') {
                    baseBackgroundColor = isEven ? '#fed7aa' : '#fff7ed'; // Light orange
                  } else if (priority === 'low') {
                    baseBackgroundColor = isEven ? '#d1fae5' : '#f0fdf4'; // Light green
                  }
                  
                  return (
                    <tr 
                      key={action._id || idx} 
                      className="transition-colors duration-150"
                      style={{ 
                        backgroundColor: baseBackgroundColor,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#93c5fd';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = baseBackgroundColor;
                      }}
                    >
                      {/* Render row data columns */}
                      {filteredHeaders.length > 0 ? filteredHeaders.map((header) => {
                        // Handle SL NO column - calculate sequential number starting from 1
                        const normalizedH = header.trim().toLowerCase();
                        if (normalizedH === 'slno' || normalizedH === 'sl_no' || normalizedH === 'sl no' || 
                            normalizedH === 's.no' || normalizedH === 's no' || normalizedH === 'serial' || 
                            normalizedH === 'serialno' || normalizedH === 'serial_no' || normalizedH === 'serial no' ||
                            (normalizedH.includes('sl') && normalizedH.includes('no'))) {
                          const slNo = (currentPage - 1) * rowsPerPage + idx + 1;
                          return (
                            <td
                              key={header}
                              className="px-3 py-1 border border-gray-300 text-black text-center"
                              style={{ fontFamily: 'Times New Roman, Times, serif', fontSize: 12, textAlign: 'center', whiteSpace: 'pre-wrap', color: '#000000' }}
                            >
                              {slNo}
                            </td>
                          );
                        }
                        return (
                          <td
                            key={header}
                            className="px-3 py-1 border border-gray-300 text-black text-center"
                            style={{ fontFamily: 'Times New Roman, Times, serif', fontSize: 12, textAlign: 'center', whiteSpace: 'pre-wrap', color: '#000000' }}
                          >
                            {String(action.rowData?.[header] ?? '')}
                          </td>
                        );
                      }) : action.rowData ? Object.keys(action.rowData).filter(key => !columnsToRemove.includes(key)).map((key) => {
                        // Handle SL NO column - calculate sequential number starting from 1
                        const normalizedH = key.trim().toLowerCase();
                        if (normalizedH === 'slno' || normalizedH === 'sl_no' || normalizedH === 'sl no' || 
                            normalizedH === 's.no' || normalizedH === 's no' || normalizedH === 'serial' || 
                            normalizedH === 'serialno' || normalizedH === 'serial_no' || normalizedH === 'serial no' ||
                            (normalizedH.includes('sl') && normalizedH.includes('no'))) {
                          const slNo = (currentPage - 1) * rowsPerPage + idx + 1;
                          return (
                            <td
                              key={key}
                              className="px-3 py-1 border border-gray-300 text-black text-center"
                              style={{ fontFamily: 'Times New Roman, Times, serif', fontSize: 12, textAlign: 'center', whiteSpace: 'pre-wrap', color: '#000000' }}
                            >
                              {slNo}
                            </td>
                          );
                        }
                        return (
                          <td
                            key={key}
                            className="px-3 py-1 border border-gray-300 text-black text-center"
                            style={{ fontFamily: 'Times New Roman, Times, serif', fontSize: 12, textAlign: 'center', whiteSpace: 'pre-wrap', color: '#000000' }}
                          >
                            {String(action.rowData[key] ?? '')}
                          </td>
                        );
                      }) : null}
                      
                      {/* Additional columns */}
                      <td
                        className="px-3 py-1 border border-gray-300 text-black text-center"
                        style={{ fontFamily: 'Times New Roman, Times, serif', fontSize: 12, textAlign: 'center', whiteSpace: 'pre-wrap', color: '#000000' }}
                      >
                        {action.routing || ''}
                      </td>
                      <td
                        className="px-3 py-1 border border-gray-300 text-black text-center"
                        style={{ fontFamily: 'Times New Roman, Times, serif', fontSize: 12, textAlign: 'center', whiteSpace: 'pre-wrap', color: '#000000' }}
                      >
                        {action.typeOfIssue || ''}
                      </td>
                      <td
                        className="px-3 py-1 border border-gray-300 text-black text-center"
                        style={{ fontFamily: 'Times New Roman, Times, serif', fontSize: 12, textAlign: 'center', whiteSpace: 'pre-wrap', color: '#000000' }}
                      >
                        {action.remarks || ''}
                      </td>
                      <td
                        className="px-3 py-1 border border-gray-300 text-black text-center"
                        style={{ fontFamily: 'Times New Roman, Times, serif', fontSize: 12, textAlign: 'center', whiteSpace: 'pre-wrap', color: '#000000' }}
                      >
                        {action.photo ? (
                          <button
                            onClick={() => {
                              const newWindow = window.open('', '_blank');
                              if (newWindow) {
                                // Normalize photos to array and filter out undefined values
                                const photos = (Array.isArray(action.photo) ? action.photo : [action.photo]).filter((photo): photo is string => typeof photo === 'string');
                                
                                newWindow.document.write(`
                                  <html>
                                    <head>
                                      <title>Photo Preview</title>
                                      <style>
                                        body { margin: 0; padding: 20px; display: flex; flex-direction: column; gap: 20px; justify-content: center; align-items: center; min-height: 100vh; background-color: #f0f0f0; }
                                        img { max-width: 100%; max-height: 80vh; box-shadow: 0 4px 8px rgba(0,0,0,0.1); border-radius: 8px; }
                                        .photo-container { margin-bottom: 20px; }
                                        .photo-counter { margin-bottom: 10px; font-size: 14px; color: #666; }
                                      </style>
                                    </head>
                                    <body>
                                      ${photos.map((photo: string, idx: number) => `
                                        <div class="photo-container">
                                          ${photos.length > 1 ? `<div class="photo-counter">Photo ${idx + 1} of ${photos.length}</div>` : ''}
                                          <img src="${photo}" alt="Photo ${idx + 1}" />
                                        </div>
                                      `).join('')}
                                    </body>
                                  </html>
                                `);
                                newWindow.document.close();
                              }
                            }}
                            className="text-blue-600 hover:text-blue-800 underline cursor-pointer"
                            style={{ fontFamily: 'Times New Roman, Times, serif', fontSize: 12 }}
                          >
                            {Array.isArray(action.photo) 
                              ? `View Photo${action.photo.length > 1 ? `s (${action.photo.length})` : ''}`
                              : 'View Photo'}
                          </button>
                        ) : '-'}
                      </td>
                      <td
                        className="px-3 py-1 border border-gray-300 text-center"
                        style={{ fontFamily: 'Times New Roman, Times, serif', fontSize: 12, textAlign: 'center', whiteSpace: 'pre-wrap' }}
                      >
                        {getPriorityBadge(action.priority)}
                      </td>
                      <td
                        className="px-3 py-1 border border-gray-300 text-black text-center"
                        style={{ fontFamily: 'Times New Roman, Times, serif', fontSize: 12, textAlign: 'center', whiteSpace: 'pre-wrap', color: '#000000' }}
                      >
                        {action.status || ''}
                      </td>
                      <td
                        className="px-3 py-1 border border-gray-300 text-center"
                        style={{ fontFamily: 'Times New Roman, Times, serif', fontSize: 12 }}
                      >
                        <select
                          value={action.status}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === 'reroute') {
                              setReroutingActionId(action._id);
                              setShowRerouteModal(true);
                            } else {
                              handleStatusUpdate(action._id, value);
                            }
                          }}
                          className="w-full px-2 py-1 border-0 rounded text-sm text-black bg-transparent focus:outline-none"
                          style={{ fontFamily: 'Times New Roman, Times, serif', fontSize: 12, color: '#000000' }}
                        >
                          <option value="Pending">Pending</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Completed">Completed</option>
                          <option value="reroute">--- Reroute ---</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {searchedActions.length > 0 && (
            <div className="flex flex-col items-center gap-2 mt-6">
              <div className="flex items-center gap-4">
                <button 
                  className="bg-gray-200 px-4 py-1 rounded disabled:opacity-50 border border-gray-300" 
                  disabled={currentPage === 1} 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <span className="font-medium text-gray-700">Page {currentPage} of {totalPages} ({searchedActions.length} total)</span>
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

      {/* Reroute Modal */}
      {showRerouteModal && reroutingActionId && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-center justify-center"
          style={{ padding: '20px' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowRerouteModal(false);
              setReroutingActionId(null);
              setSelectedRerouteUser(null);
              setRerouteModalData({ remarks: '', capturedPhotos: [], uploadedPhotos: [] });
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
              <h3 className="text-lg font-bold text-gray-800 text-center">Reroute Action</h3>
    </div>
            
            {/* Scrollable Content Area */}
            <div 
              className="px-5 overflow-y-auto overflow-x-hidden flex-grow"
              style={{ 
                maxHeight: 'calc(100vh - 200px)',
                minHeight: 0
              }}
            >
              {/* Select User */}
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1.5 text-center">
                  Select User <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedRerouteUser ? `${selectedRerouteUser.userId}|${selectedRerouteUser.role}` : ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value) {
                      const [userId, role] = value.split('|');
                      setSelectedRerouteUser({ userId, role });
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="">Select User...</option>
                  {users.filter(u => {
                    const currentAction = actions.find(a => a._id === reroutingActionId);
                    if (!currentAction) return false;
                    
                    // Filter by same division
                    const actionDivision = currentAction.assignedToDivision || '';
                    if (!actionDivision) return false;
                    
                    // Check if user has the same division in their division array
                    const userHasDivision = u.division && Array.isArray(u.division) && u.division.length > 0;
                    if (!userHasDivision) return false;
                    
                    const hasMatchingDivision = u.division.some(div => 
                      div.toLowerCase() === actionDivision.toLowerCase()
                    );
                    
                    return hasMatchingDivision && u.userId !== currentAction.assignedToUserId;
                  }).map((u) => (
                    <option key={u.userId} value={`${u.userId}|${u.role}`}>
                      {u.fullName} ({u.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Remarks */}
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1.5 text-center">
                  Remarks
                </label>
                <textarea
                  value={rerouteModalData.remarks}
                  onChange={(e) => setRerouteModalData(prev => ({ ...prev, remarks: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
                  placeholder="Enter reroute remarks..."
                />
              </div>

              {/* Capture Photo and Upload Photo */}
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
                        setCameraStream(stream);
                        setShowCameraPreview(true);
                        setCapturedImageData(null);
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
                      border: 'none'
                    }}
                  >
                    Capture Photo
                  </button>
                  
                  <input
                    type="file"
                    id="upload-photo-reroute"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      if (files.length > 0) {
                        setRerouteModalData(prev => ({
                          ...prev,
                          uploadedPhotos: [...prev.uploadedPhotos, ...files]
                        }));
                      }
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                  <label
                    htmlFor="upload-photo-reroute"
                    style={{
                      backgroundColor: '#10b981',
                      color: '#ffffff',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      fontSize: '14px',
                      fontWeight: '600',
                      border: 'none'
                    }}
                  >
                    Upload Photo
                  </label>
                </div>
              </div>
              
              {/* Photo Preview Section */}
              <div className="mb-3">
                {(rerouteModalData.capturedPhotos.length > 0 || rerouteModalData.uploadedPhotos.length > 0) && (
                  <div className="w-full">
                    <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
                      Photos ({rerouteModalData.capturedPhotos.length + rerouteModalData.uploadedPhotos.length})
                    </label>
                    <div className="flex flex-wrap gap-2 justify-center max-h-40 overflow-y-auto p-2 border border-gray-200 rounded">
                      {rerouteModalData.capturedPhotos.map((photo, idx) => (
                        <div key={`captured-${idx}`} className="relative">
                          <img
                            src={photo}
                            alt={`Captured ${idx + 1}`}
                            className="w-16 h-16 object-cover rounded border border-gray-300"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setRerouteModalData(prev => ({
                                ...prev,
                                capturedPhotos: prev.capturedPhotos.filter((_, i) => i !== idx)
                              }));
                            }}
                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      {rerouteModalData.uploadedPhotos.map((photo, idx) => (
                        <div key={`uploaded-${idx}`} className="relative">
                          <img
                            src={URL.createObjectURL(photo)}
                            alt={photo.name}
                            className="w-16 h-16 object-cover rounded border border-gray-300"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setRerouteModalData(prev => ({
                                ...prev,
                                uploadedPhotos: prev.uploadedPhotos.filter((_, i) => i !== idx)
                              }));
                            }}
                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
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
            
            {/* Buttons */}
            <div 
              className="px-5 pb-5 pt-4 border-t-2 border-gray-300 bg-gray-50 flex justify-end flex-shrink-0 gap-2"
            >
              <button
                type="button"
                onClick={() => {
                  setShowRerouteModal(false);
                  setReroutingActionId(null);
                  setSelectedRerouteUser(null);
                  setRerouteModalData({ remarks: '', capturedPhotos: [], uploadedPhotos: [] });
                }}
                style={{
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (isRerouteSubmitting) return;
                  
                  if (!selectedRerouteUser) {
                    alert('Please select a user');
                    return;
                  }

                  setIsRerouteSubmitting(true);

                  // Give React time to update the UI
                  setTimeout(async () => {
                    try {
                      // Prepare photo data
                      let photoData: string[] = [];
                      
                      if (rerouteModalData.capturedPhotos && rerouteModalData.capturedPhotos.length > 0) {
                        photoData = [...photoData, ...rerouteModalData.capturedPhotos];
                      }
                      
                      if (rerouteModalData.uploadedPhotos && rerouteModalData.uploadedPhotos.length > 0) {
                        const uploadedBase64 = await Promise.all(
                          rerouteModalData.uploadedPhotos.map(file =>
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
                      
                      const photosToSend = photoData.length > 0 ? photoData : undefined;

                      await handleReroute(
                        reroutingActionId,
                        selectedRerouteUser.userId,
                        selectedRerouteUser.role,
                        rerouteModalData.remarks,
                        photosToSend
                      );
                    } finally {
                      setIsRerouteSubmitting(false);
                    }
                  }, 0);
                }}
                style={{
                  backgroundColor: '#3b82f6',
                  color: '#ffffff',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: isRerouteSubmitting ? 'not-allowed' : 'pointer',
                  opacity: isRerouteSubmitting ? 0.7 : 1
                }}
                disabled={isRerouteSubmitting}
              >
                {isRerouteSubmitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera Preview Modal */}
      {showCameraPreview && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-80 z-[101] flex items-center justify-center"
          style={{ padding: '20px' }}
        >
          <div 
            className="bg-white rounded-lg shadow-xl p-5 flex flex-col"
            style={{ maxWidth: '90vw', maxHeight: '90vh' }}
          >
            <h3 className="text-lg font-bold text-gray-800 mb-4 text-center">Camera Preview</h3>
            <div className="flex-1 flex items-center justify-center mb-4">
              <video
                id="camera-preview-video-reroute"
                autoPlay
                playsInline
                style={{
                  maxWidth: '100%',
                  maxHeight: '60vh',
                  transform: 'scaleX(-1)'
                }}
              />
              {capturedImageData && (
                <img
                  src={capturedImageData}
                  alt="Captured"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '60vh',
                    transform: 'scaleX(-1)'
                  }}
                />
              )}
            </div>
            <div className="flex gap-2 justify-center">
              {!capturedImageData ? (
                <button
                  type="button"
                  onClick={async () => {
                    const video = document.getElementById('camera-preview-video-reroute') as HTMLVideoElement;
                    if (video && video.srcObject && video.videoWidth > 0 && video.videoHeight > 0) {
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
                        
                        // Draw metadata overlay on the photo
                        addMetadataToPhoto(canvas, ctx, latitude, longitude, timestamp, locationName);
                        
                        // Get the final image data with metadata overlay
                        const imageData = canvas.toDataURL('image/jpeg', 0.9);
                        setCapturedImageData(imageData);
                      }
                    }
                  }}
                  style={{
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Capture
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setRerouteModalData(prev => ({
                        ...prev,
                        capturedPhotos: [...prev.capturedPhotos, capturedImageData!]
                      }));
                      setShowCameraPreview(false);
                      setCapturedImageData(null);
                      if (cameraStreamRef.current) {
                        cameraStreamRef.current.getTracks().forEach(track => track.stop());
                        cameraStreamRef.current = null;
                      }
                      setCameraStream(null);
                    }}
                    style={{
                      backgroundColor: '#10b981',
                      color: '#ffffff',
                      padding: '10px 20px',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Use Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => setCapturedImageData(null)}
                    style={{
                      backgroundColor: '#6b7280',
                      color: '#ffffff',
                      padding: '10px 20px',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Retake
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowCameraPreview(false);
                  setCapturedImageData(null);
                  if (cameraStreamRef.current) {
                    cameraStreamRef.current.getTracks().forEach(track => track.stop());
                    cameraStreamRef.current = null;
                  }
                  setCameraStream(null);
                }}
                style={{
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
