import mongoose from 'mongoose';
import dotenv from 'dotenv';
import EquipmentOfflineSites from '../models/EquipmentOfflineSites.js';
import User from '../models/User.js';

dotenv.config();

const resetEquipmentOfflineSites = async () => {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI;
    
    await mongoose.connect(mongoURI);

    console.log('MongoDB connected...');

    // Find all Equipment role users
    const equipmentUsers = await User.find({ role: 'Equipment' }).select('userId');
    
    if (equipmentUsers.length === 0) {
      console.log('No Equipment role users found in database');
      await mongoose.connection.close();
      process.exit(0);
    }

    console.log(`Found ${equipmentUsers.length} Equipment role user(s)`);
    
    const equipmentUserIds = equipmentUsers.map(u => u.userId);
    console.log('Equipment User IDs:', equipmentUserIds.join(', '));

    // Delete all EquipmentOfflineSites records for Equipment users
    const deleteResult = await EquipmentOfflineSites.deleteMany({
      userId: { $in: equipmentUserIds }
    });

    console.log(`\n✓ Successfully deleted ${deleteResult.deletedCount} Equipment offline sites records`);
    console.log('\n📋 Reset Summary:');
    console.log('   - Site Observations: Cleared');
    console.log('   - Task Status: Cleared');
    console.log('   - Type of Issue: Cleared');
    console.log('   - View Photos: Cleared');
    console.log('   - Remarks: Cleared');
    console.log('   - Photo Metadata: Cleared');
    console.log('   - Support Documents: Cleared');
    
    console.log('\n⚠️  IMPORTANT: You also need to clear localStorage in the browser:');
    console.log('   1. Open browser Developer Tools (F12)');
    console.log('   2. Go to Application/Storage tab');
    console.log('   3. Find "Local Storage" → your domain');
    console.log('   4. Delete all keys starting with "myData_"');
    console.log('   5. Or run this in browser console:');
    console.log('      Object.keys(localStorage).filter(k => k.startsWith("myData_")).forEach(k => localStorage.removeItem(k));');
    console.log('\n   Alternatively, you can clear all localStorage:');
    console.log('      localStorage.clear();');

    await mongoose.connection.close();
    process.exit(0);

  } catch (error) {
    console.error('Error resetting Equipment offline sites:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

resetEquipmentOfflineSites();


