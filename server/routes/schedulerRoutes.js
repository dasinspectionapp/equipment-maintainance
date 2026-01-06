import express from 'express';
import { protect, adminOnly } from '../middleware/authMiddleware.js';
import {
  manualTriggerScheduler,
  fetchSchedulerStatus,
  getSchedulerLogs,
  manualUpdateOverdueTasks
} from '../controllers/schedulerController.js';

const router = express.Router();

// All routes require admin authentication
router.use(protect);
router.use(adminOnly);

// @route   POST /api/system/run-maintenance-scheduler
// @desc    Manually trigger maintenance scheduler
// @access  Private/Admin
router.post('/run-maintenance-scheduler', manualTriggerScheduler);

// @route   GET /api/system/scheduler-status
// @desc    Get current scheduler status
// @access  Private/Admin
router.get('/scheduler-status', fetchSchedulerStatus);

// @route   GET /api/system/scheduler-logs
// @desc    Get scheduler execution logs
// @access  Private/Admin
router.get('/scheduler-logs', getSchedulerLogs);

// @route   POST /api/system/update-overdue-tasks
// @desc    Manually update overdue tasks
// @access  Private/Admin
router.post('/update-overdue-tasks', manualUpdateOverdueTasks);

export default router;

