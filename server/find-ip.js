// Quick script to find your computer's IP address for mobile app configuration
import os from 'os';

const nets = os.networkInterfaces();
const addresses = [];

for (const name of Object.keys(nets)) {
  for (const net of nets[name]) {
    // Skip internal (loopback) and non-IPv4 addresses
    if (net.family === 'IPv4' && !net.internal) {
      addresses.push({
        interface: name,
        address: net.address
      });
    }
  }
}

console.log('\n=== Your IP Addresses for Mobile App Configuration ===\n');
if (addresses.length === 0) {
  console.log('No network interfaces found. Make sure you are connected to WiFi or Ethernet.');
} else {
  addresses.forEach(({ interface: iface, address }) => {
    console.log(`Interface: ${iface}`);
    console.log(`IP Address: ${address}`);
    console.log(`\nUpdate Mobile/utils/api.ts with:`);
    console.log(`  const YOUR_IP_ADDRESS = '${address}';`);
    console.log('\n' + '-'.repeat(50) + '\n');
  });
}
console.log('Make sure your mobile device is on the same WiFi network!\n');





