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
      return;
    }

    const mongoURI = process.env.MONGODB_URI;
    
    // Attach event listeners before connecting
    attachEventListeners();
    
    const conn = await mongoose.connect(mongoURI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });

    if (conn.connection.readyState === 1) {
      console.log(`MongoDB Connected: ${conn.connection.host}`);
      isConnected = true;
    }

  } catch (error) {
    isConnected = false;
    console.error('Error connecting to MongoDB:', error.message);
    if (error.message.includes('ECONNREFUSED')) {
      console.error('Please make sure MongoDB is running on localhost:27017');
    }
    console.error('To install MongoDB, visit: https://www.mongodb.com/try/download/community');
    // Don't throw, let the app continue and retry later
  }
};

export default connectDB;

