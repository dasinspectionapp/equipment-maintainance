import express from 'express';
import { uploadExcel, getAllLocations, getLocationsBySiteCodes, uploadKML, uploadTempKML, getTempKML } from '../controllers/locationController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import fileUpload from 'express-fileupload';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Upload Excel file and process locations (Admin only)
router.post('/upload-excel', authorize('Admin'), fileUpload({ 
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  abortOnLimit: true 
}), uploadExcel);

// Upload KML file and process locations (Admin only)
router.post('/upload-kml', authorize('Admin'), fileUpload({ 
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  abortOnLimit: true 
}), uploadKML);

// Get all locations (Admin only)
router.get('/locations', authorize('Admin'), getAllLocations);

// Get locations by site codes (for Equipment and other authenticated users)
router.post('/by-site-codes', getLocationsBySiteCodes);

// Upload temporary KML file for navigation (for authenticated users)
router.post('/temp-kml', fileUpload({ 
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  abortOnLimit: true 
}), uploadTempKML);

// Get temporary KML file for navigation (for authenticated users)
router.get('/temp-kml/:fileName', getTempKML);

export default router;

