# Windows Container Setup Guide

This guide helps you set up Windows containers for building the Docker image with ODBC Driver 17 for SQL Server.

## Prerequisites

1. **Windows Version Requirements:**
   - Windows 10 Pro, Enterprise, or Education (64-bit)
   - OR Windows Server 2016 or later
   - Windows 10 Home does NOT support Windows containers

2. **System Requirements:**
   - Hyper-V enabled (usually automatic on Pro/Enterprise)
   - At least 4GB free disk space (Windows base images are large)
   - Docker Desktop installed

## Step-by-Step Setup

### 1. Verify Windows Version

```powershell
# Check Windows edition
systeminfo | findstr /B /C:"OS Name" /C:"OS Version"

# Or use PowerShell
Get-ComputerInfo | Select-Object WindowsProductName, WindowsVersion
```

### 2. Enable Hyper-V (if not already enabled)

**For Windows 10 Pro/Enterprise:**
```powershell
# Run PowerShell as Administrator
Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V -All
```

**For Windows 10 Home:**
- Windows containers are NOT supported
- Consider using WSL2 with Linux containers instead

### 3. Install Docker Desktop

1. Download from: https://www.docker.com/products/docker-desktop
2. Install Docker Desktop
3. Start Docker Desktop

### 4. Switch to Windows Containers

**Method 1: Using Docker Desktop UI**
1. Right-click Docker Desktop icon in system tray
2. Select "Switch to Windows containers..."
3. Wait for Docker to restart (may take 1-2 minutes)

**Method 2: Using Command Line**
```powershell
# Switch to Windows containers
& "C:\Program Files\Docker\Docker\DockerCli.exe" -SwitchDaemon
```

### 5. Verify Windows Container Mode

```powershell
docker version
```

**Expected Output:**
```
Client:
 Version:           24.x.x
 API version:       1.43
 ...
 OS/Arch:           windows/amd64    ← Should show "windows"

Server:
 ...
 OS/Arch:           windows/amd64    ← Should show "windows"
```

### 6. Test Windows Container

```powershell
# Pull a small Windows base image to test
docker pull mcr.microsoft.com/windows/servercore:ltsc2019

# Run a test container
docker run --rm mcr.microsoft.com/windows/servercore:ltsc2019 cmd /c echo "Windows containers working!"
```

## Building Your Application

Once Windows containers are enabled:

```powershell
# Navigate to backend directory
cd backend

# Build the Windows Docker image
docker build -f Dockerfile.windows -t sunbaby-backend:latest .

# This will:
# 1. Download Windows Server Core base image (~4GB)
# 2. Install Python 3.11.9
# 3. Install Python dependencies
# 4. Install ODBC Driver 17 for SQL Server
# 5. Copy your application code
```

## Troubleshooting

### "no match for platform in manifest"
- **Cause**: Docker is in Linux container mode
- **Solution**: Switch to Windows containers (see Step 4)

### "Windows containers are not supported"
- **Cause**: Using Windows 10 Home or Hyper-V not enabled
- **Solution**: 
  - Upgrade to Windows 10 Pro/Enterprise, OR
  - Use Linux containers with `Dockerfile` instead

### "Hyper-V is not running"
- **Cause**: Hyper-V feature not enabled
- **Solution**: Enable Hyper-V (see Step 2)

### "Insufficient disk space"
- **Cause**: Windows images are large (~4GB+)
- **Solution**: 
  ```powershell
  # Clean up unused Docker resources
  docker system prune -a
  
  # Check disk space
  Get-PSDrive C
  ```

### "ODBC Driver installation failed"
- **Cause**: Network issue or installer download failed
- **Solution**: 
  - Check internet connection
  - Verify you can access: https://go.microsoft.com/fwlink/?linkid=2249004
  - Try building again

### Build takes too long
- **Normal**: First build downloads ~4GB base image (15-30 minutes depending on internet)
- Subsequent builds are faster (only rebuild changed layers)

## Verifying ODBC Installation

After building, you can verify ODBC Driver is installed:

```powershell
# Run a container interactively
docker run -it sunbaby-backend:latest powershell

# Inside the container, check ODBC drivers
Get-OdbcDriver | Where-Object { $_.Name -like '*SQL Server*' }

# Should show:
# Name                                    Platform
# ----                                    --------
# ODBC Driver 17 for SQL Server          {x64}
```

## Switching Back to Linux Containers

If you need to switch back to Linux containers:

```powershell
# Right-click Docker Desktop → "Switch to Linux containers..."
# OR
& "C:\Program Files\Docker\Docker\DockerCli.exe" -SwitchDaemon
```

## Performance Tips

1. **Use BuildKit** (faster builds):
   ```powershell
   $env:DOCKER_BUILDKIT=1
   docker build -f Dockerfile.windows -t sunbaby-backend:latest .
   ```

2. **Use .dockerignore** to exclude unnecessary files:
   ```
   venv/
   __pycache__/
   *.pyc
   .git/
   ```

3. **Layer caching**: Order Dockerfile commands from least to most frequently changed

## Next Steps

After building successfully:
1. Tag the image for ECR
2. Push to AWS ECR
3. Deploy to ECS Fargate

See `DEPLOY_NOW.md` for deployment instructions.

