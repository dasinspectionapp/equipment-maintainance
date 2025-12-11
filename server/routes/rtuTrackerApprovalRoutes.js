import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  saveRTUTrackerApproval,
  getAllRTUTrackerApprovals,
  getRTUTrackerApprovalById,
  updateRTUTrackerApproval,
  deleteRTUTrackerApproval
} from '../controllers/rtuTrackerApprovalController.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Create or update RTU Tracker Approval
router.post('/', saveRTUTrackerApproval);

// Get all RTU Tracker Approvals for current user
router.get('/', getAllRTUTrackerApprovals);

// Get RTU Tracker Approval by ID
router.get('/:id', getRTUTrackerApprovalById);

// Update RTU Tracker Approval
router.put('/:id', updateRTUTrackerApproval);

// Delete RTU Tracker Approval
router.delete('/:id', deleteRTUTrackerApproval);

export default router;





