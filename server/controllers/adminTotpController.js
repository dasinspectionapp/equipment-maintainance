import User from '../models/User.js';
import mongoose from 'mongoose';

/**
 * Admin TOTP Management Controller
 * All endpoints require Admin role
 */

// @desc    Enable TOTP for a user (allows user to set up TOTP)
// @route   POST /api/admin/totp/enable
// @access  Private (Admin only)
export const enableTotpForUser = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Please provide User ID'
      });
    }

    const user = await User.findOne({ userId });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Enable TOTP permission
    user.adminAllowsTotp = true;
    await user.save();

    res.status(200).json({
      success: true,
      message: `TOTP enabled for user ${user.userId}. User can now set up Google Authenticator.`,
      data: {
        userId: user.userId,
        fullName: user.fullName,
        adminAllowsTotp: user.adminAllowsTotp,
        totpEnabled: user.totpEnabled
      }
    });

  } catch (error) {
    console.error('Enable TOTP error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server error'
    });
  }
};

// @desc    Disable TOTP for a user (removes TOTP requirement)
// @route   POST /api/admin/totp/disable
// @access  Private (Admin only)
export const disableTotpForUser = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Please provide User ID'
      });
    }

    const user = await User.findOne({ userId }).select('+totpSecret');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Disable TOTP and clear secret
    user.adminAllowsTotp = false;
    user.totpEnabled = false;
    user.totpSecret = null;
    user.recoveryCodes = [];
    await user.save();

    res.status(200).json({
      success: true,
      message: `TOTP disabled for user ${user.userId}. TOTP secret and recovery codes cleared.`,
      data: {
        userId: user.userId,
        fullName: user.fullName,
        adminAllowsTotp: user.adminAllowsTotp,
        totpEnabled: user.totpEnabled
      }
    });

  } catch (error) {
    console.error('Disable TOTP error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server error'
    });
  }
};

// @desc    Reset TOTP for a user (forces re-setup)
// @route   POST /api/admin/totp/reset
// @access  Private (Admin only)
export const resetTotpForUser = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Please provide User ID'
      });
    }

    const user = await User.findOne({ userId }).select('+totpSecret');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Clear TOTP data but keep adminAllowsTotp = true
    // User will need to re-scan QR code on next login
    user.totpEnabled = false;
    user.totpSecret = null;
    user.recoveryCodes = [];
    // Keep adminAllowsTotp = true so user can set up again
    await user.save();

    res.status(200).json({
      success: true,
      message: `TOTP reset for user ${user.userId}. User must re-scan QR code on next login.`,
      data: {
        userId: user.userId,
        fullName: user.fullName,
        adminAllowsTotp: user.adminAllowsTotp,
        totpEnabled: user.totpEnabled
      }
    });

  } catch (error) {
    console.error('Reset TOTP error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server error'
    });
  }
};

// @desc    Get TOTP status for all users
// @route   GET /api/admin/totp/status
// @access  Private (Admin only)
export const getTotpStatus = async (req, res) => {
  try {
    const users = await User.find({}, 'userId fullName email role adminAllowsTotp totpEnabled devices').lean();

    const totpStats = {
      total: users.length,
      adminAllowsTotp: users.filter(u => u.adminAllowsTotp).length,
      totpEnabled: users.filter(u => u.totpEnabled).length,
      pending: users.filter(u => u.adminAllowsTotp && !u.totpEnabled).length
    };

    res.status(200).json({
      success: true,
      stats: totpStats,
      users: users.map(user => ({
        userId: user.userId,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        adminAllowsTotp: user.adminAllowsTotp,
        totpEnabled: user.totpEnabled,
        deviceCount: user.devices ? user.devices.length : 0
      }))
    });

  } catch (error) {
    console.error('Get TOTP status error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server error'
    });
  }
};

// @desc    Get TOTP status for a specific user
// @route   GET /api/admin/totp/status/:userId
// @access  Private (Admin only)
export const getTotpStatusForUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findOne({ userId }, 'userId fullName email role adminAllowsTotp totpEnabled devices').lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        userId: user.userId,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        adminAllowsTotp: user.adminAllowsTotp,
        totpEnabled: user.totpEnabled,
        deviceCount: user.devices ? user.devices.length : 0,
        devices: user.devices || []
      }
    });

  } catch (error) {
    console.error('Get TOTP status for user error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server error'
    });
  }
};

