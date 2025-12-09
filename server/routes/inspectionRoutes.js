import express from 'express';
import {
  submitInspection,
  getInspections,
  getInspectionBySiteCode,
  getFieldAutocomplete,
  downloadTemplate,
  massUploadInspections
} from '../controllers/inspectionController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import fileUpload from 'express-fileupload';

const router = express.Router();

// All routes require authentication
router.post('/submit', protect, submitInspection);
router.get('/all', protect, getInspections);
router.get('/sitecode/:siteCode', protect, getInspectionBySiteCode);
router.get('/autocomplete', protect, getFieldAutocomplete);

// Template download (Admin only)
router.get('/template', protect, authorize('Admin'), downloadTemplate);

// Mass upload route (Admin only)
router.post('/mass-upload', 
  protect, 
  authorize('Admin'), 
  fileUpload({ 
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    abortOnLimit: true 
  }), 
  massUploadInspections
);

export default router;

















