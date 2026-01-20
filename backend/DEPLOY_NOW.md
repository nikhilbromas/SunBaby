# Deploy Now - Quick Instructions

## Your Configuration

- **ECR Repository**: `390167164043.dkr.ecr.ap-south-1.amazonaws.com/sunbaby-backend`
- **Region**: `ap-south-1` (Mumbai)
- **Database**: `13.234.194.76\devtest,1435`

## Quick Deploy (Choose One Method)

### Method 1: Git Bash (Easiest)

1. **Install Git Bash** if not already installed: https://git-scm.com/downloads

2. **Open Git Bash** in the `backend` folder

3. **Run**:
```bash
bash AWS_CLI_DEPLOYMENT.sh
```

### Method 2: PowerShell Commands (Manual)

Run these commands in PowerShell (one by one):

#### Step 1: Login to ECR
```powershell
aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin 390167164043.dkr.ecr.ap-south-1.amazonaws.com
```

#### Step 2: Build Windows Docker Image
```powershell
docker build -f Dockerfile.windows -t sunbaby-backend:latest .
```

#### Step 3: Tag and Push
```powershell
docker tag sunbaby-backend:latest 390167164043.dkr.ecr.ap-south-1.amazonaws.com/sunbaby-backend:latest
docker push 390167164043.dkr.ecr.ap-south-1.amazonaws.com/sunbaby-backend:latest
```

#### Step 4: Create Log Group
```powershell
aws logs create-log-group --log-group-name /ecs/sunbaby-backend --region ap-south-1
```

#### Step 5: Create Cluster
```powershell
aws ecs create-cluster --cluster-name sunbaby-cluster --region ap-south-1
```

#### Step 6: Register Task Definition
```powershell
aws ecs register-task-definition --cli-input-json file://task-definition.json --region ap-south-1
```

#### Step 7: Get VPC and Subnet
```powershell
# List VPCs - note the VpcId you want to use
aws ec2 describe-vpcs --region ap-south-1 --query 'Vpcs[*].[VpcId,CidrBlock]' --output table

# List Subnets (replace vpc-xxxxx with your VPC ID)
aws ec2 describe-subnets --filters "Name=vpc-id,Values=vpc-xxxxx" --region ap-south-1 --query 'Subnets[*].[SubnetId,AvailabilityZone]' --output table
```

#### Step 8: Create Security Group
```powershell
# Replace vpc-xxxxx with your VPC ID
aws ec2 create-security-group --group-name sunbaby-backend-sg --description "SunBaby Backend SG" --vpc-id vpc-xxxxx --region ap-south-1

# Note the GroupId from output, then allow port 8000 (replace sg-xxxxx)
aws ec2 authorize-security-group-ingress --group-id sg-xxxxx --protocol tcp --port 8000 --cidr 0.0.0.0/0 --region ap-south-1
```

#### Step 9: Create ECS Service
```powershell
# Replace subnet-xxxxx and sg-xxxxx with your values
aws ecs create-service `
  --cluster sunbaby-cluster `
  --service-name sunbaby-backend `
  --task-definition sunbaby-backend `
  --desired-count 1 `
  --launch-type FARGATE `
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxxxx],securityGroups=[sg-xxxxx],assignPublicIp=ENABLED}" `
  --region ap-south-1
```

#### Step 10: Get Public IP
```powershell
$TASK_ARN = aws ecs list-tasks --cluster sunbaby-cluster --service-name sunbaby-backend --region ap-south-1 --query 'taskArns[0]' --output text
$ENI_ID = aws ecs describe-tasks --cluster sunbaby-cluster --tasks $TASK_ARN --region ap-south-1 --query 'tasks[0].attachments[0].details[?name==`networkInterfaceId`].value' --output text
aws ec2 describe-network-interfaces --network-interface-ids $ENI_ID --region ap-south-1 --query 'NetworkInterfaces[0].Association.PublicIp' --output text
```

## Prerequisites Check

Before deploying, verify:

1. **AWS CLI configured**:
   ```powershell
   aws configure list
   ```

2. **Docker Desktop running** (Windows containers mode - REQUIRED):
   
   **Switch to Windows Containers:**
   - Right-click Docker Desktop icon in system tray
   - Select "Switch to Windows containers..."
   - Wait for Docker to restart
   
   **Verify Windows container mode:**
   ```powershell
   docker version
   # Should show: OS/Arch: windows/amd64
   ```
   
   **Note:** Windows containers require:
   - Windows 10/11 Pro, Enterprise, or Education (or Windows Server)
   - Hyper-V enabled (usually automatic)
   - At least 4GB free disk space for base images

3. **ECR repository exists** (or create it):
   ```powershell
   aws ecr describe-repositories --repository-names sunbaby-backend --region ap-south-1
   # If not exists:
   aws ecr create-repository --repository-name sunbaby-backend --region ap-south-1
   ```

## Troubleshooting

- **"AccessDeniedException"**: Check AWS credentials and IAM permissions
- **"Cannot connect to Docker"**: Ensure Docker Desktop is running
- **"no match for platform in manifest"**: Switch Docker Desktop to Windows containers mode (see Prerequisites #2)
- **"Windows containers not supported"**: You need Windows 10/11 Pro/Enterprise or Windows Server
- **"No space left"**: Run `docker system prune -a` to free space (Windows images are large ~4GB+)
- **"ODBC Driver installation failed"**: Check internet connection, the installer downloads from Microsoft
- **Bash not found**: Use PowerShell commands above or install Git Bash

## After Deployment

1. **Service URL**: Use the public IP from Step 10
2. **API Docs**: `http://<public-ip>:8000/docs`
3. **Logs**: Check CloudWatch Logs → `/ecs/sunbaby-backend`

