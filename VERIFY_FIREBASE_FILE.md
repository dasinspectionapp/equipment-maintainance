# Verify and Fix Firebase Admin Service Account Key Access

## Current Issue
Container shows: `⚠️ Firebase Admin service account key not found.`

## Step-by-Step Verification

### Step 1: Verify File Exists on Server Host

**Via SSH or Portainer Console:**
```bash
ls -la /var/lib/jenkins/workspace/dasequipment/server/config/serviceAccountKey.json
```

**Expected Output:**
```
-rw-r--r-- 1 user group 2345 Feb 12 03:30 serviceAccountKey.json
```

If file doesn't exist, upload it via WinSCP to:
```
/var/lib/jenkins/workspace/dasequipment/server/config/serviceAccountKey.json
```

### Step 2: Verify File Permissions

```bash
chmod 644 /var/lib/jenkins/workspace/dasequipment/server/config/serviceAccountKey.json
chown $(whoami):$(whoami) /var/lib/jenkins/workspace/dasequipment/server/config/serviceAccountKey.json
```

### Step 3: Verify docker-compose.prod.yml Has Volume Mount

**Check on server:**
```bash
cat /var/lib/jenkins/workspace/dasequipment/docker-compose.prod.yml | grep -A 3 "volumes:"
```

**Should show:**
```yaml
volumes:
  - ./server/uploads:/app/uploads
  - ./server/config:/app/config
```

If the volume mount is missing, you need to:
1. Pull the latest code from your repository (which has the updated docker-compose.prod.yml)
2. Or manually add the volume mount line

### Step 4: Restart Container with Updated Config

**Option A: Via Portainer**
1. Go to Containers → `backend-prod`
2. Click **"Recreate"** (this applies the latest docker-compose.prod.yml)
3. Make sure "Pull latest image" is checked if needed

**Option B: Via SSH**
```bash
cd /var/lib/jenkins/workspace/dasequipment
docker compose -f docker-compose.prod.yml down backend-prod
docker compose -f docker-compose.prod.yml up -d backend-prod
```

### Step 5: Verify File is Accessible Inside Container

**Via Portainer Console:**
1. Go to `backend-prod` container
2. Click "Console" tab
3. Run:
```bash
ls -la /app/config/serviceAccountKey.json
cat /app/config/serviceAccountKey.json | head -5
```

**Via SSH:**
```bash
docker exec backend-prod ls -la /app/config/serviceAccountKey.json
docker exec backend-prod cat /app/config/serviceAccountKey.json | head -5
```

**Expected Output:**
```
-rw-r--r-- 1 root root 2345 Feb 12 03:30 /app/config/serviceAccountKey.json
{
  "type": "service_account",
  "project_id": "...",
  ...
}
```

### Step 6: Check Container Logs

```bash
docker logs backend-prod | grep -i firebase
```

**Should see:**
```
✅ Firebase Admin initialized successfully
```

**If still showing warning:**
- The file path inside container might be wrong
- Check the actual path firebaseAdmin.js is looking for

### Step 7: Verify firebaseAdmin.js File Path

The code looks for: `/app/config/serviceAccountKey.json`

Verify this matches what's mounted:
```bash
docker exec backend-prod pwd  # Should show /app
docker exec backend-prod ls -la /app/config/  # Should list serviceAccountKey.json
```

## Alternative: Copy File into Container (Temporary Fix)

If volume mount isn't working, you can copy the file directly:

```bash
docker cp /var/lib/jenkins/workspace/dasequipment/server/config/serviceAccountKey.json backend-prod:/app/config/serviceAccountKey.json
docker restart backend-prod
```

**Note:** This is temporary - file will be lost if container is recreated. Use volume mount for permanent solution.

## Troubleshooting Checklist

- [ ] File exists at `/var/lib/jenkins/workspace/dasequipment/server/config/serviceAccountKey.json`
- [ ] File has correct permissions (644)
- [ ] `docker-compose.prod.yml` has volume mount: `./server/config:/app/config`
- [ ] Container was restarted after updating docker-compose.prod.yml
- [ ] File is visible inside container at `/app/config/serviceAccountKey.json`
- [ ] File content is valid JSON (can be parsed)
- [ ] Container logs show Firebase Admin initialized successfully

## If Still Not Working

1. **Check if docker-compose.prod.yml on server is updated:**
   ```bash
   cd /var/lib/jenkins/workspace/dasequipment
   git pull origin main  # Pull latest changes
   ```

2. **Force recreate container:**
   ```bash
   docker compose -f docker-compose.prod.yml down backend-prod
   docker compose -f docker-compose.prod.yml up -d --force-recreate backend-prod
   ```

3. **Check volume mount is actually working:**
   ```bash
   docker inspect backend-prod | grep -A 10 "Mounts"
   ```
   
   Should show:
   ```json
   {
     "Type": "bind",
     "Source": "/var/lib/jenkins/workspace/dasequipment/server/config",
     "Destination": "/app/config",
     ...
   }
   ```

