import { 
  runMaintenanceScheduler, 
  getSchedulerStatus,
  updateOverdueTasks 
} from '../services/maintenanceScheduler.service.js';
import SchedulerLog from '../models/SchedulerLog.js';

// @desc    Manually trigger maintenance scheduler
// @route   POST /api/system/run-maintenance-scheduler
// @access  Private/Admin
export const manualTriggerScheduler = async (req, res) => {
  try {
    const userId = req.user?.userId || 'ADMIN';
    
    console.log(`📡 Manual scheduler trigger requested by: ${userId}`);
    
    // Run scheduler
    const result = await runMaintenanceScheduler(userId, 'MANUAL');
    
    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Maintenance scheduler executed successfully',
        data: {
          tasksCreated: result.tasksCreated,
          tasksSkipped: result.tasksSkipped,
          rmusProcessed: result.rmusProcessed,
          errors: result.errors,
          executionTime: result.executionTime,
          status: result.status
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Scheduler execution failed',
        details: result.error
      });
    }
  } catch (error) {
    console.error('Error in manual scheduler trigger:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to trigger scheduler'
    });
  }
};

// @desc    Get scheduler status
// @route   GET /api/system/scheduler-status
// @access  Private/Admin
export const fetchSchedulerStatus = async (req, res) => {
  try {
    const status = await getSchedulerStatus();
    
    res.status(200).json({
      success: true,
      data: {
        status: status.isScheduled ? 'RUNNING' : 'STOPPED',
        isRunning: status.isRunning,
        lastRunAt: status.lastRunAt,
        nextRunAt: status.nextRunAt,
        lastRunStatus: status.lastRunStatus,
        tasksCreatedLastRun: status.tasksCreatedLastRun,
        lastRunErrors: status.lastRunErrors,
        lastRunExecutionTime: status.lastRunExecutionTime
      }
    });
  } catch (error) {
    console.error('Error fetching scheduler status:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch scheduler status'
    });
  }
};

// @desc    Get scheduler logs with pagination
// @route   GET /api/system/scheduler-logs
// @access  Private/Admin
export const getSchedulerLogs = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    
    const query = {};
    if (status) {
      query.status = status;
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const logs = await SchedulerLog.find(query)
      .sort({ runAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    const total = await SchedulerLog.countDocuments(query);
    
    res.status(200).json({
      success: true,
      data: logs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching scheduler logs:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch scheduler logs'
    });
  }
};

// @desc    Update overdue tasks manually
// @route   POST /api/system/update-overdue-tasks
// @access  Private/Admin
export const manualUpdateOverdueTasks = async (req, res) => {
  try {
    const count = await updateOverdueTasks();
    
    res.status(200).json({
      success: true,
      message: `Updated ${count} tasks to OVERDUE status`,
      data: {
        updatedCount: count
      }
    });
  } catch (error) {
    console.error('Error updating overdue tasks:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update overdue tasks'
    });
  }
};

