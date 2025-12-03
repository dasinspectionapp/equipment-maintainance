import { useEffect, useState } from 'react';
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

function normalize(str: string): string {
  return str.trim().toLowerCase();
}

type FilterDef = { label: string; keys: string[] };
const FILTER_DEFS: FilterDef[] = [
  { label: "DIVISION", keys: ["DIVISION", "DIVISION NAME", "DIVISIONNAME"] },
  { label: "SUB DIVISION", keys: ["SUB DIVISION", "SUBDIVISION"] },
  { label: "DEVICE STATUS", keys: ["DEVICE STATUS", "DEVICE_STATUS"] },
  { label: "PRODUCTION OBSERVATIONS", keys: ["PRODUCTION OBSERVATIONS", "PRODUCTION_OBSERVATIONS", "PRODUCTIONOBSERVATIONS", "PRODUCTION OBSERVATION"] },
];

export default function MyDataFiltered() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(PAGE_SIZE_OPTIONS[0]);
  const [user, setUser] = useState<any>(getCurrentUser());
  const userRole = user?.role || '';
  const userDivisions = user?.division || [];
  const [filters, setFilters] = useState<Record<string, string>>({});

  // Fetch fresh user data if divisions are missing
  useEffect(() => {
    const currentDivisions = user?.division || [];
    if (userRole === 'Equipment' && (!currentDivisions || currentDivisions.length === 0)) {
      const token = localStorage.getItem('token');
      if (token) {
        console.log('MY DATA - Divisions missing, fetching fresh user profile...');
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
            console.log('MY DATA - Refreshed user data with divisions:', freshUser.division);
          }
        })
        .catch(err => console.error('MY DATA - Failed to fetch user profile:', err));
      }
    }
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
          const files = (json.files || []).map((f: any) => ({
            id: f.fileId,
            name: f.name,
            size: f.size || 0,
            type: f.type || '',
            uploadedAt: f.uploadedAt || f.createdAt,
          }));
          setUploadedFiles(files);
          // Auto-select the first file if available
          if (files.length > 0) {
            setSelectedFile(files[0].id);
          }
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!selectedFile) {
        setRows([]);
        setHeaders([]);
        return;
      }
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`http://localhost:5000/api/uploads/${selectedFile}`, {
          headers: {
            'Authorization': token ? `Bearer ${token}` : ''
          }
        });
        const json = await res.json();
        if (json?.success && json.file) {
          const file = json.file;
          const fileRows = Array.isArray(file.rows) ? file.rows : [];
          
          // Get headers first
          let hdrs = file.headers && file.headers.length ? file.headers : (fileRows[0] ? Object.keys(fileRows[0]) : []);
          
          // Find division key before filtering headers
          const divisionKey = hdrs.find((h: string) => {
            const norm = normalize(h);
            return norm === 'division' || norm === 'divisionname' || norm === 'division name';
          });

          // Remove unwanted columns (case-insensitive) - handles variations
          hdrs = hdrs.filter((h: string) => {
            const normalized = normalize(h);
            
            // Remove CIRCLE
            if (normalized === 'circle') return false;
            
            // Remove DEVICE TYPE
            if ((normalized.includes('device') && normalized.includes('type')) || 
                normalized === 'devicetype' || normalized === 'device_type') return false;
            
            // Remove L/R Status (handles variations like "L/R Status", "LR Status", "L R Status", etc.)
            if ((normalized.includes('l') && normalized.includes('r') && normalized.includes('status')) ||
                normalized === 'lrstatus' || normalized === 'l_r_status' || normalized === 'l/rstatus' ||
                normalized === 'l/r status' || normalized === 'l r status') return false;
            
            // Remove RTU TRACKER OBSERVATION (handles variations)
            if ((normalized.includes('rtu') && normalized.includes('tracker') && normalized.includes('observation')) ||
                normalized === 'rtutrackeroservation' || normalized === 'rtu_tracker_observation' ||
                normalized === 'rtu tracker observation') return false;
            
            // Remove No of Days Offline (handles variations)
            if ((normalized.includes('days') && normalized.includes('offline')) ||
                normalized === 'noofdaysoffline' || normalized === 'no_of_days_offline' ||
                normalized === 'no of days offline' || normalized === 'numberofdaysoffline' ||
                normalized === 'number_of_days_offline' || normalized === 'number of days offline') return false;
            
            // Remove Field Remarks and Remarks columns
            if (normalized.includes('remark') || normalized === 'fieldremarks' || 
                normalized === 'field_remarks' || normalized === 'field remarks') return false;
            
            return true;
          });

          // Filter by user's assigned DIVISION for Equipment role
          let filteredRows = fileRows;
          if (userRole === 'Equipment' && userDivisions.length > 0 && divisionKey) {
            const beforeCount = filteredRows.length;
            console.log(`MY DATA - Applying division filter (Equipment role):`, {
              divisionKey,
              userDivisions,
              beforeCount
            });
            
            filteredRows = filteredRows.filter((row: any) => {
              const rowDivision = String(row[divisionKey] || '').trim();
              // Check if row's division matches any of user's assigned divisions (case-insensitive)
              const matches = userDivisions.some((div: string) => {
                const userDiv = normalize(String(div));
                const dataDiv = normalize(rowDivision);
                
                // Exact match
                if (userDiv === dataDiv) {
                  return true;
                }
                
                // Check if one contains the other (handles variations)
                const lengthDiff = Math.abs(userDiv.length - dataDiv.length);
                if (lengthDiff <= 1 && (userDiv.includes(dataDiv) || dataDiv.includes(userDiv))) {
                  return true;
                }
                
                return false;
              });
              return matches;
            });
            
            console.log(`MY DATA - Division filter applied: ${beforeCount} rows -> ${filteredRows.length} rows`);
          } else if (userRole === 'Equipment' && userDivisions.length === 0) {
            console.warn('MY DATA - Equipment user has no divisions assigned. User object:', user);
          }

          setRows(filteredRows);
          setHeaders(hdrs);
          setCurrentPage(1);
        }
      } catch {
        setRows([]);
        setHeaders([]);
      }
    })();
  }, [selectedFile, userRole, userDivisions, user]);

  // Build filter lists
  const resolvedKeys: Record<string, string | undefined> = {};
  FILTER_DEFS.forEach(def => {
    resolvedKeys[def.label] = headers.find(h => def.keys.map(normalize).includes(normalize(h)));
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
      if (!key) return true;
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

  // Downloads
  function downloadCSV() {
    if (!headers.length) return;
    const csvRows = [headers.join(',')].concat(
      sortedRows.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g,'""')}"`).join(','))
    );
    const blob = new Blob([csvRows.join('\n')], {type: 'text/csv'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = (uploadedFiles.find(f=>f.id===selectedFile)?.name||'data') + '.csv';
    link.click(); URL.revokeObjectURL(url);
  }

  function downloadXLSX() {
    if (!headers.length) return;
    const aoa = [headers, ...sortedRows.map(r => headers.map(h => r[h] ?? ''))];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.writeFile(wb, (uploadedFiles.find(f=>f.id===selectedFile)?.name||'data') + '.xlsx');
  }

  function downloadPDF() {
    if (!headers.length) return;
    const w = window.open('', '_blank');
    if (!w) return;

    const title = 'MY DATA Export';
    const fileName = (uploadedFiles.find(f=>f.id===selectedFile)?.name||'data');
    const colPercent = (100 / Math.max(1, headers.length)).toFixed(2);
    
    // Get user information
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
        <h2 className="text-2xl font-bold mb-2 text-gray-800">MY DATA</h2>
        <p className="text-gray-500">No files uploaded yet. Please upload from Upload tab.</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">MY DATA</h2>
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
              {headers.map(h => (
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
                {headers.map(h => {
                  // Handle SL NO column - calculate sequential number starting from 1
                  const normalizedH = normalize(h);
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
    </div>
  );
}

