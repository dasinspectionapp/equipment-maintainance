# Quick Fix: Copy Firebase Key Directly to Container

If the volume mount isn't working immediately, use this quick fix:

## Step 1: Copy File to Container

**Via SSH:**
```bash
docker cp /var/lib/jenkins/workspace/dasequipment/server/config/serviceAccountKey.json backend-prod:/app/config/serviceAccountKey.json
```

**Via Portainer:**
1. Go to `backend-prod` container
2. Click "Console" tab
3. Run:
```bash
# First, create config directory if it doesn't exist
mkdir -p /app/config

# Then copy (you'll need to use docker cp from host, not from container console)
```

Actually, you need to run `docker cp` from the host machine, not from inside the container.

## Step 2: Restart Container

```bash
docker restart backend-prod
```

## Step 3: Verify

```bash
docker logs backend-prod | grep -i firebase
```

Should see: `✅ Firebase Admin initialized successfully`

---

**Note:** This is a temporary fix. The file will be lost if the container is recreated. For a permanent solution, ensure the volume mount in `docker-compose.prod.yml` is working.

