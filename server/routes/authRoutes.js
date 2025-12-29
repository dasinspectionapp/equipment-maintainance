import express from 'express';
import {
  registerUser,
  loginUser,
  loginUserForResources,
  getUserProfile,
  getUsers,
  updateUser,
  deleteUser,
  approveUser,
  rejectUser,
  activateUser,
  deactivateUser,
  resetPassword,
  updateUserMapping,
  getDashboardStats,
  verifyOTP,
  setupTotp,
  confirmTotp,
  recoveryLogin,
  getMyTotpStatus,
  resetOwnTotp,
  logout
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/login-resources', loginUserForResources);

// TOTP Authentication routes
router.post('/otp/verify', verifyOTP);
router.post('/recovery-login', recoveryLogin);

// Protected routes
router.get('/profile', protect, getUserProfile);
router.get('/dashboard-stats', protect, getDashboardStats);
router.get('/users', protect, getUsers);
// More specific routes must come before general /users/:id route
router.put('/users/:id/approve', protect, approveUser);
router.put('/users/:id/reject', protect, rejectUser);
router.put('/users/:id/activate', protect, activateUser);
router.put('/users/:id/deactivate', protect, deactivateUser);
router.put('/users/:id/reset-password', protect, resetPassword);
router.put('/users/:id/update-mapping', protect, updateUserMapping);
router.put('/users/:id', protect, updateUser);
router.delete('/users/:id', protect, deleteUser);

// TOTP User routes (protected)
router.get('/totp/status', protect, getMyTotpStatus);
router.post('/totp/setup', protect, setupTotp);
router.post('/totp/confirm', protect, confirmTotp);
router.post('/totp/reset-self', protect, resetOwnTotp);
router.post('/logout', protect, logout);

export default router;

