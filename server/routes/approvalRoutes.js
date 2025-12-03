import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  createApproval,
  updateApprovalStatus,
  getMyApprovals,
  getApprovalById,
  getApprovalStats,
  getApprovalSiteCodes,
  checkApprovals,
  resetApproval
} from '../controllers/approvalController.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// @route   POST /api/approvals
// @desc    Create a new approval
// @access  Private
router.post('/', createApproval);

// @route   GET /api/approvals
// @desc    Get all approvals for current user
// @access  Private
router.get('/', getMyApprovals);

// @route   GET /api/approvals/stats
// @desc    Get approval statistics
// @access  Private
router.get('/stats', getApprovalStats);

// @route   GET /api/approvals/sitecodes
// @desc    Get unique sitecodes from approvals (Admin only)
// @access  Private/Admin
router.get('/sitecodes', getApprovalSiteCodes);

// @route   GET /api/approvals/:id
// @desc    Get approval by ID
// @access  Private
router.get('/:id', getApprovalById);

// @route   PUT /api/approvals/:id/status
// @desc    Update approval status
// @access  Private
router.put('/:id/status', updateApprovalStatus);

// @route   POST /api/approvals/check
// @desc    Check approvals by date and sitecode to detect roles (Admin only)
// @access  Private/Admin
router.post('/check', checkApprovals);

// @route   POST /api/approvals/reset
// @desc    Reset approvals by date and sitecode (Admin only)
// @access  Private/Admin
router.post('/reset', resetApproval);

export default router;





