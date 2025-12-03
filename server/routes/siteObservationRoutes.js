import express from 'express';
import {
  saveSiteObservation,
  getSiteObservation,
  getAllSiteObservations,
  deleteSiteObservation
} from '../controllers/siteObservationController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Save or update site observation
router.post('/', saveSiteObservation);

// Get all site observations for current user
router.get('/', getAllSiteObservations);

// Get site observation by site code
router.get('/:siteCode', getSiteObservation);

// Delete site observation
router.delete('/:siteCode', deleteSiteObservation);

export default router;


