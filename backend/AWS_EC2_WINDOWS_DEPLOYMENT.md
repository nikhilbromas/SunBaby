# AWS Windows Server 2019 EC2 Deployment Guide

This guide covers deploying SunBaby Backend to an AWS EC2 Windows Server 2019 instance using Docker Enterprise Edition.

## Architecture

- **Platform**: Windows Server 2019 EC2 Instance
- **Container Engine**: Docker Enterprise Edition
- **Container Base**: Windows Server Core 2019 (LTSC2019)
- **Build Location**: On the EC2 instance itself
- **Run Location**: On the EC2 instance (direct Docker, not ECS)

## Prerequisites

1. **AWS Account** with EC2 access
2. **Windows Server 2019 EC2 Instance**:
   - Minimum: t3.medium (2 vCPU, 4 GB RAM)
   - Recommended: t3.large (2 vCPU, 8 GB RAM) or larger
   - At least 30 GB free disk space (Windows images are large ~4-5GB)
   - Security group allowing:
     - Port 3389 (RDP) from your IP
     - Port 8000 (application) from 0.0.0.0/0 or your IPs

## Step 1: Launch Windows Server 2019 EC2 Instance

### Using AWS Console

1. Go to **EC2 Console** → **Launch Instance**
2. **Name**: `sunbaby-backend-windows`
3. **AMI**: Select "Microsoft Windows Server 2019 Base" or "Windows Server 2019 with Containers"
4. **Instance Type**: t3.medium or larger
5. **Key Pair**: Create or select an existing key pair (for RDP access)
6. **Network Settings**:
   - Create security group or use existing
   - Allow RDP (3389) from your IP
   - Allow HTTP (8000) from 0.0.0.0/0
7. **Storage**: 30+ GB
8. **Launch Instance**

### Using AWS CLI

```powershell
# Create security group
aws ec2 create-security-group `
    --group-name sunbaby-backend-sg `
    --description "Security group for SunBaby Backend Windows EC2" `
    --region ap-south-1

# Note the GroupId from output, then:
# Allow RDP (replace sg-xxxxx with your security group ID)
aws ec2 authorize-security-group-ingress `
    --group-id sg-xxxxx `
    --protocol tcp `
    --port 3389 `
    --cidr 0.0.0.0/0 `
    --region ap-south-1

# Allow application port
aws ec2 authorize-security-group-ingress `
    --group-id sg-xxxxx `
    --protocol tcp `
    --port 8000 `
    --cidr 0.0.0.0/0 `
    --region ap-south-1

# Find Windows Server 2019 AMI
aws ec2 describe-images `
    --owners amazon `
    --filters "Name=name,Values=Windows_Server-2019-English-Full-Base*" "Name=architecture,Values=x86_64" `
    --query 'Images | sort_by(@, &CreationDate) | [-1].[ImageId,Name,CreationDate]' `
    --output table `
    --region ap-south-1

# Launch instance (replace ami-xxxxx and sg-xxxxx)
aws ec2 run-instances `
    --image-id ami-xxxxx `
    --instance-type t3.medium `
    --key-name your-key-name `
    --security-group-ids sg-xxxxx `
    --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":30}}]' `
    --region ap-south-1
```

## Step 2: Connect to EC2 Instance

### Get Administrator Password

1. Go to **EC2 Console** → **Instances** → Select your instance
2. Click **Actions** → **Security** → **Get Windows Password**
3. Upload your key pair (.pem file) and decrypt password
4. Save the password

### Connect via RDP

1. **Get Public IP**: Note the public IP address from the instance details
2. **RDP Connection**:
   - Windows: Use Remote Desktop Connection (mstsc.exe)
   - Enter public IP
   - Username: `Administrator`
   - Password: (the decrypted password from above)

## Step 3: Install Docker Enterprise Edition

### Option A: Using PowerShell Script (Recommended)

1. **Copy the deployment files** to the EC2 instance:
   - `install-docker-ee.ps1`
   - `deploy-ec2-windows.ps1`
   - `Dockerfile.windows`
   - All backend application files

   You can:
   - Use SCP/WinSCP to copy files
   - Use AWS Systems Manager Session Manager
   - Clone from Git repository on the instance
   - Use CloudFormation/User Data script

2. **Open PowerShell as Administrator** on the EC2 instance:
   - Right-click PowerShell → **Run as Administrator**

3. **Run the installation script**:
   ```powershell
   cd C:\path\to\backend
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   .\install-docker-ee.ps1
   ```

4. **Restart the server**:
   ```powershell
   Restart-Computer
   ```

5. **After restart, verify Docker**:
   ```powershell
   docker version
   docker info
   docker run mcr.microsoft.com/windows/servercore:ltsc2019 cmd /c echo "Hello from Windows Container"
   ```

### Option B: Manual Installation

```powershell
# Install Containers feature
Install-WindowsFeature -Name Containers

# Download Docker EE
$dockerUrl = "https://download.docker.com/win/static/stable/x86_64/docker-20.10.26.zip"
Invoke-WebRequest -Uri $dockerUrl -OutFile "$env:TEMP\docker.zip"

# Extract to Program Files
Expand-Archive -Path "$env:TEMP\docker.zip" -DestinationPath "C:\Program Files\Docker" -Force

# Add to PATH
$dockerPath = "C:\Program Files\Docker"
$currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
[Environment]::SetEnvironmentVariable("Path", "$currentPath;$dockerPath", "Machine")

# Register and start Docker service
cd "C:\Program Files\Docker"
.\dockerd.exe --register-service
Start-Service Docker

