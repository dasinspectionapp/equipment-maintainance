import Approval from '../models/Approval.js';
import Action from '../models/Action.js';
import EquipmentOfflineSites from '../models/EquipmentOfflineSites.js';
import RTUTrackerSites from '../models/RTUTrackerSites.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';

// @desc    Create a new approval record
// @route   POST /api/approvals
// @access  Private
export const createApproval = async (req, res) => {
  try {
    const {
      actionId,
      siteCode,
      equipmentOfflineSiteId,
      approvalType,
      submissionRemarks,
      photos,
      supportDocuments,
      fileId,
      rowKey,
      originalRowData
    } = req.body;

    const userId = req.user.userId;
    const userRole = req.user.role;

    if (!actionId || !siteCode || !approvalType) {
      return res.status(400).json({
        success: false,
        error: 'Action ID, Site Code, and Approval Type are required'
      });
    }

    // Get the action to extract assignment information
    const action = await Action.findById(actionId);
    if (!action) {
      return res.status(404).json({
        success: false,
        error: 'Action not found'
      });
    }

    // Check if approval already exists for this action
    const existingApproval = await Approval.findOne({ actionId });
    if (existingApproval) {
      return res.status(400).json({
        success: false,
        error: 'Approval already exists for this action'
      });
    }

    // Create new approval
    const approval = await Approval.create({
      actionId,
      siteCode: siteCode.trim().toUpperCase(),
      equipmentOfflineSiteId,
      approvalType,
      status: 'Pending',
      submittedByUserId: action.assignedByUserId || userId,
      submittedByRole: action.assignedByRole || userRole,
      assignedToUserId: action.assignedToUserId,
      assignedToRole: action.assignedToRole,
      submissionRemarks: submissionRemarks || '',
      photos: photos || [],
      supportDocuments: supportDocuments || [],
      fileId: fileId || action.sourceFileId,
      rowKey: rowKey || '',
      originalRowData: originalRowData || action.rowData || {},
      metadata: {}
    });

    res.status(201).json({
      success: true,
      data: approval,
      message: 'Approval created successfully'
    });
  } catch (error) {
    console.error('Error creating approval:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create approval'
    });
  }
};

