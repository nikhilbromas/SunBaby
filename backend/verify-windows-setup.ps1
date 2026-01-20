# Verify Windows Server Setup for SunBaby Backend Deployment
# Run this script to check if your Windows Server is ready for deployment

Write-Host "=== Windows Server Setup Verification ===" -ForegroundColor Green
Write-Host "Checking prerequisites for SunBaby Backend deployment...`n" -ForegroundColor Cyan

$allChecksPassed = $true

# Check 1: Administrator privileges
Write-Host "[1/7] Checking Administrator privileges..." -ForegroundColor Yellow
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if ($isAdmin) {
    Write-Host "  ✓ Running as Administrator" -ForegroundColor Green
} else {
    Write-Host "  ✗ Not running as Administrator" -ForegroundColor Red
    Write-Host "    Please run PowerShell as Administrator" -ForegroundColor Yellow
    $allChecksPassed = $false
}

# Check 2: Windows Version
Write-Host "`n[2/7] Checking Windows version..." -ForegroundColor Yellow
$osInfo = Get-ComputerInfo | Select-Object WindowsProductName, WindowsVersion
Write-Host "  OS: $($osInfo.WindowsProductName)" -ForegroundColor Cyan
Write-Host "  Version: $($osInfo.WindowsVersion)" -ForegroundColor Cyan

if ($osInfo.WindowsProductName -like "*Server 2019*" -or 
    $osInfo.WindowsProductName -like "*Server 2022*" -or
    $osInfo.WindowsProductName -like "*Server 2025*" -or
    $osInfo.WindowsProductName -like "*Windows 10*" -or
    $osInfo.WindowsProductName -like "*Windows 11*") {
    Write-Host "  ✓ Windows version is compatible" -ForegroundColor Green
    
    # Detect Windows Server version and suggest correct Dockerfile
    if ($osInfo.WindowsProductName -like "*Server 2025*") {
        Write-Host "  → Detected Windows Server 2025 - Use deploy-ec2-windows2025.ps1" -ForegroundColor Cyan
    } elseif ($osInfo.WindowsProductName -like "*Server 2019*" -or $osInfo.WindowsProductName -like "*Server 2022*") {
        Write-Host "  → Detected Windows Server 2019/2022 - Use deploy-ec2-windows.ps1" -ForegroundColor Cyan
    }
} else {
    Write-Host "  ⚠ Windows version may not be fully compatible" -ForegroundColor Yellow
    Write-Host "    Recommended: Windows Server 2019, 2022, or 2025" -ForegroundColor Yellow
}

# Check 3: Docker installation
Write-Host "`n[3/7] Checking Docker installation..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Docker is installed: $dockerVersion" -ForegroundColor Green
        
        # Check if Windows containers
        $dockerInfo = docker version 2>&1
        if ($dockerInfo -match "OS/Arch:\s+windows/amd64") {
            Write-Host "  ✓ Windows containers mode detected" -ForegroundColor Green
        } else {
            Write-Host "  ⚠ Windows containers mode not detected" -ForegroundColor Yellow
            Write-Host "    Make sure Docker is configured for Windows containers" -ForegroundColor Yellow
        }
    } else {
        throw "Docker command failed"
    }
} catch {
    Write-Host "  ✗ Docker is not installed or not accessible" -ForegroundColor Red
    Write-Host "    Run: .\install-docker-ee.ps1" -ForegroundColor Yellow
    $allChecksPassed = $false
}

# Check 4: Docker service status
Write-Host "`n[4/7] Checking Docker service..." -ForegroundColor Yellow
$dockerService = Get-Service -Name "Docker" -ErrorAction SilentlyContinue
if ($dockerService) {
    if ($dockerService.Status -eq "Running") {
        Write-Host "  ✓ Docker service is running" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Docker service is not running (Status: $($dockerService.Status))" -ForegroundColor Red
        Write-Host "    Run: Start-Service Docker" -ForegroundColor Yellow
        $allChecksPassed = $false
    }
} else {
    Write-Host "  ✗ Docker service not found" -ForegroundColor Red
    Write-Host "    Run: .\install-docker-ee.ps1" -ForegroundColor Yellow
    $allChecksPassed = $false
}

# Check 5: Required files
Write-Host "`n[5/7] Checking required files..." -ForegroundColor Yellow
$requiredFiles = @(
    "requirements.txt",
    "app\main.py"
)

# Check for deployment scripts
$deploymentScripts = @()
if (Test-Path "deploy-ec2-windows.ps1") {
    $deploymentScripts += "deploy-ec2-windows.ps1 (for Windows Server 2019/2022)"
}
if (Test-Path "deploy-ec2-windows2025.ps1") {
    $deploymentScripts += "deploy-ec2-windows2025.ps1 (for Windows Server 2025)"
}

