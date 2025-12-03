import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const createEquipmentOfflineSitesCollection = async () => {
  try {
    // Connect to MongoDB - using the provided connection string but pointing to das database
    // The connection string provided uses 'admin' database, but we need 'das' database
    // Construct connection string explicitly for das database
    const mongoURI = 'mongodb://admin:password@vcaan.in:27017/das?authSource=admin&authMechanism=SCRAM-SHA-256';
    
    console.log('Connecting to MongoDB (das database)...');
    await mongoose.connect(mongoURI);

    console.log('MongoDB connected...');
    console.log(`Connected to database: ${mongoose.connection.db.databaseName}`);

    // Get the database connection
    const db = mongoose.connection.db;
    
    // Check if collection already exists
    const collections = await db.listCollections({ name: 'Equipment offline sites' }).toArray();
    
    if (collections.length > 0) {
      console.log('✓ Collection "Equipment offline sites" already exists in das database');
      await mongoose.connection.close();
      return;
    }

    // Create the collection explicitly
    await db.createCollection('Equipment offline sites');
    
    console.log('✓ Collection "Equipment offline sites" created successfully in das database');
    console.log('   Collection is now visible in MongoDB Compass/Studio');

    await mongoose.connection.close();
    process.exit(0);

  } catch (error) {
    console.error('Error creating collection:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

createEquipmentOfflineSitesCollection();

