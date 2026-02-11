import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let firebaseAdmin = null;

/**
 * Initialize Firebase Admin SDK
 * 
 * You need to:
 * 1. Download your Firebase service account key from Firebase Console
 * 2. Go to Project Settings > Service Accounts > Generate New Private Key
 * 3. Save the JSON file as 'serviceAccountKey.json' in the server/config/ directory
 * 4. Add 'serviceAccountKey.json' to .gitignore
 */
try {
  // Path to your service account key
  const serviceAccountPath = join(__dirname, 'serviceAccountKey.json');
  
  // Check if service account file exists
  try {
    const serviceAccount = JSON.parse(
      readFileSync(serviceAccountPath, 'utf8')
    );

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('✅ Firebase Admin initialized successfully');
    }
    
    firebaseAdmin = admin;
  } catch (fileError) {
    console.warn('⚠️  Firebase Admin service account key not found.');
    console.warn('   To enable FCM notifications:');
    console.warn('   1. Download service account key from Firebase Console');
    console.warn('   2. Save as server/config/serviceAccountKey.json');
    console.warn('   3. Restart the server');
    // Create a mock admin object to prevent errors
    firebaseAdmin = {
      messaging: () => ({
        send: async () => {
          throw new Error('Firebase Admin not initialized');
        },
        sendEachForMulticast: async () => {
          throw new Error('Firebase Admin not initialized');
        },
      }),
    };
  }
} catch (error) {
  console.error('❌ Error initializing Firebase Admin:', error);
  // Create a mock admin object to prevent errors
  firebaseAdmin = {
    messaging: () => ({
      send: async () => {
        throw new Error('Firebase Admin not initialized');
      },
      sendEachForMulticast: async () => {
        throw new Error('Firebase Admin not initialized');
      },
    }),
  };
}

export default firebaseAdmin;

