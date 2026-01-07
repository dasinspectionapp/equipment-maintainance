import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  createAgency,
  getAgencies,
  getAgencyById,
  updateAgency,
  updateAgencyStatus,
  deleteAgency,
  getAllSites,
  checkAgencyExpiry
} from '../controllers/agencyController.js';

const router = express.Router();

// Public route for Sign Up form - Get active agencies only
router.get('/active', getAgencies);

// All other routes require authentication
router.use(protect);

// @route   GET /api/masters/agencies/sites/all
// @desc    Get all sites for dropdown
// @access  Private/Admin
router.get('/sites/all', getAllSites);

// @route   POST /api/masters/agencies/check-expiry
// @desc    Check and auto-disable expired agencies
// @access  Private/Admin
router.post('/check-expiry', checkAgencyExpiry);

// @route   POST /api/masters/agencies
// @desc    Create a new agency
// @access  Private/Admin
router.post('/', createAgency);

// @route   GET /api/masters/agencies
// @desc    Get all agencies with pagination and search
// @access  Private/Admin
router.get('/', getAgencies);

// @route   GET /api/masters/agencies/:id
// @desc    Get agency by ID
// @access  Private/Admin
router.get('/:id', getAgencyById);

// @route   PUT /api/masters/agencies/:id
// @desc    Update agency
// @access  Private/Admin
router.put('/:id', updateAgency);

// @route   PATCH /api/masters/agencies/:id/status
// @desc    Activate/Deactivate agency
// @access  Private/Admin
router.patch('/:id/status', updateAgencyStatus);

// @route   DELETE /api/masters/agencies/:id
// @desc    Soft delete agency
// @access  Private/Admin
router.delete('/:id', deleteAgency);

export default router;