// @desc    Update approval status
// @route   PUT /api/approvals/:id/status
// @access  Private
export const updateApprovalStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks, metadata } = req.body;
    const userId = req.user.userId;
    const userRole = req.user.role;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Status is required'
      });
    }

    const approval = await Approval.findById(id);
    if (!approval) {
      return res.status(404).json({
        success: false,
        error: 'Approval not found'
      });
    }

    // Verify authorization based on user role
    // CCR users can update any CCR Resolution Approval or RTU Tracker Resolution Approval (they are not division-specific)
    if (userRole === 'CCR' && (approval.approvalType === 'CCR Resolution Approval' || approval.approvalType === 'RTU Tracker Resolution Approval')) {
      // CCR users can update any CCR or RTU Tracker approval - no additional check needed
      console.log('[ApprovalController] CCR user authorized to update any CCR/RTU Tracker Resolution Approval');
    } else if (approval.assignedToUserId !== userId) {
      // For other roles, verify the approval is assigned to the current user
      return res.status(403).json({
        success: false,
        error: 'You are not authorized to update this approval'
      });
    }

    // Determine the new status based on input
    let newStatus = approval.status; // Default to current status
    
    if (status === 'Completed') {
      newStatus = 'Approved';
    } else if (status === 'In Progress') {
      // Check remarks to determine if it's "Kept for Monitoring" or "Recheck Requested"
      const remarksLower = String(remarks || '').toLowerCase();
      if (remarksLower.includes('kept for monitoring')) {
        newStatus = 'Kept for Monitoring';
      } else {
        newStatus = 'Recheck Requested';
      }
    }

    // Update approval
    approval.status = newStatus;
    if (remarks !== undefined) {
      approval.approvalRemarks = remarks;
    }
    // Update metadata if provided
    if (metadata !== undefined && typeof metadata === 'object') {
      approval.metadata = { ...approval.metadata, ...metadata };
    }

    // If approved, set approver information
    if (newStatus === 'Approved' || newStatus === 'Kept for Monitoring') {
      approval.approvedByUserId = userId;
      approval.approvedByRole = userRole;
      approval.approvedAt = new Date();
    }

    await approval.save();

    // Also update the associated action status
    if (approval.actionId) {
      try {
        const action = await Action.findById(approval.actionId);
        if (action) {
          if (status === 'Completed') {
            action.status = 'Completed';
            action.completedDate = new Date();
          } else if (status === 'In Progress') {
            action.status = 'In Progress';
          }
          if (remarks !== undefined) {
            action.remarks = remarks;
          }
          await action.save();
          console.log('[ApprovalController] Updated action status:', {
            actionId: action._id,
            newStatus: action.status
          });
        }
      } catch (actionUpdateError) {
        console.error('[ApprovalController] Error updating action status:', actionUpdateError);
        // Don't fail the approval update
      }
    }

    // CRITICAL: If Equipment role user approves AMC Resolution Approval, create CCR approval (Second Approval)
    if (userRole === 'Equipment' && approval.approvalType === 'AMC Resolution Approval' && newStatus === 'Approved') {
      try {
        console.log('[ApprovalController] Equipment approved AMC Resolution Approval - Creating CCR approval (Second Approval)');
        
        // Get the action associated with this approval
        const action = await Action.findById(approval.actionId);
        if (!action) {
          console.warn('[ApprovalController] Action not found for approval:', approval.actionId);
        } else {
          // Find any active CCR user
          const allCCRUsers = await User.find({
            role: 'CCR',
            status: 'approved',
            isActive: true
          }).lean();
          
          if (allCCRUsers.length === 0) {
            console.warn('[ApprovalController] No CCR user found - Cannot create second approval');
          } else {
            const ccrUser = allCCRUsers[0];
            console.log('[ApprovalController] Selected CCR user for second approval:', {
              userId: ccrUser.userId,
              fullName: ccrUser.fullName
            });

            // Check if CCR approval action already exists
            const existingCCRAction = await Action.findOne({
              typeOfIssue: 'CCR Resolution Approval',
              'rowData.__equipmentApprovalActionId': action._id.toString(),
              assignedToUserId: ccrUser.userId
            });

            if (existingCCRAction) {
              console.log('[ApprovalController] CCR approval action already exists:', existingCCRAction._id);
            } else {
              // Create CCR Resolution Approval action
              const ccrApprovalAction = await Action.create({
                rowData: {
                  ...action.rowData,
                  _actionId: action._id.toString(),
                  __equipmentApprovalActionId: action._id.toString(),
                  __siteObservationStatus: 'Resolved'
                },
                headers: action.headers || [],
                routing: 'CCR Team',
                typeOfIssue: 'CCR Resolution Approval',
                remarks: remarks || 'Resolution approved by Equipment; pending CCR approval',
                photo: action.photo || null,
                assignedToUserId: ccrUser.userId,
                assignedToRole: 'CCR',
                assignedToDivision: action.assignedToDivision || null,
                assignedByUserId: userId,
                assignedByRole: userRole,
                sourceFileId: action.sourceFileId,
                originalRowIndex: action.originalRowIndex || null,
                status: 'Pending',
                priority: action.priority || 'Medium',
                assignedDate: new Date()
              });

              console.log('[ApprovalController] CCR approval action created:', {
                actionId: ccrApprovalAction._id,
                assignedToUserId: ccrApprovalAction.assignedToUserId
              });

              // Create Approval document for CCR Resolution Approval (Second Approval)
              const row = action.rowData || {};
              const approvalSiteCode = approval.siteCode || (row['Site Code'] || row['SITE CODE'] || row['Code'] || row['CODE'] || '').trim().toUpperCase();
              
              // Find EquipmentOfflineSites record
              let equipmentOfflineSiteId = approval.equipmentOfflineSiteId;
              if (!equipmentOfflineSiteId && approvalSiteCode) {
                const equipmentSite = await EquipmentOfflineSites.findOne({
                  siteCode: approvalSiteCode,
                  userId: action.assignedToUserId || action.assignedByUserId || userId,
                  siteObservations: '' // Resolved = empty string
                })
                .sort({ createdAt: -1 })
                .lean();
                
                if (equipmentSite) {
                  equipmentOfflineSiteId = equipmentSite._id;
                }
              }

              const photos = action.photo ? (Array.isArray(action.photo) ? action.photo : [action.photo]) : [];
              const supportDocuments = row.__supportDocuments || [];

              // Check if Approval document for CCR already exists
              const existingCCRApproval = await Approval.findOne({
                actionId: ccrApprovalAction._id
              });

              if (existingCCRApproval) {
                console.log('[ApprovalController] CCR Approval document already exists:', existingCCRApproval._id);
              } else {
                const ccrApprovalDoc = await Approval.create({
                  actionId: ccrApprovalAction._id,
                  siteCode: approvalSiteCode,
                  equipmentOfflineSiteId: equipmentOfflineSiteId,
                  approvalType: 'CCR Resolution Approval',
                  status: 'Pending',
                  submittedByUserId: userId,
                  submittedByRole: userRole,
                  assignedToUserId: ccrUser.userId,
                  assignedToRole: 'CCR',
                  submissionRemarks: remarks || 'Resolution approved by Equipment; pending CCR approval',
                  photos: photos,
                  supportDocuments: supportDocuments,
                  fileId: action.sourceFileId,
                  rowKey: row.__siteObservationRowKey || '',
                  originalRowData: row || {},
                  metadata: {
                    firstApprovalActionId: action._id.toString(),
                    firstApprovalType: 'AMC Resolution Approval'
                  }
                });

                console.log('[ApprovalController] CCR Approval document created (Second Approval):', {
                  approvalId: ccrApprovalDoc._id,
                  actionId: ccrApprovalAction._id,
                  siteCode: approvalSiteCode
                });

                // Send notification to CCR user
                try {
                  await Notification.create({
                    userId: ccrUser.userId,
                    title: 'Resolution Approval Required',
                    message: approvalSiteCode
                      ? `Site ${approvalSiteCode} resolution requires your approval.`
                      : 'A resolution requires your approval.',
                    type: 'info',
                    category: 'maintenance',
                    application: 'Equipment Maintenance',
                    link: '/dashboard/my-approvals',
                    metadata: {
                      actionId: ccrApprovalAction._id.toString(),
                      originalActionId: action._id.toString()
                    }
                  });
                } catch (notifErr) {
                  console.error('[ApprovalController] Error creating notification:', notifErr);
                }
              }
            }
          }
        }
      } catch (ccrApprovalError) {
        console.error('[ApprovalController] Error creating CCR approval after Equipment approval:', ccrApprovalError);
        // Don't fail the main approval update
      }
    }

    // CRITICAL: Update EquipmentOfflineSites ccrStatus when CCR approves/rejects CCR Resolution Approval
    // This is the FINAL approval - when CCR approves, the record should be hidden from MY OFFLINE SITES tab
    if (approval.approvalType === 'CCR Resolution Approval') {
      try {
        let equipmentSite = null;
        
        // First, try to find by equipmentOfflineSiteId if available
        if (approval.equipmentOfflineSiteId) {
          equipmentSite = await EquipmentOfflineSites.findById(approval.equipmentOfflineSiteId);
        }
        
        // If not found, try to find by siteCode and action data
        if (!equipmentSite && approval.siteCode) {
          // Get the action to find userId
          const action = await Action.findById(approval.actionId);
          if (action) {
            const userId = action.assignedToUserId || action.assignedByUserId || approval.submittedByUserId;
            
            // Try multiple strategies to find the EquipmentOfflineSites record
            equipmentSite = await EquipmentOfflineSites.findOne({
              siteCode: approval.siteCode.trim().toUpperCase(),
              userId: userId,
              siteObservations: '' // Resolved = empty string
            })
            .sort({ createdAt: -1 });
            
            // If still not found, try without siteObservations filter
            if (!equipmentSite) {
              equipmentSite = await EquipmentOfflineSites.findOne({
                siteCode: approval.siteCode.trim().toUpperCase(),
                userId: userId
              })
              .sort({ createdAt: -1 });
            }
            
            // If still not found, try with any userId for this siteCode
            if (!equipmentSite) {
              equipmentSite = await EquipmentOfflineSites.findOne({
                siteCode: approval.siteCode.trim().toUpperCase()
              })
              .sort({ createdAt: -1 });
            }
          }
        }
        
        if (equipmentSite) {
          const previousCCRStatus = equipmentSite.ccrStatus;
          
          if (newStatus === 'Approved') {
            const updateResult = await EquipmentOfflineSites.findByIdAndUpdate(
              equipmentSite._id,
              { 
                $set: { 
                  ccrStatus: 'Approved',
                  lastSyncedAt: new Date()
                } 
              },
              { new: true } // Return updated document
            );
            
            // Verify the update
            const verifyRecord = await EquipmentOfflineSites.findById(equipmentSite._id).lean();
            
            console.log('[ApprovalController] ✅ Updated EquipmentOfflineSites ccrStatus to Approved (FINAL APPROVAL - will be hidden from MY OFFLINE SITES):', {
              equipmentSiteId: equipmentSite._id,
              siteCode: approval.siteCode,
              fileId: equipmentSite.fileId,
              userId: equipmentSite.userId,
              rowKey: equipmentSite.rowKey,
              previousCCRStatus: previousCCRStatus,
              newCCRStatus: verifyRecord?.ccrStatus,
              updateSuccess: verifyRecord?.ccrStatus === 'Approved',
              willBeHidden: verifyRecord?.ccrStatus === 'Approved'
            });
            
            if (verifyRecord?.ccrStatus !== 'Approved') {
              console.error('[ApprovalController] ❌ WARNING: ccrStatus update verification failed!', {
                expected: 'Approved',
                actual: verifyRecord?.ccrStatus,
                equipmentSiteId: equipmentSite._id
              });
            }
          } else if (newStatus === 'Kept for Monitoring') {
            const updateResult = await EquipmentOfflineSites.findByIdAndUpdate(
              equipmentSite._id,
              { 
                $set: { 
                  ccrStatus: 'Kept for Monitoring',
                  lastSyncedAt: new Date()
                } 
              },
              { new: true }
            );
            
            // Verify the update
            const verifyRecord = await EquipmentOfflineSites.findById(equipmentSite._id).lean();
            
            console.log('[ApprovalController] Updated EquipmentOfflineSites ccrStatus to Kept for Monitoring:', {
              equipmentSiteId: equipmentSite._id,
              siteCode: approval.siteCode,
              previousCCRStatus: previousCCRStatus,
              newCCRStatus: verifyRecord?.ccrStatus,
              updateSuccess: verifyRecord?.ccrStatus === 'Kept for Monitoring'
            });
          }
        } else {
          console.warn('[ApprovalController] ❌ EquipmentOfflineSites record not found for CCR approval:', {
            approvalId: approval._id,
            siteCode: approval.siteCode,
            equipmentOfflineSiteId: approval.equipmentOfflineSiteId,
            actionId: approval.actionId
          });
        }
      } catch (equipmentUpdateError) {
        console.error('[ApprovalController] Error updating EquipmentOfflineSites ccrStatus:', equipmentUpdateError);
        // Don't fail the approval update if EquipmentOfflineSites update fails
      }
    }

    // CRITICAL: Update RTUTrackerSites when CCR approves/rejects RTU Tracker Resolution Approval
    if (approval.approvalType === 'RTU Tracker Resolution Approval') {
      try {
        let rtuTrackerSite = null;
        
        // First, try to find by rtuTrackerSiteId if available
        if (approval.rtuTrackerSiteId) {
          const rtuTrackerSiteId = typeof approval.rtuTrackerSiteId === 'object' ? approval.rtuTrackerSiteId._id : approval.rtuTrackerSiteId;
          rtuTrackerSite = await RTUTrackerSites.findById(rtuTrackerSiteId);
        }
        
        // If not found, try to find by siteCode
        if (!rtuTrackerSite && approval.siteCode) {
          rtuTrackerSite = await RTUTrackerSites.findOne({
            siteCode: approval.siteCode.trim().toUpperCase(),
            siteObservations: 'Resolved'
          })
          .sort({ createdAt: -1 });
          
          // If still not found, try without siteObservations filter
          if (!rtuTrackerSite) {
            rtuTrackerSite = await RTUTrackerSites.findOne({
              siteCode: approval.siteCode.trim().toUpperCase()
            })
            .sort({ createdAt: -1 });
          }
        }
        
        if (rtuTrackerSite) {
          // Get typeOfIssue and ccrStatus from approval metadata if available
          const typeOfIssue = approval.metadata?.typeOfIssue || '';
          const ccrStatus = approval.metadata?.ccrStatus || '';
          
          // For RTU Tracker Sites, we can add a status field or update taskStatus
          // For now, we'll update taskStatus to reflect approval status
          const updateData = {
            lastSyncedAt: new Date()
          };
          
          if (typeOfIssue) {
            updateData.typeOfIssue = typeOfIssue;
          }
          
          if (ccrStatus) {
            updateData.ccrStatus = ccrStatus;
          }
          
          if (newStatus === 'Approved') {
            updateData.taskStatus = 'Approved';
            await RTUTrackerSites.findByIdAndUpdate(
              rtuTrackerSite._id,
              { $set: updateData },
              { new: true }
            );
            
            console.log('[ApprovalController] ✅ Updated RTUTrackerSites taskStatus to Approved:', {
              rtuTrackerSiteId: rtuTrackerSite._id,
              siteCode: approval.siteCode,
              fileId: rtuTrackerSite.fileId,
              userId: rtuTrackerSite.userId,
              typeOfIssue: typeOfIssue
            });
          } else if (newStatus === 'Kept for Monitoring') {
            updateData.taskStatus = 'Kept for Monitoring';
            await RTUTrackerSites.findByIdAndUpdate(
              rtuTrackerSite._id,
              { $set: updateData },
              { new: true }
            );
            
            console.log('[ApprovalController] Updated RTUTrackerSites taskStatus to Kept for Monitoring:', {
              rtuTrackerSiteId: rtuTrackerSite._id,
              siteCode: approval.siteCode,
              typeOfIssue: typeOfIssue
            });
          } else if (newStatus === 'Recheck Requested') {
            updateData.taskStatus = 'Recheck Requested';
            await RTUTrackerSites.findByIdAndUpdate(
              rtuTrackerSite._id,
              { $set: updateData },
              { new: true }
            );
            
            console.log('[ApprovalController] Updated RTUTrackerSites taskStatus to Recheck Requested:', {
              rtuTrackerSiteId: rtuTrackerSite._id,
              siteCode: approval.siteCode,
              typeOfIssue: typeOfIssue
            });
          }
        } else {
          console.warn('[ApprovalController] ❌ RTUTrackerSites record not found for RTU Tracker approval:', {
            approvalId: approval._id,
            siteCode: approval.siteCode,
            rtuTrackerSiteId: approval.rtuTrackerSiteId
          });
        }
      } catch (rtuTrackerUpdateError) {
        console.error('[ApprovalController] Error updating RTUTrackerSites status:', rtuTrackerUpdateError);
        // Don't fail the approval update if RTUTrackerSites update fails
      }
    }

    res.status(200).json({
      success: true,
      data: approval,
      message: 'Approval status updated successfully'
    });
  } catch (error) {
    console.error('Error updating approval status:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update approval status'
    });
  }
};

