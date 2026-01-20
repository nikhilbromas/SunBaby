# Windows Server Deployment - Step-by-Step Guide

Complete guide to deploy SunBaby Backend on Windows Server 2019, 2022, or 2025 EC2 instance.

## Supported Windows Server Versions

- ✅ **Windows Server 2019** (LTSC 2019) - Use `Dockerfile.windows` and `deploy-ec2-windows.ps1`
- ✅ **Windows Server 2022** (LTSC 2022) - Use `Dockerfile.windows` and `deploy-ec2-windows.ps1`
- ✅ **Windows Server 2025** (LTSC 2025) - Use `Dockerfile.windows2025` and `deploy-ec2-windows2025.ps1`

## Quick Start Checklist

- [ ] Launch Windows Server EC2 instance (2019/2022/2025)
- [ ] Configure security group (RDP 3389, App 8000)
- [ ] Connect via RDP
- [ ] Install Docker Enterprise Edition
- [ ] Copy application files to server
- [ ] Run deployment script (choose based on Windows Server version)
- [ ] Verify deployment
- [ ] Test API endpoints

---

## Prerequisites

### 1. AWS Account Setup
- AWS account with EC2 access
- AWS CLI configured (optional, for CLI-based setup)

### 2. EC2 Instance Requirements
- **OS**: 
  - Windows Server 2019 Base or Windows Server 2019 with Containers
  - Windows Server 2022 Base or Windows Server 2022 with Containers
  - Windows Server 2025 Base or Windows Server 2025 with Containers
- **Instance Type**: Minimum t3.medium (2 vCPU, 4 GB RAM)
- **Recommended**: t3.large (2 vCPU, 8 GB RAM) or larger
- **Storage**: Minimum 30 GB (Windows images are ~4-5 GB)
- **Network**: Public IP or Elastic IP

### 3. Security Group Configuration
Allow inbound traffic:
- **Port 3389** (RDP) - From your IP only (recommended)
- **Port 8000** (Application) - From 0.0.0.0/0 or specific IPs

---

## Step 1: Launch EC2 Instance

### Option A: Using AWS Console

1. **Navigate to EC2 Console**
   - Go to AWS Console → EC2 → Launch Instance

2. **Configure Instance**
   - **Name**: `sunbaby-backend-windows`
   - **AMI**: 
     - For Windows Server 2019: Search for "Windows Server 2019 Base" or "Windows Server 2019 with Containers"
     - For Windows Server 2022: Search for "Windows Server 2022 Base" or "Windows Server 2022 with Containers"
     - For Windows Server 2025: Search for "Windows Server 2025 Base" or "Windows Server 2025 with Containers"
   - **Instance Type**: Select `t3.medium` or larger
   - **Key Pair**: Create new or select existing (for RDP access)

3. **Network Settings**
   - Create new security group or use existing
   - **Inbound Rules**:
     - Type: RDP, Port: 3389, Source: Your IP
     - Type: Custom TCP, Port: 8000, Source: 0.0.0.0/0

4. **Storage**
   - Root volume: 30 GB minimum

5. **Launch Instance**
   - Click "Launch Instance"
   - Wait for instance to be in "Running" state

### Option B: Using AWS CLI

```powershell
# Set your variables
$region = "ap-south-1"
$keyName = "your-key-name"
$securityGroupId = "sg-xxxxx"  # Create security group first

# Find Windows Server AMI (choose one based on version)
# For Windows Server 2019:
aws ec2 describe-images `
    --owners amazon `
    --filters "Name=name,Values=Windows_Server-2019-English-Full-Base*" "Name=architecture,Values=x86_64" `
    --query 'Images | sort_by(@, &CreationDate) | [-1].[ImageId,Name]' `
    --output table `
    --region $region

# For Windows Server 2022:
aws ec2 describe-images `
    --owners amazon `
    --filters "Name=name,Values=Windows_Server-2022-English-Full-Base*" "Name=architecture,Values=x86_64" `
    --query 'Images | sort_by(@, &CreationDate) | [-1].[ImageId,Name]' `
    --output table `
    --region $region

# For Windows Server 2025:
aws ec2 describe-images `
    --owners amazon `
    --filters "Name=name,Values=Windows_Server-2025-English-Full-Base*" "Name=architecture,Values=x86_64" `
    --query 'Images | sort_by(@, &CreationDate) | [-1].[ImageId,Name]' `
    --output table `
    --region $region

# Launch instance (replace ami-xxxxx with actual AMI ID)
aws ec2 run-instances `
    --image-id ami-xxxxx `
    --instance-type t3.medium `
    --key-name $keyName `
    --security-group-ids $securityGroupId `
    --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":30}}]' `
    --region $region
