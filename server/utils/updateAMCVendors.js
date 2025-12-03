import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

async function updateAMCVendors() {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI;
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB');

    // Find all AMC users
    const amcUsers = await User.find({ role: 'AMC' });
    console.log(`\nFound ${amcUsers.length} AMC users:`);
    
    amcUsers.forEach(user => {
      console.log(`  - ${user.userId} (${user.fullName}): vendor="${user.vendor || 'undefined'}", circles=${user.circle?.join(', ') || 'none'}`);
    });

    // Update vendors based on user ID or circles
    let updatedCount = 0;

    for (const user of amcUsers) {
      let newVendor = null;
      
      // Check if user ID contains "jyothi" - assign Jyothi Electricals
      if (user.userId.toLowerCase().includes('jyothi')) {
        newVendor = 'Jyothi Electricals';
      }
      // Check if user ID contains "sreeshail" or "shrishaila" - assign Shrishaila Electricals
      else if (user.userId.toLowerCase().includes('sreeshail') || user.userId.toLowerCase().includes('shrishaila')) {
        newVendor = 'Shrishaila Electricals(India Pvt ltd)';
      }
      // If no vendor set, assign based on circles
      else if (!user.vendor && user.circle && user.circle.length > 0) {
        const circles = user.circle.map(c => c.toUpperCase());
        // SOUTH or WEST → Shrishaila Electricals
        if (circles.includes('SOUTH') || circles.includes('WEST')) {
          newVendor = 'Shrishaila Electricals(India Pvt ltd)';
        }
        // NORTH or EAST → Spectrum Consultants
        else if (circles.includes('NORTH') || circles.includes('EAST')) {
          newVendor = 'Spectrum Consultants';
        }
      }

      if (newVendor && user.vendor !== newVendor) {
        user.vendor = newVendor;
        await user.save();
        console.log(`\n✓ Updated ${user.userId}: vendor="${newVendor}"`);
        updatedCount++;
      }
    }

    console.log(`\n✅ Updated ${updatedCount} AMC users with vendor information`);
    
    // Show final state
    console.log('\nFinal AMC users:');
    const finalUsers = await User.find({ role: 'AMC' });
    finalUsers.forEach(user => {
      console.log(`  - ${user.userId}: vendor="${user.vendor || 'undefined'}", circles=${user.circle?.join(', ') || 'none'}`);
    });

    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Error updating AMC vendors:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

updateAMCVendors();

