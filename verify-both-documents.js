/**
 * Verification Script: Check if Both Documents Exist in Database
 * 
 * This script helps verify that both the original and routed documents
 * are created in the Equipment offline sites collection.
 * 
 * Usage:
 * 1. Replace the variables below with your actual values
 * 2. Run this in MongoDB Compass, MongoDB Shell, or any MongoDB client
 * 3. Check the results
 */

// ============================================
// CONFIGURATION - Update these values
// ============================================
const fileId = "nc35yh";  // Your fileId
const siteCode = "LB1685";  // Your siteCode
const originalUserId = "jagadish1";  // Original user (e.g., Equipment user)
const routedUserId = "arun1";  // Routed user (e.g., RTU user)

// ============================================
// VERIFICATION QUERIES
// ============================================

print("=".repeat(80));
print("VERIFICATION: Checking for Both Documents in Equipment offline sites");
print("=".repeat(80));
print("");

// Query 1: Find ALL documents with this fileId and siteCode
print("📋 Query 1: ALL documents with fileId and siteCode");
print("-".repeat(80));
const allDocuments = db.getCollection('Equipment offline sites').find({
  fileId: fileId,
  siteCode: siteCode.toUpperCase()
}).sort({ createdAt: 1 }).toArray();

print(`Found ${allDocuments.length} document(s) with fileId: "${fileId}" and siteCode: "${siteCode}"`);
print("");

allDocuments.forEach((doc, index) => {
  const isOriginal = !doc.rowKey.includes('-routed-');
  const isRouted = doc.rowKey.includes('-routed-');
  
  print(`Document ${index + 1}:`);
  print(`  _id: ${doc._id}`);
  print(`  rowKey: ${doc.rowKey}`);
  print(`  userId: ${doc.userId}`);
  print(`  siteCode: ${doc.siteCode}`);
  print(`  siteObservations: ${doc.siteObservations}`);
  print(`  savedFrom: ${doc.savedFrom || 'N/A'}`);
  print(`  createdAt: ${doc.createdAt}`);
  print(`  Type: ${isOriginal ? '✅ ORIGINAL' : isRouted ? '🔄 ROUTED' : '❓ UNKNOWN'}`);
  print("");
});

// Query 2: Find ORIGINAL document (no routing suffix in rowKey)
print("📋 Query 2: ORIGINAL document (no routing suffix)");
print("-".repeat(80));
const originalDocument = db.getCollection('Equipment offline sites').findOne({
  fileId: fileId,
  siteCode: siteCode.toUpperCase(),
  userId: originalUserId,
  rowKey: { $not: { $regex: /-routed-/ } }
});

if (originalDocument) {
  print("✅ ORIGINAL document FOUND:");
  print(`  _id: ${originalDocument._id}`);
  print(`  rowKey: ${originalDocument.rowKey}`);
  print(`  userId: ${originalDocument.userId}`);
  print(`  siteCode: ${originalDocument.siteCode}`);
  print(`  siteObservations: ${originalDocument.siteObservations}`);
  print(`  savedFrom: ${originalDocument.savedFrom || 'N/A'}`);
} else {
  print("❌ ORIGINAL document NOT FOUND");
  print(`   Expected: userId="${originalUserId}", no routing suffix in rowKey`);
}
print("");

// Query 3: Find ROUTED document (with routing suffix in rowKey)
print("📋 Query 3: ROUTED document (with routing suffix)");
print("-".repeat(80));
const routedDocuments = db.getCollection('Equipment offline sites').find({
  fileId: fileId,
  siteCode: siteCode.toUpperCase(),
  userId: routedUserId,
  rowKey: { $regex: /-routed-/ }
}).toArray();

if (routedDocuments.length > 0) {
  print(`✅ ROUTED document(s) FOUND (${routedDocuments.length}):`);
  routedDocuments.forEach((doc, index) => {
    print(`  Document ${index + 1}:`);
    print(`    _id: ${doc._id}`);
    print(`    rowKey: ${doc.rowKey}`);
    print(`    userId: ${doc.userId}`);
    print(`    siteCode: ${doc.siteCode}`);
    print(`    siteObservations: ${doc.siteObservations}`);
    print(`    savedFrom: ${doc.savedFrom || 'N/A'}`);
    print("");
  });
} else {
  print("❌ ROUTED document NOT FOUND");
  print(`   Expected: userId="${routedUserId}", rowKey contains "-routed-"`);
}
print("");

// Query 4: Check by baseRowKey pattern
print("📋 Query 4: Documents by baseRowKey pattern");
print("-".repeat(80));
// Extract baseRowKey from routed document if exists, or try to find pattern
const baseRowKeyPattern = allDocuments.length > 0 
  ? allDocuments[0].rowKey.split('-routed-')[0] 
  : null;

if (baseRowKeyPattern) {
  const baseRowKeyDocs = db.getCollection('Equipment offline sites').find({
    fileId: fileId,
    rowKey: { $regex: `^${baseRowKeyPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}` }
  }).toArray();
  
  print(`Found ${baseRowKeyDocs.length} document(s) with baseRowKey pattern: "${baseRowKeyPattern}"`);
  baseRowKeyDocs.forEach((doc) => {
    const isOriginal = !doc.rowKey.includes('-routed-');
    print(`  ${isOriginal ? '✅ ORIGINAL' : '🔄 ROUTED'}: ${doc.rowKey} | userId: ${doc.userId}`);
  });
} else {
  print("⚠️  Could not determine baseRowKey pattern");
}
print("");

// ============================================
// SUMMARY
// ============================================
print("=".repeat(80));
print("📊 SUMMARY");
print("=".repeat(80));

const originalFound = originalDocument !== null;
const routedFound = routedDocuments.length > 0;

print(`Original Document: ${originalFound ? '✅ FOUND' : '❌ NOT FOUND'}`);
print(`Routed Document: ${routedFound ? '✅ FOUND' : '❌ NOT FOUND'}`);

if (originalFound && routedFound) {
  print("");
  print("🎉 SUCCESS: Both documents exist in database!");
  print("");
  print("Expected Behavior:");
  print("  - Original document: userId = " + originalUserId + ", no routing suffix");
  print("  - Routed document: userId = " + routedUserId + ", has routing suffix");
} else {
  print("");
  print("⚠️  WARNING: One or both documents are missing!");
  if (!originalFound) {
    print("  - Original document is missing");
  }
  if (!routedFound) {
    print("  - Routed document is missing");
  }
  print("");
  print("Check the server console logs for detailed error messages.");
}
print("=".repeat(80));



