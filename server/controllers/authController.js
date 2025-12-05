import mongoose from 'mongoose';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const registerUser = async (req, res) => {
  try {
    const {
      fullName,
      userId,
      email,
      mobile,
      designation,
      role,
      circle,
      division,
      subDivision,
      sectionName,
      vendor,
      mappedTo,
      password,
      retypePassword
    } = req.body;

    // Validation
    if (!fullName || !userId || !email || !mobile || !designation || !role || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide all required fields'
      });
    }

    // Check if passwords match
    if (password !== retypePassword) {
      return res.status(400).json({
        success: false,
        error: 'Passwords do not match'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ userId }, { email }, { mobile }]
    });

    if (existingUser) {
      let errorMessage = 'User already exists with this ';
      if (existingUser.userId === userId) errorMessage += 'User ID';
      else if (existingUser.email === email) errorMessage += 'Email';
      else errorMessage += 'Mobile number';
      
      return res.status(400).json({
        success: false,
        error: errorMessage
      });
    }

    // Validate role-specific requirements
    const requiresCircle = role !== 'Admin' && role !== 'CCR';
    const requiresDivision = (designation === 'Junior Engineer (J.E)' || designation === 'Assistant Engineer (A.E)') 
                            && role !== 'Admin' && role !== 'CCR';

    if (requiresCircle && (!circle || circle.length === 0)) {
      return res.status(400).json({
        success: false,
        error: 'Please select at least one Circle'
      });
    }

    if (requiresDivision && (!division || division.length === 0)) {
      return res.status(400).json({
        success: false,
        error: 'Please select at least one Division'
      });
    }

    // Validate vendor is required for AMC role
    if (role === 'AMC' && (!vendor || vendor.trim() === '')) {
      return res.status(400).json({
        success: false,
        error: 'Vendor is required for AMC role'
      });
    }

    // Create user with pending status for admin approval
    const user = await User.create({
      fullName,
      userId,
      email,
      mobile,
      designation,
      role,
      circle: circle || [],
      division: division || [],
      subDivision: subDivision || [],
      sectionName: sectionName || '',
      vendor: vendor || undefined,
      mappedTo: [], // Will be set by admin during approval
      password,
      status: 'pending', // Set status as pending for admin approval
      isActive: false // Set inactive until approved
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        token: generateToken(user._id),
        user
      }
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server error during registration'
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const loginUser = async (req, res) => {
  try {
    // Check MongoDB connection first
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        error: 'Database connection unavailable. Please try again in a moment.'
      });
    }

    const { userId, password, application } = req.body;

    // Validation
    if (!userId || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide User ID and Password'
      });
    }

    // Find user
    const user = await User.findOne({ userId }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Your account has been deactivated. Please contact administrator.'
      });
    }

    // Check if user is approved (for non-admin users)
    if (user.role !== 'Admin' && user.status !== 'approved') {
      return res.status(401).json({
        success: false,
        error: 'Your account is pending approval. Please wait for admin approval.'
      });
    }

    // Check password
    const isPasswordMatch = await user.matchPassword(password);

    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Map login form application values to database values
    const applicationMap = {
      'equipment-maintenance': 'Equipment Maintenance',
      'equipment-survey': 'Equipment Survey'
    };
    
    const mappedApplicationName = applicationMap[application] || application;
    
    // For non-Admin users, validate application mapping
    if (user.role !== 'Admin') {
      // Application is required for non-Admin users
      if (!application) {
        return res.status(400).json({
          success: false,
          error: 'Please select an application'
        });
      }
      
      // Ensure user has mappedTo array
      if (!user.mappedTo || !Array.isArray(user.mappedTo) || user.mappedTo.length === 0) {
        return res.status(403).json({
          success: false,
          error: 'You are not mapped to any application. Please contact administrator to be mapped to an application.'
        });
      }
      
      // Check if user's mappedTo array includes the selected application
      // Debug logging (remove in production)
      console.log('Login validation:', {
        userId: user.userId,
        role: user.role,
        selectedApplication: application,
        mappedApplicationName: mappedApplicationName,
        userMappedTo: user.mappedTo,
        isMapped: user.mappedTo.includes(mappedApplicationName)
      });
      
      if (!user.mappedTo.includes(mappedApplicationName)) {
        return res.status(403).json({
          success: false,
          error: `You are not authorized to access ${mappedApplicationName}. You are currently mapped to: ${user.mappedTo.join(', ')}. Please contact administrator to be mapped to this application.`
        });
      }
    }

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token: generateToken(user._id),
      user: {
        id: user._id,
        fullName: user.fullName,
        userId: user.userId,
        email: user.email,
        role: user.role,
        designation: user.designation,
        mappedTo: user.mappedTo,
        division: user.division || [],
        circle: user.circle || [],
        subDivision: user.subDivision || []
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server error during login'
    });
  }
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server error'
    });
  }
};

