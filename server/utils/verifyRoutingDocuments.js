import mongoose from 'mongoose';
import EquipmentOfflineSites from '../models/EquipmentOfflineSites.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Verify that both original and routed documents exist for a given routing
 * Usage: node server/utils/verifyRoutingDocuments.js <fileId> <siteCode>
 */
const verifyRoutingDocuments = async () => {
  try {
    const fileId = process.argv[2];
    const siteCode = process.argv[3];

    if (!fileId || !siteCode) {
      console.error('Usage: node verifyRoutingDocuments.js <fileId> <siteCode>');
      console.error('Example: node verifyRoutingDocuments.js nc35yh 3W1575');
      process.exit(1);
    }

    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI;
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB\n');

    const normalizedSiteCode = siteCode.trim().toUpperCase();

    // Find all documents for this fileId and siteCode
    const allDocuments = await EquipmentOfflineSites.find({
      fileId: fileId,
      siteCode: normalizedSiteCode
    }).lean();

    console.log(`📋 Searching for documents with:`);
    console.log(`   fileId: ${fileId}`);
    console.log(`   siteCode: ${normalizedSiteCode}\n`);

    console.log(`📊 Total documents found: ${allDocuments.length}\n`);

    if (allDocuments.length === 0) {
      console.log('❌ NO DOCUMENTS FOUND!\n');
      console.log('Possible reasons:');
      console.log('  1. Documents were never created');
      console.log('  2. Documents were deleted');
      console.log('  3. Wrong fileId or siteCode');
      console.log('  4. Documents in different database');
      await mongoose.connection.close();
      process.exit(1);
    }

    // Separate original and routed documents
    const originalDocs = allDocuments.filter(doc => !doc.rowKey.includes('-routed-'));
    const routedDocs = allDocuments.filter(doc => doc.rowKey.includes('-routed-'));

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📄 ORIGINAL DOCUMENTS:', originalDocs.length);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (originalDocs.length > 0) {
      originalDocs.forEach((doc, index) => {
        console.log(`\n${index + 1}. Original Document:`);
        console.log(`   _id: ${doc._id}`);
        console.log(`   rowKey: ${doc.rowKey}`);
        console.log(`   userId: ${doc.userId}`);
        console.log(`   savedFrom: ${doc.savedFrom || 'N/A'}`);
        console.log(`   siteObservations: ${doc.siteObservations || 'N/A'}`);
        console.log(`   taskStatus: ${doc.taskStatus || 'N/A'}`);
        console.log(`   createdAt: ${doc.createdAt}`);
        console.log(`   updatedAt: ${doc.updatedAt}`);
      });
    } else {
      console.log('   ❌ NO ORIGINAL DOCUMENTS FOUND');
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📄 ROUTED DOCUMENTS:', routedDocs.length);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (routedDocs.length > 0) {
      routedDocs.forEach((doc, index) => {
        console.log(`\n${index + 1}. Routed Document:`);
        console.log(`   _id: ${doc._id}`);
        console.log(`   rowKey: ${doc.rowKey}`);
        console.log(`   userId: ${doc.userId}`);
        console.log(`   savedFrom: ${doc.savedFrom || 'N/A'}`);
        console.log(`   siteObservations: ${doc.siteObservations || 'N/A'}`);
        console.log(`   taskStatus: ${doc.taskStatus || 'N/A'}`);
        console.log(`   createdAt: ${doc.createdAt}`);
        console.log(`   updatedAt: ${doc.updatedAt}`);
      });
    } else {
      console.log('   ❌ NO ROUTED DOCUMENTS FOUND');
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ VERIFICATION SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Original Documents: ${originalDocs.length >= 1 ? '✅' : '❌'} ${originalDocs.length}`);
    console.log(`   Routed Documents: ${routedDocs.length >= 1 ? '✅' : '❌'} ${routedDocs.length}`);
    console.log(`   Total Documents: ${allDocuments.length}`);

    if (originalDocs.length >= 1 && routedDocs.length >= 1) {
      console.log('\n   ✅ SUCCESS: Both original and routed documents exist!');
    } else {
      console.log('\n   ⚠️  WARNING: Missing documents!');
      if (originalDocs.length === 0) {
        console.log('      - Original document is missing');
      }
      if (routedDocs.length === 0) {
        console.log('      - Routed document is missing');
      }
    }

    // Also check database and collection info
    const db = mongoose.connection.db;
    console.log(`\n📊 Database Info:`);
    console.log(`   Database Name: ${db.databaseName}`);
    console.log(`   Collection: Equipment offline sites`);

    await mongoose.connection.close();
    console.log('\n✅ Verification complete. Connection closed.');
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

verifyRoutingDocuments();


