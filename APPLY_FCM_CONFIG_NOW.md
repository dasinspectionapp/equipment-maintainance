# Apply FCM Configuration Immediately (Without Jenkins Deployment)

Since you've already uploaded `serviceAccountKey.json` via WinSCP, you can apply the volume mount immediately by restarting the container.

## Steps:

### 1. Verify File Location
The file should be at:
```
/var/lib/jenkins/workspace/dasequipment/server/config/serviceAccountKey.json
```

### 2. Restart Container via Portainer
1. Open Portainer
2. Go to Containers → `backend-prod`
3. Click **"Recreate"** button
4. This will recreate the container with the updated docker-compose.prod.yml volume mount

### 3. OR Restart via SSH
If you have SSH access to the server:
```bash
cd /var/lib/jenkins/workspace/dasequipment
docker compose -f docker-compose.prod.yml up -d backend-prod
```

### 4. Check Logs
After restart, check if Firebase Admin initialized:
```bash
docker logs backend-prod | grep -i firebase
```

You should see: `✅ Firebase Admin initialized successfully`

### 5. Test FCM
1. Open mobile app with production URL
2. Login - FCM token should register automatically
3. Trigger a notification (upload, route, etc.)
4. Check if notification appears

---

**Note:** This is a temporary fix. For permanent deployment, commit and push the updated `docker-compose.prod.yml` so Jenkins applies it in future deployments.

