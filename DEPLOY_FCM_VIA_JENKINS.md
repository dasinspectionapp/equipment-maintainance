# Deploy FCM Configuration via Jenkins CI/CD

## Steps:

### 1. Commit the Updated docker-compose.prod.yml
The file already has the volume mount for the config directory:
```yaml
volumes:
  - ./server/uploads:/app/uploads
  - ./server/config:/app/config  # This line was added
```

### 2. Push to Repository
```bash
git add docker-compose.prod.yml
git commit -m "Add volume mount for FCM serviceAccountKey.json"
git push origin main
```

### 3. Jenkins Will Automatically:
- Checkout the latest code
- Build the frontend
- Deploy to staging
- Ask for approval
- Deploy to production with the updated docker-compose.prod.yml

### 4. Verify After Deployment
After Jenkins completes the production deployment:
```bash
docker logs backend-prod | grep -i firebase
```

You should see: `✅ Firebase Admin initialized successfully`

---

**Important:** Since you've already uploaded `serviceAccountKey.json` via WinSCP, it will be accessible to the container once Jenkins redeploys with the updated docker-compose.prod.yml.

