/**
 * Emergency TOTP Recovery Utility
 * 
 * This script can be used to reset TOTP for an admin user in case of emergency.
 * 
 * Usage (from server directory):
 * node utils/emergencyTotpRecovery.js <userId>
 * 
 * Example:
 * node utils/emergencyTotpRecovery.js admin
 * 
 * WARNING: This bypasses all security checks. Use only in emergencies.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import connectDB from '../config/db.js';

dotenv.config();

const resetAdminTotp = async (userId) => {
  try {
    console.log('=== Emergency TOTP Recovery ===');
    console.log(`Attempting to reset TOTP for user: ${userId}`);
    
    // Connect to database
    await connectDB();
    console.log('✓ Connected to database');
    
    // Find user
    const user = await User.findOne({ userId: userId.toLowerCase() }).select('+totpSecret');
    
    if (!user) {
      console.error('✗ User not found:', userId);
      process.exit(1);
    }
    
    console.log(`✓ Found user: ${user.fullName} (${user.userId})`);
    console.log(`  Role: ${user.role}`);
    console.log(`  Current TOTP Status:`);
    console.log(`    - adminAllowsTotp: ${user.adminAllowsTotp || false}`);
    console.log(`    - totpEnabled: ${user.totpEnabled || false}`);
    console.log(`    - Has TOTP Secret: ${user.totpSecret ? 'Yes' : 'No'}`);
    
    // Reset TOTP
    user.totpEnabled = false;
    user.totpSecret = null;
    user.recoveryCodes = [];
    // Keep adminAllowsTotp = true so user can set up again
    await user.save();
    
    console.log('\n✓ TOTP Reset Successful!');
    console.log('\nNext Steps:');
    console.log('1. User can now login with just User ID + Password');
    console.log('2. User should go to Settings and set up TOTP again');
    console.log('3. User will need to scan a new QR code');
    
    process.exit(0);
  } catch (error) {
    console.error('✗ Error:', error.message);
    process.exit(1);
  }
};

// Get userId from command line arguments
const userId = process.argv[2];

if (!userId) {
  console.error('Usage: node utils/emergencyTotpRecovery.js <userId>');
  console.error('Example: node utils/emergencyTotpRecovery.js admin');
  process.exit(1);
}

resetAdminTotp(userId);

