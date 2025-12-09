import express from 'express';
import {
  getSMTPConfig,
  updateSMTPConfig,
  testEmail
} from '../controllers/emailController.js';
import {
  getAllFields,
  createField,
  uploadFile,
  getFile,
  deleteFile,
  deleteField,
  updateFieldOrder,
  getLogo
} from '../controllers/adminUploadController.js';
import {
  getAllResourcesAdmin,
  createResource,
  updateResource,
  deleteResource
} from '../controllers/elibraryController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import fileUpload from 'express-fileupload';

const router = express.Router();

// All routes require authentication
router.use(protect);

// SMTP Configuration Routes
router.get('/smtp-config', getSMTPConfig);
router.put('/smtp-config', updateSMTPConfig);
router.post('/test-email', testEmail);

// Admin Upload Fields Routes (Admin only)
router.get('/uploads/fields', authorize('Admin'), getAllFields);
router.post('/uploads/fields', authorize('Admin'), createField);
router.post('/uploads/fields/:fieldId/upload', authorize('Admin'), fileUpload({ 
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  abortOnLimit: true 
}), uploadFile);
router.get('/uploads/files/:fieldId', authorize('Admin'), getFile);
router.get('/uploads/logo', getLogo); // Logo accessible to all authenticated users
router.delete('/uploads/fields/:fieldId/file', authorize('Admin'), deleteFile);
router.delete('/uploads/fields/:fieldId', authorize('Admin'), deleteField);
router.put('/uploads/fields/:fieldId/order', authorize('Admin'), updateFieldOrder);

// E-Library Routes (Admin only)
router.get('/elibrary', authorize('Admin'), getAllResourcesAdmin);
router.post('/elibrary', authorize('Admin'), fileUpload({ 
  limits: { 
    fileSize: 100 * 1024 * 1024, // 100MB limit
    files: 1 // Allow only 1 file
  },
  abortOnLimit: false, // Don't abort, return error instead
  useTempFiles: false,
  parseNested: true,
  limitHandler: (req, res, next) => {
    return res.status(413).json({ 
      success: false, 
      error: 'File size too large. Maximum size is 100MB.' 
    });
  }
}), createResource);
router.put('/elibrary/:id', authorize('Admin'), updateResource);
router.delete('/elibrary/:id', authorize('Admin'), deleteResource);

export default router;