# Check for Dockerfiles
$dockerfiles = @()
if (Test-Path "Dockerfile.windows") {
    $dockerfiles += "Dockerfile.windows (for Windows Server 2019/2022)"
}
if (Test-Path "Dockerfile.windows2025") {
    $dockerfiles += "Dockerfile.windows2025 (for Windows Server 2025)"
}

$filesMissing = @()
foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "  ✓ Found: $file" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Missing: $file" -ForegroundColor Red
        $filesMissing += $file
        $allChecksPassed = $false
    }
}

# Check deployment scripts
if ($deploymentScripts.Count -gt 0) {
    Write-Host "`n  Deployment scripts found:" -ForegroundColor Cyan
    foreach ($script in $deploymentScripts) {
        Write-Host "    ✓ $script" -ForegroundColor Green
    }
} else {
    Write-Host "  ⚠ No deployment scripts found" -ForegroundColor Yellow
}

# Check Dockerfiles
if ($dockerfiles.Count -gt 0) {
    Write-Host "`n  Dockerfiles found:" -ForegroundColor Cyan
    foreach ($dockerfile in $dockerfiles) {
        Write-Host "    ✓ $dockerfile" -ForegroundColor Green
    }
} else {
    Write-Host "  ✗ No Dockerfiles found" -ForegroundColor Red
    $allChecksPassed = $false
}

# Check 6: Disk space
Write-Host "`n[6/7] Checking disk space..." -ForegroundColor Yellow
$drive = Get-PSDrive C
$freeSpaceGB = [math]::Round($drive.Free / 1GB, 2)
$totalSpaceGB = [math]::Round($drive.Used / 1GB + $freeSpaceGB, 2)

Write-Host "  Free space: $freeSpaceGB GB / $totalSpaceGB GB" -ForegroundColor Cyan

if ($freeSpaceGB -ge 10) {
    Write-Host "  ✓ Sufficient disk space available" -ForegroundColor Green
} elseif ($freeSpaceGB -ge 5) {
    Write-Host "  ⚠ Low disk space (recommended: 10+ GB)" -ForegroundColor Yellow
    Write-Host "    Windows base images are ~4-5 GB" -ForegroundColor Yellow
} else {
    Write-Host "  ✗ Insufficient disk space" -ForegroundColor Red
    Write-Host "    Need at least 10 GB free for Docker images" -ForegroundColor Yellow
    $allChecksPassed = $false
}

# Check 7: Port availability
Write-Host "`n[7/7] Checking port 8000 availability..." -ForegroundColor Yellow
$portInUse = netstat -ano | findstr ":8000"
if ($portInUse) {
    Write-Host "  ⚠ Port 8000 is already in use" -ForegroundColor Yellow
    Write-Host "    You may need to stop the existing service or use a different port" -ForegroundColor Yellow
    Write-Host "    Run: netstat -ano | findstr :8000" -ForegroundColor Cyan
} else {
    Write-Host "  ✓ Port 8000 is available" -ForegroundColor Green
}

# Check 8: Internet connectivity (optional)
Write-Host "`n[8/8] Checking internet connectivity..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "https://www.microsoft.com" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    Write-Host "  ✓ Internet connection available" -ForegroundColor Green
} catch {
    Write-Host "  ⚠ Cannot verify internet connectivity" -ForegroundColor Yellow
    Write-Host "    Docker build requires internet to download base images" -ForegroundColor Yellow
}

# Summary
Write-Host "`n=== Verification Summary ===" -ForegroundColor Green
if ($allChecksPassed) {
    Write-Host "✓ All critical checks passed!" -ForegroundColor Green
    Write-Host "`nYou can proceed with deployment:" -ForegroundColor Cyan
    
    # Suggest correct script based on Windows version
    if ($osInfo.WindowsProductName -like "*Server 2025*") {
        Write-Host "  .\deploy-ec2-windows2025.ps1  (for Windows Server 2025)" -ForegroundColor White
    } else {
        Write-Host "  .\deploy-ec2-windows.ps1  (for Windows Server 2019/2022)" -ForegroundColor White
        if (Test-Path "deploy-ec2-windows2025.ps1") {
            Write-Host "  .\deploy-ec2-windows2025.ps1  (for Windows Server 2025)" -ForegroundColor White
        }
    }
} else {
    Write-Host "✗ Some checks failed. Please fix the issues above before deploying." -ForegroundColor Red
    Write-Host "`nCommon fixes:" -ForegroundColor Yellow
    Write-Host "  1. Run PowerShell as Administrator" -ForegroundColor White
    Write-Host "  2. Install Docker: .\install-docker-ee.ps1" -ForegroundColor White
    Write-Host "  3. Start Docker service: Start-Service Docker" -ForegroundColor White
    Write-Host "  4. Ensure all required files are present" -ForegroundColor White
}

Write-Host "`nFor detailed instructions, see: WINDOWS_SERVER_DEPLOYMENT_GUIDE.md" -ForegroundColor Cyan

