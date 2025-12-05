#!/bin/bash
# Test MongoDB connection from inside the backend container

echo "=== Testing MongoDB Connection from Backend Container ==="
echo ""

# Test 1: Check if container can resolve vcaan.in
echo "Test 1: DNS Resolution"
echo "----------------------"
docker exec backend-prod nslookup vcaan.in || docker exec backend-prod getent hosts vcaan.in
echo ""

# Test 2: Test network connectivity to MongoDB
echo "Test 2: Network Connectivity"
echo "-----------------------------"
echo "Testing connection to vcaan.in:27017..."
docker exec backend-prod sh -c "timeout 5 bash -c '</dev/tcp/vcaan.in/27017' && echo '✓ Port 27017 is reachable'" || echo "✗ Cannot reach vcaan.in:27017"
echo ""

# Test 3: Try with IP address (if we can resolve it)
echo "Test 3: Get IP Address of vcaan.in"
echo "-----------------------------------"
MONGO_IP=$(docker exec backend-prod getent hosts vcaan.in | awk '{print $1}' | head -1)
if [ ! -z "$MONGO_IP" ]; then
    echo "vcaan.in resolves to: $MONGO_IP"
    echo "Testing connection to $MONGO_IP:27017..."
    docker exec backend-prod sh -c "timeout 5 bash -c '</dev/tcp/$MONGO_IP/27017' && echo '✓ Port 27017 is reachable via IP'" || echo "✗ Cannot reach $MONGO_IP:27017"
else
    echo "Could not resolve vcaan.in"
fi
echo ""

# Test 4: Check MongoDB connection string in container
echo "Test 4: MongoDB Connection String"
echo "----------------------------------"
docker exec backend-prod printenv MONGODB_URI | sed 's/:[^:@]*@/:****@/g'
echo ""

# Test 5: Try to connect using Node.js from container
echo "Test 5: Node.js MongoDB Connection Test"
echo "----------------------------------------"
docker exec backend-prod node -e "
const mongoose = require('mongoose');
const uri = process.env.MONGODB_URI;
console.log('Testing connection to:', uri.replace(/:[^:@]*@/, ':****@'));
mongoose.connect(uri, {
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 5000
}).then(() => {
  console.log('✓ SUCCESS: Connected to MongoDB');
  process.exit(0);
}).catch(err => {
  console.error('✗ FAILED:', err.message);
  process.exit(1);
});
" || echo "Connection test failed"
echo ""

echo "=== Summary ==="
echo "If DNS resolution works but connection fails, try:"
echo "  1. Use IP address instead of domain name"
echo "  2. Check if MongoDB requires specific network configuration"
echo "  3. Compare with working container's network setup"