// @desc    Get all approvals for current user
// @route   GET /api/approvals
// @access  Private
export const getMyApprovals = async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;
    const { status, approvalType } = req.query;

    // Build query based on user role
    let query = {};

    // Filter by status if provided
    if (status && status !== 'all') {
      query.status = status;
    }

    // Filter by approval type based on user role
    if (userRole === 'Equipment') {
      // Equipment users see only approvals assigned to them
      query.approvalType = 'AMC Resolution Approval';
      query.assignedToUserId = userId;
    } else if (userRole === 'CCR') {
      // CCR users can see CCR Resolution Approvals OR RTU Tracker Resolution Approvals
      // If approvalType query param is provided, filter by it; otherwise show both types
      if (approvalType === 'RTU Tracker Resolution Approval') {
        query.approvalType = 'RTU Tracker Resolution Approval';
        // CCR users are NOT division-specific - they can see ALL RTU Tracker approvals
        console.log('[ApprovalController] CCR user fetching ALL RTU Tracker Resolution Approvals (not filtered by assignedToUserId)');
      } else if (approvalType === 'CCR Resolution Approval') {
        query.approvalType = 'CCR Resolution Approval';
        console.log('[ApprovalController] CCR user fetching ALL CCR Resolution Approvals (not filtered by assignedToUserId)');
      } else {
        // Default: show both CCR Resolution Approvals and RTU Tracker Resolution Approvals
        query.approvalType = { $in: ['CCR Resolution Approval', 'RTU Tracker Resolution Approval'] };
        console.log('[ApprovalController] CCR user fetching ALL CCR and RTU Tracker Resolution Approvals (not filtered by assignedToUserId)');
      }
    } else if (approvalType) {
      query.approvalType = approvalType;
      query.assignedToUserId = userId;
    } else {
      // Default: get approvals assigned to current user
      query.assignedToUserId = userId;
    }

    const approvals = await Approval.find(query)
      .populate('actionId', 'status remarks')
      .populate('equipmentOfflineSiteId', 'siteCode ccrStatus')
      .populate('rtuTrackerSiteId', 'siteCode siteObservations dateOfInspection')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: approvals.length,
      data: approvals
    });
  } catch (error) {
    console.error('Error fetching approvals:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch approvals'
    });
  }
};

