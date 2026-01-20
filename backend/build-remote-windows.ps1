# Build Windows Docker Image on Remote EC2 Instance
# This script helps you build Docker images on a remote Windows Server when you can't build locally
# Usage: .\build-remote-windows.ps1 -EC2IP "13.234.194.76" -EC2User "Administrator"

param(
    [Parameter(Mandatory=$true)]
    [string]$EC2IP,
    
    [Parameter(Mandatory=$true)]
    [string]$EC2User,
    
    [string]$EC2Path = "C:\SunBaby\backend",
    [string]$Dockerfile = "Dockerfile.windows",
    [string]$ImageName = "sunbaby-backend",
    [string]$ImageTag = "latest",
    [switch]$DeployAfterBuild,
    [string]$DbServer = "",
    [string]$DbName = "",
    [string]$DbUser = "",
    [string]$DbPassword = ""
)

Write-Host "=== Remote Windows Docker Build Script ===" -ForegroundColor Green
Write-Host "Building Docker image on remote Windows Server EC2`n" -ForegroundColor Cyan

# Step 1: Get credentials
Write-Host "[1/5] Getting EC2 credentials..." -ForegroundColor Yellow
$credential = Get-Credential -Message "Enter EC2 Windows credentials" -UserName $EC2User
if (-not $credential) {
    Write-Host "ERROR: Credentials required!" -ForegroundColor Red
    exit 1
}

# Step 2: Test connection
Write-Host "`n[2/5] Testing connection to EC2 instance..." -ForegroundColor Yellow
try {
    $session = New-PSSession -ComputerName $EC2IP -Credential $credential -ErrorAction Stop
    Write-Host "Connected successfully to $EC2IP" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Could not connect to EC2 instance: $_" -ForegroundColor Red
    Write-Host "`nTroubleshooting:" -ForegroundColor Yellow
    Write-Host "1. Check Security Group allows WinRM (ports 5985/5986)" -ForegroundColor White
    Write-Host "2. Verify EC2 instance is running" -ForegroundColor White
    Write-Host "3. Check username is correct (usually 'Administrator')" -ForegroundColor White
    Write-Host "4. Enable WinRM on EC2: Enable-PSRemoting -Force" -ForegroundColor White
    exit 1
}

# Step 3: Copy files to EC2
Write-Host "`n[3/5] Copying files to EC2 instance..." -ForegroundColor Yellow
Write-Host "Source: $PWD" -ForegroundColor Cyan
Write-Host "Destination: $EC2Path" -ForegroundColor Cyan

try {
    # Create destination directory on remote
    Invoke-Command -Session $session -ScriptBlock {
        param($path)
        if (-not (Test-Path $path)) {
            New-Item -ItemType Directory -Path $path -Force | Out-Null
        }
    } -ArgumentList $EC2Path
    
    # Copy all backend files
    $copyItems = @(
        "requirements.txt",
        "Dockerfile.windows",
        "Dockerfile.windows2025",
        "app",
        "migrations"
    )
    
    foreach ($item in $copyItems) {
        if (Test-Path $item) {
            Write-Host "Copying $item..." -ForegroundColor Gray
            Copy-Item -Path $item -Destination $EC2Path -ToSession $session -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
    
    Write-Host "Files copied successfully" -ForegroundColor Green
} catch {
    Write-Host "WARNING: Some files may not have copied: $_" -ForegroundColor Yellow
    Write-Host "You may need to copy files manually via RDP" -ForegroundColor Yellow
}

# Step 4: Build Docker image on remote
Write-Host "`n[4/5] Building Docker image on remote EC2..." -ForegroundColor Yellow
Write-Host "This may take 10-20 minutes on first build..." -ForegroundColor Cyan

$buildResult = Invoke-Command -Session $session -ScriptBlock {
    param($path, $dockerfile, $imageName, $imageTag)
    
    Set-Location $path
    
    # Check Docker
    try {
        $dockerVersion = docker --version 2>&1
        if ($LASTEXITCODE -ne 0) {
            return @{Success=$false; Message="Docker not found. Run install-docker-ee.ps1 first."}
        }
    } catch {
        return @{Success=$false; Message="Docker not installed: $_"}
    }
    
    # Check Dockerfile exists
    if (-not (Test-Path $dockerfile)) {
        return @{Success=$false; Message="Dockerfile not found: $dockerfile"}
    }
    
    # Build image
    $fullImageName = "${imageName}:${imageTag}"
    Write-Host "Building $fullImageName using $dockerfile..." -ForegroundColor Cyan
    
    docker build -f $dockerfile -t $fullImageName . 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        return @{Success=$true; Message="Image built successfully: $fullImageName"; ImageName=$fullImageName}
    } else {
        return @{Success=$false; Message="Docker build failed with exit code $LASTEXITCODE"}
    }
} -ArgumentList $EC2Path, $Dockerfile, $ImageName, $ImageTag

if (-not $buildResult.Success) {
    Write-Host "ERROR: $($buildResult.Message)" -ForegroundColor Red
    Remove-PSSession $session
    exit 1
}

Write-Host $buildResult.Message -ForegroundColor Green

# Step 5: Deploy if requested
if ($DeployAfterBuild) {
    Write-Host "`n[5/5] Deploying container..." -ForegroundColor Yellow
    
    if (-not $DbServer -or -not $DbName) {
        Write-Host "WARNING: Database credentials not provided. Skipping deployment." -ForegroundColor Yellow
        Write-Host "Run deployment manually on EC2:" -ForegroundColor Cyan
        Write-Host "  cd $EC2Path" -ForegroundColor White
        Write-Host "  .\deploy-ec2-windows.ps1" -ForegroundColor White
    } else {
        Invoke-Command -Session $session -ScriptBlock {
            param($path, $dbServer, $dbName, $dbUser, $dbPassword)
            
            Set-Location $path
            
            # Stop existing container
            docker stop sunbaby-backend 2>&1 | Out-Null
            docker rm sunbaby-backend 2>&1 | Out-Null
            
            # Run new container
            docker run -d `
                --name sunbaby-backend `
                -p "8000:8000" `
                -e "PORT=8000" `
                -e "DB_SERVER=$dbServer" `
                -e "DB_NAME=$dbName" `
                -e "DB_USER=$dbUser" `
                -e "DB_PASSWORD=$dbPassword" `
                -e "DB_DRIVER=ODBC Driver 17 for SQL Server" `
                --restart unless-stopped `
                sunbaby-backend:latest
            
            Start-Sleep -Seconds 5
            docker ps --filter "name=sunbaby-backend"
        } -ArgumentList $EC2Path, $DbServer, $DbName, $DbUser, $DbPassword
        
        Write-Host "Container deployed successfully" -ForegroundColor Green
    }
} else {
    Write-Host "`n[5/5] Build complete. Image ready on EC2." -ForegroundColor Green
    Write-Host "`nTo deploy, run on EC2:" -ForegroundColor Yellow
    Write-Host "  cd $EC2Path" -ForegroundColor Cyan
    Write-Host "  .\deploy-ec2-windows.ps1" -ForegroundColor Cyan
}

# Cleanup
Remove-PSSession $session

Write-Host "`n=== Remote Build Complete ===" -ForegroundColor Green
Write-Host "`nImage: $($buildResult.ImageName)" -ForegroundColor Cyan
Write-Host "Location: $EC2IP ($EC2Path)" -ForegroundColor Cyan

