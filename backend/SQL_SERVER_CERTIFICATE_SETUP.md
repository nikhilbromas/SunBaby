# SQL Server 2014 Certificate Setup Guide

This guide walks you through setting up a certificate for SQL Server 2014 to enable encrypted connections.

## Prerequisites

- **SQL Server 2014** must be patched to **SP1 or later** (ideally SP3) for TLS 1.2 support
- **SQL Server Configuration Manager** installed
- **Administrator access** on the SQL Server machine
- The **hostname** your application uses to connect (e.g., `sqlserver.company.com` or IP address)

## Option 1: Self-Signed Certificate (Quick Setup - Development/Testing)

### Step 1: Create Self-Signed Certificate

1. **Open PowerShell as Administrator** on the SQL Server machine

2. **Run this command** (replace `YOUR_HOSTNAME` with your actual server hostname or FQDN):

```powershell
$cert = New-SelfSignedCertificate `
    -Subject "CN=YOUR_HOSTNAME" `
    -DnsName "YOUR_HOSTNAME", "localhost" `
    -KeyAlgorithm RSA `
    -KeyLength 2048 `
    -CertStoreLocation "Cert:\LocalMachine\My" `
    -KeyUsage DigitalSignature, KeyEncipherment `
    -NotAfter (Get-Date).AddYears(1)

# Export the certificate (for client trust)
$pwd = ConvertTo-SecureString -String "YourPassword123!" -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath "C:\temp\sqlserver-cert.pfx" -Password $pwd
Export-Certificate -Cert $cert -FilePath "C:\temp\sqlserver-cert.cer" -Type CERT
```

**Important**: Replace `YOUR_HOSTNAME` with:
- The **exact hostname** your application uses (e.g., `sqlserver.company.com`)
- Or the **IP address** if connecting by IP
- Or `localhost` if testing locally

### Step 2: Install Certificate in SQL Server Store

The certificate is already in `LocalMachine\My` (Personal store), which is what SQL Server needs.

### Step 3: Configure SQL Server to Use the Certificate

1. **Open SQL Server Configuration Manager**
   - Press `Win + R`, type `SQLServerManager12.msc`, press Enter
   - Or find it in Start Menu: `SQL Server 2014 Configuration Tools`

2. **Navigate to**: `SQL Server Network Configuration` → `Protocols for <YourInstance>`
   - Default instance: `Protocols for MSSQLSERVER`
   - Named instance: `Protocols for MSSQLSERVER$INSTANCENAME`

3. **Right-click** on `Protocols for <YourInstance>` → **Properties**

4. Go to **Certificate** tab

5. **Select your certificate** from the dropdown (it should show the subject name)

6. Click **OK**

### Step 4: Enable Force Encryption (Optional but Recommended)

1. Still in **SQL Server Configuration Manager**

2. Go to **Flags** tab

3. Set **Force Encryption** to **Yes** (forces all connections to use encryption)

4. Click **OK**

### Step 5: Restart SQL Server Service

1. In **SQL Server Configuration Manager**, go to `SQL Server Services`

2. **Right-click** on `SQL Server (<YourInstance>)` → **Restart**

   Or use PowerShell:
   ```powershell
   Restart-Service MSSQLSERVER  # For default instance
   # Or for named instance:
   Restart-Service "MSSQL$INSTANCENAME"
   ```

### Step 6: Export Certificate for Client Trust (Linux/Docker)

For your Linux/Docker container to trust the certificate:

1. **Copy the `.cer` file** you exported earlier (`C:\temp\sqlserver-cert.cer`)

2. **On your development machine**, convert it to PEM format (if needed):
   ```bash
   openssl x509 -inform DER -in sqlserver-cert.cer -out sqlserver-cert.pem
   ```

3. **Add to Docker container** (update your Dockerfile):
   ```dockerfile
   COPY sqlserver-cert.pem /usr/local/share/ca-certificates/sqlserver-cert.crt
   RUN update-ca-certificates
   ```

## Option 2: CA-Signed Certificate (Production)

### Step 1: Generate Certificate Signing Request (CSR)

1. **Open PowerShell as Administrator**

2. **Create a certificate request**:

```powershell
$request = @"
[Version]
Signature=`$Windows NT`

