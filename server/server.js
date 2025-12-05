import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import connectDB from './config/db.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { protect } from './middleware/authMiddleware.js';
import authRoutes from './routes/authRoutes.js';
import inspectionRoutes from './routes/inspectionRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import actionRoutes from './routes/actionRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import locationRoutes from './routes/locationRoutes.js';
import landingPageRoutes from './routes/landingPageRoutes.js';
import siteObservationRoutes from './routes/siteObservationRoutes.js';
import userDataStateRoutes from './routes/userDataStateRoutes.js';
import equipmentOfflineSitesRoutes from './routes/equipmentOfflineSitesRoutes.js';
import approvalRoutes from './routes/approvalRoutes.js';
import { getLocationsBySiteCodes } from './controllers/locationController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const app = express();

// Middleware
// Removed size limits for photo uploads - allow large payloads for base64 images
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ extended: true, limit: '200mb' }));
// CORS configuration - Allow requests from web and mobile apps
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);
    
    // List of allowed origins
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3000',
      'https://bescomdas.vcaan.in',
      'http://bescomdas.vcaan.in',
    ];
    
    // Allow any local network IP (for mobile app development)
    const isLocalNetwork = /^http:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(origin);
    
    if (allowedOrigins.includes(origin) || isLocalNetwork) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all for now - restrict in production
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma', 'Expires']
}));

// Static assets for uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check
app.get('/health', (req, res) => {
  const mongoState = mongoose.connection.readyState;
  const mongoStates = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    mongodb: {
      status: mongoStates[mongoState] || 'unknown',
      readyState: mongoState,
      connected: mongoState === 1
    }
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/inspection', inspectionRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/actions', actionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin', locationRoutes); // Admin-only routes (upload, get all)
app.use('/api/site-observations', siteObservationRoutes);
app.use('/api/user-data-state', userDataStateRoutes);
app.use('/api/equipment-offline-sites', equipmentOfflineSitesRoutes);
app.use('/api/approvals', approvalRoutes);

// Public location routes - register directly to avoid router conflicts
app.post('/api/locations/by-site-codes', protect, getLocationsBySiteCodes);

app.use('/api/landing', landingPageRoutes);

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Start server function - waits for MongoDB connection
const startServer = async () => {
  let mongoConnected = false;
  
  try {
    // Wait for MongoDB connection
    console.log('Connecting to MongoDB...');
    await connectDB();
    
    // Wait a bit for connection to stabilize
    let retries = 0;
    const maxRetries = 30; // 30 seconds total
    while (mongoose.connection.readyState !== 1 && retries < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      retries++;
      if (retries % 5 === 0) {
        console.log(`Waiting for MongoDB connection... (${retries}s)`);
      }
    }
    
    if (mongoose.connection.readyState === 1) {
      mongoConnected = true;
      console.log('✓ MongoDB connection established');
    } else {
      console.warn('⚠ MongoDB not connected, but starting server anyway...');
      console.warn('⚠ API endpoints may fail until MongoDB connects');
    }
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error.message);
    console.warn('⚠ Starting server anyway, but API endpoints may fail');
  }
  
  // Start server regardless of MongoDB status
  const PORT = process.env.PORT || 5000;
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    console.log(`Server accessible at:`);
    console.log(`  - http://localhost:${PORT}`);
    console.log(`  - http://127.0.0.1:${PORT}`);
    if (mongoConnected) {
      console.log(`✓ MongoDB: Connected`);
    } else {
      console.log(`⚠ MongoDB: Not connected - some features may not work`);
      console.log(`⚠ Check MongoDB connection: ${process.env.MONGODB_URI?.replace(/:[^:@]*@/, ':****@') || 'MONGODB_URI not set'}`);
    }
  });
};

// Start the server
startServer();

