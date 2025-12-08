// Test MongoDB connection from inside Docker container
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const mongoURI = process.env.MONGODB_URI || 'mongodb://admin:password@vcaan.in:27017/das?authSource=admin&authMechanism=SCRAM-SHA-256';

console.log('Testing MongoDB connection from container...');
console.log('URI:', mongoURI.replace(/:[^:@]*@/, ':****@'));
console.log('');

// Test 1: Basic connection
console.log('Test 1: Basic connection (10s timeout)...');
try {
  await mongoose.connect(mongoURI, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 10000,
  });
  console.log('✓ SUCCESS: Connected!');
  console.log('  Host:', mongoose.connection.host);
  console.log('  Database:', mongoose.connection.name);
  await mongoose.connection.close();
  process.exit(0);
} catch (error) {
  console.log('✗ FAILED:', error.message);
  await mongoose.connection.close().catch(() => {});
}

// Test 2: Try with directConnection
console.log('\nTest 2: With directConnection=true...');
try {
  await mongoose.connect(mongoURI, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 10000,
    directConnection: true,
  });
  console.log('✓ SUCCESS: Connected with directConnection!');
  await mongoose.connection.close();
  process.exit(0);
} catch (error) {
  console.log('✗ FAILED:', error.message);
  await mongoose.connection.close().catch(() => {});
}

// Test 3: Try with SSL (if not already in URI)
if (!mongoURI.includes('ssl=true') && !mongoURI.includes('tls=true')) {
  console.log('\nTest 3: With SSL enabled...');
  const sslURI = mongoURI + (mongoURI.includes('?') ? '&' : '?') + 'ssl=true';
  try {
    await mongoose.connect(sslURI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 10000,
      tlsAllowInvalidCertificates: true,
    });
    console.log('✓ SUCCESS: Connected with SSL!');
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.log('✗ FAILED:', error.message);
    await mongoose.connection.close().catch(() => {});
  }
}

console.log('\n✗ All connection attempts failed.');
console.log('\nPossible issues:');
console.log('1. MongoDB server is not running on vcaan.in:27017');
console.log('2. MongoDB requires SSL/TLS connection');
console.log('3. Firewall is blocking MongoDB protocol from container');
console.log('4. MongoDB is on a different port');
console.log('5. Network routing issue from Docker container');

process.exit(1);







