# Find Project Location Using Portainer

## 🎯 Method 1: Check Stack Location (Easiest)

**In Portainer:**

1. Click on **"Stacks"** in the left sidebar
2. Find the stack **"dasequipment"** (your backend-prod is in this stack)
3. Click on **"dasequipment"** stack
4. Look for **"Compose path"** or **"Project path"** - this shows where your project is!

---

## 🎯 Method 2: Inspect Container Volumes

**In Portainer:**

1. Click on **"Containers"** (you're already here)
2. Click on **"backend-prod"** container name
3. Click on **"Inspect"** tab (or "Volumes" tab)
4. Look for **"Mounts"** section
5. You'll see volume mappings like:
   - `./server/uploads:/app/uploads`
   - The path before `:` is your project location!

**Example:**
```
Source: /root/equipment/server/uploads
Destination: /app/uploads
```
→ Your project is at: `/root/equipment/`

---

## 🎯 Method 3: Check Container Logs/Console

**In Portainer:**

1. Click on **"backend-prod"** container
2. Click **"Console"** tab
3. Run:
   ```bash
   # Check working directory
   pwd
   
   # Check mounted volumes
   ls -la /app/
   ```

---

## 🎯 Method 4: Use SSH (If you have access)

**SSH into server and run:**

```bash
# Find docker-compose file for dasequipment stack
find / -name "docker-compose*.yml" 2>/dev/null | grep -i equipment

# Or check Portainer data directory
ls -la /var/lib/docker/volumes/ | grep equipment

# Or check where stack is deployed
docker inspect backend-prod | grep -i "source\|bind"
```

---

## 🎯 Method 5: Check Stack Compose File

**In Portainer:**

1. Go to **"Stacks"**
2. Click **"dasequipment"**
3. Click **"Editor"** tab
4. Look at the `volumes:` section:
   ```yaml
   volumes:
     - ./server/uploads:/app/uploads
   ```
   - The `./` means it's relative to where docker-compose.yml is located
   - Check the stack's "Compose path" shown at the top

---

## ✅ Once You Find the Path

**Navigate in WinSCP to:**
```
/path/to/project/server/config/
```

**Then upload `serviceAccountKey.json` there!**

---

## 🔧 Quick WinSCP Steps After Finding Path

1. **In WinSCP right pane**, navigate to the project path (e.g., `/root/equipment/`)
2. **Enter `server/` folder**
3. **Enter `config/` folder** (create if doesn't exist)
4. **Upload `serviceAccountKey.json`** from left pane

---

## 📋 Most Likely Locations

Based on your setup, try these in WinSCP:

- `/root/equipment/`
- `/root/dasequipment/`
- `/var/lib/docker/volumes/`
- `/opt/equipment/`

**Check the stack details in Portainer first - that's the fastest way!**


