/**
 * Find Both Documents by ID
 * 
 * Use this script to find both the original and routed documents
 * in MongoDB Compass or MongoDB Shell
 */

// Replace these with the IDs from your console logs
const originalDocumentId = "692aba26c9d6c2307d9b6b62";  // From console: originalDocId
const routedDocumentId = "692bc64345ddd5220fdba1a9";    // From console: routed documentId

print("=".repeat(80));
print("SEARCHING FOR BOTH DOCUMENTS BY ID");
print("=".repeat(80));
print("");

// Search for Original Document
print("📋 Searching for ORIGINAL document:");
print(`   ID: ${originalDocumentId}`);
print("-".repeat(80));

const originalDoc = db.getCollection('Equipment offline sites').findOne({
  _id: ObjectId(originalDocumentId)
});

if (originalDoc) {
  print("✅ ORIGINAL DOCUMENT FOUND:");
  printjson({
    _id: originalDoc._id.toString(),
    fileId: originalDoc.fileId,
    rowKey: originalDoc.rowKey,
    siteCode: originalDoc.siteCode,
    userId: originalDoc.userId,
    siteObservations: originalDoc.siteObservations,
    savedFrom: originalDoc.savedFrom,
    createdAt: originalDoc.createdAt,
    isOriginal: !originalDoc.rowKey.includes('-routed-'),
    isRouted: originalDoc.rowKey.includes('-routed-')
  });
} else {
  print("❌ ORIGINAL DOCUMENT NOT FOUND!");
  print(`   Document with ID ${originalDocumentId} does not exist in database.`);
}
print("");

// Search for Routed Document
print("📋 Searching for ROUTED document:");
print(`   ID: ${routedDocumentId}`);
print("-".repeat(80));

const routedDoc = db.getCollection('Equipment offline sites').findOne({
  _id: ObjectId(routedDocumentId)
});

if (routedDoc) {
  print("✅ ROUTED DOCUMENT FOUND:");
  printjson({
    _id: routedDoc._id.toString(),
    fileId: routedDoc.fileId,
    rowKey: routedDoc.rowKey,
    siteCode: routedDoc.siteCode,
    userId: routedDoc.userId,
    siteObservations: routedDoc.siteObservations,
    savedFrom: routedDoc.savedFrom,
    createdAt: routedDoc.createdAt,
    isOriginal: !routedDoc.rowKey.includes('-routed-'),
    isRouted: routedDoc.rowKey.includes('-routed-')
  });
} else {
  print("❌ ROUTED DOCUMENT NOT FOUND!");
  print(`   Document with ID ${routedDocumentId} does not exist in database.`);
}
print("");

// Summary
print("=".repeat(80));
print("📊 SUMMARY");
print("=".repeat(80));
print(`Original Document Found: ${originalDoc ? '✅ YES' : '❌ NO'}`);
print(`Routed Document Found: ${routedDoc ? '✅ YES' : '❌ NO'}`);
print("");

if (originalDoc && routedDoc) {
  print("🎉 Both documents exist in database!");
  print("");
  print("Check your MongoDB Compass view:");
  print("1. Remove any filters you might have applied");
  print("2. Search for each document by _id");
  print("3. Or search by siteCode to see both documents together");
} else if (!originalDoc && routedDoc) {
  print("⚠️  WARNING: Only routed document found!");
  print("   The original document might not exist or was deleted.");
  print("");
  print("Possible causes:");
  print("1. Original document was created from 'MY OFFLINE SITES' earlier");
  print("2. Original document was deleted or filtered out");
  print("3. Original document exists but with different criteria");
  print("");
  print("Try searching by siteCode to find all related documents:");
  print(`   db.getCollection('Equipment offline sites').find({ siteCode: "${routedDoc.siteCode}" })`);
} else if (originalDoc && !routedDoc) {
  print("⚠️  WARNING: Only original document found!");
  print("   The routed document might not have been created.");
} else {
  print("❌ ERROR: Neither document found!");
  print("   Please check the document IDs in your console logs.");
}
print("=".repeat(80));



