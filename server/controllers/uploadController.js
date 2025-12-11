import Upload from '../models/Upload.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import Action from '../models/Action.js';

export async function listUploads(req, res, next) {
  try {
    const docs = await Upload.find({}, { rows: 0 }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, files: docs });
  } catch (err) {
    next(err);
  }
}

export async function createUpload(req, res, next) {
  try {
    // Log user information for debugging
    console.log('Upload request - User:', req.user?.userId, 'Role:', req.user?.role);
    
    const { fileId, name, size, type, uploadType, headers, rows } = req.body || {};
    console.log('Upload request - uploadType received:', uploadType, 'for file:', name);
    if (!fileId || !name) {
      return res.status(400).json({ success: false, message: 'fileId and name are required' });
    }

    const existing = await Upload.findOne({ fileId }).lean();
    if (existing) {
      // Replace existing document for same fileId
      const finalUploadType = uploadType || 'device-status-upload';
      console.log('Updating upload with uploadType:', finalUploadType, 'for file:', name);
      await Upload.updateOne({ fileId }, { $set: { name, size, type, uploadType: finalUploadType, headers: headers || [], rows: rows || [], uploadedAt: new Date() } });
      const updated = await Upload.findOne({ fileId }, { rows: 0 }).lean();
      console.log('Upload updated - saved uploadType:', updated?.uploadType);
      
      // If CCR user uploaded, send notifications
      if (req.user && req.user.role === 'CCR') {
        console.log('CCR user detected, sending notifications...');
        await sendUploadNotificationToEquipmentUsers(req.user, name, updated.uploadedAt || updated.createdAt);
      } else {
        console.log('User is not CCR, skipping notifications. User role:', req.user?.role);
      }
      
      return res.json({ success: true, file: updated, replaced: true });
    }

    const finalUploadType = uploadType || 'device-status-upload';
    console.log('Creating upload with uploadType:', finalUploadType, 'for file:', name);
    const doc = await Upload.create({ fileId, name, size, type, uploadType: finalUploadType, headers: headers || [], rows: rows || [] });
    const lean = doc.toObject();
    delete lean.rows;
    console.log('Upload created - saved uploadType:', lean.uploadType);
    
    // If CCR user uploaded, send notifications to Equipment and RTU/Communication users
    if (req.user && req.user.role === 'CCR') {
      console.log('CCR user detected, sending notifications...');
      await sendUploadNotificationToEquipmentUsers(req.user, name, doc.uploadedAt || doc.createdAt);
    } else {
      console.log('User is not CCR, skipping notifications. User role:', req.user?.role);
    }
    
    res.status(201).json({ success: true, file: lean });
  } catch (err) {
    next(err);
  }
}

// Helper function to send notifications to Equipment and RTU/Communication users
async function sendUploadNotificationToEquipmentUsers(uploader, fileName, uploadTime) {
  try {
    // Find all active Equipment and RTU/Communication users
    const targetUsers = await User.find({
      role: { $in: ['Equipment', 'RTU/Communication'] },
      isActive: true,
      status: 'approved'
    }).select('userId');

    if (targetUsers.length === 0) {
      console.log('No Equipment or RTU/Communication users found to notify');
      return;
    }

    // Format the upload time
    const uploadDate = new Date(uploadTime);
    const formattedDate = uploadDate.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
    const formattedTime = uploadDate.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    // Prepare notification content
    const title = 'New File Uploaded by CCR Team';
    const message = `CCR team member ${uploader.fullName || uploader.userId} has uploaded a new file: "${fileName}" on ${formattedDate} at ${formattedTime}`;
    
    // Create notifications for all target users
    // Upload notifications default to Equipment Maintenance as they're typically for maintenance data
    const notifications = targetUsers.map(user => ({
      userId: user.userId,
      title: title,
      message: message,
      type: 'info',
      category: 'upload',
      application: 'Equipment Maintenance',
      link: '/dashboard/view-data', // Link to view data page
      metadata: {
        uploadedBy: uploader.userId,
        uploadedByName: uploader.fullName || uploader.userId,
        fileName: fileName,
        uploadTime: uploadTime
      }
    }));

    // Insert notifications
    await Notification.insertMany(notifications);
    console.log(`✅ Created ${notifications.length} notifications for file upload: ${fileName}`);
  } catch (error) {
    console.error('Error sending upload notifications:', error);
    // Don't throw error - we don't want to fail the upload if notification fails
  }
}

export async function getUploadById(req, res, next) {
  try {
    const { id } = req.params;
    const doc = await Upload.findOne({ fileId: id }).lean();
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, file: doc });
  } catch (err) {
    next(err);
  }
}

export async function deleteUpload(req, res, next) {
  try {
    const { id } = req.params;
    
    // Delete all Actions related to this file
    const deleteActionsResult = await Action.deleteMany({ sourceFileId: id });
    console.log(`Deleted ${deleteActionsResult.deletedCount} actions related to file ${id}`);
    
    // Delete the Upload file itself
    await Upload.deleteOne({ fileId: id });
    
    res.json({ 
      success: true,
      message: `File and ${deleteActionsResult.deletedCount} related actions deleted successfully`
    });
  } catch (err) {
    next(err);
  }
}

export async function updateUploadRows(req, res, next) {
  try {
    const { id } = req.params;
    const { rows } = req.body || {};
    if (!Array.isArray(rows)) {
      return res.status(400).json({ success: false, message: 'rows must be an array' });
    }
    
    console.log(`[UPDATE UPLOAD ROWS] Updating fileId: ${id}, rows count: ${rows.length}`);
    
    // Extract all unique column names from the rows to update headers
    const allHeaders = new Set();
    rows.forEach(row => {
      if (row && typeof row === 'object') {
        Object.keys(row).forEach(key => {
          // Skip MongoDB _id field and frontend id field
          if (key !== '_id' && key !== 'id') {
            allHeaders.add(key);
          }
        });
      }
    });
    
    const updatedHeaders = Array.from(allHeaders);
    console.log(`[UPDATE UPLOAD ROWS] Extracted ${updatedHeaders.length} unique headers from rows`);
    console.log(`[UPDATE UPLOAD ROWS] Headers include EQUIPMENT L/R SWITCH STATUS:`, updatedHeaders.some(h => {
      const n = String(h || '').toLowerCase();
      return n.includes('equipment') || n.includes('equipemnt') || n.includes('equip');
    }));
    
    // Use findOneAndUpdate with runValidators to ensure proper update
    // Update both rows and headers to reflect all columns in the saved data
    const updated = await Upload.findOneAndUpdate(
      { fileId: id }, 
      { $set: { rows, headers: updatedHeaders, updatedAt: new Date() } }, 
      { new: true, runValidators: true }
    );
    
    if (!updated) {
      console.error(`[UPDATE UPLOAD ROWS] File not found: ${id}`);
      return res.status(404).json({ success: false, message: 'File not found' });
    }
    
    console.log(`[UPDATE UPLOAD ROWS] Successfully updated file: ${id}, saved ${updated.rows?.length || 0} rows, ${updated.headers?.length || 0} headers`);
    
    // Return file without rows to reduce response size (rows are large)
    const fileResponse = updated.toObject ? updated.toObject() : updated;
    delete fileResponse.rows;
    
    res.json({ success: true, file: fileResponse, message: `Successfully updated ${rows.length} rows` });
  } catch (err) {
    console.error('[UPDATE UPLOAD ROWS] Error:', err);
    next(err);
  }
}




