# Install Docker Enterprise Edition on Windows Server 2019/2022/2025 EC2
# Run this script as Administrator

# Detect Windows Server version
$osInfo = Get-ComputerInfo | Select-Object WindowsProductName
Write-Host "=== Installing Docker Enterprise Edition ===" -ForegroundColor Green
Write-Host "Detected OS: $($osInfo.WindowsProductName)" -ForegroundColor Cyan

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

# Step 1: Install Containers feature
Write-Host "`n[1/5] Installing Containers Windows feature..." -ForegroundColor Yellow
Install-WindowsFeature -Name Containers
if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne 3010) {
    Write-Host "WARNING: Containers feature installation returned code: $LASTEXITCODE" -ForegroundColor Yellow
}

# Step 2: Install Docker Engine
Write-Host "`n[2/5] Installing Docker Engine..." -ForegroundColor Yellow

# Try multiple Docker versions (newest to older stable versions)
$dockerVersions = @(
    "29.1.5",      # Latest stable
    "27.4.0",      # Recent stable
    "26.1.4",      # Alternative stable
    "25.0.5",      # Fallback stable
    "24.0.7",      # Older stable
    "20.10.24"     # Last 20.10.x version
)

$dockerZip = "$env:TEMP\docker.zip"
$dockerDir = "C:\Program Files\Docker"
$dockerDownloaded = $false

foreach ($version in $dockerVersions) {
    $dockerUrl = "https://download.docker.com/win/static/stable/x86_64/docker-${version}.zip"
    
    try {
        Write-Host "Attempting to download Docker Engine ${version}..." -ForegroundColor Cyan
        Write-Host "URL: $dockerUrl" -ForegroundColor Gray
        
        # Try to download with timeout
        $response = Invoke-WebRequest -Uri $dockerUrl -OutFile $dockerZip -UseBasicParsing -TimeoutSec 30 -ErrorAction Stop
        
        # Verify file was downloaded and has content
        if (Test-Path $dockerZip) {
            $fileSize = (Get-Item $dockerZip).Length
            if ($fileSize -gt 0) {
                Write-Host "Successfully downloaded Docker Engine ${version} (Size: $([math]::Round($fileSize/1MB, 2)) MB)" -ForegroundColor Green
                $dockerDownloaded = $true
                break
            } else {
                Write-Host "Downloaded file is empty, trying next version..." -ForegroundColor Yellow
                Remove-Item $dockerZip -Force -ErrorAction SilentlyContinue
            }
        }
    } catch {
        Write-Host "Failed to download version ${version}: $($_.Exception.Message)" -ForegroundColor Yellow
        if (Test-Path $dockerZip) {
            Remove-Item $dockerZip -Force -ErrorAction SilentlyContinue
        }
        continue
    }
}

if (-not $dockerDownloaded) {
    Write-Host "`nERROR: Failed to download Docker Engine from all attempted versions!" -ForegroundColor Red
    Write-Host "Please check your internet connection and try again." -ForegroundColor Yellow
    Write-Host "`nAlternative: Install Docker Desktop for Windows Server or use Microsoft's install script:" -ForegroundColor Yellow
    Write-Host "  https://learn.microsoft.com/en-us/virtualization/windowscontainers/quick-start/set-up-environment" -ForegroundColor Cyan
    exit 1
}

try {
    # Extract Docker
    Write-Host "`nExtracting Docker..." -ForegroundColor Cyan
    if (Test-Path $dockerDir) {
        Write-Host "Removing existing Docker installation..." -ForegroundColor Yellow
        Remove-Item $dockerDir -Recurse -Force -ErrorAction SilentlyContinue
    }
    New-Item -ItemType Directory -Path $dockerDir -Force | Out-Null
    Expand-Archive -Path $dockerZip -DestinationPath $dockerDir -Force
    
    # Verify extraction
    $dockerdExe = Join-Path $dockerDir "dockerd.exe"
    if (-not (Test-Path $dockerdExe)) {
        throw "dockerd.exe not found after extraction"
    }
    
    # Add Docker to PATH
    Write-Host "Adding Docker to PATH..." -ForegroundColor Cyan
    $dockerPath = "$dockerDir"
    $currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    if ($currentPath -notlike "*$dockerPath*") {
        [Environment]::SetEnvironmentVariable("Path", "$currentPath;$dockerPath", "Machine")
        $env:Path = "$env:Path;$dockerPath"
    }
    
    Write-Host "Docker Engine extracted successfully" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Failed to extract Docker: $_" -ForegroundColor Red
    exit 1
} finally {
    if (Test-Path $dockerZip) {
        Remove-Item $dockerZip -Force -ErrorAction SilentlyContinue
    }
}

