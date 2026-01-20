# Deploy SunBaby Backend to Windows Server 2019/2022 EC2
# This script builds and runs the Docker container on the EC2 instance
# Run this script from the backend directory on your EC2 instance
# For Windows Server 2025, use deploy-ec2-windows2025.ps1 instead

param(
    [string]$ImageName = "sunbaby-backend",
    [string]$ImageTag = "latest",
    [string]$ContainerName = "sunbaby-backend",
    [int]$Port = 8000,
    [string]$DbServer = "13.234.194.76\devtest,1435",
    [string]$DbName = "fiesauthentication",
    [string]$DbUser = "sa",
    [string]$DbPassword = "fiessystems@123"
)

Write-Host "=== SunBaby Backend Deployment Script (Windows Server 2019/2022) ===" -ForegroundColor Green
Write-Host "Building and running container on Windows Server 2019/2022 EC2`n" -ForegroundColor Cyan
Write-Host "Note: For Windows Server 2025, use deploy-ec2-windows2025.ps1`n" -ForegroundColor Yellow

# Check if Docker is available
Write-Host "[1/6] Checking Docker installation..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Docker command failed"
    }
    Write-Host "Docker found: $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Docker is not installed or not running!" -ForegroundColor Red
    Write-Host "Please run install-docker-ee.ps1 first, or start the Docker service:" -ForegroundColor Yellow
    Write-Host "  Start-Service Docker" -ForegroundColor Cyan
    exit 1
}

# Check Docker service status
$dockerService = Get-Service -Name "Docker" -ErrorAction SilentlyContinue
if ($dockerService -and $dockerService.Status -ne "Running") {
    Write-Host "Starting Docker service..." -ForegroundColor Yellow
    Start-Service -Name "Docker"
    Start-Sleep -Seconds 5
}

# Check if container is already running
Write-Host "`n[2/6] Checking for existing container..." -ForegroundColor Yellow
$existingContainer = docker ps -a --filter "name=$ContainerName" --format "{{.Names}}" 2>&1
if ($existingContainer -eq $ContainerName) {
    Write-Host "Stopping and removing existing container..." -ForegroundColor Yellow
    docker stop $ContainerName 2>&1 | Out-Null
    docker rm $ContainerName 2>&1 | Out-Null
    Write-Host "Existing container removed" -ForegroundColor Green
}

# Verify Dockerfile exists
Write-Host "`n[3/6] Checking Dockerfile..." -ForegroundColor Yellow
if (-not (Test-Path "Dockerfile.windows")) {
    Write-Host "ERROR: Dockerfile.windows not found!" -ForegroundColor Red
    Write-Host "Please run this script from the backend directory." -ForegroundColor Yellow
    exit 1
}
Write-Host "Dockerfile.windows found" -ForegroundColor Green

# Verify requirements.txt exists
if (-not (Test-Path "requirements.txt")) {
    Write-Host "ERROR: requirements.txt not found!" -ForegroundColor Red
    exit 1
}

# Build Docker image
Write-Host "`n[4/6] Building Docker image..." -ForegroundColor Yellow
Write-Host "This may take 10-20 minutes on first build (downloading base image ~4GB)..." -ForegroundColor Cyan

$fullImageName = "${ImageName}:${ImageTag}"
docker build -f Dockerfile.windows -t $fullImageName .

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Docker build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "Image built successfully: $fullImageName" -ForegroundColor Green

# Run container
Write-Host "`n[5/6] Starting container..." -ForegroundColor Yellow

# Get the public IP or hostname for database connection
$hostname = hostname
Write-Host "Hostname: $hostname" -ForegroundColor Cyan

# Run the container with port mapping and environment variables
$containerId = docker run -d `
    --name $ContainerName `
    -p "${Port}:8000" `
    -e "PORT=8000" `
    -e "DB_SERVER=$DbServer" `
    -e "DB_NAME=$DbName" `
    -e "DB_USER=$DbUser" `
    -e "DB_PASSWORD=$DbPassword" `
    -e "DB_DRIVER=ODBC Driver 17 for SQL Server" `
    -e "DB_ENCRYPT=True" `
    -e "DB_TRUST_SERVER_CERTIFICATE=True" `
    --restart unless-stopped `
    $fullImageName

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to start container!" -ForegroundColor Red
    Write-Host "Container ID output: $containerId" -ForegroundColor Yellow
    exit 1
}

Write-Host "Container started successfully" -ForegroundColor Green
Write-Host "Container ID: $containerId" -ForegroundColor Cyan

# Wait a bit for container to start
Write-Host "`n[6/6] Waiting for container to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Check container status
Write-Host "`n=== Deployment Complete ===" -ForegroundColor Green
Write-Host "`nContainer Status:" -ForegroundColor Yellow
docker ps --filter "name=$ContainerName" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Verify container is running
$containerStatus = docker ps --filter "name=$ContainerName" --format "{{.Status}}" 2>&1
if (-not $containerStatus -or $containerStatus -like "*Exited*") {
    Write-Host "`nWARNING: Container may not be running properly!" -ForegroundColor Red
    Write-Host "Checking container logs for errors..." -ForegroundColor Yellow
    docker logs --tail 50 $ContainerName
    Write-Host "`nPlease check the logs above for errors." -ForegroundColor Yellow
} else {
    Write-Host "Container is running successfully!" -ForegroundColor Green
}

# Get container logs
Write-Host "`nContainer Logs (last 20 lines):" -ForegroundColor Yellow
docker logs --tail 20 $ContainerName

# Get EC2 instance public IP (if available)
Write-Host "`n=== Access Information ===" -ForegroundColor Green
try {
    $publicIP = (Invoke-WebRequest -Uri "http://169.254.169.254/latest/meta-data/public-ipv4" -UseBasicParsing -TimeoutSec 2).Content
    if ($publicIP) {
        Write-Host "Public IP: $publicIP" -ForegroundColor Cyan
        Write-Host "API URL: http://${publicIP}:${Port}" -ForegroundColor Cyan
        Write-Host "API Docs: http://${publicIP}:${Port}/docs" -ForegroundColor Cyan
    }
} catch {
    Write-Host "Could not retrieve public IP automatically." -ForegroundColor Yellow
    Write-Host "Get your EC2 instance public IP from AWS Console." -ForegroundColor Yellow
}

Write-Host "`nUseful Commands:" -ForegroundColor Yellow
Write-Host "  View logs:      docker logs -f $ContainerName" -ForegroundColor White
Write-Host "  Stop container: docker stop $ContainerName" -ForegroundColor White
Write-Host "  Start container: docker start $ContainerName" -ForegroundColor White
Write-Host "  Remove container: docker rm -f $ContainerName" -ForegroundColor White
Write-Host "  Shell into container: docker exec -it $ContainerName powershell" -ForegroundColor White

