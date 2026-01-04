/**
 * CLEANUP DUPLICATE APPROVALS SCRIPT
 * 
 * This script removes duplicate CCR approval entries for the same site code.
 * It keeps the approval with the highest priority status:
 * Priority: Approved > Kept for Monitoring > Recheck Requested > Pending
 * 
 * Use this to clean up duplicates before the fix prevents new ones.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Approval from './models/Approval.js';

// Load environment variables
dotenv.config();

const cleanupDuplicateApprovals = async () => {
  try {
    console.log('🚀 Starting Duplicate Approvals Cleanup...\n');
    
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Fetch all CCR Resolution Approvals
    console.log('📊 Fetching all CCR Resolution Approvals...');
    const allApprovals = await Approval.find({
      approvalType: 'CCR Resolution Approval'
    })
    .sort({ createdAt: 1 }) // Oldest first
    .lean();

    console.log(`Found ${allApprovals.length} CCR Resolution Approvals\n`);

    // Group by equipmentOfflineSiteId and siteCode
    const groups = new Map();
    
    allApprovals.forEach(approval => {
      // Use equipmentOfflineSiteId as primary key, fallback to siteCode
      const key = approval.equipmentOfflineSiteId 
        ? `equipment_${approval.equipmentOfflineSiteId.toString()}`
        : `sitecode_${approval.siteCode}`;
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(approval);
    });

    console.log(`Found ${groups.size} unique sites\n`);

    // Status priority for keeping approvals
    const statusPriority = {
      'Approved': 4,
      'Kept for Monitoring': 3,
      'Recheck Requested': 2,
      'Pending': 1,
      'In Progress': 1
    };

    let duplicatesFound = 0;
    let duplicatesRemoved = 0;
    const toDelete = [];

    // Process each group
    groups.forEach((approvals, key) => {
      if (approvals.length > 1) {
        duplicatesFound++;
        console.log(`\n🔍 Found ${approvals.length} approvals for ${key}:`);
        
        approvals.forEach(a => {
          console.log(`   - ID: ${a._id}, Status: ${a.status}, Created: ${new Date(a.createdAt).toLocaleString()}`);
        });

        // Sort by priority and creation date (keep highest priority, or newest if same priority)
        approvals.sort((a, b) => {
          const priorityA = statusPriority[a.status] || 0;
          const priorityB = statusPriority[b.status] || 0;
          
          if (priorityA !== priorityB) {
            return priorityB - priorityA; // Higher priority first
          }
          
          // Same priority - keep newer one
          return new Date(b.createdAt) - new Date(a.createdAt);
        });

        // Keep the first one, mark others for deletion
        const toKeep = approvals[0];
        const toRemove = approvals.slice(1);

        console.log(`   ✅ KEEPING: ID ${toKeep._id} (Status: ${toKeep.status}, Created: ${new Date(toKeep.createdAt).toLocaleString()})`);
        
        toRemove.forEach(a => {
          console.log(`   ❌ DELETING: ID ${a._id} (Status: ${a.status}, Created: ${new Date(a.createdAt).toLocaleString()})`);
          toDelete.push(a._id);
        });
        
        duplicatesRemoved += toRemove.length;
      }
    });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Summary:');
    console.log(`   - Total approvals: ${allApprovals.length}`);
    console.log(`   - Unique sites: ${groups.size}`);
    console.log(`   - Sites with duplicates: ${duplicatesFound}`);
    console.log(`   - Duplicates to remove: ${duplicatesRemoved}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (toDelete.length === 0) {
      console.log('✅ No duplicates found! Database is clean.\n');
    } else {
      console.log(`⚠️  About to delete ${toDelete.length} duplicate approvals...\n`);
      
      // Uncomment the line below to actually delete (for safety, it's commented by default)
      // await Approval.deleteMany({ _id: { $in: toDelete } });
      
      console.log('⚠️  DELETION IS DISABLED BY DEFAULT FOR SAFETY!');
      console.log('⚠️  To actually delete duplicates, uncomment line 113 in the script.\n');
      console.log('💡 Duplicate IDs to delete:');
      toDelete.forEach(id => console.log(`   - ${id}`));
    }

    // Close connection
    await mongoose.connection.close();
    console.log('\n📡 MongoDB connection closed');
    console.log('👋 Done!\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error cleaning up duplicate approvals:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Run the cleanup
cleanupDuplicateApprovals();

