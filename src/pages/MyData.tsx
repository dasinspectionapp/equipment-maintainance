import { useEffect, useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { logActivity } from '../utils/activityLogger';
import { loadUserDataState, loadAllUserDataStates, bulkSyncAllDataStates } from '../utils/dataSync';
import { API_BASE } from '../utils/api';

const PAGE_SIZE_OPTIONS = [25, 50, 75, 100];

// Helper function to add metadata overlay to captured photo
function addMetadataToPhoto(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, latitude?: number, longitude?: number, timestamp?: string, location?: string): void {
  const formattedTime = timestamp 
    ? new Date(timestamp).toLocaleString('en-IN`, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      })
    : new Date().toLocaleString('en-IN`, {
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

function getCurrentUserRole() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user?.role || '';
  } catch {
    return '';
  }
}

// Role to Team Name mapping (reverse of TEAM_TO_ROLE)
const ROLE_TO_TEAM: Record<string, string> = {
  'Equipment': 'Equipment Team',
  'RTU/Communication': 'RTU/Communication Team',
  'AMC': 'AMC Team',
  'O&M': 'O&M Team',
  'Relay': 'Relay Team',
  'CCR': 'CCR Team',
  'System': 'System Team',
  "C&D": "C&D's Team"
};

function getTeamNameFromRole(role: string): string {
  return ROLE_TO_TEAM[role] || `${role} Team`;
}

function normalize(str: string): string {
  return str.trim().toLowerCase();
}

// Generate a stable row key based on headers and row data
function generateRowKey(fileId: string, row: any, headers: string[]): string {
  // For action rows, use sourceFileId if available
  const actualFileId = row._sourceFileId || fileId;
  
  // First try to use row.id if available
  if (row.id) {
    return `${actualFileId}-${row.id}`;
  }
  
  // Otherwise, use the first 3 header values in order (stable)
  if (headers.length >= 3) {
    const keyParts: string[] = [];
    for (let i = 0; i < Math.min(3, headers.length); i++) {
      const header = headers[i];
      const value = row[header] ?? '';
      keyParts.push(String(value));
    }
    if (keyParts.some(v => v)) {
      return `${actualFileId}-${keyParts.join('|')}`;
    }
  }
  
  // Fallback: use all header values
  const keyParts: string[] = [];
  headers.forEach(header => {
    const value = row[header] ?? '';
    keyParts.push(String(value));
  });
  return `${actualFileId}-${keyParts.join('|')}`;
}

export default function MyData() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(PAGE_SIZE_OPTIONS[0]);
  const [user, setUser] = useState<any>(getCurrentUser());
  const userRole = user?.role || '';
  const userDivisions = user?.division || []; // Array of user's assigned divisions
  const [siteObservations, setSiteObservations] = useState<Record<string, string>>({}); // Store site observations by row key
  const [siteObservationsLastModified, setSiteObservationsLastModified] = useState<Record<string, number>>({}); // Track when Site Observations were last updated (timestamp)
  const [siteObservationsBySiteCode, setSiteObservationsBySiteCode] = useState<Record<string, any>>({}); // Store site observations by Site Code from My Sites dialog
  const siteObservationsBySiteCodeRef = useRef<Record<string, any>>({});
  const loggedSiteCodesRef = useRef<Set<string>>(new Set()); // Track logged site codes to reduce console noise
  const [taskStatus, setTaskStatus] = useState<Record<string, string>>({}); // Store task status by row key
  const [typeOfIssue, setTypeOfIssue] = useState<Record<string, string>>({}); // Store type of issue by row key
  const [viewPhotos, setViewPhotos] = useState<Record<string, string[]>>({}); // Store photos by row key
  const [photoMetadata, setPhotoMetadata] = useState<Record<string, Array<{ latitude?: number; longitude?: number; timestamp?: string; location?: string }>>>({}); // Store photo metadata by row key
  const [remarks, setRemarks] = useState<Record<string, string>>({}); // Store remarks by row key
  const [supportDocuments, setSupportDocuments] = useState<Record<string, Array<{ name: string; data: string }>>>({}); // Store support documents (PDF) by row key for AMC users
  const dataLoadedRef = useRef<string>(''); // Track which file's data has been loaded
  const isLoadingRef = useRef<boolean>(false); // Track if we're currently loading data
  const persistenceCheckRef = useRef<boolean>(false); // Track if we've checked persistence for current file
  const rowsRef = useRef<any[]>([]); // Ref to track latest rows for database saving
  const headersRef = useRef<string[]>([]); // Ref to track latest headers for database saving
  const lastFilteredFileRef = useRef<string>(''); // Track which file we last filtered to avoid re-filtering
  const [actionsRows, setActionsRows] = useState<any[]>([]); // Store actions as rows for RTU/Communication users
  const [routedActionsMap, setRoutedActionsMap] = useState<Record<string, any>>({}); // Store actions routed from current user (for Equipment users)
  const [reroutedActionsMap, setReroutedActionsMap] = useState<Record<string, any>>({}); // Store actions rerouted by RTU/Communication users
  
  // Refs to track latest state values for reliable saving
  const siteObservationsRef = useRef<Record<string, string>>({});
  const taskStatusRef = useRef<Record<string, string>>({});
  const typeOfIssueRef = useRef<Record<string, string>>({});
  const viewPhotosRef = useRef<Record<string, string[]>>({});
  const remarksRef = useRef<Record<string, string>>({});
  const photoMetadataRef = useRef<Record<string, Array<{ latitude?: number; longitude?: number; timestamp?: string; location?: string }>>>({});
  const supportDocumentsRef = useRef<Record<string, Array<{ name: string; data: string }>>>({});
  
  // Sync refs with state
  useEffect(() => {
    siteObservationsRef.current = siteObservations;
  }, [siteObservations]);
  
  useEffect(() => {
    siteObservationsBySiteCodeRef.current = siteObservationsBySiteCode;
  }, [siteObservationsBySiteCode]);
  
  useEffect(() => {
    taskStatusRef.current = taskStatus;
  }, [taskStatus]);
  
  useEffect(() => {
    typeOfIssueRef.current = typeOfIssue;
  }, [typeOfIssue]);
  
  useEffect(() => {
    viewPhotosRef.current = viewPhotos;
  }, [viewPhotos]);
  
  useEffect(() => {
    remarksRef.current = remarks;
  }, [remarks]);
  
  useEffect(() => {
    photoMetadataRef.current = photoMetadata;
  }, [photoMetadata]);
  
  useEffect(() => {
    supportDocumentsRef.current = supportDocuments;
  }, [supportDocuments]);

  // Sync rows and headers refs
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useEffect(() => {
    headersRef.current = headers;
  }, [headers]);
  
  // Function to save action updates to database for RTU/Communication users
  const saveActionUpdateToDatabase = useCallback(async (_rowKey: string, row: any, updates: { remarks?: string; status?: string }) => {
    if (userRole !== 'RTU/Communication' || !row._actionId) {
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('No token found, cannot save action update to database');
        return;
      }
      
      const updatePayload: { remarks?: string; status?: string } = {};
      if (updates.remarks !== undefined) {
        updatePayload.remarks = updates.remarks;
      }
      if (updates.status !== undefined) {
        updatePayload.status = updates.status;
      }
      
      if (Object.keys(updatePayload).length === 0) {
        return; // No updates to save
      }
      
      console.log('Saving action update to database for RTU/Communication user:`, {
        actionId: row._actionId,
        updates: updatePayload
      });
      
      const updateResponse = await fetch(`${API_BASE}/api/actions/${row._actionId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updatePayload)
      });
      
      if (updateResponse.ok) {
        const updateResult = await updateResponse.json();
        console.log('Action update saved to database successfully:', updateResult);
      } else {
        const errorData = await updateResponse.json().catch(() => ({}));
        console.error('Failed to save action update to database:', errorData);
      }
    } catch (error) {
      console.error('Error saving action update to database:', error);
    }
  }, [userRole]);
  
  // Ref to store ONLINE-OFFLINE columns that should be excluded from originalRowData when saving
  const onlineOfflineColumnsRef = useRef<string[]>([]);

  // Function to save data to EquipmentOfflineSites collection in database
  const saveToEquipmentOfflineSitesDB = useCallback(async () => {
    if (!selectedFile || isLoadingRef.current) {
      return;
    }
    
    // Only save for Equipment role users in MY OFFLINE SITES
    if (userRole !== 'Equipment') {
      return;
    }

    // Use refs to get latest values
    const currentRows = rowsRef.current;
    const currentHeaders = headersRef.current;

    if (!currentRows.length || !currentHeaders.length) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('No token found, cannot save to EquipmentOfflineSites database');
        return;
      }

      // First, fetch existing data from database to check for matches
      // This helps us avoid recreating deleted documents
      let existingSitesMap = new Map<string, any>();
      let existingSitesByRowKey = new Map<string, any>(); // Also track by rowKey for exact matches
      try {
        const existingRes = await fetch(`${API_BASE}/api/equipment-offline-sites/file/${selectedFile}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (existingRes.ok) {
          const existingData = await existingRes.json();
          if (existingData.success && existingData.data) {
            // Create a map keyed by "siteCode|deviceStatus" for quick lookup
            Object.entries(existingData.data).forEach(([rowKey, site]: [string, any]) => {
              const key = `${site.siteCode}|${site.deviceStatus || ''}`;
              existingSitesMap.set(key, site);
              existingSitesByRowKey.set(rowKey, site); // Track by rowKey too
            });
            console.log(`Found ${existingSitesMap.size} existing sites in database`);
          }
        }
      } catch (error) {
        console.warn('Could not fetch existing sites, will save all data:', error);
      }

      // Prepare sites array for bulk save and updates
      const sitesToSave: any[] = [];
      const daysOfflineUpdates: any[] = []; // For sites that only need noOfDaysOffline update
      
      // Iterate through all rows and prepare data for each row
      currentRows.forEach((row) => {
        const rowKey = generateRowKey(selectedFile, row, currentHeaders);
        
        // Extract site code from row (try multiple possible column names)
        const siteCode = row['Site Code'] || 
                        row['SITE CODE'] || 
                        row['SiteCode'] || 
                        row['Site_Code'] || 
                        row['site code'] || 
                        '';
        
        if (!siteCode) {
          return; // Skip rows without site code
        }

        // Get data for this row from refs
        const siteObservationsValue = siteObservationsRef.current[rowKey] || '';
        const taskStatusValue = taskStatusRef.current[rowKey] || '';
        const typeOfIssueValue = typeOfIssueRef.current[rowKey] || '';
        const viewPhotosValue = viewPhotosRef.current[rowKey] || [];
        const photoMetadataValue = photoMetadataRef.current[rowKey] || [];
        const remarksValue = remarksRef.current[rowKey] || [];
        
        // Extract device status and no of days offline from row if available
        const deviceStatus = row['DEVICE STATUS'] || 
                            row['Device Status'] || 
                            row['device status'] || 
                            row['DEVICESTATUS'] || 
                            '';
        const noOfDaysOffline = row['NO OF DAYS OFFLINE'] || 
                               row['No of Days Offline'] || 
                               row['no of days offline'] || 
                               row['NOOFDAYSOFFLINE'] || 
                               row['NO_OF_DAYS_OFFLINE'] || 
                               null;

        const normalizedSiteCode = siteCode.trim().toUpperCase();
        const supportDocumentsValue = supportDocumentsRef.current[rowKey] || [];
        
        // Debug logging for Pending status
        if (siteObservationsValue === 'Pending') {
          console.log(`[SAVE] Found Pending status for rowKey ${rowKey}, siteCode: ${normalizedSiteCode}`);
        }
        const normalizedDeviceStatus = deviceStatus.trim();
        const matchKey = `${normalizedSiteCode}|${normalizedDeviceStatus}`;
        
        // Check if Site Code + Device Status match existing data
        // Also check by rowKey to ensure we're working with the exact same document
        // Prefer rowKey match as it's more specific
        const existingSiteByRowKey = existingSitesByRowKey.get(rowKey);
        const existingSite = existingSiteByRowKey || existingSitesMap.get(matchKey);
        
        if (existingSite) {
          // Match found: Update existing site only if there's user-entered data
          console.log(`Match found for Site Code: ${normalizedSiteCode}, Device Status: ${normalizedDeviceStatus}`);
          
          // CRITICAL: Preserve existing typeOfIssue and remarks from database if refs don't have values
          // This prevents overwriting data saved from Dashboard/My Sites dialog
          const finalTypeOfIssue = typeOfIssueValue || (existingSite.typeOfIssue ? String(existingSite.typeOfIssue) : '');
          const finalRemarks = remarksValue || (existingSite.remarks ? String(existingSite.remarks) : '');
          
          // CRITICAL: Only update if there's user-entered data (not just file data)
          // This prevents recreating deleted documents
          if (finalTypeOfIssue || finalRemarks || siteObservationsValue || taskStatusValue || 
              viewPhotosValue.length > 0 || supportDocumentsValue.length > 0) {
            // If Site Observations is "Resolved", always update Task Status to "Resolved"
            const finalTaskStatus = siteObservationsValue === 'Resolved' ? 'Resolved' : taskStatusValue;
            
            console.log(`[SAVE] Updating existing site ${rowKey} with Type of Issue and Remarks in database:`, {
              typeOfIssue: finalTypeOfIssue,
              remarks: finalRemarks,
              siteObservations: siteObservationsValue,
              taskStatus: finalTaskStatus,
              fromRefs: { typeOfIssue: typeOfIssueValue, remarks: remarksValue },
              fromDB: { typeOfIssue: existingSite.typeOfIssue, remarks: existingSite.remarks }
            });
            
            // CRITICAL: For Reports, Resolved = empty string, Pending = non-empty string
            // When siteObservationsValue is 'Resolved', save as empty string for Reports compatibility
            // When siteObservationsValue is 'Pending', keep as 'Pending' (non-empty string)
            const finalSiteObservations = siteObservationsValue === 'Resolved' ? '' : (siteObservationsValue || '');
            
            console.log(`[SAVE] Site Observations conversion for existing rowKey ${rowKey}:`, {
              original: siteObservationsValue,
              final: finalSiteObservations,
              willSave: !!finalSiteObservations || finalSiteObservations === ''
            });
            
            // CRITICAL: Exclude ONLINE-OFFLINE columns from originalRowData
            // ONLINE-OFFLINE data is reference data and should NOT be saved to Equipment offline sites
            // It should remain only in the uploads collection
            const originalRowDataWithoutOnlineOffline = { ...row };
            onlineOfflineColumnsRef.current.forEach((col: string) => {
              delete originalRowDataWithoutOnlineOffline[col];
            });
            
            // Save the full site data including Type of Issue and Remarks (preserving DB values if refs are empty)
            // NOTE: originalRowData excludes ONLINE-OFFLINE columns (reference data only)
            sitesToSave.push({
              fileId: selectedFile,
              rowKey,
              siteCode: normalizedSiteCode,
              originalRowData: originalRowDataWithoutOnlineOffline,
              headers: currentHeaders,
              siteObservations: finalSiteObservations,
              taskStatus: finalTaskStatus,
              typeOfIssue: finalTypeOfIssue,
              viewPhotos: viewPhotosValue,
              photoMetadata: photoMetadataValue,
              remarks: finalRemarks,
              supportDocuments: supportDocumentsValue,
              deviceStatus: normalizedDeviceStatus,
              noOfDaysOffline: noOfDaysOffline ? parseInt(String(noOfDaysOffline)) : null,
              savedFrom: 'MY OFFLINE SITES'
            });
          } else if (noOfDaysOffline !== null && noOfDaysOffline !== undefined) {
            // Only update noOfDaysOffline if there's no other data to save
            // This is safe because the document already exists
            daysOfflineUpdates.push({
              siteCode: normalizedSiteCode,
              deviceStatus: normalizedDeviceStatus,
              noOfDaysOffline: parseInt(String(noOfDaysOffline))
            });
          }
          // If no user-entered data and noOfDaysOffline is not available, don't update
          // This prevents unnecessary updates that might recreate deleted documents
        } else {
          // No match: Only save if there's user-entered data (not just file data)
          // This prevents recreating deleted documents that only had file data
          // IMPORTANT: siteObservationsValue can be 'Pending' or 'Resolved', both should trigger save
          if (siteObservationsValue || taskStatusValue || typeOfIssueValue || 
              viewPhotosValue.length > 0 || remarksValue || supportDocumentsValue.length > 0) {
            // If Site Observations is "Resolved", ensure Task Status is also "Resolved"
            const finalTaskStatus = siteObservationsValue === 'Resolved' ? 'Resolved' : taskStatusValue;
            
            if (siteObservationsValue === 'Resolved') {
              console.log(`[SAVE] Saving new rowKey ${rowKey} with Site Observations=Resolved, setting Task Status=Resolved`);
            } else if (siteObservationsValue === 'Pending') {
              console.log(`[SAVE] Saving new rowKey ${rowKey} with Site Observations=Pending`);
            }
            
            // CRITICAL: For Reports, Resolved = empty string, Pending = non-empty string
            // When siteObservationsValue is 'Resolved', save as empty string for Reports compatibility
            // When siteObservationsValue is 'Pending', keep as 'Pending' (non-empty string)
            const finalSiteObservations = siteObservationsValue === 'Resolved' ? '' : (siteObservationsValue || '');
            
            console.log(`[SAVE] Site Observations conversion for rowKey ${rowKey}:`, {
              original: siteObservationsValue,
              final: finalSiteObservations
            });
            
            // CRITICAL: Exclude ONLINE-OFFLINE columns from originalRowData
            // ONLINE-OFFLINE data is reference data and should NOT be saved to Equipment offline sites
            // It should remain only in the uploads collection
            const originalRowDataWithoutOnlineOffline = { ...row };
            onlineOfflineColumnsRef.current.forEach((col: string) => {
              delete originalRowDataWithoutOnlineOffline[col];
            });
            
            sitesToSave.push({
              fileId: selectedFile,
              rowKey,
              siteCode: normalizedSiteCode,
              originalRowData: originalRowDataWithoutOnlineOffline,
              headers: currentHeaders,
              siteObservations: finalSiteObservations,
              taskStatus: finalTaskStatus,
              typeOfIssue: typeOfIssueValue,
              viewPhotos: viewPhotosValue,
              photoMetadata: photoMetadataValue,
              remarks: remarksValue,
              supportDocuments: supportDocumentsValue,
              deviceStatus: normalizedDeviceStatus,
              noOfDaysOffline: noOfDaysOffline ? parseInt(String(noOfDaysOffline)) : null,
              savedFrom: 'MY OFFLINE SITES'
            });
          }
          // If no user-entered data and no existing site, don't create a new document
          // This prevents auto-creating documents for rows that only have file data
        }
      });

      // First, update only noOfDaysOffline for matching sites
      if (daysOfflineUpdates.length > 0) {
        const updateResponse = await fetch(`${API_BASE}/api/equipment-offline-sites/bulk-update-days-offline`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ updates: daysOfflineUpdates })
        });

        if (updateResponse.ok) {
          const updateResult = await updateResponse.json();
          console.log(`✓ Updated No of Days Offline for ${updateResult.totalModified} existing sites (preserved all other data)`);
        } else {
          const errorData = await updateResponse.json().catch(() => ({}));
          console.error('Failed to update days offline:', errorData);
        }
      }

      // Then, save new sites or sites without matches
      if (sitesToSave.length > 0) {
        // Debug: Log sites with Pending status before saving
        const pendingSites = sitesToSave.filter(s => s.siteObservations === 'Pending');
        if (pendingSites.length > 0) {
          console.log(`[SAVE] Found ${pendingSites.length} site(s) with Pending status to save:`, 
            pendingSites.map(s => ({ siteCode: s.siteCode, siteObservations: s.siteObservations }))
          );
        }
        
        console.log(`[SAVE] Total sites to save: ${sitesToSave.length}`);
        console.log(`[SAVE] Site observations breakdown:`, {
          resolved: sitesToSave.filter(s => s.siteObservations === '').length,
          pending: sitesToSave.filter(s => s.siteObservations === 'Pending').length,
          empty: sitesToSave.filter(s => !s.siteObservations || s.siteObservations === '').length
        });
        
        // Bulk save to database
        const response = await fetch(`${API_BASE}/api/equipment-offline-sites/bulk`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ sites: sitesToSave })
        });

        if (response.ok) {
          const result = await response.json();
          console.log(`✓ Saved ${result.saved} equipment offline sites to database (no localStorage used)`);
          if (result.errors > 0) {
            console.warn(`⚠ ${result.errors} errors occurred during bulk save`);
          }
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error('Failed to save to EquipmentOfflineSites database:', errorData);
        }
      } else if (daysOfflineUpdates.length === 0) {
        // Even if no data to save, clear any existing localStorage entries for this file
        const storageKey = `myData_${selectedFile}`;
        localStorage.removeItem(storageKey);
        console.log('✓ Cleared localStorage for Equipment role user (database only)');
      }
      
      // CRITICAL: Always clear typeOfIssue and remarks from localStorage for Equipment role users
      // This ensures database is the single source of truth for Type of Issue and Remarks
      const storageKey = `myData_${selectedFile}`;
      const existingLocalStorage = localStorage.getItem(storageKey);
      if (existingLocalStorage) {
        try {
          const parsed = JSON.parse(existingLocalStorage);
          // Remove typeOfIssue and remarks from localStorage if they exist
          if (parsed.typeOfIssue || parsed.remarks) {
            delete parsed.typeOfIssue;
            delete parsed.remarks;
            // Only keep localStorage if there's other data (for backward compatibility)
            if (Object.keys(parsed.siteObservations || {}).length > 0 || 
                Object.keys(parsed.taskStatus || {}).length > 0 ||
                Object.keys(parsed.viewPhotos || {}).length > 0) {
              localStorage.setItem(storageKey, JSON.stringify(parsed));
              console.log('✓ Removed typeOfIssue and remarks from localStorage (database only)');
            } else {
              localStorage.removeItem(storageKey);
              console.log('✓ Cleared localStorage completely (all data in database)');
            }
          }
        } catch (error) {
          console.warn('Error cleaning localStorage:', error);
        }
      }
    } catch (error) {
      console.error('Error saving to EquipmentOfflineSites database:', error);
    }
  }, [selectedFile, userRole]);

  // Function to load data from EquipmentOfflineSites database
  const loadFromEquipmentOfflineSitesDB = useCallback(async () => {
    if (!selectedFile || isLoadingRef.current || userRole !== 'Equipment') {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('No token found, cannot load from EquipmentOfflineSites database');
        return;
      }

      // Fetch data from database
      const response = await fetch(`${API_BASE}/api/equipment-offline-sites/file/${selectedFile}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const dbData = result.data;
          const excludedRowKeys: string[] = result.excludedRowKeys || []; // RowKeys with ccrStatus === 'Approved'
          const excludedSiteCodes: string[] = result.excludedSiteCodes || []; // SiteCodes that should be excluded
          const excludedCount = result.excludedCount || 0;
          
          console.log(`[loadFromEquipmentOfflineSitesDB] API Response:`, {
            dataKeys: Object.keys(dbData).length,
            excludedRowKeysCount: excludedRowKeys.length,
            excludedSiteCodesCount: excludedSiteCodes.length,
            excludedSiteCodes: excludedSiteCodes,
            excludedCount: excludedCount,
            excludedRowKeysList: excludedRowKeys
          });
          
          // Store excludedRowKeys and excludedSiteCodes in sessionStorage so we can use it later to filter rows
          // This ensures filtering happens even if rows load after this function completes
          if (excludedRowKeys.length > 0 || excludedSiteCodes.length > 0) {
            console.log(`[loadFromEquipmentOfflineSitesDB] ✅ Received ${excludedRowKeys.length} excluded rowKeys and ${excludedSiteCodes.length} excluded siteCodes`);
            sessionStorage.setItem(`excludedRowKeys_${selectedFile}`, JSON.stringify(excludedRowKeys));
            sessionStorage.setItem(`excludedSiteCodes_${selectedFile}`, JSON.stringify(excludedSiteCodes));
          } else {
            console.log(`[loadFromEquipmentOfflineSitesDB] No excluded rowKeys or siteCodes (all records are pending approval)`);
            sessionStorage.removeItem(`excludedRowKeys_${selectedFile}`);
            sessionStorage.removeItem(`excludedSiteCodes_${selectedFile}`);
          }
          
          // CRITICAL: Filter out rows that have been approved by CCR (ccrStatus === 'Approved')
          // These rows should be hidden from MY OFFLINE SITES tab
          // Filter immediately if rows are already loaded
          // Filter by BOTH rowKey AND siteCode (in case rowKey doesn't match)
          if ((excludedRowKeys.length > 0 || excludedSiteCodes.length > 0) && rows.length > 0) {
            console.log(`[loadFromEquipmentOfflineSitesDB] Filtering ${rows.length} rows, excluding ${excludedRowKeys.length} rowKeys and ${excludedSiteCodes.length} siteCodes`);
            const filteredRows = rows.filter((row) => {
              const rowKey = generateRowKey(selectedFile || '', row, headers);
              const siteCode = (row['SITE CODE'] || row['Site Code'] || row['site code'] || '').trim().toUpperCase();
              
              // Exclude if rowKey matches OR siteCode matches
              const shouldExcludeByRowKey = excludedRowKeys.length > 0 && excludedRowKeys.includes(rowKey);
              const shouldExcludeBySiteCode = excludedSiteCodes.length > 0 && siteCode && excludedSiteCodes.includes(siteCode);
              const shouldExclude = shouldExcludeByRowKey || shouldExcludeBySiteCode;
              
              if (shouldExclude) {
                console.log(`[loadFromEquipmentOfflineSitesDB] ❌ Hiding approved row - rowKey: ${rowKey}, siteCode: ${siteCode}, excludedByRowKey: ${shouldExcludeByRowKey}, excludedBySiteCode: ${shouldExcludeBySiteCode}`);
              }
              return !shouldExclude;
            });
            console.log(`[loadFromEquipmentOfflineSitesDB] ✅ Filtered rows: ${rows.length} -> ${filteredRows.length} (excluded ${rows.length - filteredRows.length} approved rows)`);
            setRows(filteredRows);
          }
          
          // Convert database data format to component state format
          const loadedSiteObservations: Record<string, string> = {};
          const loadedTaskStatus: Record<string, string> = {};
          const loadedTypeOfIssue: Record<string, string> = {};
          const loadedViewPhotos: Record<string, string[]> = {};
          const loadedPhotoMetadata: Record<string, Array<{ latitude?: number; longitude?: number; timestamp?: string; location?: string }>> = {};
          const loadedRemarks: Record<string, string> = {};
          const loadedSupportDocuments: Record<string, Array<{ name: string; data: string }>> = {};

          Object.entries(dbData).forEach(([rowKey, siteData]: [string, any]) => {
            if (siteData.siteObservations) loadedSiteObservations[rowKey] = siteData.siteObservations;
            if (siteData.taskStatus) loadedTaskStatus[rowKey] = siteData.taskStatus;
            if (siteData.typeOfIssue) loadedTypeOfIssue[rowKey] = siteData.typeOfIssue;
            if (siteData.viewPhotos && siteData.viewPhotos.length > 0) loadedViewPhotos[rowKey] = siteData.viewPhotos;
            if (siteData.photoMetadata && siteData.photoMetadata.length > 0) loadedPhotoMetadata[rowKey] = siteData.photoMetadata;
            if (siteData.remarks) loadedRemarks[rowKey] = siteData.remarks;
            if (siteData.supportDocuments && siteData.supportDocuments.length > 0) loadedSupportDocuments[rowKey] = siteData.supportDocuments;
            
            // CRITICAL: If Site Observations is "Resolved", ensure Task Status is also "Resolved"
            // This ensures that when data is loaded from database, Task Status shows "Resolved"
            // if Site Observations is "Resolved", even if Task Status wasn't saved properly
            if (siteData.siteObservations === 'Resolved') {
              console.log(`[LOAD] Setting Task Status to Resolved for rowKey ${rowKey} because Site Observations is Resolved`);
              loadedTaskStatus[rowKey] = 'Resolved';
            }
            
            // Debug logging
            if (siteData.siteObservations === 'Resolved') {
              console.log(`[LOAD] Row ${rowKey}: Site Observations=${siteData.siteObservations}, Task Status=${loadedTaskStatus[rowKey]}`);
            }
          });

          // CRITICAL: Ensure Task Status is "Resolved" for all rows where Site Observations is "Resolved"
          // Do this BEFORE setting state to ensure it's correct
          Object.keys(loadedSiteObservations).forEach(rowKey => {
            if (loadedSiteObservations[rowKey] === 'Resolved') {
              if (loadedTaskStatus[rowKey] !== 'Resolved') {
                console.log(`[LOAD] FORCING Task Status to Resolved for rowKey ${rowKey} because Site Observations is Resolved`);
                loadedTaskStatus[rowKey] = 'Resolved';
              }
            }
          });

          // Update state
          setSiteObservations(loadedSiteObservations);
          setTaskStatus(loadedTaskStatus);
          setTypeOfIssue(loadedTypeOfIssue);
          setViewPhotos(loadedViewPhotos);
          setPhotoMetadata(loadedPhotoMetadata);
          setRemarks(loadedRemarks);
          setSupportDocuments(loadedSupportDocuments);
          
          // Update refs immediately to ensure they're in sync
          siteObservationsRef.current = loadedSiteObservations;
          taskStatusRef.current = loadedTaskStatus;
          typeOfIssueRef.current = loadedTypeOfIssue;
          viewPhotosRef.current = loadedViewPhotos;
          photoMetadataRef.current = loadedPhotoMetadata;
          remarksRef.current = loadedRemarks;
          supportDocumentsRef.current = loadedSupportDocuments;

          // Debug: Log resolved entries
          const resolvedEntries = Object.entries(loadedSiteObservations).filter(([_, status]) => status === 'Resolved');
          console.log(`✓ Loaded ${Object.keys(dbData).length} equipment offline sites from database`);
          console.log(`✓ Found ${resolvedEntries.length} rows with Site Observations = Resolved`);
          resolvedEntries.forEach(([rowKey, _]) => {
            console.log(`  - Row ${rowKey}: Task Status = ${loadedTaskStatus[rowKey] || 'NOT SET'}`);
          });
          
          // CRITICAL: After setting state, immediately trigger useEffect to ensure Task Status stays "Resolved"
          // Use setTimeout to ensure state updates have completed
          setTimeout(() => {
            setTaskStatus(prev => {
              let changed = false;
              const updated = { ...prev };
              
              // Check all rows where Site Observations is "Resolved" and ensure Task Status is "Resolved"
              Object.keys(loadedSiteObservations).forEach(rowKey => {
                if (loadedSiteObservations[rowKey] === 'Resolved') {
                  if (updated[rowKey] !== 'Resolved') {
                    console.log(`[LOAD POST-SET] Setting Task Status to Resolved for rowKey ${rowKey}`);
                    updated[rowKey] = 'Resolved';
                    changed = true;
                  }
                }
              });
              
              if (changed) {
                taskStatusRef.current = updated;
                return updated;
              }
              
              return prev;
            });
          }, 100);
        }
      } else {
        console.warn('Failed to load from EquipmentOfflineSites database');
      }
    } catch (error) {
      console.error('Error loading from EquipmentOfflineSites database:', error);
    }
  }, [selectedFile, userRole, headers]);

  // Function to save data to localStorage (skip for Equipment role users)
  const saveToLocalStorage = useCallback(() => {
    if (!selectedFile || isLoadingRef.current) {
      return;
    }
    
    // Don't save to localStorage for RTU/Communication users in MY OFFLINE SITES
    if (userRole === 'RTU/Communication') {
      return;
    }
    
    // Don't save to localStorage for Equipment role users - use database only
    if (userRole === 'Equipment') {
      // Save directly to database instead
      saveToEquipmentOfflineSitesDB();
      return;
    }
    
    const storageKey = `myData_${selectedFile}`;
    try {
      const dataToSave = {
        siteObservations: siteObservationsRef.current,
        taskStatus: taskStatusRef.current,
        typeOfIssue: typeOfIssueRef.current,
        viewPhotos: viewPhotosRef.current,
        remarks: remarksRef.current,
        photoMetadata: photoMetadataRef.current,
        supportDocuments: supportDocumentsRef.current
      };
      
      const hasData = Object.keys(dataToSave.siteObservations).length > 0 || 
                      Object.keys(dataToSave.taskStatus).length > 0 || 
                      Object.keys(dataToSave.typeOfIssue).length > 0 || 
                      Object.keys(dataToSave.viewPhotos).length > 0 || 
                      Object.keys(dataToSave.remarks).length > 0 || 
                      Object.keys(dataToSave.photoMetadata).length > 0 ||
                      Object.keys(dataToSave.supportDocuments).length > 0;
      
      if (hasData) {
        console.log('Saving data to localStorage:`, {
          file: selectedFile,
          siteObservations: Object.keys(dataToSave.siteObservations).length,
          resolvedEntries: Object.values(dataToSave.siteObservations).filter(v => v === 'Resolved').length,
          taskStatus: Object.keys(dataToSave.taskStatus).length,
          typeOfIssue: Object.keys(dataToSave.typeOfIssue).length,
          viewPhotos: Object.keys(dataToSave.viewPhotos).length,
          remarks: Object.keys(dataToSave.remarks).length,
          photoMetadata: Object.keys(dataToSave.photoMetadata).length,
          supportDocuments: Object.keys(dataToSave.supportDocuments).length
        });
      }
      
      localStorage.setItem(storageKey, JSON.stringify(dataToSave));
      
      // Sync to API (debounced)
      import('../utils/dataSync').then(({ debounceSync }) => {
        debounceSync(selectedFile, dataToSave, 2000);
      }).catch((syncError) => {
        console.warn('Error setting up sync to API:', syncError);
      });
      
      // Verify save
      const verify = localStorage.getItem(storageKey);
      if (!verify) {
        console.error('Save verification failed!');
        // Retry immediately
        setTimeout(() => {
          localStorage.setItem(storageKey, JSON.stringify(dataToSave));
        }, 50);
      } else {
        const parsed = JSON.parse(verify);
        const savedCount = Object.keys(parsed.siteObservations || {}).length;
        const expectedCount = Object.keys(dataToSave.siteObservations).length;
        const savedResolvedCount = Object.values(parsed.siteObservations || {}).filter(v => v === 'Resolved').length;
        const expectedResolvedCount = Object.values(dataToSave.siteObservations).filter(v => v === 'Resolved').length;
        if (savedCount !== expectedCount && expectedCount > 0) {
          console.warn(`Save mismatch: expected ${expectedCount}, got ${savedCount}`);
        }
        if (savedResolvedCount !== expectedResolvedCount && expectedResolvedCount > 0) {
          console.warn(`Resolved count mismatch: expected ${expectedResolvedCount}, got ${savedResolvedCount}`);
        } else if (expectedResolvedCount > 0) {
          console.log(`✓ Successfully saved ${expectedResolvedCount} resolved entries`);
        }
      }
    } catch (error) {
      console.error('Error saving to localStorage:', error);
      // Retry on error
      setTimeout(() => {
        try {
          const dataToSave = {
            siteObservations: siteObservationsRef.current,
            taskStatus: taskStatusRef.current,
            typeOfIssue: typeOfIssueRef.current,
            viewPhotos: viewPhotosRef.current,
            remarks: remarksRef.current,
            photoMetadata: photoMetadataRef.current,
            supportDocuments: supportDocumentsRef.current
          };
          localStorage.setItem(storageKey, JSON.stringify(dataToSave));
          console.log('Retry save successful');
        } catch (retryError) {
          console.error('Retry save failed:', retryError);
        }
      }, 100);
    }
  }, [selectedFile, saveToEquipmentOfflineSitesDB, loadFromEquipmentOfflineSitesDB]);
  
  // CRITICAL: Filter out rows with ccrStatus === 'Approved' whenever rows OR actionsRows change
  // ALWAYS fetch fresh excludedSiteCodes from API to catch newly approved siteCodes
  // This ensures approved rows are hidden from MY OFFLINE SITES tab for ALL users
  // For RTU/Communication, O&M, AMC, CCR users, this also filters actionsRows
  useEffect(() => {
    // For RTU/Communication users, check actionsRows instead of rows
    // For other users, check rows
    const hasRows = userRole === 'RTU/Communication' 
      ? (actionsRows.length > 0) 
      : (rows.length > 0);
    
    if (!selectedFile || !hasRows || headers.length === 0) {
      return;
    }
    
    console.log(`[FILTER ROWS] Checking if rows need filtering - file: ${selectedFile}, rows: ${rows.length}, headers: ${headers.length}`);
    
    // ALWAYS fetch fresh excludedSiteCodes from API (don't rely on cache for new approvals)
    const fetchAndFilter = async () => {
      try {
        const token = localStorage.getItem('token');
        let excludedRowKeys: string[] = [];
        let excludedSiteCodes: string[] = [];
        
        if (token) {
          // Fetch fresh excludedSiteCodes from API
          const exclusionRes = await fetch(`${API_BASE}/api/equipment-offline-sites/file/${selectedFile}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (exclusionRes.ok) {
            const exclusionResult = await exclusionRes.json();
            if (exclusionResult.success) {
              if (exclusionResult.excludedRowKeys) {
                excludedRowKeys = exclusionResult.excludedRowKeys;
              }
              if (exclusionResult.excludedSiteCodes) {
                excludedSiteCodes = exclusionResult.excludedSiteCodes;
              }
              // Update sessionStorage with fresh data
              if (excludedRowKeys.length > 0) {
                sessionStorage.setItem(`excludedRowKeys_${selectedFile}`, JSON.stringify(excludedRowKeys));
              }
              if (excludedSiteCodes.length > 0) {
                sessionStorage.setItem(`excludedSiteCodes_${selectedFile}`, JSON.stringify(excludedSiteCodes));
              }
              console.log(`[FILTER ROWS] ✅ Fetched FRESH excludedSiteCodes from API:`, excludedSiteCodes);
            }
          } else {
            // Fallback to sessionStorage if API request fails
            const excludedRowKeysStr = sessionStorage.getItem(`excludedRowKeys_${selectedFile}`);
            const excludedSiteCodesStr = sessionStorage.getItem(`excludedSiteCodes_${selectedFile}`);
            if (excludedRowKeysStr) excludedRowKeys = JSON.parse(excludedRowKeysStr);
            if (excludedSiteCodesStr) excludedSiteCodes = JSON.parse(excludedSiteCodesStr);
            console.log(`[FILTER ROWS] ⚠️ API request failed, using cached:`, excludedSiteCodes);
          }
        }
        
        if (excludedRowKeys.length === 0 && excludedSiteCodes.length === 0) {
          console.log(`[FILTER ROWS] No excluded rows found - all rows will be shown`);
          lastFilteredFileRef.current = selectedFile;
          return;
        }
        
        console.log(`[FILTER ROWS] Found ${excludedRowKeys.length} excluded rowKeys and ${excludedSiteCodes.length} excluded siteCodes:`, {
          excludedRowKeys: excludedRowKeys,
          excludedSiteCodes: excludedSiteCodes
        });
        
        // Filter out rows whose rowKey OR siteCode matches exclusion criteria
        const filteredRows = rows.filter((row) => {
          const rowKey = generateRowKey(selectedFile, row, headers);
          const siteCode = (row['SITE CODE'] || row['Site Code'] || row['site code'] || '').trim().toUpperCase();
          
          // Exclude if rowKey matches OR siteCode matches
          const shouldExcludeByRowKey = excludedRowKeys.length > 0 && excludedRowKeys.includes(rowKey);
          const shouldExcludeBySiteCode = excludedSiteCodes.length > 0 && siteCode && excludedSiteCodes.includes(siteCode);
          const shouldExclude = shouldExcludeByRowKey || shouldExcludeBySiteCode;
          
          if (shouldExclude) {
            console.log(`[FILTER ROWS] ❌ Hiding approved row - rowKey: ${rowKey}, siteCode: ${siteCode}, excludedByRowKey: ${shouldExcludeByRowKey}, excludedBySiteCode: ${shouldExcludeBySiteCode}`);
          }
          return !shouldExclude;
        });
        
        // CRITICAL: Also filter actionsRows for RTU/Communication, O&M, AMC, CCR users
        // They see actionsRows instead of file rows, so we need to filter those too
        // This ensures approved siteCodes are hidden for ALL users, including those viewing actions
        let filteredActionsRows = actionsRows;
        if (actionsRows.length > 0 && excludedSiteCodes.length > 0) {
          const normalizedExcludedSiteCodes = excludedSiteCodes.map((code: string) => String(code).trim().toUpperCase());
          const beforeActionsFilter = actionsRows.length;
          
          filteredActionsRows = actionsRows.filter((actionRow: any) => {
            // Get siteCode from action rowData - try multiple column names
            const siteCode = (
              actionRow['SITE CODE'] || 
              actionRow['Site Code'] || 
              actionRow['site code'] || 
              actionRow['SITECODE'] || 
              actionRow['SiteCode'] || 
              actionRow['site_code'] || 
              ''
            ).trim().toUpperCase();
            
            if (!siteCode) {
              // If no siteCode found, keep the row (don't exclude)
              return true;
            }
            
            // Check if siteCode is in excluded list
            const shouldExclude = normalizedExcludedSiteCodes.includes(siteCode);
            
            if (shouldExclude) {
              console.log(`[FILTER ROWS] ❌ Hiding approved action row - siteCode: "${siteCode}"`);
            }
            
            return !shouldExclude;
          });
          
          const excludedActionsCount = beforeActionsFilter - filteredActionsRows.length;
          if (excludedActionsCount > 0) {
            console.log(`[FILTER ROWS] ✅ Filtered ${beforeActionsFilter} actionRows -> ${filteredActionsRows.length} (excluded ${excludedActionsCount} approved action rows)`);
            setActionsRows(filteredActionsRows);
          }
        }
        
        // Only update if rows were actually filtered
        if (filteredRows.length !== rows.length) {
          console.log(`[FILTER ROWS] ✅ Filtered ${rows.length} rows -> ${filteredRows.length} rows (excluded ${rows.length - filteredRows.length} approved rows)`);
          lastFilteredFileRef.current = selectedFile;
          setRows(filteredRows);
        } else {
          console.log(`[FILTER ROWS] No filtering needed - all rows are already visible`);
          lastFilteredFileRef.current = selectedFile; // Mark as processed even if no filtering needed
        }
      } catch (error) {
        console.error('[FILTER ROWS] ❌ Error fetching or filtering excludedSiteCodes:', error);
      }
    };
    
    fetchAndFilter();
  }, [rows, actionsRows, selectedFile, userRole, headers]);
  
  // Save data whenever it changes - using debounced save
  // For Equipment users: saves to database only (no localStorage)
  // For other users: saves to localStorage
  useEffect(() => {
    if (!selectedFile || isLoadingRef.current) {
      return;
    }
    
    // For Equipment users, save directly to database with shorter debounce
    if (userRole === 'Equipment') {
      const timeoutId = setTimeout(() => {
        saveToEquipmentOfflineSitesDB();
      }, 500); // Shorter debounce for database saves
      return () => clearTimeout(timeoutId);
    }
    
    // For other users, save to localStorage
    const timeoutId = setTimeout(() => {
      saveToLocalStorage();
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, [selectedFile, siteObservations, taskStatus, typeOfIssue, viewPhotos, remarks, photoMetadata, supportDocuments, saveToLocalStorage, saveToEquipmentOfflineSitesDB, userRole]);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false); // Control photo viewer dialog visibility
  const [selectedRowKeyForPhotos, setSelectedRowKeyForPhotos] = useState<string>(''); // Track which row's photos to view
  const [showSiteObservationsDialog, setShowSiteObservationsDialog] = useState(false); // Control Site Observations dialog visibility
  const [selectedSiteObservationRowKey, setSelectedSiteObservationRowKey] = useState<string>(''); // Track which row's site observation was selected
  const [siteObservationsDialogData, setSiteObservationsDialogData] = useState({
    remarks: '',
    typeOfIssue: '',
    specifyOther: '',
    typeOfSpare: [] as string[],
    specifySpareOther: '',
    capturedPhotos: [] as Array<{ data: string; latitude?: number; longitude?: number; timestamp?: string; location?: string }>,
    uploadedPhotos: [] as File[],
    uploadedDocuments: [] as File[]
  }); // Store Site Observations dialog form data
  const [siteObservationsStatus, setSiteObservationsStatus] = useState<string>(''); // Track if dialog is for Resolved or Pending
  const [isTypeOfSpareDropdownOpen, setIsTypeOfSpareDropdownOpen] = useState(false); // Control Type of Spare dropdown visibility
  const [showSiteObservationsCameraPreview, setShowSiteObservationsCameraPreview] = useState(false); // Show camera preview for Site Observations dialog
  const [siteObservationsCameraStream, setSiteObservationsCameraStream] = useState<MediaStream | null>(null); // Camera stream for Site Observations
  const [siteObservationsCapturedImageData, setSiteObservationsCapturedImageData] = useState<string | null>(null); // Captured image data URL for Site Observations
  const [capturedPhotoMetadata, setCapturedPhotoMetadata] = useState<{ latitude?: number; longitude?: number; timestamp?: string; location?: string } | null>(null); // Metadata for captured photo
  const siteObservationsCameraStreamRef = useRef<MediaStream | null>(null); // Ref to track camera stream for Site Observations cleanup
  const [isSubmittingSiteObservations, setIsSubmittingSiteObservations] = useState(false); // Track Site Observations submission state

  // Handle video element for Site Observations camera stream
  useEffect(() => {
    if (siteObservationsCameraStream && showSiteObservationsCameraPreview) {
      const video = document.getElementById('site-observations-camera-preview-video') as HTMLVideoElement;
      if (video) {
        video.srcObject = siteObservationsCameraStream;
        video.play().catch(err => console.error('Error playing video:', err));
      }
      siteObservationsCameraStreamRef.current = siteObservationsCameraStream;
    }
    
    // Cleanup: stop camera when component unmounts or dialog closes
    return () => {
      if (!showSiteObservationsCameraPreview && siteObservationsCameraStreamRef.current) {
        siteObservationsCameraStreamRef.current.getTracks().forEach(track => track.stop());
        siteObservationsCameraStreamRef.current = null;
        setSiteObservationsCameraStream(null);
      }
    };
  }, [siteObservationsCameraStream, showSiteObservationsCameraPreview]);
  
  // Close Type of Spare dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (isTypeOfSpareDropdownOpen && !target.closest('.type-of-spare-dropdown')) {
        setIsTypeOfSpareDropdownOpen(false);
      }
    };
    
    if (isTypeOfSpareDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isTypeOfSpareDropdownOpen]);
  
  // Auto-sync on app startup
  useEffect(() => {
    const autoSync = async () => {
      try {
        // Load all data states from API on startup
        const allStates = await loadAllUserDataStates();
        if (allStates) {
          // Save to localStorage for offline access
          Object.entries(allStates).forEach(([fileId, data]) => {
            const storageKey = `myData_${fileId}`;
            try {
              localStorage.setItem(storageKey, JSON.stringify(data));
            } catch (error) {
              console.warn(`Error saving API data to localStorage for ${fileId}:`, error);
            }
          });
          console.log(`✓ Auto-synced ${Object.keys(allStates).length} data states from API on startup`);
        }
        
        // Also bulk sync all localStorage data to API (in case web app has newer data)
        await bulkSyncAllDataStates();
      } catch (error) {
        console.warn('Error during auto-sync:', error);
      }
    };
    
    // Run auto-sync after a short delay to ensure token is available
    const timeoutId = setTimeout(() => {
      autoSync();
    }, 1000);
    
    return () => clearTimeout(timeoutId);
  }, []); // Run once on mount

  // Fetch fresh user data if divisions are missing (user might have old localStorage)
  useEffect(() => {
    const currentDivisions = user?.division || [];
    if ((userRole === 'Equipment' || userRole === 'RTU/Communication') && (!currentDivisions || currentDivisions.length === 0)) {
      const token = localStorage.getItem('token');
      if (token) {
        console.log('MY Data - Divisions missing, fetching fresh user profile...');
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
            console.log('MY Data - Refreshed user data with divisions:', freshUser.division);
          }
        })
        .catch(err => console.error('MY Data - Failed to fetch user profile:', err));
      }
    }
    
    console.log('MY Data - Current user data:`, {
      role: userRole,
      divisions: currentDivisions,
      hasDivisions: currentDivisions && currentDivisions.length > 0,
      userId: user?.userId
    });
  }, [user, userRole]);
  
  // Clear localStorage for RTU/Communication users when component mounts or role changes
  // BUT preserve state - resolved state will be set from backend actions
  useEffect(() => {
    if (userRole === 'RTU/Communication') {
      console.log('MY Data - RTU/Communication role detected: Clearing localStorage, resolved state will come from actions');
      
      // Clear all localStorage keys for this component (MY OFFLINE SITES)
      // DO NOT clear state here - it will be initialized from backend actions
      // This allows resolved state to persist after refresh
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('myData_')) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => {
          console.log('MY Data - Removing localStorage key:', key);
          localStorage.removeItem(key);
        });
      } catch (error) {
        console.error('MY Data - Error clearing localStorage:', error);
      }
      
      // NOTE: Removed automatic deletion of actions for RTU/Communication users
      // This was causing routed data to disappear after logout/login
      // Actions should persist in the database so they can be viewed after re-login
      // Actions are only deleted when explicitly resolved/completed by the user
      console.log('MY Data - RTU/Communication: Actions are now persisted in database (not auto-deleted)');
    }
  }, [userRole]);
  
  // Fetch uploaded files
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
          console.log('=== MY DATA (MY OFFLINE SITES) FILE FILTERING ===');
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
          if (files.length === 1) setSelectedFile(files[0].id);
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  // Fetch and filter data based on user role and divisions
  useEffect(() => {
    (async () => {
      if (!selectedFile) {
        setRows([]);
        setHeaders([]);
        return;
      }
      
      // For O&M and AMC users, only fetch headers, skip row data
      if (userRole === 'O&M' || userRole === 'AMC') {
        try {
          const token = localStorage.getItem('token');
          const res = await fetch(`${API_BASE}/api/uploads/${selectedFile}`, {
            headers: {
              'Authorization': token ? `Bearer ${token}` : ''
            }
          });
          const json = await res.json();
          if (json?.success && json.file) {
            const file = json.file;
            // Only set headers, no rows
            let hdrs = file.headers && file.headers.length 
              ? file.headers 
              : [];
            
            // Remove unwanted columns (case-insensitive) - handles variations
            hdrs = hdrs.filter((h: string) => {
              const normalized = normalize(h);
              
              // Remove columns containing 'remark'
              if (normalized.includes('remark')) return false;
              
              // Remove CIRCLE
              if (normalized === 'circle') return false;
              
              // Keep DEVICE TYPE for routing logic (don't remove it)
              // Removed: DEVICE TYPE filter to allow routing based on device type
              
              // Remove ATTRIBUTE
              if (normalized === 'attribute') return false;
              
              // Remove DEVICE STATUS
              if ((normalized.includes('device') && normalized.includes('status')) ||
                  normalized === 'devicestatus' || normalized === 'device_status') return false;
              
              // Remove HRN
              if (normalized === 'hrn') return false;
              
              // Remove L/R Status (handles variations like "L/R Status", "LR Status", "L R Status", etc.)
              if ((normalized.includes('l') && normalized.includes('r') && normalized.includes('status')) ||
                  normalized === 'lrstatus' || normalized === 'l_r_status' || normalized === 'l/rstatus') return false;
              
              // Remove RTU TRACKER OBSERVATION (handles all variations including typo "OBSERBATION")
              const hasRtu = normalized.includes('rtu');
              const hasTracker = normalized.includes('tracker');
              if (hasRtu && hasTracker) {
                console.log('Filtering out RTU TRACKER column:', h, 'normalized:', normalized);
                return false;
              }
              if (normalized.match(/rtu.*tracker/i) || normalized.match(/tracker.*rtu/i)) {
                console.log('Filtering out RTU TRACKER column (pattern match):', h, 'normalized:', normalized);
                return false;
              }
              
              // Remove PRODUCTION OBSERVATIONS (handles variations)
              if ((normalized.includes('production') && normalized.includes('observation')) ||
                  normalized === 'productionobservations' || normalized === 'production_observations' ||
                  normalized === 'productionobservation' || normalized === 'production_observation') return false;
              
              return true;
            });
            
            // Find the index of "No of Days Offline" column and insert "Site Observations" after it
            const daysOfflineHeaderIndex = hdrs.findIndex((h: string) => {
              const norm = normalize(h);
              return (norm.includes('days') && norm.includes('offline')) ||
                     norm === 'noofdaysoffline' || norm === 'no_of_days_offline' ||
                     norm === 'no of days offline' || norm === 'numberofdaysoffline' ||
                     norm === 'number_of_days_offline' || norm === 'number of days offline';
            });
            
            // Insert new columns after "No of Days Offline" or at the end
            const insertIndex = daysOfflineHeaderIndex >= 0 ? daysOfflineHeaderIndex + 1 : hdrs.length;
            hdrs.splice(insertIndex, 0, 'Site Observations', 'Task Status', 'Type of Issue', 'View Photos', 'Remarks');
            
            setHeaders(hdrs);
            setRows([]); // No rows for O&M users
            setCurrentPage(1);
          }
        } catch {
          setRows([]);
          setHeaders([]);
        }
        return; // Exit early for O&M users
      }
      
      // For other roles, fetch data normally
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE}/api/uploads/${selectedFile}`, {
          headers: {
            'Authorization': token ? `Bearer ${token}` : ''
          }
        });
        const json = await res.json();
        if (json?.success && json.file) {
          const file = json.file;
          let fileRows = Array.isArray(file.rows) ? file.rows : [];
          
          // Set headers first (use headers from file or derive from first row)
          let hdrs = file.headers && file.headers.length 
            ? file.headers 
            : (fileRows[0] ? Object.keys(fileRows[0]) : []);
          
          // Helper function to normalize headers (used throughout)
          const normalizeHeader = (h: string) => h.trim().toLowerCase();
          
          // Variables to track merged columns (for preservation during filtering)
          let mergedDeviceStatusColumn: string | undefined = undefined;
          let mergedNoOfDaysOfflineColumn: string | undefined = undefined;
          
          // Find SITE CODE column in main file (used for merging ONLINE-OFFLINE data)
          const mainSiteCodeHeader = hdrs.find((h: string) => {
            const normalized = normalizeHeader(h);
            return normalized === 'site code' || normalized === 'sitecode' || normalized === 'site_code';
          });
          
          console.log('MY DATA - Main SITE CODE header:', mainSiteCodeHeader);
          
          // Fetch ONLINE-OFFLINE DATA files to merge DEVICE STATUS and NO OF DAYS OFFLINE
          try {
            const onlineOfflineRes = await fetch(`${API_BASE}/api/uploads`, {
              headers: {
                'Authorization': token ? `Bearer ${token}` : ''
              }
            });
            const onlineOfflineJson = await onlineOfflineRes.json();
            
            if (onlineOfflineJson?.success) {
              // Find ONLINE-OFFLINE files
              const onlineOfflineFiles = (onlineOfflineJson.files || []).filter((f: any) => {
                const uploadTypeValue = f.uploadType;
                const fileName = String(f.name || '').toLowerCase();
                const isOnlineOfflineType = uploadTypeValue && String(uploadTypeValue).toLowerCase().trim() === 'online-offline-data';
                const isOnlineOfflineFileName = fileName.includes('online-offline') || 
                                               fileName.includes('online_offline') ||
                                               fileName.includes('onlineoffline');
                
                return isOnlineOfflineFileName || (isOnlineOfflineType && isOnlineOfflineFileName);
              });
              
              console.log('MY DATA - ONLINE-OFFLINE files found:', onlineOfflineFiles.map((f: any) => ({ name: f.name, uploadType: f.uploadType })));
              
              // Sort by upload date (latest first) and get the most recent ONLINE-OFFLINE file
              const latestOnlineOfflineFile = onlineOfflineFiles.sort((a: any, b: any) => {
                const dateA = a.uploadedAt ? new Date(a.uploadedAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
                const dateB = b.uploadedAt ? new Date(b.uploadedAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
                return dateB - dateA; // Latest first
              })[0];
              
              if (latestOnlineOfflineFile) {
                console.log('MY DATA - Found ONLINE-OFFLINE DATA file:', latestOnlineOfflineFile.name);
                
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
                  
                  console.log('MY DATA - ONLINE-OFFLINE headers:', onlineOfflineHeaders);
                  
                  // Find SITE CODE column in ONLINE-OFFLINE file
                  const onlineOfflineSiteCodeHeader = onlineOfflineHeaders.find((h: string) => {
                    const normalized = normalizeHeader(h);
                    return normalized === 'site code' || normalized === 'sitecode' || normalized === 'site_code';
                  });
                  
                  // Find DEVICE STATUS and NO OF DAYS OFFLINE columns
                  const deviceStatusHeader = onlineOfflineHeaders.find((h: string) => {
                    const normalized = normalizeHeader(h);
                    return normalized === 'device status' ||
                           normalized === 'device_status' ||
                           normalized === 'devicestatus' ||
                           (normalized.includes('device') && normalized.includes('status'));
                  });
                  
                  const noOfDaysOfflineHeader = onlineOfflineHeaders.find((h: string) => {
                    const normalized = normalizeHeader(h);
                    return normalized === 'no of days offline' ||
                           normalized === 'no_of_days_offline' ||
                           normalized === 'noofdaysoffline' ||
                           (normalized.includes('days') && normalized.includes('offline')) ||
                           (normalized.includes('day') && normalized.includes('offline'));
                  });
                  
                  console.log('MY DATA - DEVICE STATUS header found:', deviceStatusHeader);
                  console.log('MY DATA - NO OF DAYS OFFLINE header found:', noOfDaysOfflineHeader);
                  
                  // Build columns to merge: only DEVICE STATUS and NO OF DAYS OFFLINE
                  const onlineOfflineColumns: string[] = [];
                  if (deviceStatusHeader) onlineOfflineColumns.push(deviceStatusHeader);
                  if (noOfDaysOfflineHeader) onlineOfflineColumns.push(noOfDaysOfflineHeader);
                  
                  console.log('MY DATA - ONLINE-OFFLINE columns to merge:', onlineOfflineColumns);
                  
                  // CRITICAL: Store ONLINE-OFFLINE columns in ref so they can be excluded when saving
                  // ONLINE-OFFLINE data is reference data and should NOT be saved to Equipment offline sites
                  onlineOfflineColumnsRef.current = onlineOfflineColumns;
                  
                  // Store merged column names for preservation during header filtering
                  if (deviceStatusHeader) mergedDeviceStatusColumn = deviceStatusHeader;
                  if (noOfDaysOfflineHeader) mergedNoOfDaysOfflineColumn = noOfDaysOfflineHeader;
                  
                  if (mainSiteCodeHeader && onlineOfflineSiteCodeHeader && onlineOfflineColumns.length > 0) {
                    // Create a map of ONLINE-OFFLINE data by SITE CODE
                    const onlineOfflineMap = new Map<string, any>();
                    
                    onlineOfflineRows.forEach((row: any) => {
                      const siteCode = String(row[onlineOfflineSiteCodeHeader] || '').trim();
                      if (siteCode) {
                        // If multiple rows exist for same SITE CODE, keep the latest one
                        if (!onlineOfflineMap.has(siteCode)) {
                          onlineOfflineMap.set(siteCode, row);
                        }
                      }
                    });
                    
                    console.log('MY DATA - Mapped ONLINE-OFFLINE data for', onlineOfflineMap.size, 'unique SITE CODEs');
                    
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
                    
                    console.log('MY DATA - Merged ONLINE-OFFLINE data into', mergedCount, 'rows');
                    
                    // Find RTU MAKE column to insert DEVICE STATUS and NO OF DAYS OFFLINE after it
                    const rtuMakeHeader = hdrs.find((h: string) => {
                      const normalized = normalizeHeader(h);
                      return normalized === 'rtu make' ||
                             normalized === 'rtu_make' ||
                             normalized === 'rtumake' ||
                             (normalized.includes('rtu') && normalized.includes('make'));
                    });
                    
                    console.log('MY DATA - RTU MAKE header found:', rtuMakeHeader);
                    
                    // Insert ONLINE-OFFLINE columns after RTU MAKE
                    if (rtuMakeHeader) {
                      const rtuMakeIndex = hdrs.indexOf(rtuMakeHeader);
                      if (rtuMakeIndex !== -1) {
                        // Only insert columns that aren't already in headers, maintaining order
                        const columnsToAdd = onlineOfflineColumns.filter(col => !hdrs.includes(col));
                        if (columnsToAdd.length > 0) {
                          // Insert columns after RTU MAKE
                          hdrs = [
                            ...hdrs.slice(0, rtuMakeIndex + 1),
                            ...columnsToAdd,
                            ...hdrs.slice(rtuMakeIndex + 1)
                          ];
                          console.log('MY DATA - Inserted ONLINE-OFFLINE columns after RTU MAKE at index', rtuMakeIndex + 1);
                          console.log('MY DATA - Columns inserted:', columnsToAdd);
                        }
                      }
                    } else {
                      // If RTU MAKE not found, add at the end
                      const columnsToAdd = onlineOfflineColumns.filter(col => !hdrs.includes(col));
                      if (columnsToAdd.length > 0) {
                        hdrs = [...hdrs, ...columnsToAdd];
                        console.log('MY DATA - RTU MAKE not found, added ONLINE-OFFLINE columns at the end:', columnsToAdd);
                      }
                    }
                  } else {
                    console.warn('MY DATA - Cannot merge ONLINE-OFFLINE data:`, {
                      hasMainSiteCode: !!mainSiteCodeHeader,
                      hasOnlineOfflineSiteCode: !!onlineOfflineSiteCodeHeader,
                      columnsToInsertCount: onlineOfflineColumns.length
                    });
                  }
                } else {
                  console.warn('MY DATA - ONLINE-OFFLINE file data fetch failed or no data');
                }
              } else {
                console.log('MY DATA - No ONLINE-OFFLINE DATA file found');
              }
            }
          } catch (error) {
            console.error('MY DATA - Error fetching ONLINE-OFFLINE DATA:', error);
            // Continue with main file data even if ONLINE-OFFLINE fetch fails
          }
          
          // Resolve header keys for filtering (before removing columns from display)
          // We need these keys from the original headers to filter the data
          
          
          // Find "DEVICE STATUS" key - handle variations
          // Prefer the merged column if it exists, otherwise find it in headers
          let deviceStatusKey = mergedDeviceStatusColumn;
          if (!deviceStatusKey) {
            deviceStatusKey = hdrs.find((h: string) => {
              const norm = normalizeHeader(h);
              return norm === 'device status' ||
                     norm === 'device_status' ||
                     norm === 'devicestatus' ||
                     (norm.includes('device') && norm.includes('status'));
            });
          }
          console.log('MY DATA - Using deviceStatusKey:', deviceStatusKey, '(merged:', mergedDeviceStatusColumn, ')');
          
          // Find "No of Days Offline" key - handle variations
          // Prefer the merged column if it exists, otherwise find it in headers
          let daysOfflineKey = mergedNoOfDaysOfflineColumn;
          if (!daysOfflineKey) {
            daysOfflineKey = hdrs.find((h: string) => {
              const norm = normalize(h);
              return (norm.includes('days') && norm.includes('offline')) ||
                     norm === 'noofdaysoffline' || norm === 'no_of_days_offline' ||
                     norm === 'no of days offline' || norm === 'numberofdaysoffline' ||
                     norm === 'number_of_days_offline' || norm === 'number of days offline';
            });
          }
          console.log('MY DATA - Using daysOfflineKey:', daysOfflineKey, '(merged:', mergedNoOfDaysOfflineColumn, ')');
          
          // Find ATTRIBUTE column key (case-insensitive)
          const attributeKey = hdrs.find((h: string) => {
            const normalized = normalize(h);
            return normalized === 'attribute' || normalized === 'attributes';
          });
          console.log('MY DATA - Using attributeKey:', attributeKey);
          
          // Find division key - handle variations like "DIVISION", "DIVISION NAME", etc.
          const divisionKey = hdrs.find((h: string) => {
            const norm = normalize(h);
            return norm === 'division' || norm === 'divisionname' || norm === 'division name';
          });
          
          // Use stored merged column names (set during ONLINE-OFFLINE merge)
          // These were merged from ONLINE-OFFLINE file and should not be filtered out
          console.log('MY DATA - Preserving merged columns:`, {
            deviceStatus: mergedDeviceStatusColumn,
            noOfDaysOffline: mergedNoOfDaysOfflineColumn
          });
          
          // Remove unwanted columns (case-insensitive) - handles variations
          hdrs = hdrs.filter((h: string) => {
            const normalized = normalize(h);
            
            // PRESERVE merged ONLINE-OFFLINE columns (DEVICE STATUS and NO OF DAYS OFFLINE)
            if (mergedDeviceStatusColumn && h === mergedDeviceStatusColumn) {
              console.log('MY DATA - Preserving merged DEVICE STATUS column:', h);
              return true;
            }
            if (mergedNoOfDaysOfflineColumn && h === mergedNoOfDaysOfflineColumn) {
              console.log('MY DATA - Preserving merged NO OF DAYS OFFLINE column:', h);
              return true;
            }
            
            // Remove columns containing 'remark'
            if (normalized.includes('remark')) return false;
            
            // Remove CIRCLE
            if (normalized === 'circle') return false;
            
            // Keep DEVICE TYPE for routing logic (don't remove it)
            // Removed: DEVICE TYPE filter to allow routing based on device type
            
            // Remove ATTRIBUTE
            if (normalized === 'attribute') return false;
            
            // Keep DEVICE STATUS - it will be merged from ONLINE-OFFLINE file
            // (Previously filtered out, but now we need it from ONLINE-OFFLINE)
            // Note: This is handled by the preserve check above
            
            // Remove HRN
            if (normalized === 'hrn') return false;
            
            // Remove "No of Days Offline" only for RTU/Communication role users (handles variations)
            // BUT preserve if it's the merged column
            if (userRole === 'RTU/Communication' && 
                ((normalized.includes('days') && normalized.includes('offline')) ||
                normalized === 'noofdaysoffline' || normalized === 'no_of_days_offline' ||
                normalized === 'no of days offline' || normalized === 'numberofdaysoffline' ||
                normalized === 'number_of_days_offline' || normalized === 'number of days offline')) {
              // Only filter if it's NOT the merged column
              if (h !== mergedNoOfDaysOfflineColumn) {
                return false;
              }
            }
            
            // Remove L/R Status (handles variations like "L/R Status", "LR Status", "L R Status", etc.)
            if ((normalized.includes('l') && normalized.includes('r') && normalized.includes('status')) ||
                normalized === 'lrstatus' || normalized === 'l_r_status' || normalized === 'l/rstatus') return false;
            
            // Remove RTU TRACKER OBSERVATION (handles all variations including typo "OBSERBATION")
            // Check if it contains both "rtu" and "tracker" - this catches most variations
            // Also check for exact matches and variations
            const hasRtu = normalized.includes('rtu');
            const hasTracker = normalized.includes('tracker');
            if (hasRtu && hasTracker) {
              console.log('Filtering out RTU TRACKER column:', h, 'normalized:', normalized);
              return false;
            }
            // Also check for exact patterns
            if (normalized.match(/rtu.*tracker/i) || normalized.match(/tracker.*rtu/i)) {
              console.log('Filtering out RTU TRACKER column (pattern match):', h, 'normalized:', normalized);
              return false;
            }
            
            // Remove PRODUCTION OBSERVATIONS (handles variations)
            if ((normalized.includes('production') && normalized.includes('observation')) ||
                normalized === 'productionobservations' || normalized === 'production_observations' ||
                normalized === 'productionobservation' || normalized === 'production_observation') return false;
            
            return true;
          });
          
          // CRITICAL: Ensure merged ONLINE-OFFLINE columns are in headers after filtering
          // If they were filtered out, add them back
          if (mergedDeviceStatusColumn && !hdrs.includes(mergedDeviceStatusColumn)) {
            console.warn('MY DATA - CRITICAL: DEVICE STATUS column missing after filtering, re-adding it');
            // Find RTU MAKE to insert after it
            const rtuMakeIndex = hdrs.findIndex((h: string) => {
              const normalized = normalizeHeader(h);
              return normalized === 'rtu make' ||
                     normalized === 'rtu_make' ||
                     normalized === 'rtumake' ||
                     (normalized.includes('rtu') && normalized.includes('make'));
            });
            if (rtuMakeIndex !== -1) {
              hdrs.splice(rtuMakeIndex + 1, 0, mergedDeviceStatusColumn);
            } else {
              hdrs.push(mergedDeviceStatusColumn);
            }
          }
          
          if (mergedNoOfDaysOfflineColumn && !hdrs.includes(mergedNoOfDaysOfflineColumn)) {
            console.warn('MY DATA - CRITICAL: NO OF DAYS OFFLINE column missing after filtering, re-adding it');
            // Find DEVICE STATUS or RTU MAKE to insert after
            const deviceStatusIndex = hdrs.indexOf(mergedDeviceStatusColumn || '');
            const rtuMakeIndex = hdrs.findIndex((h: string) => {
              const normalized = normalizeHeader(h);
              return normalized === 'rtu make' ||
                     normalized === 'rtu_make' ||
                     normalized === 'rtumake' ||
                     (normalized.includes('rtu') && normalized.includes('make'));
            });
            const insertAfterIndex = deviceStatusIndex !== -1 ? deviceStatusIndex : (rtuMakeIndex !== -1 ? rtuMakeIndex : -1);
            if (insertAfterIndex !== -1) {
              hdrs.splice(insertAfterIndex + 1, 0, mergedNoOfDaysOfflineColumn);
            } else {
              hdrs.push(mergedNoOfDaysOfflineColumn);
            }
          }
          
          // Verify merged columns are in headers
          console.log('MY DATA - Final headers check:`, {
            hasDeviceStatus: hdrs.includes(mergedDeviceStatusColumn || ''),
            hasNoOfDaysOffline: hdrs.includes(mergedNoOfDaysOfflineColumn || ''),
            deviceStatusIndex: hdrs.indexOf(mergedDeviceStatusColumn || ''),
            noOfDaysOfflineIndex: hdrs.indexOf(mergedNoOfDaysOfflineColumn || ''),
            allHeaders: hdrs
          });
          
          // Find the index of "No of Days Offline" column and insert "Site Observations" after it
          const daysOfflineHeaderIndex = hdrs.findIndex((h: string) => {
            const norm = normalize(h);
            return (norm.includes('days') && norm.includes('offline')) ||
                   norm === 'noofdaysoffline' || norm === 'no_of_days_offline' ||
                   norm === 'no of days offline' || norm === 'numberofdaysoffline' ||
                   norm === 'number_of_days_offline' || norm === 'number of days offline';
          });
          
          // Insert "Site Observations" column after "No of Days Offline" if it exists
          if (daysOfflineHeaderIndex !== -1 && !hdrs.includes('Site Observations')) {
            hdrs.splice(daysOfflineHeaderIndex + 1, 0, 'Site Observations');
          } else if (daysOfflineHeaderIndex === -1 && !hdrs.includes('Site Observations')) {
            // If "No of Days Offline" column not found, add "Site Observations" at the end
            hdrs.push('Site Observations');
          }
          
          // Find the index of "Site Observations" column and insert the new columns after it
          const siteObservationsIndex = hdrs.findIndex((h: string) => h === 'Site Observations');
          if (siteObservationsIndex !== -1) {
            // Add the four new columns after Site Observations
            const newColumns = ['Task Status', 'Type of Issue', 'View Photos', 'Remarks'];
            newColumns.forEach((col, idx) => {
              if (!hdrs.includes(col)) {
                hdrs.splice(siteObservationsIndex + 1 + idx, 0, col);
              }
            });
          } else {
            // If Site Observations not found, add all columns at the end
            const newColumns = ['Task Status', 'Type of Issue', 'View Photos', 'Remarks'];
            newColumns.forEach(col => {
              if (!hdrs.includes(col)) {
                hdrs.push(col);
              }
            });
          }
          
          console.log('MY DATA - Setting headers with merged columns:', hdrs);
          
          // CRITICAL: Ensure all rows have the merged columns (even if empty)
          // This ensures the columns show up in the table even if no data was merged
          if (mergedDeviceStatusColumn || mergedNoOfDaysOfflineColumn) {
            const columnsToEnsure: string[] = [];
            if (mergedDeviceStatusColumn) columnsToEnsure.push(mergedDeviceStatusColumn);
            if (mergedNoOfDaysOfflineColumn) columnsToEnsure.push(mergedNoOfDaysOfflineColumn);
            
            fileRows = fileRows.map((row: any) => {
              const updatedRow = { ...row };
              columnsToEnsure.forEach((col: string) => {
                // Only add if it doesn't exist (preserve existing merged values)
                if (!(col in updatedRow)) {
                  updatedRow[col] = '';
                }
              });
              return updatedRow;
            });
            console.log('MY DATA - Ensured all rows have merged columns:', columnsToEnsure);
            console.log('MY DATA - Sample row with merged columns:', fileRows[0]);
          }
          
          setHeaders(hdrs);

          // Apply filters
          let filteredRows = fileRows;
          
          // Filter based on user role
          if (userRole === 'RTU/Communication') {
            // RTU/Communication: Remove all rows, show only headers
            console.log(`MY Data - RTU/Communication role: Removing all rows, showing only headers`);
            filteredRows = [];
          } else if (userRole === 'Equipment') {
            // Equipment: Filter by DEVICE STATUS = "OFFLINE" first, then NO OF DAYS OFFLINE >= 2
            const beforeFilterCount = filteredRows.length;
            
            // Step 1: Filter by DEVICE STATUS = "OFFLINE" (case-insensitive)
            if (deviceStatusKey) {
              const beforeDeviceStatusCount = filteredRows.length;
              
              filteredRows = filteredRows.filter((row: any) => {
                const deviceStatus = String(row[deviceStatusKey] || '').trim();
                // Normalize to handle variations: OFFLINE, offline, Offline, etc.
                const normalizedStatus = normalize(deviceStatus);
                const isOffline = normalizedStatus === 'offline';
                
                return isOffline;
              });
              
              console.log(`MY Data - Equipment DEVICE STATUS filter: ${beforeDeviceStatusCount} rows -> ${filteredRows.length} rows (filtering for DEVICE STATUS = "OFFLINE")`);
            } else {
              console.warn('MY Data - "DEVICE STATUS" column not found in data headers:', hdrs);
              console.warn('MY Data - Available headers:', hdrs);
            }
            
            // Step 2: Filter by NO OF DAYS OFFLINE >= 2
            if (daysOfflineKey) {
              const beforeDaysCount = filteredRows.length;
              
              filteredRows = filteredRows.filter((row: any) => {
                const daysValue = row[daysOfflineKey];
                // Try to parse as number - handle various formats
                let days = 0;
                if (typeof daysValue === 'number') {
                  days = daysValue;
                } else if (typeof daysValue === 'string') {
                  // Remove any non-numeric characters except decimal point
                  const cleaned = daysValue.trim().replace(/[^\d.]/g, '');
                  days = parseFloat(cleaned) || 0;
                }
                
                // Filter if No of Days Offline >= 2
                return days >= 2;
              });
              
              console.log(`MY Data - Equipment NO OF DAYS OFFLINE filter: ${beforeDaysCount} rows -> ${filteredRows.length} rows (filtering for No of Days Offline >= 2)`);
            } else {
              console.warn('MY Data - "No of Days Offline" column not found in data headers:', hdrs);
              console.warn('MY Data - Available headers:', hdrs);
            }
            
            // Step 3: Filter by ATTRIBUTE = "IN PRODUCTION" (case-insensitive)
            if (attributeKey) {
              const beforeAttributeCount = filteredRows.length;
              
              filteredRows = filteredRows.filter((row: any) => {
                const attribute = String(row[attributeKey] || '').trim();
                // Normalize to handle variations: IN PRODUCTION, in production, In Production, etc.
                const normalizedAttribute = normalize(attribute);
                const isInProduction = normalizedAttribute === 'in production';
                
                return isInProduction;
              });
              
              console.log(`MY Data - Equipment ATTRIBUTE filter: ${beforeAttributeCount} rows -> ${filteredRows.length} rows (filtering for ATTRIBUTE = "IN PRODUCTION")`);
            } else {
              console.warn('MY Data - "ATTRIBUTE" column not found in data headers:', hdrs);
              console.warn('MY Data - Available headers:', hdrs);
            }
            
            console.log(`MY Data - Equipment total filter result: ${beforeFilterCount} rows -> ${filteredRows.length} rows (DEVICE STATUS = "OFFLINE" AND No of Days Offline >= 2 AND ATTRIBUTE = "IN PRODUCTION")`);
          }

          // Filter by user's assigned DIVISION (for Equipment role only, RTU/Communication shows no rows)
          if (userRole === 'Equipment') {
            if (!divisionKey) {
              console.warn('MY Data - DIVISION column not found in data headers:', hdrs);
            } else if (userDivisions.length === 0) {
              console.warn('MY Data - User has no divisions assigned. User object:', user);
            } else {
              const beforeCount = filteredRows.length;
              console.log(`MY Data - Applying division filter (${userRole} role):`, {
                divisionKey,
                userDivisions,
                beforeCount
              });
              
              // Sample some divisions from data for debugging
              const sampleDivisions = Array.from(new Set(filteredRows.slice(0, 10).map((r: any) => String(r[divisionKey] || '').trim()))).filter(Boolean);
              console.log('MY Data - Sample divisions in data:', sampleDivisions);
              
              filteredRows = filteredRows.filter((row: any) => {
                const rowDivision = String(row[divisionKey] || '').trim();
                // Check if row's division matches any of user's assigned divisions (case-insensitive)
                // Handles variations like JAYANAGARA vs JAYANAGAR
                const matches = userDivisions.some((div: string) => {
                  const userDiv = normalize(String(div));
                  const dataDiv = normalize(rowDivision);
                  
                  // Exact match
                  if (userDiv === dataDiv) {
                    console.log(`MY Data - Match found: "${div}" (user) === "${rowDivision}" (data)`);
                    return true;
                  }
                  
                  // Check if one contains the other (handles JAYANAGARA vs JAYANAGAR)
                  // Only match if both are similar length (avoid false matches)
                  const lengthDiff = Math.abs(userDiv.length - dataDiv.length);
                  if (lengthDiff <= 1 && (userDiv.includes(dataDiv) || dataDiv.includes(userDiv))) {
                    console.log(`MY Data - Match found (variation): "${div}" (user) ~ "${rowDivision}" (data)`);
                    return true;
                  }
                  
                  return false;
                });
                return matches;
              });
              
              console.log(`MY Data - Division filter applied: ${beforeCount} rows -> ${filteredRows.length} rows`);
              console.log(`MY Data - User divisions: [${userDivisions.map((d: string) => `"${d}"`).join(', ')}]`);
            }
          }
          
          // CRITICAL: Filter out rows with approved CCR approvals before setting rows
          // ALWAYS fetch fresh excludedSiteCodes from API (don't rely on cache for new approvals)
          // This filtering applies to ALL users - approved rows should be hidden for everyone
          let finalFilteredRows = filteredRows;
          if (selectedFile) {
            try {
              // ALWAYS fetch fresh excludedSiteCodes from API to catch newly approved siteCodes
              // Cache can become stale when new approvals happen
              const token = localStorage.getItem('token');
              let excludedSiteCodes: string[] = [];
              
              if (token) {
                const exclusionRes = await fetch(`${API_BASE}/api/equipment-offline-sites/file/${selectedFile}`, {
                  headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (exclusionRes.ok) {
                  const exclusionResult = await exclusionRes.json();
                  if (exclusionResult.success && exclusionResult.excludedSiteCodes) {
                    excludedSiteCodes = exclusionResult.excludedSiteCodes;
                    // Update sessionStorage with fresh data for future use
                    sessionStorage.setItem(`excludedSiteCodes_${selectedFile}`, JSON.stringify(excludedSiteCodes));
                    console.log(`[FILE LOAD] ✅ Fetched FRESH excludedSiteCodes from API:`, excludedSiteCodes);
                  } else {
                    // Fallback to sessionStorage if API doesn't return excludedSiteCodes
                    const excludedSiteCodesStr = sessionStorage.getItem(`excludedSiteCodes_${selectedFile}`);
                    if (excludedSiteCodesStr) {
                      excludedSiteCodes = JSON.parse(excludedSiteCodesStr);
                      console.log(`[FILE LOAD] ⚠️ API didn't return excludedSiteCodes, using cached:`, excludedSiteCodes);
                    }
                  }
                } else {
                  // Fallback to sessionStorage if API request fails
                  const excludedSiteCodesStr = sessionStorage.getItem(`excludedSiteCodes_${selectedFile}`);
                  if (excludedSiteCodesStr) {
                    excludedSiteCodes = JSON.parse(excludedSiteCodesStr);
                    console.log(`[FILE LOAD] ⚠️ API request failed, using cached:`, excludedSiteCodes);
                  }
                }
              }
              
              // Filter rows by excludedSiteCodes
              if (excludedSiteCodes.length > 0) {
                const beforeApprovedFilter = finalFilteredRows.length;
                
                // Normalize excludedSiteCodes to uppercase for comparison
                const normalizedExcludedSiteCodes = excludedSiteCodes.map((code: string) => String(code).trim().toUpperCase());
                
                console.log(`[FILE LOAD] Filtering rows with excludedSiteCodes:`, {
                  excludedSiteCodes: excludedSiteCodes,
                  normalizedExcludedSiteCodes: normalizedExcludedSiteCodes,
                  rowsBeforeFilter: beforeApprovedFilter,
                  note: 'This filters both original AND routed siteCodes (they share the same siteCode)'
                });
                
                // Find siteCode column header
                const siteCodeHeader = hdrs.find((h: string) => {
                  const normalized = normalize(h);
                  return normalized === 'site code' || normalized === 'sitecode' || normalized === 'site_code';
                });
                
                finalFilteredRows = finalFilteredRows.filter((row: any) => {
                  // Get siteCode from row - try multiple column names
                  let siteCode = '';
                  if (siteCodeHeader) {
                    siteCode = String(row[siteCodeHeader] || '').trim().toUpperCase();
                  } else {
                    siteCode = (row['SITE CODE'] || row['Site Code'] || row['site code'] || row['SITECODE'] || row['SiteCode'] || '').trim().toUpperCase();
                  }
                  
                  if (!siteCode) {
                    // If no siteCode found, keep the row (don't exclude)
                    return true;
                  }
                  
                  // Check if siteCode is in excluded list
                  const shouldExclude = normalizedExcludedSiteCodes.includes(siteCode);
                  
                  if (shouldExclude) {
                    console.log(`[FILE LOAD] ❌ HIDING approved row - siteCode: "${siteCode}", matched excludedSiteCodes:`, normalizedExcludedSiteCodes);
                  }
                  
                  return !shouldExclude;
                });
                
                const excludedCount = beforeApprovedFilter - finalFilteredRows.length;
                console.log(`[FILE LOAD] ✅ APPROVED ROWS FILTERED: ${beforeApprovedFilter} rows -> ${finalFilteredRows.length} rows (EXCLUDED ${excludedCount} approved rows)`);
                
                // Log sample of remaining siteCodes for debugging
                if (finalFilteredRows.length > 0) {
                  const remainingSiteCodes = finalFilteredRows.slice(0, 5).map((row: any) => {
                    if (siteCodeHeader) {
                      return String(row[siteCodeHeader] || '').trim().toUpperCase();
                    } else {
                      return (row['SITE CODE'] || row['Site Code'] || row['site code'] || '').trim().toUpperCase();
                    }
                  }).filter((code: string) => code);
                  console.log(`[FILE LOAD] Sample remaining siteCodes (first 5):`, remainingSiteCodes);
                }
              } else {
                console.log(`[FILE LOAD] ⚠️ No excludedSiteCodes found - all rows will be shown`);
              }
            } catch (error) {
              console.error('[FILE LOAD] Error filtering approved rows:', error);
            }
          }
          
          console.log('MY DATA - Final data summary:`, {
            headersCount: hdrs.length,
            filteredRowsCount: finalFilteredRows.length,
            headers: hdrs,
            sampleRow: finalFilteredRows[0],
            hasDeviceStatus: hdrs.includes(mergedDeviceStatusColumn || ''),
            hasNoOfDaysOffline: hdrs.includes(mergedNoOfDaysOfflineColumn || '')
          });
          
          // For RTU/Communication users, ensure no file data rows are set
          if (userRole === 'RTU/Communication') {
            setRows([]);
          } else {
            setRows(finalFilteredRows);
          }
          setHeaders(hdrs); // Ensure headers are set even if rows are empty
          setCurrentPage(1);
        } else {
          console.warn('MY DATA - File fetch failed or no file data');
          setRows([]);
          setHeaders([]);
        }
      } catch (error) {
        console.error('MY DATA - Error in data fetching/merging:', error);
        setRows([]);
        setHeaders([]);
      }
    })();
  }, [selectedFile, userRole, userDivisions, user]);

  // Fetch actions for RTU/Communication, O&M, and other roles to display in MY OFFLINE SITES
  useEffect(() => {
    (async () => {
      // Only fetch for roles that receive actions
      const rolesThatReceiveActions = ['RTU/Communication', 'O&M', 'AMC', 'CCR'];
      if (!rolesThatReceiveActions.includes(userRole)) {
        setActionsRows([]);
        if (userRole !== 'RTU/Communication') {
          setReroutedActionsMap({});
        }
        return;
      }
      
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        
        // Fetch actions assigned to current user
        const res = await fetch(`${API_BASE}/api/actions/my-actions`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        const json = await res.json();
        if (json?.success && Array.isArray(json.actions)) {
          // Filter actions based on user role
          let filteredActions: any[] = [];
          
          if (userRole === 'RTU/Communication') {
            // RTU/Communication: Filter RTU Issue or CS Issue
            filteredActions = json.actions.filter((action: any) => 
              action.typeOfIssue === 'RTU Issue' || action.typeOfIssue === 'CS Issue'
            );
          } else if (userRole === 'O&M') {
            // O&M: Filter O&M-related issues
            const omIssueTypes = ['Faulty', 'Bipassed', 'Line Idel', 'AT Jump cut', 'Dismantled', 'Replaced', 'Equipment Idle', 'Spare Required', 'AT-PT Chamber Flashover'];
            filteredActions = json.actions.filter((action: any) => 
              omIssueTypes.includes(action.typeOfIssue)
            );
          } else if (userRole === 'AMC') {
            // AMC: Filter AMC-related issues (Spare Required, Faulty)
            filteredActions = json.actions.filter((action: any) => 
              action.typeOfIssue === 'Spare Required' || action.typeOfIssue === 'Faulty'
            );
            console.log('AMC actions filtered:', filteredActions.length, 'out of', json.actions.length);
          } else if (userRole === 'CCR') {
            // CCR: Show all actions
            filteredActions = json.actions;
          } else if (userRole === 'Equipment') {
            filteredActions = json.actions.filter((action: any) => 
              action.typeOfIssue === 'AMC Resolution Approval' ||
              action.typeOfIssue === 'RTU Issue' ||
              action.typeOfIssue === 'CS Issue'
            );
          } else {
            // Other roles: Include all RTU/CS issues
            filteredActions = json.actions.filter((action: any) => 
              action.typeOfIssue === 'RTU Issue' || action.typeOfIssue === 'CS Issue'
            );
          }
          
          // Convert actions to row format with rowData
          const actionRows = filteredActions.map((action: any) => {
            // Ensure rowData exists and is an object
            const rowData = action.rowData || {};
            
            // Log for debugging (especially for AMC users)
            if (userRole === 'AMC') {
              console.log('AMC Action rowData:`, {
                actionId: action._id,
                typeOfIssue: action.typeOfIssue,
                hasRowData: !!action.rowData,
                rowDataKeys: action.rowData ? Object.keys(action.rowData) : [],
                rowDataPreview: action.rowData ? JSON.stringify(action.rowData).substring(0, 200) : 'null'
              });
            }
            
            return {
              ...rowData, // Spread rowData first so it can be overridden by action metadata
              _actionId: action._id,
              _routing: action.routing,
              _typeOfIssue: action.typeOfIssue,
              _remarks: action.remarks,
              _photos: action.photo || [], // Include photos from action
              _assignedByUserId: action.assignedByUserId,
              _assignedByRole: action.assignedByRole,
              _assignedToUserId: action.assignedToUserId,
              _assignedToRole: action.assignedToRole,
              _status: action.status,
              _priority: action.priority,
              _sourceFileId: action.sourceFileId,
              _assignedDate: action.assignedDate || action.createdAt
            };
          });
          
          console.log(`Converted ${actionRows.length} actions to rows for ${userRole}`);
          if (actionRows.length > 0 && userRole === 'AMC') {
            console.log('Sample AMC action row:`, {
              keys: Object.keys(actionRows[0]),
              hasRowData: Object.keys(actionRows[0]).length > 20, // More than just metadata fields
              firstRow: actionRows[0]
            });
          }
          
          // For AMC, O&M, and RTU/Communication users: initialize resolved state based on backend action status
          // IMPORTANT: Only mark as resolved if the action is assigned TO the current user
          // O&M users should only see their own O&M action status, not AMC resolution status
          // RTU/Communication users should see resolved state based on their own action status
          if (userRole === 'AMC' || userRole === 'O&M' || userRole === 'RTU/Communication') {
            const updatedSiteObservations: Record<string, string> = { ...siteObservationsRef.current };
            const updatedTaskStatus: Record<string, string> = { ...taskStatusRef.current };

            filteredActions.forEach((action: any) => {
              const status = String(action.status || '').toLowerCase();
              // CRITICAL: Only mark as resolved if this action is assigned TO the current user
              // This ensures O&M users only see their own O&M action status, not AMC's
              const isAssignedToCurrentUser = action.assignedToUserId === user?.userId || 
                                             action.assignedToRole === userRole;
              
              if (status === 'completed' && isAssignedToCurrentUser) {
                const rowKey = generateRowKey(action.sourceFileId, action.rowData || {}, action.headers || []);
                if (!rowKey) return;

                // Mark Site Observations as Resolved (so dropdown shows Resolved and is greyed out)
                // Only if this is the user's own action
                updatedSiteObservations[rowKey] = 'Resolved';

                // For AMC role, reflect their terminal approval status in Task Status
                if (userRole === 'AMC') {
                  // If AMC completed their action, from their perspective it's Approved/closed
                  updatedTaskStatus[rowKey] = 'Approved';
                } else if (userRole === 'O&M') {
                  // For O&M, only show Resolved if THIS O&M action is completed
                  // Don't mark as resolved if only AMC action is completed
                  updatedTaskStatus[rowKey] = 'Resolved';
                } else if (userRole === 'RTU/Communication') {
                  // For RTU/Communication, show Resolved if their action is completed
                  updatedTaskStatus[rowKey] = 'Resolved';
                }
              } else if (status !== 'completed' && isAssignedToCurrentUser) {
                // For pending/in-progress actions assigned to current user, set appropriate status
                const rowKey = generateRowKey(action.sourceFileId, action.rowData || {}, action.headers || []);
                if (!rowKey) return;
                
                // Don't override existing resolved status from other actions
                // Only set if there's no existing status or if it's not resolved
                const existingStatus = updatedTaskStatus[rowKey] || '';
                if (!existingStatus || !existingStatus.toLowerCase().includes('resolved')) {
                  if (userRole === 'O&M') {
                    updatedTaskStatus[rowKey] = 'Pending';
                  } else if (userRole === 'AMC') {
                    // For AMC: Only set "Pending Equipment Approval" if Site Observations is already set
                    // (meaning AMC has submitted and is waiting for Equipment approval)
                    // Otherwise, it's a new action that AMC needs to work on - set to "Pending"
                    const existingSiteObservation = updatedSiteObservations[rowKey] || '';
                    if (existingSiteObservation === 'Resolved' || existingSiteObservation === 'Pending') {
                      // AMC has already submitted - waiting for Equipment approval
                      updatedTaskStatus[rowKey] = 'Pending Equipment Approval';
                    } else {
                      // New action - AMC needs to work on it
                      updatedTaskStatus[rowKey] = 'Pending';
                    }
                  } else if (userRole === 'RTU/Communication') {
                    updatedTaskStatus[rowKey] = 'Pending';
                  }
                }
              }
            });

            setSiteObservations(updatedSiteObservations);
            siteObservationsRef.current = updatedSiteObservations;
            setTaskStatus(updatedTaskStatus);
            taskStatusRef.current = updatedTaskStatus;
          }

          // For O&M users, also fetch actions they rerouted to keep them visible
          // Also preserve existing rerouted actions from state
          if (userRole === 'O&M') {
            // First, preserve existing rerouted actions (where assignedToRole is not O&M but was originally O&M)
            const existingReroutedActions = actionsRows.filter((r: any) => 
              r._assignedToRole !== 'O&M' && 
              r._assignedByRole === 'Equipment' &&
              ['Faulty', 'Bipassed', 'Line Idel', 'AT Jump cut', 'Dismantled', 'Replaced', 'Equipment Idle', 'Spare Required', 'AT-PT Chamber Flashover'].includes(r._typeOfIssue)
            );
            
            // Add existing rerouted actions to actionRows (avoid duplicates)
            const currentActionIds = new Set(actionRows.map((r: any) => r._actionId));
            existingReroutedActions.forEach((r: any) => {
              if (!currentActionIds.has(r._actionId)) {
                actionRows.push(r);
              }
            });
            
            // Also fetch actions they routed (though these won't include rerouted ones)
            try {
              const reroutedRes = await fetch(`${API_BASE}/api/actions/my-routed-actions`, {
                headers: {
                  'Authorization': `Bearer ${token}`
                }
              });
              
              if (reroutedRes.ok) {
                const reroutedJson = await reroutedRes.json();
                if (reroutedJson?.success && Array.isArray(reroutedJson.actions)) {
                  // Filter O&M-related issues that were originally routed by O&M user
                  // OR actions that were rerouted by O&M user (where assignedByRole was O&M at some point)
                  const omIssueTypes = ['Faulty', 'Bipassed', 'Line Idel', 'AT Jump cut', 'Dismantled', 'Replaced', 'Equipment Idle', 'Spare Required', 'AT-PT Chamber Flashover'];
                  const reroutedOMActions = reroutedJson.actions.filter((action: any) => 
                    omIssueTypes.includes(action.typeOfIssue)
                  );
                  
                  // Convert rerouted actions to row format
                  const reroutedActionRows = reroutedOMActions.map((action: any) => ({
                    ...action.rowData,
                    _actionId: action._id,
                    _routing: action.routing,
                    _typeOfIssue: action.typeOfIssue,
                    _remarks: action.remarks,
                    _photos: action.photo || [],
                    _assignedByUserId: action.assignedByUserId,
                    _assignedByRole: action.assignedByRole,
                    _assignedToUserId: action.assignedToUserId,
                    _assignedToRole: action.assignedToRole,
                    _status: action.status,
                    _priority: action.priority,
                    _sourceFileId: action.sourceFileId
                  }));
                  
                  // Merge rerouted actions with current actions (avoid duplicates by actionId)
                  const existingActionIds = new Set(actionRows.map((r: any) => r._actionId));
                  const newReroutedRows = reroutedActionRows.filter((r: any) => !existingActionIds.has(r._actionId));
                  actionRows.push(...newReroutedRows);
                }
              }
            } catch (error) {
              console.error('Error fetching rerouted actions for O&M:', error);
            }
          }
          
          // CRITICAL: Filter actionRows by excludedSiteCodes for ALL users (especially RTU/Communication, O&M, AMC)
          // When CCR approves a siteCode, it should be hidden for ALL users, including those viewing actions
          try {
            const token = localStorage.getItem('token');
            if (token && selectedFile) {
              // Fetch fresh excludedSiteCodes from API
              const exclusionRes = await fetch(`${API_BASE}/api/equipment-offline-sites/file/${selectedFile}`, {
                headers: { 'Authorization': `Bearer ${token}` }
              });
              
              if (exclusionRes.ok) {
                const exclusionResult = await exclusionRes.json();
                if (exclusionResult.success && exclusionResult.excludedSiteCodes && exclusionResult.excludedSiteCodes.length > 0) {
                  const excludedSiteCodes = exclusionResult.excludedSiteCodes.map((code: string) => String(code).trim().toUpperCase());
                  
                  console.log(`[ACTIONS LOAD] Filtering actionRows with excludedSiteCodes:`, excludedSiteCodes);
                  
                  // Filter actionRows by excludedSiteCodes
                  const beforeFilterCount = actionRows.length;
                  const filteredActionRows = actionRows.filter((actionRow: any) => {
                    // Get siteCode from action rowData - try multiple column names
                    const siteCode = (
                      actionRow['SITE CODE'] || 
                      actionRow['Site Code'] || 
                      actionRow['site code'] || 
                      actionRow['SITECODE'] || 
                      actionRow['SiteCode'] || 
                      actionRow['site_code'] || 
                      ''
                    ).trim().toUpperCase();
                    
                    if (!siteCode) {
                      // If no siteCode found, keep the row (don't exclude)
                      return true;
                    }
                    
                    // Check if siteCode is in excluded list
                    const shouldExclude = excludedSiteCodes.includes(siteCode);
                    
                    if (shouldExclude) {
                      console.log(`[ACTIONS LOAD] ❌ HIDING approved action row - siteCode: "${siteCode}"`);
                    }
                    
                    return !shouldExclude;
                  });
                  
                  const excludedCount = beforeFilterCount - filteredActionRows.length;
                  if (excludedCount > 0) {
                    console.log(`[ACTIONS LOAD] ✅ FILTERED actionRows: ${beforeFilterCount} -> ${filteredActionRows.length} (EXCLUDED ${excludedCount} approved action rows)`);
                  }
                  
                  // Update sessionStorage with fresh excludedSiteCodes
                  sessionStorage.setItem(`excludedSiteCodes_${selectedFile}`, JSON.stringify(exclusionResult.excludedSiteCodes));
                  
                  setActionsRows(filteredActionRows);
                  console.log(`Loaded actions for ${userRole}:`, filteredActionRows.length, `(filtered from ${beforeFilterCount})`);
                } else {
                  // No excludedSiteCodes - set all actionRows
                  setActionsRows(actionRows);
                  console.log(`Loaded actions for ${userRole}:`, actionRows.length);
                }
              } else {
                // API request failed - set all actionRows (don't filter)
                setActionsRows(actionRows);
                console.log(`Loaded actions for ${userRole}:`, actionRows.length);
              }
            } else {
              // No token or selectedFile - set all actionRows
              setActionsRows(actionRows);
              console.log(`Loaded actions for ${userRole}:`, actionRows.length);
            }
          } catch (error) {
            console.error('[ACTIONS LOAD] Error filtering actionRows by excludedSiteCodes:', error);
            // On error, set all actionRows (don't filter)
            setActionsRows(actionRows);
            console.log(`Loaded actions for ${userRole}:`, actionRows.length);
          }
          
          // For AMC users, ensure headers are populated from action data if not already set
          if (userRole === 'AMC' && actionRows.length > 0 && headers.length === 0) {
            // Try to get headers from the first action
            const firstAction = filteredActions[0];
            if (firstAction && firstAction.headers && firstAction.headers.length > 0) {
              console.log('Setting headers from action data for AMC user:', firstAction.headers.length);
              // Add necessary columns if not present
              let actionHeaders = [...firstAction.headers];
              if (!actionHeaders.includes('Site Observations')) {
                actionHeaders.push('Site Observations');
              }
              if (!actionHeaders.includes('Task Status')) {
                actionHeaders.push('Task Status');
              }
              if (!actionHeaders.includes('Type of Issue')) {
                actionHeaders.push('Type of Issue');
              }
              if (!actionHeaders.includes('View Photos')) {
                actionHeaders.push('View Photos');
              }
              if (!actionHeaders.includes('Remarks')) {
                actionHeaders.push('Remarks');
              }
              setHeaders(actionHeaders);
            } else if (firstAction && firstAction.rowData) {
              // If no headers in action, extract from rowData keys
              const rowDataKeys = Object.keys(firstAction.rowData);
              console.log('Extracting headers from rowData for AMC user:', rowDataKeys.length);
              // Add necessary columns
              const allHeaders = [...rowDataKeys];
              if (!allHeaders.includes('Site Observations')) {
                allHeaders.push('Site Observations');
              }
              if (!allHeaders.includes('Task Status')) {
                allHeaders.push('Task Status');
              }
              if (!allHeaders.includes('Type of Issue')) {
                allHeaders.push('Type of Issue');
              }
              if (!allHeaders.includes('View Photos')) {
                allHeaders.push('View Photos');
              }
              if (!allHeaders.includes('Remarks')) {
                allHeaders.push('Remarks');
              }
              setHeaders(allHeaders);
            }
          }
        }
        
        // Also fetch actions rerouted by RTU/Communication user (to see status updates)
        if (userRole === 'RTU/Communication') {
          const reroutedRes = await fetch(`${API_BASE}/api/actions/my-routed-actions`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (reroutedRes.ok) {
            const reroutedJson = await reroutedRes.json();
            if (reroutedJson?.success && Array.isArray(reroutedJson.actions)) {
              // Filter only RTU Issue or CS Issue actions that were rerouted
              const reroutedRtuActions = reroutedJson.actions.filter((action: any) => 
                (action.typeOfIssue === 'RTU Issue' || action.typeOfIssue === 'CS Issue') &&
                action.assignedByRole === 'RTU/Communication'
              );
              
              // Create a map by row key for quick lookup
              const reroutedMap: Record<string, any> = {};
              reroutedRtuActions.forEach((action: any) => {
                const rowKey = generateRowKey(action.sourceFileId, action.rowData, action.headers || []);
                reroutedMap[rowKey] = action;
              });
              
              setReroutedActionsMap(reroutedMap);
              console.log('Loaded rerouted actions for RTU/Communication user:', Object.keys(reroutedMap).length);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching actions:', error);
        setActionsRows([]);
        if (userRole === 'RTU/Communication') {
          setReroutedActionsMap({});
        }
      }
    })();
  }, [userRole, user]);

  // Fetch actions routed FROM Equipment users to sync resolved status
  // This also refreshes when rows change to ensure we have the latest action status (including reroutes)
  useEffect(() => {
    (async () => {
      if (userRole !== 'Equipment' && userRole !== 'AMC') {
        setRoutedActionsMap({});
        return;
      }
      
      // For AMC users in MY OFFLINE SITES we intentionally do NOT require row data to be loaded,
      // because actions are rendered from Action documents (rowData) and not from local file rows.
      // Only ensure a file is selected; when no file is selected, clear the map.
      if (!selectedFile) {
        setRoutedActionsMap({});
        return;
      }
      
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        
        const res = await fetch(`${API_BASE}/api/actions/my-routed-actions`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!res.ok) {
          console.error('Failed to fetch routed actions');
          if (userRole === 'AMC') {
            setRoutedActionsMap({});
          }
          return;
        }
        
        const json = await res.json();
        if (!json?.success || !Array.isArray(json.actions)) {
          if (userRole === 'AMC') {
            setRoutedActionsMap({});
          }
          return;
        }
        
        if (userRole === 'Equipment') {
          // Filter RTU Issue, CS Issue, O&M-related issues, and AMC Resolution Approval
          const omIssueTypes = ['Faulty', 'Bipassed', 'Line Idel', 'AT Jump cut', 'Dismantled', 'Replaced', 'Equipment Idle', 'Spare Required', 'AT-PT Chamber Flashover'];
          const routedActions = json.actions.filter((action: any) => 
            action.typeOfIssue === 'RTU Issue' || 
            action.typeOfIssue === 'CS Issue' ||
            action.typeOfIssue === 'AMC Resolution Approval' ||
            omIssueTypes.includes(action.typeOfIssue)
          );
          
          const actionsMap: Record<string, any> = {};
          const actionsArrayMap: Record<string, any[]> = {}; // Store all actions per rowKey
          
          routedActions.forEach((action: any) => {
            const rowKey = generateRowKey(action.sourceFileId, action.rowData, action.headers || []);
            if (!rowKey) return;

            // For AMC Resolution Approval actions, also store by __siteObservationRowKey if available
            const originalRowKey = action.rowData?.__siteObservationRowKey;

            const actionStatus = String(action.status || '').toLowerCase();
            const isCompleted = actionStatus === 'completed';
            const isPending = actionStatus === 'pending' || !actionStatus;
            const destinationRole = action.assignedToRole;
            const vendorName = action.assignedToVendor || action.vendor || '';

            const actionData = {
                ...action,
                _hasOM: destinationRole === 'O&M',
                _hasAMC: destinationRole === 'AMC',
                _hasRTU: destinationRole === 'RTU/Communication',
                _vendorNames: vendorName ? [vendorName] : [],
              };

            // Store all actions in an array
            if (!actionsArrayMap[rowKey]) {
              actionsArrayMap[rowKey] = [];
            }
            // Avoid duplicate actions (same _id)
            const actionId = action._id || action.id;
            if (!actionsArrayMap[rowKey].find(a => (a._id || a.id) === actionId)) {
              actionsArrayMap[rowKey].push(actionData);
            }

            // Also maintain the primary action (for backward compatibility)
            if (!actionsMap[rowKey]) {
              actionsMap[rowKey] = actionData;
            } else {
              const existing = actionsMap[rowKey];

              // Track roles involved for this row
              if (destinationRole === 'O&M') {
                existing._hasOM = true;
              }
              if (destinationRole === 'AMC') {
                existing._hasAMC = true;
                if (vendorName && !existing._vendorNames.includes(vendorName)) {
                  existing._vendorNames.push(vendorName);
                }
              }
              if (destinationRole === 'RTU/Communication') {
                existing._hasRTU = true;
              }

              // Prefer a completed status if any action is completed
              const existingStatus = String(existing.status || '').toLowerCase();
              const existingCompleted = existingStatus === 'completed';

              if (!existingCompleted && isCompleted) {
                actionsMap[rowKey] = {
                  ...existing,
                  ...action,
                  _hasOM: existing._hasOM,
                  _hasAMC: existing._hasAMC,
                  _hasRTU: existing._hasRTU,
                  _vendorNames: existing._vendorNames,
                };
              } else if (isPending && !existingStatus) {
                // If existing has no status but this one is pending, prefer this as primary
                actionsMap[rowKey] = {
                  ...existing,
                  ...action,
                  _hasOM: existing._hasOM,
                  _hasAMC: existing._hasAMC,
                  _hasRTU: existing._hasRTU,
                  _vendorNames: existing._vendorNames,
                };
              }
            }

            // For AMC Resolution Approval actions, also store by original row key for easier lookup
            if (action.typeOfIssue === 'AMC Resolution Approval' && originalRowKey && originalRowKey !== rowKey) {
              if (!actionsArrayMap[originalRowKey]) {
                actionsArrayMap[originalRowKey] = [];
              }
              if (!actionsArrayMap[originalRowKey].find(a => (a._id || a.id) === actionId)) {
                actionsArrayMap[originalRowKey].push(actionData);
              }
              
              if (!actionsMap[originalRowKey] || actionStatus === 'completed') {
                actionsMap[originalRowKey] = actionData;
              }
            }
          });
          
          // Store the actions array map in a way we can access it
          // We'll attach it to the actionsMap for easy access
          (actionsMap as any).__allActions = actionsArrayMap;
          (actionsMap as any).__actionsArrayMap = actionsArrayMap;
          
          setRoutedActionsMap(actionsMap);
          console.log('Loaded routed actions for Equipment user:', Object.keys(actionsMap).length);
          console.log('Sample routed action assignedToRole:', routedActions.length > 0 ? routedActions[0].assignedToRole : 'N/A');
        } else if (userRole === 'AMC') {
          const approvalActions = json.actions.filter((action: any) => 
            action.typeOfIssue === 'AMC Resolution Approval'
          );
          
          const approvalMap: Record<string, any> = {};
          approvalActions.forEach((action: any) => {
            const originalRowKey = action.rowData?.__siteObservationRowKey;
            const generatedKey = generateRowKey(action.sourceFileId, action.rowData, action.headers || []);
            const rowKey = originalRowKey || generatedKey;
            if (!rowKey) return;
            approvalMap[rowKey] = action;
          });
          
          setRoutedActionsMap(approvalMap);
          console.log('Loaded AMC approval actions (mapped by original row key when available):', Object.keys(approvalMap).length);
        }
      } catch (error) {
        console.error('Error fetching routed actions:', error);
        if (userRole === 'AMC') {
          setRoutedActionsMap({});
        }
      }
    })();
  }, [userRole, user, selectedFile, rows.length]);

  useEffect(() => {
    if (userRole !== 'AMC') {
      return;
    }

    // Update Task Status from AMC approval actions and reset Site Observations
    // when Equipment has requested a recheck, so AMC can re-enter details.
    setTaskStatus(prev => {
      let changed = false;
      const updated = { ...prev };

      Object.entries(routedActionsMap).forEach(([rowKey, action]) => {
        if (!rowKey || !action) return;

        let statusLabel = 'Pending Equipment Approval';
        const actionStatus = String(action.status || '').toLowerCase();

        if (actionStatus === 'completed') {
          statusLabel = 'Approved';
        } else if (actionStatus === 'in progress') {
          statusLabel = 'Recheck Requested';

          // When Equipment requests a recheck, clear the previous "Resolved"
          // Site Observations value so AMC user can fill it again.
          const currentSiteObs = siteObservationsRef.current[rowKey];
          if (currentSiteObs) {
            setSiteObservations(prevSiteObs => {
              const nextSiteObs = { ...prevSiteObs };
              delete nextSiteObs[rowKey];
              siteObservationsRef.current = nextSiteObs;
              return nextSiteObs;
            });
          }
        }

        if (updated[rowKey] !== statusLabel) {
          updated[rowKey] = statusLabel;
          changed = true;
        }
      });

      if (changed) {
        taskStatusRef.current = updated;
        return updated;
      }

      return prev;
    });
  }, [userRole, routedActionsMap]);

  // Update Task Status for Equipment role when all actions are resolved
  useEffect(() => {
    if (userRole !== 'Equipment') {
      return;
    }

    // Update Task Status from routing actions when all actions are completed
    // Also check Site Observations - if Resolved, set Task Status to Resolved
    setTaskStatus(prev => {
      let changed = false;
      const updated = { ...prev };

      // Get all actions map
      const allActionsMap = (routedActionsMap as any).__allActions || {};
      
      // First, check ALL rows where Site Observations is "Resolved" and ensure Task Status is "Resolved"
      // This handles the case where user selects "Resolved" in Site Observations dropdown
      // This ensures Task Status persists after page refresh
      Object.keys(siteObservations).forEach(rowKey => {
        const siteObs = siteObservations[rowKey];
        if (siteObs === 'Resolved') {
          // If Site Observations is Resolved, Task Status should always be Resolved
          // This takes priority over routing actions status
          if (updated[rowKey] !== 'Resolved') {
            console.log(`[useEffect] Setting Task Status to Resolved for rowKey ${rowKey} because Site Observations is Resolved`);
            updated[rowKey] = 'Resolved';
            changed = true;
          }
        }
      });
      
      // Iterate through all rowKeys that have actions
      Object.keys(routedActionsMap).forEach(rowKey => {
        const routedAction = routedActionsMap[rowKey];
        if (!routedAction) return;

        // Check if Site Observations is "Resolved" - if so, set Task Status to "Resolved"
        const siteObs = siteObservations[rowKey];
        if (siteObs === 'Resolved') {
          // If Site Observations is Resolved, Task Status should be Resolved
          // (unless there are pending routing actions that need to be shown)
          // But user requirement is: if Resolved is chosen, show Resolved
          if (updated[rowKey] !== 'Resolved') {
            updated[rowKey] = 'Resolved';
            changed = true;
          }
          return; // Skip routing action logic if Site Observations is Resolved
        }

        const actionStatus = String(routedAction.status || '').toLowerCase();
        const currentDestinationRole = routedAction.assignedToRole;
        const vendorNames: string[] = Array.isArray(routedAction._vendorNames)
          ? routedAction._vendorNames
          : [];
        const allActionsForRow = allActionsMap[rowKey] || [];

        if (actionStatus === 'completed') {
          // If this routed action represents AMC/vendor work that is now completed,
          // show it explicitly as resolved at the Vendor/AMC for Equipment users.
          // BUT also check if there are other pending routings (e.g., O&M) that should still be shown
          const issueType = (routedAction.typeOfIssue || '').toString();
          const isAMCIssue =
            routedAction._hasAMC ||
            currentDestinationRole === 'AMC' ||
            issueType === 'Spare Required' ||
            issueType === 'Faulty';

          const parts: string[] = [];

          if (isAMCIssue) {
            if (vendorNames.length > 0) {
              const uniqueVendors = Array.from(new Set(vendorNames)).join(', ');
              parts.push(`Resolved at Vendor (${uniqueVendors})`);
            } else {
              parts.push('Resolved at AMC Team');
            }
          } else {
            parts.push('Resolved');
          }
          
          // Check if there are other pending routings that should still be shown
          // O&M routing part (if still pending)
          if (routedAction._hasOM) {
            // Check if there's a separate O&M action that's still pending
            const allRoutedActions = Object.values(routedActionsMap).filter((a: any) => 
              a && typeof a === 'object' && a._hasOM
            );
            
            // Check if any O&M action is still pending
            const hasPendingOM = allActionsForRow.some((a: any) => 
              a.assignedToRole === 'O&M' && 
              String(a.status || '').toLowerCase() !== 'completed'
            ) || allRoutedActions.some((a: any) => {
              // Match by row data to find O&M action for same row
              const aSiteCode = a.rowData?.['Site Code'] || a.rowData?.['SITE CODE'] || a.rowData?.['SiteCode'] || '';
              const routedActionSiteCode = routedAction.rowData?.['Site Code'] || routedAction.rowData?.['SITE CODE'] || routedAction.rowData?.['SiteCode'] || '';
              return a.assignedToRole === 'O&M' && 
                     String(a.status || '').toLowerCase() !== 'completed' &&
                     aSiteCode === routedActionSiteCode &&
                     aSiteCode !== '';
            });
            
            if (hasPendingOM) {
              parts.push('Pending at O&M Team');
            }
          }
          
          // RTU/Communication routing part (if still pending)
          if (routedAction._hasRTU) {
            const allRoutedActions = Object.values(routedActionsMap).filter((a: any) => 
              a && typeof a === 'object' && a._hasRTU
            );
            
            const hasPendingRTU = allActionsForRow.some((a: any) => 
              a.assignedToRole === 'RTU/Communication' && 
              String(a.status || '').toLowerCase() !== 'completed'
            ) || allRoutedActions.some((a: any) => {
              // Match by row data to find RTU action for same row
              const aSiteCode = a.rowData?.['Site Code'] || a.rowData?.['SITE CODE'] || a.rowData?.['SiteCode'] || '';
              const routedActionSiteCode = routedAction.rowData?.['Site Code'] || routedAction.rowData?.['SITE CODE'] || routedAction.rowData?.['SiteCode'] || '';
              return a.assignedToRole === 'RTU/Communication' && 
                     String(a.status || '').toLowerCase() !== 'completed' &&
                     aSiteCode === routedActionSiteCode &&
                     aSiteCode !== '';
            });
            
            if (hasPendingRTU) {
              parts.push('Pending at RTU/Communication Team');
            }
          }
          
          const displayValue = parts.join('; ');
          // Only update if different from current status
          if (updated[rowKey] !== displayValue) {
            updated[rowKey] = displayValue;
            changed = true;
          }
        } else {
          // Build consolidated status based on all routed actions for this row
          const parts: string[] = [];

          // O&M routing part
          if (routedAction._hasOM || currentDestinationRole === 'O&M') {
            parts.push('Pending at O&M Team');
          }

          // AMC / vendor routing part
          if (routedAction._hasAMC || currentDestinationRole === 'AMC') {
            if (vendorNames.length > 0) {
              const uniqueVendors = Array.from(new Set(vendorNames)).join(', ');
              parts.push(`Pending at Vendor (${uniqueVendors})`);
            } else {
              parts.push('Pending at AMC Team');
            }
          }

          // RTU/Communication routing part
          if (routedAction._hasRTU || currentDestinationRole === 'RTU/Communication') {
            parts.push('Pending at RTU/Communication Team');
          }

          if (parts.length > 0) {
            const displayValue = parts.join('; ');
            // Only update if different from current status
            if (updated[rowKey] !== displayValue) {
              updated[rowKey] = displayValue;
              changed = true;
            }
          } else if (currentDestinationRole) {
            // Fallback: Action has been rerouted to another team
            const destinationTeam = getTeamNameFromRole(currentDestinationRole);
            const displayValue = `Pending at ${destinationTeam}`;
            if (updated[rowKey] !== displayValue) {
              updated[rowKey] = displayValue;
              changed = true;
            }
          } else {
            // Still at original destination - default to RTU/Communication for RTU/CS issues
            const displayValue = 'Pending at RTU/Communication Team';
            if (updated[rowKey] !== displayValue) {
              updated[rowKey] = displayValue;
              changed = true;
            }
          }
        }
      });

      if (changed) {
        taskStatusRef.current = updated;
        return updated;
      }

      return prev;
    });
  }, [userRole, routedActionsMap, siteObservations]);

  // Reset dataLoadedRef when file changes
  useEffect(() => {
    dataLoadedRef.current = '';
    isLoadingRef.current = false;
    persistenceCheckRef.current = false; // Reset persistence check when file changes
  }, [selectedFile]);

  // Load site observations by Site Code from My Sites dialog and API
  useEffect(() => {
    const loadSiteObservationsBySiteCode = async () => {
      try {
        const globalKey = 'mySitesObservationsBySiteCode';
        
        // First, try to load from API (for sync with mobile app)
        let apiObservationsMap: Record<string, any> = {};
        try {
          const token = localStorage.getItem('token');
          if (token) {
            const response = await fetch(`${API_BASE}/api/site-observations`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            });
            
            if (response.ok) {
              const data = await response.json();
              if (data.success && data.data) {
                // Convert API data format to match localStorage format
                // API returns: { siteCode1: {...}, siteCode2: {...} }
                apiObservationsMap = data.data;
                console.log(`Loaded ${Object.keys(apiObservationsMap).length} site observations from API`);
              }
            }
          }
        } catch (apiError) {
          console.warn('Error loading site observations from API:', apiError);
        }
        
        // Then, load from localStorage
        const saved = localStorage.getItem(globalKey);
        let localStorageMap: Record<string, any> = {};
        if (saved) {
          try {
            localStorageMap = JSON.parse(saved);
          } catch (parseError) {
            console.error('Error parsing localStorage site observations:', parseError);
          }
        }
        
        // Merge: API data takes priority, then localStorage
        // This ensures mobile app updates are reflected in web app
        const mergedMap: Record<string, any> = { ...localStorageMap, ...apiObservationsMap };
        
        // Update state and ref
        setSiteObservationsBySiteCode(mergedMap);
        siteObservationsBySiteCodeRef.current = mergedMap;
        
        // Save merged data back to localStorage for offline access
        if (Object.keys(mergedMap).length > 0) {
          localStorage.setItem(globalKey, JSON.stringify(mergedMap));
        }
        
        console.log('Loaded site observations by Site Code:`, {
          fromAPI: Object.keys(apiObservationsMap).length,
          fromLocalStorage: Object.keys(localStorageMap).length,
          merged: Object.keys(mergedMap).length,
        });
      } catch (error) {
        console.error('Error loading site observations by Site Code:', error);
      }
    };
    
    // Load on mount
    loadSiteObservationsBySiteCode();
    
    // Listen for storage events to reload when updated from My Sites dialog (cross-tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'mySitesObservationsBySiteCode') {
        console.log('Storage event detected for mySitesObservationsBySiteCode, reloading...');
        loadSiteObservationsBySiteCode();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for custom events (for same-window updates)
    const handleCustomStorageChange = () => {
      console.log('Custom event mySitesObservationsUpdated detected, reloading...');
      // Use a small delay to ensure localStorage is fully written
      setTimeout(() => {
        loadSiteObservationsBySiteCode();
      }, 50);
    };
    
    window.addEventListener('mySitesObservationsUpdated', handleCustomStorageChange);
    
    // Also set up a periodic check (every 5 seconds) to catch any missed updates from API
    // This is a fallback in case events don't fire properly and to sync with mobile app
    const intervalId = setInterval(async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        
        const response = await fetch(`${API_BASE}/api/site-observations`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            const apiObservationsMap = data.data;
            const currentKeys = Object.keys(siteObservationsBySiteCodeRef.current);
            const newKeys = Object.keys(apiObservationsMap);
            
            // Check if there are new entries or if the map has changed
            if (newKeys.length !== currentKeys.length || 
                newKeys.some(key => !currentKeys.includes(key) || 
                JSON.stringify(apiObservationsMap[key]) !== JSON.stringify(siteObservationsBySiteCodeRef.current[key]))) {
              console.log('Periodic check detected changes in site observations from API, reloading...');
              
              // Merge with localStorage
              const globalKey = 'mySitesObservationsBySiteCode';
              const saved = localStorage.getItem(globalKey);
              let localStorageMap: Record<string, any> = {};
              if (saved) {
                try {
                  localStorageMap = JSON.parse(saved);
                } catch (parseError) {
                  console.error('Error parsing localStorage:', parseError);
                }
              }
              
              // API data takes priority
              const mergedMap = { ...localStorageMap, ...apiObservationsMap };
              setSiteObservationsBySiteCode(mergedMap);
              siteObservationsBySiteCodeRef.current = mergedMap;
              
              // CRITICAL: If Site Observations from API is "Resolved", update Task Status to "Resolved"
              // This ensures Task Status persists when site observations are reloaded from API
              // Use a setTimeout to ensure this runs after state updates
              if (userRole === 'Equipment') {
                setTimeout(() => {
                  setTaskStatus(prev => {
                    let changed = false;
                    const updated = { ...prev };
                    
                    // Check all rows and update Task Status if Site Observations is Resolved
                    const currentRows = rowsRef.current;
                    const currentHeaders = headersRef.current;
                    const currentFile = selectedFile;
                    
                    if (currentRows && currentRows.length > 0 && currentHeaders && currentHeaders.length > 0 && currentFile) {
                      currentRows.forEach((row: any) => {
                        const siteCode = row['Site Code'] || row['SITE CODE'] || row['SiteCode'] || row['Site_Code'] || row['site code'] || '';
                        if (!siteCode) return;
                        
                        const normalizedSiteCode = String(siteCode).trim().toUpperCase();
                        const observationData = mergedMap[normalizedSiteCode];
                        
                        if (observationData && observationData.status === 'Resolved') {
                          const rowKey = generateRowKey(currentFile, row, currentHeaders);
                          if (rowKey && updated[rowKey] !== 'Resolved') {
                            console.log(`[API Reload] Setting Task Status to Resolved for rowKey ${rowKey} because Site Observations from API is Resolved`);
                            updated[rowKey] = 'Resolved';
                            changed = true;
                          }
                        }
                      });
                    }
                    
                    if (changed) {
                      taskStatusRef.current = updated;
                      return updated;
                    }
                    
                    return prev;
                  });
                }, 100);
              }
              
              // Save merged data back to localStorage
              localStorage.setItem(globalKey, JSON.stringify(mergedMap));
            }
          }
        }
      } catch (error) {
        // Silently ignore API errors in periodic check
        console.debug('Periodic API check error (non-critical):', error);
      }
    }, 5000); // Check every 5 seconds
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('mySitesObservationsUpdated', handleCustomStorageChange);
      clearInterval(intervalId);
    };
  }, []); // Load once on mount and set up listeners

  // Helper function to get observation data by Site Code
  const getObservationDataBySiteCode = useCallback((row: any): any => {
    const siteCode = row['Site Code'] || row['SITE CODE'] || row['SiteCode'] || row['Site_Code'] || row['site code'] || '';
    if (siteCode) {
      const normalizedSiteCode = String(siteCode).trim().toUpperCase();
      return siteObservationsBySiteCode[normalizedSiteCode] || null;
    }
    return null;
  }, [siteObservationsBySiteCode]);

  // Helper function to get site observation value (checks both rowKey and Site Code)
  const getSiteObservationValue = useCallback((rowKey: string, row: any): string => {
    // First check rowKey-based observation (existing behavior)
    if (siteObservations[rowKey]) {
      return siteObservations[rowKey];
    }
    
    // Then check Site Code-based observation from My Sites dialog
    const observationData = getObservationDataBySiteCode(row);
    if (observationData && observationData.status) {
      const siteCode = row['Site Code'] || row['SITE CODE'] || row['SiteCode'] || row['Site_Code'] || row['site code'] || '';
      const normalizedSiteCode = siteCode.trim().toUpperCase();
      
      // Only log once per site code to reduce console noise
      if (normalizedSiteCode && !loggedSiteCodesRef.current.has(normalizedSiteCode)) {
        console.log(`Found site observation for Site Code: ${normalizedSiteCode}, Status: ${observationData.status}`);
        loggedSiteCodesRef.current.add(normalizedSiteCode);
        
        // Clear the set after a delay to allow re-logging if data changes
        setTimeout(() => {
          loggedSiteCodesRef.current.delete(normalizedSiteCode);
        }, 5000);
      }
      
      return observationData.status;
    }
    
    return '';
  }, [siteObservations, getObservationDataBySiteCode]);

  // Note: Task Status is NOT retrieved from Site Code-based storage
  // Task Status with routing info (like "Pending at O&M Team; Pending at Vendor...") 
  // is calculated from routing actions in MY OFFLINE SITES and should ALWAYS come from there
  // Task Status from My Sites Dialog is NOT saved - it comes from routing actions

  // Helper function to get Type of Issue (checks both rowKey and Site Code)
  const getTypeOfIssueValue = useCallback((rowKey: string, row: any): string => {
    // First check rowKey-based type of issue (existing behavior)
    if (typeOfIssue[rowKey]) {
      return typeOfIssue[rowKey];
    }
    
    // Then check Site Code-based observation from My Sites dialog
    const observationData = getObservationDataBySiteCode(row);
    if (observationData && observationData.typeOfIssue) {
      return observationData.typeOfIssue;
    }
    
    return '';
  }, [typeOfIssue, getObservationDataBySiteCode]);

  // Helper function to get View Photos (checks both rowKey and Site Code)
  // Priority: Site Code-based (from API/mobile) > rowKey-based
  const getViewPhotosValue = useCallback((rowKey: string, row: any): string[] => {
    // First check Site Code-based observation (from API/mobile app) - takes priority
    const observationData = getObservationDataBySiteCode(row);
    if (observationData && observationData.viewPhotos && observationData.viewPhotos.length > 0) {
      return observationData.viewPhotos;
    }
    
    // Then check rowKey-based view photos (existing behavior)
    if (viewPhotos[rowKey] && viewPhotos[rowKey].length > 0) {
      return viewPhotos[rowKey];
    }
    
    return [];
  }, [viewPhotos, getObservationDataBySiteCode]);

  // Helper function to get Remarks (checks both rowKey and Site Code)
  // Priority: Site Code-based (from API/mobile) > rowKey-based
  const getRemarksValue = useCallback((rowKey: string, row: any): string => {
    // First check Site Code-based observation (from API/mobile app) - takes priority
    const observationData = getObservationDataBySiteCode(row);
    if (observationData && observationData.remarks) {
      return observationData.remarks;
    }
    
    // Then check rowKey-based remarks (existing behavior)
    if (remarks[rowKey]) {
      return remarks[rowKey];
    }
    
    return '';
  }, [remarks, getObservationDataBySiteCode]);

  // Load persisted data when rows/actions and headers are set and selectedFile is available
  useEffect(() => {
    (async () => {
      const hasAnyRows = (rows?.length ?? 0) > 0 || (actionsRows?.length ?? 0) > 0;
      if (selectedFile && hasAnyRows && (headers?.length ?? 0) > 0 && dataLoadedRef.current !== selectedFile) {
        const storageKey = `myData_${selectedFile}`;
        try {
          isLoadingRef.current = true; // Set loading flag
          
          // For RTU/Communication users: Don't load from localStorage, but preserve resolved state from actions
          // The resolved state is initialized from backend actions (completed actions) and should persist
          if (userRole === 'RTU/Communication') {
            console.log('MY Data - RTU/Communication role: Not loading from localStorage, resolved state comes from actions');
            // Only clear localStorage to prevent loading stale data
            // DO NOT clear state here - it's already been set from actions
            localStorage.removeItem(storageKey);
            
            isLoadingRef.current = false;
            return; // Don't load any saved data from localStorage for RTU/Communication users
            // Resolved state is already set from backend actions in the action loading section
          }
          
          // For Equipment role users: Load from EquipmentOfflineSites database instead of localStorage
          if (userRole === 'Equipment') {
            console.log('MY Data - Equipment role: Loading from EquipmentOfflineSites database');
            await loadFromEquipmentOfflineSitesDB();
            isLoadingRef.current = false;
            dataLoadedRef.current = selectedFile;
            return; // Don't load from localStorage for Equipment users
          }
          
          // First, try to load from API (for sync with mobile app)
          let apiData = null;
          try {
            apiData = await loadUserDataState(selectedFile);
          } catch (error) {
            console.warn('Error loading from API, falling back to localStorage:', error);
          }
          
          // Use API data if available, otherwise fall back to localStorage
          const savedData = apiData ? JSON.stringify(apiData) : localStorage.getItem(storageKey);
          if (savedData) {
            const parsed = apiData || JSON.parse(savedData);
            
            // If we loaded from API, also save to localStorage for offline access
            if (apiData) {
              try {
                localStorage.setItem(storageKey, JSON.stringify(parsed));
                console.log('Saved API data to localStorage for offline access');
              } catch (error) {
                console.warn('Error saving API data to localStorage:', error);
              }
            }
            
            console.log('Loading persisted data:`, {
              source: apiData ? 'API' : 'localStorage',
              file: selectedFile,
              rowsCount: rows.length,
              headersCount: headers.length,
              siteObservations: Object.keys(parsed.siteObservations || {}).length,
              taskStatus: Object.keys(parsed.taskStatus || {}).length,
              typeOfIssue: Object.keys(parsed.typeOfIssue || {}).length,
              viewPhotos: Object.keys(parsed.viewPhotos || {}).length,
              remarks: Object.keys(parsed.remarks || {}).length,
              photoMetadata: Object.keys(parsed.photoMetadata || {}).length
            });
            
            // Debug: Show actual saved data structure
            console.log('Actual saved data structure:`, {
              siteObservationsKeys: Object.keys(parsed.siteObservations || {}),
              siteObservationsSample: Object.entries(parsed.siteObservations || {}).slice(0, 2),
              taskStatusKeys: Object.keys(parsed.taskStatus || {}),
              typeOfIssueKeys: Object.keys(parsed.typeOfIssue || {})
            });
            
            // Generate sample row keys to verify they match
            const sourceRowsForSample = rows.length > 0 ? rows : actionsRows;
            if (sourceRowsForSample.length > 0) {
              const sampleRow = sourceRowsForSample[0];
              const sampleRowKey = generateRowKey(selectedFile, sampleRow, headers);
              const savedKeys = Object.keys(parsed.siteObservations || {});
              console.log('Sample generated row key:', sampleRowKey);
              console.log('Sample row data:`, {
                first3Headers: headers.slice(0, 3),
                first3Values: headers.slice(0, 3).map((h: string) => sampleRow[h])
              });
              console.log('Sample saved row keys:', savedKeys.slice(0, 3));
              console.log('Key match check:', savedKeys.includes(sampleRowKey));
            }
            
            // Only load if we have actual data (non-empty objects)
            const hasData = Object.keys(parsed.siteObservations || {}).length > 0 || 
                            Object.keys(parsed.taskStatus || {}).length > 0 ||
                            Object.keys(parsed.typeOfIssue || {}).length > 0 ||
                            Object.keys(parsed.viewPhotos || {}).length > 0 ||
                            Object.keys(parsed.remarks || {}).length > 0 ||
                            Object.keys(parsed.photoMetadata || {}).length > 0;
            
            if (hasData) {
              // Check if data exists but keys don't match (old format vs new format)
              const hasOldFormatData = parsed.siteObservations && Object.keys(parsed.siteObservations).length > 0;
              if (hasOldFormatData && hasAnyRows && headers.length > 0) {
              console.log('Detected old format data. Attempting to migrate...');
              const oldKeys = Object.keys(parsed.siteObservations);
              const migratedSiteObservations: Record<string, string> = {};
              const migratedTaskStatus: Record<string, string> = {};
              const migratedTypeOfIssue: Record<string, string> = {};
              const migratedViewPhotos: Record<string, string[]> = {};
            const migratedRemarks: Record<string, string> = {};
            const migratedPhotoMetadata: Record<string, Array<{ latitude?: number; longitude?: number; timestamp?: string; location?: string }>> = {};
            const migratedSupportDocuments: Record<string, Array<{ name: string; data: string }>> = {};
            
            // Try to match old keys to new keys by finding matching rows
              const sourceRowsForMigration = rows.length > 0 ? rows : actionsRows;
              sourceRowsForMigration.forEach((row: any) => {
                const newKey = generateRowKey(selectedFile, row, headers);
                // Try to find matching old key by checking if any old key matches this row's data
                const matchedOldKey = oldKeys.find(oldKey => {
                  // Extract the row identifier from old key (after fileId-)
                  const oldRowId = oldKey.replace(`${selectedFile}-`, '');
                  // Try to match using old format: first 3 values
                  const oldKeyParts = oldRowId.split('|');
                  if (oldKeyParts.length >= 3) {
                    // Check if this row matches the old key parts
                    const rowValues = Object.values(row).slice(0, 3).map(v => String(v));
                    return oldKeyParts.every((part, idx) => part === rowValues[idx]);
                  }
                  return false;
                });
                
                if (matchedOldKey) {
                  // Migrate data from old key to new key
                  if (parsed.siteObservations[matchedOldKey]) {
                    migratedSiteObservations[newKey] = parsed.siteObservations[matchedOldKey];
                  }
                  if (parsed.taskStatus && parsed.taskStatus[matchedOldKey]) {
                    migratedTaskStatus[newKey] = parsed.taskStatus[matchedOldKey];
                  }
                  if (parsed.typeOfIssue && parsed.typeOfIssue[matchedOldKey]) {
                    migratedTypeOfIssue[newKey] = parsed.typeOfIssue[matchedOldKey];
                  }
                  if (parsed.viewPhotos && parsed.viewPhotos[matchedOldKey]) {
                    migratedViewPhotos[newKey] = parsed.viewPhotos[matchedOldKey];
                  }
                  if (parsed.remarks && parsed.remarks[matchedOldKey]) {
                    migratedRemarks[newKey] = parsed.remarks[matchedOldKey];
                  }
                  if (parsed.photoMetadata && parsed.photoMetadata[matchedOldKey]) {
                    migratedPhotoMetadata[newKey] = parsed.photoMetadata[matchedOldKey];
                  }
                  if (parsed.supportDocuments && parsed.supportDocuments[matchedOldKey]) {
                    migratedSupportDocuments[newKey] = parsed.supportDocuments[matchedOldKey];
                  }
                }
              });
              
              console.log('Migration result:`, {
                oldKeys: oldKeys.length,
                migrated: Object.keys(migratedSiteObservations).length
              });
              
              // Use migrated data if migration was successful
              if (Object.keys(migratedSiteObservations).length > 0) {
                console.log('Migration successful - setting migrated data');
                setSiteObservations(migratedSiteObservations);
                siteObservationsRef.current = migratedSiteObservations;
                if (Object.keys(migratedTaskStatus).length > 0) {
                  setTaskStatus(migratedTaskStatus);
                  taskStatusRef.current = migratedTaskStatus;
                }
                if (Object.keys(migratedTypeOfIssue).length > 0) {
                  setTypeOfIssue(migratedTypeOfIssue);
                  typeOfIssueRef.current = migratedTypeOfIssue;
                }
                if (Object.keys(migratedViewPhotos).length > 0) {
                  setViewPhotos(migratedViewPhotos);
                  viewPhotosRef.current = migratedViewPhotos;
                }
                if (Object.keys(migratedRemarks).length > 0) {
                  setRemarks(migratedRemarks);
                  remarksRef.current = migratedRemarks;
                }
                if (Object.keys(migratedPhotoMetadata).length > 0) {
                  setPhotoMetadata(migratedPhotoMetadata);
                  photoMetadataRef.current = migratedPhotoMetadata;
                }
                if (Object.keys(migratedSupportDocuments).length > 0) {
                  setSupportDocuments(migratedSupportDocuments);
                  supportDocumentsRef.current = migratedSupportDocuments;
                }
              } else {
                // If migration failed, use original data (might still work if keys match)
                console.log('Migration failed - using original data');
                if (parsed.siteObservations) {
                  setSiteObservations(parsed.siteObservations);
                  siteObservationsRef.current = parsed.siteObservations;
                }
                if (parsed.taskStatus) {
                  setTaskStatus(parsed.taskStatus);
                  taskStatusRef.current = parsed.taskStatus;
                }
                if (parsed.typeOfIssue) {
                  setTypeOfIssue(parsed.typeOfIssue);
                  typeOfIssueRef.current = parsed.typeOfIssue;
                }
                if (parsed.viewPhotos) {
                  setViewPhotos(parsed.viewPhotos);
                  viewPhotosRef.current = parsed.viewPhotos;
                }
                if (parsed.remarks) {
                  setRemarks(parsed.remarks);
                  remarksRef.current = parsed.remarks;
                }
                if (parsed.photoMetadata) {
                  setPhotoMetadata(parsed.photoMetadata);
                  photoMetadataRef.current = parsed.photoMetadata;
                }
                if (parsed.supportDocuments) {
                  setSupportDocuments(parsed.supportDocuments);
                  supportDocumentsRef.current = parsed.supportDocuments;
                }
              }
            } else {
              // New format data - load normally
              // IMPORTANT: Replace state completely, don't merge, to ensure resolved status persists
              if (parsed.siteObservations) {
                console.log('Setting siteObservations:', Object.keys(parsed.siteObservations).length, 'entries');
                console.log('Resolved entries:', Object.entries(parsed.siteObservations).filter(([_key, value]) => value === 'Resolved').length);
                // Replace completely to ensure resolved status is preserved
                setSiteObservations(parsed.siteObservations);
                // Also update ref immediately
                siteObservationsRef.current = parsed.siteObservations;
              }
              if (parsed.taskStatus) {
                console.log('Setting taskStatus:', Object.keys(parsed.taskStatus).length, 'entries');
                setTaskStatus(parsed.taskStatus);
                taskStatusRef.current = parsed.taskStatus;
              }
              if (parsed.typeOfIssue) {
                console.log('Setting typeOfIssue:', Object.keys(parsed.typeOfIssue).length, 'entries');
                setTypeOfIssue(parsed.typeOfIssue);
                typeOfIssueRef.current = parsed.typeOfIssue;
              }
              if (parsed.viewPhotos) {
                console.log('Setting viewPhotos:', Object.keys(parsed.viewPhotos).length, 'entries');
                setViewPhotos(parsed.viewPhotos);
                viewPhotosRef.current = parsed.viewPhotos;
              }
              if (parsed.remarks) {
                console.log('Setting remarks:', Object.keys(parsed.remarks).length, 'entries');
                setRemarks(parsed.remarks);
                remarksRef.current = parsed.remarks;
              }
              if (parsed.photoMetadata) {
                console.log('Setting photoMetadata:', Object.keys(parsed.photoMetadata).length, 'entries');
                setPhotoMetadata(parsed.photoMetadata);
                photoMetadataRef.current = parsed.photoMetadata;
              }
              if (parsed.supportDocuments) {
                console.log('Setting supportDocuments:', Object.keys(parsed.supportDocuments).length, 'entries');
                setSupportDocuments(parsed.supportDocuments);
                supportDocumentsRef.current = parsed.supportDocuments;
              }
            }
          } else {
            console.log('No data found in localStorage - skipping load');
          }
          
          // Mark this file as loaded and clear loading flag after a short delay
          dataLoadedRef.current = selectedFile;
          setTimeout(() => {
            isLoadingRef.current = false;
            console.log('Finished loading data, save operations can now proceed');
            // Verify resolved status was loaded correctly
            const resolvedCount = Object.values(siteObservationsRef.current).filter(v => v === 'Resolved').length;
            console.log('Verified resolved entries after load:', resolvedCount);
          }, 500);
        } else {
          isLoadingRef.current = false;
        }
        } catch (error) {
          console.error('Error loading persisted data:', error);
          isLoadingRef.current = false;
        }
      } else {
        isLoadingRef.current = false;
      }
    })();
  }, [selectedFile, rows.length, headers.length]);
  
  // Additional effect to ensure data persists after login - reload if we detect localStorage has data but state is empty
  // This helps catch cases where data wasn't loaded properly on initial mount
  useEffect(() => {
    if (selectedFile && rows.length > 0 && headers.length > 0 && dataLoadedRef.current === selectedFile && !persistenceCheckRef.current) {
      const storageKey = `myData_${selectedFile}`;
      
      // Clear localStorage and all row data for RTU/Communication users in MY OFFLINE SITES
      if (userRole === 'RTU/Communication') {
        localStorage.removeItem(storageKey);
        
        // Clear all row data state
        setSiteObservations({});
        setTaskStatus({});
        setTypeOfIssue({});
        setViewPhotos({});
        setRemarks({});
        setPhotoMetadata({});
        setSupportDocuments({});
        
        // Clear refs
        siteObservationsRef.current = {};
        taskStatusRef.current = {};
        typeOfIssueRef.current = {};
        viewPhotosRef.current = {};
        remarksRef.current = {};
        photoMetadataRef.current = {};
        supportDocumentsRef.current = {};
        
        return; // Don't load any saved data for RTU/Communication users
      }
      
      const savedData = localStorage.getItem(storageKey);
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          const hasResolvedData = parsed.siteObservations && Object.keys(parsed.siteObservations).length > 0;
          const stateHasData = siteObservations && Object.keys(siteObservations).length > 0;
          
          // If localStorage has resolved data but state doesn't, reload it (only once per file)
          if (hasResolvedData && !stateHasData) {
            console.log('Detected mismatch: localStorage has data but state is empty. Reloading...');
            console.log('Resolved entries in localStorage:', Object.entries(parsed.siteObservations).filter(([_key, value]) => value === 'Resolved').length);
            persistenceCheckRef.current = true; // Prevent multiple reloads
            if (parsed.siteObservations) {
              setSiteObservations(parsed.siteObservations);
              siteObservationsRef.current = parsed.siteObservations;
            }
            if (parsed.taskStatus) {
              setTaskStatus(parsed.taskStatus);
              taskStatusRef.current = parsed.taskStatus;
            }
            if (parsed.typeOfIssue) {
              setTypeOfIssue(parsed.typeOfIssue);
              typeOfIssueRef.current = parsed.typeOfIssue;
            }
            if (parsed.viewPhotos) {
              setViewPhotos(parsed.viewPhotos);
              viewPhotosRef.current = parsed.viewPhotos;
            }
            if (parsed.remarks) {
              setRemarks(parsed.remarks);
              remarksRef.current = parsed.remarks;
            }
            if (parsed.photoMetadata) {
              setPhotoMetadata(parsed.photoMetadata);
              photoMetadataRef.current = parsed.photoMetadata;
            }
          }
        } catch (error) {
          console.error('Error checking localStorage persistence:', error);
        }
      }
    }
    
    // Reset persistence check when file changes
    if (dataLoadedRef.current !== selectedFile) {
      persistenceCheckRef.current = false;
    }
  }, [selectedFile, rows.length, headers.length, siteObservations]);

  // Search within filtered rows
  // For RTU/Communication users in MY OFFLINE SITES, show only action rows routed from Equipment users
  // For O&M and other roles, also merge actions assigned to them
  // IMPORTANT: Put action rows first so they appear at the top with Task Status filled
  const allRowsForDisplay = userRole === 'RTU/Communication'
    ? actionsRows.filter((row: any) => row._assignedByRole === 'Equipment')  // Only show actions routed from Equipment users
    : (userRole === 'O&M' || userRole === 'AMC' || userRole === 'CCR')
    ? [...actionsRows, ...rows]  // Action rows first
    : rows;
  
  // Sort rows: first by action rows (Task Status), then by recently updated Site Observations, then by date (newest first)
  const sortedRowsForDisplay = [...allRowsForDisplay].sort((a, b) => {
    const aRowKey = generateRowKey(selectedFile, a, headers);
    const bRowKey = generateRowKey(selectedFile, b, headers);
    
    // Check if row has Task Status (is an action row or has taskStatus value)
    const aHasTaskStatus = a._actionId || a._assignedByRole || a._assignedToRole || taskStatus[aRowKey];
    const bHasTaskStatus = b._actionId || b._assignedByRole || b._assignedToRole || taskStatus[bRowKey];
    
    // Sort: rows with Task Status first (return -1 for a comes before b)
    if (aHasTaskStatus && !bHasTaskStatus) return -1;
    if (!aHasTaskStatus && bHasTaskStatus) return 1;
    
    // For Equipment users: prioritize rows with recently updated Site Observations
    if (userRole === 'Equipment') {
      const aHasSiteObs = siteObservations[aRowKey];
      const bHasSiteObs = siteObservations[bRowKey];
      const aLastModified = siteObservationsLastModified[aRowKey] || 0;
      const bLastModified = siteObservationsLastModified[bRowKey] || 0;
      
      // If one has Site Observation and the other doesn't, prioritize the one with Site Observation
      if (aHasSiteObs && !bHasSiteObs) return -1;
      if (!aHasSiteObs && bHasSiteObs) return 1;
      
      // If both have Site Observations, sort by last modified timestamp (newest first)
      if (aHasSiteObs && bHasSiteObs && (aLastModified || bLastModified)) {
        if (aLastModified !== bLastModified) {
          return bLastModified - aLastModified; // Newest first
        }
      }
    }
    
    // If both have or both don't have Task Status, sort by date (newest first)
    // For action rows, use assignedDate or _id
    if (aHasTaskStatus && bHasTaskStatus) {
      // Both are action rows - sort by date
      const aDate = a._assignedDate || a._id || '';
      const bDate = b._assignedDate || b._id || '';
      if (aDate && bDate) {
        // Try parsing as date first
        const aDateObj = isNaN(Date.parse(aDate)) ? null : new Date(aDate);
        const bDateObj = isNaN(Date.parse(bDate)) ? null : new Date(bDate);
        if (aDateObj && bDateObj) {
          return bDateObj.getTime() - aDateObj.getTime(); // Newest first
        }
        // Fallback to _id comparison (MongoDB ObjectIds are chronologically sortable)
        return bDate.localeCompare(aDate);
      }
    }
    
    // For non-action rows, check Site Observations last modified if available
    const aLastModified = siteObservationsLastModified[aRowKey] || 0;
    const bLastModified = siteObservationsLastModified[bRowKey] || 0;
    if (aLastModified || bLastModified) {
      if (aLastModified !== bLastModified) {
        return bLastModified - aLastModified; // Newest first
      }
    }
    
    // Fallback to _id comparison
    if (a._id && b._id) {
      return b._id.localeCompare(a._id);
    }
    
    return 0;
  });
  
  const searchedRows = search
    ? sortedRowsForDisplay.filter(row =>
        Object.values(row).some(v => String(v).toLowerCase().includes(search.toLowerCase()))
      )
    : sortedRowsForDisplay;

  const totalPages = Math.max(1, Math.ceil(searchedRows.length / rowsPerPage));
  const paginatedRows = searchedRows.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  useEffect(() => { 
    setCurrentPage(1); 
  }, [rowsPerPage, rows.length, actionsRows.length, search]);

  const existingSupportDocuments = selectedSiteObservationRowKey
    ? supportDocuments[selectedSiteObservationRowKey] || []
    : [];

  // Downloads
  function downloadCSV() {
    if (!headers.length) return;
    const exportHeaders = headers;
      const csvRows = [exportHeaders.join(',')].concat(
      searchedRows.map((r) => {
        const rowKey = generateRowKey(selectedFile, r, exportHeaders);
        return exportHeaders.map(h => {
          if (h === 'Site Observations') {
            return `"${String(siteObservations[rowKey] || '').replace(/"/g,'""')}"`;
          }
          if (h === 'Task Status') {
            return `"${String(taskStatus[rowKey] || '').replace(/"/g,'""')}"`;
          }
          if (h === 'Type of Issue') {
            return `"${String(typeOfIssue[rowKey] || '').replace(/"/g,'""')}"`;
          }
          if (h === 'View Photos') {
            const photos = viewPhotos[rowKey] || [];
            return `"${photos.join('; ').replace(/"/g,'""')}"`;
          }
          if (h === 'Remarks') {
            return `"${String(remarks[rowKey] || '').replace(/"/g,'""')}"`;
          }
          return `"${String(r[h] ?? '').replace(/"/g,'""')}"`;
        }).join(',');
      })
    );
    const blob = new Blob([csvRows.join('\n')], {type: 'text/csv'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; 
    link.download = (uploadedFiles.find(f=>f.id===selectedFile)?.name||'data') + '.csv';
    link.click(); 
    URL.revokeObjectURL(url);
  }

  function downloadXLSX() {
    if (!headers.length) return;
    const exportHeaders = headers;
    const aoa = [exportHeaders, ...searchedRows.map((r) => {
      const rowKey = generateRowKey(selectedFile, r, exportHeaders);
      return exportHeaders.map(h => {
          if (h === 'Site Observations') {
            return siteObservations[rowKey] || '';
          }
          if (h === 'Task Status') {
            return taskStatus[rowKey] || '';
          }
          if (h === 'Type of Issue') {
            return typeOfIssue[rowKey] || '';
          }
          if (h === 'View Photos') {
            const photos = viewPhotos[rowKey] || [];
            return photos.join('; ');
          }
          if (h === 'Remarks') {
            return remarks[rowKey] || '';
        }
        return r[h] ?? '';
      });
    })];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.writeFile(wb, (uploadedFiles.find(f=>f.id===selectedFile)?.name||'data') + '.xlsx');
  }

  function downloadPDF() {
    if (!headers.length) return;
    const exportHeaders = headers;
    const w = window.open('', '_blank');
    if (!w) return;

    // Get user information
    const currentUser = getCurrentUser();
    const currentUserRole = currentUser?.role || '';
    const title = (currentUserRole === 'Equipment' || currentUserRole === 'RTU/Communication') 
      ? 'MY OFFLINE SITES Export' 
      : 'MY Data Export';
    const fileName = (uploadedFiles.find(f=>f.id===selectedFile)?.name||'data');
    const colPercent = (100 / Math.max(1, exportHeaders.length)).toFixed(2);
    const userName = currentUser?.fullName || currentUser?.userId || 'Unknown User';
    const userRole = currentUser?.role || 'Unknown Role';
    const userDesignation = currentUser?.designation || currentUser?.Designation || 'N/A';
    const userCircle = Array.isArray(currentUser?.circle) && currentUser.circle.length > 0 
      ? currentUser.circle.join(', ') 
      : 'N/A';
    const downloadTime = new Date().toLocaleString('en-IN`, {
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

    const thead = `<tr>${exportHeaders.map(h=>`<th>${h}</th>`).join('')}</tr>`;
    const tbody = searchedRows.map((r, idx)=>{
      const rowKey = generateRowKey(selectedFile, r, exportHeaders);
      const isEven = idx % 2 === 0;
      return `<tr style="background-color: ${isEven ? '#f0f9ff' : '#ffffff'}">${exportHeaders.map(h=>{
        if (h === 'Site Observations') {
          return `<td>${String(siteObservations[rowKey] || '')}</td>`;
        }
        if (h === 'Task Status') {
          return `<td>${String(taskStatus[rowKey] || '')}</td>`;
        }
        if (h === 'Type of Issue') {
          return `<td>${String(typeOfIssue[rowKey] || '')}</td>`;
        }
        if (h === 'View Photos') {
          const photos = viewPhotos[rowKey] || [];
          return `<td>${photos.length > 0 ? `${photos.length} photo(s)` : 'No photos'}</td>`;
        }
        if (h === 'Remarks') {
          return `<td>${String(remarks[rowKey] || '')}</td>`;
        }
        return `<td>${String(r[h]??'')}</td>`;
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

  // Determine page title based on user role
  const pageTitle = (userRole === 'Equipment' || userRole === 'RTU/Communication') 
    ? 'MY OFFLINE SITES' 
    : 'MY Data';

  if (!uploadedFiles.length) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold mb-2 text-gray-800">{pageTitle}</h2>
        <p className="text-gray-500">No files uploaded yet. Please upload from Upload tab.</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">{pageTitle}</h2>
      
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

      {!selectedFile ? (
        <div className="text-center py-8 text-gray-500 border rounded-lg">
          Please select a file to view data
        </div>
      ) : headers.length === 0 ? (
        <div className="text-center py-8 text-gray-500 border rounded-lg">
          Loading data... (If this persists, check console for errors)
        </div>
      ) : (
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
            {paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={headers.length} className="text-center py-8 text-gray-500 border border-gray-300">
                  No data found. {rows.length === 0 ? 'No rows available. Check console for filtering issues.' : `Total rows: ${rows.length}, but none match current filters/search.`}
                </td>
              </tr>
            ) : paginatedRows.map((row, idx) => {
              // Create a stable row key using selectedFile and row data
              // Use headers to ensure consistent key generation
              const rowKey = generateRowKey(selectedFile, row, headers);
              const globalIdx = searchedRows.findIndex(r => r === row);
              const isEven = idx % 2 === 0;
              return (
                <tr 
                  key={`${row.id || globalIdx}-${Object.keys(siteObservationsBySiteCode).length}`} 
                  className="transition-colors duration-150"
                  style={{ 
                    backgroundColor: isEven ? '#f0f9ff' : '#ffffff',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#93c5fd';
                  }}
                  onMouseLeave={(e) => {
                    const idx = paginatedRows.indexOf(row);
                    e.currentTarget.style.backgroundColor = idx % 2 === 0 ? '#f0f9ff' : '#ffffff';
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
                    if (h === 'Site Observations') {
                      // Get site observation value (checks both rowKey and Site Code from My Sites dialog)
                      const siteObservationValue = getSiteObservationValue(rowKey, row);
                      
                      // Consider row resolved if:
                      // - Site Observations is "Resolved", OR
                      // - Task Status already indicates a fully resolved state (no pending actions), OR
                      // - For AMC role, Task Status is in a terminal state from AMC's perspective
                      // - For Equipment role, check routedActionsMap to determine if all actions are resolved
                      
                      let taskStatusDisplayValue = taskStatus[rowKey] || '';
                      
                      // For AMC users: Calculate the actual Task Status display value
                      // Check if the action is completed or if AMC has submitted
                      if (userRole === 'AMC') {
                        // For AMC users, check the actual action status
                        // Find the action assigned to this AMC user
                        const originalRowKeyForAMC = (row as any).__siteObservationRowKey as string | undefined;
                        let amcAction =
                          routedActionsMap[rowKey] ||
                          (originalRowKeyForAMC ? routedActionsMap[originalRowKeyForAMC] : undefined);
                        
                        // If direct lookup failed, try matching by Site Code + Device Type
                        if (!amcAction || amcAction.typeOfIssue !== 'AMC Resolution Approval') {
                          const siteCode =
                            row['Site Code'] ||
                            row['SITE CODE'] ||
                            row['SiteCode'] ||
                            row['Site_Code'] ||
                            row['site code'] ||
                            '';
                          const deviceType =
                            row['DEVICE TYPE'] ||
                            row['Device Type'] ||
                            row['device type'] ||
                            row['DEVICETYPE'] ||
                            row['DeviceType'] ||
                            row['device_type'] ||
                            '';
                          
                          if (siteCode) {
                            const lowerSiteCode = String(siteCode).trim().toLowerCase();
                            const lowerDeviceType = String(deviceType || '').trim().toLowerCase();
                            
                            amcAction = Object.values(routedActionsMap).find((action: any) => {
                              if (action.typeOfIssue !== 'AMC Resolution Approval') return false;
                              if (action.assignedToUserId !== user?.userId && action.assignedToRole !== 'AMC') return false;
                              
                              const r = action.rowData || {};
                              const aSiteCode =
                                r['Site Code'] ||
                                r['SITE CODE'] ||
                                r['SiteCode'] ||
                                r['Site_Code'] ||
                                r['site code'] ||
                                '';
                              const aDeviceType =
                                r['DEVICE TYPE'] ||
                                r['Device Type'] ||
                                r['device type'] ||
                                r['DEVICETYPE'] ||
                                r['DeviceType'] ||
                                r['device_type'] ||
                                '';
                              
                              const aLowerSiteCode = String(aSiteCode || '').trim().toLowerCase();
                              const aLowerDeviceType = String(aDeviceType || '').trim().toLowerCase();
                              
                              const matchesSite = aLowerSiteCode === lowerSiteCode;
                              const matchesDevice = !lowerDeviceType || aLowerDeviceType === lowerDeviceType;
                              
                              return matchesSite && matchesDevice;
                            }) as any;
                          }
                        }
                        
                        // Determine Task Status based on action status and Site Observations
                        if (amcAction) {
                          const actionStatus = String(amcAction.status || '').toLowerCase();
                          const hasSubmitted = siteObservationValue === 'Resolved' || siteObservationValue === 'Pending';
                          
                          if (actionStatus === 'completed') {
                            // Action is completed - show "Approved"
                            taskStatusDisplayValue = 'Approved';
                          } else if (hasSubmitted) {
                            // AMC has submitted but action is not completed - show "Pending Equipment Approval"
                            taskStatusDisplayValue = 'Pending Equipment Approval';
                          } else {
                            // New action - AMC hasn't submitted yet - show "Pending"
                            taskStatusDisplayValue = 'Pending';
                          }
                        } else {
                          // No action found - check if Site Observations is set
                          const hasSubmitted = siteObservationValue === 'Resolved' || siteObservationValue === 'Pending';
                          if (hasSubmitted && taskStatusDisplayValue.toLowerCase().includes('pending equipment approval')) {
                            // Keep "Pending Equipment Approval" if Site Observations is set
                            // (this means AMC submitted but action might not be in routedActionsMap)
                          } else {
                            // New action - show "Pending"
                            taskStatusDisplayValue = 'Pending';
                          }
                        }
                      }
                      
                      // For Equipment users: Calculate the actual Task Status display value
                      // (same logic as Task Status column) to check if it's fully resolved
                      if (userRole === 'Equipment') {
                        const routedAction = routedActionsMap[rowKey];
                        if (routedAction) {
                          const actionStatus = String(routedAction.status || '').toLowerCase();
                          const currentDestinationRole = routedAction.assignedToRole;
                          const vendorNames: string[] = Array.isArray(routedAction._vendorNames)
                            ? routedAction._vendorNames
                            : [];

                          if (actionStatus === 'completed') {
                            const issueType = (routedAction.typeOfIssue || '').toString();
                            const isAMCIssue =
                              routedAction._hasAMC ||
                              currentDestinationRole === 'AMC' ||
                              issueType === 'Spare Required' ||
                              issueType === 'Faulty';

                            const parts: string[] = [];
                            
                            if (isAMCIssue) {
                              if (vendorNames.length > 0) {
                                const uniqueVendors = Array.from(new Set(vendorNames)).join(', ');
                                parts.push(`Resolved at Vendor (${uniqueVendors})`);
                              } else {
                                parts.push('Resolved at AMC Team');
                              }
                            } else {
                              parts.push('Resolved');
                            }
                            
                            // Check if there are other pending routings
                            if (routedAction._hasOM) {
                              const allActionsMap = (routedActionsMap as any).__allActions || {};
                              const allActionsForRow = allActionsMap[rowKey] || [];
                              const hasPendingOM = allActionsForRow.some((a: any) => 
                                a.assignedToRole === 'O&M' && 
                                String(a.status || '').toLowerCase() !== 'completed'
                              );
                              if (hasPendingOM) {
                                parts.push('Pending at O&M Team');
                              }
                            }
                            
                            if (routedAction._hasRTU) {
                              const allActionsMap = (routedActionsMap as any).__allActions || {};
                              const allActionsForRow = allActionsMap[rowKey] || [];
                              const hasPendingRTU = allActionsForRow.some((a: any) => 
                                a.assignedToRole === 'RTU/Communication' && 
                                String(a.status || '').toLowerCase() !== 'completed'
                              );
                              if (hasPendingRTU) {
                                parts.push('Pending at RTU/Communication Team');
                              }
                            }
                            
                            taskStatusDisplayValue = parts.join('; ');
                          } else {
                            // Build consolidated status for pending actions
                            const parts: string[] = [];
                            if (routedAction._hasOM || currentDestinationRole === 'O&M') {
                              parts.push('Pending at O&M Team');
                            }
                            if (routedAction._hasAMC || currentDestinationRole === 'AMC') {
                              if (vendorNames.length > 0) {
                                const uniqueVendors = Array.from(new Set(vendorNames)).join(', ');
                                parts.push(`Pending at Vendor (${uniqueVendors})`);
                              } else {
                                parts.push('Pending at AMC Team');
                              }
                            }
                            if (routedAction._hasRTU || currentDestinationRole === 'RTU/Communication') {
                              parts.push('Pending at RTU/Communication Team');
                            }
                            if (parts.length > 0) {
                              taskStatusDisplayValue = parts.join('; ');
                            }
                          }
                        }
                      }
                      
                      const taskStatusValue = taskStatusDisplayValue.toLowerCase();
                      
                      // Check if Task Status is fully resolved (same logic as Task Status column)
                      // Fully resolved means: "Resolved" or contains "resolved" but NOT "pending"
                      const isTaskStatusFullyResolved = 
                        taskStatusValue === 'resolved' || 
                        (taskStatusValue.includes('resolved') && !taskStatusValue.includes('pending'));
                      
                      // Initialize isResolved variable
                      let isResolved = false;
                      
                      // For O&M users: Check only their own action status
                      // O&M users should only see resolved state for their own O&M action, not AMC's
                      if (userRole === 'O&M') {
                        // Find the O&M action assigned to this O&M user
                        const siteCode =
                          row['Site Code'] ||
                          row['SITE CODE'] ||
                          row['SiteCode'] ||
                          row['Site_Code'] ||
                          row['site code'] ||
                          '';
                        const deviceType =
                          row['DEVICE TYPE'] ||
                          row['Device Type'] ||
                          row['device type'] ||
                          row['DEVICETYPE'] ||
                          row['DeviceType'] ||
                          row['device_type'] ||
                          '';
                        
                        // Find O&M action for this row
                        let omAction: any = null;
                        if (siteCode) {
                          const lowerSiteCode = String(siteCode).trim().toLowerCase();
                          const lowerDeviceType = String(deviceType || '').trim().toLowerCase();
                          
                          // Search in actionsRows (which contains actions for O&M users)
                          omAction = actionsRows.find((actionRow: any) => {
                            if (actionRow._assignedToRole !== 'O&M') return false;
                            if (actionRow._assignedToUserId !== user?.userId && actionRow._assignedToRole !== 'O&M') return false;
                            
                            const aSiteCode =
                              actionRow['Site Code'] ||
                              actionRow['SITE CODE'] ||
                              actionRow['SiteCode'] ||
                              actionRow['Site_Code'] ||
                              actionRow['site code'] ||
                              '';
                            const aDeviceType =
                              actionRow['DEVICE TYPE'] ||
                              actionRow['Device Type'] ||
                              actionRow['device type'] ||
                              actionRow['DEVICETYPE'] ||
                              actionRow['DeviceType'] ||
                              actionRow['device_type'] ||
                              '';
                            
                            const aLowerSiteCode = String(aSiteCode || '').trim().toLowerCase();
                            const aLowerDeviceType = String(aDeviceType || '').trim().toLowerCase();
                            
                            const matchesSite = aLowerSiteCode === lowerSiteCode;
                            const matchesDevice = !lowerDeviceType || aLowerDeviceType === lowerDeviceType;
                            
                            return matchesSite && matchesDevice;
                          });
                        }
                        
                        // Only mark as resolved if THIS O&M user's action is completed
                        // Do NOT mark as resolved if only AMC action is completed
                        // CRITICAL: Do NOT use siteObservations[rowKey] as it's shared between roles
                        // Only check the O&M action's status from the backend
                        if (omAction) {
                          const omActionStatus = String(omAction._status || '').toLowerCase();
                          if (omActionStatus === 'completed') {
                            // This O&M user's action is completed - mark as resolved
                            isResolved = true;
                          } else {
                            // This O&M user's action is not completed - NOT resolved
                            // Do NOT check siteObservations[rowKey] as it may contain AMC's value
                            isResolved = false;
                          }
                        } else {
                          // No O&M action found for this user - cannot be resolved
                          // Do NOT check siteObservations[rowKey] as it may contain AMC's value
                          isResolved = false;
                        }
                      } else {
                        // For other roles (AMC, Equipment, etc.), use the existing logic
                        let isResolvedDefault =
                        siteObservationValue === 'Resolved' ||
                          isTaskStatusFullyResolved;
                        isResolved = isResolvedDefault;
                      }

                      // For AMC users in MY OFFLINE SITES:
                      // - "Approved" means action is completed and approved - no further editing.
                      // - "Pending Equipment Approval" means AMC has submitted and is waiting for Equipment approval - no further editing.
                      // - "Recheck Requested" SHOULD allow editing again, so do NOT treat it as resolved.
                      // - "Pending" means new action that AMC needs to work on - should be editable (NOT resolved).
                      if (userRole === 'AMC') {
                        const amcNoFurtherActionStatuses = [
                          'approved',
                          'pending equipment approval',
                        ];
                        
                        // CRITICAL: Only grey out if:
                        // 1. Status is "Approved" or "Pending Equipment Approval" AND
                        // 2. An AMC Resolution Approval action exists (meaning AMC has actually submitted)
                        // This prevents new actions from being greyed out before AMC has done any work
                        // Just checking siteObservations[rowKey] is not enough - we need to verify an action was created
                        const originalRowKeyForAMC = (row as any).__siteObservationRowKey as string | undefined;
                        let amcActionExists = false;
                        
                        // Check if an AMC Resolution Approval action exists for this row
                        // CRITICAL: Do NOT use siteObservations[rowKey] as it's shared between roles
                        // Only check the AMC action's status from the backend
                        const amcAction =
                          routedActionsMap[rowKey] ||
                          (originalRowKeyForAMC ? routedActionsMap[originalRowKeyForAMC] : undefined);
                        
                        let foundAmcAction: any = null;
                        if (amcAction && amcAction.typeOfIssue === 'AMC Resolution Approval') {
                          foundAmcAction = amcAction;
                          amcActionExists = true;
                        } else {
                          // Try matching by Site Code + Device Type
                          const siteCode =
                            row['Site Code'] ||
                            row['SITE CODE'] ||
                            row['SiteCode'] ||
                            row['Site_Code'] ||
                            row['site code'] ||
                            '';
                          const deviceType =
                            row['DEVICE TYPE'] ||
                            row['Device Type'] ||
                            row['device type'] ||
                            row['DEVICETYPE'] ||
                            row['DeviceType'] ||
                            row['device_type'] ||
                            '';
                          
                          if (siteCode) {
                            const lowerSiteCode = String(siteCode).trim().toLowerCase();
                            const lowerDeviceType = String(deviceType || '').trim().toLowerCase();
                            
                            foundAmcAction = Object.values(routedActionsMap).find((action: any) => {
                              if (action.typeOfIssue !== 'AMC Resolution Approval') return false;
                              if (action.assignedToUserId !== user?.userId && action.assignedToRole !== 'AMC') return false;
                              
                              const r = action.rowData || {};
                              const aSiteCode =
                                r['Site Code'] ||
                                r['SITE CODE'] ||
                                r['SiteCode'] ||
                                r['Site_Code'] ||
                                r['site code'] ||
                                '';
                              const aDeviceType =
                                r['DEVICE TYPE'] ||
                                r['Device Type'] ||
                                r['device type'] ||
                                r['DEVICETYPE'] ||
                                r['DeviceType'] ||
                                r['device_type'] ||
                                '';
                              
                              const aLowerSiteCode = String(aSiteCode || '').trim().toLowerCase();
                              const aLowerDeviceType = String(aDeviceType || '').trim().toLowerCase();
                              
                              const matchesSite = aLowerSiteCode === lowerSiteCode;
                              const matchesDevice = !lowerDeviceType || aLowerDeviceType === lowerDeviceType;
                              
                              return matchesSite && matchesDevice;
                            }) as any;
                            
                            if (foundAmcAction) {
                              amcActionExists = true;
                            }
                          }
                        }
                        
                        // Only grey out if:
                        // - Status is "Approved" or "Pending Equipment Approval" AND
                        // - An AMC Resolution Approval action exists (AMC has actually submitted)
                        // CRITICAL: Do NOT check siteObservations[rowKey] as it may contain O&M's value
                        // Only check the AMC action's status from the backend
                        if (amcNoFurtherActionStatuses.includes(taskStatusValue) && amcActionExists) {
                          // Also verify the AMC action's status is appropriate
                          if (foundAmcAction) {
                            const amcActionStatus = String(foundAmcAction.status || '').toLowerCase();
                            // Only mark as resolved if AMC action is completed OR if status is "Pending Equipment Approval" (meaning AMC submitted)
                            if (amcActionStatus === 'completed' || taskStatusValue === 'pending equipment approval') {
                          isResolved = true;
                            } else {
                              isResolved = false;
                            }
                          } else {
                            isResolved = false;
                          }
                        } else {
                          isResolved = false;
                        }
                      }
                      // Debug: Log resolved status for verification
                      if (isResolved && process.env.NODE_ENV === 'development') {
                        console.log('Row is resolved:', rowKey, 'Value:', siteObservationValue);
                      }
                      return (
                        <td
                          key={h}
                          className="px-3 py-1 border border-gray-300 text-center"
                          style={{ 
                            fontFamily: 'Times New Roman, Times, serif', 
                            fontSize: 12,
                            backgroundColor: isResolved ? '#f3f4f6' : 'transparent',
                            opacity: isResolved ? 0.6 : 1, // Match Task Status opacity
                            cursor: isResolved ? 'not-allowed' : 'default'
                          }}
                          title={isResolved ? 'Resolved - No further action needed for this site code' : ''}
                        >
                          <select
                            value={siteObservationValue || ''}
                            onChange={(e) => {
                              // Prevent changes if already resolved
                              if (isResolved) return;
                              
                              const selectedValue = e.target.value;
                              setSiteObservations(prev => ({
                                  ...prev,
                                [rowKey]: selectedValue
                              }));
                              // Update ref immediately
                              siteObservationsRef.current = {
                                ...siteObservationsRef.current,
                                [rowKey]: selectedValue
                              };
                              // Update last modified timestamp when Site Observation is changed
                              setSiteObservationsLastModified(prev => ({
                                ...prev,
                                [rowKey]: Date.now()
                              }));
                              
                              // Open dialog when "Resolved" or "Pending" is selected
                              if (selectedValue.toLowerCase() === 'resolved' || selectedValue.toLowerCase() === 'pending') {
                                setSelectedSiteObservationRowKey(rowKey);
                                setSiteObservationsStatus(selectedValue.toLowerCase());
                                
                                // Try to load existing data from Site Code-based storage (from My Sites Dialog)
                                const siteCode = row['Site Code'] || 
                                                row['SITE CODE'] || 
                                                row['SiteCode'] || 
                                                row['Site_Code'] || 
                                                row['site code'] || 
                                                '';
                                
                                let existingData = {
                                  remarks: '',
                                  typeOfIssue: '',
                                  specifyOther: '',
                                  typeOfSpare: [] as string[],
                                  specifySpareOther: '',
                                  capturedPhotos: [] as Array<{ data: string; latitude?: number; longitude?: number; timestamp?: string; location?: string }>,
                                  uploadedPhotos: [] as File[],
                                  uploadedDocuments: [] as File[]
                                };
                                
                                if (siteCode) {
                                  const normalizedSiteCode = String(siteCode).trim().toUpperCase();
                                  const existingObservation = siteObservationsBySiteCode[normalizedSiteCode];
                                  
                                  if (existingObservation && existingObservation.status === selectedValue) {
                                    // Load existing data from My Sites Dialog
                                    existingData = {
                                      remarks: existingObservation.remarks || '',
                                      typeOfIssue: existingObservation.typeOfIssue || '',
                                      specifyOther: existingObservation.specifyOther || '',
                                      typeOfSpare: existingObservation.typeOfSpare || [],
                                      specifySpareOther: existingObservation.specifySpareOther || '',
                                      capturedPhotos: existingObservation.capturedPhotos || [],
                                      uploadedPhotos: [],
                                      uploadedDocuments: []
                                    };
                                    console.log('Loaded existing data from My Sites Dialog for Site Code:', normalizedSiteCode, existingData);
                                  }
                                }
                                
                                setSiteObservationsDialogData(existingData);
                                setIsTypeOfSpareDropdownOpen(false);
                                setShowSiteObservationsDialog(true);
                                
                              } else if (selectedValue === '') {
                                // Clear if "Select Status" is selected
                                setSiteObservations(prev => {
                                  const updated = { ...prev };
                                  delete updated[rowKey];
                                  return updated;
                                });
                                // Also clear related columns
                                setTaskStatus(prev => {
                                  const updated = { ...prev };
                                  delete updated[rowKey];
                                  return updated;
                                });
                                setTypeOfIssue(prev => {
                                  const updated = { ...prev };
                                  delete updated[rowKey];
                                  return updated;
                                });
                                setViewPhotos(prev => {
                                  const updated = { ...prev };
                                  delete updated[rowKey];
                                  return updated;
                                });
                                setSupportDocuments(prev => {
                                  const updated = { ...prev };
                                  delete updated[rowKey];
                                  return updated;
                                });
                                setRemarks(prev => {
                                  const updated = { ...prev };
                                  delete updated[rowKey];
                                  return updated;
                                });
                                // Update refs
                                delete siteObservationsRef.current[rowKey];
                                delete taskStatusRef.current[rowKey];
                                delete typeOfIssueRef.current[rowKey];
                                delete viewPhotosRef.current[rowKey];
                                delete remarksRef.current[rowKey];
                                delete photoMetadataRef.current[rowKey];
                                delete supportDocumentsRef.current[rowKey];
                                // Save immediately
                                setTimeout(() => saveToLocalStorage(), 50);
                              } else {
                                // Save immediately for other values
                                setTimeout(() => saveToLocalStorage(), 50);
                              }
                            }}
                            disabled={isResolved}
                            className={`w-full px-2 py-1 border-0 rounded text-sm bg-transparent focus:outline-none focus:ring-0 ${
                              isResolved ? 'text-gray-500 cursor-not-allowed' : 'text-gray-700'
                            }`}
                            style={{ 
                              fontFamily: 'Times New Roman, Times, serif', 
                              fontSize: 12,
                              cursor: isResolved ? 'not-allowed' : 'pointer'
                            }}
                            title={isResolved ? 'Status is Resolved and cannot be changed' : ''}
                          >
                            <option value="">Select Status</option>
                            <option value="Resolved">Resolved</option>
                            <option value="Pending">Pending</option>
                          </select>
                        </td>
                      );
                    }
                    if (h === 'Task Status') {
                      // For action rows, show status based on current routing destination
                      // CRITICAL: Task Status is calculated from routing actions and contains full routing info
                      // like "Pending at O&M Team; Pending at Vendor (Shrishaila Electricals...)"
                      // Always start with rowKey-based Task Status (has routing information from MY OFFLINE SITES)
                      // The routing logic below will calculate/update displayValue based on actions
                      let displayValue = taskStatus[rowKey] || '-';
                      
                      // CRITICAL FIX: If Site Observations is "Resolved", Task Status MUST be "Resolved"
                      // Check both rowKey-based and Site Code-based Site Observations
                      const siteObsRowKey = siteObservations[rowKey];
                      const siteObsSiteCode = getSiteObservationValue(rowKey, row);
                      if ((siteObsRowKey === 'Resolved' || siteObsSiteCode === 'Resolved') && displayValue !== 'Resolved') {
                        console.log(`[RENDER] Forcing Task Status to Resolved for rowKey ${rowKey} because Site Observations is Resolved`);
                        displayValue = 'Resolved';
                      }
                      
                      const lowerDisplay = displayValue.toLowerCase();
                      let isResolvedTask = lowerDisplay.includes('resolved');
                      const isRecheckRequested = lowerDisplay === 'recheck requested';
                      
                      // IMPORTANT: If displayValue is just "Pending" or "-", the routing logic below will calculate
                      // the full routing info from actions. This ensures routing info is always shown when available.
                      
                      // For RTU/Communication users: Check if this is an action row first (prioritize action rows)
                      if (userRole === 'RTU/Communication') {
                        // Check if this is an action row (has actionId or assignedToRole)
                        const isActionRow = row._actionId || row._assignedToRole === 'RTU/Communication' || row._assignedByRole;
                        
                        if (isActionRow) {
                          if (row._status === 'Completed') {
                            displayValue = 'Resolved';
                          } else {
                            // Check if action was rerouted by RTU/Communication user
                            const currentDestinationRole = row._assignedToRole;
                            if (currentDestinationRole && currentDestinationRole !== 'RTU/Communication' && currentDestinationRole !== userRole) {
                              // Action has been rerouted to another team
                              const destinationTeam = getTeamNameFromRole(currentDestinationRole);
                              displayValue = `Pending at ${destinationTeam}`;
                            } else {
                              // Also check reroutedActionsMap for actions rerouted by this user
                              const reroutedAction = reroutedActionsMap[rowKey];
                              if (reroutedAction) {
                                const reroutedDestinationRole = reroutedAction.assignedToRole;
                                if (reroutedDestinationRole && reroutedDestinationRole !== 'RTU/Communication') {
                                  const destinationTeam = getTeamNameFromRole(reroutedDestinationRole);
                                  displayValue = `Pending at ${destinationTeam}`;
                                } else {
                                  // Show "Routed from [source team]" based on who routed it to them
                                  const sourceTeam = getTeamNameFromRole(row._assignedByRole || 'Equipment');
                                  displayValue = `Routed from ${sourceTeam}`;
                                }
                              } else {
                                // Show "Routed from [source team]" based on the source role
                                // Default to Equipment Team if _assignedByRole is not available
                                const sourceTeam = getTeamNameFromRole(row._assignedByRole || 'Equipment');
                                displayValue = `Routed from ${sourceTeam}`;
                              }
                            }
                          }
                        }
                      }
                      
                      // For Equipment users: Check if action is resolved or rerouted,
                      // and show consolidated status including O&M and vendor teams
                      if (userRole === 'Equipment') {
                        // CRITICAL: If Site Observations is "Resolved", Task Status MUST be "Resolved"
                        // This takes priority over routing actions
                        const siteObsRowKey = siteObservations[rowKey];
                        const siteObsSiteCode = getSiteObservationValue(rowKey, row);
                        if (siteObsRowKey === 'Resolved' || siteObsSiteCode === 'Resolved') {
                          displayValue = 'Resolved';
                          isResolvedTask = true;
                        } else {
                          const routedAction = routedActionsMap[rowKey];

                          // CRITICAL: Always calculate Task Status from routing actions if available
                          // This ensures routing info like "Pending at O&M Team; Pending at Vendor..." is shown
                          // and updates when actions are resolved
                          if (routedAction) {
                          const actionStatus = String(routedAction.status || '').toLowerCase();
                          const currentDestinationRole = routedAction.assignedToRole;
                          const vendorNames: string[] = Array.isArray(routedAction._vendorNames)
                            ? routedAction._vendorNames
                            : [];

                          if (actionStatus === 'completed') {
                            // If this routed action represents AMC/vendor work that is now completed,
                            // show it explicitly as resolved at the Vendor/AMC for Equipment users.
                            // BUT also check if there are other pending routings (e.g., O&M) that should still be shown
                            const issueType = (routedAction.typeOfIssue || '').toString();
                            const isAMCIssue =
                              routedAction._hasAMC ||
                              currentDestinationRole === 'AMC' ||
                              issueType === 'Spare Required' ||
                              issueType === 'Faulty';

                            const parts: string[] = [];

                            if (isAMCIssue) {
                              if (vendorNames.length > 0) {
                                const uniqueVendors = Array.from(new Set(vendorNames)).join(', ');
                                parts.push(`Resolved at Vendor (${uniqueVendors})`);
                              } else {
                                parts.push('Resolved at AMC Team');
                              }
                            } else {
                              parts.push('Resolved');
                            }
                            
                            // Check if there are other pending routings that should still be shown
                            // O&M routing part (if still pending)
                            if (routedAction._hasOM) {
                              // Check if there's a separate O&M action that's still pending
                              // We need to check allActionsMap to see if there's a pending O&M action
                              const allActionsMap = (routedActionsMap as any).__allActions || {};
                              const allActionsForRow = allActionsMap[rowKey] || [];
                              
                              // Also check all actions in routedActionsMap to find O&M actions
                              const allRoutedActions = Object.values(routedActionsMap).filter((a: any) => 
                                a && typeof a === 'object' && a._hasOM
                              );
                              
                              // Check if any O&M action is still pending
                              const hasPendingOM = allActionsForRow.some((a: any) => 
                                a.assignedToRole === 'O&M' && 
                                String(a.status || '').toLowerCase() !== 'completed'
                              ) || allRoutedActions.some((a: any) => {
                                // Match by row data to find O&M action for same row
                                const aSiteCode = a.rowData?.['Site Code'] || a.rowData?.['SITE CODE'] || a.rowData?.['SiteCode'] || '';
                                const rowSiteCode = row['Site Code'] || row['SITE CODE'] || row['SiteCode'] || '';
                                return a.assignedToRole === 'O&M' && 
                                       String(a.status || '').toLowerCase() !== 'completed' &&
                                       aSiteCode === rowSiteCode &&
                                       aSiteCode !== '';
                              });
                              
                              if (hasPendingOM) {
                                parts.push('Pending at O&M Team');
                              }
                            }
                            
                            // RTU/Communication routing part (if still pending)
                            if (routedAction._hasRTU) {
                              const allActionsMap = (routedActionsMap as any).__allActions || {};
                              const allActionsForRow = allActionsMap[rowKey] || [];
                              
                              // Also check all actions in routedActionsMap to find RTU actions
                              const allRoutedActions = Object.values(routedActionsMap).filter((a: any) => 
                                a && typeof a === 'object' && a._hasRTU
                              );
                              
                              const hasPendingRTU = allActionsForRow.some((a: any) => 
                                a.assignedToRole === 'RTU/Communication' && 
                                String(a.status || '').toLowerCase() !== 'completed'
                              ) || allRoutedActions.some((a: any) => {
                                // Match by row data to find RTU action for same row
                                const aSiteCode = a.rowData?.['Site Code'] || a.rowData?.['SITE CODE'] || a.rowData?.['SiteCode'] || '';
                                const rowSiteCode = row['Site Code'] || row['SITE CODE'] || row['SiteCode'] || '';
                                return a.assignedToRole === 'RTU/Communication' && 
                                       String(a.status || '').toLowerCase() !== 'completed' &&
                                       aSiteCode === rowSiteCode &&
                                       aSiteCode !== '';
                              });
                              
                              if (hasPendingRTU) {
                                parts.push('Pending at RTU/Communication Team');
                              }
                            }
                            
                            displayValue = parts.join('; ');
                          } else {
                            // Build consolidated status based on all routed actions for this row
                            const parts: string[] = [];

                            // O&M routing part
                            if (routedAction._hasOM || currentDestinationRole === 'O&M') {
                              parts.push('Pending at O&M Team');
                            }

                            // AMC / vendor routing part
                            if (routedAction._hasAMC || currentDestinationRole === 'AMC') {
                              if (vendorNames.length > 0) {
                                const uniqueVendors = Array.from(new Set(vendorNames)).join(', ');
                                parts.push(`Pending at Vendor (${uniqueVendors})`);
                              } else {
                                parts.push('Pending at AMC Team');
                              }
                            }

                            // RTU/Communication routing part
                            if (routedAction._hasRTU || currentDestinationRole === 'RTU/Communication') {
                              parts.push('Pending at RTU/Communication Team');
                            }

                            if (parts.length > 0) {
                              displayValue = parts.join('; ');
                            } else if (currentDestinationRole) {
                              // Fallback: Action has been rerouted to another team
                              const destinationTeam = getTeamNameFromRole(currentDestinationRole);
                              displayValue = `Pending at ${destinationTeam}`;
                            } else {
                              // Still at original destination - default to RTU/Communication for RTU/CS issues
                              displayValue = 'Pending at RTU/Communication Team';
                            }
                          }
                          }
                        }
                      }

                      // Update isResolvedTask flag based on displayValue
                      // Check if status is fully resolved (no pending actions)
                      const lowerDisplayValue = displayValue.toLowerCase();
                      
                      // For all users: If status is "Resolved" (and no pending actions), grey it out
                      // Check if it's fully resolved (not partially resolved with pending actions)
                      if (lowerDisplayValue === 'resolved' || 
                          (lowerDisplayValue.includes('resolved') && !lowerDisplayValue.includes('pending'))) {
                        isResolvedTask = true;
                      }

                      // For AMC users: grey out Task Status once it reaches a terminal state
                      if (userRole === 'AMC') {
                        const amcTerminalStatuses = [
                          'approved',
                          'recheck requested',
                          'pending equipment approval',
                        ];
                        if (amcTerminalStatuses.includes(lowerDisplayValue)) {
                          isResolvedTask = true;
                        }
                      }
                      
                      if (userRole === 'AMC') {
                        // For AMC users, resolve approval status for this row.
                        // Try multiple matching strategies because row keys/headers can differ between views.
                        const originalRowKeyForAMC = (row as any).__siteObservationRowKey as string | undefined;
                        let approvalAction =
                          routedActionsMap[rowKey] ||
                          (originalRowKeyForAMC ? routedActionsMap[originalRowKeyForAMC] : undefined);

                        // If direct key lookup failed, fall back to matching by Site Code + Device Type
                        if (!approvalAction) {
                          const siteCode =
                            row['Site Code'] ||
                            row['SITE CODE'] ||
                            row['SiteCode'] ||
                            row['Site_Code'] ||
                            row['site code'] ||
                            '';
                          const deviceType =
                            row['DEVICE TYPE'] ||
                            row['Device Type'] ||
                            row['device type'] ||
                            row['DEVICETYPE'] ||
                            row['DeviceType'] ||
                            row['device_type'] ||
                            '';

                          if (siteCode) {
                            const lowerSiteCode = String(siteCode).trim().toLowerCase();
                            const lowerDeviceType = String(deviceType || '').trim().toLowerCase();

                            approvalAction = Object.values(routedActionsMap).find((action: any) => {
                              const r = action.rowData || {};
                              const aSiteCode =
                                r['Site Code'] ||
                                r['SITE CODE'] ||
                                r['SiteCode'] ||
                                r['Site_Code'] ||
                                r['site code'] ||
                                '';
                              const aDeviceType =
                                r['DEVICE TYPE'] ||
                                r['Device Type'] ||
                                r['device type'] ||
                                r['DEVICETYPE'] ||
                                r['DeviceType'] ||
                                r['device_type'] ||
                                '';

                              const matchesSite =
                                String(aSiteCode || '').trim().toLowerCase() === lowerSiteCode;
                              const matchesDevice =
                                !lowerDeviceType ||
                                String(aDeviceType || '').trim().toLowerCase() === lowerDeviceType;

                              return (
                                action.typeOfIssue === 'AMC Resolution Approval' &&
                                matchesSite &&
                                matchesDevice
                              );
                            });
                          }
                        }

                        if (approvalAction && approvalAction.typeOfIssue === 'AMC Resolution Approval') {
                          const actionStatus = String(approvalAction.status || '').toLowerCase();
                          if (actionStatus === 'completed') {
                            // Show explicit message that Equipment team has verified and approved
                            displayValue = 'Verified and Approved by Equipment Team';
                          } else if (actionStatus === 'in progress') {
                            displayValue = 'Recheck Requested';
                          } else {
                            displayValue = 'Pending Equipment Approval';
                          }
                        }
                      }
                      
                      // For O&M users: Check if this is an action row (routed from another team)
                      // Check if this is an O&M-related action (either currently assigned to O&M or was rerouted by O&M)
                      const omIssueTypes = ['Faulty', 'Bipassed', 'Line Idel', 'AT Jump cut', 'Dismantled', 'Replaced', 'Equipment Idle', 'Spare Required', 'AT-PT Chamber Flashover'];
                      const isOMIssue = omIssueTypes.includes(row._typeOfIssue);
                      const isOMAction = userRole === 'O&M' && isOMIssue && row._assignedByRole && 
                                         (row._assignedToRole === 'O&M' || (row._assignedToRole !== 'O&M' && row._assignedByRole === 'Equipment'));
                      
                      if (isOMAction) {
                        // This action is assigned to O&M user or was rerouted by O&M user
                        if (row._status === 'Completed' || displayValue === 'Resolved') {
                          displayValue = 'Resolved';
                        } else {
                          // Check if action was rerouted to another team (Equipment → O&M → RTU/Communication)
                          const currentDestinationRole = row._assignedToRole;
                          if (currentDestinationRole && currentDestinationRole !== 'O&M') {
                            // Action has been rerouted to another team (e.g., RTU/Communication)
                            const destinationTeam = getTeamNameFromRole(currentDestinationRole);
                            displayValue = `Pending at ${destinationTeam}`;
                          } else {
                            // Show "Routed from [source team]" based on who routed it to them
                            const sourceTeam = getTeamNameFromRole(row._assignedByRole);
                            displayValue = `Routed from ${sourceTeam}`;
                          }
                        }
                      }
                      
                      // Fallback: For any action row that doesn't have Task Status set yet, show routing info
                      if (displayValue === '-' && (row._actionId || row._assignedByRole || row._assignedToRole)) {
                        if (row._status === 'Completed') {
                          displayValue = 'Resolved';
                        } else if (row._assignedByRole) {
                          const sourceTeam = getTeamNameFromRole(row._assignedByRole);
                          displayValue = `Routed from ${sourceTeam}`;
                        } else if (row._assignedToRole && row._assignedToRole !== userRole) {
                          const destinationTeam = getTeamNameFromRole(row._assignedToRole);
                          displayValue = `Pending at ${destinationTeam}`;
                        }
                      }
                      
                      // Task Status should ALWAYS come from routing actions in MY OFFLINE SITES
                      // The routing logic above calculates the full routing info like "Pending at O&M Team; Pending at Vendor..."
                      // We do NOT use Site Code-based Task Status as it would override routing information
                      
                      return (
                        <td
                          key={h}
                          className={`px-3 py-1 border border-gray-300 text-center ${
                            isResolvedTask ? 'text-gray-500 cursor-not-allowed' : isRecheckRequested ? 'text-red-700' : 'text-gray-700'
                          }`}
                          style={{
                            fontFamily: 'Times New Roman, Times, serif',
                            fontSize: 12,
                            textAlign: 'center',
                            whiteSpace: 'pre-wrap',
                            backgroundColor: isRecheckRequested
                              ? '#fecaca' // light red for "Recheck Requested"
                              : isResolvedTask
                              ? '#f3f4f6' // grey background for resolved
                              : 'transparent',
                            opacity: isResolvedTask ? 0.6 : 1, // More greyed out for resolved
                            cursor: isResolvedTask ? 'not-allowed' : 'default',
                          }}
                          title={isResolvedTask ? 'Resolved - No further action needed for this site code' : ''}
                        >
                          {displayValue}
                        </td>
                      );
                    }
                    if (h === 'Type of Issue') {
                      // Get type of issue value - check both rowKey and Site Code
                      const typeOfIssueFromSiteCode = getTypeOfIssueValue(rowKey, row);
                      // For action rows, show typeOfIssue from action
                      let displayValue = typeOfIssueFromSiteCode || typeOfIssue[rowKey] || '-';
                      
                      // For Equipment users: Check routedActionsMap for typeOfIssue
                      if (userRole === 'Equipment') {
                        const routedAction = routedActionsMap[rowKey];
                        if (routedAction && routedAction.typeOfIssue) {
                          displayValue = routedAction.typeOfIssue;
                        }
                      }
                      
                      // Check if this is an action row and use _typeOfIssue if available
                      if ((!displayValue || displayValue === '-') && row._typeOfIssue) {
                        displayValue = row._typeOfIssue;
                      }
                      
                      return (
                        <td
                          key={h}
                          className="px-3 py-1 border border-gray-300 text-center"
                          style={{ fontFamily: 'Times New Roman, Times, serif', fontSize: 12 }}
                        >
                          {displayValue}
                        </td>
                      );
                    }
                    if (h === 'View Photos') {
                      // Get view photos value - check both rowKey and Site Code
                      // Priority: Site Code-based (from API/mobile) > rowKey-based > action photos
                      const photosFromSiteCode = getViewPhotosValue(rowKey, row);
                      // Always prioritize photos from Site Code (API/mobile app data)
                      let photosToDisplay = photosFromSiteCode.length > 0 ? photosFromSiteCode : (viewPhotos[rowKey] || []);
                      
                      // For Equipment users: Check routedActionsMap for photos
                      if (userRole === 'Equipment') {
                        const routedAction = routedActionsMap[rowKey];
                        if (routedAction && routedAction.photo) {
                          // Convert action photos to array format if needed
                          if (Array.isArray(routedAction.photo)) {
                            photosToDisplay = routedAction.photo;
                          } else if (typeof routedAction.photo === 'string') {
                            photosToDisplay = [routedAction.photo];
                          }
                        }
                      }
                      
                      // If no photos in viewPhotos state, check action photos from row
                      if (photosToDisplay.length === 0 && row._photos) {
                        // Convert action photos to array format if needed
                        if (Array.isArray(row._photos)) {
                          photosToDisplay = row._photos;
                        } else if (typeof row._photos === 'string') {
                          // Single photo as string
                          photosToDisplay = [row._photos];
                        }
                      }
                      
                      return (
                        <td
                          key={h}
                          className="px-3 py-1 border border-gray-300 text-center"
                          style={{ fontFamily: 'Times New Roman, Times, serif', fontSize: 12 }}
                        >
                          {photosToDisplay.length > 0 ? (
                            <button
                              onClick={() => {
                                setSelectedRowKeyForPhotos(rowKey);
                                // Store photos temporarily for viewing
                                if (photosToDisplay.length > 0 && photosToDisplay !== viewPhotos[rowKey]) {
                                  setViewPhotos(prev => ({
                                    ...prev,
                                    [rowKey]: photosToDisplay
                                  }));
                                }
                                setShowPhotoViewer(true);
                              }}
                              className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                              style={{ fontFamily: 'Times New Roman, Times, serif', fontSize: 12 }}
                            >
                              View ({photosToDisplay.length})
                            </button>
                          ) : (
                            <span className="text-gray-400 text-xs">No photos</span>
                          )}
                        </td>
                      );
                    }
                    if (h === 'Remarks') {
                      // Get remarks value - check both rowKey and Site Code
                      const remarksFromSiteCode = getRemarksValue(rowKey, row);
                      // For action rows, check if remarks are available from action data
                      let displayRemarks = remarksFromSiteCode || remarks[rowKey] || '-';
                      let amcRemarks = '';
                      let equipmentRemarks = '';
                      
                      // For Equipment users: Prioritize database-loaded remarks, then check actions
                      if (userRole === 'Equipment') {
                        // First, check if we have remarks from database (loaded from EquipmentOfflineSites)
                        // This is the primary source for Equipment users now that we're using database storage
                        if (remarks[rowKey] && remarks[rowKey].trim() !== '') {
                          displayRemarks = remarks[rowKey];
                          equipmentRemarks = remarks[rowKey];
                        } else {
                          // If no database remarks, then try to get from actions (for backward compatibility)
                          // This is only a fallback for old data
                          // Do not fetch or display AMC remarks - only show Equipment remarks
                          amcRemarks = '';
                        
                        // Get original row key for Equipment (if available)
                        const originalRowKeyForEquipment = (row as any).__siteObservationRowKey as string | undefined;

                        // Get Equipment remarks from actions where Equipment routed to AMC or RTU/Communication
                        // Look for actions where Equipment is the source (assignedByRole === 'Equipment')
                        // Can route to: AMC (for AMC-related issues) or RTU/Communication (for RTU/CS issues)
                        // IMPORTANT: We want the ORIGINAL routing action, not the AMC Resolution Approval action
                        let equipmentAction: any = null;
                        
                        // Strategy 1: Direct lookup - find action where Equipment routed TO AMC or RTU/Communication (not AMC Resolution Approval)
                        const directRoutedAction = routedActionsMap[rowKey];
                        if (directRoutedAction && 
                            directRoutedAction.assignedByRole === 'Equipment' && 
                            (directRoutedAction.assignedToRole === 'AMC' || directRoutedAction.assignedToRole === 'RTU/Communication') &&
                            directRoutedAction.typeOfIssue !== 'AMC Resolution Approval') {
                          equipmentAction = directRoutedAction;
                        }
                        
                        // Strategy 2: Find by original row key
                        if (!equipmentAction && originalRowKeyForEquipment) {
                          const originalRoutedAction = routedActionsMap[originalRowKeyForEquipment];
                          if (originalRoutedAction && 
                              originalRoutedAction.assignedByRole === 'Equipment' && 
                              (originalRoutedAction.assignedToRole === 'AMC' || originalRoutedAction.assignedToRole === 'RTU/Communication') &&
                              originalRoutedAction.typeOfIssue !== 'AMC Resolution Approval') {
                            equipmentAction = originalRoutedAction;
                          }
                        }
                        
                        // Strategy 3: Search all actions for Equipment -> AMC or Equipment -> RTU/Communication routing (excluding AMC Resolution Approval)
                        // Use the allActionsMap to get all actions and find Equipment routing actions
                        // CRITICAL: Look for the FIRST/ORIGINAL Equipment routing action to get original remarks
                        if (!equipmentAction) {
                          const allActionsMap = (routedActionsMap as any).__allActions || {};
                          const actionsArrayMap = (routedActionsMap as any).__actionsArrayMap || {};
                          const actionsToSearch = allActionsMap[rowKey] || 
                                                  (originalRowKeyForEquipment ? allActionsMap[originalRowKeyForEquipment] : []) ||
                                                  actionsArrayMap[rowKey] ||
                                                  (originalRowKeyForEquipment ? actionsArrayMap[originalRowKeyForEquipment] : []) ||
                                                  Object.values(routedActionsMap).filter(a => a && typeof a === 'object');
                          
                          const siteCode =
                            row['Site Code'] ||
                            row['SITE CODE'] ||
                            row['SiteCode'] ||
                            row['Site_Code'] ||
                            row['site code'] ||
                            '';
                          const deviceType =
                            row['DEVICE TYPE'] ||
                            row['Device Type'] ||
                            row['device type'] ||
                            row['DEVICETYPE'] ||
                            row['DeviceType'] ||
                            row['device_type'] ||
                            '';
                          
                          if (siteCode) {
                            const lowerSiteCode = String(siteCode).trim().toLowerCase();
                            const lowerDeviceType = String(deviceType || '').trim().toLowerCase();
                            
                            // Find ALL Equipment routing actions (to AMC or RTU/Communication, but NOT AMC Resolution Approval)
                            const allEquipmentActions = actionsToSearch.filter((action: any) => {
                              if (!action || typeof action !== 'object') return false;
                              // Must be Equipment routing action, but NOT AMC Resolution Approval
                              // CRITICAL: assignedByRole must be 'Equipment' (not 'AMC')
                              if (action.assignedByRole !== 'Equipment') return false;
                              // Can route to AMC or RTU/Communication
                              if (action.assignedToRole !== 'AMC' && action.assignedToRole !== 'RTU/Communication') return false;
                              if (action.typeOfIssue === 'AMC Resolution Approval') return false;
                              
                              const r = action.rowData || {};
                              const aSiteCode =
                                r['Site Code'] ||
                                r['SITE CODE'] ||
                                r['SiteCode'] ||
                                r['Site_Code'] ||
                                r['site code'] ||
                                '';
                              const aDeviceType =
                                r['DEVICE TYPE'] ||
                                r['Device Type'] ||
                                r['device type'] ||
                                r['DEVICETYPE'] ||
                                r['DeviceType'] ||
                                r['device_type'] ||
                                '';
                              
                              const aLowerSiteCode = String(aSiteCode || '').trim().toLowerCase();
                              const aLowerDeviceType = String(aDeviceType || '').trim().toLowerCase();
                              
                              const matchesSite = aLowerSiteCode === lowerSiteCode;
                              const matchesDevice = !lowerDeviceType || aLowerDeviceType === lowerDeviceType;
                              
                              return matchesSite && matchesDevice;
                            }) as any[];
                            
                            // Get the FIRST/ORIGINAL Equipment routing action (by createdAt or _id)
                            // This should have the original remarks before any updates
                            if (allEquipmentActions.length > 0) {
                              // Sort by creation date (oldest first) to get the original action
                              allEquipmentActions.sort((a: any, b: any) => {
                                const aDate = a.createdAt || a._createdAt || a.created || 0;
                                const bDate = b.createdAt || b._createdAt || b.created || 0;
                                return aDate - bDate; // Oldest first
                              });
                              equipmentAction = allEquipmentActions[0]; // Get the first/original action
                            }
                          }
                        }
                        
                        // Get Equipment remarks from equipment action ONLY
                        // Check multiple fields to get the actual remarks, not status messages
                        // IMPORTANT: Only get remarks from actions where Equipment is the SOURCE (assignedByRole === 'Equipment')
                        // Can route to AMC or RTU/Communication
                        // Do NOT get remarks from AMC Resolution Approval actions, even if they're assigned to Equipment
                        // CRITICAL: Do NOT use remarks[rowKey] or row._remarks as fallbacks - these may contain AMC/O&M remarks
                        if (equipmentAction) {
                          // Verify this is actually an Equipment routing action (to AMC or RTU/Communication), not an AMC Resolution Approval
                          if (equipmentAction.assignedByRole === 'Equipment' && 
                              (equipmentAction.assignedToRole === 'AMC' || equipmentAction.assignedToRole === 'RTU/Communication') &&
                              equipmentAction.typeOfIssue !== 'AMC Resolution Approval') {
                            // CRITICAL: Get original Equipment remarks from when they FIRST routed to AMC
                            // The original remarks should be preserved even after verification and approval
                            // Strategy: Look for the FIRST/ORIGINAL Equipment routing action to get original remarks
                            
                            const statusMessages = [
                              'Verified and Approved by Equipment',
                              'Verified and Approved by Equipment Team',
                              'Verified and approved by Equipment',
                              'Verified and approved by Equipment Team'
                            ];
                            
                            // First, try to get original remarks from current action's rowData
                            let originalRemarksFromRowData = 
                              equipmentAction.rowData?.remarks ||
                              equipmentAction.rowData?.__siteObservationRemarks ||
                              '';
                            
                            // Check if rowData remarks are only status messages (might have been overwritten)
                            const isRowDataOnlyStatus = originalRemarksFromRowData && statusMessages.some(msg => 
                              originalRemarksFromRowData.trim() === msg.trim() || 
                              originalRemarksFromRowData.trim() === msg.trim() + '.'
                            );
                            
                            // If rowData doesn't have original remarks or only has status message,
                            // try to find the original Equipment routing action from actionsArrayMap
                            if (!originalRemarksFromRowData || isRowDataOnlyStatus) {
                              const actionsArrayMap = (routedActionsMap as any).__actionsArrayMap || {};
                              const allActionsForRow = actionsArrayMap[rowKey] || 
                                                      (originalRowKeyForEquipment ? actionsArrayMap[originalRowKeyForEquipment] : []);
                              
                              if (allActionsForRow.length > 0) {
                                // Find ALL Equipment routing actions (to AMC or RTU/Communication, not AMC Resolution Approval)
                                const equipmentRoutingActions = allActionsForRow.filter((action: any) => {
                                  if (!action || typeof action !== 'object') return false;
                                  if (action.assignedByRole !== 'Equipment') return false;
                                  // Can route to AMC or RTU/Communication
                                  if (action.assignedToRole !== 'AMC' && action.assignedToRole !== 'RTU/Communication') return false;
                                  if (action.typeOfIssue === 'AMC Resolution Approval') return false;
                                  return true;
                                });
                                
                                if (equipmentRoutingActions.length > 0) {
                                  // Sort by creation date (oldest first) to get the ORIGINAL action
                                  equipmentRoutingActions.sort((a: any, b: any) => {
                                    const aDate = a.createdAt || a._createdAt || a.created || (a._id ? 0 : 9999999999999);
                                    const bDate = b.createdAt || b._createdAt || b.created || (b._id ? 0 : 9999999999999);
                                    return aDate - bDate; // Oldest first
                                  });
                                  
                                  // Get the FIRST/ORIGINAL Equipment routing action
                                  const originalEquipmentAction = equipmentRoutingActions[0];
                                  
                                  // Get original remarks from the first action's rowData
                                  const originalRemarksFromFirstAction = 
                                    originalEquipmentAction.rowData?.remarks ||
                                    originalEquipmentAction.rowData?.__siteObservationRemarks ||
                                    '';
                                  
                                  // Only use if it's not a status message
                                  if (originalRemarksFromFirstAction && 
                                      !statusMessages.some(msg => 
                                        originalRemarksFromFirstAction.trim() === msg.trim() || 
                                        originalRemarksFromFirstAction.trim() === msg.trim() + '.'
                                      )) {
                                    originalRemarksFromRowData = originalRemarksFromFirstAction;
                                  }
                                }
                              }
                            }
                            
                            // Also check action.remarks, but ONLY if rowData doesn't have remarks
                            // AND if action.remarks doesn't contain only status messages
                            const actionRemarks = equipmentAction.remarks || '';
                            const isActionRemarksOnlyStatus = statusMessages.some(msg => 
                              actionRemarks.trim() === msg.trim() || 
                              actionRemarks.trim() === msg.trim() + '.'
                            );
                            
                            // Determine which remarks to use
                            let rawRemarks = '';
                            if (originalRemarksFromRowData && originalRemarksFromRowData.trim() && !isRowDataOnlyStatus) {
                              // Use original remarks from rowData (preserved from initial routing)
                              rawRemarks = originalRemarksFromRowData.trim();
                            } else if (actionRemarks && !isActionRemarksOnlyStatus) {
                              // Use action remarks only if it's not just a status message
                              rawRemarks = actionRemarks.trim();
                            }
                            
                            // Filter out status messages from the remarks, but preserve actual remarks
                            if (rawRemarks) {
                              // Check if remarks contain ONLY status messages (no actual remarks)
                              const isOnlyStatusMessage = statusMessages.some(msg => 
                                rawRemarks.trim() === msg.trim() || 
                                rawRemarks.trim() === msg.trim() + '.'
                              );
                              
                              if (isOnlyStatusMessage) {
                                // This is ONLY a status message, not actual remarks - clear it
                                equipmentRemarks = '';
                              } else {
                                // Remove status messages from the remarks, but keep the actual remarks
                                let cleanedRemarks = rawRemarks;
                                statusMessages.forEach(msg => {
                                  // Remove status message if it appears at the start or end
                                  cleanedRemarks = cleanedRemarks
                                    .replace(new RegExp(`^${msg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[.\\n]*`, 'i'), '')
                                    .replace(new RegExp(`\\s*[.\\n]*${msg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'), '')
                                    .trim();
                                });
                                
                                // If after removing status messages there's still content, use it
                                if (cleanedRemarks && cleanedRemarks.trim()) {
                                  equipmentRemarks = cleanedRemarks.trim();
                                } else {
                                  // If no actual remarks remain after filtering, use original rawRemarks
                                  // (might be that status message was added but original remarks exist)
                                  equipmentRemarks = rawRemarks;
                                }
                              }
                            } else {
                              // No remarks found at all
                              equipmentRemarks = '';
                            }
                          } else {
                            // This is not an Equipment routing action, don't use it
                            equipmentRemarks = '';
                          }
                        }
                        
                        // CRITICAL: If no Equipment action was found in the first 3 strategies,
                        // try one more time to find it from actionsArrayMap (even when task is resolved)
                        // This ensures Equipment remarks are displayed even after resolution
                        if (!equipmentRemarks || equipmentRemarks.trim() === '') {
                          const actionsArrayMap = (routedActionsMap as any).__actionsArrayMap || {};
                          const allActionsForRow = actionsArrayMap[rowKey] || 
                                                  (originalRowKeyForEquipment ? actionsArrayMap[originalRowKeyForEquipment] : []);
                          
                          if (allActionsForRow.length > 0) {
                            const siteCode =
                              row['Site Code'] ||
                              row['SITE CODE'] ||
                              row['SiteCode'] ||
                              row['Site_Code'] ||
                              row['site code'] ||
                              '';
                            const deviceType =
                              row['DEVICE TYPE'] ||
                              row['Device Type'] ||
                              row['device type'] ||
                              row['DEVICETYPE'] ||
                              row['DeviceType'] ||
                              row['device_type'] ||
                              '';
                            
                            if (siteCode) {
                              const lowerSiteCode = String(siteCode).trim().toLowerCase();
                              const lowerDeviceType = String(deviceType || '').trim().toLowerCase();
                              
                              // Find ALL Equipment routing actions (to AMC or RTU/Communication, not AMC Resolution Approval)
                              const equipmentRoutingActions = allActionsForRow.filter((action: any) => {
                                if (!action || typeof action !== 'object') return false;
                                if (action.assignedByRole !== 'Equipment') return false;
                                // Can route to AMC or RTU/Communication
                                if (action.assignedToRole !== 'AMC' && action.assignedToRole !== 'RTU/Communication') return false;
                                if (action.typeOfIssue === 'AMC Resolution Approval') return false;
                                
                                const r = action.rowData || {};
                                const aSiteCode =
                                  r['Site Code'] ||
                                  r['SITE CODE'] ||
                                  r['SiteCode'] ||
                                  r['Site_Code'] ||
                                  r['site code'] ||
                                  '';
                                const aDeviceType =
                                  r['DEVICE TYPE'] ||
                                  r['Device Type'] ||
                                  r['device type'] ||
                                  r['DEVICETYPE'] ||
                                  r['DeviceType'] ||
                                  r['device_type'] ||
                                  '';
                                
                                const aLowerSiteCode = String(aSiteCode || '').trim().toLowerCase();
                                const aLowerDeviceType = String(aDeviceType || '').trim().toLowerCase();
                                
                                const matchesSite = aLowerSiteCode === lowerSiteCode;
                                const matchesDevice = !lowerDeviceType || aLowerDeviceType === lowerDeviceType;
                                
                                return matchesSite && matchesDevice;
                              });
                              
                              if (equipmentRoutingActions.length > 0) {
                                // Sort by creation date (oldest first) to get the ORIGINAL action
                                equipmentRoutingActions.sort((a: any, b: any) => {
                                  const aDate = a.createdAt || a._createdAt || a.created || (a._id ? 0 : 9999999999999);
                                  const bDate = b.createdAt || b._createdAt || b.created || (b._id ? 0 : 9999999999999);
                                  return aDate - bDate; // Oldest first
                                });
                                
                                // Get the FIRST/ORIGINAL Equipment routing action
                                const originalEquipmentAction = equipmentRoutingActions[0];
                                
                                // Get original remarks from the first action's rowData
                                const originalRemarksFromFirstAction = 
                                  originalEquipmentAction.rowData?.remarks ||
                                  originalEquipmentAction.rowData?.__siteObservationRemarks ||
                                  '';
                                
                                const statusMessages = [
                                  'Verified and Approved by Equipment',
                                  'Verified and Approved by Equipment Team',
                                  'Verified and approved by Equipment',
                                  'Verified and approved by Equipment Team'
                                ];
                                
                                // Only use if it's not a status message
                                if (originalRemarksFromFirstAction && 
                                    !statusMessages.some(msg => 
                                      originalRemarksFromFirstAction.trim() === msg.trim() || 
                                      originalRemarksFromFirstAction.trim() === msg.trim() + '.'
                                    )) {
                                  equipmentRemarks = originalRemarksFromFirstAction.trim();
                                }
                              }
                            }
                          }
                        }
                        
                        // DO NOT use remarks[rowKey] or row._remarks as fallbacks for Equipment users
                        // These may contain AMC or O&M remarks that were updated later
                        // Equipment remarks should ONLY come from the original Equipment routing action
                        // If no Equipment action is found, equipmentRemarks will remain empty

                        // CRITICAL: Ensure Equipment remarks don't contain AMC remarks
                        // If Equipment remarks match any AMC remarks, clear Equipment remarks
                        if (equipmentRemarks && amcRemarks) {
                          const equipmentRemarksTrimmed = equipmentRemarks.trim();
                          const amcRemarksTrimmed = amcRemarks.trim();
                          
                          // Check if Equipment remarks are actually AMC remarks
                          // This can happen if the wrong action was picked up
                          if (equipmentRemarksTrimmed === amcRemarksTrimmed || 
                              amcRemarksTrimmed.includes(equipmentRemarksTrimmed) ||
                              equipmentRemarksTrimmed.includes(amcRemarksTrimmed)) {
                            // Equipment remarks are actually AMC remarks - clear them
                            console.warn('Equipment remarks matched AMC remarks, clearing Equipment remarks:', equipmentRemarksTrimmed);
                            equipmentRemarks = '';
                          }
                        }
                        
                        // For Equipment users: Only show Equipment remarks from the original routing action
                        // Do not add "Equipment Remarks:" label - just show the remarks text
                        // CRITICAL: Do NOT use remarks[rowKey] or row._remarks - these may contain AMC/O&M remarks
                        const remarksParts: string[] = [];
                        
                        // Only show Equipment remarks from the original Equipment routing action
                        // Do NOT use any fallbacks that might contain AMC or O&M remarks
                        if (equipmentRemarks && equipmentRemarks.trim()) {
                          const equipmentRemarksTrimmed = equipmentRemarks.trim();
                          
                          // Filter out status messages - if it's a status message, don't show it
                          const statusMessages = [
                            'Verified and Approved by Equipment',
                            'Verified and Approved by Equipment Team',
                            'Verified and approved by Equipment',
                            'Verified and approved by Equipment Team'
                          ];
                          
                          if (!statusMessages.some(msg => equipmentRemarksTrimmed.includes(msg))) {
                            // Remove "Equipment Remarks:" label if present, then add just the text
                            const cleanRemarks = equipmentRemarksTrimmed.replace(/^Equipment Remarks:\s*/i, '').trim();
                            if (cleanRemarks) {
                              remarksParts.push(cleanRemarks);
                            }
                          }
                        }
                        
                        // For Equipment users: Prioritize database-loaded remarks (remarks[rowKey])
                        // Database remarks are the primary source now that we're using database storage
                        // Only use action-based remarks as fallback if database doesn't have remarks
                        
                        // If we have database remarks, use them (already set above)
                        // Otherwise, use action-based remarks if available
                        if (!displayRemarks || displayRemarks === '-' || displayRemarks.trim() === '') {
                          if (remarksParts.length > 0) {
                            displayRemarks = remarksParts.join('\n\n');
                          } else {
                            // Final fallback: check if we have remarks from database that weren't caught earlier
                            if (remarks[rowKey] && remarks[rowKey].trim() !== '') {
                              displayRemarks = remarks[rowKey];
                            } else {
                              displayRemarks = '-';
                            }
                          }
                        }
                      } // Close the else block for action-based remarks fallback (line 4249)
                      } else if (userRole === 'AMC') {
                        // For AMC users: Show their actual remarks from Site Observations
                        // Find the AMC Resolution Approval action they created
                        const originalRowKeyForAMC = (row as any).__siteObservationRowKey as string | undefined;
                        let amcAction =
                          routedActionsMap[rowKey] ||
                          (originalRowKeyForAMC ? routedActionsMap[originalRowKeyForAMC] : undefined);

                        // If direct lookup failed, try matching by Site Code + Device Type
                        if (!amcAction || amcAction.typeOfIssue !== 'AMC Resolution Approval') {
                          const siteCode =
                            row['Site Code'] ||
                            row['SITE CODE'] ||
                            row['SiteCode'] ||
                            row['Site_Code'] ||
                            row['site code'] ||
                            '';
                          const deviceType =
                            row['DEVICE TYPE'] ||
                            row['Device Type'] ||
                            row['device type'] ||
                            row['DEVICETYPE'] ||
                            row['DeviceType'] ||
                            row['device_type'] ||
                            '';

                          if (siteCode) {
                            const lowerSiteCode = String(siteCode).trim().toLowerCase();
                            const lowerDeviceType = String(deviceType || '').trim().toLowerCase();

                            amcAction = Object.values(routedActionsMap).find((action: any) => {
                              if (action.typeOfIssue !== 'AMC Resolution Approval') return false;
                              if (action.assignedByRole !== 'AMC') return false;
                              
                              const r = action.rowData || {};
                              const aSiteCode =
                                r['Site Code'] ||
                                r['SITE CODE'] ||
                                r['SiteCode'] ||
                                r['Site_Code'] ||
                                r['site code'] ||
                                '';
                              const aDeviceType =
                                r['DEVICE TYPE'] ||
                                r['Device Type'] ||
                                r['device type'] ||
                                r['DEVICETYPE'] ||
                                r['DeviceType'] ||
                                r['device_type'] ||
                                '';

                              const matchesSite =
                                String(aSiteCode || '').trim().toLowerCase() === lowerSiteCode;
                              const matchesDevice =
                                !lowerDeviceType ||
                                String(aDeviceType || '').trim().toLowerCase() === lowerDeviceType;

                              return matchesSite && matchesDevice;
                            }) as any;
                          }
                        }

                        // Get AMC remarks from their action
                        // CRITICAL: Get the actual AMC remarks, not Equipment status messages
                        // Priority: rowData.__siteObservationRemarks (original AMC remarks) > rowData.remarks > action.remarks
                        let amcRemarksValue = '';
                        const statusMessages = [
                          'Verified and Approved by Equipment',
                          'Verified and Approved by Equipment Team',
                          'Verified and approved by Equipment',
                          'Verified and approved by Equipment Team',
                          'Pending Equipment Approval',
                          'Recheck Requested',
                          'Pending Equipment Approval',
                          'Recheck Requested'
                        ];
                        
                        if (amcAction && amcAction.typeOfIssue === 'AMC Resolution Approval' && amcAction.assignedByRole === 'AMC') {
                          // Priority 1: Get from rowData.__siteObservationRemarks (original AMC remarks when they submitted)
                          const originalAMCRemarks = amcAction.rowData?.__siteObservationRemarks || '';
                          
                          // Priority 2: Get from rowData.remarks (should contain original AMC remarks)
                          const rowDataRemarks = amcAction.rowData?.remarks || '';
                          
                          // Priority 3: Get from action.remarks (might be updated with status messages)
                          const actionRemarks = amcAction.remarks || '';
                          
                          // Check which one to use - prefer original remarks that are NOT status messages
                          if (originalAMCRemarks && originalAMCRemarks.trim() && 
                              !statusMessages.some(msg => originalAMCRemarks.trim() === msg.trim() || 
                                                         originalAMCRemarks.trim() === msg.trim() + '.')) {
                            amcRemarksValue = originalAMCRemarks.trim();
                          } else if (rowDataRemarks && rowDataRemarks.trim() && 
                                     !statusMessages.some(msg => rowDataRemarks.trim() === msg.trim() || 
                                                                rowDataRemarks.trim() === msg.trim() + '.')) {
                            amcRemarksValue = rowDataRemarks.trim();
                          } else if (actionRemarks && actionRemarks.trim() && 
                                     !statusMessages.some(msg => actionRemarks.trim() === msg.trim() || 
                                                                actionRemarks.trim() === msg.trim() + '.')) {
                            amcRemarksValue = actionRemarks.trim();
                          }
                          
                          // If we got remarks but they contain status messages, try to extract actual remarks
                          if (amcRemarksValue && statusMessages.some(msg => amcRemarksValue.includes(msg))) {
                            // Check if it's ONLY a status message
                            const isOnlyStatus = statusMessages.some(msg => 
                              amcRemarksValue.trim() === msg.trim() || 
                              amcRemarksValue.trim() === msg.trim() + '.'
                            );
                            
                            if (isOnlyStatus) {
                              // It's only a status message, clear it
                              amcRemarksValue = '';
                            } else {
                              // It contains both remarks and status message, try to remove status message
                              let cleanedRemarks = amcRemarksValue;
                              statusMessages.forEach(msg => {
                                cleanedRemarks = cleanedRemarks
                                  .replace(new RegExp(`^${msg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[.\\n]*`, 'i'), '')
                                  .replace(new RegExp(`\\s*[.\\n]*${msg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'), '')
                                  .trim();
                              });
                              
                              if (cleanedRemarks && cleanedRemarks.trim()) {
                                amcRemarksValue = cleanedRemarks.trim();
                              } else {
                                // If after cleaning there's nothing left, it was only status message
                                amcRemarksValue = '';
                              }
                            }
                          }
                        }
                        
                        // Set displayRemarks to AMC remarks (filtered)
                        if (amcRemarksValue && amcRemarksValue.trim()) {
                          displayRemarks = amcRemarksValue.trim();
                        } else {
                          // No valid AMC remarks found - show default
                          displayRemarks = '-';
                        }
                        
                        // DO NOT use remarks[rowKey] or row._remarks as fallbacks for AMC users
                        // These may contain Equipment status messages or other role's remarks
                        // AMC remarks should ONLY come from the AMC Resolution Approval action
                      } else {
                        // For other roles, use existing logic
                        const routedAction = routedActionsMap[rowKey];
                        if (routedAction && routedAction.remarks) {
                          displayRemarks = routedAction.remarks;
                        }
                      }
                      
                      // For Equipment users: Final check - use database-loaded remarks if available
                      // This ensures database remarks are always shown, even if action logic didn't find them
                      if (userRole === 'Equipment' && (!displayRemarks || displayRemarks === '-' || displayRemarks.trim() === '')) {
                        if (remarks[rowKey] && remarks[rowKey].trim() !== '') {
                          displayRemarks = remarks[rowKey];
                        }
                      }
                      
                      // For AMC users: DO NOT use row._remarks as fallback
                      // It may contain Equipment status messages or other role's remarks
                      // AMC remarks should ONLY come from the AMC Resolution Approval action
                      // For other roles, check if this is an action row and use _remarks if available
                      if (userRole !== 'AMC' && userRole !== 'Equipment' && (!displayRemarks || displayRemarks === '-') && row._remarks) {
                        const statusMessages = [
                          'Verified and Approved by Equipment',
                          'Verified and Approved by Equipment Team',
                          'Verified and approved by Equipment',
                          'Verified and approved by Equipment Team',
                          'Pending Equipment Approval',
                          'Recheck Requested'
                        ];
                        if (!statusMessages.some(msg => String(row._remarks || '').includes(msg))) {
                          displayRemarks = row._remarks;
                        } else {
                          displayRemarks = row._remarks;
                        }
                      }
                      
                      return (
                        <td
                          key={h}
                          className="px-3 py-1 border border-gray-300 text-center"
                          style={{ fontFamily: 'Times New Roman, Times, serif', fontSize: 12 }}
                        >
                          <div className="text-sm text-gray-700 whitespace-pre-wrap text-left">
                            {displayRemarks}
                          </div>
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
              )
            })}
          </tbody>
        </table>
      </div>
      )}
      {rows.length > 0 && (
        <div className="flex flex-col items-center gap-2 mt-6">
          <div className="flex items-center gap-4">
            <button 
              className="bg-gray-200 px-4 py-1 rounded disabled:opacity-50 border border-gray-300" 
              disabled={currentPage === 1} 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <span className="font-medium text-gray-700">Page {currentPage} of {totalPages}</span>
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
              {PAGE_SIZE_OPTIONS.map(size => (<option key={size} value={size}>{size}</option>))}
            </select>
          </div>
        </div>
      )}

      {/* Site Observations Dialog */}
      {showSiteObservationsDialog && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-center justify-center"
          style={{ padding: '20px' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowSiteObservationsDialog(false);
              setSelectedSiteObservationRowKey('');
              setSiteObservationsStatus('');
              setIsTypeOfSpareDropdownOpen(false);
              setSiteObservationsDialogData({
                remarks: '',
                typeOfIssue: '',
                specifyOther: '',
                typeOfSpare: [],
                specifySpareOther: '',
                capturedPhotos: [],
                uploadedPhotos: [],
                uploadedDocuments: []
              });
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
              <h3 className="text-lg font-bold text-gray-800 text-center">Site Observations</h3>
            </div>
            
            {/* Scrollable Content Area */}
            <div 
              className="px-5 overflow-y-auto overflow-x-hidden flex-grow"
              style={{ 
                maxHeight: 'calc(100vh - 200px)',
                minHeight: 0
              }}
            >
              {/* Type of Issue - Only for Pending status */}
              {siteObservationsStatus === 'pending' && userRole !== 'AMC' && (
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1.5 text-center">
                  Type of Issue <span className="text-red-500">*</span>
                </label>
                <select
                    value={siteObservationsDialogData.typeOfIssue}
                    onChange={(e) => {
                      const newTypeOfIssue = e.target.value;
                      setSiteObservationsDialogData(prev => ({ 
                        ...prev, 
                        typeOfIssue: newTypeOfIssue,
                        specifyOther: newTypeOfIssue === 'Others' ? prev.specifyOther : '',
                        // Clear spare selection if changing away from Spare Required
                        typeOfSpare: newTypeOfIssue === 'Spare Required' ? prev.typeOfSpare : [],
                        specifySpareOther: newTypeOfIssue === 'Spare Required' && prev.typeOfSpare.includes('OTHERS') ? prev.specifySpareOther : ''
                      }));
                      if (newTypeOfIssue !== 'Spare Required') {
                        setIsTypeOfSpareDropdownOpen(false);
                      }
                    }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="">Select Type of Issue</option>
                    <option value="Faulty">Faulty</option>
                    <option value="Bipassed">Bipassed</option>
                    <option value="Line Idel">Line Idel</option>
                    <option value="AT Jump cut">AT Jump cut</option>
                  <option value="Dismantled">Dismantled</option>
                    <option value="Replaced">Replaced</option>
                    <option value="CS Issue">CS Issue</option>
                    <option value="RTU Issue">RTU Issue</option>
                    <option value="Equipment Idle">Equipment Idle</option>
                    <option value="AT-PT Chamber Flashover">AT-PT Chamber Flashover</option>
                    <option value="Spare Required">Spare Required</option>
                    <option value="Others">Others</option>
                </select>
              </div>
              )}

              {/* Please Specify - Only when Others is selected */}
              {siteObservationsStatus === 'pending' && siteObservationsDialogData.typeOfIssue === 'Others' && (
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1.5 text-center">
                    Please Specify <span className="text-red-500">*</span>
                </label>
                  <input
                    type="text"
                    value={siteObservationsDialogData.specifyOther}
                    onChange={(e) => setSiteObservationsDialogData(prev => ({ ...prev, specifyOther: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="Please specify..."
                />
              </div>
              )}

              {/* Type of Spare - Only when Spare Required is selected */}
              {siteObservationsStatus === 'pending' && siteObservationsDialogData.typeOfIssue === 'Spare Required' && (
                <div className="mb-3 relative type-of-spare-dropdown">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5 text-center">
                    Type of Spare <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsTypeOfSpareDropdownOpen(!isTypeOfSpareDropdownOpen)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-left flex justify-between items-center bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <span className={siteObservationsDialogData.typeOfSpare.length === 0 ? 'text-gray-400' : 'text-gray-700'}>
                      {siteObservationsDialogData.typeOfSpare.length === 0 ? 'Select Type of Spare' : `${siteObservationsDialogData.typeOfSpare.length} selected`}
                    </span>
                    <span className="text-gray-400">▼</span>
                  </button>
                  
                  {isTypeOfSpareDropdownOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {[
                        'AT PT FUSES',
                        '24 V SMPS',
                        '12 V SMPS',
                        'DC TO DC CONVERTER',
                        'CONTROL CARD',
                        'BATTERY CHARGER',
                        'LT FUSE',
                        'TB',
                        'AC MCB',
                        'DC MCB',
                        'L/R SWITCH',
                        'SPRING RETURN ON/OFF SWITCH',
                        'RELAY',
                        'RELAY CELLS',
                        'SURGE ARRESTOR',
                        'AUX TRANSFORMER (AT)',
                        'POTENTIAL TRANSFORMER (PT)',
                        'CURRENT TRANSFORMER (CT)',
                        'MULTI FUNTION METER (MFM)',
                        'MOTOR',
                        'VPIS',
                        'SF6 GAS',
                        'EMERGENCY SWITCH',
                        'HYDRAULIC LIFT',
                        'PUSH BUTTON',
                        'FAULT PASSAGE INDICATOR (FPI)',
                        'FPI CELLS',
                        'HOOTER',
                        'LIMIT SWITCH',
                        'CABLE DOOR',
                        'CABLE BOOT',
                        'CABLE CLAMPS',
                        'VERMIN PROOF AGENT',
                        '12V BATTERY',
                        'AC PROPTECTOR',
                        'CMU BOARD',
                        'CONTROLLER',
                        'PTN BOARD',
                        'VOLTAGE CARD',
                        'CAPACITOR BANK',
                        'HMI',
                        'TRANSFORMER (230/30V)',
                        'OD OPERATING MECHANISM',
                        'VL OPERATING MECHNISM',
                        'OD AB3 CARD',
                        'VL AB3 CARD',
                        'OD AUXILIARY SWITCH',
                        'VL AUXILIARY SWITCH',
                        'MONO METER',
                        'NRV',
                        'DOOR HINGES',
                        'SURFACE HEATER',
                        'TRIPPING COIL',
                        'OPERATING HANDLE',
                        'EARTHING STRIPS',
                        'EARTHING PIPE',
                        'COAL & SALT MIX',
                        'BENTONITE',
                        'OTHERS'
                      ].map(option => (
                        <label
                          key={option}
                          className="flex items-center px-4 py-2 hover:bg-blue-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={siteObservationsDialogData.typeOfSpare.includes(option)}
                            onChange={() => {
                              setSiteObservationsDialogData(prev => {
                                const currentSpares = prev.typeOfSpare;
                                const isSelected = currentSpares.includes(option);
                                let newSpares: string[];
                                
                                if (isSelected) {
                                  // Remove if already selected
                                  newSpares = currentSpares.filter(s => s !== option);
                                } else {
                                  // Add if not selected
                                  newSpares = [...currentSpares, option];
                                }
                                
                                // Clear specifySpareOther if OTHERS is removed
                                const specifyOther = newSpares.includes('OTHERS') ? prev.specifySpareOther : '';
                                
                                return {
                                  ...prev,
                                  typeOfSpare: newSpares,
                                  specifySpareOther: specifyOther
                                };
                              });
                            }}
                            className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700">{option}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Please Specify Spare - Only when OTHERS is selected in Type of Spare */}
              {siteObservationsStatus === 'pending' && siteObservationsDialogData.typeOfIssue === 'Spare Required' && siteObservationsDialogData.typeOfSpare.includes('OTHERS') && (
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1.5 text-center">
                    Please Specify <span className="text-red-500">*</span>
                </label>
                  <input
                    type="text"
                    value={siteObservationsDialogData.specifySpareOther}
                    onChange={(e) => setSiteObservationsDialogData(prev => ({ ...prev, specifySpareOther: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="Please specify..."
                  />
                </div>
              )}


              {/* Remarks */}
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1.5 text-center">
                  Remarks {siteObservationsStatus === 'resolved' && <span className="text-red-500">*</span>}
                </label>
                <textarea
                  value={siteObservationsDialogData.remarks}
                  onChange={(e) => setSiteObservationsDialogData(prev => ({ ...prev, remarks: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
                  placeholder="Enter remarks..."
                />
              </div>

              {/* Upload Document - AMC users only */}
              {userRole === 'AMC' && (
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5 text-center">
                    Upload Document (PDF)
                  </label>
                  <div className="flex gap-4 items-center justify-center flex-wrap">
                    <input
                      type="file"
                      id="upload-site-observations-document"
                      accept="application/pdf"
                      multiple
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        if (files.length === 0) {
                          return;
                        }
                        const pdfFiles = files.filter(file => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
                        if (pdfFiles.length !== files.length) {
                          alert('Only PDF files are allowed for support documents.');
                        }
                        if (pdfFiles.length > 0) {
                          setSiteObservationsDialogData(prev => ({
                            ...prev,
                            uploadedDocuments: [...prev.uploadedDocuments, ...pdfFiles]
                          }));
                        }
                        // Reset input to allow selecting the same files again
                        e.target.value = '';
                      }}
                      className="hidden"
                    />
                    <label
                      htmlFor="upload-site-observations-document"
                      style={{
                        backgroundColor: '#6366f1',
                        color: '#ffffff',
                        padding: '8px 16px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        fontSize: '14px',
                        fontWeight: '600',
                        display: 'inline-block',
                        minWidth: '150px',
                        textAlign: 'center'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4f46e5'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#6366f1'}
                    >
                      Upload Document
                    </label>
                  </div>

                  {(existingSupportDocuments.length > 0 || siteObservationsDialogData.uploadedDocuments.length > 0) && (
                    <div className="mt-3 border border-gray-200 rounded-md divide-y divide-gray-200">
                      {existingSupportDocuments.map((doc, idx) => (
                        <div key={`existing-doc-${idx}`} className="flex items-center justify-between px-3 py-2 text-sm text-gray-700">
                          <a
                            href={doc.data}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline break-all"
                          >
                            {doc.name || `Document ${idx + 1}`}
                          </a>
                          <button
                            type="button"
                            onClick={() => {
                              if (!selectedSiteObservationRowKey) return;
                              setSupportDocuments(prev => {
                                const current = prev[selectedSiteObservationRowKey] || [];
                                const updatedDocs = current.filter((_, i) => i !== idx);
                                const newState = { ...prev };
                                if (updatedDocs.length > 0) {
                                  newState[selectedSiteObservationRowKey] = updatedDocs;
                                } else {
                                  delete newState[selectedSiteObservationRowKey];
                                }
                                supportDocumentsRef.current = newState;
                                return newState;
                              });
                            }}
                            className="text-red-500 hover:text-red-600 text-xs font-semibold"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      {siteObservationsDialogData.uploadedDocuments.map((doc, idx) => (
                        <div key={`new-doc-${idx}`} className="flex items-center justify-between px-3 py-2 text-sm text-gray-700">
                          <span className="break-all">{doc.name}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setSiteObservationsDialogData(prev => ({
                                ...prev,
                                uploadedDocuments: prev.uploadedDocuments.filter((_, i) => i !== idx)
                              }));
                            }}
                            className="text-red-500 hover:text-red-600 text-xs font-semibold"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Capture Photo and Upload Photo in one row */}
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1.5 text-center">
                  Photo Options
                </label>
                <div className="flex gap-4 items-center justify-center flex-wrap">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        // Request camera access - try back camera first, then any camera
                        let stream: MediaStream | null = null;
                        try {
                          stream = await navigator.mediaDevices.getUserMedia({
                            video: { facingMode: 'environment' } // Prefer back camera on mobile
                          });
                        } catch (e) {
                          // Fallback to any available camera
                          stream = await navigator.mediaDevices.getUserMedia({
                            video: true
                          });
                        }
                        setSiteObservationsCameraStream(stream);
                        setShowSiteObservationsCameraPreview(true);
                        setSiteObservationsCapturedImageData(null); // Reset any previous capture
                      } catch (error) {
                        console.error('Error accessing camera:', error);
                        alert('Could not access camera. Please check permissions or use Upload Photo instead.');
                        // Fallback to file input if getUserMedia fails
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.capture = 'environment';
                        input.onchange = (e: any) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              setSiteObservationsCapturedImageData(event.target?.result as string);
                              setShowSiteObservationsCameraPreview(true);
                            };
                            reader.readAsDataURL(file);
                          }
                        };
                        input.click();
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
                      display: 'inline-block',
                      minWidth: '130px',
                      textAlign: 'center',
                      marginRight: '16px',
                      border: 'none'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
                  >
                    Capture Photo
                  </button>
                  
                  <input
                    type="file"
                    id="upload-site-observations-photo"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      if (files.length > 0) {
                        setSiteObservationsDialogData(prev => ({
                          ...prev,
                          uploadedPhotos: [...prev.uploadedPhotos, ...files]
                        }));
                      }
                      // Reset input to allow selecting the same files again
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                  <label
                    htmlFor="upload-site-observations-photo"
                    style={{
                      backgroundColor: '#10b981',
                      color: '#ffffff',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      fontSize: '14px',
                      fontWeight: '600',
                      display: 'inline-block',
                      minWidth: '130px',
                      textAlign: 'center',
                      marginLeft: '16px'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#059669'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#10b981'}
                  >
                    Upload Photo
                  </label>
                </div>
              </div>
              
              {/* Photo Preview Section */}
              <div className="mb-3">
                {(siteObservationsDialogData.capturedPhotos.length > 0 || siteObservationsDialogData.uploadedPhotos.length > 0) && (
                  <div className="w-full">
                    <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
                      Photos ({siteObservationsDialogData.capturedPhotos.length + siteObservationsDialogData.uploadedPhotos.length})
                    </label>
                    <div className="flex flex-wrap gap-2 justify-center max-h-40 overflow-y-auto p-2 border border-gray-200 rounded">
                      {/* Captured Photos */}
                      {siteObservationsDialogData.capturedPhotos.map((photo, idx) => (
                        <div key={`captured-so-${idx}`} className="relative">
                          <img
                            src={photo.data}
                            alt={`Captured ${idx + 1}`}
                            className="w-16 h-16 object-cover rounded border border-gray-300"
                            title={photo.timestamp ? `Captured: ${new Date(photo.timestamp).toLocaleString()}\nLocation: ${photo.location || 'N/A'}\nCoordinates: ${photo.latitude ? `${photo.latitude}, ${photo.longitude}` : 'N/A'}` : ''}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setSiteObservationsDialogData(prev => ({
                                ...prev,
                                capturedPhotos: prev.capturedPhotos.filter((_, i) => i !== idx)
                              }));
                            }}
                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                            style={{ fontSize: '12px', lineHeight: '1' }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      {/* Uploaded Photos */}
                      {siteObservationsDialogData.uploadedPhotos.map((photo, idx) => (
                        <div key={`uploaded-so-${idx}`} className="relative">
                          <img
                            src={URL.createObjectURL(photo)}
                            alt={photo.name}
                            className="w-16 h-16 object-cover rounded border border-gray-300"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setSiteObservationsDialogData(prev => ({
                                ...prev,
                                uploadedPhotos: prev.uploadedPhotos.filter((_, i) => i !== idx)
                              }));
                            }}
                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                            style={{ fontSize: '12px', lineHeight: '1' }}
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
            
            {/* Buttons - Fixed at bottom - Always Visible */}
            <div 
              className="px-5 pb-5 pt-4 border-t-2 border-gray-300 bg-gray-50 flex justify-end flex-shrink-0"
              style={{ 
                backgroundColor: '#f9fafb',
                minHeight: '70px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '20px'
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setShowSiteObservationsDialog(false);
                  setSelectedSiteObservationRowKey('');
                  setSiteObservationsStatus('');
                  setSiteObservationsDialogData({
                    remarks: '',
                    typeOfIssue: '',
                    specifyOther: '',
                    typeOfSpare: [],
                    specifySpareOther: '',
                    capturedPhotos: [],
                    uploadedPhotos: [],
                    uploadedDocuments: []
                  });
                  // Revert Site Observations to empty if dialog cancelled
                  setSiteObservations(prev => {
                    const updated = { ...prev };
                    delete updated[selectedSiteObservationRowKey];
                    return updated;
                  });
                }}
                style={{
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  minWidth: '100px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (isSubmittingSiteObservations) return;
                  
                  // Validation for Pending status
                  if (siteObservationsStatus === 'pending' && userRole !== 'AMC') {
                    if (!siteObservationsDialogData.typeOfIssue) {
                    alert('Please select Type of Issue');
                    return;
                  }
                    if (siteObservationsDialogData.typeOfIssue === 'Others' && !siteObservationsDialogData.specifyOther.trim()) {
                      alert('Please specify the issue type');
                    return;
                  }
                  }
                  
                  // Validation for Resolved status
                  if (siteObservationsStatus === 'resolved') {
                    if (!siteObservationsDialogData.remarks.trim()) {
                      alert('Please enter remarks');
                    return;
                    }
                  }

                  setIsSubmittingSiteObservations(true);

                  // Give React time to update the UI
                  setTimeout(async () => {
                    try {
                      // Find the row first to check if it's an action row
                      const findRowIndex = searchedRows.findIndex((r: any) => {
                        const currentRowKey = generateRowKey(selectedFile, r, headers);
                        return currentRowKey === selectedSiteObservationRowKey;
                      });

                      if (findRowIndex === -1) {
                        alert('Row not found. Please refresh and try again.');
                        setIsSubmittingSiteObservations(false);
                        return;
                      }

                      const rowData = searchedRows[findRowIndex];
                      
                      // Check if O&M user selected RTU Issue or CS Issue - auto-route to RTU/Communication
                      const isRTUIssueOrCSIssue = (siteObservationsDialogData.typeOfIssue === 'RTU Issue' || siteObservationsDialogData.typeOfIssue === 'CS Issue');
                      const isAutoRoute = userRole === 'O&M' && isRTUIssueOrCSIssue && rowData._actionId && siteObservationsStatus === 'pending';
                      
                      // Handle auto-routing for RTU/CS issues from O&M user
                      if (isAutoRoute) {
                        const token = localStorage.getItem('token');
                        if (!token) {
                          alert('Authentication required. Please login again.');
                          setIsSubmittingSiteObservations(false);
                          return;
                        }

                        // Prepare photo data for auto-routing
                        let photoData: string[] = [];
                        
                        if (siteObservationsDialogData.capturedPhotos && siteObservationsDialogData.capturedPhotos.length > 0) {
                          photoData = siteObservationsDialogData.capturedPhotos.map(photo => photo.data);
                        }
                        
                        if (siteObservationsDialogData.uploadedPhotos && siteObservationsDialogData.uploadedPhotos.length > 0) {
                          const uploadedBase64 = await Promise.all(
                            siteObservationsDialogData.uploadedPhotos.map(file =>
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

                        const photosToSend = photoData.length > 0 ? photoData : null;

                        let documentData: Array<{ name: string; data: string }> = [...(supportDocuments[selectedSiteObservationRowKey] || [])];
                        if (siteObservationsDialogData.uploadedDocuments && siteObservationsDialogData.uploadedDocuments.length > 0) {
                          const newDocuments = await Promise.all(
                            siteObservationsDialogData.uploadedDocuments.map(file =>
                              new Promise<{ name: string; data: string }>((resolve, reject) => {
                                const reader = new FileReader();
                                reader.onload = (e) => resolve({
                                  name: file.name,
                                  data: e.target?.result as string
                                });
                                reader.onerror = reject;
                                reader.readAsDataURL(file);
                              })
                            )
                          );
                          documentData = [...documentData, ...newDocuments];
                        }

                        // Auto-reroute to RTU/Communication Team (backend will find the user)
                        // First, we need to find an RTU/Communication user in the same division
                        try {
                          const usersRes = await fetch(`${API_BASE}/api/auth/users`, {
                            headers: {
                              'Authorization': `Bearer ${token}`
                            }
                          });
                          
                          if (usersRes.ok) {
                            const usersResult = await usersRes.json();
                            if (usersResult.success && Array.isArray(usersResult.data)) {
                              // Find RTU/Communication user in same division
                              const currentDivisions = user?.division || [];
                              const rtuUser = usersResult.data.find((u: any) => 
                                u.role === 'RTU/Communication' && 
                                u.status === 'approved' && 
                                u.isActive === true &&
                                (currentDivisions.length === 0 || u.division?.some((d: string) => currentDivisions.includes(d)))
                              );
                              
                              if (!rtuUser) {
                                alert('No RTU/Communication user found in your division. Please contact administrator.');
                                setIsSubmittingSiteObservations(false);
                                return;
                              }

                              // Reroute the action to RTU/Communication
                              const rerouteResponse = await fetch(`${API_BASE}/api/actions/${rowData._actionId}/reroute`, {
                                method: 'PUT',
                                headers: {
                                  'Content-Type': 'application/json',
                                  'Authorization': `Bearer ${token}`
                                },
                                body: JSON.stringify({
                                  assignedToUserId: rtuUser.userId,
                                  assignedToRole: 'RTU/Communication',
                                  remarks: siteObservationsDialogData.remarks || '',
                                  photo: photosToSend
                                })
                              });

                              const rerouteResult = await rerouteResponse.json();

                              if (!rerouteResponse.ok) {
                                throw new Error(rerouteResult.error || 'Failed to auto-route action to RTU/Communication Team');
                              }

                              console.log('Action auto-routed to RTU/Communication Team:', rerouteResult);
                              
                              // Log activity for Equipment users
                              if (userRole === 'Equipment') {
                                // Extract site name from row data
                                const siteName = rowData['Site Name'] || 
                                                rowData['SITE NAME'] || 
                                                rowData['Site'] || 
                                                rowData['Location'] ||
                                                rowData['LOCATION'] ||
                                                'Unknown';
                                
                                // Extract site code from row data
                                const siteCode = rowData['Site Code'] || 
                                                rowData['SITE CODE'] || 
                                                rowData['Code'] ||
                                                rowData['CODE'] ||
                                                rowData['SiteCode'] ||
                                                '';
                                
                                logActivity({
                                  action: 'Auto-routed to RTU/Communication Team',
                                  typeOfIssue: siteObservationsDialogData.typeOfIssue,
                                  routingTeam: 'RTU/Communication Team',
                                  remarks: siteObservationsDialogData.remarks || '',
                                  siteName: String(siteName),
                                  siteCode: String(siteCode),
                                  rowKey: selectedSiteObservationRowKey,
                                  sourceFileId: selectedFile,
                                  photosCount: photoData.length,
                                  photos: photoData.length > 0 ? photoData : undefined,
                                  status: 'Pending',
                                  priority: 'Medium',
                                  assignedToUserId: rtuUser.userId,
                                  assignedToRole: 'RTU/Communication'
                                });
                              }
                              
                              // Update the action row in state
                              setActionsRows(prev => {
                                const updated = prev.map((actionRow: any) => {
                                  if (actionRow._actionId === rowData._actionId) {
                                    return {
                                      ...actionRow,
                                      _assignedToUserId: rtuUser.userId,
                                      _assignedToRole: 'RTU/Communication',
                                      _status: 'Pending'
                                    };
                                  }
                                  return actionRow;
                                });
                                return updated;
                              });
                              
                              // Update task status
                              setTaskStatus(prev => {
                                const updated = {
                                  ...prev,
                                  [selectedSiteObservationRowKey]: `Pending at RTU/Communication Team`
                                };
                                taskStatusRef.current = updated;
                                return updated;
                              });
                              
                              // Update other columns
                              setTypeOfIssue(prev => {
                                const updated = {
                                  ...prev,
                                  [selectedSiteObservationRowKey]: siteObservationsDialogData.typeOfIssue
                                };
                                typeOfIssueRef.current = updated;
                                return updated;
                              });
                              
                              setRemarks(prev => {
                                const updated = {
                                  ...prev,
                                  [selectedSiteObservationRowKey]: siteObservationsDialogData.remarks || ''
                                };
                                remarksRef.current = updated;
                                return updated;
                              });
                              
                              if (photoData.length > 0) {
                                setViewPhotos(prev => {
                                  const updated = {
                                    ...prev,
                                    [selectedSiteObservationRowKey]: photoData
                                  };
                                  viewPhotosRef.current = updated;
                                  return updated;
                                });
                              }
                              
                              setSupportDocuments(prev => {
                                const updated = { ...prev };
                                if (documentData.length > 0) {
                                  updated[selectedSiteObservationRowKey] = documentData;
                                } else {
                                  delete updated[selectedSiteObservationRowKey];
                                }
                                supportDocumentsRef.current = updated;
                                return updated;
                              });
                              
                              // Save to localStorage
                              setTimeout(() => saveToLocalStorage(), 300);
                              
                              alert('Action auto-routed to RTU/Communication Team successfully!');
                              
                              // Close dialog
                              setShowSiteObservationsDialog(false);
                              setSelectedSiteObservationRowKey('');
                              setSiteObservationsStatus('');
                              setSiteObservationsDialogData({
                                remarks: '',
                                typeOfIssue: '',
                                specifyOther: '',
                                typeOfSpare: [],
                                specifySpareOther: '',
                                capturedPhotos: [],
                                uploadedPhotos: [],
                                uploadedDocuments: []
                              });
                              
                              setIsSubmittingSiteObservations(false);
                              return;
                            } else {
                              throw new Error('Failed to fetch users');
                            }
                          } else {
                            throw new Error('Failed to fetch users');
                          }
                        } catch (error: any) {
                          console.error('Error auto-routing action:', error);
                          alert(error.message || 'Failed to auto-route action. Please try again.');
                          setIsSubmittingSiteObservations(false);
                          return;
                        }
                      }
                      
                      // Existing routing logic for new actions
                      // Check if RTU Issue or CS Issue is selected - route to RTU/Communication Team
                      const isRTUIssue = siteObservationsDialogData.typeOfIssue === 'RTU Issue' || siteObservationsDialogData.typeOfIssue === 'CS Issue';
                      const routingTeam = isRTUIssue ? 'RTU/Communication Team' : null;
                      
                      // Check if Spare Required or Faulty - route to AMC Team
                      // Site Code priority: Backend will check Site Code FIRST (Jyothi Electricals)
                      // If Site Code not in Jyothi list, backend will check Device Type (RMU) and Circle
                      // For Faulty/Spare Required: ALWAYS route to BOTH AMC and O&M teams
                      const isAMCIssue = siteObservationsDialogData.typeOfIssue === 'Spare Required' || siteObservationsDialogData.typeOfIssue === 'Faulty';
                      let amcRoutingTeam = null;
                      
                      console.log('AMC Routing Check:`, {
                        isAMCIssue,
                        typeOfIssue: siteObservationsDialogData.typeOfIssue,
                        hasRowData: !!rowData,
                        userRole
                      });
                      
                      // For "Faulty" and "Spare Required": ALWAYS route to AMC Team (let backend handle Site Code priority)
                      // Backend will check Site Code FIRST, then fall back to Device Type (RMU) + Circle if needed
                      if (isAMCIssue && rowData) {
                        // Extract Site Code first (for backend Site Code priority check)
                        const siteCode = rowData['Site Code'] || 
                                       rowData['SITE CODE'] || 
                                       rowData['SiteCode'] || 
                                       rowData['Site_Code'] ||
                                       rowData['site code'] ||
                                       '';
                        
                        console.log('Site Code for AMC routing:', siteCode);
                        
                        // ALWAYS set AMC routing team for Faulty/Spare Required
                        // Backend will handle Site Code priority (Jyothi Electricals) vs Circle-based routing
                        amcRoutingTeam = 'AMC Team';
                        console.log('AMC Routing Team set to AMC Team (backend will handle Site Code priority vs Circle-based routing)');
                        
                        // Extract Device Type and Circle for backend fallback (if Site Code not in Jyothi list)
                        let deviceType = '';
                        const deviceTypeKeys = ['DEVICE TYPE', 'Device Type', 'device type', 'DEVICETYPE', 'DeviceType', 'device_type'];
                        for (const key of deviceTypeKeys) {
                          if (rowData[key]) {
                            deviceType = String(rowData[key]).trim();
                            console.log('Device Type found:`, { key, deviceType });
                            break;
                          }
                        }
                        // Also check case-insensitive in all keys
                        if (!deviceType) {
                          for (const key in rowData) {
                            const normalizedKey = key.toLowerCase().replace(/[_\s]/g, '');
                            if (normalizedKey.includes('devicetype') || (normalizedKey.includes('device') && normalizedKey.includes('type'))) {
                              deviceType = String(rowData[key]).trim();
                              console.log('Device Type found (case-insensitive):`, { key, deviceType });
                              break;
                            }
                          }
                        }
                        
                        // If device type not found in rowData, try to get from original file data
                        if (!deviceType && selectedFile) {
                          try {
                            const token = localStorage.getItem('token');
                            const fileRes = await fetch(`${API_BASE}/api/uploads/${selectedFile}`, {
                              headers: {
                                'Authorization': token ? `Bearer ${token}` : ''
                              }
                            });
                            const fileJson = await fileRes.json();
                            if (fileJson?.success && fileJson.file && fileJson.file.rows) {
                              const originalRow = fileJson.file.rows.find((r: any) => {
                                const rowKey = generateRowKey(selectedFile, r, fileJson.file.headers || []);
                                return rowKey === selectedSiteObservationRowKey;
                              });
                              if (originalRow) {
                                for (const key of deviceTypeKeys) {
                                  if (originalRow[key]) {
                                    deviceType = String(originalRow[key]).trim();
                                    // Also update rowData to include device type
                                    rowData[key] = deviceType;
                                    break;
                                  }
                                }
                                // Also check case-insensitive
                                if (!deviceType) {
                                  for (const key in originalRow) {
                                    const normalizedKey = key.toLowerCase().replace(/[_\s]/g, '');
                                    if (normalizedKey.includes('devicetype') || (normalizedKey.includes('device') && normalizedKey.includes('type'))) {
                                      deviceType = String(originalRow[key]).trim();
                                      rowData[key] = deviceType;
                                      break;
                                    }
                                  }
                                }
                              }
                            }
                          } catch (err) {
                            console.error('Error fetching original file data for device type:', err);
                          }
                        }
                        
                        // Extract Circle for backend fallback (if Site Code not in Jyothi list)
                        // Extract Circle directly from CIRCLE column in View Data (case-insensitive search)
                        let circle = '';
                        const circleKeys = ['CIRCLE', 'Circle', 'circle'];
                        
                        // First try exact key matches
                        for (const key of circleKeys) {
                          if (rowData[key]) {
                            circle = String(rowData[key]).trim().toUpperCase();
                            console.log('Circle found in rowData (exact match):`, { key, circle, siteCode });
                            break;
                          }
                        }
                        
                        // If not found, try case-insensitive key matching
                        if (!circle) {
                          for (const key in rowData) {
                            const normalizedKey = key.toUpperCase().trim();
                            if (normalizedKey === 'CIRCLE') {
                              circle = String(rowData[key]).trim().toUpperCase();
                              console.log('Circle found in rowData (case-insensitive key):`, { originalKey: key, circle, siteCode });
                              break;
                            }
                          }
                        }
                        
                        // If circle still not found in rowData, fetch from original file data using Site Code
                        if (!circle && selectedFile) {
                          try {
                            const token = localStorage.getItem('token');
                            const fileRes = await fetch(`${API_BASE}/api/uploads/${selectedFile}`, {
                              headers: {
                                'Authorization': token ? `Bearer ${token}` : ''
                              }
                            });
                            const fileJson = await fileRes.json();
                            if (fileJson?.success && fileJson.file && fileJson.file.rows) {
                              // Find row by Site Code (if available) or by rowKey
                              let originalRow = null;
                              
                              if (siteCode) {
                                // Try to find by Site Code first
                                const siteCodeKeys = ['Site Code', 'SITE CODE', 'SiteCode', 'Site_Code', 'site code'];
                                for (const scKey of siteCodeKeys) {
                                  originalRow = fileJson.file.rows.find((r: any) => {
                                    const rSiteCode = String(r[scKey] || '').trim();
                                    return rSiteCode === String(siteCode).trim();
                                  });
                                  if (originalRow) {
                                    console.log('Found original row by Site Code:`, { siteCodeKey: scKey, siteCode });
                                    break;
                                  }
                                }
                              }
                              
                              // If not found by Site Code, fall back to rowKey matching
                              if (!originalRow) {
                                originalRow = fileJson.file.rows.find((r: any) => {
                                  const rowKey = generateRowKey(selectedFile, r, fileJson.file.headers || []);
                                  return rowKey === selectedSiteObservationRowKey;
                                });
                                console.log('Found original row by rowKey:', selectedSiteObservationRowKey);
                              }
                              
                              if (originalRow) {
                                // Extract Circle from original row
                                for (const key of circleKeys) {
                                  if (originalRow[key]) {
                                    circle = String(originalRow[key]).trim().toUpperCase();
                                    // Update rowData to include circle
                                    rowData[key] = circle;
                                    console.log('Circle found in original file data:`, { key, circle, siteCode });
                                    break;
                                  }
                                }
                                
                                // Also try case-insensitive key matching in original row
                                if (!circle) {
                                  for (const key in originalRow) {
                                    const normalizedKey = key.toUpperCase().trim();
                                    if (normalizedKey === 'CIRCLE') {
                                      circle = String(originalRow[key]).trim().toUpperCase();
                                      rowData[key] = circle;
                                      console.log('Circle found in original file data (case-insensitive):`, { originalKey: key, circle, siteCode });
                                      break;
                                    }
                                  }
                                }
                              }
                            }
                          } catch (err) {
                            console.error('Error fetching original file data for circle:', err);
                          }
                        }
                        
                        // If circle still not found, try to derive from Division (fallback only)
                        if (!circle) {
                          console.log('Circle not found in CIRCLE column, trying Division fallback...');
                          let division = '';
                          const divisionKeys = ['DIVISION', 'Division', 'division', 'DIVISION NAME', 'Division Name', 'division name'];
                          for (const key of divisionKeys) {
                            if (rowData[key]) {
                              division = String(rowData[key]).trim().toUpperCase();
                              break;
                            }
                          }
                          
                          // If division not found in rowData, try to get from original file data
                          if (!division && selectedFile) {
                            try {
                              const token = localStorage.getItem('token');
                              const fileRes = await fetch(`${API_BASE}/api/uploads/${selectedFile}`, {
                                headers: {
                                  'Authorization': token ? `Bearer ${token}` : ''
                                }
                              });
                              const fileJson = await fileRes.json();
                              if (fileJson?.success && fileJson.file && fileJson.file.rows) {
                                const originalRow = fileJson.file.rows.find((r: any) => {
                                  const rowKey = generateRowKey(selectedFile, r, fileJson.file.headers || []);
                                  return rowKey === selectedSiteObservationRowKey;
                                });
                                if (originalRow) {
                                  for (const key of divisionKeys) {
                                    if (originalRow[key]) {
                                      division = String(originalRow[key]).trim().toUpperCase();
                                      // Also update rowData to include division
                                      rowData[key] = division;
                                      break;
                                    }
                                  }
                                }
                              }
                            } catch (err) {
                              console.error('Error fetching original file data for division:', err);
                            }
                          }
                          
                          // Map divisions to circles (fallback only)
                          // HSR, JAYANAGAR, KORAMANGALA → SOUTH CIRCLE
                          const southCircleDivisions = ['HSR', 'JAYANAGAR', 'KORAMANGALA'];
                          if (division && southCircleDivisions.includes(division)) {
                            circle = 'SOUTH';
                            // Add circle to rowData for backend
                            rowData['CIRCLE'] = circle;
                            console.log('Circle derived from Division (fallback):`, { division, circle, siteCode });
                          }
                        }
                        
                        // Ensure Circle is in rowData for backend
                        if (circle && !rowData['CIRCLE']) {
                          rowData['CIRCLE'] = circle;
                        }
                        
                        console.log('Final Circle value for AMC routing:`, { circle, siteCode, hasCircleInRowData: !!rowData['CIRCLE'] });
                        console.log('Device Type value for AMC routing:`, { deviceType });
                        console.log('Backend will check Site Code priority FIRST, then fall back to Device Type (RMU) + Circle if needed');
                      }
                      
                      // Check if O&M-related issues are selected - route to O&M Team
                      // For Spare Required/Faulty: ALWAYS route to O&M Team (irrespective of Device Type)
                      // Additionally, if Device Type is RMU, ALSO route to AMC Team based on Circle
                      const omIssueTypes = ['Faulty', 'Bipassed', 'Line Idel', 'AT Jump cut', 'Dismantled', 'Replaced', 'Equipment Idle', 'Spare Required', 'AT-PT Chamber Flashover'];
                      const isOMIssue = omIssueTypes.includes(siteObservationsDialogData.typeOfIssue);
                      
                      // Always route "Faulty" and "Spare Required" to O&M Team (irrespective of Device Type)
                      const shouldRouteToOM = siteObservationsDialogData.typeOfIssue === 'Spare Required' || siteObservationsDialogData.typeOfIssue === 'Faulty';
                      
                      const omRoutingTeam = (isOMIssue || shouldRouteToOM) ? 'O&M Team' : null;
                      
                      // Determine which team(s) to route to
                      // For Spare Required/Faulty with RMU: Route to BOTH AMC and O&M teams
                      // For other issues: Route to single team (priority: RTU > AMC > O&M)
                      const finalRoutingTeam = routingTeam || amcRoutingTeam || omRoutingTeam;
                      
                      // If RTU Issue, CS Issue, AMC Issue (Spare Required/Faulty with RMU), or O&M-related issue, submit routing to backend
                      // Note: For Faulty/Spare Required, we always route to O&M, and additionally to AMC if RMU
                      // We need to route if: (1) any routing is needed OR (2) shouldRouteToOM is true (always route to O&M for Faulty/Spare Required)
                      if ((isRTUIssue || isAMCIssue || isOMIssue || shouldRouteToOM) && finalRoutingTeam) {
                        // Use the rowData we already found above
                        const routingRowData = rowData;
                        
                        // For AMC routing, ensure circle is in rowData (re-check here in case it wasn't set earlier)
                        if ((siteObservationsDialogData.typeOfIssue === 'Spare Required' || siteObservationsDialogData.typeOfIssue === 'Faulty') && !amcRoutingTeam) {
                          // Try to extract Device Type and Circle again here
                          let deviceType = '';
                          const deviceTypeKeys = ['DEVICE TYPE', 'Device Type', 'device type', 'DEVICETYPE', 'DeviceType', 'device_type'];
                          for (const key of deviceTypeKeys) {
                            if (routingRowData[key]) {
                              deviceType = String(routingRowData[key]).trim();
                              break;
                            }
                          }
                          if (!deviceType) {
                            for (const key in routingRowData) {
                              const normalizedKey = key.toLowerCase().replace(/[_\s]/g, '');
                              if (normalizedKey.includes('devicetype') || (normalizedKey.includes('device') && normalizedKey.includes('type'))) {
                                deviceType = String(routingRowData[key]).trim();
                                break;
                              }
                            }
                          }
                          
                          // If Device Type is RMU, check for Circle
                          if (deviceType && deviceType.toUpperCase() === 'RMU') {
                            // Extract Site Code for mapping
                            const siteCode = routingRowData['Site Code'] || 
                                           routingRowData['SITE CODE'] || 
                                           routingRowData['SiteCode'] || 
                                           routingRowData['Site_Code'] ||
                                           routingRowData['site code'] ||
                                           '';
                            
                            // Extract Circle directly from CIRCLE column in View Data (case-insensitive search)
                            let circle = '';
                            const circleKeys = ['CIRCLE', 'Circle', 'circle'];
                            
                            // First try exact key matches
                            for (const key of circleKeys) {
                              if (routingRowData[key]) {
                                circle = String(routingRowData[key]).trim().toUpperCase();
                                break;
                              }
                            }
                            
                            // If not found, try case-insensitive key matching
                            if (!circle) {
                              for (const key in routingRowData) {
                                const normalizedKey = key.toUpperCase().trim();
                                if (normalizedKey === 'CIRCLE') {
                                  circle = String(routingRowData[key]).trim().toUpperCase();
                                  break;
                                }
                              }
                            }
                            
                            // If circle still not found, try to fetch from original file data using Site Code
                            if (!circle && selectedFile) {
                              try {
                                const token = localStorage.getItem('token');
                                const fileRes = await fetch(`${API_BASE}/api/uploads/${selectedFile}`, {
                                  headers: {
                                    'Authorization': token ? `Bearer ${token}` : ''
                                  }
                                });
                                const fileJson = await fileRes.json();
                                if (fileJson?.success && fileJson.file && fileJson.file.rows) {
                                  // Find row by Site Code (if available) or by rowKey
                                  let originalRow = null;
                                  
                                  if (siteCode) {
                                    // Try to find by Site Code first
                                    const siteCodeKeys = ['Site Code', 'SITE CODE', 'SiteCode', 'Site_Code', 'site code'];
                                    for (const scKey of siteCodeKeys) {
                                      originalRow = fileJson.file.rows.find((r: any) => {
                                        const rSiteCode = String(r[scKey] || '').trim();
                                        return rSiteCode === String(siteCode).trim();
                                      });
                                      if (originalRow) break;
                                    }
                                  }
                                  
                                  // If not found by Site Code, fall back to rowKey matching
                                  if (!originalRow) {
                                    originalRow = fileJson.file.rows.find((r: any) => {
                                      const rowKey = generateRowKey(selectedFile, r, fileJson.file.headers || []);
                                      return rowKey === selectedSiteObservationRowKey;
                                    });
                                  }
                                  
                                  if (originalRow) {
                                    // Extract Circle from original row
                                    for (const key of circleKeys) {
                                      if (originalRow[key]) {
                                        circle = String(originalRow[key]).trim().toUpperCase();
                                        routingRowData[key] = circle;
                                        break;
                                      }
                                    }
                                    
                                    // Also try case-insensitive key matching in original row
                                    if (!circle) {
                                      for (const key in originalRow) {
                                        const normalizedKey = key.toUpperCase().trim();
                                        if (normalizedKey === 'CIRCLE') {
                                          circle = String(originalRow[key]).trim().toUpperCase();
                                          routingRowData[key] = circle;
                                          break;
                                        }
                                      }
                                    }
                                  }
                                }
                              } catch (err) {
                                console.error('Error fetching original file data for circle:', err);
                              }
                            }
                            
                            // If circle still not found, try to derive from Division (fallback only)
                            if (!circle) {
                              let division = '';
                              const divisionKeys = ['DIVISION', 'Division', 'division', 'DIVISION NAME', 'Division Name', 'division name'];
                              for (const key of divisionKeys) {
                                if (routingRowData[key]) {
                                  division = String(routingRowData[key]).trim().toUpperCase();
                                  break;
                                }
                              }
                              
                              // Map divisions to circles (fallback only)
                              const southCircleDivisions = ['HSR', 'JAYANAGAR', 'KORAMANGALA'];
                              if (division && southCircleDivisions.includes(division)) {
                                circle = 'SOUTH';
                                routingRowData['CIRCLE'] = circle;
                              }
                            }
                            
                            // Ensure Circle is in rowData
                            if (circle && !routingRowData['CIRCLE']) {
                              routingRowData['CIRCLE'] = circle;
                            }
                            
                            // Set AMC routing team if circle is valid (case-insensitive comparison)
                            const circleUpper = circle.toUpperCase();
                            if (circleUpper === 'SOUTH' || circleUpper === 'WEST') {
                              amcRoutingTeam = 'AMC Team';
                            } else if (circleUpper === 'NORTH' || circleUpper === 'EAST') {
                              amcRoutingTeam = 'AMC Team';
                            }
                          }
                        }
                        
                        // For AMC routing, ensure circle is in rowData
                        if (amcRoutingTeam && routingRowData) {
                          // Extract Site Code for mapping
                          const siteCode = routingRowData['Site Code'] || 
                                         routingRowData['SITE CODE'] || 
                                         routingRowData['SiteCode'] || 
                                         routingRowData['Site_Code'] ||
                                         routingRowData['site code'] ||
                                         '';
                          
                          // Extract Circle directly from CIRCLE column in View Data (case-insensitive)
                          let circle = '';
                          const circleKeys = ['CIRCLE', 'Circle', 'circle'];
                          
                          // First try exact key matches
                          for (const key of circleKeys) {
                            if (routingRowData[key]) {
                              circle = String(routingRowData[key]).trim().toUpperCase();
                              console.log('Circle found in routingRowData:`, { key, circle, siteCode });
                              break;
                            }
                          }
                          
                          // If not found, try case-insensitive key matching
                          if (!circle) {
                            for (const key in routingRowData) {
                              const normalizedKey = key.toUpperCase().trim();
                              if (normalizedKey === 'CIRCLE') {
                                circle = String(routingRowData[key]).trim().toUpperCase();
                                console.log('Circle found (case-insensitive):`, { originalKey: key, circle, siteCode });
                                break;
                              }
                            }
                          }
                          
                          // If circle not found, try to fetch from original file using Site Code
                          if (!circle && selectedFile) {
                            try {
                              const token = localStorage.getItem('token');
                              const fileRes = await fetch(`${API_BASE}/api/uploads/${selectedFile}`, {
                                headers: {
                                  'Authorization': token ? `Bearer ${token}` : ''
                                }
                              });
                              const fileJson = await fileRes.json();
                              if (fileJson?.success && fileJson.file && fileJson.file.rows) {
                                // Find row by Site Code (if available) or by rowKey
                                let originalRow = null;
                                
                                if (siteCode) {
                                  // Try to find by Site Code first
                                  const siteCodeKeys = ['Site Code', 'SITE CODE', 'SiteCode', 'Site_Code', 'site code'];
                                  for (const scKey of siteCodeKeys) {
                                    originalRow = fileJson.file.rows.find((r: any) => {
                                      const rSiteCode = String(r[scKey] || '').trim();
                                      return rSiteCode === String(siteCode).trim();
                                    });
                                    if (originalRow) {
                                      console.log('Found original row by Site Code:`, { siteCodeKey: scKey, siteCode });
                                      break;
                                    }
                                  }
                                }
                                
                                // If not found by Site Code, fall back to rowKey matching
                                if (!originalRow) {
                                  originalRow = fileJson.file.rows.find((r: any) => {
                                    const rowKey = generateRowKey(selectedFile, r, fileJson.file.headers || []);
                                    return rowKey === selectedSiteObservationRowKey;
                                  });
                                  console.log('Found original row by rowKey:', selectedSiteObservationRowKey);
                                }
                                
                                if (originalRow) {
                                  // Extract Circle from original row
                                  for (const key of circleKeys) {
                                    if (originalRow[key]) {
                                      circle = String(originalRow[key]).trim().toUpperCase();
                                      // Add circle to rowData for backend
                                      routingRowData[key] = circle;
                                      console.log('Circle found in original file:`, { key, circle, siteCode });
                                      break;
                                    }
                                  }
                                  
                                  // Also check case-insensitive if not found
                                  if (!circle) {
                                    for (const key in originalRow) {
                                      const normalizedKey = key.toUpperCase().trim();
                                      if (normalizedKey === 'CIRCLE') {
                                        circle = String(originalRow[key]).trim().toUpperCase();
                                        routingRowData[key] = circle;
                                        console.log('Circle found in original file (case-insensitive):`, { originalKey: key, circle, siteCode });
                                        break;
                                      }
                                    }
                                  }
                                }
                              }
                            } catch (err) {
                              console.error('Error fetching original file data for circle:', err);
                            }
                          }
                          
                          // Ensure Circle is in rowData
                          if (circle && !routingRowData['CIRCLE']) {
                            routingRowData['CIRCLE'] = circle;
                          }
                          
                          // If circle still not found, try to derive from Division
                          if (!circle) {
                            let division = '';
                            const divisionKeys = ['DIVISION', 'Division', 'division', 'DIVISION NAME', 'Division Name', 'division name'];
                            for (const key of divisionKeys) {
                              if (routingRowData[key]) {
                                division = String(routingRowData[key]).trim().toUpperCase();
                                console.log('Division found for circle mapping:`, { key, division });
                                break;
                              }
                            }
                            
                            // If division not found in routingRowData, try to get from original file
                            if (!division && selectedFile) {
                              try {
                                const token = localStorage.getItem('token');
                                const fileRes = await fetch(`${API_BASE}/api/uploads/${selectedFile}`, {
                                  headers: {
                                    'Authorization': token ? `Bearer ${token}` : ''
                                  }
                                });
                                const fileJson = await fileRes.json();
                                if (fileJson?.success && fileJson.file && fileJson.file.rows) {
                                  const originalRow = fileJson.file.rows.find((r: any) => {
                                    const rowKey = generateRowKey(selectedFile, r, fileJson.file.headers || []);
                                    return rowKey === selectedSiteObservationRowKey;
                                  });
                                  if (originalRow) {
                                    for (const key of divisionKeys) {
                                      if (originalRow[key]) {
                                        division = String(originalRow[key]).trim().toUpperCase();
                                        routingRowData[key] = division;
                                        console.log('Division found in original file:`, { key, division });
                                        break;
                                      }
                                    }
                                  }
                                }
                              } catch (err) {
                                console.error('Error fetching original file data for division:', err);
                              }
                            }
                            
                            // Map divisions to circles
                            // HSR, JAYANAGAR, KORAMANGALA → SOUTH CIRCLE
                            const southCircleDivisions = ['HSR', 'JAYANAGAR', 'KORAMANGALA'];
                            if (division && southCircleDivisions.includes(division)) {
                              circle = 'SOUTH';
                              // Add circle to rowData for backend (uppercase)
                              routingRowData['CIRCLE'] = circle;
                              console.log('Circle derived from Division:`, { division, circle });
                            }
                          }
                          
                          // Ensure circle is uppercase for consistent comparison
                          if (circle) {
                            circle = circle.toUpperCase();
                            routingRowData['CIRCLE'] = circle;
                          }
                        }
                        
                        // Recalculate shouldRouteToBoth after potential amcRoutingTeam update
                        const shouldRouteToBoth = amcRoutingTeam && (siteObservationsDialogData.typeOfIssue === 'Spare Required' || siteObservationsDialogData.typeOfIssue === 'Faulty');
                        
                        console.log('After re-check, routing state:`, {
                          shouldRouteToOM,
                          amcRoutingTeam,
                          shouldRouteToBoth,
                          finalRoutingTeam,
                          routingTeam,
                          omRoutingTeam
                        });
                        
                        const routingToken = localStorage.getItem('token');

                        // Prepare photo data for routing
                        let routingPhotoData: string[] = [];
                        
                        if (siteObservationsDialogData.capturedPhotos && siteObservationsDialogData.capturedPhotos.length > 0) {
                          routingPhotoData = siteObservationsDialogData.capturedPhotos.map(photo => photo.data);
                        }
                        
                        if (siteObservationsDialogData.uploadedPhotos && siteObservationsDialogData.uploadedPhotos.length > 0) {
                          const uploadedBase64 = await Promise.all(
                            siteObservationsDialogData.uploadedPhotos.map(file =>
                              new Promise<string>((resolve, reject) => {
                                const reader = new FileReader();
                                reader.onload = (e) => resolve(e.target?.result as string);
                                reader.onerror = reject;
                                reader.readAsDataURL(file);
                              })
                            )
                          );
                          routingPhotoData = [...routingPhotoData, ...uploadedBase64];
                        }

                        const routingPhotosToSend = routingPhotoData.length > 0 ? routingPhotoData : null;
                        
                        // Find the row in rows to get the correct index
                        const originalRowIndex = rows.findIndex((r: any) => {
                          const rId = r.id || Object.values(r).slice(0, 3).join('|') || '';
                          const routingRowDataId = routingRowData.id || Object.values(routingRowData).slice(0, 3).join('|') || '';
                          return rId === routingRowDataId;
                        });

                        // Routing logic:
                        // 1. Faulty/Spare Required → ALWAYS route to O&M Team (irrespective of Device Type)
                        // 2. Faulty/Spare Required + RMU Device Type → ALSO route to AMC Team (based on Circle)
                        
                        console.log('Starting routing process:`, {
                          shouldRouteToOM,
                          amcRoutingTeam,
                          shouldRouteToBoth,
                          typeOfIssue: siteObservationsDialogData.typeOfIssue,
                          userRole
                        });
                        
                        // Always route to O&M Team for Faulty/Spare Required
                        if (shouldRouteToOM) {
                          console.log('Routing to O&M Team...');
                          const omRoutingResponse = await fetch(`${API_BASE}/api/actions/submit`, {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${routingToken}`
                            },
                            body: JSON.stringify({
                              rowData: routingRowData,
                              headers,
                              routing: 'O&M Team',
                              typeOfIssue: siteObservationsDialogData.typeOfIssue,
                              remarks: siteObservationsDialogData.remarks || '',
                              priority: 'Medium',
                              photo: routingPhotosToSend,
                              sourceFileId: selectedFile,
                              originalRowIndex: originalRowIndex >= 0 ? originalRowIndex : null,
                              rowKey: selectedSiteObservationRowKey
                            })
                          });

                          const omRoutingResult = await omRoutingResponse.json();

                          if (!omRoutingResponse.ok) {
                            throw new Error(omRoutingResult.error || 'Failed to route to O&M Team');
                          }

                          console.log(`Action routed to O&M Team:`, omRoutingResult);
                          
                          // Immediately update task status for O&M routing
                          if (omRoutingResult?.success && omRoutingResult?.action) {
                            const action = omRoutingResult.action;
                            const taskStatusKey = selectedSiteObservationRowKey;
                            
                            if (taskStatusKey) {
                              // Update task status immediately
                              setTaskStatus(prev => {
                                const updated = { ...prev };
                                // Check if there's already a status (e.g., from AMC routing)
                                const existingStatus = updated[taskStatusKey] || '';
                                let statusText = 'Pending at O&M Team';
                                
                                // If there's already an AMC status, combine them
                                if (existingStatus.includes('Pending at Vendor') || existingStatus.includes('Pending at AMC Team')) {
                                  statusText = `${existingStatus}; Pending at O&M Team`;
                                } else if (existingStatus) {
                                  statusText = `${existingStatus}; Pending at O&M Team`;
                                }
                                
                                updated[taskStatusKey] = statusText;
                                taskStatusRef.current = updated;
                                return updated;
                              });
                              
                              // Also update routedActionsMap immediately
                              setRoutedActionsMap(prev => {
                                const updated = { ...prev };
                                const rowKey = generateRowKey(selectedFile, routingRowData, headers);
                                if (rowKey) {
                                  const existingAction = updated[rowKey];
                                  if (existingAction) {
                                    // Merge with existing action
                                    updated[rowKey] = {
                                      ...existingAction,
                                      ...action,
                                      _hasOM: true,
                                      _hasAMC: existingAction._hasAMC || false,
                                      _hasRTU: existingAction._hasRTU || false,
                                      _vendorNames: existingAction._vendorNames || []
                                    };
                                  } else {
                                    updated[rowKey] = {
                                      ...action,
                                      _hasOM: true,
                                      _hasAMC: false,
                                      _hasRTU: false,
                                      _vendorNames: []
                                    };
                                  }
                                }
                                return updated;
                              });
                            }
                          }
                        }

                        // Additionally route to AMC Team if Device Type is RMU and Circle is valid
                        if (shouldRouteToBoth && amcRoutingTeam) {
                          console.log('Routing to AMC Team...`, { amcRoutingTeam, shouldRouteToBoth });
                          
                          // Ensure Circle is in rowData before sending
                          const circleInRowData = routingRowData['CIRCLE'] || routingRowData['Circle'] || routingRowData['circle'] || '';
                          console.log('Circle value in rowData before AMC routing:', circleInRowData);
                          console.log('RowData keys:', Object.keys(routingRowData));
                          console.log('Full rowData for AMC routing:', JSON.stringify(routingRowData, null, 2));
                          
                          // Route to AMC Team
                          const amcRoutingResponse = await fetch(`${API_BASE}/api/actions/submit`, {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${routingToken}`
                            },
                            body: JSON.stringify({
                              rowData: routingRowData,
                              headers,
                              routing: amcRoutingTeam,
                              typeOfIssue: siteObservationsDialogData.typeOfIssue,
                              remarks: siteObservationsDialogData.remarks || '',
                              priority: 'Medium',
                              photo: routingPhotosToSend,
                              sourceFileId: selectedFile,
                              originalRowIndex: originalRowIndex >= 0 ? originalRowIndex : null,
                              rowKey: selectedSiteObservationRowKey
                            })
                          });

                          const amcRoutingResult = await amcRoutingResponse.json();

                          if (!amcRoutingResponse.ok) {
                            throw new Error(amcRoutingResult.error || `Failed to route to ${amcRoutingTeam}`);
                          }

                          console.log(`Action routed to ${amcRoutingTeam}:`, amcRoutingResult);
                          
                          // Immediately update task status for AMC routing
                          if (amcRoutingResult?.success && amcRoutingResult?.action) {
                            const action = amcRoutingResult.action;
                            const vendorName = action.assignedToVendor || action.vendor || '';
                            const taskStatusKey = selectedSiteObservationRowKey;
                            
                            console.log('AMC Routing Success - Updating task status immediately:`, {
                              vendorName,
                              taskStatusKey,
                              actionId: action._id,
                              assignedToRole: action.assignedToRole,
                              assignedToVendor: action.assignedToVendor
                            });
                            
                            if (taskStatusKey) {
                              const rowKey = generateRowKey(selectedFile, routingRowData, headers);
                              console.log('Row keys for update:`, { rowKey, taskStatusKey });
                              
                              // Update task status immediately
                              setTaskStatus(prev => {
                                const updated = { ...prev };
                                const statusText = vendorName 
                                  ? `Pending at Vendor (${vendorName})`
                                  : 'Pending at AMC Team';
                                updated[taskStatusKey] = statusText;
                                // Also update by rowKey if different
                                if (rowKey && rowKey !== taskStatusKey) {
                                  updated[rowKey] = statusText;
                                }
                                taskStatusRef.current = updated;
                                console.log('Updated taskStatus:', updated);
                                return updated;
                              });
                              
                              // Also update routedActionsMap immediately - CRITICAL for display
                              // Update using both the generated rowKey and the selectedSiteObservationRowKey
                              setRoutedActionsMap(prev => {
                                const updated = { ...prev };
                                
                                // Create the action object with all necessary fields
                                const actionData = {
                                  ...action,
                                  _hasAMC: true,
                                  _hasOM: false,
                                  _hasRTU: false,
                                  _vendorNames: vendorName ? [vendorName] : [],
                                  assignedToRole: action.assignedToRole || 'AMC',
                                  assignedToVendor: vendorName || action.assignedToVendor || action.vendor || ''
                                };
                                
                                // Update by generated rowKey
                                if (rowKey) {
                                  const existingAction = updated[rowKey];
                                  if (existingAction) {
                                    // Merge with existing action (e.g., if O&M routing already exists)
                                    updated[rowKey] = {
                                      ...existingAction,
                                      ...actionData,
                                      _hasAMC: true,
                                      _hasOM: existingAction._hasOM || false,
                                      _hasRTU: existingAction._hasRTU || false,
                                      _vendorNames: vendorName ? [vendorName] : (existingAction._vendorNames || [])
                                    };
                                  } else {
                                    updated[rowKey] = actionData;
                                  }
                                }
                                
                                // Also update by selectedSiteObservationRowKey (the key used in the table)
                                if (taskStatusKey && taskStatusKey !== rowKey) {
                                  const existingAction = updated[taskStatusKey];
                                  if (existingAction) {
                                    updated[taskStatusKey] = {
                                      ...existingAction,
                                      ...actionData,
                                      _hasAMC: true,
                                      _hasOM: existingAction._hasOM || false,
                                      _hasRTU: existingAction._hasRTU || false,
                                      _vendorNames: vendorName ? [vendorName] : (existingAction._vendorNames || [])
                                    };
                                  } else {
                                    updated[taskStatusKey] = actionData;
                                  }
                                }
                                
                                // Also update by original row key if different
                                const originalRowKey = action.rowData?.__siteObservationRowKey;
                                if (originalRowKey && originalRowKey !== rowKey && originalRowKey !== taskStatusKey) {
                                  updated[originalRowKey] = actionData;
                                }
                                
                                console.log('Updated routedActionsMap:`, {
                                  rowKey: updated[rowKey] ? 'exists' : 'missing',
                                  taskStatusKey: updated[taskStatusKey] ? 'exists' : 'missing',
                                  vendorNames: updated[rowKey]?._vendorNames || updated[taskStatusKey]?._vendorNames
                                });
                                
                                return { ...updated }; // Create new object reference to trigger re-render
                              });
                            }
                          }
                        } else if (!shouldRouteToOM && finalRoutingTeam) {
                          // For other issues (RTU Issue, CS Issue, or other O&M issues), route to single team
                          const routingResponse = await fetch(`${API_BASE}/api/actions/submit`, {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${routingToken}`
                            },
                            body: JSON.stringify({
                              rowData: routingRowData,
                              headers,
                              routing: finalRoutingTeam,
                              typeOfIssue: siteObservationsDialogData.typeOfIssue,
                              remarks: siteObservationsDialogData.remarks || '',
                              priority: 'Medium',
                              photo: routingPhotosToSend,
                              sourceFileId: selectedFile,
                              originalRowIndex: originalRowIndex >= 0 ? originalRowIndex : null,
                              rowKey: selectedSiteObservationRowKey
                            })
                          });

                          const routingResult = await routingResponse.json();

                          if (!routingResponse.ok) {
                            throw new Error(routingResult.error || `Failed to route to ${finalRoutingTeam}`);
                          }

                          console.log(`Action routed to ${finalRoutingTeam}:`, routingResult);
                        }
                        
                        // Log activity for Equipment users
                        if (userRole === 'Equipment') {
                          // Extract site name from row data (try common field names)
                          const siteName = routingRowData['Site Name'] || 
                                          routingRowData['SITE NAME'] || 
                                          routingRowData['Site'] || 
                                          routingRowData['Location'] ||
                                          routingRowData['LOCATION'] ||
                                          'Unknown';
                          
                          // Extract site code from row data
                          const siteCode = routingRowData['Site Code'] || 
                                          routingRowData['SITE CODE'] || 
                                          routingRowData['Code'] ||
                                          routingRowData['CODE'] ||
                                          routingRowData['SiteCode'] ||
                                          '';
                          
                          if (shouldRouteToBoth && amcRoutingTeam) {
                            // Log both AMC and O&M routing
                            const circle = routingRowData['CIRCLE'] || routingRowData['Circle'] || routingRowData['circle'] || '';
                            const circleUpper = String(circle).toUpperCase();
                            let amcTeamName = 'AMC Team';
                            if (circleUpper === 'SOUTH' || circleUpper === 'WEST') {
                              amcTeamName = 'AMC Team (Shrishaila Electricals)';
                            } else if (circleUpper === 'NORTH' || circleUpper === 'EAST') {
                              amcTeamName = 'AMC Team (Spectrum Consultants)';
                            }
                            
                            // Log AMC routing
                            logActivity({
                              action: `Routed to ${amcTeamName}`,
                              typeOfIssue: siteObservationsDialogData.typeOfIssue,
                              routingTeam: amcTeamName,
                              remarks: siteObservationsDialogData.remarks || '',
                              siteName: String(siteName),
                              siteCode: String(siteCode),
                              rowKey: selectedSiteObservationRowKey,
                              sourceFileId: selectedFile,
                              photosCount: routingPhotosToSend ? (Array.isArray(routingPhotosToSend) ? routingPhotosToSend.length : 1) : 0,
                              photos: routingPhotosToSend ? (Array.isArray(routingPhotosToSend) ? routingPhotosToSend : [routingPhotosToSend]) : undefined,
                              status: 'Pending',
                              priority: 'Medium',
                              assignedToRole: 'AMC'
                            });
                            
                            // Log O&M routing
                            logActivity({
                              action: 'Routed to O&M Team',
                              typeOfIssue: siteObservationsDialogData.typeOfIssue,
                              routingTeam: 'O&M Team',
                              remarks: siteObservationsDialogData.remarks || '',
                              siteName: String(siteName),
                              siteCode: String(siteCode),
                              rowKey: selectedSiteObservationRowKey,
                              sourceFileId: selectedFile,
                              photosCount: routingPhotosToSend ? (Array.isArray(routingPhotosToSend) ? routingPhotosToSend.length : 1) : 0,
                              photos: routingPhotosToSend ? (Array.isArray(routingPhotosToSend) ? routingPhotosToSend : [routingPhotosToSend]) : undefined,
                              status: 'Pending',
                              priority: 'Medium',
                              assignedToRole: 'O&M'
                            });
                          } else {
                            // Log single team routing
                            let routingTeamName = finalRoutingTeam;
                            if (amcRoutingTeam) {
                              const circle = routingRowData['CIRCLE'] || routingRowData['Circle'] || routingRowData['circle'] || '';
                              const circleUpper = String(circle).toUpperCase();
                              if (circleUpper === 'SOUTH' || circleUpper === 'WEST') {
                                routingTeamName = 'AMC Team (Shrishaila Electricals)';
                              } else if (circleUpper === 'NORTH' || circleUpper === 'EAST') {
                                routingTeamName = 'AMC Team (Spectrum Consultants)';
                              }
                            }
                            
                            logActivity({
                              action: `Routed to ${routingTeamName}`,
                              typeOfIssue: siteObservationsDialogData.typeOfIssue,
                              routingTeam: routingTeamName,
                              remarks: siteObservationsDialogData.remarks || '',
                              siteName: String(siteName),
                              siteCode: String(siteCode),
                              rowKey: selectedSiteObservationRowKey,
                              sourceFileId: selectedFile,
                              photosCount: routingPhotosToSend ? (Array.isArray(routingPhotosToSend) ? routingPhotosToSend.length : 1) : 0,
                              photos: routingPhotosToSend ? (Array.isArray(routingPhotosToSend) ? routingPhotosToSend : [routingPhotosToSend]) : undefined,
                              status: 'Pending',
                              priority: 'Medium',
                              assignedToRole: finalRoutingTeam.replace(' Team', '')
                            });
                          }
                        }
                      }

                    // Prepare photo data (convert to base64 if needed) - reuse from routing section if already prepared
                    let photoData: string[] = [];
                    let documentsData: Array<{ name: string; data: string }> = [...(supportDocuments[selectedSiteObservationRowKey] || [])];
                    
                    // Add captured photos (already base64) - extract just the data
                    if (siteObservationsDialogData.capturedPhotos && siteObservationsDialogData.capturedPhotos.length > 0) {
                      photoData = siteObservationsDialogData.capturedPhotos.map(photo => photo.data);
                    }
                    
                    // Convert uploaded photos to base64
                    if (siteObservationsDialogData.uploadedPhotos && siteObservationsDialogData.uploadedPhotos.length > 0) {
                      const uploadedBase64 = await Promise.all(
                        siteObservationsDialogData.uploadedPhotos.map(file =>
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
                    
                    // Convert uploaded documents (PDF) to base64
                    if (siteObservationsDialogData.uploadedDocuments && siteObservationsDialogData.uploadedDocuments.length > 0) {
                      const newDocuments = await Promise.all(
                        siteObservationsDialogData.uploadedDocuments.map(file =>
                          new Promise<{ name: string; data: string }>((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onload = (e) => resolve({
                              name: file.name,
                              data: e.target?.result as string
                            });
                            reader.onerror = reject;
                            reader.readAsDataURL(file);
                          })
                        )
                      );
                      documentsData = [...documentsData, ...newDocuments];
                    }
                    
                    // Convert to null if empty for backward compatibility
                    const photosToSend = photoData.length > 0 ? photoData : null;

                    // Store photos with metadata for View Photos column
                    const photosWithMetadata = siteObservationsDialogData.capturedPhotos.map(photo => ({
                      data: photo.data,
                      latitude: photo.latitude,
                      longitude: photo.longitude,
                      timestamp: photo.timestamp,
                      location: photo.location
                    }));
                    
                    // Add uploaded photos to the photos array (they don't have metadata)
                    const allPhotosData = [...photoData];

                    // Find row data if not already found (for non-RTU issues)
                    if (!isRTUIssue) {
                      const [_fileId, ..._rowIdentifierParts] = selectedSiteObservationRowKey.split('-');
                      const rowIndex = searchedRows.findIndex((row: any) => {
                        const currentRowKey = generateRowKey(selectedFile, row, headers);
                        return currentRowKey === selectedSiteObservationRowKey;
                      });

                      if (rowIndex === -1) {
                        alert('Row not found. Please refresh and try again.');
                        setIsSubmittingSiteObservations(false);
                        return;
                      }

                      const rowData = searchedRows[rowIndex];
                      
                      console.log('Site Observations submitted:`, {
                        rowKey: selectedSiteObservationRowKey,
                        status: siteObservationsStatus,
                        typeOfIssue: siteObservationsDialogData.typeOfIssue,
                        specifyOther: siteObservationsDialogData.specifyOther,
                        typeOfSpare: siteObservationsDialogData.typeOfSpare,
                        specifySpareOther: siteObservationsDialogData.specifySpareOther,
                        remarks: siteObservationsDialogData.remarks,
                        photos: photosToSend,
                        documents: documentsData.map(doc => doc.name),
                        rowData
                      });
                    }

                    // Update the new columns with data from dialog
                    // Determine Task Status based on issue type and user role
                    let taskStatusValue = '';
                    if (siteObservationsStatus === 'resolved') {
                      if (userRole === 'AMC') {
                        taskStatusValue = 'Pending Equipment Approval';
                        
                        try {
                          const token = localStorage.getItem('token');
                          if (!token) {
                            throw new Error('Authentication required. Please login again.');
                          }

                          const approvalRowData = {
                            ...rowData,
                            __supportDocuments: documentsData,
                            __siteObservationRowKey: selectedSiteObservationRowKey,
                            __siteObservationStatus: 'Resolved',
                            __siteObservationRemarks: siteObservationsDialogData.remarks || ''
                          };

                          const approvalResponse = await fetch(`${API_BASE}/api/actions/submit`, {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({
                              rowData: approvalRowData,
                              headers,
                              routing: 'Equipment Team',
                              typeOfIssue: 'AMC Resolution Approval',
                              remarks: siteObservationsDialogData.remarks || '',
                              priority: 'Medium',
                              photo: allPhotosData,
                              sourceFileId: selectedFile,
                              originalRowIndex: findRowIndex >= 0 ? findRowIndex : null,
                              rowKey: selectedSiteObservationRowKey
                            })
                          });

                          const approvalResult = await approvalResponse.json().catch(() => null);

                          if (!approvalResponse.ok) {
                            throw new Error(approvalResult?.error || 'Failed to send approval request to Equipment team.');
                          }

                          setRoutedActionsMap(prev => ({
                            ...prev,
                            [selectedSiteObservationRowKey]: {
                              ...(prev[selectedSiteObservationRowKey] || {}),
                              _id: approvalResult?.action?.id || approvalResult?.action?._id,
                              status: 'Pending',
                              typeOfIssue: 'AMC Resolution Approval',
                              assignedToRole: 'Equipment',
                              assignedToUserId: approvalResult?.action?.assignedToUserId,
                              assignedToDivision: approvalResult?.action?.assignedToDivision,
                              assignedByRole: userRole,
                              rowData: approvalRowData,
                              sourceFileId: selectedFile,
                              headers
                            }
                          }));
                        } catch (error: any) {
                          console.error('Error creating Equipment approval request:', error);
                          alert(error?.message || 'Failed to send approval request to Equipment team. Please try again.');
                          setIsSubmittingSiteObservations(false);
                          return;
                        }
                      } else {
                        // For Equipment users, show explicit AMC resolution label for AMC-related issues
                        if (userRole === 'Equipment') {
                          const isAMCIssue =
                            siteObservationsDialogData.typeOfIssue === 'Spare Required' ||
                            siteObservationsDialogData.typeOfIssue === 'Faulty';
                          taskStatusValue = isAMCIssue ? 'Resolved at AMC Team' : 'Resolved';
                        } else {
                          taskStatusValue = 'Resolved';
                        }
                        
                        // If this is an action row, update action status via API
                        const rowIndex = searchedRows.findIndex((row: any) => {
                          const currentRowKey = generateRowKey(selectedFile, row, headers);
                          return currentRowKey === selectedSiteObservationRowKey;
                        });
                        
                        if (rowIndex >= 0) {
                          const row = searchedRows[rowIndex];
                          if (row._actionId) {
                            // Update action status to Completed – backend will route to CCR where required
                            const token = localStorage.getItem('token');
                            if (token) {
                              try {
                                const updateResponse = await fetch(`${API_BASE}/api/actions/${row._actionId}/status`, {
                                  method: 'PUT',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                                  },
                                  body: JSON.stringify({
                                    status: 'Completed',
                                    remarks: siteObservationsDialogData.remarks || ''
                                  })
                                });
                                
                                if (updateResponse.ok) {
                                  const updateResult = await updateResponse.json();
                                  console.log('Action status updated to Completed:', updateResult);
                                  
                                  // Log activity for resolved action
                                  const siteCode = row['Site Code'] || row['SITE CODE'] || row['Code'] || row['CODE'] || row['SiteCode'] || '';
                                  const siteName = row['Site Name'] || row['SITE NAME'] || row['SiteName'] || row['Name'] || '';
                                  const rowKey = generateRowKey(selectedFile, row, headers);
                                  
                                  logActivity({
                                    action: 'Action Resolved',
                                    typeOfIssue: siteObservationsDialogData.typeOfIssue || '',
                                    routingTeam: row._routingTeam || undefined,
                                    remarks: siteObservationsDialogData.remarks || '',
                                    siteName: String(siteName),
                                    siteCode: String(siteCode),
                                    rowKey: rowKey,
                                    sourceFileId: selectedFile,
                                    photosCount: photoData.length,
                                    photos: photoData.length > 0 ? photoData : undefined,
                                    status: 'Resolved',
                                    priority: 'Medium'
                                  });
                                } else {
                                  console.error('Failed to update action status');
                                }
                              } catch (error) {
                                console.error('Error updating action status:', error);
                              }
                            }
                          } else if (userRole !== 'AMC') {
                            // No existing action: create direct CCR approval for non-AMC roles
                            const token = localStorage.getItem('token');
                            if (token) {
                              try {
                                const ccrApprovalRowData = {
                                  ...rowData,
                                  __supportDocuments: documentsData,
                                  __siteObservationRowKey: selectedSiteObservationRowKey,
                                  __siteObservationStatus: 'Resolved',
                                  __siteObservationRemarks: siteObservationsDialogData.remarks || ''
                                };

                                const ccrResponse = await fetch(`${API_BASE}/api/actions/submit`, {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                                  },
                                  body: JSON.stringify({
                                    rowData: ccrApprovalRowData,
                                    headers,
                                    routing: 'CCR Team',
                                    typeOfIssue: 'CCR Resolution Approval',
                                    remarks: siteObservationsDialogData.remarks || '',
                                    priority: 'Medium',
                                    photo: allPhotosData,
                                    sourceFileId: selectedFile,
                                    originalRowIndex: rowIndex >= 0 ? rowIndex : null,
                                    rowKey: selectedSiteObservationRowKey
                                  })
                                });

                                const ccrResult = await ccrResponse.json().catch(() => null);

                                if (!ccrResponse.ok) {
                                  const errorMsg = ccrResult?.error || 'Failed to send approval request to CCR team.';
                                  console.error('CCR approval creation failed:', errorMsg);
                                  // Don't show division-specific error for CCR since it's not division-specific
                                  if (!errorMsg.includes('division')) {
                                    alert(`Warning: ${errorMsg}`);
                                  } else {
                                    alert(`Warning: ${errorMsg.replace(/division.*?\./gi, '')}`);
                                  }
                                  throw new Error(errorMsg);
                                }

                                console.log('Created CCR approval action for resolved observation:', ccrResult?.action?._id || ccrResult?.action?.id);
                                if (ccrResult?.action?._id || ccrResult?.action?.id) {
                                  console.log('CCR approval successfully created and assigned to:', ccrResult?.action?.assignedToUserId);
                                }
                              } catch (error: any) {
                                console.error('Error creating CCR approval request:', error);
                                // Don't block the UI, but log the error
                                if (error?.message && !error.message.includes('Warning:')) {
                                  console.warn('CCR approval creation failed, but continuing with site observation update');
                                }
                              }
                            }
                          }
                        }
                      }
                    } else if (siteObservationsStatus === 'pending') {
                      // Check if issue should be routed
                      const omIssueTypes = ['Faulty', 'Bipassed', 'Line Idel', 'AT Jump cut', 'Dismantled', 'Replaced', 'Equipment Idle', 'Spare Required', 'AT-PT Chamber Flashover'];
                      const isOMIssue = omIssueTypes.includes(siteObservationsDialogData.typeOfIssue);
                      
                      // If RTU Issue or CS Issue, show routing info in Task Status
                      if (isRTUIssue) {
                        // For Equipment users: Show "Pending at RTU/Communication Team"
                        if (userRole === 'Equipment') {
                          taskStatusValue = 'Pending at RTU/Communication Team';
                        } else {
                          taskStatusValue = 'Pending';
                        }
                      } else if (isOMIssue) {
                        // For Equipment users: Show "Pending at O&M Team"
                        // (vendor-specific text will be derived dynamically from routed actions when displaying)
                        if (userRole === 'Equipment') {
                          taskStatusValue = 'Pending at O&M Team';
                        } else {
                          taskStatusValue = 'Pending';
                        }
                      } else {
                        taskStatusValue = 'Pending';
                      }
                    }
                    
                    setTaskStatus(prev => {
                      const updated = {
                        ...prev,
                        [selectedSiteObservationRowKey]: taskStatusValue
                      };
                      // Update ref immediately
                      taskStatusRef.current = updated;
                      console.log('Setting taskStatus for row:', selectedSiteObservationRowKey, 'value:', updated[selectedSiteObservationRowKey]);
                      console.log('All taskStatus keys after update:', Object.keys(updated));
                      return updated;
                    });
                    
                    // Set Type of Issue - combine typeOfIssue with specifyOther if Others is selected
                    // or include typeOfSpare if Spare Required is selected
                    let issueDisplay = '';
                    if (siteObservationsDialogData.typeOfIssue === 'Others') {
                      issueDisplay = siteObservationsDialogData.specifyOther || '';
                    } else if (siteObservationsDialogData.typeOfIssue === 'Spare Required') {
                      // Combine "Spare Required" with the selected spare types
                      const spareTypes = siteObservationsDialogData.typeOfSpare || [];
                      let spareDisplay = '';
                      if (spareTypes.length > 0) {
                        // Replace OTHERS with specifySpareOther if it exists
                        const spareTypesDisplay = spareTypes.map(spare => {
                          if (spare === 'OTHERS' && siteObservationsDialogData.specifySpareOther) {
                            return siteObservationsDialogData.specifySpareOther;
                          }
                          return spare;
                        });
                        spareDisplay = spareTypesDisplay.join(', ');
                      }
                      issueDisplay = spareDisplay ? `Spare Required - ${spareDisplay}` : 'Spare Required';
                    } else {
                      issueDisplay = siteObservationsDialogData.typeOfIssue || '';
                    }
                    setTypeOfIssue(prev => {
                      const updated = {
                        ...prev,
                        [selectedSiteObservationRowKey]: issueDisplay
                      };
                      // Update ref immediately
                      typeOfIssueRef.current = updated;
                      console.log('Setting typeOfIssue for row:', selectedSiteObservationRowKey, 'value:', issueDisplay);
                      console.log('All typeOfIssue keys after update:', Object.keys(updated));
                      return updated;
                    });
                    
                    // Set View Photos - store photo data URLs with metadata and uploaded photos
                    setViewPhotos(prev => {
                      const updated = {
                        ...prev,
                        [selectedSiteObservationRowKey]: allPhotosData
                      };
                      // Update ref immediately
                      viewPhotosRef.current = updated;
                      console.log('Setting viewPhotos for row:', selectedSiteObservationRowKey, 'count:', updated[selectedSiteObservationRowKey]?.length || 0);
                      console.log('All viewPhotos keys after update:', Object.keys(updated));
                      return updated;
                    });
                    
                    setSupportDocuments(prev => {
                      const updated = { ...prev };
                      if (documentsData.length > 0) {
                        updated[selectedSiteObservationRowKey] = documentsData;
                      } else {
                        delete updated[selectedSiteObservationRowKey];
                      }
                      supportDocumentsRef.current = updated;
                      console.log('Setting supportDocuments for row:', selectedSiteObservationRowKey, 'count:', documentsData.length);
                      return updated;
                    });
                    
                    // Store photo metadata separately
                    setPhotoMetadata(prev => {
                      const updated = {
                        ...prev,
                        [selectedSiteObservationRowKey]: photosWithMetadata.map(p => ({
                          latitude: p.latitude,
                          longitude: p.longitude,
                          timestamp: p.timestamp,
                          location: p.location
                        }))
                      };
                      // Update ref immediately
                      photoMetadataRef.current = updated;
                      console.log('Setting photoMetadata for row:', selectedSiteObservationRowKey);
                      return updated;
                    });
                    
                    // Set Remarks
                    setRemarks(prev => {
                      const updated = {
                        ...prev,
                        [selectedSiteObservationRowKey]: siteObservationsDialogData.remarks || ''
                      };
                      // Update ref immediately
                      remarksRef.current = updated;
                      console.log('Setting remarks for row:', selectedSiteObservationRowKey, 'value:', updated[selectedSiteObservationRowKey]);
                      console.log('All remarks keys after update:', Object.keys(updated));
                      return updated;
                    });
                    
                    // Also update siteObservations ref
                    setSiteObservations(prev => {
                      const updated = {
                        ...prev,
                        [selectedSiteObservationRowKey]: siteObservationsStatus === 'pending' ? 'Pending' : 'Resolved'
                      };
                      siteObservationsRef.current = updated;
                      // Update last modified timestamp
                      setSiteObservationsLastModified(prev => ({
                        ...prev,
                        [selectedSiteObservationRowKey]: Date.now()
                      }));
                      return updated;
                    });
                    
                    // Also save by Site Code for bidirectional sync with My Sites Dialog
                    if (rowData) {
                      const siteCode = rowData['Site Code'] || 
                                      rowData['SITE CODE'] || 
                                      rowData['SiteCode'] || 
                                      rowData['Site_Code'] || 
                                      rowData['site code'] || 
                                      '';
                      
                      if (siteCode) {
                        const normalizedSiteCode = String(siteCode).trim().toUpperCase();
                        const statusToSave = siteObservationsStatus === 'pending' ? 'Pending' : 'Resolved';
                        
                        // Get current values for Task Status, Type of Issue, View Photos, and Remarks
                        const currentTaskStatus = taskStatus[selectedSiteObservationRowKey] || 'Pending';
                        const currentTypeOfIssue = issueDisplay || typeOfIssue[selectedSiteObservationRowKey] || siteObservationsDialogData.typeOfIssue || '';
                        const currentViewPhotos = viewPhotos[selectedSiteObservationRowKey] || [];
                        const currentRemarks = remarks[selectedSiteObservationRowKey] || siteObservationsDialogData.remarks || '';
                        
                        // Prepare observation data (same structure as My Sites Dialog)
                        const observationData = {
                          status: statusToSave,
                          typeOfIssue: currentTypeOfIssue, // Use formatted Type of Issue
                          rawTypeOfIssue: siteObservationsDialogData.typeOfIssue || '', // Original type for reference
                          specifyOther: siteObservationsDialogData.specifyOther || '',
                          typeOfSpare: siteObservationsDialogData.typeOfIssue === 'Spare Required' 
                            ? (siteObservationsDialogData.typeOfSpare || []) 
                            : [],
                          specifySpareOther: siteObservationsDialogData.specifySpareOther || '',
                          remarks: currentRemarks,
                          capturedPhotos: siteObservationsDialogData.capturedPhotos || [],
                          uploadedPhotos: siteObservationsDialogData.uploadedPhotos || [],
                          uploadedDocuments: siteObservationsDialogData.uploadedDocuments || [],
                          viewPhotos: currentViewPhotos.length > 0 ? currentViewPhotos : (siteObservationsDialogData.capturedPhotos?.map(p => p.data) || []),
                          taskStatus: currentTaskStatus,
                          timestamp: new Date().toISOString(),
                          savedFrom: 'MY OFFLINE SITES'
                        };
                        
                        // Save to global map for My Sites Dialog
                        try {
                          const globalKey = 'mySitesObservationsBySiteCode';
                          let globalMap: Record<string, any> = {};
                          const existing = localStorage.getItem(globalKey);
                          if (existing) {
                            globalMap = JSON.parse(existing);
                          }
                          globalMap[normalizedSiteCode] = observationData;
                          localStorage.setItem(globalKey, JSON.stringify(globalMap));
                          
                          // Update local state
                          setSiteObservationsBySiteCode(prev => ({
                            ...prev,
                            [normalizedSiteCode]: observationData
                          }));
                          
                          // Dispatch custom event to notify other components (like Dashboard)
                          window.dispatchEvent(new Event('mySitesObservationsUpdated'));
                          
                          console.log(`Saved site observation for Site Code: ${normalizedSiteCode} from MY OFFLINE SITES`, observationData);
                        } catch (storageError) {
                          console.error('Error saving site observation by Site Code:', storageError);
                        }
                      }
                    }
                    
                    // For RTU/Communication users: Save action updates to database if this is an action row
                    // Note: When resolving, the status update is already handled above (line 4878-4924)
                    // This code handles remarks updates for pending actions and ensures remarks are saved when resolving
                    const rowIndex = searchedRows.findIndex((row: any) => {
                      const currentRowKey = generateRowKey(selectedFile, row, headers);
                      return currentRowKey === selectedSiteObservationRowKey;
                    });
                    
                    if (rowIndex >= 0 && userRole === 'RTU/Communication') {
                      const row = searchedRows[rowIndex];
                      if (row._actionId) {
                        // If resolving, the status update is already handled above, but we should ensure remarks are saved
                        // If pending, save both remarks and status
                        if (siteObservationsStatus === 'resolved') {
                          // Status update is already handled above, but save remarks if not already saved
                          // The existing code at line 4883-4892 already saves remarks when resolving
                          // So we don't need to duplicate here
                        } else {
                          // For pending actions, save remarks to database
                          saveActionUpdateToDatabase(selectedSiteObservationRowKey, row, {
                            remarks: siteObservationsDialogData.remarks || ''
                          }).then(() => {
                            // After saving, refresh actions to get updated data from database
                            // This ensures the updated remarks are loaded after logout/login
                            if (userRole === 'RTU/Communication') {
                              const token = localStorage.getItem('token');
                              if (token) {
                                fetch(`${API_BASE}/api/actions/my-actions`, {
                                  headers: {
                                    'Authorization': `Bearer ${token}`
                                  }
                                })
                                .then(res => res.json())
                                .then(json => {
                                  if (json?.success && Array.isArray(json.actions)) {
                                    // Filter RTU Issue or CS Issue actions
                                    const filteredActions = json.actions.filter((action: any) => 
                                      action.typeOfIssue === 'RTU Issue' || action.typeOfIssue === 'CS Issue'
                                    );
                                    
                                    // Convert actions to row format
                                    const actionRows = filteredActions.map((action: any) => {
                                      const rowData = action.rowData || {};
                                      return {
                                        ...rowData,
                                        _actionId: action._id,
                                        _routing: action.routing,
                                        _typeOfIssue: action.typeOfIssue,
                                        _remarks: action.remarks,
                                        _photos: action.photo || [],
                                        _assignedByUserId: action.assignedByUserId,
                                        _assignedByRole: action.assignedByRole,
                                        _assignedToUserId: action.assignedToUserId,
                                        _assignedToRole: action.assignedToRole,
                                        _status: action.status,
                                        _priority: action.priority,
                                        _sourceFileId: action.sourceFileId,
                                        _assignedDate: action.assignedDate || action.createdAt
                                      };
                                    });
                                    
                                    setActionsRows(actionRows);
                                    console.log('Refreshed actions after update:', actionRows.length);
                                  }
                                })
                                .catch(error => {
                                  console.error('Error refreshing actions after update:', error);
                                });
                              }
                            }
                          }).catch(error => {
                            console.error('Error saving action update to database:', error);
                          });
                        }
                      }
                    }
                    
                    // Force save to localStorage after all state updates complete
                    // Use setTimeout to ensure all state updates are processed first
                    setTimeout(async () => {
                      // Force save immediately using refs which have latest values
                      saveToLocalStorage();
                      console.log('Force saved data to localStorage after dialog submission:`, {
                        rowKey: selectedSiteObservationRowKey,
                        siteObservations: siteObservationsRef.current[selectedSiteObservationRowKey],
                        taskStatus: taskStatusRef.current[selectedSiteObservationRowKey],
                        typeOfIssue: typeOfIssueRef.current[selectedSiteObservationRowKey],
                        viewPhotosCount: viewPhotosRef.current[selectedSiteObservationRowKey]?.length || 0,
                        remarks: remarksRef.current[selectedSiteObservationRowKey]
                      });
                      
                      // CRITICAL: Auto-save to database for both Resolved and Pending status
                      // This ensures data is immediately persisted without requiring a manual save button
                      try {
                        const rowIndex = searchedRows.findIndex((row: any) => {
                          const currentRowKey = generateRowKey(selectedFile, row, headers);
                          return currentRowKey === selectedSiteObservationRowKey;
                        });
                        
                        if (rowIndex >= 0) {
                          const row = searchedRows[rowIndex];
                          const siteCode = row['Site Code'] || 
                                          row['SITE CODE'] || 
                                          row['SiteCode'] || 
                                          row['Site_Code'] || 
                                          row['site code'] || 
                                          '';
                          
                          if (siteCode) {
                            const normalizedSiteCode = String(siteCode).trim().toUpperCase();
                            const token = localStorage.getItem('token');
                            
                            if (token) {
                              // Get current values from refs
                              const currentSiteObservations = siteObservationsRef.current[selectedSiteObservationRowKey] || '';
                              const currentTaskStatus = taskStatusRef.current[selectedSiteObservationRowKey] || '';
                              const currentTypeOfIssue = typeOfIssueRef.current[selectedSiteObservationRowKey] || '';
                              const currentViewPhotos = viewPhotosRef.current[selectedSiteObservationRowKey] || [];
                              const currentPhotoMetadata = photoMetadataRef.current[selectedSiteObservationRowKey] || [];
                              const currentRemarks = remarksRef.current[selectedSiteObservationRowKey] || '';
                              const currentSupportDocuments = supportDocumentsRef.current[selectedSiteObservationRowKey] || [];
                              
                              // CRITICAL: For Reports, Resolved = empty string, Pending = non-empty string
                              const finalSiteObservations = currentSiteObservations === 'Resolved' ? '' : (currentSiteObservations || '');
                              
                              // Prepare data for database save
                              const siteDataToSave = {
                                fileId: selectedFile,
                                rowKey: selectedSiteObservationRowKey,
                                siteCode: normalizedSiteCode,
                                originalRowData: row,
                                headers: headers,
                                siteObservations: finalSiteObservations,
                                taskStatus: currentTaskStatus,
                                typeOfIssue: currentTypeOfIssue,
                                viewPhotos: currentViewPhotos,
                                photoMetadata: currentPhotoMetadata,
                                remarks: currentRemarks,
                                supportDocuments: currentSupportDocuments,
                                deviceStatus: row['Device Status'] || row['DEVICE STATUS'] || row['DeviceStatus'] || '',
                                noOfDaysOffline: row['No of Days Offline'] || row['NO OF DAYS OFFLINE'] || row['NoOfDaysOffline'] || null,
                                savedFrom: 'MY OFFLINE SITES'
                              };
                              
                              console.log(`[AUTO-SAVE] Saving ${currentSiteObservations === 'Resolved' ? 'Resolved' : 'Pending'} status to database for siteCode: ${normalizedSiteCode}`, {
                                siteObservations: finalSiteObservations,
                                original: currentSiteObservations
                              });
                              
                              // Save to database immediately
                              const saveResponse = await fetch(`${API_BASE}/api/equipment-offline-sites`, {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                  'Authorization': `Bearer ${token}`
                                },
                                body: JSON.stringify(siteDataToSave)
                              });
                              
                              if (saveResponse.ok) {
                                const saveResult = await saveResponse.json();
                                console.log(`✓ [AUTO-SAVE] Successfully saved ${currentSiteObservations === 'Resolved' ? 'Resolved' : 'Pending'} status to database:`, saveResult.data?.siteCode);
                              } else {
                                const errorData = await saveResponse.json().catch(() => ({}));
                                console.error(`✗ [AUTO-SAVE] Failed to save to database:`, errorData);
                              }
                            }
                          }
                        }
                      } catch (autoSaveError) {
                        console.error('[AUTO-SAVE] Error auto-saving to database:', autoSaveError);
                        // Don't show error to user - this is a background save
                      }
                      
                      // Log all Site Observations activities for Equipment users
                      // Also log for RTU/Communication and O&M users when resolving (if it's not an action row - action rows are logged separately)
                      const logRowIndex = searchedRows.findIndex((row: any) => {
                        const currentRowKey = generateRowKey(selectedFile, row, headers);
                        return currentRowKey === selectedSiteObservationRowKey;
                      });
                      
                      const logRow = logRowIndex >= 0 ? searchedRows[logRowIndex] : null;
                      const isActionRow = logRow && logRow._actionId && (userRole === 'RTU/Communication' || userRole === 'O&M');
                      
                      // Log for Equipment users always, or for RTU/Communication/O&M users when resolving non-action rows
                      if (userRole === 'Equipment' || (siteObservationsStatus === 'resolved' && !isActionRow)) {
                        // Find row data to extract site name
                        const logRowData = logRowIndex >= 0 ? searchedRows[logRowIndex] : null;
                        const siteName = logRowData ? (
                          logRowData['Site Name'] || 
                          logRowData['SITE NAME'] || 
                          logRowData['Site'] || 
                          logRowData['Location'] ||
                          logRowData['LOCATION'] ||
                          'Unknown'
                        ) : 'Unknown';
                        
                        // Determine routing team for logging
                        const logIsRTUIssue = siteObservationsDialogData.typeOfIssue === 'RTU Issue' || siteObservationsDialogData.typeOfIssue === 'CS Issue';
                        const logRoutingTeam = logIsRTUIssue ? 'RTU/Communication Team' : null;
                        
                        const logOmIssueTypes = ['Faulty', 'Bipassed', 'Line Idel', 'AT Jump cut', 'Dismantled', 'Replaced', 'Equipment Idle', 'Spare Required', 'AT-PT Chamber Flashover'];
                        const logIsOMIssue = logOmIssueTypes.includes(siteObservationsDialogData.typeOfIssue);
                        const logOmRoutingTeam = logIsOMIssue ? 'O&M Team' : null;
                        
                        const logFinalRoutingTeam = logRoutingTeam || logOmRoutingTeam;
                        
                        // Determine action type based on status
                        let actionType = '';
                        if (logIsRTUIssue || logIsOMIssue) {
                          // Already logged routing separately, but log Site Observations update too
                          actionType = `Site Observation Updated - ${logFinalRoutingTeam ? `Routed to ${logFinalRoutingTeam}` : 'Status Changed'}`;
                        } else {
                          actionType = siteObservationsStatus === 'resolved' 
                            ? 'Site Observation - Resolved' 
                            : 'Site Observation - Status Updated';
                        }
                        
                        // Combine type of issue display
                        let issueDisplay = '';
                        if (siteObservationsDialogData.typeOfIssue === 'Others') {
                          issueDisplay = siteObservationsDialogData.specifyOther || 'Others';
                        } else if (siteObservationsDialogData.typeOfIssue === 'Spare Required') {
                          const spareTypes = siteObservationsDialogData.typeOfSpare || [];
                          let spareDisplay = '';
                          if (spareTypes.length > 0) {
                            const spareTypesDisplay = spareTypes.map(spare => {
                              if (spare === 'OTHERS' && siteObservationsDialogData.specifySpareOther) {
                                return siteObservationsDialogData.specifySpareOther;
                              }
                              return spare;
                            });
                            spareDisplay = spareTypesDisplay.join(', ');
                          }
                          issueDisplay = spareDisplay ? `Spare Required - ${spareDisplay}` : 'Spare Required';
                        } else {
                          issueDisplay = siteObservationsDialogData.typeOfIssue || '';
                        }
                        
                        // Extract site code from row data
                        const siteCode = logRowData ? (
                          logRowData['Site Code'] || 
                          logRowData['SITE CODE'] || 
                          logRowData['Code'] ||
                          logRowData['CODE'] ||
                          logRowData['SiteCode'] ||
                          ''
                        ) : '';
                        
                        // Log the activity
                        logActivity({
                          action: actionType,
                          typeOfIssue: issueDisplay,
                          routingTeam: logFinalRoutingTeam || undefined,
                          remarks: siteObservationsDialogData.remarks || '',
                          siteName: String(siteName),
                          siteCode: String(siteCode),
                          rowKey: selectedSiteObservationRowKey,
                          sourceFileId: selectedFile,
                          photosCount: photoData.length,
                          photos: photoData.length > 0 ? photoData : undefined,
                          status: siteObservationsStatus === 'resolved' ? 'Resolved' : 'Pending',
                          priority: 'Medium'
                        });
                      }
                    }, 300);

                    // Show success message
                      const statusMessage = siteObservationsStatus === 'pending' ? 'Pending' : 'Resolved';
                      alert(`Site observation marked as ${statusMessage} successfully!`);

                    // Close dialog
                      setShowSiteObservationsDialog(false);
                      setSelectedSiteObservationRowKey('');
                      setSiteObservationsStatus('');
                      setSiteObservationsDialogData({
                      remarks: '',
                        typeOfIssue: '',
                        specifyOther: '',
                        typeOfSpare: [],
                        specifySpareOther: '',
                      capturedPhotos: [],
                      uploadedPhotos: [],
                      uploadedDocuments: []
                    });
                    } catch (error: any) {
                      console.error('Error submitting site observation:', error);
                      alert(error.message || 'Failed to submit site observation. Please try again.');
                    } finally {
                      setIsSubmittingSiteObservations(false);
                    }
                  }, 0);
                }}
                style={{
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: isSubmittingSiteObservations ? 'not-allowed' : 'pointer',
                  minWidth: '100px',
                  opacity: isSubmittingSiteObservations ? 0.7 : 1
                }}
                onMouseEnter={(e) => !isSubmittingSiteObservations && (e.currentTarget.style.backgroundColor = '#1d4ed8')}
                onMouseLeave={(e) => !isSubmittingSiteObservations && (e.currentTarget.style.backgroundColor = '#2563eb')}
                disabled={isSubmittingSiteObservations}
              >
                {isSubmittingSiteObservations ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Site Observations Camera Preview Dialog */}
      {showSiteObservationsCameraPreview && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 z-[200] flex items-center justify-center"
          style={{ padding: '20px' }}
        >
          <div 
            className="bg-white rounded-lg shadow-xl"
            style={{ 
              width: '90%',
              maxWidth: '600px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Camera Preview */}
            <div className="p-4 flex-1 flex items-center justify-center" style={{ minHeight: '400px', backgroundColor: '#000' }}>
              {siteObservationsCapturedImageData ? (
                <img
                  src={siteObservationsCapturedImageData}
                  alt="Captured"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '400px',
                    objectFit: 'contain'
                  }}
                />
              ) : siteObservationsCameraStream ? (
                <video
                  id="site-observations-camera-preview-video"
                  autoPlay
                  playsInline
                  muted
                  style={{
                    maxWidth: '100%',
                    maxHeight: '400px',
                    objectFit: 'contain'
                  }}
                />
              ) : null}
            </div>

            {/* Action Buttons */}
            <div className="p-4 border-t border-gray-200 flex gap-3 justify-center">
              {siteObservationsCapturedImageData ? (
                <>
                  <button
                    type="button"
                    onClick={async () => {
                      // Get geolocation before saving (if not already captured)
                      let latitude: number | undefined = capturedPhotoMetadata?.latitude;
                      let longitude: number | undefined = capturedPhotoMetadata?.longitude;
                      let locationName: string | undefined = capturedPhotoMetadata?.location;
                      const timestamp = capturedPhotoMetadata?.timestamp || new Date().toISOString();
                      
                      // If metadata not available, get it now
                      if (!latitude || !longitude) {
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
                          if (!locationName) {
                            try {
                              const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`);
                              const data = await response.json();
                              if (data.display_name) {
                                locationName = data.display_name;
                              }
                            } catch (geoError) {
                              console.log('Could not get location name:', geoError);
                            }
                          }
                        } catch (geoError: any) {
                          console.log('Could not get geolocation:', geoError);
                          // Continue without location if permission denied
                        }
                      }
                      
                      // Save photo with metadata
                      setSiteObservationsDialogData(prev => ({
                        ...prev,
                        capturedPhotos: [...prev.capturedPhotos, {
                          data: siteObservationsCapturedImageData!,
                          latitude,
                          longitude,
                          timestamp,
                          location: locationName
                        }]
                      }));
                      setShowSiteObservationsCameraPreview(false);
                      setSiteObservationsCapturedImageData(null);
                      setCapturedPhotoMetadata(null);
                      // Stop camera stream when closing
                      if (siteObservationsCameraStreamRef.current) {
                        siteObservationsCameraStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
                        siteObservationsCameraStreamRef.current = null;
                        setSiteObservationsCameraStream(null);
                      }
                    }}
                    style={{
                      backgroundColor: '#10b981',
                      color: '#ffffff',
                      padding: '10px 24px',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      minWidth: '120px'
                    }}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSiteObservationsCameraPreview(false);
                      setSiteObservationsCapturedImageData(null);
                      setCapturedPhotoMetadata(null);
                      if (siteObservationsCameraStreamRef.current) {
                        siteObservationsCameraStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
                        siteObservationsCameraStreamRef.current = null;
                        setSiteObservationsCameraStream(null);
                      }
                    }}
                    style={{
                      backgroundColor: '#ef4444',
                      color: '#ffffff',
                      padding: '10px 24px',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      minWidth: '120px'
                    }}
                  >
                    Cancel
                  </button>
                </>
              ) : siteObservationsCameraStream ? (
                <>
                  <button
                    type="button"
                    onClick={async () => {
                      const video = document.getElementById('site-observations-camera-preview-video') as HTMLVideoElement;
                      if (video && video.videoWidth > 0 && video.videoHeight > 0) {
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
                          
                          setSiteObservationsCapturedImageData(imageData);
                          setCapturedPhotoMetadata({
                            latitude,
                            longitude,
                            timestamp,
                            location: locationName
                          });
                          // Keep camera running for multiple captures
                        }
                      }
                    }}
                    style={{
                      backgroundColor: '#10b981',
                      color: '#ffffff',
                      padding: '10px 24px',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      minWidth: '120px'
                    }}
                  >
                    Capture
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      // Stop camera stream
                      if (siteObservationsCameraStreamRef.current) {
                        siteObservationsCameraStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
                        siteObservationsCameraStreamRef.current = null;
                        setSiteObservationsCameraStream(null);
                      }
                      setShowSiteObservationsCameraPreview(false);
                      setSiteObservationsCapturedImageData(null);
                      setCapturedPhotoMetadata(null);
                    }}
                    style={{
                      backgroundColor: '#ef4444',
                      color: '#ffffff',
                      padding: '10px 24px',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      minWidth: '120px'
                    }}
                  >
                    Cancel
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Photo Viewer Dialog */}
      {showPhotoViewer && selectedRowKeyForPhotos && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 z-[200] flex items-center justify-center"
          style={{ padding: '20px' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPhotoViewer(false);
              setSelectedRowKeyForPhotos('');
            }
          }}
        >
          <div 
            className="bg-white rounded-lg shadow-xl flex flex-col"
            style={{ 
              width: '90%',
              maxWidth: '800px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 pt-5 pb-3 flex-shrink-0 flex justify-between items-center border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-800">View Photos</h3>
              <button
                type="button"
                onClick={() => {
                  setShowPhotoViewer(false);
                  setSelectedRowKeyForPhotos('');
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
                style={{ lineHeight: '1' }}
              >
                ×
              </button>
            </div>
            
            {/* Photo Gallery */}
            <div 
              className="px-5 py-4 overflow-y-auto flex-grow"
              style={{ 
                maxHeight: 'calc(90vh - 100px)',
                minHeight: 0
              }}
            >
              {(() => {
                // Get photos from state first, then check action row if available
                let photosToShow = viewPhotos[selectedRowKeyForPhotos] || [];
                
                // If no photos in state, check if this is an action row
                if (photosToShow.length === 0) {
                  const actionRow = allRowsForDisplay.find((row: any) => {
                    const rowKey = generateRowKey(selectedFile, row, headers);
                    return rowKey === selectedRowKeyForPhotos;
                  });
                  
                  if (actionRow && actionRow._photos) {
                    if (Array.isArray(actionRow._photos)) {
                      photosToShow = actionRow._photos;
                    } else if (typeof actionRow._photos === 'string') {
                      photosToShow = [actionRow._photos];
                    }
                  }
                }
                
                return photosToShow.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {photosToShow.map((photo, idx) => {
                      return (
                        <div key={idx} className="relative bg-gray-100 rounded-lg overflow-hidden p-2">
                          <img
                            src={photo}
                            alt={`Photo ${idx + 1}`}
                            className="w-full h-auto object-contain"
                            style={{ maxHeight: '400px', display: 'block', margin: '0 auto' }}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle" fill="%23999"%3EImage not available%3C/text%3E%3C/svg%3E';
                            }}
                          />
                          <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
                            Photo {idx + 1} of {photosToShow.length}
                          </div>
                          <div className="mt-2 flex gap-2 justify-center">
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
                                link.download = `photo_${selectedRowKeyForPhotos}_${idx + 1}.jpg`;
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
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No photos available
                  </div>
                );
              })()}
            </div>
            
            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-200 flex justify-end flex-shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowPhotoViewer(false);
                  setSelectedRowKeyForPhotos('');
                }}
                style={{
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  minWidth: '100px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1d4ed8'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
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

