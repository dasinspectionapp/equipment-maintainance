import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const updateAdminStatus = async () => {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI;
    
    await mongoose.connect(mongoURI);

    console.log('MongoDB connected for updating admin status...');

    // Find and update admin user
    const adminUser = await User.findOneAndUpdate(
      { userId: 'admin' },
      { 
        status: 'approved',
        isActive: true,
        mappedTo: [] // Admin users don't need application mapping as they bypass validation
      },
      { new: true }
    );

    if (adminUser) {
      console.log('✓ Admin user updated successfully');
      console.log('   User ID:', adminUser.userId);
      console.log('   Status:', adminUser.status);
      console.log('   isActive:', adminUser.isActive);
    } else {
      console.log('⚠ Admin user not found');
    }

    await mongoose.connection.close();
    process.exit(0);

  } catch (error) {
    console.error('Error updating admin status:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

updateAdminStatus();





