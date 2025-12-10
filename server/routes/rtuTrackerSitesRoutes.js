import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  saveRTUTrackerSite,
  bulkSaveRTUTrackerSites,
  getRTUTrackerSitesByFile,
  getAllRTUTrackerSites,
  updateRTUTrackerSite,
  deleteRTUTrackerSite
} from '../controllers/rtuTrackerSitesController.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Save or update single RTU Tracker site
router.post('/', saveRTUTrackerSite);

// Bulk save or update multiple RTU Tracker sites
router.post('/bulk', bulkSaveRTUTrackerSites);

// Get all RTU Tracker sites for current user (optional fileId query param)
router.get('/', getAllRTUTrackerSites);

// Get RTU Tracker sites by fileId (returns map by rowKey)
router.get('/file/:fileId', getRTUTrackerSitesByFile);

// Update RTU Tracker site
router.put('/:id', updateRTUTrackerSite);

// Delete RTU Tracker site
router.delete('/:id', deleteRTUTrackerSite);

export default router;