// @desc    Get approval by ID
// @route   GET /api/approvals/:id
// @access  Private
export const getApprovalById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const approval = await Approval.findById(id)
      .populate('actionId')
      .populate('equipmentOfflineSiteId')
      .lean();

    if (!approval) {
      return res.status(404).json({
        success: false,
        error: 'Approval not found'
      });
    }

    // Verify authorization based on user role
    // CCR users can view any CCR Resolution Approval or RTU Tracker Resolution Approval (they are not division-specific)
    if (req.user.role === 'CCR' && (approval.approvalType === 'CCR Resolution Approval' || approval.approvalType === 'RTU Tracker Resolution Approval')) {
      // CCR users can view any CCR or RTU Tracker approval - no additional check needed
      console.log('[ApprovalController] CCR user authorized to view any CCR/RTU Tracker Resolution Approval');
    } else if (approval.assignedToUserId !== userId) {
      // For other roles, verify the approval is assigned to the current user
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
    console.error('Error fetching approval:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch approval'
    });
  }
};

// @desc    Get approval statistics
// @route   GET /api/approvals/stats
// @access  Private
export const getApprovalStats = async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;

    // Build query based on user role
    let query = {};
    if (userRole === 'Equipment') {
      // Equipment users see only approvals assigned to them
      query.approvalType = 'AMC Resolution Approval';
      query.assignedToUserId = userId;
    } else if (userRole === 'CCR') {
      // CCR users are NOT division-specific - they can see ALL CCR Resolution Approvals
      // Don't filter by assignedToUserId - any CCR user can see any CCR approval
      query.approvalType = 'CCR Resolution Approval';
      console.log('[ApprovalController] CCR user fetching stats for ALL CCR Resolution Approvals (not filtered by assignedToUserId)');
    } else {
      query.assignedToUserId = userId;
    }

    const [pending, approved, keptForMonitoring, recheckRequested, total] = await Promise.all([
      Approval.countDocuments({ ...query, status: 'Pending' }),
      Approval.countDocuments({ ...query, status: 'Approved' }),
      Approval.countDocuments({ ...query, status: 'Kept for Monitoring' }),
      Approval.countDocuments({ ...query, status: 'Recheck Requested' }),
      Approval.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: {
        pending,
        approved,
        keptForMonitoring,
        recheckRequested,
        total
      }
    });
  } catch (error) {
    console.error('Error fetching approval stats:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch approval statistics'
    });
  }
};

