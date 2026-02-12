# Deploy serviceAccountKey.json to Production (Docker Setup)

## 🔍 Your Current Setup

Based on your `docker-compose.prod.yml`, you're using Docker. The config directory is **NOT** currently mounted as a volume.

---

## 🚀 Method 1: Add Volume Mount (Recommended)

### Step 1: Update docker-compose.prod.yml

Add a volume mount for the config directory:

```yaml
services:
  backend-prod:
    build:
      context: ./server
    container_name: backend-prod
    restart: always
    volumes:
      # Persist uploaded e-library files across container restarts/deploys
      - ./server/uploads:/app/uploads
      # ADD THIS LINE - Mount config directory
      - ./server/config:/app/config
    # ... rest of config
```

### Step 2: Upload File to Server

**On production server:**

```bash
# Navigate to project root (where docker-compose.prod.yml is)
cd /path/to/your/project

# Create config directory if it doesn't exist
mkdir -p server/config

# Upload serviceAccountKey.json to this location
# (Use SCP, SFTP, or copy from local)
```

### Step 3: Restart Container

```bash
# Restart backend container
docker-compose -f docker-compose.prod.yml restart backend-prod

# Or rebuild if needed
docker-compose -f docker-compose.prod.yml up -d --build backend-prod
```

### Step 4: Verify

```bash
# Check if file is accessible in container
docker exec backend-prod ls -la /app/config/serviceAccountKey.json

# Check server logs
docker logs backend-prod | grep "Firebase Admin"
# Should see: "✅ Firebase Admin initialized successfully"
```

---

## 🚀 Method 2: Copy File into Container

### Step 1: Upload File to Server

```bash
# Upload to server (anywhere accessible)
scp server/config/serviceAccountKey.json user@bescomdas.vcaan.in:/tmp/
```

### Step 2: Copy into Running Container

```bash
# SSH into server
ssh user@bescomdas.vcaan.in

# Copy file into container
docker cp /tmp/serviceAccountKey.json backend-prod:/app/config/serviceAccountKey.json

# Verify
docker exec backend-prod ls -la /app/config/serviceAccountKey.json
```

### Step 3: Restart Container

```bash
docker-compose -f docker-compose.prod.yml restart backend-prod
```

**Note**: This method requires re-copying the file if the container is recreated.

---

## 🚀 Method 3: Build into Docker Image (Permanent)

### Step 1: Upload File to Server

```bash
# Upload to server
scp server/config/serviceAccountKey.json user@bescomdas.vcaan.in:/path/to/project/server/config/
```

### Step 2: Rebuild Docker Image

```bash
# On production server
cd /path/to/project

# Rebuild backend image (includes serviceAccountKey.json)
docker-compose -f docker-compose.prod.yml build backend-prod

# Restart with new image
docker-compose -f docker-compose.prod.yml up -d backend-prod
```

**Note**: Make sure `serviceAccountKey.json` is NOT in `.dockerignore` if using this method.

---

## ✅ Recommended Approach: Method 1 (Volume Mount)

**Why?**
- ✅ File persists across container restarts
- ✅ Easy to update without rebuilding
- ✅ File stays on host (more secure)

### Complete Steps:

**1. On your local machine, update docker-compose.prod.yml:**

```yaml
volumes:
  - ./server/uploads:/app/uploads
  - ./server/config:/app/config  # ADD THIS
```

**2. Commit and push the change:**

```bash
git add docker-compose.prod.yml
git commit -m "Add config volume mount for serviceAccountKey.json"
git push
```

**3. On production server, pull changes:**

```bash
cd /path/to/project
git pull
```

**4. Upload serviceAccountKey.json:**

```bash
# Using SCP from local machine
scp server/config/serviceAccountKey.json user@bescomdas.vcaan.in:/path/to/project/server/config/

# Or using SFTP/FileZilla
# Upload to: /path/to/project/server/config/serviceAccountKey.json
```

**5. Restart Docker:**

```bash
# On production server
cd /path/to/project
docker-compose -f docker-compose.prod.yml restart backend-prod
```

**6. Verify:**

```bash
# Check logs
docker logs backend-prod | grep "Firebase Admin"
# Should see: "✅ Firebase Admin initialized successfully"
```

---

## 🔍 Finding Your Project Path on Server

If you're not sure where your project is on the server:

```bash
# Find docker-compose.prod.yml
find / -name "docker-compose.prod.yml" 2>/dev/null

# Or check running containers
docker ps | grep backend-prod

# Check container working directory
docker inspect backend-prod | grep -i workdir
```

---

## 🛡️ Security: Set File Permissions

After uploading:

```bash
# On production server
chmod 600 /path/to/project/server/config/serviceAccountKey.json
chown $(whoami):$(whoami) /path/to/project/server/config/serviceAccountKey.json
```

---

## ✅ Quick Checklist

- [ ] Update `docker-compose.prod.yml` to mount config volume (Method 1)
- [ ] Upload `serviceAccountKey.json` to server
- [ ] File at: `/path/to/project/server/config/serviceAccountKey.json`
- [ ] Restart Docker container
- [ ] Check logs: `✅ Firebase Admin initialized successfully`
- [ ] Test notification works

---

## 📝 Example Commands (Method 1)

```bash
# 1. Update docker-compose.prod.yml (add volume mount)
# 2. Upload file
scp server/config/serviceAccountKey.json user@bescomdas.vcaan.in:/var/www/equipment/server/config/

# 3. On server, restart
ssh user@bescomdas.vcaan.in
cd /var/www/equipment
docker-compose -f docker-compose.prod.yml restart backend-prod

# 4. Verify
docker logs backend-prod | tail -20
```

---

## 🆘 Troubleshooting

### "File not found" in container

**Check:**
```bash
# Verify file exists on host
ls -la /path/to/project/server/config/serviceAccountKey.json

# Verify volume mount
docker inspect backend-prod | grep -A 10 Mounts

# Check if file is in container
docker exec backend-prod ls -la /app/config/
```

### "Permission denied"

**Fix:**
```bash
# On host
chmod 600 /path/to/project/server/config/serviceAccountKey.json
```

### Container can't see file

**Solution:** Make sure volume mount path is correct in `docker-compose.prod.yml`:
```yaml
volumes:
  - ./server/config:/app/config  # Host:Container
```


