#!/bin/bash
# Script to test if backend server is accessible globally

echo "=== Testing Backend Server Global Access ==="
echo ""

# Get server IP
SERVER_IP=$(hostname -I | awk '{print $1}')
echo "Server IP: $SERVER_IP"
echo ""

# Test 1: Check if port 5000 is listening
echo "Test 1: Checking if port 5000 is listening..."
if netstat -tuln 2>/dev/null | grep -q ":5000 " || ss -tuln 2>/dev/null | grep -q ":5000 "; then
    echo "✓ Port 5000 is listening"
    netstat -tuln 2>/dev/null | grep ":5000 " || ss -tuln 2>/dev/null | grep ":5000 "
else
    echo "✗ Port 5000 is NOT listening"
fi
echo ""

# Test 2: Check Docker container port mapping
echo "Test 2: Checking Docker container port mapping..."
if docker ps --format "{{.Names}}\t{{.Ports}}" | grep -q "backend-prod.*5000"; then
    echo "✓ Backend container port mapping:"
    docker ps --format "{{.Names}}\t{{.Ports}}" | grep backend-prod
else
    echo "✗ Backend container not found or port not mapped"
fi
echo ""

# Test 3: Test localhost access
echo "Test 3: Testing localhost access..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/health | grep -q "200"; then
    echo "✓ Backend accessible on localhost:5000"
    curl -s http://localhost:5000/health | head -5
else
    echo "✗ Backend NOT accessible on localhost:5000"
fi
echo ""

# Test 4: Test server IP access
echo "Test 4: Testing server IP access..."
if curl -s -o /dev/null -w "%{http_code}" http://$SERVER_IP:5000/health | grep -q "200"; then
    echo "✓ Backend accessible on $SERVER_IP:5000"
    curl -s http://$SERVER_IP:5000/health | head -5
else
    echo "✗ Backend NOT accessible on $SERVER_IP:5000"
fi
echo ""

# Test 5: Check firewall status
echo "Test 5: Checking firewall status..."
if command -v ufw >/dev/null 2>&1; then
    echo "UFW Status:"
    ufw status | grep -A 5 "Status\|5000" || echo "Port 5000 not explicitly allowed in UFW"
elif command -v firewall-cmd >/dev/null 2>&1; then
    echo "Firewalld Status:"
    firewall-cmd --list-ports 2>/dev/null | grep -q "5000" && echo "✓ Port 5000 is open" || echo "✗ Port 5000 may be blocked"
else
    echo "No common firewall tool found (check iptables manually)"
fi
echo ""

# Test 6: Check if listening on 0.0.0.0
echo "Test 6: Checking if server listens on 0.0.0.0..."
if netstat -tuln 2>/dev/null | grep ":5000 " | grep -q "0.0.0.0" || ss -tuln 2>/dev/null | grep ":5000 " | grep -q "0.0.0.0"; then
    echo "✓ Server is listening on 0.0.0.0:5000 (all interfaces)"
else
    echo "⚠ Server may only be listening on 127.0.0.1:5000 (localhost only)"
fi
echo ""

echo "=== Summary ==="
echo "To test from outside the server:"
echo "  curl http://$SERVER_IP:5000/health"
echo "  curl http://$(curl -s ifconfig.me):5000/health  # External IP"
echo ""
echo "If external access fails, check:"
echo "  1. Firewall rules (allow port 5000)"
echo "  2. Cloud provider security groups (AWS, Azure, GCP)"
echo "  3. Router port forwarding (if behind NAT)"
echo "  4. Server logs: docker logs backend-prod"

