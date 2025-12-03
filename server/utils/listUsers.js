import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const listUsers = async () => {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI;
    await mongoose.connect(mongoURI);
    console.log('MongoDB connected...\n');

    // Find all users
    const users = await User.find({}).select('userId fullName role status mappedTo isActive');

    if (users.length === 0) {
      console.log('❌ No users found in database');
      await mongoose.connection.close();
      process.exit(1);
    }

    console.log(`📋 Found ${users.length} user(s) in database:\n`);
    console.log('━'.repeat(80));
    
    users.forEach((user, index) => {
      console.log(`\n${index + 1}. User ID: ${user.userId}`);
      console.log(`   Full Name: ${user.fullName}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Status: ${user.status}`);
      console.log(`   Is Active: ${user.isActive}`);
      console.log(`   Mapped To: ${JSON.stringify(user.mappedTo)}`);
    });
    
    console.log('\n' + '━'.repeat(80));
    await mongoose.connection.close();
    process.exit(0);

  } catch (error) {
    console.error('Error listing users:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

listUsers();
























