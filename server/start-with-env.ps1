# PowerShell script to start the backend server with MongoDB environment variables
# This script sets the required environment variables and starts the server

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  Starting BESCOM DAS Backend Server" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

# Set MongoDB URI - vcaan.in is reachable from external networks
# (192.168.29.14 only works on specific LAN/VPN)
$env:MONGODB_URI = "mongodb://admin:password@vcaan.in:27017/das?authSource=admin&authMechanism=SCRAM-SHA-256"

# Set other required environment variables
$env:PORT = "5000"
$env:NODE_ENV = "development"
$env:JWT_SECRET = "bescom_distribution_automation_system_secret_key_2024"
$env:JWT_EXPIRE = "7d"
$env:FRONTEND_URL = "http://localhost:5173"

Write-Host "Environment variables configured:" -ForegroundColor Green
Write-Host "  MONGODB_URI: mongodb://admin:****@vcaan.in:27017/das" -ForegroundColor White
Write-Host "  PORT: $env:PORT" -ForegroundColor White
Write-Host "  NODE_ENV: $env:NODE_ENV" -ForegroundColor White
Write-Host "  FRONTEND_URL: $env:FRONTEND_URL" -ForegroundColor White
Write-Host ""
Write-Host "Starting server with 'npm start'..." -ForegroundColor Yellow
Write-Host ""

# Start the server
npm start

