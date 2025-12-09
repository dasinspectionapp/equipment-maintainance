import ELibraryResource from '../models/ELibraryResource.js';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '..', 'uploads', 'elibrary');

// Helper function to ensure uploads directory exists
const ensureUploadsDir = async () => {
  try {
    await fs.mkdir(uploadsDir, { recursive: true });
    console.log('E-Library uploads directory ensured:', uploadsDir);
  } catch (error) {
    console.error('Error creating uploads directory:', error);
    throw error;
  }
};

// @desc    Get all e-library resources (public - for landing page)
// @route   GET /api/elibrary
// @access  Public
export const getAllResources = async (req, res) => {
  try {
    const { category, search, tag } = req.query;
    const query = { isActive: true };

    if (category) {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    if (tag) {
      query.tags = { $in: [tag] };
    }

    const resources = await ELibraryResource.find(query)
      .sort({ order: 1, createdAt: -1 })
      .select('-file.fileUrl'); // Don't expose file path

    res.json({
      success: true,
      count: resources.length,
      data: resources
    });
  } catch (error) {
    console.error('Error fetching e-library resources:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch resources'
    });
  }
};

// @desc    Get single resource
// @route   GET /api/elibrary/:id
// @access  Public
export const getResource = async (req, res) => {
  try {
    const resource = await ELibraryResource.findById(req.params.id);
    
    if (!resource || !resource.isActive) {
      return res.status(404).json({
        success: false,
        error: 'Resource not found'
      });
    }

    res.json({
      success: true,
      data: resource
    });
  } catch (error) {
    console.error('Error fetching resource:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch resource'
    });
  }
};

// @desc    Create resource (Admin only)
// @route   POST /api/admin/elibrary
// @access  Admin only
export const createResource = async (req, res) => {
  try {
    // Handle both JSON and form-data requests
    // For form-data, req.body contains string values that need to be parsed
    let title, description, category, tags, link;
    
    if (req.headers['content-type']?.includes('application/json')) {
      // JSON request (for link-based resources)
      ({ title, description, category, tags, link } = req.body);
    } else {
      // Form-data request (for file uploads)
      // Form-data values come as strings, handle them appropriately
      title = typeof req.body.title === 'string' ? req.body.title.trim() : req.body.title;
      description = typeof req.body.description === 'string' ? req.body.description.trim() : req.body.description;
      category = typeof req.body.category === 'string' ? req.body.category.trim() : req.body.category;
      tags = req.body.tags;
      link = typeof req.body.link === 'string' ? req.body.link.trim() : req.body.link;
    }

    // Validate required fields
    if (!title || (typeof title === 'string' && !title.trim())) {
      return res.status(400).json({
        success: false,
        error: 'Title is required'
      });
    }

    if (!category || (typeof category === 'string' && !category.trim())) {
      return res.status(400).json({
        success: false,
        error: 'Category is required'
      });
    }

    // Check if either file or link is provided
    const hasFile = req.files && req.files.file;
    const hasLink = link && link.trim() !== '';

    if (!hasFile && !hasLink) {
      return res.status(400).json({
        success: false,
        error: 'Either a file or a link is required'
      });
    }

    if (hasFile && hasLink) {
      return res.status(400).json({
        success: false,
        error: 'Please provide either a file or a link, not both'
      });
    }

    let resourceData = {
      title,
      description: description || '',
      category,
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim()).filter(Boolean)) : [],
      resourceType: hasLink ? 'link' : 'file',
      link: hasLink ? link.trim() : '',
      file: {
        fileName: '',
        fileSize: 0,
        fileType: '',
        fileUrl: '',
        uploadedAt: null
      }
    };

    // Handle file upload
    if (hasFile) {
      // Ensure uploads directory exists
      await ensureUploadsDir();
      
      const file = Array.isArray(req.files.file) ? req.files.file[0] : req.files.file;
    
    // Allowed file extensions (more permissive - support all common formats)
    const allowedExtensions = [
      // Documents
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.rtf', '.odt', '.ods', '.odp',
      // Images
      '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp', '.tiff', '.ico',
      // Videos
      '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv', '.m4v', '.3gp',
      // Audio
      '.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma', '.m4a',
      // Archives
      '.zip', '.rar', '.7z', '.tar', '.gz',
      // Other
      '.csv', '.xml', '.json', '.html', '.htm'
    ];

      // Get file extension
      const fileExtension = path.extname(file.name).toLowerCase();
      
      if (!allowedExtensions.includes(fileExtension)) {
        return res.status(400).json({
          success: false,
          error: `Invalid file type. Allowed extensions: ${allowedExtensions.join(', ')}`
        });
      }

      // Generate unique filename
      const timestamp = Date.now();
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `${timestamp}-${sanitizedFileName}`;
      const filePath = path.join(uploadsDir, fileName);

      // Move file
      try {
        await file.mv(filePath);
      } catch (mvError) {
        console.error('Error moving file:', mvError);
        return res.status(500).json({
          success: false,
          error: mvError.message || 'Failed to save file. Please check file permissions.'
        });
      }

      resourceData.file = {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.mimetype,
        fileUrl: `uploads/elibrary/${fileName}`,
        uploadedAt: new Date()
      };
    }

    // Handle link - validate URL format
    if (hasLink) {
      try {
        new URL(link.trim());
      } catch {
        return res.status(400).json({
          success: false,
          error: 'Invalid URL format'
        });
      }
    }

    // Get max order value
    const maxOrder = await ELibraryResource.findOne().sort({ order: -1 }).select('order');
    const order = maxOrder ? (maxOrder.order || 0) + 1 : 0;

    // Create resource
    const resource = await ELibraryResource.create({
      ...resourceData,
      order,
      createdBy: req.user?.userId || 'admin'
    });

    res.status(201).json({
      success: true,
      data: resource
    });
  } catch (error) {
    console.error('Error creating resource:', error);
    
    // Provide more detailed error messages
    let errorMessage = 'Failed to create resource';
    if (error.message) {
      errorMessage = error.message;
    } else if (error.code === 'LIMIT_FILE_SIZE') {
      errorMessage = 'File size exceeds the maximum allowed limit (100MB)';
    } else if (error.code === 'ENOENT') {
      errorMessage = 'Upload directory not found. Please contact administrator.';
    } else if (error.code === 'EACCES' || error.code === 'EPERM') {
      errorMessage = 'Permission denied. Please contact administrator.';
    }
    
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
};

