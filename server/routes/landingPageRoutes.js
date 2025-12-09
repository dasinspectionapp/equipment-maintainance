import express from 'express';
import fileUpload from 'express-fileupload';
import {
  getSlides,
  getBranding,
  createSlide,
  updateSlide,
  deleteSlide,
  reorderSlides,
} from '../controllers/landingPageController.js';
import {
  getAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from '../controllers/announcementController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/slides', getSlides);
router.get('/branding', getBranding);
router.get('/announcements', getAnnouncements);

router.use(protect);
router.use(authorize('Admin'));

router.post(
  '/slides',
  fileUpload({
    limits: { 
      fileSize: 10 * 1024 * 1024, // 10MB per file (increased from 5MB)
      files: 2 // Allow up to 2 files (carousel image + background image)
    },
    abortOnLimit: false, // Don't abort, return error instead
    useTempFiles: false,
    parseNested: true,
    limitHandler: (req, res, next) => {
      return res.status(413).json({ 
        success: false, 
        message: 'File size too large. Maximum size is 10MB per file.' 
      });
    }
  }),
  createSlide
);

router.put(
  '/slides/:id',
  fileUpload({
    limits: { 
      fileSize: 10 * 1024 * 1024, // 10MB per file (increased from 5MB)
      files: 2 // Allow up to 2 files (carousel image + background image)
    },
    abortOnLimit: false, // Don't abort, return error instead
    useTempFiles: false,
    parseNested: true,
    limitHandler: (req, res, next) => {
      return res.status(413).json({ 
        success: false, 
        message: 'File size too large. Maximum size is 10MB per file.' 
      });
    }
  }),
  updateSlide
);

router.put('/slides/reorder', reorderSlides);
router.delete('/slides/:id', deleteSlide);

// Announcement routes (Admin only)
router.post('/announcements', createAnnouncement);
router.put('/announcements/:id', updateAnnouncement);
router.delete('/announcements/:id', deleteAnnouncement);

export default router;



