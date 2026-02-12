# WinSCP Upload Steps for serviceAccountKey.json

## 🎯 Quick Steps

### 1. Find Project Directory on Server

**In WinSCP right pane, look for:**
- Directory containing `docker-compose.prod.yml`
- Directory containing `server/` folder

**Common locations:**
- `/root/equipment/`
- `/root/.../equipment/`
- `/var/www/equipment/`
- `/home/user/equipment/`

### 2. Navigate to server/config

**Path should be:**
```
/path/to/project/server/config/
```

**If `config` folder doesn't exist:**
- Right-click in `server/` folder
- Select "New" → "Directory"
- Name it: `config`
- Enter the folder

### 3. Upload File

**Method 1: Drag and Drop**
1. Left pane: Find `serviceAccountKey.json`
2. Drag it to right pane (`server/config/` folder)
3. Confirm upload

**Method 2: Right-Click Upload**
1. Right-click `serviceAccountKey.json` in left pane
2. Select "Upload"
3. Confirm destination: `server/config/`

### 4. Verify

**Check right pane shows:**
- `serviceAccountKey.json` in `server/config/` folder

---

## 🔧 After Upload: Update Docker

### Option 1: Add Volume Mount (Recommended)

**Edit `docker-compose.prod.yml` on server:**

Add this line under `volumes:`:
```yaml
volumes:
  - ./server/uploads:/app/uploads
  - ./server/config:/app/config  # ADD THIS
```

**Then restart:**
```bash
docker-compose -f docker-compose.prod.yml restart backend-prod
```

### Option 2: Copy into Container

**After uploading, SSH into server and run:**
```bash
# Find your project path first
cd /path/to/project

# Copy into container
docker cp server/config/serviceAccountKey.json backend-prod:/app/config/

# Restart
docker-compose -f docker-compose.prod.yml restart backend-prod
```

---

## ✅ Verify It Works

**Check server logs:**
```bash
docker logs backend-prod | grep "Firebase Admin"
```

**Should see:**
```
✅ Firebase Admin initialized successfully
```

---

## 🆘 Can't Find Project Directory?

**In WinSCP, use "Find Files" feature:**
1. Click "Find Files" button (toolbar)
2. Search for: `docker-compose.prod.yml`
3. This will show you where the project is located


