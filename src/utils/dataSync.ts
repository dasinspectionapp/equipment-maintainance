// Data synchronization utility for web app
// Syncs localStorage data with backend API

const API_BASE = 'http://localhost:5000';

export interface DataState {
  siteObservations: Record<string, string>;
  taskStatus: Record<string, string>;
  typeOfIssue: Record<string, string>;
  viewPhotos: Record<string, string[]>;
  remarks: Record<string, string>;
  photoMetadata: Record<string, any>;
  supportDocuments: Record<string, any>;
}

// Debounce function for sync operations
let syncTimeouts: Record<string, ReturnType<typeof setTimeout>> = {};

export const debounceSync = (fileId: string, data: DataState, delay: number = 2000) => {
  // Clear existing timeout for this file
  if (syncTimeouts[fileId]) {
    clearTimeout(syncTimeouts[fileId]);
  }

  // Set new timeout
  syncTimeouts[fileId] = setTimeout(() => {
    syncUserDataState(fileId, data);
    delete syncTimeouts[fileId];
  }, delay);
};

// Sync user data state to API
export const syncUserDataState = async (fileId: string, data: DataState) => {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('No token found, cannot sync to API');
      return;
    }

    const response = await fetch(`${API_BASE}/api/user-data-state/${fileId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...data,
        savedFrom: 'Web Application',
      }),
    });

    if (response.ok) {
      console.log(`✓ Synced data state for file ${fileId} to API`);
      return true;
    } else {
      console.warn(`Failed to sync data state for file ${fileId}`);
      return false;
    }
  } catch (error) {
    console.warn('Error syncing to API:', error);
    return false;
  }
};

// Load user data state from API
export const loadUserDataState = async (fileId: string): Promise<DataState | null> => {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('No token found, cannot load from API');
      return null;
    }

    const response = await fetch(`${API_BASE}/api/user-data-state/${fileId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const result = await response.json();
      if (result.success && result.data) {
        console.log(`✓ Loaded data state for file ${fileId} from API`);
        return result.data;
      }
    }
    return null;
  } catch (error) {
    console.warn('Error loading from API:', error);
    return null;
  }
};

// Load all user data states from API
export const loadAllUserDataStates = async (): Promise<Record<string, DataState> | null> => {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('No token found, cannot load from API');
      return null;
    }

    const response = await fetch(`${API_BASE}/api/user-data-state`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const result = await response.json();
      if (result.success && result.data) {
        console.log(`✓ Loaded ${result.count || 0} data states from API`);
        return result.data;
      }
    }
    return null;
  } catch (error) {
    console.warn('Error loading all data states from API:', error);
    return null;
  }
};

// Bulk sync all localStorage data to API
export const bulkSyncAllDataStates = async () => {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('No token found, cannot bulk sync to API');
      return;
    }

    // Get all keys from localStorage that match the pattern
    const dataStates: Array<{ fileId: string; data: DataState }> = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('myData_')) {
        const fileId = key.replace('myData_', '');
        try {
          const data = JSON.parse(localStorage.getItem(key) || '{}');
          dataStates.push({ fileId, data });
        } catch (error) {
          console.warn(`Error parsing data for ${key}:`, error);
        }
      }
    }

    if (dataStates.length === 0) {
      console.log('No data states to sync');
      return;
    }

    // Prepare bulk sync payload
    const payload = dataStates.map(({ fileId, data }) => ({
      fileId,
      ...data,
      savedFrom: 'Web Application',
    }));

    const response = await fetch(`${API_BASE}/api/user-data-state/bulk-sync`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ dataStates: payload }),
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`✓ Bulk synced ${result.successCount || 0} data states to API`);
      return true;
    } else {
      console.warn('Failed to bulk sync data states');
      return false;
    }
  } catch (error) {
    console.warn('Error bulk syncing to API:', error);
    return false;
  }
};

// Sync site observations to API (for My Sites dialog)
export const syncSiteObservation = async (siteCode: string, observationData: any) => {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('No token found, cannot sync site observation to API');
      return;
    }

    const response = await fetch(`${API_BASE}/api/site-observations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        siteCode: siteCode.trim().toUpperCase(),
        ...observationData,
        savedFrom: 'Web Application',
      }),
    });

    if (response.ok) {
      console.log(`✓ Synced site observation for ${siteCode} to API`);
      return true;
    } else {
      console.warn(`Failed to sync site observation for ${siteCode}`);
      return false;
    }
  } catch (error) {
    console.warn('Error syncing site observation to API:', error);
    return false;
  }
};