# Step 3: Register Docker as a service
Write-Host "`n[3/5] Registering Docker service..." -ForegroundColor Yellow
$dockerExe = Join-Path $dockerDir "docker.exe"
$dockerdExe = Join-Path $dockerDir "dockerd.exe"

if (Test-Path $dockerdExe) {
    # Stop existing Docker service if running
    $dockerService = Get-Service -Name "Docker" -ErrorAction SilentlyContinue
    if ($dockerService) {
        Write-Host "Stopping existing Docker service..." -ForegroundColor Cyan
        Stop-Service -Name "Docker" -Force -ErrorAction SilentlyContinue
        sc.exe delete Docker
        Start-Sleep -Seconds 2
    }
    
    # Register Docker service
    Write-Host "Registering Docker daemon service..." -ForegroundColor Cyan
    & $dockerdExe --register-service
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Docker service registered successfully" -ForegroundColor Green
    } else {
        Write-Host "WARNING: Service registration returned code: $LASTEXITCODE" -ForegroundColor Yellow
    }
} else {
    Write-Host "WARNING: dockerd.exe not found. Docker may not start properly." -ForegroundColor Yellow
}

# Step 4: Start Docker service
Write-Host "`n[4/5] Starting Docker service..." -ForegroundColor Yellow
try {
    Start-Service -Name "Docker"
    Write-Host "Docker service started successfully" -ForegroundColor Green
} catch {
    Write-Host "WARNING: Could not start Docker service: $_" -ForegroundColor Yellow
    Write-Host "You may need to restart the server for Docker to work properly." -ForegroundColor Yellow
}

# Step 5: Verify installation
Write-Host "`n[5/5] Verifying Docker installation..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Refresh PATH
$env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")

try {
    
    # Try to get Docker version
    $dockerExePath = Join-Path $dockerDir "docker.exe"
    if (Test-Path $dockerExePath) {
        $dockerVersion = & $dockerExePath --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Docker version: $dockerVersion" -ForegroundColor Green
        } else {
            Write-Host "WARNING: Docker command failed. Service may need a restart." -ForegroundColor Yellow
            Write-Host "Docker executable found at: $dockerExePath" -ForegroundColor Cyan
        }
    } else {
        Write-Host "WARNING: docker.exe not found at expected location: $dockerExePath" -ForegroundColor Yellow
    }
} catch {
    Write-Host "WARNING: Could not verify Docker installation: $_" -ForegroundColor Yellow
    Write-Host "Docker files should be at: $dockerDir" -ForegroundColor Cyan
}

# Display final instructions
Write-Host "`n=== Installation Complete ===" -ForegroundColor Green
Write-Host "`nNext Steps:" -ForegroundColor Yellow
Write-Host "1. Restart the server to ensure all changes take effect:" -ForegroundColor White
Write-Host "   Restart-Computer" -ForegroundColor Cyan
Write-Host "`n2. After restart, verify Docker is running:" -ForegroundColor White
Write-Host "   docker version" -ForegroundColor Cyan
Write-Host "   docker info" -ForegroundColor Cyan
Write-Host "`n3. Test with a Windows container:" -ForegroundColor White
# Detect Windows Server version for appropriate base image
if ($osInfo.WindowsProductName -like "*Server 2025*") {
    Write-Host "   docker run mcr.microsoft.com/windows/servercore:ltsc2025 cmd /c echo Hello" -ForegroundColor Cyan
} elseif ($osInfo.WindowsProductName -like "*Server 2022*") {
    Write-Host "   docker run mcr.microsoft.com/windows/servercore:ltsc2022 cmd /c echo Hello" -ForegroundColor Cyan
} else {
    Write-Host "   docker run mcr.microsoft.com/windows/servercore:ltsc2019 cmd /c echo Hello" -ForegroundColor Cyan
}

Write-Host "`nNOTE: If Docker commands don't work after restart, you may need to:" -ForegroundColor Yellow
Write-Host "- Manually start the Docker service: Start-Service Docker" -ForegroundColor White
Write-Host "- Check service status: Get-Service Docker" -ForegroundColor White

