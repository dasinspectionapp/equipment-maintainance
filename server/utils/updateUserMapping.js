import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const updateUserMapping = async (userId, mappedTo) => {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI;
    await mongoose.connect(mongoURI);
    console.log('MongoDB connected...\n');

    // Validate mappedTo array
    const validApplications = ['Equipment Maintenance', 'Equipment Survey'];
    const invalidApps = mappedTo.filter(app => !validApplications.includes(app));
    
    if (invalidApps.length > 0) {
      console.log(`❌ Invalid applications: ${invalidApps.join(', ')}`);
      console.log(`Valid applications are: ${validApplications.join(', ')}`);
      await mongoose.connection.close();
      process.exit(1);
    }

    // Update user's mappedTo
    const user = await User.findOneAndUpdate(
      { userId: userId.toLowerCase() },
      { mappedTo: mappedTo },
      { new: true }
    );

    if (!user) {
      console.log(`❌ User "${userId}" not found in database`);
      await mongoose.connection.close();
      process.exit(1);
    }

    console.log(`✅ User mapping updated successfully!`);
    console.log('━'.repeat(50));
    console.log(`User ID: ${user.userId}`);
    console.log(`Full Name: ${user.fullName}`);
    console.log(`Role: ${user.role}`);
    console.log(`Updated Mapped To: ${JSON.stringify(user.mappedTo)}`);
    console.log('━'.repeat(50));
    
    await mongoose.connection.close();
    process.exit(0);

  } catch (error) {
    console.error('Error updating user mapping:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Get user ID and mappings from command line arguments
const userId = process.argv[2];
const mappedToArg = process.argv[3];

if (!userId || !mappedToArg) {
  console.log('Usage: node utils/updateUserMapping.js <userId> <mappedTo>');
  console.log('Example: node utils/updateUserMapping.js avinash1 "Equipment Maintenance"');
  console.log('Example (multiple): node utils/updateUserMapping.js user1 "Equipment Maintenance,Equipment Survey"');
  process.exit(1);
}

// Parse mappedTo (supports comma-separated values)
const mappedTo = mappedToArg.split(',').map(app => app.trim());

updateUserMapping(userId, mappedTo);

