import express from 'express';
import { listUploads, createUpload, getUploadById, deleteUpload, updateUploadRows } from '../controllers/uploadController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protect, listUploads);
router.post('/', protect, createUpload);
router.get('/:id', protect, getUploadById);
router.delete('/:id', protect, deleteUpload);
router.put('/:id/rows', protect, updateUploadRows);

export default router;




