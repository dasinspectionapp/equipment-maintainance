import UserDataState from '../models/UserDataState.js';

// @desc    Save or update user data state for a file
// @route   POST /api/user-data-state/:fileId
// @access  Private
export const saveUserDataState = async (req, res) => {
  try {
    const { fileId } = req.params;
    const { siteObservations, taskStatus, typeOfIssue, viewPhotos, remarks, photoMetadata, supportDocuments, savedFrom } = req.body;
    const userId = req.user.userId;

    if (!fileId) {
      return res.status(400).json({
        success: false,
        error: 'File ID is required'
      });
    }

    // Find existing state or create new one
    const dataState = await UserDataState.findOneAndUpdate(
      { userId, fileId },
      {
        userId,
        fileId,
        siteObservations: siteObservations || {},
        taskStatus: taskStatus || {},
        typeOfIssue: typeOfIssue || {},
        viewPhotos: viewPhotos || {},
        remarks: remarks || {},
        photoMetadata: photoMetadata || {},
        supportDocuments: supportDocuments || {},
        savedFrom: savedFrom || 'Web Application',
        lastSyncedAt: new Date(),
      },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: dataState
    });
  } catch (error) {
    console.error('Error saving user data state:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to save user data state'
    });
  }
};

// @desc    Get user data state for a file
// @route   GET /api/user-data-state/:fileId
// @access  Private
export const getUserDataState = async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user.userId;

    const dataState = await UserDataState.findOne({
      userId,
      fileId
    });

    if (!dataState) {
      return res.status(200).json({
        success: true,
        data: null
      });
    }

    res.status(200).json({
      success: true,
      data: {
        siteObservations: dataState.siteObservations || {},
        taskStatus: dataState.taskStatus || {},
        typeOfIssue: dataState.typeOfIssue || {},
        viewPhotos: dataState.viewPhotos || {},
        remarks: dataState.remarks || {},
        photoMetadata: dataState.photoMetadata || {},
        supportDocuments: dataState.supportDocuments || {},
        lastSyncedAt: dataState.lastSyncedAt,
      }
    });
  } catch (error) {
    console.error('Error fetching user data state:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch user data state'
    });
  }
};

// @desc    Get all user data states for current user
// @route   GET /api/user-data-state
// @access  Private
export const getAllUserDataStates = async (req, res) => {
  try {
    const userId = req.user.userId;

    const dataStates = await UserDataState.find({ userId })
      .sort({ updatedAt: -1 });

    // Convert to map format for compatibility with frontend
    const dataStatesMap = {};
    dataStates.forEach(state => {
      dataStatesMap[state.fileId] = {
        siteObservations: state.siteObservations || {},
        taskStatus: state.taskStatus || {},
        typeOfIssue: state.typeOfIssue || {},
        viewPhotos: state.viewPhotos || {},
        remarks: state.remarks || {},
        photoMetadata: state.photoMetadata || {},
        supportDocuments: state.supportDocuments || {},
        lastSyncedAt: state.lastSyncedAt,
      };
    });

    res.status(200).json({
      success: true,
      data: dataStatesMap,
      count: dataStates.length
    });
  } catch (error) {
    console.error('Error fetching user data states:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch user data states'
    });
  }
};

// @desc    Delete user data state for a file
// @route   DELETE /api/user-data-state/:fileId
// @access  Private
export const deleteUserDataState = async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user.userId;

    const dataState = await UserDataState.findOneAndDelete({
      userId,
      fileId
    });

    if (!dataState) {
      return res.status(404).json({
        success: false,
        error: 'User data state not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'User data state deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user data state:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete user data state'
    });
  }
};

// @desc    Bulk sync - save all user data states
// @route   POST /api/user-data-state/bulk-sync
// @access  Private
export const bulkSyncUserDataStates = async (req, res) => {
  try {
    const { dataStates } = req.body; // Array of { fileId, siteObservations, taskStatus, ... }
    const userId = req.user.userId;

    if (!Array.isArray(dataStates)) {
      return res.status(400).json({
        success: false,
        error: 'dataStates must be an array'
      });
    }

    const results = await Promise.allSettled(
      dataStates.map(async (stateData) => {
        const { fileId, siteObservations, taskStatus, typeOfIssue, viewPhotos, remarks, photoMetadata, supportDocuments, savedFrom } = stateData;
        
        return await UserDataState.findOneAndUpdate(
          { userId, fileId },
          {
            userId,
            fileId,
            siteObservations: siteObservations || {},
            taskStatus: taskStatus || {},
            typeOfIssue: typeOfIssue || {},
            viewPhotos: viewPhotos || {},
            remarks: remarks || {},
            photoMetadata: photoMetadata || {},
            supportDocuments: supportDocuments || {},
            savedFrom: savedFrom || 'Web Application',
            lastSyncedAt: new Date(),
          },
          { new: true, upsert: true, runValidators: true }
        );
      })
    );

    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failedCount = results.filter(r => r.status === 'rejected').length;

    res.status(200).json({
      success: true,
      message: `Synced ${successCount} files${failedCount > 0 ? `, ${failedCount} failed` : ''}`,
      successCount,
      failedCount
    });
  } catch (error) {
    console.error('Error bulk syncing user data states:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to bulk sync user data states'
    });
  }
};


