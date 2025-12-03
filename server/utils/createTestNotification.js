import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Notification from '../models/Notification.js';

dotenv.config();

const createTestNotifications = async () => {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI;
    await mongoose.connect(mongoURI);
    console.log('MongoDB Connected');

    // Get all users
    const users = await User.find({ isActive: true, status: 'approved' });
    console.log(`Found ${users.length} active users`);

    if (users.length === 0) {
      console.log('No active users found. Please create users first.');
      process.exit(1);
    }

    // Create sample notifications for each user
    const notifications = [];
    const types = ['info', 'success', 'warning', 'error'];
    const categories = ['system', 'maintenance', 'survey', 'user_approval', 'upload', 'general'];
    
    const sampleNotifications = [
      {
        title: 'Welcome to DAS',
        message: 'Welcome to the Distribution Automation System. Start exploring the features.',
        type: 'success',
        category: 'system'
      },
      {
        title: 'New Equipment Survey Available',
        message: 'A new equipment survey has been assigned to you. Please complete it at your earliest convenience.',
        type: 'info',
        category: 'survey'
      },
      {
        title: 'Maintenance Reminder',
        message: 'Your scheduled maintenance task is due next week. Please review and prepare.',
        type: 'warning',
        category: 'maintenance'
      },
      {
        title: 'Upload Successful',
        message: 'Your equipment data upload has been processed successfully.',
        type: 'success',
        category: 'upload'
      },
      {
        title: 'System Update',
        message: 'A new system update is available. Check the settings page for details.',
        type: 'info',
        category: 'system'
      }
    ];

    for (const user of users) {
      // Create 2-3 random notifications per user
      const numNotifications = Math.floor(Math.random() * 2) + 2; // 2-3 notifications
      const selectedNotifications = sampleNotifications
        .sort(() => 0.5 - Math.random())
        .slice(0, numNotifications);

      for (const notif of selectedNotifications) {
        notifications.push({
          userId: user.userId,
          title: notif.title,
          message: notif.message,
          type: notif.type,
          category: notif.category,
          isRead: Math.random() > 0.5, // Random read/unread
          createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000) // Random time within last 7 days
        });
      }
    }

    // Insert notifications
    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
      console.log(`✅ Created ${notifications.length} test notifications`);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error creating test notifications:', error);
    process.exit(1);
  }
};

createTestNotifications();

















