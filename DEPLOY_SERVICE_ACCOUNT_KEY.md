# How to Deploy serviceAccountKey.json to Production Server

## 📋 Overview

The `serviceAccountKey.json` file needs to be manually uploaded to the production server at:
```
server/config/serviceAccountKey.json
```

**Important**: This file is NOT in Git (it's in `.gitignore`), so it must be uploaded manually.

---

## 🔐 Method 1: Using SCP (Secure Copy) - Recommended

### Prerequisites
- SSH access to production server
- File exists locally: `server/config/serviceAccountKey.json`

### Steps

**From your local machine:**

```bash
# Navigate to project root
cd "C:\Users\shire\OneDrive\Desktop\bescom das project\equipment\server check with mobile app(till Site Check-in)"

# Upload file using SCP
scp server/config/serviceAccountKey.json user@bescomdas.vcaan.in:/path/to/server/config/

# Example (replace with actual paths):
scp server/config/serviceAccountKey.json root@bescomdas.vcaan.in:/var/www/equipment/server/config/
```

**For Windows PowerShell:**
```powershell
# If you have OpenSSH installed (Windows 10+)
scp server/config/serviceAccountKey.json user@bescomdas.vcaan.in:/path/to/server/config/
```

**For Windows with WinSCP (GUI):**
1. Download WinSCP: https://winscp.net/
2. Connect to: `bescomdas.vcaan.in`
3. Navigate to: `/path/to/server/config/`
4. Drag and drop `serviceAccountKey.json`

---

## 🔐 Method 2: Using SFTP

### Using Command Line SFTP

```bash
# Connect via SFTP
sftp user@bescomdas.vcaan.in

# Navigate to server config directory
cd /path/to/server/config

# Upload file
put server/config/serviceAccountKey.json

# Exit
exit
```

### Using FileZilla (GUI)

1. Download FileZilla: https://filezilla-project.org/
2. Connect:
   - Host: `bescomdas.vcaan.in`
   - Protocol: SFTP
   - Username: Your username
   - Password: Your password
3. Navigate to: `/path/to/server/config/`
4. Drag and drop `serviceAccountKey.json`

---

## 🔐 Method 3: Direct Server Access (If you have console access)

### If you can access the server directly:

**Option A: Using nano/vim editor**

```bash
# SSH into server
ssh user@bescomdas.vcaan.in

# Navigate to config directory
cd /path/to/server/config

# Create file
nano serviceAccountKey.json

# Paste the JSON content
# Press Ctrl+X, then Y, then Enter to save

# Verify file
cat serviceAccountKey.json
```

**Option B: Using wget/curl (if file is hosted temporarily)**

```bash
# On production server
cd /path/to/server/config

# Download from temporary location (replace URL)
wget https://temporary-url.com/serviceAccountKey.json

# Or using curl
curl -o serviceAccountKey.json https://temporary-url.com/serviceAccountKey.json
```

---

## 🔐 Method 4: Using Docker Volume (If using Docker)

If your production server uses Docker:

### Step 1: Copy file to server

```bash
# Copy file to server
scp server/config/serviceAccountKey.json user@bescomdas.vcaan.in:/tmp/

# SSH into server
ssh user@bescomdas.vcaan.in

# Copy to Docker volume or mount point
cp /tmp/serviceAccountKey.json /path/to/docker/volume/server/config/
```

### Step 2: Restart Docker container

```bash
# Restart backend container
docker-compose restart backend-prod

# Or if using docker directly
docker restart backend-prod
```

---

## ✅ Verification Steps

### Step 1: Verify File Exists

**On production server:**
```bash
# Check if file exists
ls -la /path/to/server/config/serviceAccountKey.json

# Check file permissions (should be readable)
cat /path/to/server/config/serviceAccountKey.json | head -5
```

### Step 2: Verify File Permissions

```bash
# Set appropriate permissions (readable by Node.js process)
chmod 600 /path/to/server/config/serviceAccountKey.json

# Or if needed by specific user
chown node:node /path/to/server/config/serviceAccountKey.json
chmod 600 /path/to/server/config/serviceAccountKey.json
```

### Step 3: Restart Server

```bash
# Restart Node.js server
pm2 restart server
# OR
systemctl restart your-service-name
# OR
docker-compose restart backend-prod
```

### Step 4: Check Server Logs

**Look for this in server logs:**
```
✅ Firebase Admin initialized successfully
```

**If you see:**
```
⚠️ Firebase Admin service account key not found
```
→ File is missing or in wrong location!

---

## 🔍 Finding Your Server Path

### If using Docker Compose:

Check `docker-compose.prod.yml`:
```yaml
volumes:
  - ./server/config:/app/config
```

File should be at: `./server/config/serviceAccountKey.json` (relative to docker-compose.yml)

### If using PM2/systemd:

Check where your server code is located:
```bash
# Find server directory
which node
pm2 list
# Check PM2 config for working directory
```

### If using direct Node.js:

File should be at: `server/config/serviceAccountKey.json` (relative to where you run `npm start`)

---

## 🛡️ Security Best Practices

1. **File Permissions:**
   ```bash
   chmod 600 serviceAccountKey.json  # Only owner can read/write
   ```

2. **Don't commit to Git:**
   - ✅ Already in `.gitignore`
   - ✅ Never commit this file

3. **Secure Transfer:**
   - ✅ Always use SCP/SFTP (encrypted)
   - ❌ Never email the file
   - ❌ Never use HTTP/FTP (unencrypted)

4. **Delete after upload (if using temporary storage):**
   ```bash
   # After verifying it works
   rm /tmp/serviceAccountKey.json
   ```

---

## 📝 Quick Reference

### Most Common Method (SCP):

```bash
# From local machine
scp server/config/serviceAccountKey.json user@bescomdas.vcaan.in:/path/to/server/config/

# Then on server
chmod 600 /path/to/server/config/serviceAccountKey.json
# Restart server
```

### Verify It Works:

```bash
# Check server logs
# Should see: "✅ Firebase Admin initialized successfully"
```

---

## 🆘 Troubleshooting

### Issue: "Permission denied"

**Fix:**
```bash
chmod 600 serviceAccountKey.json
chown node:node serviceAccountKey.json  # Replace 'node' with your server user
```

### Issue: "File not found" in server logs

**Fix:**
1. Verify file path is correct
2. Check file exists: `ls -la server/config/serviceAccountKey.json`
3. Check working directory of Node.js process
4. Verify path in `firebaseAdmin.js` matches actual location

### Issue: "Invalid service account"

**Fix:**
1. Verify file is valid JSON: `cat serviceAccountKey.json | jq .`
2. Re-download from Firebase Console
3. Ensure it's from the correct Firebase project

---

## ✅ Final Checklist

- [ ] File downloaded from Firebase Console
- [ ] File uploaded to production server
- [ ] File at correct path: `server/config/serviceAccountKey.json`
- [ ] File permissions set: `chmod 600`
- [ ] Server restarted
- [ ] Server logs show: `✅ Firebase Admin initialized successfully`
- [ ] Test notification works

---

## 📞 Need Help?

If you're unsure about:
- Server path: Check your deployment configuration
- SSH access: Contact your server administrator
- File location: Check `server/config/firebaseAdmin.js` for the expected path


