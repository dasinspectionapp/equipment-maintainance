import mongoose from 'mongoose';
import LandingSlide from '../models/LandingSlide.js';
import AdminUploadField from '../models/AdminUploadField.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB (increased from 5MB to handle larger images)

const toBoolean = (value, defaultValue = true) => {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
  }
  return Boolean(value);
};

const toNumber = (value, defaultValue) => {
  if (value === undefined || value === null || value === '') return defaultValue;
  const num = Number(value);
  return Number.isFinite(num) ? num : defaultValue;
};

const encodeFileToDataUrl = (file) => {
  if (!file || !file.mimetype?.startsWith('image/')) {
    throw new Error('Uploaded file must be an image');
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('Image exceeds maximum allowed size of 10MB');
  }
  const base64 = file.data.toString('base64');
  return `data:${file.mimetype};base64,${base64}`;
};

const extractImage = (file, required = false) => {
  if (!file) {
    if (required) {
      throw new Error('Image file is required');
    }
    return undefined;
  }
  return encodeFileToDataUrl(file);
};

export async function getSlides(req, res, next) {
  try {
    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ 
        success: false, 
        error: 'Database connection unavailable. Please check MongoDB connection.' 
      });
    }
    const slides = await LandingSlide.find({}).sort({ order: 1, createdAt: 1 }).lean();
    res.json({ success: true, slides });
  } catch (error) {
    next(error);
  }
}

export async function createSlide(req, res, next) {
  try {
    const { title, subtitle, description, eyebrow, ctaLabel, ctaUrl, order, isActive } = req.body ?? {};

    if (!title) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }
    const imageFile = req.files?.image;
    const backgroundFile = req.files?.backgroundImage;

    let imageData;
    let backgroundImageData;
    try {
      imageData = extractImage(imageFile, true);
      backgroundImageData = extractImage(backgroundFile, false);
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }

    const maxOrderDoc = await LandingSlide.findOne({}, 'order', { sort: { order: -1 } }).lean();
    const resolvedOrder = toNumber(order, (maxOrderDoc?.order ?? 0) + 1);

    const slide = await LandingSlide.create({
      title,
      subtitle,
      description,
      eyebrow,
      imageData,
      ctaLabel,
      ctaUrl,
      backgroundImageData,
      order: resolvedOrder,
      isActive: toBoolean(isActive, true),
      createdBy: req.user?.userId || req.user?._id?.toString(),
    });

    res.status(201).json({ success: true, slide });
  } catch (error) {
    next(error);
  }
}

export async function updateSlide(req, res, next) {
  try {
    const { id } = req.params;
    const slide = await LandingSlide.findById(id);
    if (!slide) {
      return res.status(404).json({ success: false, message: 'Slide not found' });
    }

    const { title, subtitle, description, eyebrow, ctaLabel, ctaUrl, order, isActive } = req.body ?? {};

    if (title !== undefined) slide.title = title;
    if (subtitle !== undefined) slide.subtitle = subtitle;
    if (description !== undefined) slide.description = description;
    if (eyebrow !== undefined) slide.eyebrow = eyebrow;
    if (ctaLabel !== undefined) slide.ctaLabel = ctaLabel;
    if (ctaUrl !== undefined) slide.ctaUrl = ctaUrl;
    if (order !== undefined) slide.order = toNumber(order, slide.order ?? 0);
    if (isActive !== undefined) slide.isActive = toBoolean(isActive, slide.isActive);

    const imageFile = req.files?.image;
    const backgroundFile = req.files?.backgroundImage;

    if (imageFile) {
      try {
        slide.imageData = encodeFileToDataUrl(imageFile);
      } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
      }
    }

    if (backgroundFile) {
      try {
        slide.backgroundImageData = encodeFileToDataUrl(backgroundFile);
      } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
      }
    }

    await slide.save();
    res.json({ success: true, slide });
  } catch (error) {
    next(error);
  }
}

export async function deleteSlide(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid slide ID' });
    }

    const result = await LandingSlide.findByIdAndDelete(id);
    if (!result) {
      return res.status(404).json({ success: false, message: 'Slide not found' });
    }

    res.json({ success: true, message: 'Slide deleted successfully' });
  } catch (error) {
    next(error);
  }
}

export async function getBranding(req, res, next) {
  try {
    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ 
        success: false, 
        error: 'Database connection unavailable. Please check MongoDB connection.' 
      });
    }
    const preferredKeys = ['bescom-logo', 'branding-logo', 'brand-logo', 'header-logo', 'logo'];

    let field = await AdminUploadField.findOne({
      fieldKey: { $in: preferredKeys },
      'uploadedFile.fileUrl': { $exists: true, $ne: null },
    })
      .sort({ 'uploadedFile.uploadedAt': -1, updatedAt: -1, createdAt: -1 })
      .lean();

    if (!field) {
      field = await AdminUploadField.findOne({ 'uploadedFile.fileUrl': { $exists: true, $ne: null } })
        .sort({ 'uploadedFile.uploadedAt': -1, updatedAt: -1, createdAt: -1 })
        .lean();
    }

    if (!field?.uploadedFile?.fileUrl) {
      return res.json({ success: true, logoUrl: null, logoPath: null });
    }

    let fileUrl = field.uploadedFile.fileUrl;
    
    // If it's already a full URL, use it as-is
    if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
      return res.json({
        success: true,
        logoUrl: fileUrl,
        logoPath: fileUrl,
        meta: {
          fileName: field.uploadedFile.fileName,
          uploadedAt: field.uploadedFile.uploadedAt,
          fieldName: field.fieldName,
          fieldKey: field.fieldKey,
        },
      });
    }
    
    // For relative paths, ensure it starts with /
    const relativePath = fileUrl.startsWith('/') ? fileUrl : `/${fileUrl.replace(/^\/+/, '')}`;
    
    // Return relative path for frontend to handle (works better with proxies)
    // Frontend will use this as-is if API_BASE is empty, or prepend API_BASE if needed
    res.json({
      success: true,
      logoUrl: relativePath, // Return relative path, frontend will handle URL construction
      logoPath: relativePath,
      meta: {
        fileName: field.uploadedFile.fileName,
        uploadedAt: field.uploadedFile.uploadedAt,
        fieldName: field.fieldName,
        fieldKey: field.fieldKey,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function reorderSlides(req, res, next) {
  try {
    const { orders } = req.body ?? {};
    if (!Array.isArray(orders)) {
      return res.status(400).json({ success: false, message: 'orders must be an array' });
    }

    const bulkOps = orders
      .filter((item) => item?.id)
      .map((item) => ({
        updateOne: {
          filter: { _id: item.id },
          update: { $set: { order: toNumber(item.order, 0) } },
        },
      }));

    if (bulkOps.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid order updates provided' });
    }

    await LandingSlide.bulkWrite(bulkOps);
    const slides = await LandingSlide.find({}).sort({ order: 1, createdAt: 1 }).lean();
    res.json({ success: true, slides });
  } catch (error) {
    next(error);
  }
}

