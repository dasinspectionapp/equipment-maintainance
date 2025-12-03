import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function testConnection() {
  try {
    console.log('Attempting to connect to MongoDB...');
    console.log('Host: vcaan.in');
    console.log('Port: 27017');
    console.log('Database: das');
    
    const mongoURI = process.env.MONGODB_URI;
    console.log('\nConnection string:', mongoURI.replace(/:[^:@]*@/, ':****@'));
    
    // Try to connect with a timeout
    const connection = await mongoose.connect(mongoURI, {
      maxPoolSize: 1,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 5000,
    });
    
    console.log('\n✓ SUCCESS: MongoDB is accessible!');
    console.log('✓ Connected to:', connection.connection.host);
    console.log('✓ Database name:', connection.connection.name);
    
    await mongoose.connection.close();
    process.exit(0);
    
  } catch (error) {
    console.error('\n✗ FAILED: MongoDB connection error');
    console.error('Error details:');
    console.error('  - Type:', error.constructor.name);
    console.error('  - Message:', error.message);
    
    if (error.reason) {
      console.error('  - Reason:', error.reason);
    }
    
    if (error.code) {
      console.error('  - Error Code:', error.code);
    }
    
    console.error('\nPossible issues:');
    console.error('  1. MongoDB server is not running');
    console.error('  2. Port 27017 is blocked by firewall');
    console.error('  3. Network connectivity issues');
    console.error('  4. Incorrect credentials');
    console.error('  5. Server not accessible from this network');
    
    process.exit(1);
  }
}

testConnection();




























