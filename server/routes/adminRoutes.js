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

export default router;



