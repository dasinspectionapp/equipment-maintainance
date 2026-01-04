/**
 * PRODUCTION DATA RESET SCRIPT
 * 
 * This script resets all offline-related data before going to production.
 * It will:
 * 1. Delete all ONLINE-OFFLINE DATA files
 * 2. Delete all Device Status Upload files
 * 3. Clear EquipmentOfflineSites collection
 * 4. Clear RTUTrackerSites collection
 * 5. Clear Actions collection
 * 6. Clear Approvals collection
 * 7. Clear UserDataState collection
 * 8. Clear Notifications related to offline sites
 * 9. KEEP: Users, Settings, Admin configurations
 * 
 * WARNING: This will delete all test/development data!
 * Use this only before deploying to production.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Upload from './models/Upload.js';
import EquipmentOfflineSites from './models/EquipmentOfflineSites.js';
import RTUTrackerSites from './models/RTUTrackerSites.js';
import Action from './models/Action.js';
import Approval from './models/Approval.js';
import UserDataState from './models/UserDataState.js';
import Notification from './models/Notification.js';
import EquipmentReports from './models/EquipmentReports.js';
import RTUTrackerApproval from './models/RTUTrackerApproval.js';

// Load environment variables
dotenv.config();

const resetProductionData = async () => {
  try {
    console.log('🚀 Starting Production Data Reset...\n');
    
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Backup counts before deletion (for confirmation)
    const counts = {
      uploads: await Upload.countDocuments(),
      offlineSites: await EquipmentOfflineSites.countDocuments(),
      rtuSites: await RTUTrackerSites.countDocuments(),
      actions: await Action.countDocuments(),
      approvals: await Approval.countDocuments(),
      userDataStates: await UserDataState.countDocuments(),
      notifications: await Notification.countDocuments(),
      reports: await EquipmentReports.countDocuments(),
      rtuApprovals: await RTUTrackerApproval.countDocuments(),
    };

    console.log('📊 Current Data Counts:');
    console.log('   - Uploads:', counts.uploads);
    console.log('   - Equipment Offline Sites:', counts.offlineSites);
    console.log('   - RTU Tracker Sites:', counts.rtuSites);
    console.log('   - Actions:', counts.actions);
    console.log('   - Approvals:', counts.approvals);
    console.log('   - User Data States:', counts.userDataStates);
    console.log('   - Notifications:', counts.notifications);
    console.log('   - Equipment Reports:', counts.reports);
    console.log('   - RTU Tracker Approvals:', counts.rtuApprovals);
    console.log();

    // Ask for confirmation (you can comment this out for automated scripts)
    console.log('⚠️  WARNING: This will DELETE all the data listed above!');
    console.log('⚠️  Users, Settings, and Admin configurations will be preserved.');
    console.log();
    
    // Wait for user confirmation (uncomment in production)
    // const readline = require('readline');
    // const rl = readline.createInterface({
    //   input: process.stdin,
    //   output: process.stdout
    // });
    // 
    // await new Promise((resolve) => {
    //   rl.question('Type "CONFIRM" to proceed with data reset: ', (answer) => {
    //     rl.close();
    //     if (answer !== 'CONFIRM') {
    //       console.log('❌ Reset cancelled.');
    //       process.exit(0);
    //     }
    //     resolve();
    //   });
    // });

    console.log('🗑️  Starting deletion process...\n');

    // 1. Delete all ONLINE-OFFLINE DATA files
    console.log('1️⃣  Deleting ONLINE-OFFLINE DATA files...');
    const onlineOfflineResult = await Upload.deleteMany({
      $or: [
        { uploadType: 'online-offline-data' },
        { name: { $regex: /online.*offline/i } }
      ]
    });
    console.log(`   ✅ Deleted ${onlineOfflineResult.deletedCount} ONLINE-OFFLINE files\n`);

    // 2. Delete all Device Status Upload files
    console.log('2️⃣  Deleting Device Status Upload files...');
    const deviceStatusResult = await Upload.deleteMany({
      uploadType: 'device-status-upload'
    });
    console.log(`   ✅ Deleted ${deviceStatusResult.deletedCount} Device Status Upload files\n`);

    // 3. Delete all RTU Tracker files
    console.log('3️⃣  Deleting RTU Tracker files...');
    const rtuTrackerFilesResult = await Upload.deleteMany({
      $or: [
        { uploadType: 'rtu-tracker' },
        { name: { $regex: /rtu.*tracker/i } }
      ]
    });
    console.log(`   ✅ Deleted ${rtuTrackerFilesResult.deletedCount} RTU Tracker files\n`);

    // 4. Delete all other Upload files (optional - uncomment if needed)
    // console.log('4️⃣  Deleting all remaining Upload files...');
    // const remainingUploadsResult = await Upload.deleteMany({});
    // console.log(`   ✅ Deleted ${remainingUploadsResult.deletedCount} remaining Upload files\n`);

    // 5. Clear EquipmentOfflineSites collection
    console.log('4️⃣  Clearing Equipment Offline Sites...');
    const offlineSitesResult = await EquipmentOfflineSites.deleteMany({});
    console.log(`   ✅ Deleted ${offlineSitesResult.deletedCount} offline site records\n`);

    // 6. Clear RTUTrackerSites collection
    console.log('5️⃣  Clearing RTU Tracker Sites...');
    const rtuSitesResult = await RTUTrackerSites.deleteMany({});
    console.log(`   ✅ Deleted ${rtuSitesResult.deletedCount} RTU tracker site records\n`);

    // 7. Clear Actions collection
    console.log('6️⃣  Clearing Actions...');
    const actionsResult = await Action.deleteMany({});
    console.log(`   ✅ Deleted ${actionsResult.deletedCount} action records\n`);

    // 8. Clear Approvals collection
    console.log('7️⃣  Clearing Approvals...');
    const approvalsResult = await Approval.deleteMany({});
    console.log(`   ✅ Deleted ${approvalsResult.deletedCount} approval records\n`);

    // 9. Clear UserDataState collection
    console.log('8️⃣  Clearing User Data States...');
    const userDataStateResult = await UserDataState.deleteMany({});
    console.log(`   ✅ Deleted ${userDataStateResult.deletedCount} user data state records\n`);

    // 10. Clear Equipment Reports
    console.log('9️⃣  Clearing Equipment Reports...');
    const reportsResult = await EquipmentReports.deleteMany({});
    console.log(`   ✅ Deleted ${reportsResult.deletedCount} equipment report records\n`);

    // 11. Clear RTU Tracker Approvals
    console.log('🔟 Clearing RTU Tracker Approvals...');
    const rtuApprovalsResult = await RTUTrackerApproval.deleteMany({});
    console.log(`   ✅ Deleted ${rtuApprovalsResult.deletedCount} RTU tracker approval records\n`);

    // 12. Clear Notifications related to offline sites
    console.log('1️⃣1️⃣  Clearing Notifications...');
    const notificationsResult = await Notification.deleteMany({
      $or: [
        { application: 'Distribution Automation System' },
        { application: 'Equipment Maintenance' }
      ]
    });
    console.log(`   ✅ Deleted ${notificationsResult.deletedCount} notification records\n`);

    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✨ Production Data Reset Complete!\n');
    console.log('📊 Summary:');
    console.log(`   - ONLINE-OFFLINE files: ${onlineOfflineResult.deletedCount}`);
    console.log(`   - Device Status Upload files: ${deviceStatusResult.deletedCount}`);
    console.log(`   - RTU Tracker files: ${rtuTrackerFilesResult.deletedCount}`);
    console.log(`   - Equipment Offline Sites: ${offlineSitesResult.deletedCount}`);
    console.log(`   - RTU Tracker Sites: ${rtuSitesResult.deletedCount}`);
    console.log(`   - Actions: ${actionsResult.deletedCount}`);
    console.log(`   - Approvals: ${approvalsResult.deletedCount}`);
    console.log(`   - User Data States: ${userDataStateResult.deletedCount}`);
    console.log(`   - Equipment Reports: ${reportsResult.deletedCount}`);
    console.log(`   - RTU Tracker Approvals: ${rtuApprovalsResult.deletedCount}`);
    console.log(`   - Notifications: ${notificationsResult.deletedCount}`);
    console.log();
    console.log('✅ Database is ready for production deployment!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Close connection
    await mongoose.connection.close();
    console.log('📡 MongoDB connection closed');
    console.log('👋 Done!\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error resetting production data:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Run the reset
resetProductionData();

