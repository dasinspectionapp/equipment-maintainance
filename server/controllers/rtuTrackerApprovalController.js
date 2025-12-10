import RTUTrackerApproval from '../models/RTUTrackerApproval.js';
import Approval from '../models/Approval.js';
import RTUTrackerSites from '../models/RTUTrackerSites.js';

// @desc    Create or update RTU Tracker Approval
// @route   POST /api/rtu-tracker-approvals
// @access  Private
export const saveRTUTrackerApproval = async (req, res) => {
  try {
    const {
      approvalId,
      rtuTrackerSiteId,
      siteCode,
      fileId,
      rowKey,
      status,
      submittedByUserId,
      submittedByRole,
      assignedToUserId,
      assignedToRole,
      typeOfIssue,
      ccrStatus,
      ccrRemarks,
      fieldTeamAction,
      dateOfInspection,
      submissionRemarks,
      approvalRemarks,
      photos,
      supportDocuments,
      originalRowData,
      metadata
    } = req.body;
    
    const userId = req.user.userId;

    if (!siteCode || !fileId || !rowKey) {
      return res.status(400).json({
        success: false,
        error: 'Site Code, File ID, and Row Key are required'
      });
    }

    // Find existing record by approvalId or by rtuTrackerSiteId and siteCode
    let existingRecord = null;
    
    if (approvalId) {
      existingRecord = await RTUTrackerApproval.findOne({ approvalId });
    }
    
    if (!existingRecord && rtuTrackerSiteId) {
      existingRecord = await RTUTrackerApproval.findOne({ 
        rtuTrackerSiteId,
        siteCode: siteCode.trim().toUpperCase()
      });
    }

    const approvalData = {
      approvalId: approvalId || existingRecord?.approvalId || null,
      rtuTrackerSiteId: rtuTrackerSiteId || existingRecord?.rtuTrackerSiteId || null,
      siteCode: siteCode.trim().toUpperCase(),
      fileId,
      rowKey,
      status: status || 'Pending',
      submittedByUserId: submittedByUserId || userId,
      submittedByRole: submittedByRole || req.user.role,
      assignedToUserId: assignedToUserId || userId,
      assignedToRole: assignedToRole || 'CCR',
      typeOfIssue: typeOfIssue || '',
      ccrStatus: ccrStatus || '',
      ccrRemarks: ccrRemarks || '',
      fieldTeamAction: fieldTeamAction || '',
      dateOfInspection: dateOfInspection || '',
      submissionRemarks: submissionRemarks || '',
      approvalRemarks: approvalRemarks || '',
      photos: photos || [],
      supportDocuments: supportDocuments || [],
      originalRowData: originalRowData || {},
      metadata: metadata || {}
    };

    let rtuTrackerApproval;
    
    if (existingRecord) {
      // Update existing record
      rtuTrackerApproval = await RTUTrackerApproval.findByIdAndUpdate(
        existingRecord._id,
        { $set: approvalData },
        { new: true, runValidators: true }
      );
      
      console.log('[saveRTUTrackerApproval] Updated record ID:', rtuTrackerApproval._id);
    } else {
      // Create new record
      rtuTrackerApproval = new RTUTrackerApproval(approvalData);
      await rtuTrackerApproval.save();
      
      console.log('[saveRTUTrackerApproval] Created new record ID:', rtuTrackerApproval._id);
    }

    res.status(200).json({
      success: true,
      data: rtuTrackerApproval,
    });
  } catch (error) {
    console.error('[saveRTUTrackerApproval] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to save RTU Tracker Approval',
    });
  }
};

// @desc    Get all RTU Tracker Approvals for current user
// @route   GET /api/rtu-tracker-approvals
// @access  Private
export const getAllRTUTrackerApprovals = async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;
    const { status } = req.query;

    // Build query based on user role
    let query = {};

    // CCR users can see all RTU Tracker Approvals assigned to them or all if they're CCR
    if (userRole === 'CCR') {
      // CCR can see all RTU Tracker Approvals
      query = {};
    } else {
      // Other roles see only their own submissions
      query.submittedByUserId = userId;
    }

    // Filter by status if provided
    if (status && status !== 'all') {
      query.status = status;
    }

    const approvals = await RTUTrackerApproval.find(query)
      .populate('approvalId', 'status remarks')
      .populate('rtuTrackerSiteId', 'siteCode siteObservations dateOfInspection')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: approvals.length,
      data: approvals,
    });
  } catch (error) {
    console.error('[getAllRTUTrackerApprovals] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get RTU Tracker Approvals',
    });
  }
};

// @desc    Get RTU Tracker Approval by ID
// @route   GET /api/rtu-tracker-approvals/:id
// @access  Private
export const getRTUTrackerApprovalById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const userRole = req.user.role;

    const approval = await RTUTrackerApproval.findById(id)
      .populate('approvalId')
      .populate('rtuTrackerSiteId')
      .lean();

    if (!approval) {
      return res.status(404).json({
        success: false,
        error: 'RTU Tracker Approval not found'
      });
    }

    // Verify authorization
    if (userRole === 'CCR') {
      // CCR users can view any RTU Tracker Approval
    } else if (approval.assignedToUserId !== userId && approval.submittedByUserId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'You are not authorized to view this approval'
      });
    }

    res.status(200).json({
      success: true,
      data: approval
    });
  } catch (error) {
    console.error('[getRTUTrackerApprovalById] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get RTU Tracker Approval',
    });
  }
};

// @desc    Update RTU Tracker Approval
// @route   PUT /api/rtu-tracker-approvals/:id
// @access  Private
export const updateRTUTrackerApproval = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const userRole = req.user.role;
    const updateData = req.body;

    const approval = await RTUTrackerApproval.findById(id);

    if (!approval) {
      return res.status(404).json({
        success: false,
        error: 'RTU Tracker Approval not found'
      });
    }

    // Verify authorization
    if (userRole === 'CCR') {
      // CCR users can update any RTU Tracker Approval
    } else if (approval.assignedToUserId !== userId && approval.submittedByUserId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'You are not authorized to update this approval'
      });
    }

    // Update fields
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        approval[key] = updateData[key];
      }
    });

    await approval.save();

    res.status(200).json({
      success: true,
      data: approval,
    });
  } catch (error) {
    console.error('[updateRTUTrackerApproval] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update RTU Tracker Approval',
    });
  }
};

// @desc    Delete RTU Tracker Approval
// @route   DELETE /api/rtu-tracker-approvals/:id
// @access  Private
export const deleteRTUTrackerApproval = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const userRole = req.user.role;

    const approval = await RTUTrackerApproval.findById(id);

    if (!approval) {
      return res.status(404).json({
        success: false,
        error: 'RTU Tracker Approval not found'
      });
    }

    // Verify authorization (only Admin or the submitter can delete)
    if (userRole !== 'Admin' && approval.submittedByUserId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'You are not authorized to delete this approval'
      });
    }

    await RTUTrackerApproval.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (error) {
    console.error('[deleteRTUTrackerApproval] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete RTU Tracker Approval',
    });
  }
};



