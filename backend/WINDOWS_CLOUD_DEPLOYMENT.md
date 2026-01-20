# Windows Container Cloud Deployment Options

This guide covers cloud platforms that support Windows Docker containers for your FastAPI application.

## Platform Comparison

| Platform | Windows Support | Ease of Use | Cost | Best For |
|----------|----------------|-------------|------|----------|
| **Azure Container Instances** | ✅ Excellent | ⭐⭐⭐⭐⭐ | Low | Quick deployments, dev/test |
| **Azure Container Apps** | ✅ Excellent | ⭐⭐⭐⭐ | Low-Medium | Production, auto-scaling |
| **Azure Kubernetes Service** | ✅ Good | ⭐⭐ | Medium-High | Enterprise, complex setups |
| **AWS ECS Fargate** | ✅ Excellent | ⭐⭐⭐⭐ | Low-Medium | Production, serverless |
| **AWS ECS EC2** | ✅ Good | ⭐⭐⭐ | Medium | Custom configurations |
| **AWS EKS** | ✅ Good | ⭐⭐ | High | Enterprise Kubernetes |
| **Google Cloud Run** | ❌ No | N/A | N/A | Not available |
| **Render** | ❌ No | N/A | N/A | Not available |

## Why Windows Containers?

✅ **Solves SSL/TLS Issues**: Windows uses Schannel instead of OpenSSL  
✅ **Native ODBC Drivers**: Better SQL Server compatibility  
✅ **No Legacy Sigalg Errors**: Handles legacy certificates gracefully  
✅ **Better Performance**: Optimized for Windows workloads  

## Quick Start

### For Azure (Recommended)

See [AZURE_DEPLOYMENT.md](AZURE_DEPLOYMENT.md) for detailed steps.

**Simplest Option - Azure Container Instances:**
```powershell
# Build and push
docker build -f Dockerfile.windows -t sunbaby-backend:latest .
az acr build --registry sunbabyregistry --image sunbaby-backend:latest .

# Deploy
az container create \
  --resource-group sunbaby-rg \
  --name sunbaby-backend \
  --image sunbabyregistry.azurecr.io/sunbaby-backend:latest \
  --os-type Windows \
  --environment-variables DB_SERVER=... DB_NAME=... ...
```

### For AWS

See [AWS_DEPLOYMENT.md](AWS_DEPLOYMENT.md) for detailed steps.

**Simplest Option - ECS Fargate:**
```powershell
# Build and push
docker build -f Dockerfile.windows -t sunbaby-backend:latest .
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com
docker tag sunbaby-backend:latest <account>.dkr.ecr.us-east-1.amazonaws.com/sunbaby-backend:latest
docker push <account>.dkr.ecr.us-east-1.amazonaws.com/sunbaby-backend:latest

# Deploy using ECS console or CLI
```

## Local Testing with Windows Containers

```powershell
# Switch Docker Desktop to Windows containers
docker version  # Should show "OS/Arch: windows/amd64"

# Build
docker build -f Dockerfile.windows -t sunbaby-backend:local .

# Run locally
docker run -d -p 8000:8000 `
  -e PORT=8000 `
  -e DB_SERVER=your_server `
  -e DB_NAME=your_database `
  -e DB_USER=your_user `
  -e DB_PASSWORD=your_password `
  -e DB_ENCRYPT=True `
  -e DB_TRUST_SERVER_CERTIFICATE=True `
  sunbaby-backend:local
```

## Environment Variables

All platforms require these environment variables:

```
PORT=8000
DB_ENCRYPT=True
DB_TRUST_SERVER_CERTIFICATE=True
DB_SERVER=your_sql_server
DB_NAME=your_database
DB_USER=your_username
DB_PASSWORD=your_password
DB_DRIVER=ODBC Driver 17 for SQL Server
```

## Cost Comparison

| Platform | Estimated Monthly Cost |
|----------|----------------------|
| Azure Container Instances | ~$72/month (1 CPU, 2GB, always on) |
| Azure Container Apps | Pay-per-use (~$30-50/month typical) |
| AWS ECS Fargate | ~$60/month (1 CPU, 2GB, always on) |
| AWS ECS EC2 | ~$35/month (t3.medium instance) |

## Recommendations

1. **For Quick Deployment**: Azure Container Instances
2. **For Production**: Azure Container Apps or AWS ECS Fargate
3. **For Enterprise**: AKS or EKS with Windows nodes
4. **For Cost Optimization**: AWS ECS with EC2 Windows instances

## Troubleshooting

### Common Issues

1. **"OS type mismatch"**: Ensure you're using Windows containers, not Linux
2. **ODBC Driver not found**: Verify driver installation in Dockerfile
3. **Connection errors**: Check SQL Server firewall allows cloud IP ranges
4. **High costs**: Use pay-per-use options (Container Apps, Fargate with auto-scaling)

### SQL Server Firewall

Ensure your SQL Server firewall allows connections from:
- **Azure**: Allow Azure services
- **AWS**: Add VPC IP ranges or use security groups

## Next Steps

1. Choose your platform (Azure recommended for Windows containers)
2. Follow the specific deployment guide:
   - [Azure Deployment Guide](AZURE_DEPLOYMENT.md)
   - [AWS Deployment Guide](AWS_DEPLOYMENT.md)
3. Test locally with Windows containers first
4. Deploy and monitor logs