// @desc    Get unique sitecodes from approvals (Admin only)
// @route   GET /api/approvals/sitecodes
// @access  Private/Admin
export const getApprovalSiteCodes = async (req, res) => {
  try {
    const userRole = req.user.role;

    // Only Admin can get all sitecodes
    if (userRole !== 'Admin') {
      return res.status(403).json({
        success: false,
        error: 'Only Admin users can access this endpoint'
      });
    }

    const { search } = req.query;
    const searchTerm = search ? String(search).trim().toUpperCase() : '';

    // Build query to get unique sitecodes
    let query = {};
    if (searchTerm) {
      query.siteCode = { $regex: searchTerm, $options: 'i' };
    }

    // Get distinct sitecodes from approvals
    const siteCodes = await Approval.distinct('siteCode', query);

    // Filter and sort
    let filteredSiteCodes = siteCodes
      .filter(code => code && code.trim().length > 0)
      .map(code => String(code).trim().toUpperCase())
      .filter((code, index, self) => self.indexOf(code) === index) // Remove duplicates
      .sort();

    // If search term provided, filter by it
    if (searchTerm) {
      filteredSiteCodes = filteredSiteCodes.filter(code =>
        code.includes(searchTerm)
      );
    }

    // Limit to 50 results for performance
    filteredSiteCodes = filteredSiteCodes.slice(0, 50);

    res.status(200).json({
      success: true,
      count: filteredSiteCodes.length,
      data: filteredSiteCodes
    });
  } catch (error) {
    console.error('Error fetching approval sitecodes:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch sitecodes'
    });
  }
};

