import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const checkUserMapping = async (userId) => {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI;
    await mongoose.connect(mongoURI);
    console.log('MongoDB connected...\n');

    // Find user
    const user = await User.findOne({ userId: userId.toLowerCase() });

    if (!user) {
      console.log(`❌ User "${userId}" not found in database`);
      await mongoose.connection.close();
      process.exit(1);
    }

    console.log(`📋 User Details for: ${userId}`);
    console.log('━'.repeat(50));
    console.log(`User ID: ${user.userId}`);
    console.log(`Full Name: ${user.fullName}`);
    console.log(`Role: ${user.role}`);
    console.log(`Status: ${user.status}`);
    console.log(`Is Active: ${user.isActive}`);
    console.log(`Mapped To: ${JSON.stringify(user.mappedTo)}`);
    console.log(`Mapped To Count: ${user.mappedTo ? user.mappedTo.length : 0}`);
    
    if (user.mappedTo && Array.isArray(user.mappedTo)) {
      console.log('\n✅ Applications user can access:');
      user.mappedTo.forEach((app, index) => {
        console.log(`   ${index + 1}. ${app}`);
      });
      
      console.log('\n🔍 Validation Results:');
      const applications = {
        'equipment-maintenance': 'Equipment Maintenance',
        'equipment-survey': 'Equipment Survey'
      };
      
      Object.entries(applications).forEach(([formValue, dbValue]) => {
        const canAccess = user.mappedTo.includes(dbValue);
        console.log(`   ${canAccess ? '✅' : '❌'} ${dbValue}: ${canAccess ? 'CAN ACCESS' : 'CANNOT ACCESS'}`);
      });
    } else {
      console.log('\n⚠️  WARNING: User has no mappedTo array or it is empty!');
    }
    
    console.log('━'.repeat(50));
    await mongoose.connection.close();
    process.exit(0);

  } catch (error) {
    console.error('Error checking user mapping:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Get user ID from command line argument
const userId = process.argv[2];

if (!userId) {
  console.log('Usage: node utils/checkUserMapping.js <userId>');
  console.log('Example: node utils/checkUserMapping.js avinash');
  process.exit(1);
}

checkUserMapping(userId);
























