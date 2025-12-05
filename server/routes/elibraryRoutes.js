import express from 'express';
import {
  getAllResources,
  getResource,
  downloadResource,
  getFilters
} from '../controllers/elibraryController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Protected routes (authentication required)
router.get('/', protect, getAllResources);
router.get('/filters', protect, getFilters);
router.get('/:id', protect, getResource);
router.get('/:id/download', protect, downloadResource);

export default router;

