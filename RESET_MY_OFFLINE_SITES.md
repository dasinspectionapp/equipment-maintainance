# Reset MY OFFLINE SITES Data

This guide explains how to reset all MY OFFLINE SITES data for Equipment role users.

## Database Reset (Server-side)

Run the following command from the `server` directory:

```bash
npm run reset-equipment-offline-sites
```

Or directly:
```bash
node utils/resetEquipmentOfflineSites.js
```

This will:
- Delete all records from the "Equipment offline sites" collection for Equipment role users
- Clear: Site Observations, Task Status, Type of Issue, View Photos, Remarks, Photo Metadata, Support Documents

## Browser localStorage Reset (Client-side)

After running the server script, you also need to clear localStorage in your browser:

### Method 1: Browser Developer Tools
1. Open browser Developer Tools (Press F12)
2. Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
3. Find **Local Storage** → your domain (e.g., `http://localhost:5173`)
4. Delete all keys starting with `myData_`

### Method 2: Browser Console
Open browser console (F12 → Console tab) and run:

```javascript
// Clear only MY OFFLINE SITES data
Object.keys(localStorage)
  .filter(k => k.startsWith("myData_"))
  .forEach(k => localStorage.removeItem(k));
console.log("✓ MY OFFLINE SITES localStorage cleared");
```

### Method 3: Clear All localStorage (if needed)
```javascript
localStorage.clear();
console.log("✓ All localStorage cleared");
```

## Complete Reset Steps

1. **Stop the server** (if running)
2. **Run the reset script:**
   ```bash
   cd server
   npm run reset-equipment-offline-sites
   ```
3. **Clear browser localStorage** (use one of the methods above)
4. **Refresh the browser** (F5 or Ctrl+R)
5. **Restart the server** (if needed)

## What Gets Reset

- ✅ Site Observations column
- ✅ Task Status column
- ✅ Type of Issue column
- ✅ View Photos column
- ✅ Remarks column
- ✅ Photo Metadata
- ✅ Support Documents

**Note:** Original row data from uploaded files is preserved in the database, but all user-entered data in the above columns is cleared.


