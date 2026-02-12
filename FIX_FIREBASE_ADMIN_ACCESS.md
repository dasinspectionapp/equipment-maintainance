# Fix Firebase Admin Service Account Key Access

## Problem
The container shows: `⚠️ Firebase Admin service account key not found.`

This means the Docker container cannot access the `serviceAccountKey.json` file even though you uploaded it via WinSCP.

## Solution

### Step 1: Verify File Location on Server
The file should be at:
```
/var/lib/jenkins/workspace/dasequipment/server/config/serviceAccountKey.json
```

**Verify via SSH or Portainer Console:**
```bash
ls -la /var/lib/jenkins/workspace/dasequipment/server/config/serviceAccountKey.json
```

You should see the file listed. If not, upload it again via WinSCP.

### Step 2: Verify File Permissions
The file should be readable:
```bash
chmod 644 /var/lib/jenkins/workspace/dasequipment/server/config/serviceAccountKey.json
```

### Step 3: Restart Container to Apply Volume Mount

The `docker-compose.prod.yml` has been updated with the volume mount:
```yaml
volumes:
  - ./server/config:/app/config
```

**Option A: Via Portainer (Recommended)**
1. Go to Portainer → Containers
2. Find `backend-prod` container
3. Click **"Recreate"** button
4. This will apply the new volume mount from docker-compose.prod.yml

**Option B: Via SSH**
```bash
cd /var/lib/jenkins/workspace/dasequipment
docker compose -f docker-compose.prod.yml up -d backend-prod
```

**Option C: Via Jenkins (Permanent)**
1. Commit and push the updated `docker-compose.prod.yml` to your repository
2. Let Jenkins redeploy - it will automatically apply the volume mount

### Step 4: Verify File is Accessible in Container

After restarting, check if the container can see the file:

**Via Portainer:**
1. Go to `backend-prod` container
2. Click "Console" tab
3. Run: `ls -la /app/config/serviceAccountKey.json`

**Via SSH:**
```bash
docker exec backend-prod ls -la /app/config/serviceAccountKey.json
```

You should see the file listed.

### Step 5: Check Logs

After restart, check the logs:
```bash
docker logs backend-prod | grep -i firebase
```

You should see: `✅ Firebase Admin initialized successfully`

If you still see the warning, the file path or permissions might be incorrect.

## Troubleshooting

### If file is not accessible in container:
1. Verify the volume mount in docker-compose.prod.yml is correct
2. Make sure you restarted the container after updating docker-compose.prod.yml
3. Check file permissions: `chmod 644 /var/lib/jenkins/workspace/dasequipment/server/config/serviceAccountKey.json`

### If file doesn't exist:
1. Re-upload via WinSCP to: `/var/lib/jenkins/workspace/dasequipment/server/config/serviceAccountKey.json`
2. Make sure filename is exactly `serviceAccountKey.json` (case-sensitive on Linux)

### If still not working:
1. Check docker-compose.prod.yml has the volume mount:
   ```yaml
   volumes:
     - ./server/config:/app/config
   ```
2. Restart container: `docker compose -f docker-compose.prod.yml up -d backend-prod`

