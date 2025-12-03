import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const seedAdmin = async () => {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI;
    
    await mongoose.connect(mongoURI);

    console.log('MongoDB connected for seeding...');

    // Check if admin user already exists
    const existingAdmin = await User.findOne({ userId: 'admin' });

    if (existingAdmin) {
      console.log('Admin user already exists. Skipping seed.');
      await mongoose.connection.close();
      return;
    }

    // Create default admin user
    const adminUser = await User.create({
      fullName: 'System Administrator',
      userId: 'admin',
      email: 'nareshykc@gmail.com',
      mobile: '1234567890',
      designation: 'System Admin',
      role: 'Admin',
      circle: [],
      division: [],
      subDivision: [],
      sectionName: '',
      mappedTo: [], // Admin users don't need application mapping as they bypass validation
      status: 'approved',
      password: 'admin123',
      isActive: true,
    });

    console.log('✓ Default admin user created successfully');
    console.log('   User ID: admin');
    console.log('   Password: admin123');
    console.log('   Role: Admin');

    await mongoose.connection.close();
    process.exit(0);

  } catch (error) {
    console.error('Error seeding admin user:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

seedAdmin();