// @desc    Get dashboard statistics
// @route   GET /api/auth/dashboard-stats
// @access  Private
export const getDashboardStats = async (req, res) => {
  try {
    const users = await User.find();

    // Count by status
    const totalUsers = users.length;
    const approvedUsers = users.filter(u => u.status === 'approved').length;
    const pendingUsers = users.filter(u => u.status === 'pending').length;
    const rejectedUsers = users.filter(u => u.status === 'rejected').length;
    const activeUsers = users.filter(u => u.isActive === true).length;
    const inactiveUsers = users.filter(u => u.isActive === false).length;

    // Count by role
    const roleCounts = {};
    users.forEach(user => {
      const role = user.role || 'Unknown';
      roleCounts[role] = (roleCounts[role] || 0) + 1;
    });

    // Count by application mapping
    const applicationCounts = {};
    users.forEach(user => {
      if (user.mappedTo && user.mappedTo.length > 0) {
        user.mappedTo.forEach(app => {
          applicationCounts[app] = (applicationCounts[app] || 0) + 1;
        });
      }
    });

    // Count by designation
    const designationCounts = {};
    users.forEach(user => {
      const designation = user.designation || 'Unknown';
      designationCounts[designation] = (designationCounts[designation] || 0) + 1;
    });

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        approvedUsers,
        pendingUsers,
        rejectedUsers,
        activeUsers,
        inactiveUsers,
        roleCounts,
        applicationCounts,
        designationCounts
      }
    });

  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server error'
    });
  }
};

// @desc    Get all users
// @route   GET /api/auth/users
// @access  Private
export const getUsers = async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server error'
    });
  }
};

// @desc    Update user
// @route   PUT /api/auth/users/:id
// @access  Private
export const updateUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server error'
    });
  }
};

// @desc    Delete user
// @route   DELETE /api/auth/users/:id
// @access  Private
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'User deactivated successfully'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server error'
    });
  }
};

// @desc    Approve user
// @route   PUT /api/auth/users/:id/approve
// @access  Private
export const approveUser = async (req, res) => {
  try {
    const { mappedTo } = req.body;
    
    const updateData = {
      status: 'approved',
      isActive: true
    };
    
    // If mappedTo is provided, update it
    if (mappedTo && Array.isArray(mappedTo) && mappedTo.length > 0) {
      updateData.mappedTo = mappedTo;
    }
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'User approved successfully',
      data: user
    });

  } catch (error) {
    console.error('Approve user error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server error'
    });
  }
};

// @desc    Update user application mapping
// @route   PUT /api/auth/users/:id/update-mapping
// @access  Private
export const updateUserMapping = async (req, res) => {
  try {
    const { mappedTo } = req.body;
    
    if (!mappedTo || !Array.isArray(mappedTo) || mappedTo.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Please select at least one application'
      });
    }
    
    // Validate mappedTo values
    const validApplications = ['Equipment Maintenance', 'Equipment Survey'];
    const invalidApps = mappedTo.filter(app => !validApplications.includes(app));
    
    if (invalidApps.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Invalid applications: ${invalidApps.join(', ')}`
      });
    }
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { mappedTo: mappedTo },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'User application mapping updated successfully',
      data: user
    });

  } catch (error) {
    console.error('Update user mapping error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server error'
    });
  }
};

// @desc    Reset user password
// @route   PUT /api/auth/users/:id/reset-password
// @access  Private
export const resetPassword = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Generate a temporary password
    const tempPassword = Math.random().toString(36).slice(-12);
    user.password = tempPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successfully',
      data: {
        temporaryPassword: tempPassword
      }
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server error'
    });
  }
};

// @desc    Reject user
// @route   PUT /api/auth/users/:id/reject
// @access  Private
export const rejectUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status: 'rejected', isActive: false },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'User rejected successfully',
      data: user
    });

  } catch (error) {
    console.error('Reject user error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server error'
    });
  }
};

// @desc    Activate user
// @route   PUT /api/auth/users/:id/activate
// @access  Private
export const activateUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: true },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'User activated successfully',
      data: user
    });

  } catch (error) {
    console.error('Activate user error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server error'
    });
  }
};

// @desc    Deactivate user
// @route   PUT /api/auth/users/:id/deactivate
// @access  Private
export const deactivateUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'User deactivated successfully',
      data: user
    });

  } catch (error) {
    console.error('Deactivate user error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server error'
    });
  }
};