# Verify
docker version
```

## Step 4: Deploy Application

1. **Navigate to backend directory** on EC2 instance:
   ```powershell
   cd C:\path\to\backend
   ```

2. **Run deployment script**:
   ```powershell
   .\deploy-ec2-windows.ps1
   ```

   Or with custom parameters:
   ```powershell
   .\deploy-ec2-windows.ps1 `
       -ImageName "sunbaby-backend" `
       -ImageTag "v1.0" `
       -Port 8000 `
       -DbServer "13.234.194.76\devtest,1435" `
       -DbName "fiesauthentication" `
       -DbUser "sa" `
       -DbPassword "your-password"
   ```

3. **The script will**:
   - Check Docker installation
   - Build the Docker image (takes 10-20 minutes first time)
   - Stop any existing container
   - Start a new container with proper configuration
   - Display access information

## Step 5: Verify Deployment

1. **Check container status**:
   ```powershell
   docker ps
   ```

2. **View container logs**:
   ```powershell
   docker logs -f sunbaby-backend
   ```

3. **Get EC2 public IP**:
   ```powershell
   # On EC2 instance
   (Invoke-WebRequest -Uri "http://169.254.169.254/latest/meta-data/public-ipv4" -UseBasicParsing).Content
   
   # Or from AWS Console → EC2 → Instances → Your instance → Public IPv4 address
   ```

4. **Test the API**:
   - Open browser: `http://<public-ip>:8000/docs`
   - Or use curl:
     ```powershell
     Invoke-WebRequest -Uri "http://<public-ip>:8000/docs" -UseBasicParsing
     ```

## Container Management

### View Logs
```powershell
# Follow logs in real-time
docker logs -f sunbaby-backend

# Last 50 lines
docker logs --tail 50 sunbaby-backend
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

### Remove Container
```powershell
docker stop sunbaby-backend
docker rm sunbaby-backend
```

### Execute Commands in Container
```powershell
# Open PowerShell in container
docker exec -it sunbaby-backend powershell

# Run a command
docker exec sunbaby-backend python --version
```

### Update Application

To update the application:

1. **Pull latest code** (if using Git):
   ```powershell
   git pull
   ```

2. **Rebuild and redeploy**:
   ```powershell
   .\deploy-ec2-windows.ps1
   ```

   Or manually:
   ```powershell
   docker stop sunbaby-backend
   docker rm sunbaby-backend
   docker build -f Dockerfile.windows -t sunbaby-backend:latest .
   docker run -d --name sunbaby-backend -p 8000:8000 -e DB_SERVER="..." sunbaby-backend:latest
   ```

## Environment Variables

The deployment script sets these environment variables in the container:

- `PORT=8000` - Application port
- `DB_SERVER` - SQL Server address
- `DB_NAME` - Database name
- `DB_USER` - Database username
- `DB_PASSWORD` - Database password
- `DB_DRIVER=ODBC Driver 17 for SQL Server`
- `DB_ENCRYPT=True`
- `DB_TRUST_SERVER_CERTIFICATE=True`

To set custom environment variables, edit `deploy-ec2-windows.ps1` or run docker command manually with `-e` flags.

## Troubleshooting

### Docker Service Not Running

```powershell
# Check service status
Get-Service Docker

# Start service
Start-Service Docker

# Check service logs
Get-EventLog -LogName Application -Source Docker -Newest 20
```

### Container Won't Start

```powershell
# Check container logs
docker logs sunbaby-backend

# Check container status
docker ps -a

# Try running interactively to see errors
docker run -it --rm sunbaby-backend:latest powershell
```

### Port Already in Use

```powershell
# Find what's using port 8000
netstat -ano | findstr :8000

# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F
```

### Database Connection Issues

1. **Verify SQL Server is accessible** from EC2 instance:
   ```powershell
   Test-NetConnection -ComputerName "13.234.194.76" -Port 1435
   ```

2. **Check firewall rules** on SQL Server to allow EC2 instance IP

3. **Verify connection string** in container:
   ```powershell
   docker exec sunbaby-backend powershell -Command "Get-ChildItem Env: | Where-Object { $_.Name -like 'DB_*' }"
   ```

### Build Takes Too Long

- First build downloads ~4GB base image
- Subsequent builds are faster (cached layers)
- Ensure good internet connection on EC2

### Out of Disk Space

```powershell
# Clean up Docker
docker system prune -a

# Check disk space
Get-PSDrive C
```

## Security Considerations

1. **Database Password**: Consider using AWS Systems Manager Parameter Store or Secrets Manager instead of hardcoding passwords
2. **RDP Access**: Restrict security group to your IP only
3. **Application Port**: Consider restricting port 8000 to specific IPs
4. **SSL/TLS**: Use Application Load Balancer with SSL certificate for production
5. **Windows Updates**: Keep Windows Server updated

## Cost Optimization

- **Use Spot Instances** for non-production workloads
- **Stop instance** when not in use (data persisted in EBS)
- **Right-size instance** based on actual usage
- **Use Reserved Instances** for long-term workloads

## Next Steps

- Set up **Auto Scaling** if needed
- Configure **CloudWatch Logs** for container logs
- Set up **Health Checks** and monitoring
- Configure **Application Load Balancer** for high availability
- Implement **CI/CD pipeline** for automated deployments

## Support

For issues:
1. Check container logs: `docker logs sunbaby-backend`
2. Check Windows Event Logs
3. Verify Docker service: `Get-Service Docker`
4. Test database connectivity from EC2

