// Test MongoDB connection from host machine (not Docker container)
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const mongoURI = process.env.MONGODB_URI || 'mongodb://admin:password@vcaan.in:27017/das?authSource=admin&authMechanism=SCRAM-SHA-256';

console.log('Testing MongoDB connection from HOST machine...');
console.log('URI:', mongoURI.replace(/:[^:@]*@/, ':****@'));
console.log('');

// Test 1: Basic connection
console.log('Test 1: Basic connection (10s timeout)...');
try {
  await mongoose.connect(mongoURI, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 10000,
  });
  console.log('✓ SUCCESS: Connected from host!');
  console.log('  Host:', mongoose.connection.host);
  console.log('  Database:', mongoose.connection.name);
  await mongoose.connection.close();
  process.exit(0);
} catch (error) {
  console.log('✗ FAILED:', error.message);
  await mongoose.connection.close().catch(() => {});
}

console.log('\n✗ Connection failed from host machine too.');
console.log('\nThis means:');
console.log('1. MongoDB server is likely NOT running on vcaan.in:27017');
console.log('2. OR MongoDB is configured to reject connections');
console.log('3. OR There is a firewall/proxy blocking MongoDB protocol');
console.log('\nAction required:');
console.log('- Contact database administrator to verify MongoDB is running');
console.log('- Check if MongoDB accepts connections from your server IP');
console.log('- Verify MongoDB server configuration');

process.exit(1);