```

---

## Step 2: Get Administrator Password

1. **In EC2 Console**
   - Select your instance
   - Click **Actions** → **Security** → **Get Windows Password**

2. **Decrypt Password**
   - Upload your `.pem` key file
   - Click "Decrypt Password"
   - **Save the password** - you'll need it for RDP

---

## Step 3: Connect via RDP

1. **Get Public IP**
   - In EC2 Console → Instance details → Public IPv4 address

2. **Connect via Remote Desktop**
   - **Windows**: Press `Win + R`, type `mstsc`, press Enter
   - **Mac**: Use Microsoft Remote Desktop app
   - **Linux**: Use Remmina or rdesktop

3. **RDP Connection Details**
   - **Computer**: `<public-ip>`
   - **Username**: `Administrator`
   - **Password**: (the decrypted password from Step 2)

4. **Accept Certificate Warning**
   - Click "Yes" if prompted about certificate

---

## Step 4: Prepare Server

### 4.1 Open PowerShell as Administrator

1. Right-click **Start** button
2. Select **Windows PowerShell (Admin)** or **Terminal (Admin)**
3. Click "Yes" on UAC prompt

### 4.2 Set Execution Policy

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Type `Y` when prompted.

### 4.3 Create Application Directory

```powershell
# Create directory for application
New-Item -ItemType Directory -Path "C:\SunBaby\backend" -Force

# Navigate to it
cd C:\SunBaby\backend
```

---

## Step 5: Copy Application Files

You need to copy these files to the EC2 instance:

### Required Files:
- `Dockerfile.windows`
- `requirements.txt`
- `deploy-ec2-windows.ps1`
- `install-docker-ee.ps1`
- `app/` directory (entire folder)
- Any other application files

### Methods to Copy Files:

#### Method 1: Using WinSCP (Recommended for Windows)
1. Download WinSCP: https://winscp.net/
2. Connect to EC2 instance using RDP credentials
3. Copy files to `C:\SunBaby\backend`

#### Method 2: Using Git (If repository is accessible)
```powershell
# Install Git (if not installed)
# Download from: https://git-scm.com/download/win

# Clone repository
cd C:\SunBaby
git clone <your-repository-url> .
cd backend
```

#### Method 3: Using AWS Systems Manager Session Manager
```powershell
# From your local machine with AWS CLI
aws ssm start-session --target <instance-id> --region ap-south-1
# Then use PowerShell commands to copy files
```

#### Method 4: Using SCP (from Linux/Mac)
```bash
scp -r backend/ Administrator@<public-ip>:C:/SunBaby/
```

---

## Step 6: Install Docker Enterprise Edition

### 6.1 Run Installation Script

```powershell
# Navigate to backend directory
cd C:\SunBaby\back\SunBaby\backend

# Run Docker installation script
.\install-docker-ee.ps1
```

**This will:**
- Install Containers Windows feature
- Download and install Docker Engine
- Register Docker as a Windows service
- Start Docker service

**Note**: Installation may take 5-10 minutes.

### 6.2 Restart Server

```powershell
# Restart to ensure all changes take effect
Restart-Computer
```

**Wait for server to restart**, then reconnect via RDP.

### 6.3 Verify Docker Installation

After reconnecting:

```powershell
# Check Docker version
docker version

# Check Docker info
docker info

# Test with a Windows container
docker run mcr.microsoft.com/windows/servercore:ltsc2019 cmd /c echo "Hello from Windows Container"
```

**Expected Output:**
- Docker version should display
- `OS/Arch: windows/amd64` should appear
- Test container should print "Hello from Windows Container"

**If Docker doesn't work:**
```powershell
# Check service status
Get-Service Docker

# Start service if stopped
Start-Service Docker

# Check service logs
Get-EventLog -LogName Application -Source Docker -Newest 20
```

---

## Step 7: Deploy Application

### 7.1 Navigate to Backend Directory

```powershell
cd C:\SunBaby\backend
```

### 7.2 Verify Required Files

```powershell
# Check for required files
Test-Path requirements.txt
Test-Path app\main.py

# Check for deployment scripts (choose based on Windows Server version)
Test-Path deploy-ec2-windows.ps1      # For Windows Server 2019/2022
Test-Path deploy-ec2-windows2025.ps1   # For Windows Server 2025

# Check for Dockerfiles (choose based on Windows Server version)
Test-Path Dockerfile.windows          # For Windows Server 2019/2022
Test-Path Dockerfile.windows2025      # For Windows Server 2025
```

All required files should return `True`. You need either the 2019/2022 or 2025 versions, not both.

### 7.3 Run Deployment Script

**Choose the correct script based on your Windows Server version:**

#### For Windows Server 2019 or 2022:

##### Option A: Use Default Configuration

```powershell
.\deploy-ec2-windows.ps1
```

This uses default values:
- Database: `13.234.194.76\devtest,1435`
- Database Name: `fiesauthentication`
- Port: `8000`

##### Option B: Custom Configuration

```powershell
.\deploy-ec2-windows.ps1 `
    -ImageName "sunbaby-backend" `
    -ImageTag "v1.0" `
    -Port 8000 `
    -DbServer "your-server\instance,1435" `
    -DbName "your-database" `
    -DbUser "sa" `
    -DbPassword "your-password"
```

