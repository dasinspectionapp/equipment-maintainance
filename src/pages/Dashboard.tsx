import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { API_BASE } from '../utils/api';

interface DashboardStats {
  totalUsers: number;
  approvedUsers: number;
  pendingUsers: number;
  rejectedUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  roleCounts: { [key: string]: number };
  applicationCounts: { [key: string]: number };
  designationCounts: { [key: string]: number };
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899', '#84CC16', '#F97316', '#6366F1'];

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Check My Device Dialog states
  const [showCheckDeviceDialog, setShowCheckDeviceDialog] = useState(false);
  const [siteCode, setSiteCode] = useState('');
  const [selectedOption, setSelectedOption] = useState<'offline' | 'rtu' | ''>('');
  const [deviceData, setDeviceData] = useState<any>(null);
  const [offlineData, setOfflineData] = useState<any>(null);
  const [rtuData, setRtuData] = useState<any>(null);
  const [isLoadingDeviceData, setIsLoadingDeviceData] = useState(false);
  const [deviceDataError, setDeviceDataError] = useState<string | null>(null);
  
  // Site code autocomplete states
  const [siteCodeSuggestions, setSiteCodeSuggestions] = useState<string[]>([]);
  const [showSiteCodeSuggestions, setShowSiteCodeSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  
  // My Directions Modal State
  const [showMyDirectionsModal, setShowMyDirectionsModal] = useState(false);
  const [directionsSiteCodeInput, setDirectionsSiteCodeInput] = useState('');
  const [selectedSiteCodes, setSelectedSiteCodes] = useState<string[]>([]);
  const [directionsSiteCodeSuggestions, setDirectionsSiteCodeSuggestions] = useState<string[]>([]);
  const [showDirectionsSuggestions, setShowDirectionsSuggestions] = useState(false);
  const [selectedDirectionsSuggestionIndex, setSelectedDirectionsSuggestionIndex] = useState(-1);
  
  // My Sites Dialog states
  const [showMySitesDialog, setShowMySitesDialog] = useState(false);
  const [application, setApplication] = useState<'offline' | 'rtu' | ''>('');
  const [division, setDivision] = useState<string>('');
  const [subDivision, setSubDivision] = useState('');
  const [subDivisionSuggestions, setSubDivisionSuggestions] = useState<string[]>([]);
  const [_showSubDivisionSuggestions, setShowSubDivisionSuggestions] = useState(false);
  const [_selectedSubDivisionIndex, setSelectedSubDivisionIndex] = useState(-1);
  const [isLoadingSubDivisions, setIsLoadingSubDivisions] = useState(false);
  
  // Table rows state
  const [tableRows, setTableRows] = useState<Array<{
    id: string;
    siteCode: string;
    noOfDaysOffline: string;
    mapSelected: boolean;
    siteObservation: string;
    kmlFilePath?: string;
  }>>([]);
  const [siteCodesForSubDivision, setSiteCodesForSubDivision] = useState<string[]>([]);
  const [showSiteObservationDialog, setShowSiteObservationDialog] = useState(false);
  const [selectedRowForObservation, setSelectedRowForObservation] = useState<string | null>(null);
  const [siteObservationStatus, setSiteObservationStatus] = useState<'pending' | 'resolved' | ''>('');
  const [locations, setLocations] = useState<Array<{name: string; kmlFilePath: string; fieldId?: string}>>([]);
  
  // Site Observations Dialog Data
  const [siteObservationsDialogData, setSiteObservationsDialogData] = useState({
    remarks: '',
    typeOfIssue: '',
    specifyOther: '',
    typeOfSpare: [] as string[],
    specifySpareOther: '',
    capturedPhotos: [] as Array<{ data: string; latitude?: number; longitude?: number; timestamp?: string; location?: string }>,
    uploadedPhotos: [] as File[]
  });
  const [showSiteObservationsCameraPreview, setShowSiteObservationsCameraPreview] = useState(false);
  const [siteObservationsCameraStream, setSiteObservationsCameraStream] = useState<MediaStream | null>(null);
  const [siteObservationsCapturedImageData, setSiteObservationsCapturedImageData] = useState<string | null>(null);
  const [isTypeOfSpareDropdownOpen, setIsTypeOfSpareDropdownOpen] = useState(false);
  const [isSubmittingSiteObservations, setIsSubmittingSiteObservations] = useState(false);
  const siteObservationsCameraStreamRef = useRef<MediaStream | null>(null);

  // Device Status Cards states
  const [deviceStatusCounts, setDeviceStatusCounts] = useState({
    online: 0,
    offline: 0,
    local: 0,
    remote: 0,
    switchIssue: 0,
    rtuLocal: 0
  });
  const [selectedDeviceStatusDate, setSelectedDeviceStatusDate] = useState<string>('');
  const [latestDeviceStatusDate, setLatestDeviceStatusDate] = useState<string>('');

  const fetchDashboardStats = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      console.log('Fetching dashboard stats with token:', !!token);
      
      const response = await fetch(`${API_BASE}/api/auth/dashboard-stats`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('Dashboard stats response status:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('Dashboard stats result:', result);
        
        if (result.success) {
          setStats(result.data);
          console.log('Stats set successfully:', result.data);
        } else {
          console.error('API returned unsuccessful response:', result);
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to fetch dashboard stats:', response.status, errorData);
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const selectedApplication = localStorage.getItem('selectedApplication');
    
    if (storedUser) {
      const userData = JSON.parse(storedUser);
      setUser(userData);
      
      console.log('Dashboard - User role:', userData.role);
      console.log('Dashboard - Selected application:', selectedApplication);
      
      // Redirect CCR role to Equipment Dashboard
      if (userData.role === 'CCR' || userData.role?.toLowerCase() === 'ccr') {
        navigate('/dashboard/equipment-dashboard', { replace: true });
        return;
      }
      
      // Redirect Equipment Survey users to Survey Form
      if (selectedApplication === 'equipment-survey' && userData.role !== 'Admin') {
        navigate('/dashboard/survey-form', { replace: true });
        return;
      }

      // Fetch dashboard stats for Admin users
      if (userData.role === 'Admin') {
        fetchDashboardStats();
      } else {
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, [navigate, fetchDashboardStats]);

  // Fetch device status counts
  useEffect(() => {
    const fetchDeviceStatusCounts = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const user = localStorage.getItem('user');
        if (!user) return;

        const userData = JSON.parse(user);
        const userRole = userData.role || '';
        const userDivisions = userData.division || [];
        const isCCR = userRole === 'CCR' || userRole.toLowerCase() === 'ccr';

        // Fetch from local-remote endpoint
        const params = new URLSearchParams();
        if (selectedDeviceStatusDate) {
          params.append('date', selectedDeviceStatusDate);
        }
        // For CCR role, don't filter by divisions (show all data)
        // For Equipment role, filter by user's divisions
        if (!isCCR && userDivisions.length > 0) {
          userDivisions.forEach((div: string) => params.append('divisions', div));
        }

        const url = `${API_BASE}/api/equipment-offline-sites/reports/local-remote?${params.toString()}`;
        console.log('Fetching device status counts for date:', selectedDeviceStatusDate || 'latest', 'URL:', url);
        
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          cache: 'no-store'
        });

        if (response.ok) {
          const data = await response.json();
          console.log('Device status counts response:', data);
          
          if (data.success && data.data) {
            // Aggregate counts from all divisions
            let totalOnline = 0;
            let totalOffline = 0;
            let totalLocal = 0;
            let totalRemote = 0;
            let totalSwitchIssue = 0;
            let totalRTULocal = 0;

            if (Array.isArray(data.data)) {
              // If data is an array of divisions, sum up the counts
              console.log('Dashboard - Received array of divisions:', data.data.length);
              data.data.forEach((division: any) => {
                totalOnline += division.online || 0;
                totalOffline += division.offline || 0;
                totalLocal += division.local || 0;
                totalRemote += division.remote || 0;
                totalSwitchIssue += division.switchIssue || 0;
                totalRTULocal += division.rtuLocal || 0;
              });
            } else if (data.data.online !== undefined) {
              // If data is a single aggregated object
              console.log('Dashboard - Received single aggregated object');
              totalOnline = data.data.online || 0;
              totalOffline = data.data.offline || 0;
              totalLocal = data.data.local || 0;
              totalRemote = data.data.remote || 0;
              totalSwitchIssue = data.data.switchIssue || 0;
              totalRTULocal = data.data.rtuLocal || 0;
            } else {
              console.warn('Dashboard - Unexpected data format:', data.data);
            }

            console.log('Dashboard - Aggregated counts:', { totalOnline, totalOffline, totalLocal, totalRemote, totalSwitchIssue, totalRTULocal });

            setDeviceStatusCounts({
              online: totalOnline,
              offline: totalOffline,
              local: totalLocal,
              remote: totalRemote,
              switchIssue: totalSwitchIssue,
              rtuLocal: totalRTULocal
            });
            
            // Set latest date if available and no date is selected
            if (data.latestDate && !selectedDeviceStatusDate) {
              setLatestDeviceStatusDate(data.latestDate);
              setSelectedDeviceStatusDate(data.latestDate);
            }
          } else {
            console.warn('API returned unsuccessful response or no data:', data);
            // Reset counts if no data
            setDeviceStatusCounts({
              online: 0,
              offline: 0,
              local: 0,
              remote: 0,
              switchIssue: 0,
              rtuLocal: 0
            });
          }
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error('Failed to fetch device status counts:', response.status, errorData);
          // Reset counts on error
          setDeviceStatusCounts({
            online: 0,
            offline: 0,
            local: 0,
            remote: 0,
            switchIssue: 0,
            rtuLocal: 0
          });
        }
      } catch (error) {
        console.error('Error fetching device status counts:', error);
        // Reset counts on error
        setDeviceStatusCounts({
          online: 0,
          offline: 0,
          local: 0,
          remote: 0,
          switchIssue: 0,
          rtuLocal: 0
        });
      }
    };

    const userRole = user?.role || '';
    if (userRole === 'Equipment' || userRole.toLowerCase() === 'equipment' || 
        userRole === 'CCR' || userRole.toLowerCase() === 'ccr') {
      fetchDeviceStatusCounts();
    }
  }, [user, selectedDeviceStatusDate]);

  // Normalize function for header matching
  const normalize = (str: string): string => {
    return String(str || '').trim().toLowerCase();
  };

  // Fetch site codes for My Directions modal from View Data files
  const fetchDirectionsSiteCodeSuggestions = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      // Fetch all uploads
      const uploadsRes = await fetch(`${API_BASE}/api/uploads`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const uploadsJson = await uploadsRes.json();
      
      if (!uploadsJson?.success) return;

      // Find Device Status Upload file (same logic as ViewData)
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

      if (!deviceStatusFile) return;

      // Fetch file data
      const fileRes = await fetch(`${API_BASE}/api/uploads/${deviceStatusFile.fileId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const fileJson = await fileRes.json();

      if (!fileJson?.success || !fileJson.file) return;

      const file = fileJson.file;
      const rows = Array.isArray(file.rows) ? file.rows : [];
      const headers = file.headers && file.headers.length ? file.headers : (rows[0] ? Object.keys(rows[0]) : []);

      // Find site code header
      const siteCodeHeader = headers.find((h: string) => {
        const n = normalize(h);
        return n === 'site code' || n === 'sitecode' || n === 'site_code';
      });

      if (!siteCodeHeader) return;

      // Extract all unique site codes
      const siteCodesSet = new Set<string>();
      rows.forEach((row: any) => {
        const sc = String(row[siteCodeHeader] || '').trim();
        if (sc) {
          siteCodesSet.add(sc);
        }
      });

      const siteCodes = Array.from(siteCodesSet).sort();
      setDirectionsSiteCodeSuggestions(siteCodes);
    } catch (error) {
      console.error('Error fetching site code suggestions for directions:', error);
    }
  }, []);

  // Fetch all site codes from View Data files
  const fetchSiteCodeSuggestions = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      // Fetch all uploads
      const uploadsRes = await fetch(`${API_BASE}/api/uploads`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const uploadsJson = await uploadsRes.json();
      
      if (!uploadsJson?.success) return;

      // Find Device Status Upload file (same logic as ViewData)
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

      if (!deviceStatusFile) return;

      // Fetch file data
      const fileRes = await fetch(`${API_BASE}/api/uploads/${deviceStatusFile.fileId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const fileJson = await fileRes.json();

      if (!fileJson?.success || !fileJson.file) return;

      const file = fileJson.file;
      const rows = Array.isArray(file.rows) ? file.rows : [];
      const headers = file.headers && file.headers.length ? file.headers : (rows[0] ? Object.keys(rows[0]) : []);

      // Find site code header
      const siteCodeHeader = headers.find((h: string) => {
        const n = normalize(h);
        return n === 'site code' || n === 'sitecode' || n === 'site_code';
      });

      if (!siteCodeHeader) return;

      // Extract all unique site codes
      const siteCodesSet = new Set<string>();
      rows.forEach((row: any) => {
        const sc = String(row[siteCodeHeader] || '').trim();
        if (sc) {
          siteCodesSet.add(sc);
        }
      });

      const siteCodes = Array.from(siteCodesSet).sort();
      setSiteCodeSuggestions(siteCodes);
    } catch (error) {
      console.error('Error fetching site code suggestions:', error);
    }
  }, []);

  // Fetch Sub Division suggestions from View Data
  // Fetch Sub Division suggestions filtered by selected Division
  const fetchSubDivisionSuggestions = useCallback(async (selectedDivision: string) => {
    if (!selectedDivision.trim()) {
      setSubDivisionSuggestions([]);
      return;
    }

    setIsLoadingSubDivisions(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setSubDivisionSuggestions([]);
        return;
      }

      const uploadsRes = await fetch(`${API_BASE}/api/uploads`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const uploadsJson = await uploadsRes.json();
      
      if (!uploadsJson?.success) {
        setSubDivisionSuggestions([]);
        return;
      }

      // Find Device Status Upload file (same as View Data)
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
        setSubDivisionSuggestions([]);
        return;
      }

      // Fetch file data
      const fileRes = await fetch(`${API_BASE}/api/uploads/${deviceStatusFile.fileId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const fileJson = await fileRes.json();

      if (!fileJson?.success || !fileJson.file) {
        setSubDivisionSuggestions([]);
        return;
      }

      const file = fileJson.file;
      const rows = Array.isArray(file.rows) ? file.rows : [];
      const headers = file.headers && file.headers.length ? file.headers : (rows[0] ? Object.keys(rows[0]) : []);

      // Find Division and Sub Division headers
      const divisionHeader = headers.find((h: string) => {
        const n = normalize(h);
        return n === 'division';
      });

      const subDivisionHeader = headers.find((h: string) => {
        const n = normalize(h);
        return n === 'sub division' || n === 'subdivision' || n === 'sub_division';
      });

      if (!divisionHeader || !subDivisionHeader) {
        setSubDivisionSuggestions([]);
        return;
      }

      // Extract unique Sub Divisions filtered by selected Division
      const subDivisionsSet = new Set<string>();
      rows.forEach((row: any) => {
        const rowDivision = String(row[divisionHeader] || '').trim();
        const rowSubDivision = String(row[subDivisionHeader] || '').trim();
        
        // Match division (case-insensitive)
        if (normalize(rowDivision) === normalize(selectedDivision) && rowSubDivision) {
          subDivisionsSet.add(rowSubDivision);
        }
      });

      setSubDivisionSuggestions(Array.from(subDivisionsSet).sort());
    } catch (error) {
      console.error('Error fetching Sub Division suggestions:', error);
      setSubDivisionSuggestions([]);
    } finally {
      setIsLoadingSubDivisions(false);
    }
  }, []);

  // Fetch device data from View Data
  const fetchDeviceData = async (siteCodeValue: string) => {
    setIsLoadingDeviceData(true);
    setDeviceDataError(null);
    // Don't reset deviceData to null - keep previous data visible while loading
    // setDeviceData(null); // Removed - keep showing previous data during search
    setOfflineData(null);
    setRtuData(null);
    setSelectedOption('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      // Fetch all uploads
      const uploadsRes = await fetch(`${API_BASE}/api/uploads`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const uploadsJson = await uploadsRes.json();
      
      if (!uploadsJson?.success) {
        throw new Error('Failed to fetch uploads');
      }

      // Find Device Status Upload file (same logic as ViewData)
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
        throw new Error('No Device Status Upload file found');
      }

      // Fetch file data
      const fileRes = await fetch(`${API_BASE}/api/uploads/${deviceStatusFile.fileId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const fileJson = await fileRes.json();

      if (!fileJson?.success || !fileJson.file) {
        throw new Error('Failed to load file data');
      }

      const file = fileJson.file;
      const rows = Array.isArray(file.rows) ? file.rows : [];
      const headers = file.headers && file.headers.length ? file.headers : (rows[0] ? Object.keys(rows[0]) : []);

      // Find column headers
      const siteCodeHeader = headers.find((h: string) => {
        const n = normalize(h);
        return n === 'site code' || n === 'sitecode' || n === 'site_code';
      });
      const deviceStatusHeader = headers.find((h: string) => {
        const n = normalize(h);
        return n === 'device status' || n === 'device_status' || n === 'devicestatus' ||
               (n.includes('device') && n.includes('status'));
      });
      const divisionHeader = headers.find((h: string) => {
        const n = normalize(h);
        return n === 'division';
      });
      const subDivisionHeader = headers.find((h: string) => {
        const n = normalize(h);
        return n === 'sub division' || n === 'subdivision' || n === 'sub_division';
      });
      const hrnHeader = headers.find((h: string) => {
        const n = normalize(h);
        return n === 'hrn' || n === 'location/hrn' || n === 'location hrn';
      });

      // Find row matching site code
      const matchingRow = rows.find((row: any) => {
        if (!siteCodeHeader) return false;
        const rowSiteCode = String(row[siteCodeHeader] || '').trim();
        return normalize(rowSiteCode) === normalize(siteCodeValue);
      });

      // Extract data from Device Status Upload
      const extractedData: any = {};
      if (matchingRow) {
        if (deviceStatusHeader) extractedData.deviceStatus = String(matchingRow[deviceStatusHeader] || '').trim();
        if (divisionHeader) extractedData.division = String(matchingRow[divisionHeader] || '').trim();
        if (subDivisionHeader) extractedData.subDivision = String(matchingRow[subDivisionHeader] || '').trim();
        if (hrnHeader) extractedData.hrn = String(matchingRow[hrnHeader] || '').trim();
      }

      // Fetch ONLINE-OFFLINE data to get "NO OF DAYS OFFLINE"
      try {
        const onlineOfflineFiles = (uploadsJson.files || []).filter((f: any) => {
          const uploadType = String(f.uploadType || '').toLowerCase().trim();
          const fileName = String(f.name || '').toLowerCase();
          const isOnlineOfflineType = uploadType === 'online-offline-data';
          const isOnlineOfflineFileName = fileName.includes('online-offline') || 
                                         fileName.includes('online_offline') ||
                                         fileName.includes('onlineoffline');
          return isOnlineOfflineType || isOnlineOfflineFileName;
        });

        const latestOnlineOfflineFile = onlineOfflineFiles.sort((a: any, b: any) => {
          const dateA = a.uploadedAt ? new Date(a.uploadedAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
          const dateB = b.uploadedAt ? new Date(b.uploadedAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
          return dateB - dateA;
        })[0];

        if (latestOnlineOfflineFile) {
          const onlineOfflineRes = await fetch(`${API_BASE}/api/uploads/${latestOnlineOfflineFile.fileId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const onlineOfflineJson = await onlineOfflineRes.json();

          if (onlineOfflineJson?.success && onlineOfflineJson.file) {
            const onlineOfflineFile = onlineOfflineJson.file;
            const onlineOfflineRows = Array.isArray(onlineOfflineFile.rows) ? onlineOfflineFile.rows : [];
            const onlineOfflineHeaders = onlineOfflineFile.headers && onlineOfflineFile.headers.length 
              ? onlineOfflineFile.headers 
              : (onlineOfflineRows[0] ? Object.keys(onlineOfflineRows[0]) : []);

            // Find site code header in ONLINE-OFFLINE
            const onlineOfflineSiteCodeHeader = onlineOfflineHeaders.find((h: string) => {
              const n = normalize(h);
              return n === 'site code' || n === 'sitecode' || n === 'site_code';
            });

            // Find NO OF DAYS OFFLINE header
            const noOfDaysOfflineHeader = onlineOfflineHeaders.find((h: string) => {
              const n = normalize(h);
              return n === 'no of days offline' ||
                     n === 'no_of_days_offline' ||
                     n === 'noofdaysoffline' ||
                     (n.includes('days') && n.includes('offline')) ||
                     (n.includes('day') && n.includes('offline'));
            });

            // Find DEVICE STATUS header in ONLINE-OFFLINE (to use the merged value)
            const onlineOfflineDeviceStatusHeader = onlineOfflineHeaders.find((h: string) => {
              const n = normalize(h);
              return n === 'device status' ||
                     n === 'device_status' ||
                     n === 'devicestatus' ||
                     (n.includes('device') && n.includes('status'));
            });

            if (onlineOfflineSiteCodeHeader) {
              // Find matching row in ONLINE-OFFLINE data
              const onlineOfflineMatchingRow = onlineOfflineRows.find((row: any) => {
                const rowSiteCode = String(row[onlineOfflineSiteCodeHeader] || '').trim();
                return normalize(rowSiteCode) === normalize(siteCodeValue);
              });

              if (onlineOfflineMatchingRow) {
                // Use DEVICE STATUS from ONLINE-OFFLINE (merged data)
                if (onlineOfflineDeviceStatusHeader) {
                  extractedData.deviceStatus = String(onlineOfflineMatchingRow[onlineOfflineDeviceStatusHeader] || '').trim();
                }
                
                // Extract NO OF DAYS OFFLINE
                if (noOfDaysOfflineHeader) {
                  extractedData.noOfDaysOffline = String(onlineOfflineMatchingRow[noOfDaysOfflineHeader] || '').trim();
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Error fetching ONLINE-OFFLINE data:', error);
        // Continue without ONLINE-OFFLINE data
      }

      // Always set deviceData, even if empty, so Device Information section always shows
      setDeviceData(extractedData);
      setDeviceDataError(''); // Clear any previous errors
    } catch (error: any) {
      console.error('Error fetching device data:', error);
      // Set empty deviceData so Device Information section still shows
      setDeviceData({});
      setDeviceDataError(error.message || 'Failed to fetch device data');
    } finally {
      setIsLoadingDeviceData(false);
    }
  };

  // Fetch offline sites data from localStorage (same as MY OFFLINE SITES component)
  // Only for Equipment role users - fetches Task Status, Type of Issue, and Remarks from MY OFFLINE SITES tab
  const fetchOfflineData = async (siteCodeValue: string) => {
    try {
      // Check if user is Equipment role - only fetch for Equipment users
      const storedUser = localStorage.getItem('user');
      if (!storedUser) {
        setOfflineData({
          taskStatus: '',
          typeOfIssue: '',
          remarks: ''
        });
        return;
      }
      
      const userData = JSON.parse(storedUser);
      const userRole = userData?.role || '';
      
      // Only fetch for Equipment role users
      if (userRole !== 'Equipment') {
        setOfflineData({
          taskStatus: '',
          typeOfIssue: '',
          remarks: ''
        });
        return;
      }

      const token = localStorage.getItem('token');
      if (!token) return;

      // Fetch all uploads to find Device Status Upload file
      const uploadsRes = await fetch(`${API_BASE}/api/uploads`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const uploadsJson = await uploadsRes.json();
      
      if (!uploadsJson?.success) {
        setOfflineData({
          taskStatus: '',
          typeOfIssue: '',
          remarks: ''
        });
        return;
      }

      // Find Device Status Upload file (same as MY OFFLINE SITES uses)
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
        setOfflineData({
          taskStatus: '',
          typeOfIssue: '',
          remarks: ''
        });
        return;
      }

      // Fetch file data to find matching row
      const fileRes = await fetch(`${API_BASE}/api/uploads/${deviceStatusFile.fileId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const fileJson = await fileRes.json();

      if (!fileJson?.success || !fileJson.file) {
        setOfflineData({
          taskStatus: '',
          typeOfIssue: '',
          remarks: ''
        });
        return;
      }

      const file = fileJson.file;
      const rows = Array.isArray(file.rows) ? file.rows : [];
      const headers = file.headers && file.headers.length ? file.headers : (rows[0] ? Object.keys(rows[0]) : []);

      // Find site code header
      const siteCodeHeader = headers.find((h: string) => {
        const n = normalize(h);
        return n === 'site code' || n === 'sitecode' || n === 'site_code';
      });

      if (!siteCodeHeader) {
        setOfflineData({
          taskStatus: '',
          typeOfIssue: '',
          remarks: ''
        });
        return;
      }

      // Find matching row
      const matchingRow = rows.find((row: any) => {
        const rowSiteCode = String(row[siteCodeHeader] || '').trim();
        return normalize(rowSiteCode) === normalize(siteCodeValue);
      });

      if (!matchingRow) {
        setOfflineData({
          taskStatus: '',
          typeOfIssue: '',
          remarks: ''
        });
        return;
      }

      // Generate rowKey using the same function as MY OFFLINE SITES
      const generateRowKey = (fileId: string, row: any, headers: string[]): string => {
        const actualFileId = row._sourceFileId || fileId;
        if (row.id) {
          return `${actualFileId}-${row.id}`;
        }
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
        const keyParts: string[] = [];
        headers.forEach(header => {
          const value = row[header] ?? '';
          keyParts.push(String(value));
        });
        return `${actualFileId}-${keyParts.join('|')}`;
      };

      const rowKey = generateRowKey(deviceStatusFile.fileId, matchingRow, headers);
      
      let taskStatusFromStorage = '';
      let typeOfIssueFromStorage = '';
      let remarksFromStorage = '';
      let siteObservationsValue = '';
      
      // For Equipment role users: First try to fetch from database (EquipmentOfflineSites)
      try {
        const dbRes = await fetch(`${API_BASE}/api/equipment-offline-sites/${deviceStatusFile.fileId}/${encodeURIComponent(rowKey)}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (dbRes.ok) {
          const dbResult = await dbRes.json();
          if (dbResult.success && dbResult.data) {
            const dbData = dbResult.data;
            if (dbData.taskStatus) {
              taskStatusFromStorage = dbData.taskStatus;
            }
            if (dbData.typeOfIssue) {
              typeOfIssueFromStorage = dbData.typeOfIssue;
            }
            // Set remarks even if empty string (to distinguish from undefined)
            // This ensures Remarks field is always displayed (shows "-" if empty)
            if (dbData.remarks !== undefined && dbData.remarks !== null) {
              remarksFromStorage = String(dbData.remarks);
            }
            
            console.log('[Dashboard] Database fetch result:', {
              taskStatus: taskStatusFromStorage,
              typeOfIssue: typeOfIssueFromStorage,
              remarks: remarksFromStorage,
              dbTypeOfIssue: dbData.typeOfIssue,
              dbRemarks: dbData.remarks,
              typeOfIssueTruthy: !!dbData.typeOfIssue,
              remarksTruthy: !!dbData.remarks,
              remarksType: typeof dbData.remarks
            });
            if (dbData.siteObservations) {
              siteObservationsValue = dbData.siteObservations;
            }
            
            // CRITICAL: If Site Observations is "Resolved", Task Status MUST be "Resolved"
            if (siteObservationsValue === 'Resolved') {
              taskStatusFromStorage = 'Resolved';
            }
            
            console.log('[Dashboard] Loaded from database:', { taskStatus: taskStatusFromStorage, siteObservations: siteObservationsValue });
          }
        }
      } catch (dbError) {
        console.error('Error fetching from EquipmentOfflineSites database:', dbError);
      }
      
      // CRITICAL: For Equipment role users, Type of Issue and Remarks are stored in database ONLY
      // Do NOT fall back to localStorage for these fields - database is the single source of truth
      // Only check localStorage for Task Status (for backward compatibility) and Site Observations
      const storageKey = `myData_${deviceStatusFile.fileId}`;
      const savedData = localStorage.getItem(storageKey);
      
      // Only check localStorage for Task Status and Site Observations (not Type of Issue or Remarks)
      if (savedData) {
        try {
          const data = JSON.parse(savedData);
          // Check Site Observations from localStorage (for backward compatibility)
          if (!siteObservationsValue && data.siteObservations && data.siteObservations[rowKey]) {
            siteObservationsValue = data.siteObservations[rowKey];
            // If Site Observations is "Resolved", set Task Status to "Resolved"
            if (siteObservationsValue === 'Resolved' && !taskStatusFromStorage) {
              taskStatusFromStorage = 'Resolved';
            }
          }
          // Fallback: Get Task Status from localStorage if not found in database (for backward compatibility)
          if (!taskStatusFromStorage && data.taskStatus && data.taskStatus[rowKey]) {
            taskStatusFromStorage = data.taskStatus[rowKey];
          }
          // NOTE: Type of Issue and Remarks are NOT read from localStorage - database only
        } catch (error) {
          console.error('Error parsing MY OFFLINE SITES data from localStorage:', error);
        }
      }
      
      // NOTE: Site Code-based storage is also NOT checked for Type of Issue and Remarks
      // These fields are stored in database only for Equipment role users

      // CRITICAL: Final check - If Site Observations is "Resolved", Task Status MUST be "Resolved"
      // This takes priority over routing actions and must be checked after all data sources
      if (siteObservationsValue === 'Resolved') {
        taskStatusFromStorage = 'Resolved';
        console.log('[Dashboard] Final check: Site Observations is Resolved, setting Task Status to Resolved');
      } else if (!taskStatusFromStorage) {
        // Only calculate Task Status from routing actions if Site Observations is not "Resolved"
        // and Task Status is not already set from database
        // Calculate Task Status from routing actions (same logic as MY OFFLINE SITES)
        // Fetch actions routed by Equipment user to calculate detailed Task Status
        try {
          const actionsRes = await fetch(`${API_BASE}/api/actions/my-routed-actions`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (actionsRes.ok) {
            const actionsJson = await actionsRes.json();
            if (actionsJson?.success && Array.isArray(actionsJson.actions)) {
              // Filter actions for Equipment role (same as MyData.tsx)
              const omIssueTypes = ['Faulty', 'Bipassed', 'Line Idel', 'AT Jump cut', 'Dismantled', 'Replaced', 'Equipment Idle', 'Spare Required', 'AT-PT Chamber Flashover'];
              const routedActions = actionsJson.actions.filter((action: any) => 
                action.typeOfIssue === 'RTU Issue' || 
                action.typeOfIssue === 'CS Issue' ||
                action.typeOfIssue === 'AMC Resolution Approval' ||
                omIssueTypes.includes(action.typeOfIssue)
              );
              
              // Find actions for this specific rowKey
              const actionsForRow = routedActions.filter((action: any) => {
                const actionRowKey = generateRowKey(action.sourceFileId || deviceStatusFile.fileId, action.rowData || {}, action.headers || []);
                // Also check for AMC Resolution Approval actions with original row key
                if (action.typeOfIssue === 'AMC Resolution Approval' && action.rowData?.__siteObservationRowKey) {
                  return action.rowData.__siteObservationRowKey === rowKey || actionRowKey === rowKey;
                }
                return actionRowKey === rowKey;
              });
              
              if (actionsForRow.length > 0) {
              // Build aggregated action data (similar to MyData.tsx)
              let aggregatedAction: any = null;
              const allActionsForRow: any[] = [];
              const vendorNamesSet = new Set<string>();
              let hasOM = false;
              let hasAMC = false;
              let hasRTU = false;
              
              actionsForRow.forEach((action: any) => {
                const destinationRole = action.assignedToRole;
                const vendorName = action.assignedToVendor || action.vendor || '';
                
                if (destinationRole === 'O&M') hasOM = true;
                if (destinationRole === 'AMC') {
                  hasAMC = true;
                  if (vendorName) vendorNamesSet.add(vendorName);
                }
                if (destinationRole === 'RTU/Communication') hasRTU = true;
                
                allActionsForRow.push(action);
                
                // Use first action as base, or prefer completed action
                if (!aggregatedAction) {
                  aggregatedAction = action;
                } else {
                  const existingStatus = String(aggregatedAction.status || '').toLowerCase();
                  const currentStatus = String(action.status || '').toLowerCase();
                  if (currentStatus === 'completed' && existingStatus !== 'completed') {
                    aggregatedAction = action;
                  }
                }
              });
              
              // Extract Type of Issue from routing actions if not found in database
              // This is important for Pending cases where Type of Issue might only be in actions
              if (!typeOfIssueFromStorage && aggregatedAction && aggregatedAction.typeOfIssue) {
                // Skip AMC Resolution Approval as it's not a real issue type
                if (aggregatedAction.typeOfIssue !== 'AMC Resolution Approval') {
                  typeOfIssueFromStorage = aggregatedAction.typeOfIssue;
                  console.log('[Dashboard] Extracted Type of Issue from routing action:', typeOfIssueFromStorage);
                }
              }
              
              // Extract Remarks from routing actions if not found in database
              if (!remarksFromStorage && aggregatedAction && aggregatedAction.remarks) {
                remarksFromStorage = String(aggregatedAction.remarks);
                console.log('[Dashboard] Extracted Remarks from routing action:', remarksFromStorage);
              }
              
              if (aggregatedAction) {
                const actionStatus = String(aggregatedAction.status || '').toLowerCase();
                const vendorNames = Array.from(vendorNamesSet);
                
                if (actionStatus === 'completed') {
                  const issueType = (aggregatedAction.typeOfIssue || '').toString();
                  const isAMCIssue =
                    hasAMC ||
                    issueType === 'Spare Required' ||
                    issueType === 'Faulty';

                  const parts: string[] = [];
                  
                  if (isAMCIssue) {
                    if (vendorNames.length > 0) {
                      const uniqueVendors = vendorNames.join(', ');
                      parts.push(`Resolved at Vendor (${uniqueVendors})`);
                    } else {
                      parts.push('Resolved at AMC Team');
                    }
                  } else {
                    parts.push('Resolved');
                  }
                  
                  // Check if there are other pending routings
                  if (hasOM) {
                    const hasPendingOM = allActionsForRow.some((a: any) => 
                      a.assignedToRole === 'O&M' && 
                      String(a.status || '').toLowerCase() !== 'completed'
                    );
                    if (hasPendingOM) {
                      parts.push('Pending at O&M Team');
                    }
                  }
                  
                  if (hasRTU) {
                    const hasPendingRTU = allActionsForRow.some((a: any) => 
                      a.assignedToRole === 'RTU/Communication' && 
                      String(a.status || '').toLowerCase() !== 'completed'
                    );
                    if (hasPendingRTU) {
                      parts.push('Pending at RTU/Communication Team');
                    }
                  }
                  
                  taskStatusFromStorage = parts.join('; ');
                } else {
                  // Build consolidated status for pending actions
                  const parts: string[] = [];
                  if (hasOM) {
                    parts.push('Pending at O&M Team');
                  }
                  if (hasAMC) {
                    if (vendorNames.length > 0) {
                      const uniqueVendors = vendorNames.join(', ');
                      parts.push(`Pending at Vendor (${uniqueVendors})`);
                    } else {
                      parts.push('Pending at AMC Team');
                    }
                  }
                  if (hasRTU) {
                    parts.push('Pending at RTU/Communication Team');
                  }
                  if (parts.length > 0) {
                    taskStatusFromStorage = parts.join('; ');
                  }
                }
              }
            }
          }
        }
        } catch (error) {
          console.error('Error fetching routing actions for Task Status:', error);
          // Fallback to localStorage if action fetch fails
          if (savedData) {
            try {
              const data = JSON.parse(savedData);
              if (data.taskStatus && data.taskStatus[rowKey]) {
                taskStatusFromStorage = data.taskStatus[rowKey];
              }
            } catch (parseError) {
              console.error('Error parsing task status from localStorage:', parseError);
            }
          }
        }
      }

      const finalOfflineData = {
        taskStatus: taskStatusFromStorage || '',
        typeOfIssue: typeOfIssueFromStorage || '',
        remarks: remarksFromStorage || ''
      };
      
      console.log('[Dashboard] Setting offlineData:', finalOfflineData);
      setOfflineData(finalOfflineData);
    } catch (error) {
      console.error('Error fetching offline data:', error);
      setOfflineData({
        taskStatus: '',
        typeOfIssue: '',
        remarks: ''
      });
    }
  };

  // Fetch RTU Tracker data (merge Device Status Upload + RTU Tracker file like MY RTU TRACKER)
  const fetchRTUData = async (siteCodeValue: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      // Fetch all uploads
      const uploadsRes = await fetch(`${API_BASE}/api/uploads`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const uploadsJson = await uploadsRes.json();
      
      if (!uploadsJson?.success) {
        setRtuData({
          rtuTrackerObservation: '',
          taskStatus: '',
          remarks: ''
        });
        return;
      }

      // Find Device Status Upload file (main file - same as MY RTU TRACKER)
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
        setRtuData({
          rtuTrackerObservation: '',
          taskStatus: '',
          remarks: ''
        });
        return;
      }

      // Fetch Device Status Upload file data
      const mainFileRes = await fetch(`${API_BASE}/api/uploads/${deviceStatusFile.fileId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const mainFileJson = await mainFileRes.json();

      if (!mainFileJson?.success || !mainFileJson.file) {
        setRtuData({
          rtuTrackerObservation: '',
          taskStatus: '',
          remarks: ''
        });
        return;
      }

      const mainFile = mainFileJson.file;
      let fileRows = Array.isArray(mainFile.rows) ? mainFile.rows : [];
      let hdrs = mainFile.headers && mainFile.headers.length ? mainFile.headers : (fileRows[0] ? Object.keys(fileRows[0]) : []);

      // Find SITE CODE column in main file
      const mainSiteCodeHeader = hdrs.find((h: string) => {
        const n = normalize(h);
        return n === 'site code' || n === 'sitecode' || n === 'site_code';
      });

      if (!mainSiteCodeHeader) {
        setRtuData({
          rtuTrackerObservation: '',
          taskStatus: '',
          remarks: ''
        });
        return;
      }

      // Find RTU Tracker file
      const rtuTrackerFile = (uploadsJson.files || [])
        .filter((f: any) => {
          const uploadType = String(f.uploadType || '').toLowerCase().trim();
          const fileName = String(f.name || '').toLowerCase();
          const isRtuTrackerType = uploadType === 'rtu-tracker';
          const normalizedFileName = fileName.replace(/[-_\s]/g, '');
          const isRtuTrackerFileName = 
            fileName.includes('rtu-tracker') || 
            fileName.includes('rtu_tracker') ||
            fileName.includes('rtu tracker') ||
            fileName.includes('rtutracker') ||
            normalizedFileName.includes('rtutracker') ||
            /rtu.*tracker/i.test(f.name || '');
          
          return isRtuTrackerType || isRtuTrackerFileName;
        })
        .sort((a: any, b: any) => {
          const dateA = a.uploadedAt ? new Date(a.uploadedAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
          const dateB = b.uploadedAt ? new Date(b.uploadedAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
          return dateB - dateA;
        })[0];

      if (!rtuTrackerFile) {
        setRtuData({
          rtuTrackerObservation: '',
          taskStatus: '',
          remarks: ''
        });
        return;
      }

      // Fetch RTU Tracker file data
      const rtuTrackerFileRes = await fetch(`${API_BASE}/api/uploads/${rtuTrackerFile.fileId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const rtuTrackerFileJson = await rtuTrackerFileRes.json();

      if (!rtuTrackerFileJson?.success || !rtuTrackerFileJson.file) {
        setRtuData({
          rtuTrackerObservation: '',
          taskStatus: '',
          remarks: ''
        });
        return;
      }

      const rtuTrackerData = rtuTrackerFileJson.file;
      const rtuTrackerRows = Array.isArray(rtuTrackerData.rows) ? rtuTrackerData.rows : [];
      const rtuTrackerHeaders = rtuTrackerData.headers && rtuTrackerData.headers.length 
        ? rtuTrackerData.headers 
        : (rtuTrackerRows[0] ? Object.keys(rtuTrackerRows[0]) : []);

      const rtuTrackerSiteCodeHeader = rtuTrackerHeaders.find((h: string) => {
        const n = normalize(h);
        return n === 'site code' || n === 'sitecode' || n === 'site_code';
      });

      if (!rtuTrackerSiteCodeHeader) {
        setRtuData({
          rtuTrackerObservation: '',
          taskStatus: '',
          remarks: ''
        });
        return;
      }

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

      // Find date columns in RTU Tracker file
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

      // Find columns to insert from RTU Tracker (after latest date column or after site code)
      let rtuTrackerColumnsToInsert: string[] = [];
      let startIndex = -1;
      if (latestRtuTrackerDateColumnIndex !== -1 && latestRtuTrackerDateColumnIndex + 1 < rtuTrackerHeaders.length) {
        startIndex = latestRtuTrackerDateColumnIndex + 1;
      } else if (rtuTrackerSiteCodeHeader) {
        const siteCodeIndex = rtuTrackerHeaders.indexOf(rtuTrackerSiteCodeHeader);
        if (siteCodeIndex !== -1 && siteCodeIndex + 1 < rtuTrackerHeaders.length) {
          startIndex = siteCodeIndex + 1;
        }
      }

      if (startIndex !== -1 && startIndex < rtuTrackerHeaders.length) {
        for (let i = startIndex; i < rtuTrackerHeaders.length; i++) {
          const header = rtuTrackerHeaders[i];
          const normalizedHeader = normalize(header);
          if (normalizedHeader === 'site code' || normalizedHeader === 'sitecode' || normalizedHeader === 'site_code') {
            continue;
          }
          const isDateColumn = normalizedHeader.includes('date') || normalizedHeader.includes('time');
          if (isDateColumn) {
            continue;
          }
          rtuTrackerColumnsToInsert.push(header);
        }
      }

      // Merge RTU Tracker data into Device Status Upload rows (like MY RTU TRACKER)
      if (rtuTrackerColumnsToInsert.length > 0) {
        let filteredRtuTrackerRows = [...rtuTrackerRows];
        if (latestRtuTrackerDateColumn) {
          filteredRtuTrackerRows = rtuTrackerRows.filter((row: any) => {
            const dateValue = row[latestRtuTrackerDateColumn!];
            return dateValue !== null && dateValue !== undefined && String(dateValue).trim() !== '';
          });
        }

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

        // Merge RTU Tracker columns into Device Status Upload rows
        fileRows = fileRows.map((row: any) => {
          const siteCode = String(row[mainSiteCodeHeader] || '').trim();
          const rtuTrackerRow = rtuTrackerMap.get(siteCode);
          const mergedRow = { ...row };
          rtuTrackerColumnsToInsert.forEach((col: string) => {
            mergedRow[col] = rtuTrackerRow ? (rtuTrackerRow[col] ?? '') : '';
          });
          return mergedRow;
        });
      }

      // Find matching row in merged data
      const matchingRow = fileRows.find((row: any) => {
        const rowSiteCode = String(row[mainSiteCodeHeader] || '').trim();
        return normalize(rowSiteCode) === normalize(siteCodeValue);
      });

      // Find RTU TRACKER OBSERVATION column in merged data
      const allHeaders = [...hdrs, ...rtuTrackerColumnsToInsert];
      const rtuTrackerObservationHeader = allHeaders.find((h: string) => {
        const n = normalize(h);
        return (n.includes('rtu') && n.includes('tracker') && n.includes('observation')) ||
               n === 'rtutrackerobservation' || n === 'rtu_tracker_observation' ||
               n === 'rtu tracker observation' || n === 'rtutrackerobservbation' ||
               n === 'rtu_tracker_observbation' || n === 'rtu tracker observbation';
      });

      const rtuTrackerObservation = matchingRow && rtuTrackerObservationHeader 
        ? String(matchingRow[rtuTrackerObservationHeader] || '').trim() 
        : '';

      // Fetch Task Status and Remarks from localStorage (same as MY RTU TRACKER component)
      let taskStatusFromStorage = '';
      let remarksFromStorage = '';
      
      if (matchingRow) {
        try {
          // Generate rowKey using the same function as MY RTU TRACKER
          const generateRowKey = (fileId: string, row: any, headers: string[]): string => {
            if (row.id) {
              return `${fileId}-${row.id}`;
            }
            if (headers.length >= 3) {
              const keyParts: string[] = [];
              for (let i = 0; i < Math.min(3, headers.length); i++) {
                const header = headers[i];
                const value = row[header] ?? '';
                keyParts.push(String(value));
              }
              if (keyParts.some(v => v)) {
                return `${fileId}-${keyParts.join('|')}`;
              }
            }
            const keyParts: string[] = [];
            for (const header of headers) {
              const value = row[header] ?? '';
              keyParts.push(String(value));
            }
            return `${fileId}-${keyParts.join('|')}`;
          };

          const rowKey = generateRowKey(deviceStatusFile.fileId, matchingRow, hdrs);
          const storageKey = `myRTUTracker_${deviceStatusFile.fileId}`;
          const savedData = localStorage.getItem(storageKey);
          
          if (savedData) {
            const data = JSON.parse(savedData);
            if (data.taskStatus && data.taskStatus[rowKey]) {
              taskStatusFromStorage = data.taskStatus[rowKey];
            }
            if (data.remarks && data.remarks[rowKey]) {
              remarksFromStorage = data.remarks[rowKey];
            }
          }
        } catch (error) {
          console.error('Error loading RTU Tracker data from localStorage:', error);
        }
      }

      setRtuData({
        rtuTrackerObservation: rtuTrackerObservation,
        taskStatus: taskStatusFromStorage,
        remarks: remarksFromStorage
      });
    } catch (error) {
      console.error('Error fetching RTU data:', error);
      setRtuData({
        rtuTrackerObservation: '',
        taskStatus: '',
        remarks: ''
      });
    }
  };

  // Handle site code search
  const handleSiteCodeSearch = async () => {
    if (!siteCode.trim()) {
      setDeviceDataError('Please enter a Site Code');
      return;
    }

    // Set deviceData to empty object immediately so Device Information section shows right away
    setDeviceData({});
    setDeviceDataError(null);
    
    await fetchDeviceData(siteCode.trim());
  };

  // Handle radio button change
  const handleOptionChange = async (option: 'offline' | 'rtu') => {
    setSelectedOption(option);
    if (option === 'offline') {
      await fetchOfflineData(siteCode.trim());
    } else if (option === 'rtu') {
      await fetchRTUData(siteCode.trim());
    }
  };

  // Close dialog and reset
  const closeDialog = () => {
    setShowCheckDeviceDialog(false);
    setSiteCode('');
    setSelectedOption('');
    setDeviceData(null);
    setOfflineData(null);
    setRtuData(null);
    setDeviceDataError(null);
    setShowSiteCodeSuggestions(false);
    setSelectedSuggestionIndex(-1);
  };

  // Close My Sites dialog
  const closeMySitesDialog = () => {
    setShowMySitesDialog(false);
    setApplication('');
    setDivision('');
    setSubDivision('');
    setTableRows([]);
    setSiteCodesForSubDivision([]);
    setShowSubDivisionSuggestions(false);
    setSelectedSubDivisionIndex(-1);
    setSubDivisionSuggestions([]);
  };

  // Fetch site codes for Sub Division from MY OFFLINE SITES data (Equipment role)
  // This replicates the exact filtering logic from MY OFFLINE SITES tab
  const fetchSiteCodesForSubDivision = useCallback(async (subDivisionValue: string, divisionValue?: string) => {
    if (!subDivisionValue.trim()) {
      setSiteCodesForSubDivision([]);
      return;
    }

    // If division is provided, use it; otherwise try to get from state
    const selectedDivision = divisionValue || division;

    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      // Get user data to access divisions
      const storedUser = localStorage.getItem('user');
      const user = storedUser ? JSON.parse(storedUser) : null;
      const userRole = user?.role || '';
      const userDivisions = user?.division || [];

      // Only proceed if Equipment role
      if (userRole !== 'Equipment') {
        console.log('fetchSiteCodesForSubDivision: Not Equipment role, skipping');
        return;
      }

      const uploadsRes = await fetch(`${API_BASE}/api/uploads`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const uploadsJson = await uploadsRes.json();
      
      if (!uploadsJson?.success) return;

      // Find Device Status Upload file (same as MY OFFLINE SITES)
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

      if (!deviceStatusFile) return;

      const fileRes = await fetch(`${API_BASE}/api/uploads/${deviceStatusFile.fileId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const fileJson = await fileRes.json();

      if (!fileJson?.success || !fileJson.file) return;

      const file = fileJson.file;
      let rows = Array.isArray(file.rows) ? file.rows : [];
      const headers = file.headers && file.headers.length ? file.headers : (rows[0] ? Object.keys(rows[0]) : []);

      // Find Site Code header in main file
      const mainSiteCodeHeader = headers.find((h: string) => {
        const n = normalize(h);
        return n === 'site code' || n === 'sitecode' || n === 'site_code';
      });

      // Merge with ONLINE-OFFLINE DATA file (same as MY OFFLINE SITES)
      let mergedDeviceStatusColumn = '';
      let mergedNoOfDaysOfflineColumn = '';
      
      try {
        // Find ONLINE-OFFLINE DATA file
        const onlineOfflineFiles = (uploadsJson.files || [])
          .filter((f: any) => {
            const uploadType = String(f.uploadType || '').toLowerCase().trim();
            const fileName = String(f.name || '').toLowerCase();
            const isOnlineOfflineType = uploadType === 'online-offline-data';
            const isOnlineOfflineFileName = fileName.includes('online-offline') || 
                                           fileName.includes('online_offline') ||
                                           fileName.includes('onlineoffline');
            return isOnlineOfflineType || isOnlineOfflineFileName;
          })
          .sort((a: any, b: any) => {
            const dateA = a.uploadedAt ? new Date(a.uploadedAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
            const dateB = b.uploadedAt ? new Date(b.uploadedAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
            return dateB - dateA;
          });

        if (onlineOfflineFiles.length > 0 && mainSiteCodeHeader) {
          const latestOnlineOfflineFile = onlineOfflineFiles[0];
          const onlineOfflineDataRes = await fetch(`${API_BASE}/api/uploads/${latestOnlineOfflineFile.fileId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const onlineOfflineDataJson = await onlineOfflineDataRes.json();

          if (onlineOfflineDataJson?.success && onlineOfflineDataJson.file) {
            const onlineOfflineData = onlineOfflineDataJson.file;
            const onlineOfflineRows = Array.isArray(onlineOfflineData.rows) ? onlineOfflineData.rows : [];
            const onlineOfflineHeaders = onlineOfflineData.headers && onlineOfflineData.headers.length 
              ? onlineOfflineData.headers 
              : (onlineOfflineRows[0] ? Object.keys(onlineOfflineRows[0]) : []);

            const onlineOfflineSiteCodeHeader = onlineOfflineHeaders.find((h: string) => {
              const n = normalize(h);
              return n === 'site code' || n === 'sitecode' || n === 'site_code';
            });

            const deviceStatusHeader = onlineOfflineHeaders.find((h: string) => {
              const n = normalize(h);
              return n === 'device status' ||
                     n === 'device_status' ||
                     n === 'devicestatus' ||
                     (n.includes('device') && n.includes('status'));
            });

            const noOfDaysOfflineHeader = onlineOfflineHeaders.find((h: string) => {
              const n = normalize(h);
              return n === 'no of days offline' ||
                     n === 'no_of_days_offline' ||
                     n === 'noofdaysoffline' ||
                     (n.includes('days') && n.includes('offline')) ||
                     (n.includes('day') && n.includes('offline'));
            });

            if (deviceStatusHeader) mergedDeviceStatusColumn = deviceStatusHeader;
            if (noOfDaysOfflineHeader) mergedNoOfDaysOfflineColumn = noOfDaysOfflineHeader;

            if (mainSiteCodeHeader && onlineOfflineSiteCodeHeader && (deviceStatusHeader || noOfDaysOfflineHeader)) {
              // Create map of ONLINE-OFFLINE data by SITE CODE
              const onlineOfflineMap = new Map<string, any>();
              onlineOfflineRows.forEach((row: any) => {
                const siteCode = String(row[onlineOfflineSiteCodeHeader] || '').trim();
                if (siteCode) {
                  if (!onlineOfflineMap.has(siteCode)) {
                    onlineOfflineMap.set(siteCode, row);
                  }
                }
              });

              // Merge data into main rows
              rows = rows.map((row: any) => {
                const siteCode = String(row[mainSiteCodeHeader] || '').trim();
                const onlineOfflineRow = onlineOfflineMap.get(siteCode);
                const mergedRow = { ...row };
                
                if (onlineOfflineRow) {
                  if (deviceStatusHeader) mergedRow[deviceStatusHeader] = onlineOfflineRow[deviceStatusHeader] ?? '';
                  if (noOfDaysOfflineHeader) mergedRow[noOfDaysOfflineHeader] = onlineOfflineRow[noOfDaysOfflineHeader] ?? '';
                } else {
                  if (deviceStatusHeader) mergedRow[deviceStatusHeader] = '';
                  if (noOfDaysOfflineHeader) mergedRow[noOfDaysOfflineHeader] = '';
                }
                
                return mergedRow;
              });
            }
          }
        }
      } catch (error) {
        console.error('Error merging ONLINE-OFFLINE data:', error);
        // Continue with main file data even if merge fails
      }

      // Find headers after merge
      const divisionHeader = headers.find((h: string) => {
        const n = normalize(h);
        return n === 'division';
      });
      const subDivisionHeader = headers.find((h: string) => {
        const n = normalize(h);
        return n === 'sub division' || n === 'subdivision' || n === 'sub_division';
      });
      const siteCodeHeader = headers.find((h: string) => {
        const n = normalize(h);
        return n === 'site code' || n === 'sitecode' || n === 'site_code';
      });
      
      // Use merged columns for filtering
      const deviceStatusHeader = mergedDeviceStatusColumn || headers.find((h: string) => {
        const n = normalize(h);
        return n === 'device status' || n === 'devicestatus' || n === 'device_status';
      });
      const noOfDaysOfflineHeader = mergedNoOfDaysOfflineColumn || headers.find((h: string) => {
        const n = normalize(h);
        return n === 'no of days offline' ||
               n === 'no_of_days_offline' ||
               n === 'noofdaysoffline' ||
               (n.includes('days') && n.includes('offline')) ||
               (n.includes('day') && n.includes('offline'));
      });

      if (!subDivisionHeader || !siteCodeHeader) return;

      // Apply MY OFFLINE SITES filters: Filter by selected DIVISION (if provided) or user's assigned DIVISION
      if (divisionHeader) {
        if (selectedDivision && selectedDivision.trim()) {
          // Filter by selected division from dropdown
          rows = rows.filter((row: any) => {
            const rowDivision = String(row[divisionHeader] || '').trim();
            const selectedDiv = normalize(String(selectedDivision));
            const dataDiv = normalize(rowDivision);
            return selectedDiv === dataDiv;
          });
        } else if (userDivisions.length > 0) {
          // Fallback to user's assigned divisions if no division selected
          rows = rows.filter((row: any) => {
            const rowDivision = String(row[divisionHeader] || '').trim();
            const matches = userDivisions.some((div: string) => {
              const userDiv = normalize(String(div));
              const dataDiv = normalize(rowDivision);
              
              if (userDiv === dataDiv) {
                return true;
              }
              
              const lengthDiff = Math.abs(userDiv.length - dataDiv.length);
              if (lengthDiff <= 1 && (userDiv.includes(dataDiv) || dataDiv.includes(userDiv))) {
                return true;
              }
              
              return false;
            });
            return matches;
          });
        }
      }

      // Apply MY OFFLINE SITES filters: DEVICE STATUS = "OFFLINE"
      if (deviceStatusHeader) {
        rows = rows.filter((row: any) => {
          const deviceStatus = String(row[deviceStatusHeader] || '').trim();
          const normalizedStatus = normalize(deviceStatus);
          return normalizedStatus === 'offline';
        });
      }

      // Apply MY OFFLINE SITES filters: NO OF DAYS OFFLINE >= 2
      if (noOfDaysOfflineHeader) {
        rows = rows.filter((row: any) => {
          const daysValue = row[noOfDaysOfflineHeader];
          let days = 0;
          if (typeof daysValue === 'number') {
            days = daysValue;
          } else if (typeof daysValue === 'string') {
            const cleaned = daysValue.trim().replace(/[^\d.]/g, '');
            days = parseFloat(cleaned) || 0;
          }
          return days >= 2;
        });
      }

      // Apply MY OFFLINE SITES filters: ATTRIBUTE = "IN PRODUCTION" (added yesterday)
      const attributeHeader = headers.find((h: string) => {
        const n = normalize(h);
        return n === 'attribute' || n === 'attributes';
      });
      
      if (attributeHeader) {
        const beforeAttributeCount = rows.length;
        rows = rows.filter((row: any) => {
          const attribute = String(row[attributeHeader] || '').trim();
          // Normalize to handle variations: IN PRODUCTION, in production, In Production, etc.
          const normalizedAttribute = normalize(attribute);
          const isInProduction = normalizedAttribute === 'inproduction' || normalizedAttribute === 'in production';
          return isInProduction;
        });
        console.log(`Dashboard - Site Code Dropdown - ATTRIBUTE filter: ${beforeAttributeCount} rows -> ${rows.length} rows (filtering for ATTRIBUTE = "IN PRODUCTION")`);
      } else {
        console.warn('Dashboard - Site Code Dropdown - "ATTRIBUTE" column not found in data headers');
      }

      // Filter by Sub Division and extract unique Site Codes
      const siteCodesSet = new Set<string>();
      rows.forEach((row: any) => {
        const rowSubDivision = String(row[subDivisionHeader] || '').trim();
        if (normalize(rowSubDivision) === normalize(subDivisionValue)) {
          const sc = String(row[siteCodeHeader] || '').trim();
          if (sc) {
            siteCodesSet.add(sc);
          }
        }
      });

      setSiteCodesForSubDivision(Array.from(siteCodesSet).sort());
    } catch (error) {
      console.error('Error fetching site codes for Sub Division from MY OFFLINE SITES:', error);
    }
  }, [division]);

  // Fetch NO OF DAYS OFFLINE for a site code from MY OFFLINE SITES
  const fetchNoOfDaysOffline = useCallback(async (siteCodeValue: string): Promise<string> => {
    if (!siteCodeValue.trim()) return '';

    try {
      const token = localStorage.getItem('token');
      if (!token) return '';

      const uploadsRes = await fetch(`${API_BASE}/api/uploads`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const uploadsJson = await uploadsRes.json();
      
      if (!uploadsJson?.success) return '';

      // Find Online-Offline file
      const onlineOfflineFile = (uploadsJson.files || [])
        .filter((f: any) => {
          const uploadType = String(f.uploadType || '').toLowerCase().trim();
          const fileName = String(f.name || '').toLowerCase();
          const isOnlineOfflineType = uploadType === 'online-offline-data';
          const isOnlineOfflineFileName = fileName.includes('online-offline') || 
                                         fileName.includes('online_offline') ||
                                         fileName.includes('onlineoffline');
          return isOnlineOfflineType || isOnlineOfflineFileName;
        })
        .sort((a: any, b: any) => {
          const dateA = a.uploadedAt ? new Date(a.uploadedAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
          const dateB = b.uploadedAt ? new Date(b.uploadedAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
          return dateB - dateA;
        })[0];

      if (!onlineOfflineFile) return '';

      const fileRes = await fetch(`${API_BASE}/api/uploads/${onlineOfflineFile.fileId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const fileJson = await fileRes.json();

      if (!fileJson?.success || !fileJson.file) return '';

      const file = fileJson.file;
      const rows = Array.isArray(file.rows) ? file.rows : [];
      const headers = file.headers && file.headers.length ? file.headers : (rows[0] ? Object.keys(rows[0]) : []);

      const siteCodeHeader = headers.find((h: string) => {
        const n = normalize(h);
        return n === 'site code' || n === 'sitecode' || n === 'site_code';
      });

      const noOfDaysOfflineHeader = headers.find((h: string) => {
        const n = normalize(h);
        return n === 'no of days offline' ||
               n === 'no_of_days_offline' ||
               n === 'noofdaysoffline' ||
               (n.includes('days') && n.includes('offline')) ||
               (n.includes('day') && n.includes('offline'));
      });

      if (!siteCodeHeader || !noOfDaysOfflineHeader) return '';

      const matchingRow = rows.find((row: any) => {
        const rowSiteCode = String(row[siteCodeHeader] || '').trim();
        return normalize(rowSiteCode) === normalize(siteCodeValue);
      });

      if (matchingRow && matchingRow[noOfDaysOfflineHeader]) {
        return String(matchingRow[noOfDaysOfflineHeader] || '').trim();
      }

      return '';
    } catch (error) {
      console.error('Error fetching NO OF DAYS OFFLINE:', error);
      return '';
    }
  }, []);

  // Add new row to table
  const addTableRow = () => {
    const newRow = {
      id: `row-${Date.now()}-${Math.random()}`,
      siteCode: '',
      noOfDaysOffline: '',
      mapSelected: false,
      siteObservation: ''
    };
    setTableRows([...tableRows, newRow]);
  };

  // Reset all table rows to initial state
  const resetTableRows = () => {
    setTableRows([]);
  };

  // Navigate to selected locations in Google Maps
  const navigateToLocations = async () => {
    // Get all rows with mapSelected = true
    const selectedRows = tableRows.filter(row => row.mapSelected && row.siteCode);
    
    if (selectedRows.length === 0) {
      alert('Please select at least one location by clicking the Map radio button.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Authentication required. Please login again.');
        return;
      }

      const locationCoordinates: Array<{lat: number; lng: number; name: string}> = [];
      const siteCodes = selectedRows.map(row => row.siteCode);

      console.log(`Looking for ${siteCodes.length} site codes in Location database:`, siteCodes);

      // First, try to fetch from Location model (which has coordinates directly)
      try {
        const locationsRes = await fetch(`${API_BASE}/api/locations/by-site-codes`, {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ siteCodes })
        });

        if (locationsRes.ok) {
          const locationsJson = await locationsRes.json();
          if (locationsJson?.success && Array.isArray(locationsJson.locations)) {
            console.log(`Found ${locationsJson.locations.length} locations in database for ${siteCodes.length} site codes`);
            
            // Match site codes with locations
            selectedRows.forEach(row => {
              const rowSiteCode = normalize(row.siteCode);
              console.log(`Matching site code: "${row.siteCode}" (normalized: "${rowSiteCode}")`);
              
              const location = locationsJson.locations.find((loc: any) => {
                const locName = normalize(String(loc.name || ''));
                const match = locName === rowSiteCode;
                if (!match) {
                  console.log(`  - Checking against: "${loc.name}" (normalized: "${locName}") - No match`);
                }
                return match;
              });
              
              if (location && location.latitude && location.longitude) {
                console.log(`✓ Found location for ${row.siteCode}: lat=${location.latitude}, lng=${location.longitude}`);
                locationCoordinates.push({
                  lat: location.latitude,
                  lng: location.longitude,
                  name: row.siteCode
                });
              } else {
                console.warn(`✗ Location not found in database for site code: ${row.siteCode}`);
                console.warn(`  Available location names in database:`, locationsJson.locations.map((l: any) => l.name));
              }
            });
          }
        } else {
          console.warn(`Failed to fetch locations from database: ${locationsRes.status}`);
          const errorText = await locationsRes.text().catch(() => '');
          console.warn('Error response:', errorText);
        }
      } catch (error) {
        console.error('Error fetching locations from database:', error);
      }

      // If we didn't find all locations in database, try KML files as fallback
      if (locationCoordinates.length < selectedRows.length) {
        console.log(`Only found ${locationCoordinates.length} of ${selectedRows.length} locations in database. Trying KML files...`);
        
        const missingRows = selectedRows.filter(row => 
          !locationCoordinates.find(loc => normalize(loc.name) === normalize(row.siteCode))
        );
        
        // Group rows by KML file path to avoid fetching the same file multiple times
        const kmlFileMap = new Map<string, Array<{row: typeof selectedRows[0], siteCode: string}>>();
        
        missingRows.forEach(row => {
          if (row.kmlFilePath) {
            if (!kmlFileMap.has(row.kmlFilePath)) {
              kmlFileMap.set(row.kmlFilePath, []);
            }
            kmlFileMap.get(row.kmlFilePath)!.push({ row, siteCode: row.siteCode });
          }
        });
        
        if (kmlFileMap.size > 0) {
          console.log(`Processing ${kmlFileMap.size} unique KML file(s) for ${missingRows.length} missing site code(s)`);

          // Process each unique KML file
          for (const [kmlFilePath, rowsForFile] of kmlFileMap.entries()) {
            try {
              console.log(`Fetching KML file from: ${kmlFilePath}`);
              // Fetch KML file from server
              // kmlFilePath is stored as API endpoint like /api/admin/uploads/files/{fieldId}
              const kmlFileUrl = `${API_BASE}${kmlFilePath.startsWith('/') ? kmlFilePath : '/' + kmlFilePath}`;
              console.log(`Full KML URL: ${kmlFileUrl}`);
              
              const kmlRes = await fetch(kmlFileUrl, {
                headers: { 'Authorization': `Bearer ${token}` }
              });
              
              console.log(`KML fetch response status: ${kmlRes.status} ${kmlRes.statusText}`);

              if (kmlRes.ok) {
                const kmlText = await kmlRes.text();
                console.log('KML file fetched, length:', kmlText.length);
                
                // Parse KML to extract coordinates
                // KML format: <Placemark><name>Site Code</name><description>HRN</description><coordinates>longitude,latitude,altitude</coordinates></Placemark>
                const parser = new DOMParser();
                const kmlDoc = parser.parseFromString(kmlText, 'text/xml');
                
                // Check for parsing errors
                const parseError = kmlDoc.querySelector('parsererror');
                if (parseError) {
                  console.error('KML parsing error:', parseError.textContent);
                  // Try alternative: might be plain text or different format
                }
                
                // Find all Placemark elements (each represents a location)
                const placemarks = kmlDoc.getElementsByTagName('Placemark');
                console.log(`Found ${placemarks.length} Placemark elements in KML file`);
                
                // Create a map of site codes to coordinates from KML
                const kmlLocationMap = new Map<string, {lat: number; lng: number; hrn?: string}>();
                
                // Helper function to extract Site Code and HRN from description HTML
                const extractSiteCodeFromDescription = (description: string): { siteCode: string; hrn: string } => {
                  let siteCode = '';
                  let hrn = '';
                  
                  if (!description) return { siteCode, hrn };
                  
                  try {
                    // Decode CDATA if present (Earth Point format)
                    let decodedDescription = description;
                    if (description.includes('&lt;![CDATA[')) {
                      // Extract CDATA content
                      const cdataMatch = description.match(/&lt;!\[CDATA\[(.*?)\]\]&gt;/s);
                      if (cdataMatch) {
                        decodedDescription = cdataMatch[1];
                      }
                    }
                    
                    // Parse HTML table to extract Site Code and HRN
                    // Earth Point format: <table><tr><td><b>Site Code</b></td><td>3W1575</td></tr>...
                    // Try multiple patterns to handle different HTML formatting
                    const siteCodePatterns = [
                      /<b>Site\s+Code<\/b><\/td>\s*<td[^>]*>([^<]+)<\/td>/i,
                      /Site\s+Code[^<]*<\/td>\s*<td[^>]*>([^<]+)<\/td>/i,
                      /Site\s+Code[^>]*>([^<]+)</i
                    ];
                    
                    for (const pattern of siteCodePatterns) {
                      const match = decodedDescription.match(pattern);
                      if (match && match[1]) {
                        siteCode = match[1].trim();
                        break;
                      }
                    }
                    
                    const hrnPatterns = [
                      /<b>HRN<\/b><\/td>\s*<td[^>]*>([^<]+)<\/td>/i,
                      /HRN[^<]*<\/td>\s*<td[^>]*>([^<]+)<\/td>/i,
                      /HRN[^>]*>([^<]+)</i
                    ];
                    
                    for (const pattern of hrnPatterns) {
                      const match = decodedDescription.match(pattern);
                      if (match && match[1]) {
                        hrn = match[1].trim();
                        break;
                      }
                    }
                  } catch (error) {
                    console.warn(`Error parsing description HTML:`, error);
                  }
                  
                  return { siteCode, hrn };
                };
                
                for (let i = 0; i < placemarks.length; i++) {
                  const placemark = placemarks[i];
                  
                  // Extract name - try different methods
                  let nameElement: Element | null = placemark.getElementsByTagName('name')[0];
                  // Also try with namespace
                  if (!nameElement) {
                    nameElement = placemark.querySelector('name') || placemark.querySelector('*|name');
                  }
                  const name = nameElement?.textContent?.trim() || '';
                  
                  // Extract description - try different methods
                  let descriptionElement: Element | null = placemark.getElementsByTagName('description')[0];
                  if (!descriptionElement) {
                    descriptionElement = placemark.querySelector('description') || placemark.querySelector('*|description');
                  }
                  const description = descriptionElement?.textContent?.trim() || '';
                  
                  // Extract Site Code and HRN from description (Earth Point format)
                  const { siteCode: extractedSiteCode, hrn: extractedHRN } = extractSiteCodeFromDescription(description);
                  
                  // Use extracted Site Code if available, otherwise fall back to name
                  const siteCode = extractedSiteCode || name;
                  const hrn = extractedHRN || '';
                  
                  // Extract coordinates - try different methods
                  let coordinatesElement = placemark.getElementsByTagName('coordinates')[0];
                  
                  // If not found directly, try to find in Point > coordinates
                  if (!coordinatesElement) {
                    const pointElement = placemark.getElementsByTagName('Point')[0] || placemark.querySelector('Point') || placemark.querySelector('*|Point');
                    if (pointElement) {
                      coordinatesElement = pointElement.getElementsByTagName('coordinates')[0] || pointElement.querySelector('coordinates') || pointElement.querySelector('*|coordinates');
                    }
                  }
                  
                  const coordText = coordinatesElement?.textContent?.trim() || coordinatesElement?.textContent?.trim() || '';
                  
                  if (siteCode) {
                    console.log(`Processing Placemark ${i}: siteCode="${siteCode}", hrn="${hrn}", coordinates="${coordText ? coordText.substring(0, 50) + '...' : 'N/A'}"`);
                  } else {
                    console.warn(`Placemark ${i} has no site code (name="${name}")`);
                  }
                  
                  if (siteCode && coordText) {
                    // Parse: longitude,latitude,altitude (altitude is optional)
                    // Handle multiple coordinates (space-separated) - take the first one
                    const firstCoord = coordText.split(/\s+/)[0];
                    const parts = firstCoord.split(',');
                    if (parts.length >= 2) {
                      const lng = parseFloat(parts[0].trim());
                      const lat = parseFloat(parts[1].trim());
                      
                      if (!isNaN(lat) && !isNaN(lng)) {
                        // Store by normalized site code for matching
                        const normalizedSiteCode = normalize(siteCode);
                        kmlLocationMap.set(normalizedSiteCode, {
                          lat,
                          lng,
                          hrn: hrn || undefined
                        });
                        console.log(`Stored location: ${siteCode} (normalized: ${normalizedSiteCode}) -> lat: ${lat}, lng: ${lng}`);
                      } else {
                        console.warn(`Invalid coordinates for ${siteCode}: lat=${lat}, lng=${lng}`);
                      }
                    } else {
                      console.warn(`Invalid coordinate format for ${siteCode}: ${coordText}`);
                    }
                  } else {
                    if (!siteCode) {
                      console.warn(`Placemark ${i} has no site code (name="${name}")`);
                    }
                    if (!coordText) {
                      console.warn(`Placemark ${i} (siteCode: ${siteCode}) has no coordinates`);
                    }
                  }
                }
                
                console.log(`KML Location Map size: ${kmlLocationMap.size}`);
                console.log('KML Location Map keys:', Array.from(kmlLocationMap.keys()));
                
                // Match rows with KML locations by site code (name in KML)
                rowsForFile.forEach(({ siteCode }) => {
                  const normalizedSiteCode = normalize(siteCode);
                  console.log(`Looking for site code: ${siteCode} (normalized: ${normalizedSiteCode})`);
                  
                  const location = kmlLocationMap.get(normalizedSiteCode);
                  
                  if (location) {
                    console.log(`Found match for ${siteCode}: lat=${location.lat}, lng=${location.lng}`);
                    locationCoordinates.push({
                      lat: location.lat,
                      lng: location.lng,
                      name: siteCode
                    });
                  } else {
                    console.warn(`Site code ${siteCode} (normalized: ${normalizedSiteCode}) not found in KML file`);
                    console.warn('Available keys in KML:', Array.from(kmlLocationMap.keys()));
                  }
                });
              } else {
                console.error(`Failed to fetch KML file: ${kmlRes.status} ${kmlRes.statusText}`);
                const errorText = await kmlRes.text().catch(() => '');
                console.error('Error response:', errorText);
              }
            } catch (error) {
              console.error(`Error parsing KML file ${kmlFilePath}:`, error);
            }
          }
        }
      }

      if (locationCoordinates.length === 0) {
        const selectedSiteCodes = selectedRows.map(r => r.siteCode).join(', ');
        alert(`No location coordinates found in KML files for site codes: ${selectedSiteCodes}.\n\nPlease check:\n1. KML files are uploaded in Admin panel\n2. Site codes in KML file match exactly (case-sensitive)\n3. KML file structure is correct (Placemark > name = Site Code)\n\nCheck browser console for detailed logs.`);
        return;
      }
      
      // Log warning if some site codes were not found
      if (locationCoordinates.length < selectedRows.length) {
        const missingSiteCodes = selectedRows
          .filter(r => !locationCoordinates.find(loc => normalize(loc.name) === normalize(r.siteCode)))
          .map(r => r.siteCode)
          .join(', ');
        console.warn(`Some site codes not found: ${missingSiteCodes}`);
        alert(`Warning: Some site codes were not found: ${missingSiteCodes}\n\nOnly ${locationCoordinates.length} of ${selectedRows.length} locations will be shown in Google Earth.\n\nCheck browser console for details.`);
      }

      // Log all locations that will be included in KML
      console.log(`=== Locations to include in KML (${locationCoordinates.length} total) ===`);
      locationCoordinates.forEach((loc, index) => {
        console.log(`${index + 1}. ${loc.name} - Lat: ${loc.lat}, Lng: ${loc.lng}`);
      });
      console.log('=== End of locations list ===');

      // Generate KML file content with timestamp to ensure freshness
      const generateKML = (locations: Array<{lat: number; lng: number; name: string}>) => {
        const timestamp = new Date().toISOString();
        const kmlHeader = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Locations - ${timestamp}</name>
    <description>Generated on ${new Date().toLocaleString()}</description>
`;

        const placemarks = locations.map((loc, index) => {
          const name = (loc.name || 'Location').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          return `    <Placemark>
      <name>${name}</name>
      <description>Site Code: ${name}</description>
      <Point>
        <coordinates>${loc.lng},${loc.lat},0</coordinates>
      </Point>
      <styleUrl>#placemark-${index}</styleUrl>
    </Placemark>`;
        }).join('\n');

        // Add styles for better visibility
        const styles = `
    <Style id="placemark-default">
      <IconStyle>
        <scale>1.2</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href>
        </Icon>
      </IconStyle>
      <LabelStyle>
        <scale>1.0</scale>
      </LabelStyle>
    </Style>`;

        const kmlFooter = `  </Document>
</kml>`;

        return kmlHeader + styles + placemarks + '\n' + kmlFooter;
      };

      const kmlContent = generateKML(locationCoordinates);
      
      // Log the generated KML content for debugging
      console.log('=== Generated KML Content ===');
      console.log('KML length:', kmlContent.length);
      console.log('Number of placemarks:', locationCoordinates.length);
      // Log first 500 characters of KML to verify structure
      console.log('KML preview (first 500 chars):', kmlContent.substring(0, 500));
      console.log('=== End of KML Content ===');
      
      // Verify all selected site codes are in the KML
      const siteCodesInKML = locationCoordinates.map(loc => loc.name);
      const missingInKML = selectedRows
        .map(r => r.siteCode)
        .filter(code => !siteCodesInKML.includes(code));
      
      if (missingInKML.length > 0) {
        console.error(`Site codes selected but NOT in KML: ${missingInKML.join(', ')}`);
        alert(`Warning: The following site codes were selected but not included in the KML:\n${missingInKML.join(', ')}\n\nThis may be because:\n1. They were not found in the database\n2. They don't have valid coordinates\n3. There was a matching issue\n\nCheck browser console for detailed logs.`);
      }
      
      // Upload KML to server to get a URL that can be loaded in Google Earth Web
      let serverKmlUrl: string | null = null;
      try {
        const formData = new FormData();
        const blob = new Blob([kmlContent], { type: 'application/vnd.google-earth.kml+xml' });
        const fileName = `navigate-${Date.now()}.kml`;
        formData.append('file', blob, fileName);
        
        const uploadRes = await fetch(`${API_BASE}/api/locations/temp-kml`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });
        
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          serverKmlUrl = uploadData.kmlUrl || uploadData.url;
        }
      } catch (uploadError) {
        console.warn('Failed to upload KML to server:', uploadError);
      }
      
      // Open Google Earth Web and automatically download KML file for drag-and-drop
      if (serverKmlUrl) {
        // Calculate center point for multiple locations
        let centerLat = 0;
        let centerLng = 0;
        if (locationCoordinates.length > 0) {
          const sumLat = locationCoordinates.reduce((sum, loc) => sum + loc.lat, 0);
          const sumLng = locationCoordinates.reduce((sum, loc) => sum + loc.lng, 0);
          centerLat = sumLat / locationCoordinates.length;
          centerLng = sumLng / locationCoordinates.length;
        }
        
        // Open Google Earth Web at the center of all locations
        const earthWebUrl = locationCoordinates.length === 1
          ? `https://earth.google.com/web/@${locationCoordinates[0].lat},${locationCoordinates[0].lng},0a,35y,0h,0t,0r`
          : `https://earth.google.com/web/@${centerLat},${centerLng},0a,35y,0h,0t,0r`;
        
        window.open(earthWebUrl, '_blank');
        
        // Automatically download the KML file so user can drag and drop it into Google Earth Web
        setTimeout(() => {
          // Create a download link for the KML file with unique name to avoid caching
          const timestamp = Date.now();
          const downloadLink = document.createElement('a');
          downloadLink.href = serverKmlUrl + '?t=' + timestamp; // Add timestamp to prevent caching
          downloadLink.download = `locations-${timestamp}.kml`;
          downloadLink.style.display = 'none';
          document.body.appendChild(downloadLink);
          downloadLink.click();
          
          setTimeout(() => {
            document.body.removeChild(downloadLink);
          }, 100);
          
          // Show helpful instructions
          const locationList = locationCoordinates.map(loc => `  - ${loc.name}`).join('\n');
          alert(`Google Earth Web opened and KML file downloaded!\n\nLocations included (${locationCoordinates.length} total):\n${locationList}\n\nTo view in Google Earth Web:\n\nMethod 1 (Easiest):\n1. Find the downloaded KML file in your Downloads folder\n2. Drag and drop it into the Google Earth Web window\n\nMethod 2:\n1. In Google Earth Web, click menu (☰) → "Projects" → "New project" → "Import KML file from Drive"\n2. Upload the downloaded KML file\n\nIf using Google Earth Pro desktop:\n1. File → Open → Select the downloaded KML file\n2. Or drag and drop the KML file into Google Earth Pro\n3. If it doesn't update, close and reopen Google Earth Pro`);
        }, 1000);
      } else {
        // If upload failed, open Google Earth Web and provide instructions
        if (locationCoordinates.length === 1) {
          const loc = locationCoordinates[0];
          window.open(`https://earth.google.com/web/@${loc.lat},${loc.lng},0a,35y,0h,0t,0r`, '_blank');
        } else {
          window.open('https://earth.google.com/web', '_blank');
        }
        
        // Download KML file as fallback
        const blob = new Blob([kmlContent], { type: 'application/vnd.google-earth.kml+xml' });
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `locations-${Date.now()}.kml`;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(blobUrl);
        }, 100);
        
        alert(`Google Earth Web opened.\n\nTo load the KML file:\n1. In Google Earth Web, click the menu (☰) → "Projects" → "New project" → "Import KML file from Drive"\n2. Or drag and drop the downloaded KML file into Google Earth Web\n\nKML file has been downloaded to your Downloads folder.`);
      }
    } catch (error) {
      console.error('Error navigating to locations:', error);
      alert('Error navigating to locations. Please try again.');
    }
  };

  // Update table row
  const updateTableRow = (rowId: string, field: string, value: any) => {
    setTableRows(rows => rows.map(row => 
      row.id === rowId ? { ...row, [field]: value } : row
    ));
  };

  // Handle site code change in table
  const handleTableSiteCodeChange = async (rowId: string, siteCodeValue: string) => {
    // Check if this site code is already selected in another row
    if (siteCodeValue && siteCodeValue.trim() !== '') {
      // Normalize for case-insensitive comparison (handle spaces, underscores, dashes)
      const normalizeSiteCode = (str: string) => String(str || '').trim().toLowerCase().replace(/[_\s-]/g, '');
      const normalizedNewValue = normalizeSiteCode(siteCodeValue);
      
      const duplicateRow = tableRows.find(row => {
        if (row.id === rowId) return false; // Skip current row
        if (!row.siteCode || row.siteCode.trim() === '') return false; // Skip empty site codes
        return normalizeSiteCode(row.siteCode) === normalizedNewValue;
      });
      
      if (duplicateRow) {
        // Show fancy error message
        alert(`⚠️ Site Code Already Selected!\n\n"${siteCodeValue}" has already been selected in another row.\n\nPlease choose a different site code.`);
        // Reset the dropdown to empty
        updateTableRow(rowId, 'siteCode', '');
        return;
      }
    }
    
    updateTableRow(rowId, 'siteCode', siteCodeValue);
    if (siteCodeValue.trim()) {
      const noOfDays = await fetchNoOfDaysOffline(siteCodeValue);
      updateTableRow(rowId, 'noOfDaysOffline', noOfDays);
    } else {
      updateTableRow(rowId, 'noOfDaysOffline', '');
    }
  };

  // Open site observation dialog (for both Pending and Resolved)
  const openSiteObservationDialog = (rowId: string, status: 'Pending' | 'Resolved') => {
    const row = tableRows.find(r => r.id === rowId);
    if (row) {
      setSelectedRowForObservation(rowId);
      setSiteObservationStatus(status.toLowerCase() as 'pending' | 'resolved');
      // Reset dialog data
      setSiteObservationsDialogData({
        remarks: '',
        typeOfIssue: '',
        specifyOther: '',
        typeOfSpare: [],
        specifySpareOther: '',
        capturedPhotos: [],
        uploadedPhotos: []
      });
      setIsTypeOfSpareDropdownOpen(false);
      setShowSiteObservationDialog(true);
    }
  };

  // Close site observation dialog
  const closeSiteObservationDialog = () => {
    // Stop camera if active
    if (siteObservationsCameraStreamRef.current) {
      siteObservationsCameraStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      siteObservationsCameraStreamRef.current = null;
    }
    setShowSiteObservationDialog(false);
    setShowSiteObservationsCameraPreview(false);
    setSiteObservationsCameraStream(null);
    setSiteObservationsCapturedImageData(null);
    setSelectedRowForObservation(null);
    setSiteObservationStatus('');
    setIsTypeOfSpareDropdownOpen(false);
    setSiteObservationsDialogData({
      remarks: '',
      typeOfIssue: '',
      specifyOther: '',
      typeOfSpare: [],
      specifySpareOther: '',
      capturedPhotos: [],
      uploadedPhotos: []
    });
  };

  // Helper function to save Pending data to EquipmentOfflineSites database
  const savePendingDataToDatabase = async (
    fileId: string,
    rowKey: string,
    row: any,
    matchingRow: any,
    headers: string[],
    dialogData: any,
    routingType: string,
    taskStatus: string,
    token: string,
    viewPhotos?: string[],
    photoMetadata?: Array<{ latitude?: number; longitude?: number; timestamp?: string; location?: string }>
  ) => {
    try {
      // Validate that we have the required data
      if (!dialogData) {
        console.error('[Dashboard] savePendingDataToDatabase: dialogData is null/undefined');
        return;
      }
      
      // Format Type of Issue (same as MY OFFLINE SITES)
      let issueDisplay = '';
      if (dialogData.typeOfIssue === 'Others') {
        issueDisplay = dialogData.specifyOther || '';
      } else if (dialogData.typeOfIssue === 'Spare Required') {
        const spareTypes = dialogData.typeOfSpare || [];
        let spareDisplay = '';
        if (spareTypes.length > 0) {
          const spareTypesDisplay = spareTypes.map((spare: string) => {
            if (spare === 'OTHERS' && dialogData.specifySpareOther) {
              return dialogData.specifySpareOther;
            }
            return spare;
          });
          spareDisplay = spareTypesDisplay.join(', ');
        }
        issueDisplay = spareDisplay ? `Spare Required - ${spareDisplay}` : 'Spare Required';
      } else {
        issueDisplay = dialogData.typeOfIssue || '';
      }
      
      // Get remarks - ensure it's a string
      const remarksValue = dialogData.remarks !== undefined && dialogData.remarks !== null 
        ? String(dialogData.remarks) 
        : '';
      
      // Calculate payload size for logging
      const payloadString = JSON.stringify({
        fileId,
        rowKey,
        siteCode: row?.siteCode,
        typeOfIssue: issueDisplay,
        remarks: remarksValue,
        viewPhotos: viewPhotos || [],
        photoMetadata: photoMetadata || []
      });
      const payloadSizeMB = (new Blob([payloadString]).size / (1024 * 1024)).toFixed(2);
      const photoCount = (viewPhotos || []).length;
      
      console.log('[Dashboard] Saving to EquipmentOfflineSites database:', {
        fileId,
        rowKey,
        siteCode: row?.siteCode,
        typeOfIssue: issueDisplay,
        remarks: remarksValue,
        taskStatus,
        routingType,
        dialogDataTypeOfIssue: dialogData.typeOfIssue,
        dialogDataRemarks: dialogData.remarks,
        dialogDataSpecifyOther: dialogData.specifyOther,
        dialogDataTypeOfSpare: dialogData.typeOfSpare,
        hasTypeOfIssue: !!dialogData.typeOfIssue,
        hasRemarks: !!dialogData.remarks,
        photoCount,
        totalPhotoSizeMB: photoCount > 0 ? (new Blob([(viewPhotos || []).join('')]).size / (1024 * 1024)).toFixed(2) + ' MB' : '0 MB',
        totalPayloadSizeMB: `${payloadSizeMB} MB`
      });
      
      // For Pending cases, Type of Issue is required (validation happens before this function is called)
      // But we should still save even if Remarks is empty, as long as Type of Issue exists
      if (!issueDisplay) {
        console.warn('[Dashboard] Warning: Type of Issue is empty. This should not happen for Pending cases. Skipping database save.');
        return;
      }
      
      // Log what we're about to save
      console.log('[Dashboard] Preparing to save to database:', {
        typeOfIssue: issueDisplay,
        remarks: remarksValue,
        taskStatus,
        siteCode: row?.siteCode
      });
      
      const saveToDbResponse = await fetch(`${API_BASE}/api/equipment-offline-sites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          fileId: fileId,
          rowKey: rowKey,
          siteCode: row.siteCode.trim().toUpperCase(),
          originalRowData: matchingRow,
          headers: headers,
          siteObservations: 'Pending',
          taskStatus: taskStatus,
          typeOfIssue: issueDisplay, // Explicitly pass formatted Type of Issue
          remarks: remarksValue, // Use the validated remarks value
          viewPhotos: viewPhotos || [], // Include photos for all issue types
          photoMetadata: photoMetadata || [], // Include photo metadata
          deviceStatus: matchingRow[headers.find((h: string) => {
            const n = String(h || '').trim().toLowerCase().replace(/[_\s-]/g, '');
            return n === 'devicestatus' || (n.includes('device') && n.includes('status'));
          }) || ''] || '',
          noOfDaysOffline: matchingRow[headers.find((h: string) => {
            const n = String(h || '').trim().toLowerCase().replace(/[_\s-]/g, '');
            return n === 'noofdaysoffline' || (n.includes('days') && n.includes('offline'));
          }) || ''] || null,
          savedFrom: 'My Sites Dialog'
        })
      });
      
      if (saveToDbResponse.ok) {
        const saveResult = await saveToDbResponse.json();
        console.log(`✓ Saved Type of Issue and Remarks to EquipmentOfflineSites database (${routingType}):`, saveResult);
        return saveResult;
      } else {
        const errorData = await saveToDbResponse.json().catch(() => ({}));
        console.error(`✗ Failed to save to EquipmentOfflineSites database (${routingType}):`, errorData);
        throw new Error(errorData.error || 'Failed to save to database');
      }
    } catch (dbError) {
      console.error(`✗ Error saving to EquipmentOfflineSites database (${routingType}):`, dbError);
      throw dbError;
    }
  };

  // Submit site observation
  const submitSiteObservation = async () => {
    if (isSubmittingSiteObservations) return;
    
    // Validation for Pending status
    if (siteObservationStatus === 'pending') {
      if (!siteObservationsDialogData.typeOfIssue) {
        alert('Please select Type of Issue');
        return;
      }
      if (siteObservationsDialogData.typeOfIssue === 'Others' && !siteObservationsDialogData.specifyOther.trim()) {
        alert('Please specify the issue type');
        return;
      }
      if (siteObservationsDialogData.typeOfIssue === 'Spare Required' && siteObservationsDialogData.typeOfSpare.length === 0) {
        alert('Please select Type of Spare');
        return;
      }
      if (siteObservationsDialogData.typeOfIssue === 'Spare Required' && siteObservationsDialogData.typeOfSpare.includes('OTHERS') && !siteObservationsDialogData.specifySpareOther.trim()) {
        alert('Please specify the spare type');
        return;
      }
    }
    
    // Validation for Resolved status
    if (siteObservationStatus === 'resolved') {
      if (!siteObservationsDialogData.remarks.trim()) {
        alert('Please enter remarks');
        return;
      }
    }

    setIsSubmittingSiteObservations(true);

    try {
      // Save the observation status
      if (selectedRowForObservation) {
        const statusToSave = siteObservationStatus === 'pending' ? 'Pending' : 'Resolved';
        updateTableRow(selectedRowForObservation, 'siteObservation', statusToSave);
        
        // Get the site code from the selected row
        const row = tableRows.find(r => r.id === selectedRowForObservation);
        if (row && row.siteCode) {
          // Prepare Type of Issue display value (same logic as MyData.tsx)
          let issueDisplay = '';
          if (siteObservationsDialogData.typeOfIssue === 'Others') {
            issueDisplay = siteObservationsDialogData.specifyOther || '';
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
          
          // Prepare photos array (combine captured and uploaded photos)
          const allPhotos: string[] = [];
          if (siteObservationsDialogData.capturedPhotos && siteObservationsDialogData.capturedPhotos.length > 0) {
            allPhotos.push(...siteObservationsDialogData.capturedPhotos.map(p => p.data));
          }
          // Note: uploadedPhotos are File objects, we'll convert them when needed
          
          // IMPORTANT: Do NOT save Task Status from My Sites Dialog
          // Task Status is calculated from routing actions in MY OFFLINE SITES
          // and contains routing information like "Pending at O&M Team; Pending at Vendor (Shrishaila Electricals...)"
          // Saving Task Status here would override the routing information
          // Task Status should ONLY come from routing actions in MY OFFLINE SITES
          
          // Save site observation by Site Code to localStorage for MY OFFLINE SITES
          const siteCodeKey = `siteObservationsBySiteCode_${row.siteCode.trim().toUpperCase()}`;
          const observationData = {
            status: statusToSave,
            typeOfIssue: issueDisplay, // Formatted Type of Issue
            rawTypeOfIssue: siteObservationsDialogData.typeOfIssue || '', // Original type for reference
            specifyOther: siteObservationsDialogData.specifyOther || '',
            typeOfSpare: siteObservationsDialogData.typeOfSpare || [],
            specifySpareOther: siteObservationsDialogData.specifySpareOther || '',
            remarks: siteObservationsDialogData.remarks || '',
            capturedPhotos: siteObservationsDialogData.capturedPhotos || [],
            uploadedPhotos: siteObservationsDialogData.uploadedPhotos || [],
            viewPhotos: allPhotos, // Array of photo data URLs
            // NOTE: taskStatus is NOT saved - it comes from routing actions in MY OFFLINE SITES
            timestamp: new Date().toISOString(),
            savedFrom: 'My Sites Dialog'
          };
          
          // Save to API for synchronization with mobile app
          const token = localStorage.getItem('token');
          if (token) {
            try {
              const apiData = {
                siteCode: row.siteCode.trim().toUpperCase(),
                status: statusToSave,
                typeOfIssue: issueDisplay,
                rawTypeOfIssue: siteObservationsDialogData.typeOfIssue || '',
                specifyOther: siteObservationsDialogData.specifyOther || '',
                typeOfSpare: siteObservationsDialogData.typeOfSpare || [],
                specifySpareOther: siteObservationsDialogData.specifySpareOther || '',
                remarks: siteObservationsDialogData.remarks || '',
                capturedPhotos: siteObservationsDialogData.capturedPhotos || [],
                uploadedPhotos: siteObservationsDialogData.uploadedPhotos || [],
                viewPhotos: allPhotos,
                savedFrom: 'My Sites Dialog',
              };
              
              const apiUrl = `${API_BASE}/api/site-observations`;
              fetch(apiUrl, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(apiData),
              })
                .then(response => {
                  if (response.ok) {
                    console.log('Site observation saved to API successfully');
                  } else {
                    console.warn('Failed to save to API, saving locally only');
                  }
                })
                .catch(apiError => {
                  console.warn('Error saving to API (will save locally):', apiError);
                });
            } catch (apiError) {
              console.warn('Error preparing API request:', apiError);
            }
          }
          
          // Save to localStorage for offline support
          try {
            localStorage.setItem(siteCodeKey, JSON.stringify(observationData));
            console.log(`Saved site observation for Site Code: ${row.siteCode}`, observationData);
          } catch (storageError) {
            console.error('Error saving to localStorage:', storageError);
          }
          
          // Also save to a global map for quick lookup
          const globalKey = 'mySitesObservationsBySiteCode';
          let globalMap: Record<string, any> = {};
          try {
            const existing = localStorage.getItem(globalKey);
            if (existing) {
              globalMap = JSON.parse(existing);
            }
            globalMap[row.siteCode.trim().toUpperCase()] = observationData;
            localStorage.setItem(globalKey, JSON.stringify(globalMap));
            console.log('Updated global site observations map for Site Code:', row.siteCode.trim().toUpperCase(), observationData);
            
            // Dispatch custom event to notify other components (use a small delay to ensure localStorage is written)
            setTimeout(() => {
              window.dispatchEvent(new Event('mySitesObservationsUpdated'));
              console.log('Dispatched mySitesObservationsUpdated event');
            }, 100);
          } catch (globalStorageError) {
            console.error('Error saving to global map:', globalStorageError);
          }
          
          // If status is "Resolved", update Task Status and Remarks in MY OFFLINE SITES
          if (statusToSave === 'Resolved') {
            try {
              const token = localStorage.getItem('token');
              if (!token) {
                console.error('No token found for updating Task Status and Remarks');
              } else {
                // Get user data
                const storedUser = localStorage.getItem('user');
                const user = storedUser ? JSON.parse(storedUser) : null;
                const userRole = user?.role || '';
                
                // Only Equipment users can update Task Status and Remarks
                if (userRole === 'Equipment') {
                  // Fetch row data from MY OFFLINE SITES for this Site Code
                  const uploadsRes = await fetch(`${API_BASE}/api/uploads`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                  });
                  const uploadsJson = await uploadsRes.json();
                  
                  if (uploadsJson?.success) {
                    // Find Device Status Upload file (same as MY OFFLINE SITES)
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
                    
                    if (deviceStatusFile) {
                      // Fetch file data to find matching row
                      const fileRes = await fetch(`${API_BASE}/api/uploads/${deviceStatusFile.fileId}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                      });
                      const fileJson = await fileRes.json();
                      
                      if (fileJson?.success && fileJson.file) {
                        const file = fileJson.file;
                        const rows = Array.isArray(file.rows) ? file.rows : [];
                        const headers = file.headers && file.headers.length ? file.headers : (rows[0] ? Object.keys(rows[0]) : []);
                        
                        // Find site code header
                        const normalize = (str: string) => String(str || '').trim().toLowerCase().replace(/[_\s-]/g, '');
                        const siteCodeHeader = headers.find((h: string) => {
                          const n = normalize(h);
                          return n === 'sitecode' || n === 'site_code';
                        });
                        
                        if (siteCodeHeader) {
                          // Find matching row by Site Code
                          const matchingRow = rows.find((r: any) => {
                            const rowSiteCode = String(r[siteCodeHeader] || '').trim();
                            return normalize(rowSiteCode) === normalize(row.siteCode);
                          });
                          
                          if (matchingRow) {
                            // Generate rowKey (same function as MY OFFLINE SITES)
                            const generateRowKey = (fileId: string, rowData: any, headers: string[]): string => {
                              const actualFileId = rowData._sourceFileId || fileId;
                              if (rowData.id) {
                                return `${actualFileId}-${rowData.id}`;
                              }
                              if (headers.length >= 3) {
                                const keyParts: string[] = [];
                                for (let i = 0; i < Math.min(3, headers.length); i++) {
                                  const header = headers[i];
                                  const value = rowData[header] ?? '';
                                  keyParts.push(String(value));
                                }
                                if (keyParts.some(v => v)) {
                                  return `${actualFileId}-${keyParts.join('|')}`;
                                }
                              }
                              const keyParts: string[] = [];
                              headers.forEach(header => {
                                const value = rowData[header] ?? '';
                                keyParts.push(String(value));
                              });
                              return `${actualFileId}-${keyParts.join('|')}`;
                            };
                            
                            const rowKey = generateRowKey(deviceStatusFile.fileId, matchingRow, headers);
                            
                            // CRITICAL: Fetch existing Pending record to get the original typeOfIssue
                            // This ensures Type of Report shows the original issue type when Resolved
                            let existingTypeOfIssue = '';
                            try {
                              // Fetch all records for this file
                              const existingRecordRes = await fetch(`${API_BASE}/api/equipment-offline-sites/file/${deviceStatusFile.fileId}`, {
                                headers: { 'Authorization': `Bearer ${token}` }
                              });
                              
                              if (existingRecordRes.ok) {
                                const existingRecordData = await existingRecordRes.json();
                                if (existingRecordData?.success && existingRecordData?.data) {
                                  // existingRecordData.data is a map/object keyed by rowKey
                                  const siteCodeUpper = row.siteCode.trim().toUpperCase();
                                  
                                  // Find the Pending record for this site code
                                  const records = Object.values(existingRecordData.data) as any[];
                                  const pendingRecord = records.find((r: any) => {
                                    const recordSiteCode = String(r.siteCode || '').trim().toUpperCase();
                                    if (recordSiteCode !== siteCodeUpper) return false;
                                    
                                    const siteObs = String(r.siteObservations || '').trim();
                                    const taskStat = String(r.taskStatus || '').trim();
                                    const typeOfIssue = String(r.typeOfIssue || '').trim();
                                    // Pending = non-empty siteObservations OR non-empty taskStatus (not Resolved) OR non-empty typeOfIssue
                                    return siteObs !== '' || (taskStat !== '' && !/^resolved$/i.test(taskStat)) || typeOfIssue !== '';
                                  });
                                  
                                  if (pendingRecord && pendingRecord.typeOfIssue) {
                                    existingTypeOfIssue = String(pendingRecord.typeOfIssue).trim();
                                    console.log('[Dashboard] Found existing typeOfIssue from Pending record:', existingTypeOfIssue);
                                  }
                                }
                              }
                            } catch (fetchError) {
                              console.warn('[Dashboard] Could not fetch existing record for typeOfIssue:', fetchError);
                            }
                            
                            // Update Task Status and Remarks in localStorage for MY OFFLINE SITES
                            const storageKey = `myData_${deviceStatusFile.fileId}`;
                            const savedData = localStorage.getItem(storageKey);
                            let data: any = {};
                            if (savedData) {
                              try {
                                data = JSON.parse(savedData);
                              } catch (e) {
                                console.error('Error parsing saved data:', e);
                              }
                            }
                            
                            // Update Task Status to "Resolved"
                            if (!data.taskStatus) data.taskStatus = {};
                            data.taskStatus[rowKey] = 'Resolved';
                            
                            // Update Remarks
                            if (!data.remarks) data.remarks = {};
                            data.remarks[rowKey] = siteObservationsDialogData.remarks || '';
                            
                            localStorage.setItem(storageKey, JSON.stringify(data));
                            console.log('Updated Task Status and Remarks for Resolved status in localStorage:', {
                              rowKey,
                              taskStatus: data.taskStatus[rowKey],
                              remarks: data.remarks[rowKey]
                            });
                            
                            // CRITICAL: Also save to EquipmentOfflineSites database for Reports tab
                            // This ensures Reports tab can see the Resolved status
                            // CRITICAL: For Reports, Resolved = empty string, Pending = non-empty string
                            const finalSiteObservations = ''; // Resolved = empty string for Reports
                            
                            // CRITICAL: Use existing typeOfIssue from Pending record if available
                            // This ensures Type of Report shows the original issue type when Resolved
                            // If no existing typeOfIssue found, try to get it from dialog data (for cases where Resolved is set directly)
                            let issueDisplay = existingTypeOfIssue;
                            
                            // Fallback: If no existing typeOfIssue, try to get from dialog (though Resolved dialog typically doesn't have typeOfIssue)
                            if (!issueDisplay) {
                              if (siteObservationsDialogData.typeOfIssue === 'Others') {
                                issueDisplay = siteObservationsDialogData.specifyOther || '';
                              } else if (siteObservationsDialogData.typeOfIssue === 'Spare Required') {
                                const spareTypes = siteObservationsDialogData.typeOfSpare || [];
                                let spareDisplay = '';
                                if (spareTypes.length > 0) {
                                  const spareTypesDisplay = spareTypes.map((spare: string) => {
                                    if (spare === 'OTHERS' && siteObservationsDialogData.specifySpareOther) {
                                      return siteObservationsDialogData.specifySpareOther;
                                    }
                                    return spare;
                                  });
                                  spareDisplay = spareTypesDisplay.join(', ');
                                }
                                issueDisplay = spareDisplay ? `Spare Required - ${spareDisplay}` : 'Spare Required';
                              } else if (siteObservationsDialogData.typeOfIssue) {
                                issueDisplay = siteObservationsDialogData.typeOfIssue || '';
                              }
                            }
                            
                            console.log('[Dashboard] Final typeOfIssue for Resolved status:', {
                              existingTypeOfIssue,
                              fromDialog: siteObservationsDialogData.typeOfIssue,
                              final: issueDisplay
                            });
                            
                            // Prepare photos array (combine captured and uploaded photos)
                            const allPhotos: string[] = [];
                            if (siteObservationsDialogData.capturedPhotos && siteObservationsDialogData.capturedPhotos.length > 0) {
                              allPhotos.push(...siteObservationsDialogData.capturedPhotos.map((p: any) => p.data));
                            }
                            if (siteObservationsDialogData.uploadedPhotos && siteObservationsDialogData.uploadedPhotos.length > 0) {
                              const uploadedBase64 = await Promise.all(
                                siteObservationsDialogData.uploadedPhotos.map((file: File) =>
                                  new Promise<string>((resolve, reject) => {
                                    const reader = new FileReader();
                                    reader.onload = (e) => resolve(e.target?.result as string);
                                    reader.onerror = reject;
                                    reader.readAsDataURL(file);
                                  })
                                )
                              );
                              allPhotos.push(...uploadedBase64);
                            }
                            
                            // Prepare photo metadata
                            const photosMetadata: Array<{ latitude?: number; longitude?: number; timestamp?: string; location?: string }> = [];
                            if (siteObservationsDialogData.capturedPhotos && Array.isArray(siteObservationsDialogData.capturedPhotos)) {
                              siteObservationsDialogData.capturedPhotos.forEach((photo: any) => {
                                if (photo.latitude !== undefined || photo.longitude !== undefined || photo.timestamp || photo.location) {
                                  photosMetadata.push({
                                    latitude: photo.latitude,
                                    longitude: photo.longitude,
                                    timestamp: photo.timestamp,
                                    location: photo.location
                                  });
                                }
                              });
                            }
                            
                            // Prepare data for database save
                            const siteDataToSave = {
                              fileId: deviceStatusFile.fileId,
                              rowKey: rowKey,
                              siteCode: row.siteCode.trim().toUpperCase(),
                              originalRowData: matchingRow,
                              headers: headers,
                              siteObservations: finalSiteObservations, // Empty string for Resolved
                              taskStatus: 'Resolved',
                              typeOfIssue: issueDisplay,
                              viewPhotos: allPhotos,
                              photoMetadata: photosMetadata,
                              remarks: siteObservationsDialogData.remarks || '',
                              deviceStatus: matchingRow[headers.find((h: string) => {
                                const n = String(h || '').trim().toLowerCase().replace(/[_\s-]/g, '');
                                return n === 'devicestatus' || (n.includes('device') && n.includes('status'));
                              }) || ''] || '',
                              noOfDaysOffline: matchingRow[headers.find((h: string) => {
                                const n = String(h || '').trim().toLowerCase().replace(/[_\s-]/g, '');
                                return n === 'noofdaysoffline' || (n.includes('days') && n.includes('offline'));
                              }) || ''] || null,
                              savedFrom: 'My Sites Dialog'
                            };
                            
                            console.log('[Dashboard] Saving Resolved status to EquipmentOfflineSites database for Reports tab:', {
                              siteCode: siteDataToSave.siteCode,
                              siteObservations: finalSiteObservations,
                              taskStatus: siteDataToSave.taskStatus,
                              typeOfIssue: issueDisplay,
                              remarks: siteDataToSave.remarks
                            });
                            
                            // Save to database
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
                              console.log('✓ [Dashboard] Successfully saved Resolved status to EquipmentOfflineSites database for Reports tab:', saveResult.data?.siteCode);
                              
                              // CRITICAL: Create CCR approval action for Resolved status
                              // This ensures approvals go to CCR when Site Observation is updated from MY SITES card
                              try {
                                console.log('[Dashboard] Creating CCR approval action for Resolved observation from My Sites Dialog...');
                                
                                // Prepare photos for CCR approval
                                const ccrPhotosData: string[] = [];
                                if (allPhotos && allPhotos.length > 0) {
                                  ccrPhotosData.push(...allPhotos);
                                }
                                const ccrPhotosToSend = ccrPhotosData.length > 0 ? ccrPhotosData : null;
                                
                                // Create CCR approval action
                                const ccrResponse = await fetch(`${API_BASE}/api/actions/submit`, {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                                  },
                                  body: JSON.stringify({
                                    rowData: matchingRow,
                                    headers,
                                    routing: 'CCR Team',
                                    typeOfIssue: 'CCR Resolution Approval',
                                    remarks: siteObservationsDialogData.remarks || '',
                                    priority: 'Medium',
                                    photo: ccrPhotosToSend,
                                    sourceFileId: deviceStatusFile.fileId,
                                    rowKey: rowKey
                                  })
                                });
                                
                                const ccrResult = await ccrResponse.json().catch(() => null);
                                
                                if (!ccrResponse.ok) {
                                  const errorMsg = ccrResult?.error || 'Failed to send approval request to CCR team.';
                                  console.error('CCR approval creation failed:', errorMsg);
                                  // Don't block the UI, but log the error
                                  if (!errorMsg.includes('division')) {
                                    console.warn(`Warning: ${errorMsg}`);
                                  }
                                } else {
                                  console.log('✓ [Dashboard] Created CCR approval action for resolved observation:', ccrResult?.action?._id || ccrResult?.action?.id);
                                  if (ccrResult?.action?._id || ccrResult?.action?.id) {
                                    console.log('✓ [Dashboard] CCR approval successfully created and assigned to:', ccrResult?.action?.assignedToUserId);
                                  }
                                }
                              } catch (ccrError: any) {
                                console.error('Error creating CCR approval request:', ccrError);
                                // Don't block the UI, but log the error
                                if (ccrError?.message && !ccrError.message.includes('Warning:')) {
                                  console.warn('CCR approval creation failed, but continuing with site observation update');
                                }
                              }
                            } else {
                              const errorData = await saveResponse.json().catch(() => ({}));
                              console.error('✗ [Dashboard] Failed to save Resolved status to EquipmentOfflineSites database:', errorData);
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            } catch (resolvedError) {
              console.error('Error updating Task Status and Remarks for Resolved status:', resolvedError);
              // Don't block submission if update fails
            }
          }
          
          // If status is "Pending", create routing actions (same as MY OFFLINE SITES)
          if (statusToSave === 'Pending' && siteObservationsDialogData.typeOfIssue) {
            try {
              const token = localStorage.getItem('token');
              if (!token) {
                console.error('No token found for routing actions');
                return;
              }
              
              // Get user data
              const storedUser = localStorage.getItem('user');
              const user = storedUser ? JSON.parse(storedUser) : null;
              const userRole = user?.role || '';
              
              // Only Equipment users can create routing actions
              if (userRole !== 'Equipment') {
                console.log('Not Equipment role, skipping routing actions');
                return;
              }
              
              // Fetch row data from MY OFFLINE SITES for this Site Code
              const uploadsRes = await fetch(`${API_BASE}/api/uploads`, {
                headers: { 'Authorization': `Bearer ${token}` }
              });
              const uploadsJson = await uploadsRes.json();
              
              if (!uploadsJson?.success) {
                console.error('Failed to fetch uploads for routing');
                return;
              }
              
              // Find Device Status Upload file (same as MY OFFLINE SITES)
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
                console.error('Device Status Upload file not found');
                return;
              }
              
              // Fetch file data to find matching row
              const fileRes = await fetch(`${API_BASE}/api/uploads/${deviceStatusFile.fileId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
              });
              const fileJson = await fileRes.json();
              
              if (!fileJson?.success || !fileJson.file) {
                console.error('Failed to fetch file data for routing');
                return;
              }
              
              const file = fileJson.file;
              const rows = Array.isArray(file.rows) ? file.rows : [];
              const headers = file.headers && file.headers.length ? file.headers : (rows[0] ? Object.keys(rows[0]) : []);
              
              // Find site code header
              const normalize = (str: string) => String(str || '').trim().toLowerCase().replace(/[_\s-]/g, '');
              const siteCodeHeader = headers.find((h: string) => {
                const n = normalize(h);
                return n === 'sitecode' || n === 'site_code';
              });
              
              if (!siteCodeHeader) {
                console.error('Site Code header not found');
                return;
              }
              
              // Find matching row by Site Code
              const matchingRow = rows.find((r: any) => {
                const rowSiteCode = String(r[siteCodeHeader] || '').trim();
                return normalize(rowSiteCode) === normalize(row.siteCode);
              });
              
              if (!matchingRow) {
                console.error('Matching row not found for Site Code:', row.siteCode);
                return;
              }
              
              // Generate rowKey (same function as MY OFFLINE SITES)
              const generateRowKey = (fileId: string, rowData: any, headers: string[]): string => {
                const actualFileId = rowData._sourceFileId || fileId;
                if (rowData.id) {
                  return `${actualFileId}-${rowData.id}`;
                }
                if (headers.length >= 3) {
                  const keyParts: string[] = [];
                  for (let i = 0; i < Math.min(3, headers.length); i++) {
                    const header = headers[i];
                    const value = rowData[header] ?? '';
                    keyParts.push(String(value));
                  }
                  if (keyParts.some(v => v)) {
                    return `${actualFileId}-${keyParts.join('|')}`;
                  }
                }
                const keyParts: string[] = [];
                headers.forEach(header => {
                  const value = rowData[header] ?? '';
                  keyParts.push(String(value));
                });
                return `${actualFileId}-${keyParts.join('|')}`;
              };
              
              const rowKey = generateRowKey(deviceStatusFile.fileId, matchingRow, headers);
              const routingRowData = { ...matchingRow };
              
              // CRITICAL: Capture dialog data values immediately to prevent loss during async operations
              // This ensures Type of Issue and Remarks are preserved even if dialog is closed
              const capturedDialogData = {
                typeOfIssue: siteObservationsDialogData.typeOfIssue || '',
                specifyOther: siteObservationsDialogData.specifyOther || '',
                typeOfSpare: siteObservationsDialogData.typeOfSpare || [],
                specifySpareOther: siteObservationsDialogData.specifySpareOther || '',
                remarks: siteObservationsDialogData.remarks || '',
                capturedPhotos: siteObservationsDialogData.capturedPhotos || [],
                uploadedPhotos: siteObservationsDialogData.uploadedPhotos || []
              };
              
              console.log('[Dashboard] Captured dialog data for database save:', {
                typeOfIssue: capturedDialogData.typeOfIssue,
                remarks: capturedDialogData.remarks,
                hasTypeOfIssue: !!capturedDialogData.typeOfIssue,
                hasRemarks: !!capturedDialogData.remarks
              });
              
              // Prepare photos for routing (use captured data)
              let routingPhotoData: string[] = [];
              if (capturedDialogData.capturedPhotos && capturedDialogData.capturedPhotos.length > 0) {
                routingPhotoData = capturedDialogData.capturedPhotos.map((photo: any) => photo.data);
              }
              if (capturedDialogData.uploadedPhotos && capturedDialogData.uploadedPhotos.length > 0) {
                const uploadedBase64 = await Promise.all(
                  capturedDialogData.uploadedPhotos.map((file: File) =>
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
              
              // Determine routing based on Type of Issue (same logic as MY OFFLINE SITES)
              const isRTUIssue = capturedDialogData.typeOfIssue === 'RTU Issue' || capturedDialogData.typeOfIssue === 'CS Issue';
              const isAMCIssue = capturedDialogData.typeOfIssue === 'Spare Required' || capturedDialogData.typeOfIssue === 'Faulty';
              
              // Extract Device Type and Circle for backend (backend uses these for routing decisions)
              // Device Type is used by backend for fallback routing if Site Code not in priority list
              const deviceTypeKeys = ['DEVICE TYPE', 'Device Type', 'device type', 'DEVICETYPE', 'DeviceType', 'device_type'];
              for (const key of deviceTypeKeys) {
                if (routingRowData[key]) {
                  // Device Type is already in routingRowData, backend will use it
                  break;
                }
              }
              
              let circle = '';
              const circleKeys = ['CIRCLE', 'Circle', 'circle'];
              for (const key of circleKeys) {
                if (routingRowData[key]) {
                  circle = String(routingRowData[key]).trim().toUpperCase();
                  break;
                }
              }
              
              // If no Circle in rowData, try to derive from Division
              if (!circle) {
                const divisionKeys = ['DIVISION', 'Division', 'division'];
                let division = '';
                for (const key of divisionKeys) {
                  if (routingRowData[key]) {
                    division = String(routingRowData[key]).trim().toUpperCase();
                    break;
                  }
                }
                // Map divisions to circles
                const southCircleDivisions = ['HSR', 'JAYANAGAR', 'KORAMANGALA'];
                if (division && southCircleDivisions.includes(division)) {
                  circle = 'SOUTH';
                  routingRowData['CIRCLE'] = circle;
                }
              }
              
              // Determine routing teams (same logic as MY OFFLINE SITES)
              // For Faulty/Spare Required: ALWAYS route to BOTH O&M and AMC teams
              // Backend will handle Site Code priority (Jyothi Electricals) vs Circle-based routing
              const shouldRouteToOM = isAMCIssue; // Faulty/Spare Required always route to O&M
              const shouldRouteToAMC = isAMCIssue; // Faulty/Spare Required always route to AMC (backend handles Site Code priority vs Circle-based routing)
              const shouldRouteToRTU = isRTUIssue; // RTU Issue/CS Issue → RTU/Communication
              
              console.log('Routing decision:', {
                isAMCIssue,
                shouldRouteToOM,
                shouldRouteToAMC,
                shouldRouteToRTU,
                typeOfIssue: capturedDialogData.typeOfIssue
              });
              
              // Track routing results to build final combined task status
              let omRouted = false;
              let amcRouted = false;
              let rtuRouted = false;
              let amcVendorName = '';
              
              // Route to O&M Team (if needed)
              if (shouldRouteToOM) {
                const omRoutingResponse = await fetch(`${API_BASE}/api/actions/submit`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  },
                  body: JSON.stringify({
                    rowData: routingRowData,
                    headers,
                    routing: 'O&M Team',
                    typeOfIssue: capturedDialogData.typeOfIssue,
                    remarks: capturedDialogData.remarks,
                    priority: 'Medium',
                    photo: routingPhotosToSend,
                    sourceFileId: deviceStatusFile.fileId,
                    rowKey: rowKey
                  })
                });
                
                const omRoutingResult = await omRoutingResponse.json();
                if (omRoutingResponse.ok && omRoutingResult?.success) {
                  console.log('Action routed to O&M Team from My Sites Dialog:', omRoutingResult);
                  omRouted = true;
                }
              }
              
              // Route to AMC Team (if needed) - ALWAYS for Faulty/Spare Required
              if (shouldRouteToAMC) {
                console.log('Routing to AMC Team from My Sites Dialog...');
                const amcRoutingResponse = await fetch(`${API_BASE}/api/actions/submit`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  },
                  body: JSON.stringify({
                    rowData: routingRowData,
                    headers,
                    routing: 'AMC Team',
                    typeOfIssue: capturedDialogData.typeOfIssue,
                    remarks: capturedDialogData.remarks,
                    priority: 'Medium',
                    photo: routingPhotosToSend,
                    sourceFileId: deviceStatusFile.fileId,
                    rowKey: rowKey
                  })
                });
                
                const amcRoutingResult = await amcRoutingResponse.json();
                if (amcRoutingResponse.ok && amcRoutingResult?.success) {
                  console.log('Action routed to AMC Team from My Sites Dialog:', amcRoutingResult);
                  amcRouted = true;
                  amcVendorName = amcRoutingResult.action?.assignedToVendor || amcRoutingResult.action?.vendor || '';
                } else {
                  console.error('Failed to route to AMC Team:', amcRoutingResult);
                }
              }
              
              // Route to RTU/Communication Team (if needed)
              if (shouldRouteToRTU) {
                const rtuRoutingResponse = await fetch(`${API_BASE}/api/actions/submit`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  },
                  body: JSON.stringify({
                    rowData: routingRowData,
                    headers,
                    routing: 'RTU/Communication Team',
                    typeOfIssue: capturedDialogData.typeOfIssue,
                    remarks: capturedDialogData.remarks,
                    priority: 'Medium',
                    photo: routingPhotosToSend,
                    sourceFileId: deviceStatusFile.fileId,
                    rowKey: rowKey
                  })
                });
                
                const rtuRoutingResult = await rtuRoutingResponse.json();
                if (rtuRoutingResponse.ok && rtuRoutingResult?.success) {
                  console.log('Action routed to RTU/Communication Team from My Sites Dialog:', rtuRoutingResult);
                  rtuRouted = true;
                }
              }
              
              // Build final combined Task Status after all routings are complete
              // Database only - no localStorage for Pending cases
              const taskStatusParts: string[] = [];
              
              if (amcRouted) {
                const amcStatus = amcVendorName 
                  ? `Pending at Vendor (${amcVendorName})`
                  : 'Pending at AMC Team';
                taskStatusParts.push(amcStatus);
              }
              
              if (omRouted) {
                taskStatusParts.push('Pending at O&M Team');
              }
              
              if (rtuRouted) {
                taskStatusParts.push('Pending at RTU/Communication Team');
              }
              
              // If no specific routing, just set to "Pending"
              if (!omRouted && !amcRouted && !rtuRouted) {
                taskStatusParts.push('Pending');
              }
              
              const finalTaskStatus = taskStatusParts.join('; ');
              
              // CRITICAL: Save Type of Issue and Remarks to EquipmentOfflineSites database
              // Database only - no localStorage for Pending cases
              // Save once with the final combined task status
              // Use capturedDialogData to ensure values are preserved
              // Always save when we have a matching row, regardless of routing status
              // This ensures all issue types (Dismantled, Idle, etc.) are saved with photos
              try {
                // Prepare photo metadata from captured photos
                const photosMetadata: Array<{ latitude?: number; longitude?: number; timestamp?: string; location?: string }> = [];
                if (capturedDialogData.capturedPhotos && Array.isArray(capturedDialogData.capturedPhotos)) {
                  capturedDialogData.capturedPhotos.forEach((photo: any) => {
                    if (photo.latitude !== undefined || photo.longitude !== undefined || photo.timestamp || photo.location) {
                      photosMetadata.push({
                        latitude: photo.latitude,
                        longitude: photo.longitude,
                        timestamp: photo.timestamp,
                        location: photo.location
                      });
                    }
                  });
                }
                if (capturedDialogData.uploadedPhotos && Array.isArray(capturedDialogData.uploadedPhotos)) {
                  capturedDialogData.uploadedPhotos.forEach((photo: any) => {
                    if (photo.latitude !== undefined || photo.longitude !== undefined || photo.timestamp || photo.location) {
                      photosMetadata.push({
                        latitude: photo.latitude,
                        longitude: photo.longitude,
                        timestamp: photo.timestamp,
                        location: photo.location
                      });
                    }
                  });
                }
                
                console.log('[Dashboard] About to save to database with captured data:', {
                  typeOfIssue: capturedDialogData.typeOfIssue,
                  remarks: capturedDialogData.remarks,
                  taskStatus: finalTaskStatus,
                  photoCount: routingPhotoData.length,
                  hasPhotos: routingPhotoData.length > 0
                });
                await savePendingDataToDatabase(
                  deviceStatusFile.fileId, 
                  rowKey, 
                  row, 
                  matchingRow, 
                  headers, 
                  capturedDialogData, 
                  'Combined', 
                  finalTaskStatus, 
                  token,
                  routingPhotoData, // viewPhotos - Include photos for all issue types
                  photosMetadata // photoMetadata
                );
                console.log('✓ Successfully saved Pending data to database');
              } catch (saveError) {
                console.error('✗ Failed to save Pending data to database:', saveError);
                // Don't block the submission, but log the error
              }
              
              } catch (routingError) {
              console.error('Error creating routing actions from My Sites Dialog:', routingError);
              // Don't block submission if routing fails
            }
          }
        }
      }
      
      // Show success message (same as MY OFFLINE SITES)
      const statusMessage = siteObservationStatus === 'pending' ? 'Pending' : 'Resolved';
      alert(`Site observation marked as ${statusMessage} successfully!`);
      
      setTimeout(() => {
        setIsSubmittingSiteObservations(false);
        closeSiteObservationDialog();
      }, 500);
    } catch (error) {
      console.error('Error submitting site observation:', error);
      alert('Error submitting site observation. Please try again.');
      setIsSubmittingSiteObservations(false);
    }
  };

  // Handle camera cleanup
  useEffect(() => {
    if (siteObservationsCameraStream && showSiteObservationsCameraPreview) {
      const video = document.getElementById('site-observations-camera-preview') as HTMLVideoElement;
      if (video) {
        video.srcObject = siteObservationsCameraStream;
        video.play();
        siteObservationsCameraStreamRef.current = siteObservationsCameraStream;
      }
    }

    return () => {
      if (!showSiteObservationsCameraPreview && siteObservationsCameraStreamRef.current) {
        siteObservationsCameraStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
        siteObservationsCameraStreamRef.current = null;
      }
    };
  }, [siteObservationsCameraStream, showSiteObservationsCameraPreview]);

  // Handle Application change
  const handleApplicationChange = (value: 'offline' | 'rtu' | '') => {
    setApplication(value);
    // Reset division and sub division whenever application changes
    // This prevents stale values from persisting when switching between applications
    setDivision('');
    setSubDivision('');
    setSubDivisionSuggestions([]);
  };

  // Handle Division change
  const handleDivisionChange = (value: string) => {
    setDivision(value);
    // Reset sub division when division changes
    setSubDivision('');
    setSubDivisionSuggestions([]);
    // Fetch sub divisions for the selected division
    if (value && application === 'offline') {
      fetchSubDivisionSuggestions(value);
    }
  };

  // Handle Sub Division selection (now using dropdown)
  const handleSubDivisionChange = (value: string) => {
    setSubDivision(value);
    // Fetch site codes when sub division is selected
    if (application === 'offline' && division.trim() && value.trim()) {
      fetchSiteCodesForSubDivision(value.trim(), division.trim());
    }
  };

  // Fetch site codes when Sub Division changes and OFFLINE SITES is selected (with debounce)
  useEffect(() => {
    if (application === 'offline' && division.trim() && subDivision.trim()) {
      const timeoutId = setTimeout(() => {
        fetchSiteCodesForSubDivision(subDivision.trim(), division.trim());
      }, 500);
      return () => clearTimeout(timeoutId);
    } else if (application === 'offline' && !subDivision.trim()) {
      setSiteCodesForSubDivision([]);
    }
  }, [subDivision, division, application, fetchSiteCodesForSubDivision]);


  // Fetch suggestions when dialog opens
  useEffect(() => {
    if (showCheckDeviceDialog) {
      fetchSiteCodeSuggestions();
    }
  }, [showCheckDeviceDialog, fetchSiteCodeSuggestions]);

  // Fetch site codes when My Directions modal opens
  useEffect(() => {
    if (showMyDirectionsModal) {
      fetchDirectionsSiteCodeSuggestions();
    }
  }, [showMyDirectionsModal, fetchDirectionsSiteCodeSuggestions]);

  // Fetch locations with KML file paths
  const fetchLocations = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      // Try to fetch from AdminUploadField (KML files configured in Admin panel)
      const adminFieldsRes = await fetch(`${API_BASE}/api/admin/uploads/fields`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (adminFieldsRes.ok) {
        const adminFieldsJson = await adminFieldsRes.json();
        if (adminFieldsJson?.success && Array.isArray(adminFieldsJson.fields)) {
          // Find KML file fields
          const kmlFields = adminFieldsJson.fields.filter((field: any) => {
            const fieldName = String(field.fieldName || '').toLowerCase();
            const fileName = String(field.uploadedFile?.fileName || '').toLowerCase();
            return fieldName.includes('kml') || fieldName.includes('location') || 
                   fileName.includes('.kml') || fileName.includes('location');
          });
          
          const locationData = kmlFields.map((field: any) => ({
            name: field.fieldName || '',
            kmlFilePath: field.uploadedFile?.fileUrl || '',
            fieldId: field._id || field.id || ''
          }));
          
          setLocations(locationData);
        }
      }
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  }, []);

  // Fetch locations when My Sites dialog opens
  useEffect(() => {
    if (showMySitesDialog) {
      fetchLocations();
      // Auto-select division if user has only one division
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        if (userData?.division && Array.isArray(userData.division) && userData.division.length === 1 && !division) {
          setDivision(userData.division[0]);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMySitesDialog, fetchLocations]);

  // Fetch sub divisions when division is selected and application is offline
  useEffect(() => {
    if (showMySitesDialog && application === 'offline' && division.trim()) {
      fetchSubDivisionSuggestions(division);
    } else if (!division.trim()) {
      setSubDivisionSuggestions([]);
    }
  }, [showMySitesDialog, application, division, fetchSubDivisionSuggestions]);

  // Filter suggestions based on input
  const filteredSiteCodeSuggestions = siteCode.trim()
    ? siteCodeSuggestions.filter((sc: string) =>
        sc.toLowerCase().includes(siteCode.toLowerCase())
      )
    : [];

  // Filter Sub Division suggestions based on input
  // const filteredSubDivisionSuggestions = subDivision.trim()
  //   ? subDivisionSuggestions.filter((sd: string) =>
  //       sd.toLowerCase().includes(subDivision.toLowerCase())
  //     )
  //   : [];

  // Handle site code input change
  const handleSiteCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSiteCode(e.target.value);
    setShowSiteCodeSuggestions(true);
    setSelectedSuggestionIndex(-1);
  };

  // Handle site code input key down
  const handleSiteCodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSiteCodeSuggestions || filteredSiteCodeSuggestions.length === 0) {
      if (e.key === 'Enter') {
        handleSiteCodeSearch();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev < filteredSiteCodeSuggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedSuggestionIndex >= 0 && selectedSuggestionIndex < filteredSiteCodeSuggestions.length) {
          const selected = filteredSiteCodeSuggestions[selectedSuggestionIndex];
          setSiteCode(selected);
          setShowSiteCodeSuggestions(false);
          setSelectedSuggestionIndex(-1);
          // Set deviceData immediately and trigger search directly
          setDeviceData({});
          setDeviceDataError(null);
          fetchDeviceData(selected.trim());
        } else {
          handleSiteCodeSearch();
        }
        break;
      case 'Escape':
        setShowSiteCodeSuggestions(false);
        setSelectedSuggestionIndex(-1);
        break;
    }
  };

  // Handle suggestion selection
  const handleSelectSuggestion = async (suggestion: string) => {
    setSiteCode(suggestion);
    setShowSiteCodeSuggestions(false);
    setSelectedSuggestionIndex(-1);
    
    // Set deviceData to empty object immediately so Device Information section shows right away
    setDeviceData({});
    setDeviceDataError(null);
    
    // Trigger search immediately with the selected suggestion
    // Use the suggestion value directly instead of waiting for state update
    await fetchDeviceData(suggestion.trim());
  };

  if (!user || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Non-Admin users see the simple dashboard
  if (user.role !== 'Admin') {
    // Equipment role users see MY INFO dashboard (case-insensitive check)
    const userRole = String(user.role || '').trim();
    console.log('Dashboard - Checking role for MY INFO:', userRole);
    
    if (userRole === 'Equipment' || userRole.toLowerCase() === 'equipment') {
      console.log('Dashboard - Rendering MY INFO section for Equipment role');
      return (
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg shadow-lg p-6 text-white">
            <h2 className="text-3xl font-bold mb-2">Dashboard</h2>
            <p className="text-blue-100">Welcome to your equipment monitoring dashboard</p>
          </div>

          {/* MY INFO Section */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-2xl font-bold text-gray-800 mb-6">MY INFO</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Check My Device Card */}
              <button
                onClick={() => setShowCheckDeviceDialog(true)}
                className="group bg-gradient-to-br from-blue-50 via-blue-100 to-indigo-50 border-2 border-blue-200 rounded-xl p-6 shadow-md hover:shadow-xl transition-all duration-300 hover:border-blue-400 hover:-translate-y-1 text-left hover:from-blue-100 hover:via-blue-200 hover:to-indigo-100 cursor-pointer"
              >
                <div className="flex items-center space-x-4">
                  <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg p-4 shadow-lg group-hover:scale-110 transition-transform duration-300">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold text-gray-800 group-hover:text-blue-700 transition-colors duration-300">Check My Device</h4>
                    <p className="text-sm text-gray-600 mt-1">View device status and health</p>
                  </div>
                  <svg className="w-5 h-5 text-blue-600 group-hover:text-blue-800 group-hover:translate-x-1 transition-all duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>

              {/* My Sites Card */}
              <button
                onClick={() => setShowMySitesDialog(true)}
                className="group bg-gradient-to-br from-green-50 via-emerald-100 to-teal-50 border-2 border-green-200 rounded-xl p-6 shadow-md hover:shadow-xl transition-all duration-300 hover:border-green-400 hover:-translate-y-1 text-left hover:from-green-100 hover:via-emerald-200 hover:to-teal-100"
              >
                <div className="flex items-center space-x-4">
                  <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg p-4 shadow-lg group-hover:scale-110 transition-transform duration-300">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold text-gray-800 group-hover:text-green-700 transition-colors duration-300">My Sites</h4>
                    <p className="text-sm text-gray-600 mt-1">Access site information and data</p>
                  </div>
                  <svg className="w-5 h-5 text-green-600 group-hover:text-green-800 group-hover:translate-x-1 transition-all duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>

              {/* My Logs Card */}
              <button
                onClick={() => navigate('/dashboard/my-logs')}
                className="group bg-gradient-to-br from-purple-50 via-violet-100 to-fuchsia-50 border-2 border-purple-200 rounded-xl p-6 shadow-md hover:shadow-xl transition-all duration-300 hover:border-purple-400 hover:-translate-y-1 text-left hover:from-purple-100 hover:via-violet-200 hover:to-fuchsia-100"
              >
                <div className="flex items-center space-x-4">
                  <div className="bg-gradient-to-br from-purple-500 to-violet-600 rounded-lg p-4 shadow-lg group-hover:scale-110 transition-transform duration-300">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold text-gray-800 group-hover:text-purple-700 transition-colors duration-300">My Logs</h4>
                    <p className="text-sm text-gray-600 mt-1">View activity and system logs</p>
                  </div>
                  <svg className="w-5 h-5 text-purple-600 group-hover:text-purple-800 group-hover:translate-x-1 transition-all duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>

              {/* My Directions Card */}
              <div
                onClick={() => setShowMyDirectionsModal(true)}
                className="group bg-gradient-to-br from-orange-50 via-amber-100 to-yellow-50 border-2 border-orange-200 rounded-xl p-6 shadow-md hover:shadow-xl transition-all duration-300 hover:border-orange-400 hover:-translate-y-1 text-left hover:from-orange-100 hover:via-amber-200 hover:to-yellow-100 cursor-pointer"
              >
                <div className="flex items-center space-x-4">
                  <div className="bg-gradient-to-br from-orange-500 to-amber-600 rounded-lg p-4 shadow-lg group-hover:scale-110 transition-transform duration-300">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold text-gray-800 group-hover:text-orange-700 transition-colors duration-300">My Directions</h4>
                    <p className="text-sm text-gray-600 mt-1">Manage and track your directions</p>
                  </div>
                  <svg className="w-5 h-5 text-orange-600 group-hover:text-orange-800 group-hover:translate-x-1 transition-all duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Device Status Section - Show for Equipment and CCR roles */}
          {(() => {
            const user = localStorage.getItem('user');
            const userData = user ? JSON.parse(user) : null;
            const userRole = userData?.role || '';
            const isEquipment = userRole === 'Equipment' || userRole.toLowerCase() === 'equipment';
            const isCCR = userRole === 'CCR' || userRole.toLowerCase() === 'ccr';
            
            if (!isEquipment && !isCCR) return null;
            
            return (
          <div className="bg-white rounded-xl shadow-lg p-6">
            {/* Header with Date Picker */}
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-gray-800">Device Status</h3>
              
              {/* Date Picker - Right Top Corner */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                  Device Status as on:
                </label>
                <input
                  type="date"
                  value={selectedDeviceStatusDate}
                  onChange={(e) => setSelectedDeviceStatusDate(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Device Status Cards */}
            {(() => {
              const user = localStorage.getItem('user');
              const userData = user ? JSON.parse(user) : null;
              const userRole = userData?.role || '';
              const isCCR = userRole === 'CCR' || userRole.toLowerCase() === 'ccr';
              
              return (
                <div className={`grid grid-cols-1 ${isCCR ? 'md:grid-cols-3 lg:grid-cols-6' : 'md:grid-cols-4'} gap-4`}>
                  {/* ONLINE Card */}
                  <button
                    onClick={() => navigate(`/dashboard/device-status-table?status=ONLINE&date=${selectedDeviceStatusDate || latestDeviceStatusDate}`)}
                    className="group bg-gradient-to-br from-green-50 via-emerald-100 to-teal-50 border-2 border-green-200 rounded-xl p-4 shadow-md hover:shadow-xl transition-all duration-300 hover:border-green-400 hover:-translate-y-1 text-left hover:from-green-100 hover:via-emerald-200 hover:to-teal-100"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-lg font-semibold text-gray-800 group-hover:text-green-700 transition-colors duration-300">ONLINE</h4>
                        <p className="text-3xl font-bold text-green-600 mt-2">{deviceStatusCounts.online}</p>
                      </div>
                      <svg className="w-8 h-8 text-green-600 group-hover:text-green-800 group-hover:scale-110 transition-all duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </button>

                  {/* OFFLINE Card */}
                  <button
                    onClick={() => navigate(`/dashboard/device-status-table?status=OFFLINE&date=${selectedDeviceStatusDate || latestDeviceStatusDate}`)}
                    className="group bg-gradient-to-br from-red-50 via-rose-100 to-pink-50 border-2 border-red-200 rounded-xl p-4 shadow-md hover:shadow-xl transition-all duration-300 hover:border-red-400 hover:-translate-y-1 text-left hover:from-red-100 hover:via-rose-200 hover:to-pink-100"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-lg font-semibold text-gray-800 group-hover:text-red-700 transition-colors duration-300">OFFLINE</h4>
                        <p className="text-3xl font-bold text-red-600 mt-2">{deviceStatusCounts.offline}</p>
                      </div>
                      <svg className="w-8 h-8 text-red-600 group-hover:text-red-800 group-hover:scale-110 transition-all duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </button>

                  {/* LOCAL Card */}
                  <button
                    onClick={() => navigate(`/dashboard/device-status-table?status=LOCAL&date=${selectedDeviceStatusDate || latestDeviceStatusDate}`)}
                    className="group bg-gradient-to-br from-blue-50 via-indigo-100 to-purple-50 border-2 border-blue-200 rounded-xl p-4 shadow-md hover:shadow-xl transition-all duration-300 hover:border-blue-400 hover:-translate-y-1 text-left hover:from-blue-100 hover:via-indigo-200 hover:to-purple-100"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-lg font-semibold text-gray-800 group-hover:text-blue-700 transition-colors duration-300">LOCAL</h4>
                        <p className="text-3xl font-bold text-blue-600 mt-2">{deviceStatusCounts.local}</p>
                      </div>
                      <svg className="w-8 h-8 text-blue-600 group-hover:text-blue-800 group-hover:scale-110 transition-all duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                  </button>

                  {/* REMOTE Card */}
                  <button
                    onClick={() => navigate(`/dashboard/device-status-table?status=REMOTE&date=${selectedDeviceStatusDate || latestDeviceStatusDate}`)}
                    className="group bg-gradient-to-br from-yellow-50 via-amber-100 to-orange-50 border-2 border-yellow-200 rounded-xl p-4 shadow-md hover:shadow-xl transition-all duration-300 hover:border-yellow-400 hover:-translate-y-1 text-left hover:from-yellow-100 hover:via-amber-200 hover:to-orange-100"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-lg font-semibold text-gray-800 group-hover:text-yellow-700 transition-colors duration-300">REMOTE</h4>
                        <p className="text-3xl font-bold text-yellow-600 mt-2">{deviceStatusCounts.remote}</p>
                      </div>
                      <svg className="w-8 h-8 text-yellow-600 group-hover:text-yellow-800 group-hover:scale-110 transition-all duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                    </div>
                  </button>

                  {/* SWITCH ISSUE Card - Only for CCR role */}
                  {isCCR && (
                    <button
                      onClick={() => navigate(`/dashboard/device-status-table?status=SWITCH ISSUE&date=${selectedDeviceStatusDate || latestDeviceStatusDate}`)}
                      className="group bg-gradient-to-br from-orange-50 via-amber-100 to-yellow-50 border-2 border-orange-200 rounded-xl p-4 shadow-md hover:shadow-xl transition-all duration-300 hover:border-orange-400 hover:-translate-y-1 text-left hover:from-orange-100 hover:via-amber-200 hover:to-yellow-100"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-lg font-semibold text-gray-800 group-hover:text-orange-700 transition-colors duration-300">SWITCH ISSUE</h4>
                          <p className="text-3xl font-bold text-orange-600 mt-2">{deviceStatusCounts.switchIssue}</p>
                        </div>
                        <svg className="w-8 h-8 text-orange-600 group-hover:text-orange-800 group-hover:scale-110 transition-all duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                    </button>
                  )}

                  {/* RTU LOCAL Card - Only for CCR role */}
                  {isCCR && (
                    <button
                      onClick={() => navigate(`/dashboard/device-status-table?status=RTU LOCAL&date=${selectedDeviceStatusDate || latestDeviceStatusDate}`)}
                      className="group bg-gradient-to-br from-purple-50 via-violet-100 to-indigo-50 border-2 border-purple-200 rounded-xl p-4 shadow-md hover:shadow-xl transition-all duration-300 hover:border-purple-400 hover:-translate-y-1 text-left hover:from-purple-100 hover:via-violet-200 hover:to-indigo-100"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-lg font-semibold text-gray-800 group-hover:text-purple-700 transition-colors duration-300">RTU LOCAL</h4>
                          <p className="text-3xl font-bold text-purple-600 mt-2">{deviceStatusCounts.rtuLocal}</p>
                        </div>
                        <svg className="w-8 h-8 text-purple-600 group-hover:text-purple-800 group-hover:scale-110 transition-all duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                        </svg>
                      </div>
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
            );
          })()}

          {/* My Directions Modal */}
          {showMyDirectionsModal && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setShowMyDirectionsModal(false);
                  setDirectionsSiteCodeInput('');
                  setSelectedSiteCodes([]);
                  setShowDirectionsSuggestions(false);
                }
              }}
            >
              <div 
                className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-amber-50">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-gray-800">My Directions</h2>
                    <button
                      onClick={() => {
                        setShowMyDirectionsModal(false);
                        setDirectionsSiteCodeInput('');
                        setSelectedSiteCodes([]);
                        setShowDirectionsSuggestions(false);
                      }}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {/* Site Code Input with Multi-Select */}
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Enter Site Code
                    </label>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={directionsSiteCodeInput}
                        onChange={(e) => {
                          setDirectionsSiteCodeInput(e.target.value);
                          if (e.target.value.trim()) {
                            const filtered = directionsSiteCodeSuggestions.filter((sc: string) =>
                              sc.toLowerCase().includes(e.target.value.toLowerCase()) &&
                              !selectedSiteCodes.includes(sc)
                            );
                            setShowDirectionsSuggestions(filtered.length > 0);
                            setSelectedDirectionsSuggestionIndex(-1);
                          } else {
                            setShowDirectionsSuggestions(false);
                          }
                        }}
                        onFocus={() => {
                          if (directionsSiteCodeInput.trim() && directionsSiteCodeSuggestions.length > 0) {
                            const filtered = directionsSiteCodeSuggestions.filter((sc: string) =>
                              sc.toLowerCase().includes(directionsSiteCodeInput.toLowerCase()) &&
                              !selectedSiteCodes.includes(sc)
                            );
                            setShowDirectionsSuggestions(filtered.length > 0);
                          }
                        }}
                        onKeyDown={(e) => {
                          const filtered = directionsSiteCodeSuggestions.filter((sc: string) =>
                            sc.toLowerCase().includes(directionsSiteCodeInput.toLowerCase()) &&
                            !selectedSiteCodes.includes(sc)
                          );
                          
                          if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            setSelectedDirectionsSuggestionIndex(prev => 
                              prev < filtered.length - 1 ? prev + 1 : prev
                            );
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            setSelectedDirectionsSuggestionIndex(prev => prev > 0 ? prev - 1 : -1);
                          } else if (e.key === 'Enter') {
                            e.preventDefault();
                            if (selectedDirectionsSuggestionIndex >= 0 && selectedDirectionsSuggestionIndex < filtered.length) {
                              const selected = filtered[selectedDirectionsSuggestionIndex];
                              if (!selectedSiteCodes.includes(selected)) {
                                setSelectedSiteCodes([...selectedSiteCodes, selected]);
                                setDirectionsSiteCodeInput('');
                                setShowDirectionsSuggestions(false);
                              }
                            } else if (directionsSiteCodeInput.trim() && !selectedSiteCodes.includes(directionsSiteCodeInput.trim())) {
                              // Add exact match if available
                              const exactMatch = directionsSiteCodeSuggestions.find(sc => 
                                sc.toLowerCase() === directionsSiteCodeInput.trim().toLowerCase()
                              );
                              if (exactMatch) {
                                setSelectedSiteCodes([...selectedSiteCodes, exactMatch]);
                                setDirectionsSiteCodeInput('');
                                setShowDirectionsSuggestions(false);
                              }
                            }
                          } else if (e.key === 'Escape') {
                            setShowDirectionsSuggestions(false);
                          }
                        }}
                        placeholder="Type to search site codes..."
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                      
                      {/* Suggestions Dropdown */}
                      {showDirectionsSuggestions && directionsSiteCodeInput.trim() && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                          {directionsSiteCodeSuggestions
                            .filter((sc: string) =>
                              sc.toLowerCase().includes(directionsSiteCodeInput.toLowerCase()) &&
                              !selectedSiteCodes.includes(sc)
                            )
                            .map((suggestion, index) => (
                              <div
                                key={suggestion}
                                onClick={() => {
                                  if (!selectedSiteCodes.includes(suggestion)) {
                                    setSelectedSiteCodes([...selectedSiteCodes, suggestion]);
                                    setDirectionsSiteCodeInput('');
                                    setShowDirectionsSuggestions(false);
                                  }
                                }}
                                className={`px-4 py-2 cursor-pointer hover:bg-orange-50 ${
                                  index === selectedDirectionsSuggestionIndex ? 'bg-orange-100' : ''
                                } ${index === 0 ? 'rounded-t-lg' : ''} ${
                                  index === Math.min(9, directionsSiteCodeSuggestions.filter((sc: string) =>
                                    sc.toLowerCase().includes(directionsSiteCodeInput.toLowerCase()) &&
                                    !selectedSiteCodes.includes(sc)
                                  ).length - 1) ? 'rounded-b-lg' : ''
                                }`}
                              >
                                {suggestion}
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Selected Site Codes */}
                  {selectedSiteCodes.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Selected Site Codes ({selectedSiteCodes.length})
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {selectedSiteCodes.map((code) => (
                          <span
                            key={code}
                            className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800"
                          >
                            {code}
                            <button
                              onClick={() => {
                                setSelectedSiteCodes(selectedSiteCodes.filter(c => c !== code));
                              }}
                              className="ml-2 text-orange-600 hover:text-orange-800"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Navigate Button */}
                  <div className="flex justify-end pt-4 border-t border-gray-200">
                    <button
                      onClick={async () => {
                        if (selectedSiteCodes.length === 0) {
                          alert('Please select at least one site code.');
                          return;
                        }

                        try {
                          const token = localStorage.getItem('token');
                          if (!token) {
                            alert('Authentication required. Please login again.');
                            return;
                          }

                          // Get current location first
                          let currentLocation: { lat: number; lng: number } | null = null;
                          try {
                            currentLocation = await new Promise<{ lat: number; lng: number }>((resolve, reject) => {
                              if (!navigator.geolocation) {
                                reject(new Error('Geolocation is not supported by your browser'));
                                return;
                              }

                              navigator.geolocation.getCurrentPosition(
                                (position) => {
                                  resolve({
                                    lat: position.coords.latitude,
                                    lng: position.coords.longitude
                                  });
                                },
                                (error) => {
                                  reject(error);
                                },
                                {
                                  enableHighAccuracy: true,
                                  timeout: 10000,
                                  maximumAge: 0
                                }
                              );
                            });
                          } catch (geoError) {
                            console.warn('Error getting current location:', geoError);
                            alert('Unable to get your current location. Please allow location access or the route will start without your current location.');
                            // Continue without current location
                          }

                          // Fetch coordinates from Location database
                          const locationsRes = await fetch(`${API_BASE}/api/locations/by-site-codes`, {
                            method: 'POST',
                            headers: { 
                              'Authorization': `Bearer ${token}`,
                              'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ siteCodes: selectedSiteCodes })
                          });

                          if (!locationsRes.ok) {
                            throw new Error('Failed to fetch locations');
                          }

                          const locationsJson = await locationsRes.json();
                          if (!locationsJson?.success || !Array.isArray(locationsJson.locations)) {
                            throw new Error('Invalid response from server');
                          }

                          const locationCoordinates = locationsJson.locations
                            .filter((loc: any) => loc.latitude && loc.longitude)
                            .map((loc: { latitude: number; longitude: number; name: string }) => ({
                              lat: loc.latitude,
                              lng: loc.longitude,
                              name: loc.name
                            }));

                          if (locationCoordinates.length === 0) {
                            alert(`No location coordinates found for the selected site codes.\n\nPlease check:\n1. Site codes are uploaded in Admin panel Location tab\n2. Site codes match exactly (case-sensitive)\n\nSelected site codes: ${selectedSiteCodes.join(', ')}`);
                            return;
                          }

                          // Open Google Maps with navigation
                          if (currentLocation) {
                            // Use current location as origin
                            if (locationCoordinates.length === 1) {
                              // Single destination: origin (current) to destination
                              const dest = locationCoordinates[0];
                              window.open(`https://www.google.com/maps/dir/?api=1&origin=${currentLocation.lat},${currentLocation.lng}&destination=${dest.lat},${dest.lng}`, '_blank');
                            } else {
                              // Multiple destinations: origin (current) to first destination, then waypoints
                              const firstDest = locationCoordinates[0];
                              const waypoints = locationCoordinates.slice(1).map((loc: { lat: number; lng: number }) => `${loc.lat},${loc.lng}`).join('|');
                              const finalDest = locationCoordinates[locationCoordinates.length - 1];
                              
                              if (waypoints) {
                                // Multiple waypoints
                                window.open(`https://www.google.com/maps/dir/?api=1&origin=${currentLocation.lat},${currentLocation.lng}&destination=${finalDest.lat},${finalDest.lng}&waypoints=${waypoints}`, '_blank');
                              } else {
                                // Just origin and destination
                                window.open(`https://www.google.com/maps/dir/?api=1&origin=${currentLocation.lat},${currentLocation.lng}&destination=${firstDest.lat},${firstDest.lng}`, '_blank');
                              }
                            }
                          } else {
                            // Fallback: no current location, use first location as starting point
                            if (locationCoordinates.length === 1) {
                              const loc = locationCoordinates[0];
                              window.open(`https://www.google.com/maps?q=${loc.lat},${loc.lng}`, '_blank');
                            } else {
                              // Multiple locations: create a route with waypoints (first as origin)
                              const firstLoc = locationCoordinates[0];
                              const waypoints = locationCoordinates.slice(1).map((loc: { lat: number; lng: number }) => `${loc.lat},${loc.lng}`).join('|');
                              const finalDest = locationCoordinates[locationCoordinates.length - 1];
                              window.open(`https://www.google.com/maps/dir/?api=1&origin=${firstLoc.lat},${firstLoc.lng}&destination=${finalDest.lat},${finalDest.lng}&waypoints=${waypoints}`, '_blank');
                            }
                          }

                          // Close modal after navigation
                          setShowMyDirectionsModal(false);
                          setDirectionsSiteCodeInput('');
                          setSelectedSiteCodes([]);
                        } catch (error) {
                          console.error('Error navigating to locations:', error);
                          alert('Error fetching locations. Please try again.');
                        }
                      }}
                      disabled={selectedSiteCodes.length === 0}
                      className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                        selectedSiteCodes.length > 0
                          ? 'bg-orange-600 text-white hover:bg-orange-700'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      Navigate
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Check My Device Dialog */}
          {showCheckDeviceDialog && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  closeDialog();
                }
              }}
            >
              <div 
                className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6 border-b border-blue-200 bg-gradient-to-r from-blue-100 to-indigo-100">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-gray-800">Check My Device</h2>
                    <button
                      onClick={closeDialog}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {/* Site Code Input */}
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Enter Site Code
                    </label>
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          value={siteCode}
                          onChange={handleSiteCodeChange}
                          onKeyDown={handleSiteCodeKeyDown}
                          onFocus={() => {
                            if (filteredSiteCodeSuggestions.length > 0) {
                              setShowSiteCodeSuggestions(true);
                            }
                          }}
                          onBlur={() => {
                            // Delay to allow click on suggestion
                            setTimeout(() => {
                              setShowSiteCodeSuggestions(false);
                              setSelectedSuggestionIndex(-1);
                            }, 200);
                          }}
                          placeholder="Enter Site Code to search..."
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          autoComplete="off"
                        />
                        
                        {/* Suggestions dropdown */}
                        {showSiteCodeSuggestions && filteredSiteCodeSuggestions.length > 0 && (
                          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                            {filteredSiteCodeSuggestions.map((suggestion, index) => (
                              <div
                                key={suggestion}
                                onClick={() => handleSelectSuggestion(suggestion)}
                                onMouseDown={(e) => e.preventDefault()}
                                className={`px-4 py-2 text-sm cursor-pointer hover:bg-blue-50 ${
                                  index === selectedSuggestionIndex ? 'bg-blue-100' : ''
                                } ${index === 0 ? 'rounded-t-md' : ''} ${
                                  index === filteredSiteCodeSuggestions.length - 1 ? 'rounded-b-md' : ''
                                }`}
                                onMouseEnter={() => setSelectedSuggestionIndex(index)}
                              >
                                {suggestion}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={handleSiteCodeSearch}
                        disabled={isLoadingDeviceData}
                        className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isLoadingDeviceData ? 'Searching...' : 'Search'}
                      </button>
                    </div>
                    {deviceDataError && (
                      <p className="mt-2 text-sm text-red-600">{deviceDataError}</p>
                    )}
                  </div>

                  {/* Device Data Display - ALWAYS show after search, regardless of radio button selection */}
                  {deviceData !== null && (
                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">Device Information</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-600">DEVICE STATUS</label>
                          <p className="mt-1 text-gray-800 font-semibold">{deviceData.deviceStatus || '-'}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-600">DIVISION</label>
                          <p className="mt-1 text-gray-800 font-semibold">{deviceData.division || '-'}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-600">SUB DIVISION</label>
                          <p className="mt-1 text-gray-800 font-semibold">{deviceData.subDivision || '-'}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-600">HRN</label>
                          <p className="mt-1 text-gray-800 font-semibold">{deviceData.hrn || '-'}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-600">NO OF DAYS OFFLINE</label>
                          <p className="mt-1 text-gray-800 font-semibold">{deviceData.noOfDaysOffline !== undefined && deviceData.noOfDaysOffline !== null && deviceData.noOfDaysOffline !== '' ? deviceData.noOfDaysOffline : '-'}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Radio Buttons - Show when deviceData exists (after search) */}
                  {deviceData !== null && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Select Option
                      </label>
                      <div className="flex gap-6">
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="radio"
                            name="deviceOption"
                            value="offline"
                            checked={selectedOption === 'offline'}
                            onChange={() => handleOptionChange('offline')}
                            className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-gray-700 font-medium">OFF LINE SITES</span>
                        </label>
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="radio"
                            name="deviceOption"
                            value="rtu"
                            checked={selectedOption === 'rtu'}
                            onChange={() => handleOptionChange('rtu')}
                            className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-gray-700 font-medium">RTU TRACKER</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Offline Sites Data */}
                  {selectedOption === 'offline' && offlineData && (
                    <div className="bg-blue-50 rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">OFF LINE SITES Data</h3>
                      <div className="space-y-3">
                        {/* Always show Task Status if offlineData exists */}
                        {offlineData.taskStatus && (
                          <div>
                            <label className="block text-sm font-medium text-gray-600">Task Status</label>
                            <p className="mt-1 text-gray-800 font-semibold">{offlineData.taskStatus}</p>
                          </div>
                        )}
                        {/* Always show Type of Issue if it exists (for both Pending and Resolved cases) */}
                        {/* Show even if taskStatus doesn't exist, as Pending cases may have Type of Issue without Task Status */}
                        {offlineData && (offlineData.typeOfIssue || offlineData.taskStatus || offlineData.remarks) && (
                          <div>
                            <label className="block text-sm font-medium text-gray-600">Type of Issue</label>
                            <p className="mt-1 text-gray-800 font-semibold">{offlineData.typeOfIssue || '-'}</p>
                          </div>
                        )}
                        {/* Always show Remarks if it exists (for both Pending and Resolved cases) */}
                        {/* Show even if taskStatus doesn't exist, as Pending cases may have Remarks without Task Status */}
                        {offlineData && (offlineData.remarks !== undefined || offlineData.typeOfIssue || offlineData.taskStatus) && (
                          <div>
                            <label className="block text-sm font-medium text-gray-600">Remarks</label>
                            <p className="mt-1 text-gray-800 font-semibold">{offlineData.remarks || '-'}</p>
                          </div>
                        )}
                        {!offlineData.taskStatus && !offlineData.typeOfIssue && !offlineData.remarks && (
                          <p className="text-gray-500">No data available for this site code in OFF LINE SITES</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* RTU Tracker Data */}
                  {selectedOption === 'rtu' && rtuData && (
                    <div className="bg-green-50 rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">RTU TRACKER Data</h3>
                      <div className="space-y-3">
                        {rtuData.rtuTrackerObservation && (
                          <div>
                            <label className="block text-sm font-medium text-gray-600">RTU TRACKER OBSERVATION</label>
                            <p className="mt-1 text-gray-800 font-semibold">{rtuData.rtuTrackerObservation}</p>
                          </div>
                        )}
                        {rtuData.taskStatus && (
                          <div>
                            <label className="block text-sm font-medium text-gray-600">Task Status</label>
                            <p className="mt-1 text-gray-800 font-semibold">{rtuData.taskStatus}</p>
                          </div>
                        )}
                        {rtuData.remarks && (
                          <div>
                            <label className="block text-sm font-medium text-gray-600">Remarks</label>
                            <p className="mt-1 text-gray-800 font-semibold">{rtuData.remarks}</p>
                          </div>
                        )}
                        {!rtuData.rtuTrackerObservation && !rtuData.taskStatus && !rtuData.remarks && (
                          <p className="text-gray-500">No data available for this site code in RTU TRACKER</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* My Sites Dialog */}
          {showMySitesDialog && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  closeMySitesDialog();
                }
              }}
            >
              <div 
                className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6 border-b border-green-200 bg-gradient-to-r from-green-100 to-emerald-100">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-gray-800">My Sites</h2>
                    <button
                      onClick={closeMySitesDialog}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {/* Application Dropdown - First Field */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Application
                    </label>
                    <select
                      value={application}
                      onChange={(e) => handleApplicationChange(e.target.value as 'offline' | 'rtu' | '')}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white"
                    >
                      <option value="">Select Application</option>
                      <option value="offline">OFFLINE SITES</option>
                      <option value="rtu">RTU TRACKER</option>
                    </select>
                  </div>

                  {/* Division Dropdown - Second Field (when OFFLINE SITES is selected) */}
                  {application === 'offline' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Division
                      </label>
                      <select
                        value={division}
                        onChange={(e) => handleDivisionChange(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white"
                        disabled={!user?.division || (Array.isArray(user.division) && user.division.length === 0)}
                      >
                        <option value="">
                          {!user?.division || (Array.isArray(user.division) && user.division.length === 0)
                            ? 'No divisions assigned'
                            : Array.isArray(user.division) && user.division.length > 1
                            ? 'Select Division'
                            : 'Select Division'}
                        </option>
                        {user?.division && Array.isArray(user.division) && user.division.length > 0
                          ? user.division.map((div: string) => (
                              <option key={div} value={div}>
                                {div}
                              </option>
                            ))
                          : user?.division && typeof user.division === 'string'
                          ? (
                              <option value={user.division}>{user.division}</option>
                            )
                          : null}
                      </select>
                      {user?.division && Array.isArray(user.division) && user.division.length === 1 && !division && (
                        <p className="mt-1 text-sm text-gray-500">Your assigned division: {user.division[0]}</p>
                      )}
                    </div>
                  )}

                  {/* Sub Division Dropdown - Third Field (when OFFLINE SITES and Division are selected) */}
                  {application === 'offline' && division && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Sub Division
                      </label>
                      {isLoadingSubDivisions ? (
                        <div className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50">
                          <p className="text-gray-500 text-sm">Loading sub divisions...</p>
                        </div>
                      ) : (
                        <select
                          value={subDivision}
                          onChange={(e) => handleSubDivisionChange(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white"
                          disabled={subDivisionSuggestions.length === 0}
                        >
                          <option value="">
                            {subDivisionSuggestions.length === 0 
                              ? 'No sub divisions found for this division'
                              : 'Select Sub Division'}
                          </option>
                          {subDivisionSuggestions.map((sd) => (
                            <option key={sd} value={sd}>
                              {sd}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}

                  {/* Table with 4 columns (when OFFLINE SITES, Division, and Sub Division are selected) */}
                  {application === 'offline' && division && (
                    <>

                      {/* Table with 4 columns */}
                      {subDivision && (
                        <div className="bg-white rounded-lg p-4 border border-green-200">
                          <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-gray-800">Site Details</h3>
                            <div className="flex gap-2">
                              <button
                                onClick={addTableRow}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                              >
                                Add
                              </button>
                              <button
                                onClick={resetTableRows}
                                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm font-medium"
                              >
                                Reset
                              </button>
                              <button
                                onClick={navigateToLocations}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                              >
                                Navigate
                              </button>
                            </div>
                          </div>
                          
                          {tableRows.length === 0 ? (
                            <p className="text-gray-500 text-center py-4">Click "Add" to add a new row</p>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full border-collapse border border-gray-300">
                                <thead>
                                  <tr className="bg-green-100">
                                    <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold text-gray-700">Site Code</th>
                                    <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold text-gray-700">No of Days Offline</th>
                                    <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold text-gray-700">Map</th>
                                    <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold text-gray-700">Site Observations</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {tableRows.map((row) => (
                                    <tr key={row.id} className="hover:bg-gray-50">
                                      <td className="border border-gray-300 px-4 py-2">
                                        <select
                                          value={row.siteCode}
                                          onChange={(e) => handleTableSiteCodeChange(row.id, e.target.value)}
                                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                                        >
                                          <option value="">Select Site Code</option>
                                          {siteCodesForSubDivision.map((sc) => (
                                            <option key={sc} value={sc}>{sc}</option>
                                          ))}
                                        </select>
                                      </td>
                                      <td className="border border-gray-300 px-4 py-2">
                                        <input
                                          type="text"
                                          value={row.noOfDaysOffline}
                                          readOnly
                                          className="w-full px-2 py-1 border border-gray-300 rounded bg-gray-50 text-sm"
                                        />
                                      </td>
                                      <td className="border border-gray-300 px-4 py-2 text-center">
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            // Toggle: if checked, uncheck; if unchecked, check
                                            const newValue = !row.mapSelected;
                                            updateTableRow(row.id, 'mapSelected', newValue);
                                            if (newValue && row.siteCode) {
                                              // Fetch KML file path for this site code
                                              // Use the first available location's fieldId to access via API
                                              if (locations.length > 0 && locations[0].fieldId) {
                                                // Store the API endpoint path for the KML file
                                                updateTableRow(row.id, 'kmlFilePath', `/api/admin/uploads/files/${locations[0].fieldId}`);
                                              } else if (locations.length > 0) {
                                                // Fallback to fileUrl if fieldId not available
                                                updateTableRow(row.id, 'kmlFilePath', locations[0].kmlFilePath || '');
                                              }
                                            } else if (!newValue) {
                                              // Clear KML file path when deselected
                                              updateTableRow(row.id, 'kmlFilePath', '');
                                            }
                                          }}
                                          className="relative inline-flex items-center justify-center w-4 h-4 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 rounded-full cursor-pointer"
                                          aria-label={row.mapSelected ? "Deselect map" : "Select map"}
                                        >
                                          {/* Radio button appearance */}
                                          <div className={`w-4 h-4 rounded-full border-2 transition-all ${
                                            row.mapSelected 
                                              ? 'border-green-600 bg-green-600' 
                                              : 'border-gray-300 bg-white'
                                          }`}>
                                            {row.mapSelected && (
                                              <div className="absolute inset-0 flex items-center justify-center">
                                                <div className="w-2 h-2 bg-white rounded-full"></div>
                                              </div>
                                            )}
                                          </div>
                                        </button>
                                      </td>
                                      <td className="border border-gray-300 px-4 py-2">
                                        <select
                                          value={row.siteObservation}
                                          onChange={(e) => {
                                            const value = e.target.value as 'Pending' | 'Resolved' | '';
                                            if (value === 'Pending' || value === 'Resolved') {
                                              // Open dialog for both Pending and Resolved
                                              openSiteObservationDialog(row.id, value);
                                            } else {
                                              // Clear if "Select Status" is selected
                                              updateTableRow(row.id, 'siteObservation', '');
                                            }
                                          }}
                                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                                        >
                                          <option value="">Select Status</option>
                                          <option value="Pending">Pending</option>
                                          <option value="Resolved">Resolved</option>
                                        </select>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Site Observation Dialog */}
          {showSiteObservationDialog && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-center justify-center"
              style={{ padding: '20px' }}
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  closeSiteObservationDialog();
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
                  {siteObservationStatus === 'pending' && (
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
                            typeOfSpare: newTypeOfIssue === 'Spare Required' ? prev.typeOfSpare : [],
                            specifySpareOther: newTypeOfIssue === 'Spare Required' && prev.typeOfSpare.includes('OTHERS') ? prev.specifySpareOther : ''
                          }));
                          if (newTypeOfIssue !== 'Spare Required') {
                            setIsTypeOfSpareDropdownOpen(false);
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
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
                  {siteObservationStatus === 'pending' && siteObservationsDialogData.typeOfIssue === 'Others' && (
                    <div className="mb-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1.5 text-center">
                        Please Specify <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={siteObservationsDialogData.specifyOther}
                        onChange={(e) => setSiteObservationsDialogData(prev => ({ ...prev, specifyOther: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                        placeholder="Please specify..."
                      />
                    </div>
                  )}

                  {/* Type of Spare - Only when Spare Required is selected */}
                  {siteObservationStatus === 'pending' && siteObservationsDialogData.typeOfIssue === 'Spare Required' && (
                    <div className="mb-3 relative">
                      <label className="block text-sm font-medium text-gray-700 mb-1.5 text-center">
                        Type of Spare <span className="text-red-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsTypeOfSpareDropdownOpen(!isTypeOfSpareDropdownOpen)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-left flex justify-between items-center bg-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      >
                        <span className={siteObservationsDialogData.typeOfSpare.length === 0 ? 'text-gray-400' : 'text-gray-700'}>
                          {siteObservationsDialogData.typeOfSpare.length === 0 ? 'Select Type of Spare' : `${siteObservationsDialogData.typeOfSpare.length} selected`}
                        </span>
                        <span className="text-gray-400">▼</span>
                      </button>
                      
                      {isTypeOfSpareDropdownOpen && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                          {[
                            'AT PT FUSES', '24 V SMPS', '12 V SMPS', 'DC TO DC CONVERTER', 'CONTROL CARD',
                            'BATTERY CHARGER', 'LT FUSE', 'TB', 'AC MCB', 'DC MCB', 'L/R SWITCH',
                            'SPRING RETURN ON/OFF SWITCH', 'RELAY', 'RELAY CELLS', 'SURGE ARRESTOR',
                            'AUX TRANSFORMER (AT)', 'POTENTIAL TRANSFORMER (PT)', 'CURRENT TRANSFORMER (CT)',
                            'MULTI FUNTION METER (MFM)', 'MOTOR', 'VPIS', 'SF6 GAS', 'EMERGENCY SWITCH',
                            'HYDRAULIC LIFT', 'PUSH BUTTON', 'FAULT PASSAGE INDICATOR (FPI)', 'FPI CELLS',
                            'HOOTER', 'LIMIT SWITCH', 'CABLE DOOR', 'CABLE BOOT', 'CABLE CLAMPS',
                            'VERMIN PROOF AGENT', '12V BATTERY', 'AC PROPTECTOR', 'CMU BOARD', 'CONTROLLER',
                            'PTN BOARD', 'VOLTAGE CARD', 'CAPACITOR BANK', 'HMI', 'TRANSFORMER (230/30V)',
                            'OD OPERATING MECHANISM', 'VL OPERATING MECHNISM', 'OD AB3 CARD', 'VL AB3 CARD',
                            'OD AUXILIARY SWITCH', 'VL AUXILIARY SWITCH', 'MONO METER', 'NRV', 'DOOR HINGES',
                            'SURFACE HEATER', 'TRIPPING COIL', 'OPERATING HANDLE', 'EARTHING STRIPS',
                            'EARTHING PIPE', 'COAL & SALT MIX', 'BENTONITE', 'OTHERS'
                          ].map(option => (
                            <label
                              key={option}
                              className="flex items-center px-4 py-2 hover:bg-green-50 cursor-pointer"
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
                                      newSpares = currentSpares.filter(s => s !== option);
                                    } else {
                                      newSpares = [...currentSpares, option];
                                    }
                                    
                                    const specifyOther = newSpares.includes('OTHERS') ? prev.specifySpareOther : '';
                                    
                                    return {
                                      ...prev,
                                      typeOfSpare: newSpares,
                                      specifySpareOther: specifyOther
                                    };
                                  });
                                }}
                                className="mr-2 h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                              />
                              <span className="text-sm text-gray-700">{option}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Please Specify Spare - Only when OTHERS is selected in Type of Spare */}
                  {siteObservationStatus === 'pending' && siteObservationsDialogData.typeOfIssue === 'Spare Required' && siteObservationsDialogData.typeOfSpare.includes('OTHERS') && (
                    <div className="mb-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1.5 text-center">
                        Please Specify <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={siteObservationsDialogData.specifySpareOther}
                        onChange={(e) => setSiteObservationsDialogData(prev => ({ ...prev, specifySpareOther: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                        placeholder="Please specify..."
                      />
                    </div>
                  )}

                  {/* Remarks */}
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5 text-center">
                      Remarks {siteObservationStatus === 'resolved' && <span className="text-red-500">*</span>}
                    </label>
                    <textarea
                      value={siteObservationsDialogData.remarks}
                      onChange={(e) => setSiteObservationsDialogData(prev => ({ ...prev, remarks: e.target.value }))}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 resize-none text-sm"
                      placeholder="Enter remarks..."
                    />
                  </div>

                  {/* Photo Options */}
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
                            setSiteObservationsCameraStream(stream);
                            setShowSiteObservationsCameraPreview(true);
                            setSiteObservationsCapturedImageData(null);
                          } catch (error) {
                            console.error('Error accessing camera:', error);
                            alert('Could not access camera. Please check permissions or use Upload Photo instead.');
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
                          {siteObservationsDialogData.capturedPhotos.map((photo, idx) => (
                            <div key={`captured-${idx}`} className="relative">
                              <img
                                src={photo.data}
                                alt={`Captured ${idx + 1}`}
                                className="w-16 h-16 object-cover rounded border border-gray-300"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setSiteObservationsDialogData(prev => ({
                                    ...prev,
                                    capturedPhotos: prev.capturedPhotos.filter((_, i) => i !== idx)
                                  }));
                                }}
                                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                          {siteObservationsDialogData.uploadedPhotos.map((photo, idx) => (
                            <div key={`uploaded-${idx}`} className="relative">
                              <img
                                src={URL.createObjectURL(photo)}
                                alt={`Uploaded ${idx + 1}`}
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
                                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
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

                {/* Footer with Cancel and Submit buttons */}
                <div 
                  className="px-5 pb-5 pt-3 border-t border-gray-200 flex-shrink-0"
                  style={{
                    minHeight: '70px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: '20px'
                  }}
                >
                  <button
                    type="button"
                    onClick={closeSiteObservationDialog}
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
                    onClick={submitSiteObservation}
                    disabled={isSubmittingSiteObservations}
                    style={{
                      backgroundColor: '#3b82f6',
                      color: '#ffffff',
                      padding: '10px 20px',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: isSubmittingSiteObservations ? 'not-allowed' : 'pointer',
                      minWidth: '100px',
                      opacity: isSubmittingSiteObservations ? 0.6 : 1
                    }}
                    onMouseEnter={(e) => {
                      if (!isSubmittingSiteObservations) {
                        e.currentTarget.style.backgroundColor = '#2563eb';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSubmittingSiteObservations) {
                        e.currentTarget.style.backgroundColor = '#3b82f6';
                      }
                    }}
                  >
                    {isSubmittingSiteObservations ? 'Submitting...' : 'Submit'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Camera Preview Modal */}
          {showSiteObservationsCameraPreview && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-75 z-[101] flex items-center justify-center p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  if (siteObservationsCameraStreamRef.current) {
                    siteObservationsCameraStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
                    siteObservationsCameraStreamRef.current = null;
                  }
                  setShowSiteObservationsCameraPreview(false);
                  setSiteObservationsCameraStream(null);
                }
              }}
            >
              <div 
                className="bg-white rounded-lg p-4 max-w-md w-full"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-gray-800 mb-2">Camera Preview</h3>
                  <video
                    id="site-observations-camera-preview"
                    autoPlay
                    playsInline
                    className="w-full rounded border border-gray-300"
                    style={{ maxHeight: '400px' }}
                  />
                  {siteObservationsCapturedImageData && (
                    <img
                      src={siteObservationsCapturedImageData}
                      alt="Captured"
                      className="w-full rounded border border-gray-300 mt-2"
                      style={{ maxHeight: '400px' }}
                    />
                  )}
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (siteObservationsCameraStreamRef.current) {
                        siteObservationsCameraStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
                        siteObservationsCameraStreamRef.current = null;
                      }
                      setShowSiteObservationsCameraPreview(false);
                      setSiteObservationsCameraStream(null);
                      setSiteObservationsCapturedImageData(null);
                    }}
                    className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const video = document.getElementById('site-observations-camera-preview') as HTMLVideoElement;
                      if (video && video.videoWidth > 0) {
                        const canvas = document.createElement('canvas');
                        canvas.width = video.videoWidth;
                        canvas.height = video.videoHeight;
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                          ctx.drawImage(video, 0, 0);
                          const dataUrl = canvas.toDataURL('image/jpeg');
                          
                          // Get location if available
                          let latitude: number | undefined;
                          let longitude: number | undefined;
                          let location: string | undefined;
                          
                          try {
                            if (navigator.geolocation) {
                              const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                                navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
                              });
                              latitude = position.coords.latitude;
                              longitude = position.coords.longitude;
                            }
                          } catch (e) {
                            console.log('Location not available');
                          }
                          
                          setSiteObservationsDialogData(prev => ({
                            ...prev,
                            capturedPhotos: [...prev.capturedPhotos, {
                              data: dataUrl,
                              latitude,
                              longitude,
                              timestamp: new Date().toISOString(),
                              location: location || 'N/A'
                            }]
                          }));
                        }
                      }
                      
                      if (siteObservationsCameraStreamRef.current) {
                        siteObservationsCameraStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
                        siteObservationsCameraStreamRef.current = null;
                      }
                      setShowSiteObservationsCameraPreview(false);
                      setSiteObservationsCameraStream(null);
                      setSiteObservationsCapturedImageData(null);
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Capture
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    // Other non-Admin users see the simple dashboard
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Dashboard</h2>
          <p className="text-gray-600">Welcome to your dashboard. Equipment role features coming soon.</p>
        </div>
      </div>
    );
  }

  // Admin users see the detailed dashboard with stats
  if (!stats) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Dashboard</h2>
          <p className="text-gray-600">Unable to load dashboard statistics.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg shadow-lg p-6 text-white">
        <h2 className="text-3xl font-bold mb-2">User Management Dashboard</h2>
        <p className="text-blue-100">Overview of user statistics and system performance</p>
      </div>

      {/* Main Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Total Users */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">Total Users</p>
              <p className="text-4xl font-bold mt-2">{stats.totalUsers}</p>
            </div>
            <div className="bg-white/20 rounded-full p-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Approved Users */}
        <div className="bg-gradient-to-br from-green-500 to-green-700 rounded-xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium">Approved Users</p>
              <p className="text-4xl font-bold mt-2">{stats.approvedUsers}</p>
            </div>
            <div className="bg-white/20 rounded-full p-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Pending Users */}
        <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-100 text-sm font-medium">Pending Approval</p>
              <p className="text-4xl font-bold mt-2">{stats.pendingUsers}</p>
            </div>
            <div className="bg-white/20 rounded-full p-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Rejected Users */}
        <div className="bg-gradient-to-br from-red-500 to-red-700 rounded-xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm font-medium">Rejected Users</p>
              <p className="text-4xl font-bold mt-2">{stats.rejectedUsers}</p>
            </div>
            <div className="bg-white/20 rounded-full p-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Active Users */}
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-indigo-100 text-sm font-medium">Active Users</p>
              <p className="text-4xl font-bold mt-2">{stats.activeUsers}</p>
            </div>
            <div className="bg-white/20 rounded-full p-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Inactive Users */}
        <div className="bg-gradient-to-br from-gray-500 to-gray-700 rounded-xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-100 text-sm font-medium">Inactive Users</p>
              <p className="text-4xl font-bold mt-2">{stats.inactiveUsers}</p>
            </div>
            <div className="bg-white/20 rounded-full p-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Role Distribution Section */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-2xl font-bold text-gray-800 mb-4">User Distribution by Role</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Object.entries(stats.roleCounts).map(([role, count]) => (
            <div key={role} className="bg-gradient-to-br from-purple-400 to-purple-600 rounded-lg p-4 text-white transform hover:scale-105 transition-transform shadow-md">
              <p className="text-purple-100 text-sm font-medium">{role}</p>
              <p className="text-3xl font-bold mt-1">{count}</p>
            </div>
          ))}
        </div>
        {Object.keys(stats.roleCounts).length === 0 && (
          <p className="text-gray-500 text-center py-4">No role data available</p>
        )}
      </div>

      {/* Application Distribution Section */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-2xl font-bold text-gray-800 mb-4">User Distribution by Application</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(stats.applicationCounts).map(([app, count]) => (
            <div key={app} className="bg-gradient-to-br from-teal-400 to-teal-600 rounded-lg p-4 text-white transform hover:scale-105 transition-transform shadow-md">
              <p className="text-teal-100 text-sm font-medium">{app}</p>
              <p className="text-3xl font-bold mt-1">{count}</p>
            </div>
          ))}
        </div>
        {Object.keys(stats.applicationCounts).length === 0 && (
          <p className="text-gray-500 text-center py-4">No application mapping data available</p>
        )}
      </div>

      {/* Donut Chart Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-2xl font-bold text-gray-800 mb-4">User Distribution by Designation</h3>
          {stats.designationCounts && Object.keys(stats.designationCounts).length > 0 ? (
            <div className="flex justify-center items-center">
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie
                    data={Object.entries(stats.designationCounts).map(([name, value]) => ({ name, value }))}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }: { name?: string; percent?: number }) => {
                      const safeName = name ?? 'Unknown';
                      const safePercent = typeof percent === 'number' ? percent * 100 : 0;
                      return `${safeName}: ${safePercent.toFixed(0)}%`;
                    }}
                    outerRadius={120}
                    innerRadius={60}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {Object.entries(stats.designationCounts).map(([designation], index) => (
                      <Cell key={`cell-${designation}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No designation data available</p>
          )}
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-2xl font-bold text-gray-800 mb-4">Designation Breakdown</h3>
          <div className="space-y-3">
            {stats.designationCounts && Object.entries(stats.designationCounts).map(([designation, count], index) => (
              <div key={designation} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-4 h-4 rounded-full" 
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  ></div>
                  <span className="text-sm font-medium text-gray-700">{designation}</span>
                </div>
                <span className="text-lg font-bold text-gray-800">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


