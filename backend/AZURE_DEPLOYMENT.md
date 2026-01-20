# Azure Deployment Guide for Windows Containers

Azure supports Windows containers through:
- **Azure Container Instances (ACI)** - Simple, serverless containers
- **Azure Container Apps** - Serverless container platform
- **Azure Kubernetes Service (AKS)** - Kubernetes with Windows nodes

## Prerequisites

1. **Azure Account**: Sign up at https://azure.microsoft.com
2. **Azure CLI**: Install from https://docs.microsoft.com/cli/azure/install-azure-cli
3. **Docker Desktop**: With Windows containers enabled (for local testing)

## Option 1: Azure Container Instances (ACI) - Simplest

### Build and Push to Azure Container Registry

```powershell
# Login to Azure
az login

# Create resource group
az group create --name sunbaby-rg --location eastus

# Create Azure Container Registry
az acr create --resource-group sunbaby-rg --name sunbabyregistry --sku Basic

# Login to ACR
az acr login --name sunbabyregistry

# Build and push Windows container
docker build -f Dockerfile.windows -t sunbabyregistry.azurecr.io/sunbaby-backend:latest .
docker push sunbabyregistry.azurecr.io/sunbaby-backend:latest
```

### Deploy to ACI

```powershell
# Deploy container instance
az container create `
  --resource-group sunbaby-rg `
  --name sunbaby-backend `
  --image sunbabyregistry.azurecr.io/sunbaby-backend:latest `
  --os-type Windows `
  --cpu 1 `
  --memory 2 `
  --registry-login-server sunbabyregistry.azurecr.io `
  --registry-username sunbabyregistry `
  --registry-password <your-acr-password> `
  --environment-variables `
    PORT=8000 `
    DB_ENCRYPT=True `
    DB_TRUST_SERVER_CERTIFICATE=True `
    DB_SERVER=your_sql_server `
    DB_NAME=your_database `
    DB_USER=your_username `
    DB_PASSWORD=your_password `
    DB_DRIVER="ODBC Driver 17 for SQL Server" `
  --ports 8000 `
  --ip-address Public
```

### Get Public IP

```powershell
az container show --resource-group sunbaby-rg --name sunbaby-backend --query ipAddress.ip --output tsv
```

## Option 2: Azure Container Apps

### Create Container App Environment

```powershell
# Create Container App environment
az containerapp env create `
  --name sunbaby-env `
  --resource-group sunbaby-rg `
  --location eastus `
  --os-type Windows

# Create Container App
az containerapp create `
  --name sunbaby-backend `
  --resource-group sunbaby-rg `
  --environment sunbaby-env `
  --image sunbabyregistry.azurecr.io/sunbaby-backend:latest `
  --registry-server sunbabyregistry.azurecr.io `
  --registry-username sunbabyregistry `
  --registry-password <your-acr-password> `
  --target-port 8000 `
  --ingress external `
  --cpu 1.0 `
  --memory 2.0Gi `
  --env-vars `
    PORT=8000 `
    DB_ENCRYPT=True `
    DB_TRUST_SERVER_CERTIFICATE=True `
    DB_SERVER=your_sql_server `
    DB_NAME=your_database `
    DB_USER=your_username `
    DB_PASSWORD=your_password `
    DB_DRIVER="ODBC Driver 17 for SQL Server"
```

### Get Application URL

```powershell
az containerapp show --name sunbaby-backend --resource-group sunbaby-rg --query properties.configuration.ingress.fqdn --output tsv
```

## Option 3: Azure Kubernetes Service (AKS) with Windows Nodes

### Create AKS Cluster with Windows Node Pool

```powershell
# Create AKS cluster with Windows node pool
az aks create `
  --resource-group sunbaby-rg `
  --name sunbaby-aks `
  --node-count 1 `
  --enable-addons monitoring `
  --generate-ssh-keys `
  --windows-admin-username azureuser `
  --windows-admin-password <your-password> `
  --vm-set-type VirtualMachineScaleSets `
  --network-plugin azure

# Add Windows node pool
az aks nodepool add `
  --resource-group sunbaby-rg `
  --cluster-name sunbaby-aks `
  --os-type Windows `
  --name winpool `
  --node-count 1 `
  --node-vm-size Standard_D2s_v3

# Get credentials
az aks get-credentials --resource-group sunbaby-rg --name sunbaby-aks
```

### Deploy Using Kubernetes Manifest

Create `k8s-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sunbaby-backend
spec:
  replicas: 1
  selector:
    matchLabels:
      app: sunbaby-backend
  template:
    metadata:
      labels:
        app: sunbaby-backend
    spec:
      nodeSelector:
        kubernetes.io/os: windows
      containers:
      - name: sunbaby-backend
        image: sunbabyregistry.azurecr.io/sunbaby-backend:latest
        ports:
        - containerPort: 8000
        env:
        - name: PORT
          value: "8000"
        - name: DB_ENCRYPT
          value: "True"
        - name: DB_TRUST_SERVER_CERTIFICATE
          value: "True"
        - name: DB_SERVER
          value: "your_sql_server"
        - name: DB_NAME
          value: "your_database"
        - name: DB_USER
          value: "your_username"
        - name: DB_PASSWORD
          value: "your_password"
        - name: DB_DRIVER
          value: "ODBC Driver 17 for SQL Server"
---
apiVersion: v1
kind: Service
metadata:
  name: sunbaby-backend
spec:
  type: LoadBalancer
  ports:
  - port: 80
    targetPort: 8000
  selector:
    app: sunbaby-backend
```

Deploy:

```powershell
kubectl apply -f k8s-deployment.yaml
```

## Environment Variables

Set these in Azure Portal or via CLI:

```
PORT=8000
DB_ENCRYPT=True
DB_TRUST_SERVER_CERTIFICATE=True
DB_SERVER=your_sql_server.database.windows.net
DB_NAME=your_database
DB_USER=your_username
DB_PASSWORD=your_password
DB_DRIVER=ODBC Driver 17 for SQL Server
```

## Advantages of Windows Containers on Azure

1. **Native Windows**: Uses Windows Schannel for TLS/SSL - better SQL Server certificate compatibility
2. **No OpenSSL Issues**: Avoids the "legacy sigalg disallowed" errors
3. **Direct ODBC**: Native Windows ODBC drivers work perfectly
4. **Better Performance**: Optimized for Windows workloads

## Cost Estimation

- **Azure Container Instances**: ~$0.10/hour for 1 CPU, 2GB RAM
- **Azure Container Apps**: ~$0.000012/vCPU-second + ~$0.0000015/GB-second
- **AKS**: VM costs + ~$0.10/hour for control plane

## Troubleshooting

1. **Check Logs**: Use Azure Portal → Container Instances → Logs
2. **Test Connection**: Ensure SQL Server allows Azure IP ranges
3. **Firewall Rules**: Add Azure IP ranges to SQL Server firewall
4. **ODBC Driver**: Verify driver installation in container logs

