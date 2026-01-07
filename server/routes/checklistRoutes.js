import express from 'express';
import {
  createChecklist,
  getAllChecklists,
  getChecklistById,
  updateChecklist,
  deleteChecklist,
  addParameter,
  updateParameter,
  deleteParameter
} from '../controllers/checklistController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes require authentication and admin role
router.use(protect);
router.use(authorize('Admin'));

// Checklist routes
router.route('/')
  .get(getAllChecklists)
  .post(createChecklist);

router.route('/:id')
  .get(getChecklistById)
  .put(updateChecklist)
  .delete(deleteChecklist);

// Parameter routes
router.route('/:id/parameters')
  .post(addParameter);

router.route('/:id/parameters/:paramId')
  .put(updateParameter)
  .delete(deleteParameter);

export default router;






