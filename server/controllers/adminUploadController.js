import AdminUploadField from '../models/AdminUploadField.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads', 'admin');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Helper function to generate field key from field name
const generateFieldKey = (fieldName) => {
  return fieldName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

// @desc    Get all admin upload fields
// @route   GET /api/admin/uploads/fields
// @access  Admin only
export const getAllFields = async (req, res) => {
  try {
    const fields = await AdminUploadField.find({})
      .sort({ order: 1, createdAt: 1 })
      .lean();
    
    res.json({
      success: true,
      fields
    });
  } catch (error) {
    console.error('Error fetching admin upload fields:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch upload fields'
    });
  }
};

// @desc    Create a new admin upload field
// @route   POST /api/admin/uploads/fields
// @access  Admin only
export const createField = async (req, res) => {
  try {
    const { fieldName } = req.body;

    if (!fieldName || !fieldName.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Field name is required'
      });
    }

    const fieldKey = generateFieldKey(fieldName);

    // Check if field with same key already exists
    const existing = await AdminUploadField.findOne({ fieldKey });
    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'A field with this name already exists'
      });
    }

    // Get the highest order number
    const lastField = await AdminUploadField.findOne()
      .sort({ order: -1 })
      .lean();
    const order = lastField ? lastField.order + 1 : 0;

    const field = await AdminUploadField.create({
      fieldName: fieldName.trim(),
      fieldKey,
      order,
      createdBy: req.user?.userId || 'admin'
    });

    res.status(201).json({
      success: true,
      field
    });
  } catch (error) {
    console.error('Error creating admin upload field:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create upload field'
    });
  }
};

