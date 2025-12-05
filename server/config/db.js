import mongoose from 'mongoose';

let isConnected = false;
let listenersAttached = false;

const attachEventListeners = () => {
  // Only attach listeners once
  if (listenersAttached) return;
  
  listenersAttached = true;
  
  mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    if (isConnected) {
      isConnected = false;
      console.log('MongoDB disconnected. Reconnecting...');
      // Use setTimeout to prevent immediate recursive calls
      setTimeout(() => {
        connectDB().catch(err => {
          console.error('Reconnection attempt failed:', err.message);
        });
      }, 5000);
    }
  });

  mongoose.connection.on('reconnected', () => {
    if (!isConnected) {
      console.log('MongoDB reconnected successfully');
      isConnected = true;
    }
  });

  mongoose.connection.on('connected', () => {
    if (!isConnected) {
      isConnected = true;
    }
  });
};

const connectDB = async () => {
  try {
    // Prevent multiple simultaneous connection attempts
    if (mongoose.connection.readyState === 1) {
      console.log('MongoDB already connected');
      return;
    }

    const mongoURI = process.env.MONGODB_URI;
    
    if (!mongoURI) {
      console.error('MONGODB_URI environment variable is not set');
      return;
    }
    
    // Log connection attempt (mask password)
    const maskedURI = mongoURI.replace(/:[^:@]*@/, ':****@');
    console.log('Attempting to connect to MongoDB...');
    console.log('Connection string:', maskedURI);
    
    // Attach event listeners before connecting
    attachEventListeners();
    
    console.log('MongoDB connection options:', {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000,
    });
    
    const conn = await mongoose.connect(mongoURI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000,
      heartbeatFrequencyMS: 10000,
      retryWrites: true,
      retryReads: true,
      // Try with direct connection first
      directConnection: false,
    });

    if (conn.connection.readyState === 1) {
      console.log(`✓ MongoDB Connected: ${conn.connection.host}`);
      console.log(`✓ Database: ${conn.connection.name}`);
      console.log(`✓ Ready State: ${conn.connection.readyState}`);
      isConnected = true;
    } else {
      console.warn(`⚠ MongoDB connection state: ${conn.connection.readyState} (expected 1)`);
    }

  } catch (error) {
    isConnected = false;
    console.error('✗ Error connecting to MongoDB:');
    console.error('  - Message:', error.message);
    console.error('  - Name:', error.name);
    if (error.reason) {
      console.error('  - Reason:', error.reason);
    }
    if (error.code) {
      console.error('  - Code:', error.code);
    }
    if (error.stack) {
      console.error('  - Stack:', error.stack.split('\n').slice(0, 3).join('\n'));
    }
    
    // Specific error handling
    if (error.message.includes('ECONNREFUSED')) {
      console.error('  → Connection refused. Check if MongoDB server is running.');
    } else if (error.message.includes('authentication failed')) {
      console.error('  → Authentication failed. Check username and password.');
    } else if (error.message.includes('timeout')) {
      console.error('  → Connection timeout. Check network connectivity and firewall.');
    } else if (error.message.includes('buffering timed out')) {
      console.error('  → Server selection timeout. MongoDB server may be unreachable.');
    }
    
    // Don't throw, let the app continue and retry later
  }
};

export default connectDB;

