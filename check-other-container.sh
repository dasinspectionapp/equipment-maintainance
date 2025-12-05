#!/bin/bash
# Script to check how the other container connects to MongoDB

echo "Checking other containers using MongoDB..."
echo ""

# List all running containers
echo "All running containers:"
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"
echo ""

# Check for containers with MongoDB in environment
echo "Containers with MONGODB_URI in environment:"
docker ps --format "{{.Names}}" | while read container; do
    mongo_uri=$(docker inspect "$container" 2>/dev/null | grep -i "MONGODB_URI" | head -1)
    if [ ! -z "$mongo_uri" ]; then
        echo "Container: $container"
        echo "  MongoDB URI: $mongo_uri" | sed 's/:[^:@]*@/:****@/g'
        echo "  Network Mode: $(docker inspect "$container" --format '{{.HostConfig.NetworkMode}}' 2>/dev/null)"
        echo "  Networks: $(docker inspect "$container" --format '{{range $key, $value := .NetworkSettings.Networks}}{{$key}} {{end}}' 2>/dev/null)"
        echo ""
    fi
done

echo ""
echo "To inspect a specific container:"
echo "  docker inspect <container-name> | grep -A 10 -i mongo"
echo "  docker inspect <container-name> | grep -A 5 NetworkMode"


