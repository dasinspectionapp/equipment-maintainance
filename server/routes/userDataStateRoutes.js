import express from 'express';
import {
  saveUserDataState,
  getUserDataState,
  getAllUserDataStates,
  deleteUserDataState,
  bulkSyncUserDataStates
} from '../controllers/userDataStateController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Bulk sync all user data states
router.post('/bulk-sync', bulkSyncUserDataStates);

// Get all user data states for current user
router.get('/', getAllUserDataStates);

// Save or update user data state for a file
router.post('/:fileId', saveUserDataState);

// Get user data state for a file
router.get('/:fileId', getUserDataState);

// Delete user data state for a file
router.delete('/:fileId', deleteUserDataState);

export default router;


