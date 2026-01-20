# SQL Server 2014 Self-Signed Certificate Creation Script
# Run this script as Administrator on your SQL Server machine

# ============================================
# CONFIGURATION - UPDATE THESE VALUES
# ============================================
# Replace with your actual SQL Server hostname or IP address
# This MUST match what your application uses to connect
$ServerHostname = "YOUR_SERVER_HOSTNAME_OR_IP"  # e.g., "sqlserver.company.com" or "192.168.1.100"

# Certificate validity period (default: 1 year)
$ValidYears = 1

# Export path (will create if doesn't exist)
$ExportPath = "C:\temp"

# ============================================
# SCRIPT EXECUTION
# ============================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "SQL Server Certificate Creation Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

# Validate hostname
if ($ServerHostname -eq "YOUR_SERVER_HOSTNAME_OR_IP") {
    Write-Host "ERROR: Please update `$ServerHostname variable at the top of this script!" -ForegroundColor Red
    Write-Host "Set it to your SQL Server hostname or IP address" -ForegroundColor Yellow
    exit 1
}

# Create export directory if it doesn't exist
if (-not (Test-Path $ExportPath)) {
    New-Item -ItemType Directory -Path $ExportPath -Force | Out-Null
    Write-Host "Created directory: $ExportPath" -ForegroundColor Green
}

Write-Host "Creating self-signed certificate for: $ServerHostname" -ForegroundColor Yellow
Write-Host ""

try {
    # Create the certificate
    $cert = New-SelfSignedCertificate `
        -Subject "CN=$ServerHostname" `
        -DnsName $ServerHostname, "localhost" `
        -KeyAlgorithm RSA `
        -KeyLength 2048 `
        -CertStoreLocation "Cert:\LocalMachine\My" `
        -KeyUsage DigitalSignature, KeyEncipherment `
        -NotAfter (Get-Date).AddYears($ValidYears)
    
    Write-Host "✓ Certificate created successfully!" -ForegroundColor Green
    Write-Host "  Subject: $($cert.Subject)" -ForegroundColor Gray
    Write-Host "  Thumbprint: $($cert.Thumbprint)" -ForegroundColor Gray
    Write-Host "  Valid Until: $($cert.NotAfter)" -ForegroundColor Gray
    Write-Host ""
    
    # Export certificate files
    Write-Host "Exporting certificate files..." -ForegroundColor Yellow
    
    $pwd = ConvertTo-SecureString -String "TempPassword123!" -Force -AsPlainText
    $pfxPath = Join-Path $ExportPath "sqlserver-cert.pfx"
    $cerPath = Join-Path $ExportPath "sqlserver-cert.cer"
    
    Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $pwd | Out-Null
    Export-Certificate -Cert $cert -FilePath $cerPath -Type CERT | Out-Null
    
    Write-Host "✓ Certificate exported!" -ForegroundColor Green
    Write-Host "  PFX: $pfxPath" -ForegroundColor Gray
    Write-Host "  CER: $cerPath" -ForegroundColor Gray
    Write-Host ""
    
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "NEXT STEPS:" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. Open SQL Server Configuration Manager:" -ForegroundColor Yellow
    Write-Host "   - Press Win+R, type: SQLServerManager12.msc" -ForegroundColor White
    Write-Host ""
    Write-Host "2. Navigate to:" -ForegroundColor Yellow
    Write-Host "   SQL Server Network Configuration → Protocols for MSSQLSERVER" -ForegroundColor White
    Write-Host ""
    Write-Host "3. Right-click 'Protocols for MSSQLSERVER' → Properties" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "4. Go to 'Certificate' tab" -ForegroundColor Yellow
    Write-Host "   - Select certificate: $($cert.Subject)" -ForegroundColor White
    Write-Host ""
    Write-Host "5. Go to 'Flags' tab" -ForegroundColor Yellow
    Write-Host "   - Set 'Force Encryption' = Yes" -ForegroundColor White
    Write-Host ""
    Write-Host "6. Click OK and RESTART SQL Server service" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "7. For Docker/Linux clients, copy the .cer file to your container:" -ForegroundColor Yellow
    Write-Host "   $cerPath" -ForegroundColor White
    Write-Host ""
    Write-Host "Certificate Thumbprint (for reference):" -ForegroundColor Cyan
    Write-Host $cert.Thumbprint -ForegroundColor White
    Write-Host ""
    
} catch {
    Write-Host "ERROR: Failed to create certificate" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

