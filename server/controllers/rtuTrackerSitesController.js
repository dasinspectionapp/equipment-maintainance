import RTUTrackerSites from '../models/RTUTrackerSites.js';
import User from '../models/User.js';
import Approval from '../models/Approval.js';

// @desc    Save or update RTU Tracker site data
// @route   POST /api/rtu-tracker-sites
// @access  Private
export const saveRTUTrackerSite = async (req, res) => {
  try {
    const {
      fileId,
      rowKey,
      siteCode,
      originalRowData,
      headers,
      siteObservations,
      taskStatus,
      typeOfIssue,
      viewPhotos,
      photoMetadata,
      remarks,
      dateOfInspection,
      savedFrom
    } = req.body;
    
    const userId = req.user.userId;

    if (!fileId || !rowKey || !siteCode || !originalRowData) {
      return res.status(400).json({
        success: false,
        error: 'File ID, Row Key, Site Code, and Original Row Data are required'
      });
    }

    // Extract location information from originalRowData if available
    const circle = originalRowData['CIRCLE'] || originalRowData['Circle'] || originalRowData['circle'] || '';
    const division = originalRowData['DIVISION'] || originalRowData['Division'] || originalRowData['division'] || '';
    const subDivision = originalRowData['SUB DIVISION'] || originalRowData['Sub Division'] || originalRowData['subDivision'] || originalRowData['sub_division'] || '';

    console.log('[saveRTUTrackerSite] Updating record:', { fileId, rowKey, userId, siteCode: siteCode.trim().toUpperCase() });
    
    // Find existing record or create new one
    let existingRecord = await RTUTrackerSites.findOne({ fileId, rowKey, userId });
    
    // If not found, try to find by fileId and rowKey only (in case of ownership transfer)
    if (!existingRecord) {
      existingRecord = await RTUTrackerSites.findOne({ fileId, rowKey });
    }

    // Ensure remarks and dateOfInspection are always saved as strings (even if empty)
    const finalRemarks = remarks !== undefined && remarks !== null ? String(remarks) : '';
    const finalDateOfInspection = dateOfInspection !== undefined && dateOfInspection !== null ? String(dateOfInspection) : '';

    const updateData = {
      fileId,
      rowKey,
      siteCode: siteCode.trim().toUpperCase(),
      userId,
      originalRowData,
      headers: headers || [],
      siteObservations: siteObservations !== undefined ? String(siteObservations) : '',
      taskStatus: taskStatus !== undefined ? String(taskStatus) : '',
      typeOfIssue: typeOfIssue !== undefined ? String(typeOfIssue) : '',
      viewPhotos: viewPhotos || [],
      photoMetadata: photoMetadata || [],
      remarks: finalRemarks,
      dateOfInspection: finalDateOfInspection,
      circle: circle.trim(),
      division: division.trim(),
      subDivision: subDivision.trim(),
      savedFrom: savedFrom || 'MY RTU TRACKER',
      lastSyncedAt: new Date(),
    };

    let rtuTrackerSite;
    
    if (existingRecord) {
      // Update existing record
      rtuTrackerSite = await RTUTrackerSites.findOneAndUpdate(
        { fileId, rowKey, userId: existingRecord.userId },
        updateData,
        { new: true, runValidators: true }
      );
      
      console.log('[saveRTUTrackerSite] Updated record ID:', rtuTrackerSite._id);
    } else {
      // Create new record
      rtuTrackerSite = new RTUTrackerSites({
        ...updateData,
        createdAt: new Date(),
      });
      
      await rtuTrackerSite.save();
      console.log('[saveRTUTrackerSite] Created new record ID:', rtuTrackerSite._id);
    }

    // Populate user reference if needed
    if (rtuTrackerSite.user) {
      await rtuTrackerSite.populate('user', 'fullName userId role designation circle');
    }

    // ===================================================================
    // CRITICAL: Create Approval when Resolved status is submitted
    // When Equipment role user (or other role user) submits Resolved,
    // create an approval for CCR role users
    // ===================================================================
    if (siteObservations === 'Resolved' && rtuTrackerSite) {
      try {
        // Get current user role
        const currentUserDoc = await User.findOne({ userId: userId }).lean();
        const currentUserRole = currentUserDoc?.role || '';
        
        // Check if this is a new Resolved status (was not Resolved before)
        const wasResolvedBefore = existingRecord && existingRecord.siteObservations === 'Resolved';
        const isNewResolved = !wasResolvedBefore;
        
        console.log('[saveRTUTrackerSite] 🔍 Checking if approval should be created:', {
          rowKey: rowKey,
          siteCode: siteCode.trim().toUpperCase(),
          userId: userId,
          currentUserRole: currentUserRole,
          siteObservations: siteObservations,
          wasResolvedBefore: wasResolvedBefore,
          isNewResolved: isNewResolved
        });
        
        // Only create approval if this is a new Resolved status
        if (isNewResolved) {
          // Check if approval already exists for this RTU Tracker site
          const existingApproval = await Approval.findOne({
            rtuTrackerSiteId: rtuTrackerSite._id,
            approvalType: 'RTU Tracker Resolution Approval',
            status: 'Pending'
          }).lean();
          
          if (!existingApproval) {
            // Find CCR users to assign approval to
            const ccrUsers = await User.find({
              role: 'CCR',
              status: 'approved',
              isActive: true
            }).lean();
            
            if (ccrUsers.length > 0) {
              // Assign to first available CCR user (or could be distributed)
              const assignedCCRUser = ccrUsers[0];
              
              console.log('[saveRTUTrackerSite] Creating RTU Tracker approval for CCR:', {
                rtuTrackerSiteId: rtuTrackerSite._id,
                siteCode: siteCode.trim().toUpperCase(),
                submittedByUserId: userId,
                submittedByRole: currentUserRole,
                assignedToUserId: assignedCCRUser.userId,
                assignedToRole: 'CCR'
              });
              
              // Create Approval document for CCR
              const approvalDoc = await Approval.create({
                rtuTrackerSiteId: rtuTrackerSite._id,
                siteCode: siteCode.trim().toUpperCase(),
                approvalType: 'RTU Tracker Resolution Approval',
                status: 'Pending',
                submittedByUserId: userId,
                submittedByRole: currentUserRole,
                assignedToUserId: assignedCCRUser.userId,
                assignedToRole: 'CCR',
                submissionRemarks: finalRemarks || 'RTU Tracker resolution completed; pending CCR approval',
                photos: viewPhotos || [],
                supportDocuments: [],
                fileId: fileId,
                rowKey: rowKey,
                originalRowData: originalRowData,
                metadata: {
                  dateOfInspection: finalDateOfInspection,
                  typeOfIssue: typeOfIssue || '',
                  taskStatus: taskStatus || ''
                }
              });
              
              console.log('[saveRTUTrackerSite] ✅ RTU Tracker approval created:', {
                approvalId: approvalDoc._id,
                siteCode: siteCode.trim().toUpperCase(),
                assignedToUserId: assignedCCRUser.userId
              });
            } else {
              console.error('[saveRTUTrackerSite] ❌ No CCR user found - Cannot create approval for RTU Tracker resolution');
            }
          } else {
            console.log('[saveRTUTrackerSite] Approval already exists:', {
              existingApprovalId: existingApproval._id
            });
          }
        } else {
          console.log('[saveRTUTrackerSite] Site was already Resolved - skipping approval creation');
        }
      } catch (approvalError) {
        // Log error but don't fail the main save operation
        console.error('[saveRTUTrackerSite] Error creating approval:', approvalError);
      }
    }

    res.status(200).json({
      success: true,
      data: rtuTrackerSite,
    });
  } catch (error) {
    console.error('[saveRTUTrackerSite] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to save RTU Tracker site',
    });
  }
};

