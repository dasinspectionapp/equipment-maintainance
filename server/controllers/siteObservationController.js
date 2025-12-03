import SiteObservation from '../models/SiteObservation.js';

// @desc    Save or update site observation
// @route   POST /api/site-observations
// @access  Private
export const saveSiteObservation = async (req, res) => {
  try {
    const { siteCode, status, typeOfIssue, rawTypeOfIssue, specifyOther, typeOfSpare, specifySpareOther, remarks, capturedPhotos, uploadedPhotos, viewPhotos, savedFrom } = req.body;
    const userId = req.user.userId;

    if (!siteCode || !status) {
      return res.status(400).json({
        success: false,
        error: 'Site Code and Status are required'
      });
    }

    // Find existing observation or create new one
    const observation = await SiteObservation.findOneAndUpdate(
      { siteCode: siteCode.trim().toUpperCase(), userId },
      {
        siteCode: siteCode.trim().toUpperCase(),
        userId,
        status,
        typeOfIssue: typeOfIssue || '',
        rawTypeOfIssue: rawTypeOfIssue || '',
        specifyOther: specifyOther || '',
        typeOfSpare: typeOfSpare || [],
        specifySpareOther: specifySpareOther || '',
        remarks: remarks || '',
        capturedPhotos: capturedPhotos || [],
        uploadedPhotos: uploadedPhotos || [],
        viewPhotos: viewPhotos || [],
        savedFrom: savedFrom || 'Web Application',
      },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: observation
    });
  } catch (error) {
    console.error('Error saving site observation:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to save site observation'
    });
  }
};

// @desc    Get site observation by site code
// @route   GET /api/site-observations/:siteCode
// @access  Private
export const getSiteObservation = async (req, res) => {
  try {
    const { siteCode } = req.params;
    const userId = req.user.userId;

    const observation = await SiteObservation.findOne({
      siteCode: siteCode.trim().toUpperCase(),
      userId
    });

    if (!observation) {
      return res.status(200).json({
        success: true,
        data: null
      });
    }

    res.status(200).json({
      success: true,
      data: observation
    });
  } catch (error) {
    console.error('Error fetching site observation:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch site observation'
    });
  }
};

// @desc    Get all site observations for current user
// @route   GET /api/site-observations
// @access  Private
export const getAllSiteObservations = async (req, res) => {
  try {
    const userId = req.user.userId;

    const observations = await SiteObservation.find({ userId })
      .sort({ updatedAt: -1 });

    // Convert to map format for compatibility with web app
    const observationsMap = {};
    observations.forEach(obs => {
      observationsMap[obs.siteCode] = {
        status: obs.status,
        typeOfIssue: obs.typeOfIssue,
        rawTypeOfIssue: obs.rawTypeOfIssue,
        specifyOther: obs.specifyOther,
        typeOfSpare: obs.typeOfSpare,
        specifySpareOther: obs.specifySpareOther,
        remarks: obs.remarks,
        capturedPhotos: obs.capturedPhotos,
        uploadedPhotos: obs.uploadedPhotos,
        viewPhotos: obs.viewPhotos,
        timestamp: obs.updatedAt.toISOString(),
        savedFrom: obs.savedFrom,
      };
    });

    res.status(200).json({
      success: true,
      data: observationsMap,
      count: observations.length
    });
  } catch (error) {
    console.error('Error fetching site observations:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch site observations'
    });
  }
};

// @desc    Delete site observation
// @route   DELETE /api/site-observations/:siteCode
// @access  Private
export const deleteSiteObservation = async (req, res) => {
  try {
    const { siteCode } = req.params;
    const userId = req.user.userId;

    const observation = await SiteObservation.findOneAndDelete({
      siteCode: siteCode.trim().toUpperCase(),
      userId
    });

    if (!observation) {
      return res.status(404).json({
        success: false,
        error: 'Site observation not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Site observation deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting site observation:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete site observation'
    });
  }
};