// @desc    Upload file for a field
// @route   POST /api/admin/uploads/fields/:fieldId/upload
// @access  Admin only
export const uploadFile = async (req, res) => {
  try {
    const { fieldId } = req.params;

    if (!req.files || !req.files.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const file = Array.isArray(req.files.file) ? req.files.file[0] : req.files.file;
    
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv', // .csv
      'application/pdf', // .pdf
      'image/jpeg', // .jpeg, .jpg
      'image/png', // .png
      'application/vnd.google-earth.kml+xml', // .kml
      'application/vnd.google-earth.kmz', // .kmz
      'application/xml', // .kml (alternative MIME type)
      'text/xml' // .kml (alternative MIME type)
    ];

    const allowedExtensions = ['.xlsx', '.xls', '.csv', '.pdf', '.jpeg', '.jpg', '.png', '.kml', '.kmz'];

    const fileExtension = path.extname(file.name).toLowerCase();
    
    // Special handling for KML/KMZ files - allow if extension matches even if MIME type doesn't
    const isKmlFile = fileExtension === '.kml' || fileExtension === '.kmz';
    
    if (!allowedExtensions.includes(fileExtension)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file type. Allowed types: .xlsx, .csv, .pdf, .jpeg, .jpg, .png, .kml, .kmz'
      });
    }
    
    // For non-KML files, check MIME type strictly
    if (!isKmlFile && !allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file type. Allowed types: .xlsx, .csv, .pdf, .jpeg, .jpg, .png, .kml, .kmz'
      });
    }

    const field = await AdminUploadField.findById(fieldId);
    if (!field) {
      return res.status(404).json({
        success: false,
        error: 'Field not found'
      });
    }

    // Delete old file if exists
    if (field.uploadedFile && field.uploadedFile.fileUrl) {
      const oldFilePath = path.join(__dirname, '..', field.uploadedFile.fileUrl);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }

    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${field.fieldKey}-${timestamp}-${sanitizedFileName}`;
    const filePath = path.join(uploadsDir, fileName);

    // Move file to uploads directory
    await file.mv(filePath);

    // Update field with file info - store relative path from server root
    const serverRoot = path.join(__dirname, '..');
    const relativePath = path.relative(serverRoot, filePath).replace(/\\/g, '/');
    field.uploadedFile = {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.mimetype,
      fileUrl: relativePath.startsWith('uploads/') ? relativePath : `uploads/admin/${fileName}`,
      uploadedAt: new Date()
    };

    await field.save();

    const response = {
      success: true,
      field,
      fileUrl: `/api/admin/uploads/files/${fieldId}`
    };

    res.json(response);
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload file'
    });
  }
};

// @desc    Get file for a field
// @route   GET /api/admin/uploads/files/:fieldId
// @access  Admin only
export const getFile = async (req, res) => {
  try {
    const { fieldId } = req.params;
    const field = await AdminUploadField.findById(fieldId);

    if (!field || !field.uploadedFile || !field.uploadedFile.fileUrl) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    const filePath = path.join(__dirname, '..', field.uploadedFile.fileUrl);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'File not found on server'
      });
    }

    res.setHeader('Content-Disposition', `attachment; filename="${field.uploadedFile.fileName}"`);
    
    // Set correct Content-Type, especially for KML files
    let contentType = field.uploadedFile.fileType;
    if (filePath.toLowerCase().endsWith('.kml')) {
      contentType = 'application/vnd.google-earth.kml+xml';
    } else if (filePath.toLowerCase().endsWith('.kmz')) {
      contentType = 'application/vnd.google-earth.kmz';
    }
    
    res.setHeader('Content-Type', contentType);
    res.sendFile(path.resolve(filePath));
  } catch (error) {
    console.error('Error getting file:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get file'
    });
  }
};

// @desc    Delete file from a field
// @route   DELETE /api/admin/uploads/fields/:fieldId/file
// @access  Admin only
export const deleteFile = async (req, res) => {
  try {
    const { fieldId } = req.params;
    const field = await AdminUploadField.findById(fieldId);

    if (!field) {
      return res.status(404).json({
        success: false,
        error: 'Field not found'
      });
    }

    // Delete file from filesystem
    if (field.uploadedFile && field.uploadedFile.fileUrl) {
      const filePath = path.join(__dirname, '..', field.uploadedFile.fileUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Clear file info
    field.uploadedFile = {
      fileName: '',
      fileSize: 0,
      fileType: '',
      fileUrl: '',
      uploadedAt: null
    };

    await field.save();

    res.json({
      success: true,
      message: 'File deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete file'
    });
  }
};

// @desc    Delete a field
// @route   DELETE /api/admin/uploads/fields/:fieldId
// @access  Admin only
export const deleteField = async (req, res) => {
  try {
    const { fieldId } = req.params;
    const field = await AdminUploadField.findById(fieldId);

    if (!field) {
      return res.status(404).json({
        success: false,
        error: 'Field not found'
      });
    }

    // Delete associated file if exists
    if (field.uploadedFile && field.uploadedFile.fileUrl) {
      const filePath = path.join(__dirname, '..', field.uploadedFile.fileUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await AdminUploadField.findByIdAndDelete(fieldId);

    res.json({
      success: true,
      message: 'Field deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting field:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete field'
    });
  }
};

// @desc    Update field order
// @route   PUT /api/admin/uploads/fields/:fieldId/order
// @access  Admin only
export const updateFieldOrder = async (req, res) => {
  try {
    const { fieldId } = req.params;
    const { order } = req.body;

    if (typeof order !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'Order must be a number'
      });
    }

    const field = await AdminUploadField.findByIdAndUpdate(
      fieldId,
      { order },
      { new: true }
    );

    if (!field) {
      return res.status(404).json({
        success: false,
        error: 'Field not found'
      });
    }

    res.json({
      success: true,
      field
    });
  } catch (error) {
    console.error('Error updating field order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update field order'
    });
  }
};

// @desc    Get logo file (accessible to all authenticated users)
// @route   GET /api/admin/uploads/logo
// @access  Authenticated users
export const getLogo = async (req, res) => {
  try {
    // Search for logo field - try common field names/keys
    const logoField = await AdminUploadField.findOne({
      $or: [
        { fieldKey: 'bescom-logo' },
        { fieldKey: 'logo' },
        { fieldName: { $regex: /bescom.*logo|logo.*bescom/i } },
        { fieldName: { $regex: /^logo$/i } }
      ]
    }).lean();

    if (!logoField || !logoField.uploadedFile || !logoField.uploadedFile.fileUrl) {
      return res.status(404).json({
        success: false,
        error: 'Logo not found'
      });
    }

    const filePath = path.join(__dirname, '..', logoField.uploadedFile.fileUrl);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'Logo file not found on server'
      });
    }

    // Set correct Content-Type for images
    let contentType = logoField.uploadedFile.fileType || 'image/png';
    if (filePath.toLowerCase().endsWith('.jpg') || filePath.toLowerCase().endsWith('.jpeg')) {
      contentType = 'image/jpeg';
    } else if (filePath.toLowerCase().endsWith('.png')) {
      contentType = 'image/png';
    } else if (filePath.toLowerCase().endsWith('.svg')) {
      contentType = 'image/svg+xml';
    }
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    res.sendFile(path.resolve(filePath));
  } catch (error) {
    console.error('Error getting logo:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get logo'
    });
  }
};

