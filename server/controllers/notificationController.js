import Notification from '../models/Notification.js';

// Get all notifications for a user
export const getUserNotifications = async (req, res) => {
  try {
    // User document has userId field (string identifier)
    const userId = req.user.userId || req.user._id.toString();
    const { limit = 50, offset = 0, unreadOnly = false, application } = req.query;

    const query = { userId };
    
    // Map frontend values to backend values
    const applicationMap = {
      'equipment-maintenance': 'Equipment Maintenance',
      'equipment-survey': 'Equipment Survey',
      'distribution-automation-system': 'Distribution Automation System'
    };
    
    // Always filter by application if provided - this ensures notifications are separated by application
    if (application && application.trim() !== '') {
      const mappedApplication = applicationMap[application] || application;
      query.application = mappedApplication;
      console.log(`[Notifications] Filtering by application: ${mappedApplication} for user: ${userId}`);
    } else {
      // If no application provided, exclude notifications without application field or with null/undefined
      // This prevents old notifications from showing up when application is not specified
      query.application = { $exists: true, $ne: null };
      console.log(`[Notifications] No application specified, excluding notifications without application field for user: ${userId}`);
    }
    
    if (unreadOnly === 'true') {
      query.isRead = false;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    // Use same query for counts
    const countQuery = { ...query };
    
    const totalCount = await Notification.countDocuments(countQuery);
    const unreadCountQuery = { ...countQuery, isRead: false };
    const unreadCount = await Notification.countDocuments(unreadCountQuery);

    res.status(200).json({
      success: true,
      data: {
        notifications,
        totalCount,
        unreadCount
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get unread notification count
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.userId || req.user._id.toString();
    const { application } = req.query;

    const query = {
      userId,
      isRead: false
    };
    
    // Map frontend values to backend values
    const applicationMap = {
      'equipment-maintenance': 'Equipment Maintenance',
      'equipment-survey': 'Equipment Survey',
      'distribution-automation-system': 'Distribution Automation System'
    };
    
    // Always filter by application if provided
    if (application && application.trim() !== '') {
      const mappedApplication = applicationMap[application] || application;
      query.application = mappedApplication;
      console.log(`[UnreadCount] Filtering by application: ${mappedApplication} for user: ${userId}`);
    } else {
      // If no application provided, exclude notifications without application field
      query.application = { $exists: true, $ne: null };
      console.log(`[UnreadCount] No application specified, excluding notifications without application field for user: ${userId}`);
    }

    const unreadCount = await Notification.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        unreadCount
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Mark notification as read
export const markAsRead = async (req, res) => {
  try {
    const userId = req.user.userId || req.user._id.toString();
    const { notificationId } = req.params;

    const notification = await Notification.findOne({
      _id: notificationId,
      userId
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    res.status(200).json({
      success: true,
      data: notification
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Mark all notifications as read
export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.userId || req.user._id.toString();
    const { application } = req.body;

    const query = { userId, isRead: false };
    
    // Map frontend values to backend values
    const applicationMap = {
      'equipment-maintenance': 'Equipment Maintenance',
      'equipment-survey': 'Equipment Survey',
      'distribution-automation-system': 'Distribution Automation System'
    };
    
    // Always filter by application if provided
    if (application && application.trim() !== '') {
      const mappedApplication = applicationMap[application] || application;
      query.application = mappedApplication;
    } else {
      // If no application provided, exclude notifications without application field
      query.application = { $exists: true, $ne: null };
    }

    const result = await Notification.updateMany(
      query,
      {
        $set: {
          isRead: true,
          readAt: new Date()
        }
      }
    );

    res.status(200).json({
      success: true,
      data: {
        updatedCount: result.modifiedCount
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Delete a notification
export const deleteNotification = async (req, res) => {
  try {
    const userId = req.user.userId || req.user._id.toString();
    const { notificationId } = req.params;

    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      userId
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Delete all notifications for a user
export const deleteAllNotifications = async (req, res) => {
  try {
    const userId = req.user.userId || req.user._id.toString();
    const { application } = req.query;

    const query = { userId };
    
    // Map frontend values to backend values
    const applicationMap = {
      'equipment-maintenance': 'Equipment Maintenance',
      'equipment-survey': 'Equipment Survey',
      'distribution-automation-system': 'Distribution Automation System'
    };
    
    // Always filter by application if provided
    if (application && application.trim() !== '') {
      const mappedApplication = applicationMap[application] || application;
      query.application = mappedApplication;
    } else {
      // If no application provided, exclude notifications without application field
      query.application = { $exists: true, $ne: null };
    }

    // Verify we're deleting only for the authenticated user
    const result = await Notification.deleteMany(query);

    console.log(`✅ Deleted ${result.deletedCount} notifications for user: ${userId}`);

    res.status(200).json({
      success: true,
      data: {
        deletedCount: result.deletedCount,
        userId: userId // Include userId in response for verification
      },
      message: 'All notifications deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting all notifications:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Create a notification (typically used by system/admins)
export const createNotification = async (req, res) => {
  try {
    const { userId, title, message, type, category, link, metadata, application } = req.body;

    // If userId is an array, create notifications for multiple users
    if (Array.isArray(userId)) {
      const notifications = userId.map(id => ({
        userId: id,
        title,
        message,
        type: type || 'info',
        category: category || 'general',
        application: application || 'Distribution Automation System',
        link,
        metadata: metadata || {}
      }));

      const createdNotifications = await Notification.insertMany(notifications);

      return res.status(201).json({
        success: true,
        data: createdNotifications
      });
    }

    // Single user notification
    const notification = await Notification.create({
      userId,
      title,
      message,
      type: type || 'info',
      category: category || 'general',
      application: application || 'Distribution Automation System',
      link,
      metadata: metadata || {}
    });

    res.status(201).json({
      success: true,
      data: notification
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

