// Utility function to log user activities
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
  photos?: string[]; // Store photo data URLs
  status?: string;
  priority?: string;
  assignedToUserId?: string;
  assignedToRole?: string;
  userName?: string; // Name of the user who performed the action
}

export function logActivity(activity: {
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
  userName?: string; // Optional: Name of the user who performed the action
}) {
  try {
    // Get current user
    const userStr = localStorage.getItem('user');
    if (!userStr) return;
    
    const user = JSON.parse(userStr);
    const userId = user?.userId || user?.userId || 'unknown';
    const userName = activity.userName || user?.fullName || user?.name || user?.userId || 'Unknown User';
    
    // Create log entry
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const time = now.toTimeString().split(' ')[0];
    
    const logEntry: ActivityLog = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: now.toISOString(),
      date,
      time,
      userName, // Always include user name
      ...activity
    };
    
    // Load existing logs
    const storageKey = `activityLogs_${userId}`;
    const savedLogs = localStorage.getItem(storageKey);
    const logs: ActivityLog[] = savedLogs ? JSON.parse(savedLogs) : [];
    
    // Add new log entry
    logs.push(logEntry);
    
    // Keep only last 1000 logs to prevent localStorage overflow
    const maxLogs = 1000;
    const trimmedLogs = logs.length > maxLogs 
      ? logs.slice(-maxLogs)
      : logs;
    
    // Save logs
    localStorage.setItem(storageKey, JSON.stringify(trimmedLogs));
    
    console.log('Activity logged:', logEntry);
  } catch (error) {
    console.error('Error logging activity:', error);
  }
}

