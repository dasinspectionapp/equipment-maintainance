/**
 * Simple FCM Notification Test Script
 * 
 * Usage:
 * 1. Make sure you're logged in and have your auth token
 * 2. Update the TOKEN and USER_ID below
 * 3. Run: node test-fcm.js
 */

const API_BASE = 'http://localhost:5000/api';

// ============================================
// UPDATE THESE VALUES:
// ============================================
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5MDE5ODlhNDFmZTI0ODBlOWY5NTkxOSIsImlhdCI6MTc3MDgyODEyMCwiZXhwIjoxNzcxNDMyOTIwfQ.owJKeD24QICnvDsmu830pPIzWqLp8T3UHBmikT0KSrY';
const USER_ID = 'jagadish1';
// ============================================

async function testFCMNotification() {
  console.log('\n🧪 Testing FCM Push Notification...\n');
  console.log('='.repeat(60));
  console.log(`User ID: ${USER_ID}`);
  console.log(`API: ${API_BASE}/fcm/send-notification`);
  console.log('='.repeat(60));
  console.log('');

  try {
    // Step 1: Check if server is running
    console.log('1️⃣  Checking if server is running...');
    try {
      const healthCheck = await fetch(`${API_BASE.replace('/api', '')}/health`);
      if (healthCheck.ok) {
        console.log('   ✅ Server is running\n');
      } else {
        console.log('   ⚠️  Server responded but may have issues\n');
      }
    } catch (error) {
      console.log('   ❌ Server is NOT running!');
      console.log('   Please start the server first: cd server && npm start\n');
      process.exit(1);
    }

    // Step 2: Send FCM notification
    console.log('2️⃣  Sending FCM notification...');
    const response = await fetch(`${API_BASE}/fcm/send-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`
      },
      body: JSON.stringify({
        userId: USER_ID,
        title: '🧪 Test Notification',
        body: 'This is a test push notification from the backend API. If you see this, FCM is working!'
      })
    });

    const data = await response.json();

    console.log(`   Status: ${response.status} ${response.statusText}\n`);

    // Step 3: Display results
    if (data.success) {
      console.log('3️⃣  ✅ SUCCESS! Notification sent successfully!\n');
      console.log('Response:');
      console.log(JSON.stringify(data, null, 2));
      console.log('\n');
      
      if (data.results && data.results.length > 0) {
        const successCount = data.results.filter(r => r.success).length;
        const failCount = data.results.filter(r => !r.success).length;
        
        console.log(`📊 Results:`);
        console.log(`   ✅ Successful: ${successCount}`);
        if (failCount > 0) {
          console.log(`   ❌ Failed: ${failCount}`);
        }
        console.log('');
      }

      console.log('📱 Check your mobile device:');
      console.log('   - If app is in FOREGROUND: Alert dialog should appear');
      console.log('   - If app is in BACKGROUND: Notification should appear in system tray');
      console.log('   - If app is KILLED: Notification should appear, tapping opens app');
      console.log('');
      
    } else {
      console.log('3️⃣  ❌ FAILED! Notification was not sent.\n');
      console.log('Error Response:');
      console.log(JSON.stringify(data, null, 2));
      console.log('');
      
      if (data.message) {
        console.log(`Error: ${data.message}`);
      }
      if (data.error) {
        console.log(`Details: ${data.error}`);
      }
      console.log('');
    }

    // Step 4: Check server logs
    console.log('4️⃣  Check server console for detailed logs:');
    console.log('   Look for: [FCM] ✅ Push notification sent');
    console.log('');

  } catch (error) {
    console.log('❌ ERROR occurred:\n');
    console.log(error.message);
    console.log('');
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('💡 Solution: Make sure the server is running!');
      console.log('   Run: cd server && npm start');
    } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      console.log('💡 Solution: Your token may have expired. Please login again and update TOKEN.');
    } else if (error.message.includes('404')) {
      console.log('💡 Solution: Check if the API endpoint is correct.');
    }
    console.log('');
  }
}

// Run the test
testFCMNotification();