// @desc    Bulk save or update multiple RTU Tracker sites
// @route   POST /api/rtu-tracker-sites/bulk
// @access  Private
export const bulkSaveRTUTrackerSites = async (req, res) => {
  try {
    const { sites } = req.body;
    const userId = req.user.userId;

    if (!Array.isArray(sites) || sites.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Sites array is required and must not be empty'
      });
    }

    const results = [];
    const errors = [];

    for (const site of sites) {
      try {
        const {
          fileId,
          rowKey,
          siteCode,
          originalRowData,
          headers,
          siteObservations,
          taskStatus,
          typeOfIssue,
          viewPhotos,
          photoMetadata,
          remarks,
          dateOfInspection,
          savedFrom
        } = site;

        if (!fileId || !rowKey || !siteCode || !originalRowData) {
          errors.push({ rowKey, error: 'Missing required fields' });
          continue;
        }

        // Extract location information
        const circle = originalRowData['CIRCLE'] || originalRowData['Circle'] || originalRowData['circle'] || '';
        const division = originalRowData['DIVISION'] || originalRowData['Division'] || originalRowData['division'] || '';
        const subDivision = originalRowData['SUB DIVISION'] || originalRowData['Sub Division'] || originalRowData['subDivision'] || originalRowData['sub_division'] || '';

        const finalRemarks = remarks !== undefined && remarks !== null ? String(remarks) : '';
        const finalDateOfInspection = dateOfInspection !== undefined && dateOfInspection !== null ? String(dateOfInspection) : '';

        const updateData = {
          fileId,
          rowKey,
          siteCode: siteCode.trim().toUpperCase(),
          userId,
          originalRowData,
          headers: headers || [],
          siteObservations: siteObservations !== undefined ? String(siteObservations) : '',
          taskStatus: taskStatus !== undefined ? String(taskStatus) : '',
          typeOfIssue: typeOfIssue !== undefined ? String(typeOfIssue) : '',
          viewPhotos: viewPhotos || [],
          photoMetadata: photoMetadata || [],
          remarks: finalRemarks,
          dateOfInspection: finalDateOfInspection,
          circle: circle.trim(),
          division: division.trim(),
          subDivision: subDivision.trim(),
          savedFrom: savedFrom || 'MY RTU TRACKER',
          lastSyncedAt: new Date(),
        };

        let existingRecord = await RTUTrackerSites.findOne({ fileId, rowKey, userId });
        
        if (!existingRecord) {
          existingRecord = await RTUTrackerSites.findOne({ fileId, rowKey });
        }

        let rtuTrackerSite;
        
        if (existingRecord) {
          rtuTrackerSite = await RTUTrackerSites.findOneAndUpdate(
            { fileId, rowKey, userId: existingRecord.userId },
            updateData,
            { new: true, runValidators: true }
          );
        } else {
          rtuTrackerSite = new RTUTrackerSites({
            ...updateData,
            createdAt: new Date(),
          });
          await rtuTrackerSite.save();
        }

        results.push(rtuTrackerSite);
      } catch (error) {
        errors.push({ rowKey: site.rowKey, error: error.message });
      }
    }

    res.status(200).json({
      success: true,
      saved: results.length,
      errors: errors.length,
      data: results,
      errorDetails: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[bulkSaveRTUTrackerSites] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to bulk save RTU Tracker sites',
    });
  }
};