// @desc    Check approvals by date and sitecode to detect roles (Admin only)
// @route   POST /api/approvals/check
// @access  Private/Admin
export const checkApprovals = async (req, res) => {
  try {
    const userRole = req.user.role;

    // Only Admin can check approvals
    if (userRole !== 'Admin') {
      return res.status(403).json({
        success: false,
        error: 'Only Admin users can check approvals'
      });
    }

    const { approvedDate, siteCode } = req.body;

    if (!approvedDate || !siteCode) {
      return res.status(400).json({
        success: false,
        error: 'Date of Approved and Sitecode are required'
      });
    }

    // Parse the date - create start and end of day for matching
    const dateObj = new Date(approvedDate);
    if (isNaN(dateObj.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format'
      });
    }

    // Set time to start of day (00:00:00)
    const startOfDay = new Date(dateObj);
    startOfDay.setHours(0, 0, 0, 0);

    // Set time to end of day (23:59:59.999)
    const endOfDay = new Date(dateObj);
    endOfDay.setHours(23, 59, 59, 999);

    // Normalize sitecode
    const normalizedSiteCode = String(siteCode).trim().toUpperCase();

    // Find approvals that match both date and sitecode
    const approvals = await Approval.find({
      siteCode: normalizedSiteCode,
      approvedAt: {
        $gte: startOfDay,
        $lte: endOfDay
      },
      status: { $in: ['Approved', 'Kept for Monitoring'] }
    })
    .select('_id approvalType approvedByRole approvedAt status')
    .lean();

    if (approvals.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No approvals found matching the provided date and sitecode'
      });
    }

    // Group by role
    const roles = new Set();
    const approvalsByRole = {};

    approvals.forEach(approval => {
      const role = approval.approvedByRole || 'Unknown';
      roles.add(role);
      if (!approvalsByRole[role]) {
        approvalsByRole[role] = [];
      }
      approvalsByRole[role].push(approval);
    });

    const hasEquipment = roles.has('Equipment');
    const hasCCR = roles.has('CCR');
    const hasBoth = hasEquipment && hasCCR;

    res.status(200).json({
      success: true,
      hasMultipleRoles: hasBoth,
      roles: Array.from(roles),
      approvalsByRole: {
        Equipment: hasEquipment ? approvalsByRole['Equipment'] || [] : [],
        CCR: hasCCR ? approvalsByRole['CCR'] || [] : []
      },
      totalCount: approvals.length,
      data: approvals
    });
  } catch (error) {
    console.error('Error checking approvals:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to check approvals'
    });
  }
};

