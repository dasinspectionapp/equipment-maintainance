#!/bin/bash
# Script to check how the working container connects to MongoDB

echo "=== Finding containers that use MongoDB ==="
echo ""

# Find all containers
echo "All running containers:"
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"
echo ""

# Check each container for MongoDB connection
echo "=== Containers with MongoDB configuration ==="
for container in $(docker ps --format "{{.Names}}"); do
    # Check if container has MONGODB_URI
    mongo_config=$(docker inspect "$container" 2>/dev/null | grep -i "MONGODB_URI" | head -1)
    
    if [ ! -z "$mongo_config" ]; then
        echo ""
        echo "Container: $container"
        echo "----------------------------------------"
        
        # Get MongoDB URI (masked)
        mongo_uri=$(docker inspect "$container" --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | grep -i MONGODB_URI)
        if [ ! -z "$mongo_uri" ]; then
            echo "MongoDB URI: $(echo $mongo_uri | sed 's/:[^:@]*@/:****@/g')"
        fi
        
        # Get network mode
        network_mode=$(docker inspect "$container" --format '{{.HostConfig.NetworkMode}}' 2>/dev/null)
        echo "Network Mode: $network_mode"
        
        # Get networks
        networks=$(docker inspect "$container" --format '{{range $key, $value := .NetworkSettings.Networks}}{{$key}} {{end}}' 2>/dev/null)
        echo "Networks: $networks"
        
        # Get IP address
        ip=$(docker inspect "$container" --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' 2>/dev/null)
        echo "IP Address: $ip"
    fi
done

echo ""
echo "=== To inspect a specific container in detail ==="
echo "docker inspect <container-name> | grep -A 30 'Config\|NetworkSettings'"


