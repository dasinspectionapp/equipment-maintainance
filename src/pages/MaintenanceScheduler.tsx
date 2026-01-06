import { useState, useEffect } from 'react';
import BackButton from '../components/BackButton';
import { API_BASE } from '../utils/api';

interface SchedulerStatus {
  status: string;
  isRunning: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastRunStatus: string | null;
  tasksCreatedLastRun: number;
  lastRunErrors: string[];
  lastRunExecutionTime: number;
}

interface SchedulerLog {
  _id: string;
  runAt: string;
  tasksCreated: number;
  tasksSkipped: number;
  rmusProcessed: number;
  errors: string[];
  status: string;
  executionTime: number;
  triggerType: string;
  triggeredBy: string;
  details?: string;
}

export default function MaintenanceScheduler() {
  const [status, setStatus] = useState<SchedulerStatus | null>(null);
  const [logs, setLogs] = useState<SchedulerLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTriggering, setIsTriggering] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchSchedulerStatus();
    fetchSchedulerLogs();
    
    // Refresh status every 30 seconds
    const interval = setInterval(() => {
      fetchSchedulerStatus();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const fetchSchedulerStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/system/scheduler-status`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStatus(data.data);
      } else {
        console.error('Failed to fetch scheduler status');
      }
    } catch (error) {
      console.error('Error fetching scheduler status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSchedulerLogs = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/system/scheduler-logs?limit=10`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setLogs(data.data);
      }
    } catch (error) {
      console.error('Error fetching scheduler logs:', error);
    }
  };

  const handleManualTrigger = async () => {
    setShowConfirmModal(false);
    setIsTriggering(true);
    setMessage(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/system/run-maintenance-scheduler`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setMessage({
          type: 'success',
          text: `Scheduler executed successfully! ${data.data.tasksCreated} tasks created, ${data.data.tasksSkipped} skipped.`
        });
        
        // Refresh data
        await Promise.all([fetchSchedulerStatus(), fetchSchedulerLogs()]);
      } else {
        setMessage({
          type: 'error',
          text: data.error || 'Failed to execute scheduler'
        });
      }
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.message || 'Failed to execute scheduler'
      });
    } finally {
      setIsTriggering(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading scheduler status...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackButton />
      
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Maintenance Scheduler</h2>
          <p className="text-gray-600 mt-1">Automated maintenance task scheduler</p>
        </div>
      </div>

      {/* Message Banner */}
      {message && (
        <div className={`p-4 rounded-lg border-2 ${
          message.type === 'success' 
            ? 'bg-green-50 border-green-300 text-green-800' 
            : 'bg-red-50 border-red-300 text-red-800'
        }`}>
          <div className="flex items-center justify-between">
            <p className="font-medium">{message.text}</p>
            <button
              onClick={() => setMessage(null)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Scheduler Status Card */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Scheduler Status</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Status */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Status</p>
            <p className="text-xl font-bold">
              <span className={`px-3 py-1 rounded-full text-sm ${
                status?.status === 'RUNNING' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {status?.status || 'UNKNOWN'}
              </span>
            </p>
          </div>

          {/* Last Run */}
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Last Run</p>
            <p className="text-lg font-semibold text-gray-900">
              {formatDate(status?.lastRunAt || null)}
            </p>
            {status?.lastRunStatus && (
              <p className={`text-xs mt-1 font-medium ${
                status.lastRunStatus === 'SUCCESS' 
                  ? 'text-green-600' 
                  : status.lastRunStatus === 'PARTIAL'
                  ? 'text-yellow-600'
                  : 'text-red-600'
              }`}>
                {status.lastRunStatus}
              </p>
            )}
          </div>

          {/* Next Run */}
          <div className="p-4 bg-purple-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Next Scheduled Run</p>
            <p className="text-lg font-semibold text-gray-900">
              {formatDate(status?.nextRunAt || null)}
            </p>
            <p className="text-xs text-gray-500 mt-1">Daily at 2:00 AM</p>
          </div>

          {/* Tasks Created */}
          <div className="p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Tasks Created (Last Run)</p>
            <p className="text-3xl font-bold text-green-600">
              {status?.tasksCreatedLastRun || 0}
            </p>
            {status?.lastRunExecutionTime && (
              <p className="text-xs text-gray-500 mt-1">
                Exec time: {formatDuration(status.lastRunExecutionTime)}
              </p>
            )}
          </div>
        </div>

        {/* Last Run Errors */}
        {status?.lastRunErrors && status.lastRunErrors.length > 0 && (
          <div className="mt-4 p-4 bg-red-50 border-l-4 border-red-500 rounded">
            <p className="font-semibold text-red-900 mb-2">
              ⚠️ Errors in Last Run ({status.lastRunErrors.length})
            </p>
            <ul className="list-disc list-inside space-y-1">
              {status.lastRunErrors.slice(0, 5).map((error, index) => (
                <li key={index} className="text-sm text-red-700">{error}</li>
              ))}
              {status.lastRunErrors.length > 5 && (
                <li className="text-sm text-red-600 italic">
                  ... and {status.lastRunErrors.length - 5} more errors
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Manual Trigger Button */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <button
            onClick={() => setShowConfirmModal(true)}
            disabled={isTriggering || status?.isRunning}
            className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isTriggering ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Executing Scheduler...
              </>
            ) : (
              <>
                <span>⚡</span>
                Run Scheduler Now
              </>
            )}
          </button>
          <p className="text-sm text-gray-500 mt-2">
            Manually trigger the maintenance scheduler to create tasks immediately
          </p>
        </div>
      </div>

      {/* Scheduler Execution History */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Execution History</h3>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Run Time</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">RMUs</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Created</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Skipped</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Errors</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Duration</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {logs.length > 0 ? (
                logs.map((log) => (
                  <tr key={log._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {formatDate(log.runAt)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        log.triggerType === 'CRON' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {log.triggerType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        log.status === 'SUCCESS' 
                          ? 'bg-green-100 text-green-800' 
                          : log.status === 'PARTIAL'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{log.rmusProcessed}</td>
                    <td className="px-4 py-3 text-sm text-green-600 font-semibold">{log.tasksCreated}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{log.tasksSkipped}</td>
                    <td className="px-4 py-3 text-sm">
                      {log.errors.length > 0 ? (
                        <span className="text-red-600 font-medium">{log.errors.length}</span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDuration(log.executionTime)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
                    No execution history available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              Confirm Manual Execution
            </h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to run the maintenance scheduler now? This will process all eligible RMUs and create maintenance tasks.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleManualTrigger}
                className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Yes, Run Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

