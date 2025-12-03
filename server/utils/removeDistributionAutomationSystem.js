import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const removeDistributionAutomationSystem = async () => {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI;
    await mongoose.connect(mongoURI);
    console.log('MongoDB connected...\n');

    // Find all users with "Distribution Automation System" in their mappedTo
    const users = await User.find({
      mappedTo: { $in: ['Distribution Automation System'] }
    });

    if (users.length === 0) {
      console.log('✅ No users found mapped to "Distribution Automation System"');
      await mongoose.connection.close();
      process.exit(0);
    }

    console.log(`📋 Found ${users.length} user(s) mapped to "Distribution Automation System":\n`);

    for (const user of users) {
      console.log(`   - ${user.userId} (${user.fullName}) - Role: ${user.role}`);
      console.log(`     Current: ${JSON.stringify(user.mappedTo)}`);

      // Remove "Distribution Automation System" from mappedTo array
      const updatedMappedTo = user.mappedTo.filter(
        app => app !== 'Distribution Automation System'
      );

      // Update the user
      user.mappedTo = updatedMappedTo;
      await user.save();

      console.log(`     Updated: ${JSON.stringify(updatedMappedTo)}\n`);
    }

    console.log('✅ All users updated successfully!');
    await mongoose.connection.close();
    process.exit(0);

  } catch (error) {
    console.error('Error removing Distribution Automation System:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

removeDistributionAutomationSystem();
























