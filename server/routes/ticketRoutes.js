import express from 'express';
import {
  createTicket,
  getTickets,
  getTicket,
  updateTicket,
  addComment,
  addInternalNote,
  downloadAttachment,
  getTicketStats
} from '../controllers/ticketController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Public ticket routes (for all authenticated users)
router.post('/', createTicket);
router.get('/', getTickets);
router.get('/stats', authorize('Admin'), getTicketStats);
router.get('/:id', getTicket);
router.post('/:id/comments', addComment);
router.get('/:id/attachments/:attachmentId', downloadAttachment);

// Admin-only routes
router.put('/:id', authorize('Admin'), updateTicket);
router.post('/:id/internal-notes', authorize('Admin'), addInternalNote);

export default router;