#### For Windows Server 2025:

##### Option A: Use Default Configuration

```powershell
.\deploy-ec2-windows2025.ps1
```

##### Option B: Custom Configuration

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

**Note**: Windows Server 2025 uses `Dockerfile.windows2025` which uses the `ltsc2025` base image.

### 7.4 What Happens During Deployment

The script will:
1. ✅ Check Docker installation
2. ✅ Check Docker service status
3. ✅ Stop and remove existing container (if any)
4. ✅ Verify Dockerfile and requirements.txt exist
5. ✅ **Build Docker image** (10-20 minutes first time)
   - Downloads Windows Server Core base image (~4 GB)
   - Installs Python 3.10.11
   - Installs Python dependencies
   - Installs ODBC Driver 17 for SQL Server
   - Copies application code
6. ✅ Start container with environment variables
7. ✅ Display container status and logs
8. ✅ Show access information

**First build will take 15-30 minutes** (downloading base image).

---

## Step 8: Verify Deployment

### 8.1 Check Container Status

```powershell
# List running containers
docker ps

# Should show:
# CONTAINER ID   IMAGE                    STATUS         PORTS
# xxxxx          sunbaby-backend:latest   Up X minutes   0.0.0.0:8000->8000/tcp
```

### 8.2 View Container Logs

```powershell
# View logs
docker logs sunbaby-backend

# Follow logs in real-time
docker logs -f sunbaby-backend

# Last 50 lines
docker logs --tail 50 sunbaby-backend
```

**Look for:**
- `Application startup complete`
- `Uvicorn running on http://0.0.0.0:8000`
- No error messages

### 8.3 Get Public IP

```powershell
# On EC2 instance
(Invoke-WebRequest -Uri "http://169.254.169.254/latest/meta-data/public-ipv4" -UseBasicParsing).Content

# Or check EC2 Console → Instance → Public IPv4 address
```

### 8.4 Test API Endpoints

#### Test Health Endpoint
```powershell
# From EC2 instance
Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing

# From your local machine (replace with public IP)
Invoke-WebRequest -Uri "http://<public-ip>:8000/health" -UseBasicParsing
```

**Expected Response:**
```json
{"status": "healthy"}
```

#### Test Root Endpoint
```powershell
Invoke-WebRequest -Uri "http://<public-ip>:8000/" -UseBasicParsing
```

#### Test API Documentation
Open in browser:
```
http://<public-ip>:8000/docs
```

Should show FastAPI Swagger UI.

---

## Step 9: Common Operations

### View Logs
```powershell
docker logs -f sunbaby-backend
```

### Stop Container
```powershell
docker stop sunbaby-backend
```

### Start Container
```powershell
docker start sunbaby-backend
```

### Restart Container
```powershell
docker restart sunbaby-backend
```

### Update Application

1. **Pull latest code** (if using Git):
   ```powershell
   cd C:\SunBaby\backend
   git pull
   ```

2. **Redeploy**:
   
   **For Windows Server 2019/2022:**
   ```powershell
   .\deploy-ec2-windows.ps1
   ```
   
   **For Windows Server 2025:**
   ```powershell
   .\deploy-ec2-windows2025.ps1
   ```
   
   Or manually:
   ```powershell
   docker stop sunbaby-backend
   docker rm sunbaby-backend
   # For 2019/2022:
   docker build -f Dockerfile.windows -t sunbaby-backend:latest .
   # For 2025:
   docker build -f Dockerfile.windows2025 -t sunbaby-backend:latest .
   docker run -d --name sunbaby-backend -p 8000:8000 -e DB_SERVER="..." sunbaby-backend:latest
   ```

### Execute Commands in Container
```powershell
# Open PowerShell in container
docker exec -it sunbaby-backend powershell

# Run a command
docker exec sunbaby-backend python --version
docker exec sunbaby-backend python -m pip list
```

### Check Environment Variables
```powershell
docker exec sunbaby-backend powershell -Command "Get-ChildItem Env: | Where-Object { $_.Name -like 'DB_*' }"
```

---

## Troubleshooting

### Issue: Docker Service Not Running

**Symptoms:**
- `docker: command not found`
- `Cannot connect to Docker daemon`

**Solution:**
```powershell
# Check service status
Get-Service Docker

# Start service
Start-Service Docker

# If service doesn't exist, reinstall Docker
.\install-docker-ee.ps1
```

### Issue: Container Won't Start

**Symptoms:**
- Container exits immediately
- `docker ps -a` shows exited container