// @desc    Get RTU Tracker sites by fileId (returns map by rowKey)
// @route   GET /api/rtu-tracker-sites/file/:fileId
// @access  Private
export const getRTUTrackerSitesByFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user.userId;

    if (!fileId) {
      return res.status(400).json({
        success: false,
        error: 'File ID is required'
      });
    }

    // Find all records for this file and user
    const sites = await RTUTrackerSites.find({ fileId, userId })
      .sort({ updatedAt: -1 });

    // Convert to map by rowKey
    const sitesMap = {};
    sites.forEach(site => {
      sitesMap[site.rowKey] = {
        siteObservations: site.siteObservations || '',
        taskStatus: site.taskStatus || '',
        typeOfIssue: site.typeOfIssue || '',
        viewPhotos: site.viewPhotos || [],
        photoMetadata: site.photoMetadata || [],
        remarks: site.remarks || '',
        dateOfInspection: site.dateOfInspection || '',
      };
    });

    res.status(200).json({
      success: true,
      data: sitesMap,
    });
  } catch (error) {
    console.error('[getRTUTrackerSitesByFile] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get RTU Tracker sites',
    });
  }
};

// @desc    Get all RTU Tracker sites for current user
// @route   GET /api/rtu-tracker-sites
// @access  Private
export const getAllRTUTrackerSites = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { fileId } = req.query;

    const query = { userId };
    if (fileId) {
      query.fileId = fileId;
    }

    const sites = await RTUTrackerSites.find(query)
      .sort({ updatedAt: -1 })
      .populate('user', 'fullName userId role designation circle');

    res.status(200).json({
      success: true,
      count: sites.length,
      data: sites,
    });
  } catch (error) {
    console.error('[getAllRTUTrackerSites] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get RTU Tracker sites',
    });
  }
};

// @desc    Update RTU Tracker site
// @route   PUT /api/rtu-tracker-sites/:id
// @access  Private
export const updateRTUTrackerSite = async (req, res) => {
  try {
    const { id } = req.params;
    const { typeOfIssue, taskStatus, ccrStatus } = req.body;
    const userId = req.user.userId;

    const site = await RTUTrackerSites.findById(id);

    if (!site) {
      return res.status(404).json({
        success: false,
        error: 'RTU Tracker site not found'
      });
    }

    // Update fields
    const updateData = {
      lastSyncedAt: new Date(),
    };

    if (typeOfIssue !== undefined) {
      updateData.typeOfIssue = String(typeOfIssue);
    }

    if (taskStatus !== undefined) {
      updateData.taskStatus = String(taskStatus);
    }

    if (ccrStatus !== undefined) {
      updateData.ccrStatus = String(ccrStatus);
    }

    const updatedSite = await RTUTrackerSites.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    // Populate user reference if needed
    if (updatedSite && updatedSite.user) {
      await updatedSite.populate('user', 'fullName userId role designation circle');
    }

    res.status(200).json({
      success: true,
      data: updatedSite,
    });
  } catch (error) {
    console.error('[updateRTUTrackerSite] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update RTU Tracker site',
    });
  }
};

// @desc    Delete RTU Tracker site
// @route   DELETE /api/rtu-tracker-sites/:id
// @access  Private
export const deleteRTUTrackerSite = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const site = await RTUTrackerSites.findOne({ _id: id, userId });

    if (!site) {
      return res.status(404).json({
        success: false,
        error: 'RTU Tracker site not found'
      });
    }

    await RTUTrackerSites.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (error) {
    console.error('[deleteRTUTrackerSite] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete RTU Tracker site',
    });
  }
};

