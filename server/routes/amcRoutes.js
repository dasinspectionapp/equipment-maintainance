import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { getAMCTasks, getAMCTaskDetail, submitChecklistExecution } from '../controllers/amcController.js';

const router = express.Router();
router.use(protect, authorize('AMC'));
router.get('/tasks', getAMCTasks);
router.get('/tasks/:taskId', getAMCTaskDetail);
router.post('/tasks/:taskId/submit', submitChecklistExecution);
export default router;

