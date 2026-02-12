# How to Find Your Project on the Server

## 🔍 Method 1: Search for docker-compose.prod.yml

**In WinSCP:**
1. Click **"Find Files"** button in toolbar (or press `Ctrl+F`)
2. Search for: `docker-compose.prod.yml`
3. This will show you the exact location

**Or via SSH:**
```bash
find / -name "docker-compose.prod.yml" 2>/dev/null
```

---

## 🔍 Method 2: Check Running Docker Containers

**SSH into server and run:**
```bash
# Check where backend-prod container is running from
docker inspect backend-prod | grep -i "workdir\|source"

# Or check container mounts
docker inspect backend-prod | grep -A 10 Mounts
```

This will show you the project path.

---

## 🔍 Method 3: Check Common Locations

**Navigate to these common locations in WinSCP:**

1. **`/root/`** - Check if project is here
2. **`/root/equipment/`** - Your project might be here
3. **`/var/www/`** - Common web server location
4. **`/home/`** - Check user directories
5. **`/opt/`** - Sometimes used for applications

**In WinSCP right pane, try navigating to:**
- `/root/`
- `/root/equipment/`
- `/var/www/equipment/`

---

## 🔍 Method 4: Check Docker Compose Location

**SSH into server:**
```bash
# Find where docker-compose is running from
ps aux | grep docker-compose

# Or check docker container working directory
docker exec backend-prod pwd
```

---

## 🔍 Method 5: Search for Server Files

**SSH into server:**
```bash
# Search for server.js
find / -name "server.js" -path "*/server/*" 2>/dev/null

# Search for package.json in server directory
find / -name "package.json" -path "*/server/*" 2>/dev/null
```

---

## 🎯 Quick WinSCP Steps

### Step 1: Use Find Files Feature

1. In WinSCP, click **"Find Files"** button (toolbar, looks like a magnifying glass)
2. In "File name" field, type: `docker-compose.prod.yml`
3. Click "OK"
4. It will show you the file location
5. Navigate to that directory

### Step 2: Navigate Manually

**Try these paths in WinSCP right pane:**

1. Start at `/root/`
2. Look for folders like:
   - `equipment`
   - `bescom`
   - `das`
   - `project`
3. Enter the folder
4. Look for `server/` folder inside

---

## 🔧 Alternative: Upload to Known Location

**If you can't find the project, upload to a temporary location:**

1. **Upload to `/tmp/`:**
   - Navigate to `/tmp/` in WinSCP
   - Upload `serviceAccountKey.json` there
   - Then SSH and move it later

2. **SSH into server:**
   ```bash
   # Find project
   find / -name "docker-compose.prod.yml" 2>/dev/null
   
   # Once found, move file
   mv /tmp/serviceAccountKey.json /path/to/project/server/config/
   ```

---

## 📋 What to Look For

**Your project directory should contain:**
- ✅ `docker-compose.prod.yml`
- ✅ `server/` folder
- ✅ `Mobile/` folder
- ✅ `nginx.conf`
- ✅ `package.json` (root level)

**Once you find it, navigate to:**
```
/path/to/project/server/config/
```

---

## 🆘 Still Can't Find It?

**SSH into server and run:**
```bash
# List all directories in /root
ls -la /root/

# Check if equipment folder exists
ls -la /root/ | grep equipment

# Check docker containers
docker ps

# Check container details
docker inspect backend-prod
```

**Share the output and I'll help you locate it!**


