import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  saveEquipmentOfflineSite,
  bulkSaveEquipmentOfflineSites,
  getEquipmentOfflineSite,
  getAllEquipmentOfflineSites,
  getEquipmentOfflineSitesByFile,
  updateDaysOfflineOnly,
  bulkUpdateDaysOfflineOnly,
  deleteEquipmentOfflineSite,
  getReports,
  getLocalRemoteReports,
  getReportDetails,
  getReportFilters
} from '../controllers/equipmentOfflineSitesController.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Save or update single equipment offline site
router.post('/', saveEquipmentOfflineSite);

// Bulk save or update multiple equipment offline sites
router.post('/bulk', bulkSaveEquipmentOfflineSites);

// Get all equipment offline sites for current user (optional fileId query param)
router.get('/', getAllEquipmentOfflineSites);

// Get equipment offline sites by fileId (returns map by rowKey)
router.get('/file/:fileId', getEquipmentOfflineSitesByFile);

// Get LOCAL-REMOTE reports data (must come before /reports route)
router.get('/reports/local-remote', (req, res, next) => {
  console.log('LOCAL-REMOTE Reports route hit - Method:', req.method, 'Path:', req.path);
  getLocalRemoteReports(req, res, next);
});

// Get reports data with filters (must come before parameterized routes)
router.get('/reports', (req, res, next) => {
  console.log('Reports route hit - Method:', req.method, 'Path:', req.path);
  getReports(req, res, next);
});

// Get report details by site code (must come before parameterized routes)
router.get('/reports/details', (req, res, next) => {
  console.log('Report Details route hit - Method:', req.method, 'Path:', req.path);
  getReportDetails(req, res, next);
});

// Get unique filter options (must come before parameterized routes)
router.get('/reports/filters', (req, res, next) => {
  console.log('Report Filters route hit - Method:', req.method, 'Path:', req.path);
  getReportFilters(req, res, next);
});

// Update only No of Days Offline for matching Site Code and Device Status
router.put('/update-days-offline', updateDaysOfflineOnly);

// Bulk update No of Days Offline for matching Site Code and Device Status
router.put('/bulk-update-days-offline', bulkUpdateDaysOfflineOnly);

// Get single equipment offline site by fileId and rowKey
router.get('/:fileId/:rowKey', getEquipmentOfflineSite);

// Delete equipment offline site
router.delete('/:fileId/:rowKey', deleteEquipmentOfflineSite);

export default router;

