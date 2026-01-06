import AgencyMaster from '../models/AgencyMaster.js';
import Location from '../models/Location.js';
import nodemailer from 'nodemailer';
import EmailConfig from '../models/EmailConfig.js';

// Helper function to send email notifications
const sendEmailNotification = async (to, subject, html) => {
  try {
    const emailConfig = await EmailConfig.findOne();
    if (!emailConfig || !emailConfig.isActive) {
      console.log('Email configuration is not active');
      return;
    }

    const transporter = nodemailer.createTransport({
      host: emailConfig.smtpHost,
      port: emailConfig.smtpPort,
      secure: emailConfig.smtpPort === 465,
      auth: {
        user: emailConfig.smtpUser,
        pass: emailConfig.smtpPassword,
      },
    });

    await transporter.sendMail({
      from: `"${emailConfig.senderName}" <${emailConfig.senderEmail}>`,
      to,
      subject,
      html,
    });

    console.log(`Email sent to ${to}`);
  } catch (error) {
    console.error('Error sending email:', error);
  }
};

// @desc    Create a new agency
// @route   POST /api/masters/agencies
// @access  Private/Admin
export const createAgency = async (req, res) => {
  try {
    const {
      agencyName,
      agencyCode,
      agencyType,
      contactPerson,
      mobileNumber,
      email,
      alternateContact,
      address,
      circles,
      divisions,
      equipmentTypes,
      amcStartDate,
      amcEndDate,
      scopeOfWork,
      status
    } = req.body;

    const userId = req.user.userId;

    // Validate required fields
    if (!agencyName || !agencyCode || !agencyType || !contactPerson || !mobileNumber || !email || !address) {
      return res.status(400).json({
        success: false,
        error: 'All required fields must be provided'
      });
    }

    // Check if agency code already exists
    const existingAgency = await AgencyMaster.findOne({ 
      agencyCode: agencyCode.toUpperCase(),
      isDeleted: false 
    });
    
    if (existingAgency) {
      return res.status(400).json({
        success: false,
        error: 'Agency Code already exists'
      });
    }

    // Validate AMC dates
    const startDate = new Date(amcStartDate);
    const endDate = new Date(amcEndDate);
    
    if (endDate <= startDate) {
      return res.status(400).json({
        success: false,
        error: 'AMC End Date must be after AMC Start Date'
      });
    }

    // Create the agency
    const agency = await AgencyMaster.create({
      agencyName,
      agencyCode: agencyCode.toUpperCase(),
      agencyType,
      contactPerson,
      mobileNumber,
      email,
      alternateContact,
      address,
      circles: circles || [],
      divisions: divisions || [],
      equipmentTypes: equipmentTypes || [],
      amcStartDate: startDate,
      amcEndDate: endDate,
      scopeOfWork,
      status: status || 'Active',
      createdBy: userId
    });

    // Send email notification
    const emailHtml = `
      <h2>New Agency Created</h2>
      <p>A new agency has been successfully registered in the system.</p>
      <h3>Agency Details:</h3>
      <ul>
        <li><strong>Agency Name:</strong> ${agencyName}</li>
        <li><strong>Agency Code:</strong> ${agencyCode.toUpperCase()}</li>
        <li><strong>Agency Type:</strong> ${agencyType}</li>
        <li><strong>Contact Person:</strong> ${contactPerson}</li>
        <li><strong>Email:</strong> ${email}</li>
        <li><strong>Mobile:</strong> ${mobileNumber}</li>
        <li><strong>AMC Period:</strong> ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}</li>
        <li><strong>Status:</strong> ${status || 'Active'}</li>
      </ul>
      <p>Please log in to the system to view more details.</p>
    `;

    await sendEmailNotification(email, 'Agency Registration Confirmation', emailHtml);

    res.status(201).json({
      success: true,
      data: agency,
      message: 'Agency created successfully'
    });
  } catch (error) {
    console.error('Error creating agency:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create agency'
    });
  }
};

// @desc    Get all agencies with pagination and search
// @route   GET /api/masters/agencies
// @access  Private/Admin
export const getAgencies = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      status = '',
      agencyType = '',
      circle = ''
    } = req.query;

    const query = { isDeleted: false };

    // Add search filter
    if (search) {
      query.$or = [
        { agencyName: { $regex: search, $options: 'i' } },
        { agencyCode: { $regex: search, $options: 'i' } }
      ];
    }

    // Add status filter
    if (status) {
      query.status = status;
    }

    // Add agency type filter
    if (agencyType) {
      query.agencyType = agencyType;
    }

    // Add circle filter
    if (circle) {
      query.circles = circle;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const agencies = await AgencyMaster.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await AgencyMaster.countDocuments(query);

    res.status(200).json({
      success: true,
      data: agencies,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching agencies:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch agencies'
    });
  }
};

// @desc    Get agency by ID
// @route   GET /api/masters/agencies/:id
// @access  Private/Admin
export const getAgencyById = async (req, res) => {
  try {
    const { id } = req.params;

    const agency = await AgencyMaster.findOne({ 
      _id: id, 
      isDeleted: false 
    });

    if (!agency) {
      return res.status(404).json({
        success: false,
        error: 'Agency not found'
      });
    }

    res.status(200).json({
      success: true,
      data: agency
    });
  } catch (error) {
    console.error('Error fetching agency:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch agency'
    });
  }
};

