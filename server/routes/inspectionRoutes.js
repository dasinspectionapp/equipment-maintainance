import express from 'express';
import {
  submitInspection,
  getInspections,
  getInspectionBySiteCode,
  getFieldAutocomplete
} from '../controllers/inspectionController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes require authentication
router.post('/submit', protect, submitInspection);
router.get('/all', protect, getInspections);
router.get('/sitecode/:siteCode', protect, getInspectionBySiteCode);
router.get('/autocomplete', protect, getFieldAutocomplete);

export default router;

