**Solution:**
```powershell
# Check logs
docker logs sunbaby-backend

# Check container status
docker ps -a

# Try running interactively to see errors
docker run -it --rm sunbaby-backend:latest powershell
```

### Issue: Port Already in Use

**Symptoms:**
- `Error: bind: address already in use`
- Port 8000 is occupied

**Solution:**
```powershell
# Find what's using port 8000
netstat -ano | findstr :8000

# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F

# Or change port in deployment script
.\deploy-ec2-windows.ps1 -Port 8001
```

### Issue: Database Connection Failed

**Symptoms:**
- Container starts but API returns database errors
- Logs show connection timeout

**Solution:**
```powershell
# Test database connectivity from EC2
Test-NetConnection -ComputerName "13.234.194.76" -Port 1435

# Check firewall rules on SQL Server
# Verify connection string in container
docker exec sunbaby-backend powershell -Command "Get-ChildItem Env: | Where-Object { $_.Name -like 'DB_*' }"
```

### Issue: Build Fails - ODBC Driver Installation

**Symptoms:**
- Build fails during ODBC Driver installation
- Error: "ODBC Driver installation failed"

**Solution:**
```powershell
# Check internet connection
Test-NetConnection -ComputerName "go.microsoft.com" -Port 443

# Try building again (may be temporary network issue)
docker build -f Dockerfile.windows -t sunbaby-backend:latest .
```

### Issue: Out of Disk Space

**Symptoms:**
- Build fails with "no space left on device"
- Docker commands fail

**Solution:**
```powershell
# Clean up Docker
docker system prune -a

# Check disk space
Get-PSDrive C

# Remove unused images
docker image prune -a
```

### Issue: Cannot Access API from Browser

**Symptoms:**
- API works on localhost but not from external IP
- Connection timeout

**Solution:**
1. **Check Security Group**:
   - EC2 Console → Security Groups → Inbound Rules
   - Ensure port 8000 is open from 0.0.0.0/0

2. **Check Windows Firewall**:
   ```powershell
   # Allow port 8000 in Windows Firewall
   New-NetFirewallRule -DisplayName "SunBaby Backend" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow
   ```

3. **Check Container Port Mapping**:
   ```powershell
   docker ps
   # Should show: 0.0.0.0:8000->8000/tcp
   ```

---

## Security Best Practices

1. **Restrict RDP Access**
   - Security Group: Only allow port 3389 from your IP
   - Use AWS Systems Manager Session Manager instead of RDP

2. **Database Credentials**
   - Use AWS Secrets Manager or Parameter Store
   - Don't hardcode passwords in scripts

3. **Application Port**
   - Restrict port 8000 to specific IPs if possible
   - Use Application Load Balancer with SSL

4. **Windows Updates**
   - Keep Windows Server updated
   - Enable automatic updates

5. **Firewall Rules**
   - Configure Windows Firewall appropriately
   - Only open necessary ports

---

## Next Steps

After successful deployment:

1. **Set up Monitoring**
   - Configure CloudWatch Logs
   - Set up CloudWatch Alarms

2. **Configure Auto Scaling**
   - Set up Auto Scaling Group if needed
   - Configure health checks

3. **Set up Load Balancer**
   - Create Application Load Balancer
   - Configure SSL certificate
   - Point domain to load balancer

4. **Set up CI/CD**
   - Configure GitHub Actions or AWS CodePipeline
   - Automate deployments

5. **Backup Strategy**
   - Set up EBS snapshots
   - Backup database regularly

---

## Support

If you encounter issues:

1. **Check Container Logs**: `docker logs sunbaby-backend`
2. **Check Windows Event Logs**: Event Viewer → Windows Logs → Application
3. **Verify Docker Service**: `Get-Service Docker`
4. **Test Database Connectivity**: `Test-NetConnection`
5. **Review Deployment Script Output**: Check for error messages

---

## Quick Reference Commands

```powershell
# Docker Operations
docker ps                          # List running containers
docker ps -a                       # List all containers
docker logs sunbaby-backend        # View logs
docker stop sunbaby-backend        # Stop container
docker start sunbaby-backend       # Start container
docker restart sunbaby-backend     # Restart container
docker exec -it sunbaby-backend powershell  # Shell into container

# Service Operations
Get-Service Docker                 # Check Docker service
Start-Service Docker               # Start Docker service
Stop-Service Docker                # Stop Docker service

# Network Operations
Test-NetConnection -ComputerName <host> -Port <port>  # Test connectivity
netstat -ano | findstr :8000       # Check port usage

# Deployment
.\deploy-ec2-windows.ps1          # Deploy application
.\install-docker-ee.ps1           # Install Docker
```

---

**Deployment Complete!** 🎉

Your API should now be accessible at: `http://<public-ip>:8000`

API Documentation: `http://<public-ip>:8000/docs`

