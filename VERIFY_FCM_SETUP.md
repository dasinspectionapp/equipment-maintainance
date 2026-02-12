# Verify FCM Setup on Production Server

## Step 1: Verify File Location
The `serviceAccountKey.json` file should be at:
```
/var/lib/jenkins/workspace/dasequipment/server/config/serviceAccountKey.json
```

## Step 2: Verify File Permissions
The file should be readable by the container:
```bash
ls -la /var/lib/jenkins/workspace/dasequipment/server/config/serviceAccountKey.json
```

## Step 3: Restart Container
After updating `docker-compose.prod.yml`, restart the container:

**Option A: Via Portainer**
1. Go to `backend-prod` container
2. Click "Recreate" button
3. This will apply the new volume mount

**Option B: Via SSH**
```bash
cd /var/lib/jenkins/workspace/dasequipment
docker-compose -f docker-compose.prod.yml up -d backend-prod
```

## Step 4: Check Logs
Check the container logs for Firebase Admin initialization:

**Via Portainer:**
- Go to `backend-prod` → "Logs" tab
- Look for: `✅ Firebase Admin initialized successfully`

**Via SSH:**
```bash
docker logs backend-prod | grep -i firebase
```

## Step 5: Test FCM
Once you see the success message, test sending a notification:
1. Login to the mobile app with production URL (`https://bescomdas.vcaan.in/`)
2. The FCM token should be registered automatically
3. Trigger a notification (upload file, route action, etc.)
4. Check if notification appears on mobile device

## Troubleshooting

### If you see "Firebase Admin service account key not found":
1. Verify file exists: `ls -la /var/lib/jenkins/workspace/dasequipment/server/config/serviceAccountKey.json`
2. Check file permissions: Should be readable (644 or 755)
3. Verify filename is exactly `serviceAccountKey.json` (case-sensitive)
4. Check container can see the file:
   ```bash
   docker exec backend-prod ls -la /app/config/serviceAccountKey.json
   ```

### If file is not accessible in container:
1. Verify volume mount in docker-compose.prod.yml:
   ```yaml
   volumes:
     - ./server/config:/app/config
   ```
2. Restart container after updating docker-compose.prod.yml

