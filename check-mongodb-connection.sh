#!/bin/bash
# Script to check MongoDB connection from Docker container

echo "Checking MongoDB connection from backend container..."
echo ""

# Check if container is running
if ! docker ps | grep -q backend-prod; then
    echo "❌ Backend container is not running!"
    echo "Start it with: docker-compose -f docker-compose.prod.yml up -d backend-prod"
    exit 1
fi

echo "Testing MongoDB connection..."
echo ""

# Run test inside the container
docker exec backend-prod node -e "
const mongoose = require('mongoose');
const mongoURI = process.env.MONGODB_URI || 'mongodb://admin:password@vcaan.in:27017/das?authSource=admin&authMechanism=SCRAM-SHA-256';

console.log('Attempting to connect to MongoDB...');
console.log('URI:', mongoURI.replace(/:[^:@]*@/, ':****@'));
console.log('');

mongoose.connect(mongoURI, {
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 10000,
})
.then(() => {
  console.log('✅ SUCCESS: MongoDB is accessible!');
  console.log('✅ Connected to:', mongoose.connection.host);
  console.log('✅ Database:', mongoose.connection.name);
  process.exit(0);
})
.catch((error) => {
  console.error('❌ FAILED: MongoDB connection error');
  console.error('Error:', error.message);
  console.error('');
  console.error('Possible issues:');
  console.error('  1. Network connectivity - Docker container cannot reach vcaan.in');
  console.error('  2. Firewall blocking port 27017');
  console.error('  3. MongoDB server is down or unreachable');
  console.error('  4. Incorrect credentials');
  console.error('  5. DNS resolution issues');
  process.exit(1);
});
"

echo ""
echo "If connection failed, check:"
echo "  1. Can you reach vcaan.in from your host machine? Try: ping vcaan.in"
echo "  2. Check backend logs: docker logs backend-prod"
echo "  3. Verify MongoDB URI in docker-compose.prod.yml"


