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
    limits: { fileSize: 5 * 1024 * 1024 },
    abortOnLimit: true,
    useTempFiles: false,
    parseNested: true,
  }),
  createSlide
);

router.put(
  '/slides/:id',
  fileUpload({
    limits: { fileSize: 5 * 1024 * 1024 },
    abortOnLimit: true,
    useTempFiles: false,
    parseNested: true,
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



