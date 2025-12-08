// Test MongoDB connection directly from host (not Docker)
// This will tell us if MongoDB is actually running and accessible

import mongoose from 'mongoose';

const mongoURI = 'mongodb://admin:password@vcaan.in:27017/admin?authSource=admin&authMechanism=SCRAM-SHA-256';

console.log('Testing MongoDB connection DIRECTLY from host machine...');
console.log('URI:', mongoURI.replace(/:[^:@]*@/, ':****@'));
console.log('');

// Test with very short timeout to fail fast
try {
  console.log('Attempting connection (5s timeout)...');
  const conn = await mongoose.connect(mongoURI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 5000,
  });
  
  console.log('\n✓ SUCCESS: MongoDB is accessible from host!');
  console.log('✓ Connected to:', conn.connection.host);
  console.log('✓ Database:', conn.connection.name);
  console.log('✓ This means MongoDB is running and accessible');
  console.log('✓ Docker container should be able to connect with host network mode');
  
  await mongoose.connection.close();
  process.exit(0);
  
} catch (error) {
  console.log('\n✗ FAILED: MongoDB connection failed from host too');
  console.log('Error:', error.message);
  console.log('');
  console.log('This means:');
  console.log('1. MongoDB server is NOT running on vcaan.in:27017');
  console.log('2. OR MongoDB is not responding to MongoDB protocol');
  console.log('3. OR MongoDB requires SSL/TLS connection');
  console.log('4. OR There is a firewall/proxy blocking MongoDB protocol');
  console.log('');
  console.log('Action required:');
  console.log('- Verify MongoDB is actually running on vcaan.in');
  console.log('- Check MongoDB server logs');
  console.log('- Verify MongoDB accepts connections');
  console.log('- Check if SSL/TLS is required');
  
  process.exit(1);
}