// @desc    Get all resources (Admin - includes inactive)
// @route   GET /api/admin/elibrary
// @access  Admin only
export const getAllResourcesAdmin = async (req, res) => {
  try {
    const resources = await ELibraryResource.find()
      .sort({ order: 1, createdAt: -1 });

    res.json({
      success: true,
      count: resources.length,
      data: resources
    });
  } catch (error) {
    console.error('Error fetching e-library resources:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch resources'
    });
  }
};

// @desc    Update resource (Admin only)
// @route   PUT /api/admin/elibrary/:id
// @access  Admin only
export const updateResource = async (req, res) => {
  try {
    const { title, description, category, tags, isActive, order, link } = req.body;
    const resource = await ELibraryResource.findById(req.params.id);

    if (!resource) {
      return res.status(404).json({
        success: false,
        error: 'Resource not found'
      });
    }

    if (title) resource.title = title;
    if (description !== undefined) resource.description = description;
    if (category) resource.category = category;
    if (tags !== undefined) {
      resource.tags = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim()).filter(Boolean);
    }
    if (isActive !== undefined) resource.isActive = isActive;
    if (order !== undefined) resource.order = order;
    if (link !== undefined) {
      if (link && link.trim() !== '') {
        try {
          new URL(link.trim());
          resource.link = link.trim();
          resource.resourceType = 'link';
        } catch {
          return res.status(400).json({
            success: false,
            error: 'Invalid URL format'
          });
        }
      } else {
        resource.link = '';
      }
    }

    await resource.save();

    res.json({
      success: true,
      data: resource
    });
  } catch (error) {
    console.error('Error updating resource:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update resource'
    });
  }
};

// @desc    Delete resource (Admin only)
// @route   DELETE /api/admin/elibrary/:id
// @access  Admin only
export const deleteResource = async (req, res) => {
  try {
    const resource = await ELibraryResource.findById(req.params.id);

    if (!resource) {
      return res.status(404).json({
        success: false,
        error: 'Resource not found'
      });
    }

    // Delete file
    if (resource.file?.fileUrl) {
      const filePath = path.join(__dirname, '..', resource.file.fileUrl);
      try {
        await fs.unlink(filePath);
      } catch (err) {
        console.warn('File not found or already deleted:', filePath);
      }
    }

    await resource.deleteOne();

    res.json({
      success: true,
      message: 'Resource deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting resource:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete resource'
    });
  }
};

// @desc    Download resource file or redirect to link
// @route   GET /api/elibrary/:id/download
// @access  Public
export const downloadResource = async (req, res) => {
  try {
    const resource = await ELibraryResource.findById(req.params.id);

    if (!resource || !resource.isActive) {
      return res.status(404).json({
        success: false,
        error: 'Resource not found'
      });
    }

    // If it's a link resource, redirect to the link
    if (resource.resourceType === 'link' && resource.link) {
      // Increment view/download count
      resource.downloadCount += 1;
      await resource.save();
      
      return res.redirect(resource.link);
    }

    // Otherwise, download the file
    if (!resource.file || !resource.file.fileUrl) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    const filePath = path.join(__dirname, '..', resource.file.fileUrl);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    // Increment download count
    resource.downloadCount += 1;
    await resource.save();

    res.download(filePath, resource.file.fileName, (err) => {
      if (err) {
        console.error('Error downloading file:', err);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: 'Failed to download file'
          });
        }
      }
    });
  } catch (error) {
    console.error('Error downloading resource:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to download resource'
    });
  }
};

// @desc    Get categories and tags (for filters)
// @route   GET /api/elibrary/filters
// @access  Public
export const getFilters = async (req, res) => {
  try {
    const resources = await ELibraryResource.find({ isActive: true });
    
    const categories = [...new Set(resources.map(r => r.category))];
    const allTags = resources.flatMap(r => r.tags || []);
    const tags = [...new Set(allTags)].filter(Boolean);

    res.json({
      success: true,
      data: {
        categories,
        tags
      }
    });
  } catch (error) {
    console.error('Error fetching filters:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch filters'
    });
  }
};

