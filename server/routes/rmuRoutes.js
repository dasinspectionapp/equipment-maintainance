import express from 'express';
import multer from 'multer';
import { protect } from '../middleware/authMiddleware.js';
import {
  downloadTemplate,
  uploadExcel,
  confirmUpload,
  getAllRMU,
  deleteRMU
} from '../controllers/rmuController.js';

const router = express.Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.originalname.match(/\.(xlsx)$/)) {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx files are allowed'), false);
    }
  }
});

// All routes require authentication
router.use(protect);

// @route   GET /api/masters/rmu/template
// @desc    Download Excel template
// @access  Private/Admin
router.get('/template', downloadTemplate);

// @route   POST /api/masters/rmu/upload
// @desc    Upload and validate Excel file
// @access  Private/Admin
router.post('/upload', upload.single('file'), uploadExcel);

// @route   POST /api/masters/rmu/upload/confirm
// @desc    Confirm and save validated data
// @access  Private/Admin
router.post('/upload/confirm', confirmUpload);

// @route   GET /api/masters/rmu
// @desc    Get all RMU records with pagination
// @access  Private/Admin
router.get('/', getAllRMU);

// @route   DELETE /api/masters/rmu/:id
// @desc    Delete RMU record
// @access  Private/Admin
router.delete('/:id', deleteRMU);

export default router;