// @desc    Update agency
// @route   PUT /api/masters/agencies/:id
// @access  Private/Admin
export const updateAgency = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const updateData = { ...req.body };

    // Find the agency
    const agency = await AgencyMaster.findOne({ 
      _id: id, 
      isDeleted: false 
    });

    if (!agency) {
      return res.status(404).json({
        success: false,
        error: 'Agency not found'
      });
    }

    // If agency code is being updated, check for duplicates
    if (updateData.agencyCode && updateData.agencyCode.toUpperCase() !== agency.agencyCode) {
      const existingAgency = await AgencyMaster.findOne({ 
        agencyCode: updateData.agencyCode.toUpperCase(),
        _id: { $ne: id },
        isDeleted: false 
      });
      
      if (existingAgency) {
        return res.status(400).json({
          success: false,
          error: 'Agency Code already exists'
        });
      }
      updateData.agencyCode = updateData.agencyCode.toUpperCase();
    }

    // Validate AMC dates if being updated
    if (updateData.amcStartDate || updateData.amcEndDate) {
      const startDate = new Date(updateData.amcStartDate || agency.amcStartDate);
      const endDate = new Date(updateData.amcEndDate || agency.amcEndDate);
      
      if (endDate <= startDate) {
        return res.status(400).json({
          success: false,
          error: 'AMC End Date must be after AMC Start Date'
        });
      }
    }

    // Update the agency
    updateData.updatedBy = userId;
    const updatedAgency = await AgencyMaster.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: updatedAgency,
      message: 'Agency updated successfully'
    });
  } catch (error) {
    console.error('Error updating agency:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update agency'
    });
  }
};

// @desc    Update agency status (Activate/Deactivate)
// @route   PATCH /api/masters/agencies/:id/status
// @access  Private/Admin
export const updateAgencyStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.userId;

    if (!status || !['Active', 'Inactive'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Valid status is required (Active or Inactive)'
      });
    }

    const agency = await AgencyMaster.findOne({ 
      _id: id, 
      isDeleted: false 
    });

    if (!agency) {
      return res.status(404).json({
        success: false,
        error: 'Agency not found'
      });
    }

    // Update status
    agency.status = status;
    agency.updatedBy = userId;
    await agency.save();

    // Send email notification
    const emailHtml = `
      <h2>Agency Status Update</h2>
      <p>The status of your agency has been updated.</p>
      <h3>Agency Details:</h3>
      <ul>
        <li><strong>Agency Name:</strong> ${agency.agencyName}</li>
        <li><strong>Agency Code:</strong> ${agency.agencyCode}</li>
        <li><strong>New Status:</strong> ${status}</li>
      </ul>
      <p>Please contact the administrator if you have any questions.</p>
    `;

    await sendEmailNotification(agency.email, 'Agency Status Update', emailHtml);

    res.status(200).json({
      success: true,
      data: agency,
      message: `Agency ${status === 'Active' ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    console.error('Error updating agency status:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update agency status'
    });
  }
};

// @desc    Soft delete agency
// @route   DELETE /api/masters/agencies/:id
// @access  Private/Admin
export const deleteAgency = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const agency = await AgencyMaster.findOne({ 
      _id: id, 
      isDeleted: false 
    });

    if (!agency) {
      return res.status(404).json({
        success: false,
        error: 'Agency not found'
      });
    }

    // Soft delete
    agency.isDeleted = true;
    agency.deletedAt = new Date();
    agency.deletedBy = userId;
    agency.status = 'Inactive';
    await agency.save();

    res.status(200).json({
      success: true,
      message: 'Agency deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting agency:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete agency'
    });
  }
};

// @desc    Get all sites for dropdown
// @route   GET /api/masters/agencies/sites/all
// @access  Private/Admin
export const getAllSites = async (req, res) => {
  try {
    const sites = await Location.find({})
      .select('name latitude longitude')
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      data: sites
    });
  } catch (error) {
    console.error('Error fetching sites:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch sites'
    });
  }
};

// @desc    Check and auto-disable expired agencies (CRON job)
// @route   POST /api/masters/agencies/check-expiry
// @access  Private/Admin
export const checkAgencyExpiry = async (req, res) => {
  try {
    const now = new Date();
    
    const expiredAgencies = await AgencyMaster.find({
      amcEndDate: { $lt: now },
      status: 'Active',
      isDeleted: false
    });

    const updatePromises = expiredAgencies.map(async (agency) => {
      agency.status = 'Inactive';
      await agency.save();

      // Send email notification
      const emailHtml = `
        <h2>AMC Contract Expired</h2>
        <p>Your AMC contract has expired and the agency has been automatically deactivated.</p>
        <h3>Agency Details:</h3>
        <ul>
          <li><strong>Agency Name:</strong> ${agency.agencyName}</li>
          <li><strong>Agency Code:</strong> ${agency.agencyCode}</li>
          <li><strong>AMC End Date:</strong> ${agency.amcEndDate.toLocaleDateString()}</li>
        </ul>
        <p>Please contact the administrator to renew your contract.</p>
      `;

      await sendEmailNotification(agency.email, 'AMC Contract Expired', emailHtml);
    });

    await Promise.all(updatePromises);

    res.status(200).json({
      success: true,
      message: `${expiredAgencies.length} agencies auto-disabled due to expired AMC`,
      count: expiredAgencies.length
    });
  } catch (error) {
    console.error('Error checking agency expiry:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to check agency expiry'
    });
  }
};

