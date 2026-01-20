# Windows Docker Build Alternatives

Since Windows containers can only be built on Windows machines, here are several alternatives if you can't build locally.

## Option 1: Build on Windows Server EC2 (Recommended) ⭐

Build directly on your Windows Server EC2 instance where you'll deploy.

### Quick Steps:

1. **Connect to your Windows EC2 instance** via RDP or PowerShell Session
2. **Copy your code** to the EC2 instance (or clone from Git)
3. **Run the deployment script** which builds and runs:

```powershell
# On Windows Server 2019/2022
cd backend
.\deploy-ec2-windows.ps1

# On Windows Server 2025
.\deploy-ec2-windows2025.ps1
```

The script will:
- Check Docker installation
- Build the image automatically
- Run the container
- Configure everything

### Using Remote PowerShell (from your local machine):

```powershell
# Connect to EC2 instance
$session = New-PSSession -ComputerName YOUR_EC2_IP -Credential (Get-Credential)

# Copy files to EC2
Copy-Item -Path ".\backend\*" -Destination "C:\SunBaby\backend\" -ToSession $session -Recurse -Force

# Build on remote machine
Invoke-Command -Session $session -ScriptBlock {
    cd C:\SunBaby\backend
    .\deploy-ec2-windows.ps1
}

# Disconnect
Remove-PSSession $session
```

---

## Option 2: GitHub Actions CI/CD (Automated) 🚀

Build automatically on every push using GitHub Actions Windows runners.

### Setup:

1. **Create `.github/workflows/build-windows.yml`**:

```yaml
name: Build Windows Docker Image

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]
  workflow_dispatch:

jobs:
  build:
    runs-on: windows-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v2
    
    - name: Build Windows Docker image
      run: |
        cd backend
        docker build -f Dockerfile.windows -t sunbaby-backend:latest .
    
    - name: Save image as artifact
      run: |
        docker save sunbaby-backend:latest -o sunbaby-backend.tar
    
    - name: Upload Docker image artifact
      uses: actions/upload-artifact@v3
      with:
        name: windows-docker-image
        path: backend/sunbaby-backend.tar
```

2. **Push to GitHub** - builds automatically
3. **Download artifact** from GitHub Actions and load on your Windows Server:

```powershell
# On Windows Server EC2
docker load -i sunbaby-backend.tar
docker run -d -p 8000:8000 sunbaby-backend:latest
```

---

## Option 3: AWS CodeBuild (Cloud Build Service) ☁️

Build Windows containers in AWS CodeBuild.

### Setup:

1. **Create `buildspec.yml`** in backend directory:

```yaml
version: 0.2
phases:
  pre_build:
    commands:
      - echo Logging in to Amazon ECR...
      - aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com
  build:
    commands:
      - echo Build started on `date`
      - echo Building the Docker image...
      - docker build -f Dockerfile.windows -t sunbaby-backend:$IMAGE_TAG .
      - docker tag sunbaby-backend:$IMAGE_TAG $ECR_REPO_URI:$IMAGE_TAG
  post_build:
    commands:
      - echo Build completed on `date`
      - echo Pushing the Docker image...
      - docker push $ECR_REPO_URI:$IMAGE_TAG
```

2. **Create CodeBuild project**:
   - Environment: Windows Server 2019/2022/2025
   - Compute: EC2 or Fargate
   - Buildspec: Use `buildspec.yml`

3. **Push to CodeCommit/GitHub** - CodeBuild builds automatically

---

## Option 4: Azure Container Registry Build (ACR Build) ☁️

Build Windows containers in Azure.

### Setup:

```bash
# Login to Azure
az login

# Create ACR if needed
az acr create --resource-group myResourceGroup --name myregistry --sku Basic

# Build and push in one command
az acr build --registry myregistry --image sunbaby-backend:latest --file backend/Dockerfile.windows backend/
```

---

## Option 5: Manual Build Script (Remote Build Helper)

Use the provided `build-remote-windows.ps1` script to automate remote building.

See the script for details - it handles:
- File transfer to EC2
- Remote Docker build
- Image export/import
- Container deployment

---

## Option 6: Use Linux Container Instead (If Possible) 🐧

If Windows-specific features aren't required, use the Linux Dockerfile:

```bash
# Build Linux container (works on any machine)
docker build -f Dockerfile -t sunbaby-backend:latest .

# Deploy to Linux server or cloud service
```

**Note**: Linux containers can't use Windows ODBC drivers. You'll need to:
- Use Linux ODBC drivers
- Or connect to SQL Server using alternative methods

---

## Comparison Table

| Method | Speed | Cost | Automation | Best For |
|--------|-------|------|------------|----------|
| **EC2 Direct Build** | ⭐⭐⭐ | 💰💰 | Manual | Quick testing |
| **GitHub Actions** | ⭐⭐ | 💰 | ✅ Full | CI/CD pipelines |
| **AWS CodeBuild** | ⭐⭐ | 💰💰💰 | ✅ Full | AWS deployments |
| **Azure ACR Build** | ⭐⭐ | 💰💰 | ✅ Full | Azure deployments |
| **Remote Build Script** | ⭐⭐⭐ | 💰💰 | Semi-auto | Regular deployments |
| **Linux Container** | ⭐⭐⭐⭐ | 💰 | ✅ Full | Cross-platform |

---

## Quick Start: EC2 Remote Build

The fastest way to get started:

```powershell
# 1. Connect to EC2
Enter-PSSession -ComputerName YOUR_EC2_IP -Credential (Get-Credential)

# 2. Clone or copy code
git clone YOUR_REPO_URL
# OR copy files via RDP

# 3. Build and deploy
cd SunBaby/backend
.\deploy-ec2-windows.ps1

# Done! Container is running
```

---

## Troubleshooting

### "Docker not found" on EC2
```powershell
# Install Docker first
.\install-docker-ee.ps1
```

### "Base image download fails"
- Check internet connection on EC2
- Verify Windows Server version matches Dockerfile base image
- Try different Dockerfile (windows vs windows2025)

### "Build takes too long"
- First build downloads ~4GB base image (10-20 min)
- Subsequent builds are faster (2-5 min)
- Use image caching

### "Can't connect to EC2"
- Check Security Group allows RDP (port 3389) or WinRM (port 5985/5986)
- Verify IAM permissions
- Use Session Manager if available

---

## Recommended Workflow

1. **Development**: Use Linux container locally (`Dockerfile`)
2. **Testing**: Build on Windows Server EC2 (`deploy-ec2-windows.ps1`)
3. **Production**: Use GitHub Actions or CodeBuild for automated builds
4. **Deployment**: Pull pre-built image or build on target server

---

## Need Help?

- Check `WINDOWS_SERVER_DEPLOYMENT_GUIDE.md` for detailed EC2 setup
- See `install-docker-ee.ps1` for Docker installation
- Review `deploy-ec2-windows.ps1` for deployment automation

