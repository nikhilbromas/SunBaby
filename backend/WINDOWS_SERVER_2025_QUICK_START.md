# Windows Server 2025 Deployment - Quick Start

Quick reference guide for deploying SunBaby Backend on Windows Server 2025 EC2.

## Prerequisites

- Windows Server 2025 EC2 instance (t3.medium or larger)
- Security group with ports 3389 (RDP) and 8000 (Application) open
- Administrator access to the EC2 instance

## Quick Deployment Steps

### 1. Connect to EC2 Instance

```powershell
# Use RDP to connect
# Computer: <public-ip>
# Username: Administrator
# Password: (from EC2 Console → Get Windows Password)
```

### 2. Open PowerShell as Administrator

Right-click Start → **Windows PowerShell (Admin)** or **Terminal (Admin)**

### 3. Set Execution Policy

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 4. Install Docker (if not already installed)

```powershell
cd C:\SunBaby\backend
.\install-docker-ee.ps1
Restart-Computer
```

After restart, reconnect via RDP.

### 5. Verify Docker

```powershell
docker version
# Should show: OS/Arch: windows/amd64
```

### 6. Deploy Application

```powershell
cd C:\SunBaby\backend

# Verify files exist
Test-Path Dockerfile.windows2025
Test-Path deploy-ec2-windows2025.ps1
Test-Path requirements.txt

# Run deployment script
.\deploy-ec2-windows2025.ps1
```

### 7. Verify Deployment

```powershell
# Check container status
docker ps

# View logs
docker logs sunbaby-backend

# Get public IP
(Invoke-WebRequest -Uri "http://169.254.169.254/latest/meta-data/public-ipv4" -UseBasicParsing).Content

# Test API
Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing
```

## Custom Configuration

```powershell
.\deploy-ec2-windows2025.ps1 `
    -ImageName "sunbaby-backend" `
    -ImageTag "v1.0" `
    -Port 8000 `
    -DbServer "your-server\instance,1435" `
    -DbName "your-database" `
    -DbUser "sa" `
    -DbPassword "your-password"
```

## Key Differences from Windows Server 2019/2022

- **Dockerfile**: Uses `Dockerfile.windows2025` (base image: `ltsc2025`)
- **Deployment Script**: Uses `deploy-ec2-windows2025.ps1`
- **Base Image**: `mcr.microsoft.com/windows/servercore:ltsc2025`

## Common Commands

```powershell
# View logs
docker logs -f sunbaby-backend

# Stop container
docker stop sunbaby-backend

# Start container
docker start sunbaby-backend

# Restart container
docker restart sunbaby-backend

# Shell into container
docker exec -it sunbaby-backend powershell

# Update application
git pull
.\deploy-ec2-windows2025.ps1
```

## Troubleshooting

### Docker Not Running
```powershell
Get-Service Docker
Start-Service Docker
```

### Container Won't Start
```powershell
docker logs sunbaby-backend
docker ps -a
```

### Port Already in Use
```powershell
netstat -ano | findstr :8000
# Use different port: .\deploy-ec2-windows2025.ps1 -Port 8001
```

## Access Your API

After deployment, your API will be available at:

- **API URL**: `http://<public-ip>:8000`
- **API Docs**: `http://<public-ip>:8000/docs`
- **Health Check**: `http://<public-ip>:8000/health`

## Full Documentation

For detailed instructions, see: `WINDOWS_SERVER_DEPLOYMENT_GUIDE.md`