[NewRequest]
Subject = "CN=YOUR_HOSTNAME"
KeySpec = 1
KeyLength = 2048
Exportable = TRUE
MachineKeySet = TRUE
SMIME = FALSE
PrivateKeyArchive = FALSE
UserProtected = FALSE
UseExistingKeySet = FALSE
ProviderName = "Microsoft RSA SChannel Cryptographic Provider"
ProviderType = 12
RequestType = PKCS10
KeyUsage = 0xa0
[EnhancedKeyUsageExtension]
OID=1.3.6.1.5.5.7.3.1
"@

$request | Out-File -FilePath "C:\temp\sqlserver-cert.req" -Encoding ASCII
certreq -new "C:\temp\sqlserver-cert.req" "C:\temp\sqlserver-cert.csr"
```

3. **Submit `sqlserver-cert.csr`** to your Certificate Authority (internal CA or public CA)

### Step 2: Install the CA-Signed Certificate

1. **Receive the certificate file** from your CA (usually `.cer` or `.crt`)

2. **Install it**:
   ```powershell
   certreq -accept "path\to\certificate.cer"
   ```

   Or double-click the `.cer` file and install it to **Local Computer** → **Personal** store

### Step 3-6: Same as Option 1

Follow **Steps 3-6** from Option 1 to configure SQL Server and restart the service.

## Verify Certificate Setup

### Test 1: Check Certificate in SQL Server

Run in SSMS:

```sql
SELECT 
    name,
    subject,
    expiry_date,
    pvt_key_encryption_type_desc
FROM sys.certificates
WHERE name LIKE '%SQL%' OR subject LIKE '%YOUR_HOSTNAME%';
```

### Test 2: Check Connection Encryption

```sql
SELECT 
    session_id,
    client_net_address,
    encrypt_option
FROM sys.dm_exec_connections
WHERE session_id = @@SPID;
```

Should show `encrypt_option = TRUE`

### Test 3: Test from Linux/Client

From a machine that can reach SQL Server:

```bash
openssl s_client -connect YOUR_HOSTNAME:1433 -tls1_2
```

Should show:
- `Protocol  : TLSv1.2`
- Certificate details matching your server

## Troubleshooting

### Error: "Certificate not found"

- **Check**: Certificate is in `Local Computer\Personal` store
- **Check**: Certificate subject matches your server hostname
- **Check**: Certificate has **Server Authentication** EKU (1.3.6.1.5.7.3.1)

### Error: "Certificate expired"

- **Check**: Certificate `NotAfter` date is in the future
- **Solution**: Create a new certificate with longer validity

### Error: "TLS handshake failed"

- **Check**: SQL Server 2014 is patched to SP1+ (ideally SP3)
- **Check**: TLS 1.2 is enabled in Windows Registry
- **Check**: SQL Server service was restarted after certificate installation

### Error: "Certificate subject name mismatch"

- **Problem**: Certificate CN doesn't match the hostname your app uses
- **Solution**: Create certificate with CN matching **exactly** what your app connects to

## Update Your Application Connection

After certificate is set up, update your connection string to use encryption:

```python
# In database.py, ensure Encrypt=yes is set
conn_str = (
    f"DRIVER={{{settings.DB_DRIVER}}};"
    f"SERVER={settings.DB_SERVER};"
    f"DATABASE={settings.DB_NAME};"
    f"UID={settings.DB_USER};"
    f"PWD={settings.DB_PASSWORD};"
    f"Encrypt=yes;"
    f"TrustServerCertificate=no;"  # Use proper validation
)
```

For self-signed certificates, you may need `TrustServerCertificate=yes` until you add the cert to the client trust store.

## Next Steps

1. **Patch SQL Server 2014** to SP3 (if not already done)
2. **Create and install certificate** (use Option 1 for quick setup)
3. **Configure SQL Server** to use the certificate
4. **Restart SQL Server service**
5. **Test connection** from your application
6. **Add certificate to Docker container** trust store (for production)

