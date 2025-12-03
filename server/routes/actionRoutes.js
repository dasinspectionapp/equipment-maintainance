import express from 'express';
import {
  submitRouting,
  getMyActions,
  getMyRoutedActions,
  getAllActions,
  updateActionStatus,
  rerouteAction,
  deleteAction
} from '../controllers/actionController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes require authentication
router.post('/submit', protect, submitRouting);
router.get('/my-actions', protect, getMyActions);
router.get('/my-routed-actions', protect, getMyRoutedActions);
router.get('/', protect, getAllActions); // Get all actions (CCR role only)
router.put('/:actionId/status', protect, updateActionStatus);
router.put('/:actionId/reroute', protect, rerouteAction);
router.delete('/:actionId', protect, deleteAction);

export default router;







