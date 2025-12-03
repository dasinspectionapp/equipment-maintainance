import mongoose from 'mongoose';
import Announcement from '../models/Announcement.js';

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

export async function getAnnouncements(req, res, next) {
  try {
    // Public endpoint - only return active announcements
    const activeOnly = req.query.activeOnly !== 'false';
    const query = activeOnly ? { isActive: true } : {};
    
    const announcements = await Announcement.find(query)
      .sort({ order: 1, createdAt: -1 })
      .lean();
    
    res.json({ success: true, announcements: announcements || [] });
  } catch (error) {
    console.error('Error fetching announcements:', error);
    next(error);
  }
}

export async function createAnnouncement(req, res, next) {
  try {
    const { title, description, category, date, closingDate, linkText, linkUrl, order, isActive } = req.body ?? {};

    if (!title) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }

    const maxOrderDoc = await Announcement.findOne({}, 'order', { sort: { order: -1 } }).lean();
    const resolvedOrder = toNumber(order, (maxOrderDoc?.order ?? 0) + 1);

    const announcement = await Announcement.create({
      title,
      description,
      category,
      date: date ? new Date(date) : new Date(),
      closingDate: closingDate ? new Date(closingDate) : undefined,
      linkText,
      linkUrl,
      order: resolvedOrder,
      isActive: toBoolean(isActive, true),
      createdBy: req.user?.userId || req.user?._id?.toString(),
    });

    res.status(201).json({ success: true, announcement });
  } catch (error) {
    next(error);
  }
}

export async function updateAnnouncement(req, res, next) {
  try {
    const { id } = req.params;
    const announcement = await Announcement.findById(id);
    
    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    const { title, description, category, date, closingDate, linkText, linkUrl, order, isActive } = req.body ?? {};

    if (title !== undefined) announcement.title = title;
    if (description !== undefined) announcement.description = description;
    if (category !== undefined) announcement.category = category;
    if (date !== undefined) announcement.date = date ? new Date(date) : new Date();
    if (closingDate !== undefined) announcement.closingDate = closingDate ? new Date(closingDate) : undefined;
    if (linkText !== undefined) announcement.linkText = linkText;
    if (linkUrl !== undefined) announcement.linkUrl = linkUrl;
    if (order !== undefined) announcement.order = toNumber(order, announcement.order ?? 0);
    if (isActive !== undefined) announcement.isActive = toBoolean(isActive, announcement.isActive);

    await announcement.save();
    res.json({ success: true, announcement });
  } catch (error) {
    next(error);
  }
}

export async function deleteAnnouncement(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid announcement ID' });
    }

    const result = await Announcement.findByIdAndDelete(id);
    if (!result) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    res.json({ success: true, message: 'Announcement deleted successfully' });
  } catch (error) {
    next(error);
  }
}