// @desc    Reset approvals by date and sitecode (Admin only)
// @route   POST /api/approvals/reset
// @access  Private/Admin
export const resetApproval = async (req, res) => {
  try {
    const userRole = req.user.role;

    // Only Admin can reset approvals
    if (userRole !== 'Admin') {
      return res.status(403).json({
        success: false,
        error: 'Only Admin users can reset approvals'
      });
    }

    const { approvedDate, siteCode, roles } = req.body;

    if (!approvedDate || !siteCode) {
      return res.status(400).json({
        success: false,
        error: 'Date of Approved and Sitecode are required'
      });
    }

    // Parse the date - create start and end of day for matching
    const dateObj = new Date(approvedDate);
    if (isNaN(dateObj.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format'
      });
    }

    // Set time to start of day (00:00:00)
    const startOfDay = new Date(dateObj);
    startOfDay.setHours(0, 0, 0, 0);

    // Set time to end of day (23:59:59.999)
    const endOfDay = new Date(dateObj);
    endOfDay.setHours(23, 59, 59, 999);

    // Normalize sitecode
    const normalizedSiteCode = String(siteCode).trim().toUpperCase();

    // Build query for approvals
    let query = {
      siteCode: normalizedSiteCode,
      approvedAt: {
        $gte: startOfDay,
        $lte: endOfDay
      },
      status: { $in: ['Approved', 'Kept for Monitoring'] }
    };

    // Filter by roles if provided
    if (roles && Array.isArray(roles) && roles.length > 0) {
      // Normalize roles
      const normalizedRoles = roles.map((r) => String(r).trim());
      query.approvedByRole = { $in: normalizedRoles };
    }

    // Find approvals that match both date and sitecode
    // Include both 'Approved' and 'Kept for Monitoring' statuses
    const approvals = await Approval.find(query).lean();

    if (approvals.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No approvals found matching the provided criteria'
      });
    }

    // Reset each approval
    const resetPromises = approvals.map(async (approval) => {
      // Reset the approval document
      const updatedApproval = await Approval.findByIdAndUpdate(
        approval._id,
        {
          $set: {
            status: 'Pending',
            approvalRemarks: ''
          },
          $unset: {
            approvedByUserId: '',
            approvedByRole: '',
            approvedAt: ''
          }
        },
        { new: true }
      );

      // Reset the associated action status if it exists
      if (approval.actionId) {
        try {
          await Action.findByIdAndUpdate(
            approval.actionId,
            {
              $set: {
                status: 'Pending'
              },
              $unset: {
                completedDate: ''
              }
            }
          );
        } catch (actionError) {
          console.error('Error resetting action status:', actionError);
        }
      }

      // Reset EquipmentOfflineSites ccrStatus if it was set
      // This is important for CCR approvals
      if (approval.equipmentOfflineSiteId) {
        try {
          await EquipmentOfflineSites.findByIdAndUpdate(
            approval.equipmentOfflineSiteId,
            {
              $unset: {
                ccrStatus: ''
              }
            }
          );
        } catch (equipmentError) {
          console.error('Error resetting EquipmentOfflineSites ccrStatus:', equipmentError);
        }
      }

      return updatedApproval;
    });

    const resetApprovals = await Promise.all(resetPromises);

    console.log('[ApprovalController] Reset approvals:', {
      count: resetApprovals.length,
      siteCode: normalizedSiteCode,
      approvedDate: approvedDate,
      approvalIds: resetApprovals.map(a => a._id)
    });

    res.status(200).json({
      success: true,
      message: `Successfully reset ${resetApprovals.length} approval(s)`,
      count: resetApprovals.length,
      data: resetApprovals.map(a => ({
        _id: a._id,
        approvalType: a.approvalType,
        status: a.status,
        siteCode: a.siteCode
      }))
    });
  } catch (error) {
    console.error('Error resetting approvals:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to reset approvals'
    });
  }
};

