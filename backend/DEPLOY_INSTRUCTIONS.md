# Deployment Instructions

## Quick Deploy to AWS ECR

Your configuration:
- **AWS Account**: `390167164043`
- **Region**: `ap-south-1` (Mumbai)
- **ECR Repository**: `390167164043.dkr.ecr.ap-south-1.amazonaws.com/sunbaby-backend`
- **Database Server**: `13.234.194.76\devtest,1435`

## Option 1: Using Git Bash (Recommended)

1. **Open Git Bash** in the `backend` folder

2. **Run the deployment script**:
```bash
bash AWS_CLI_DEPLOYMENT.sh
```

## Option 2: Using WSL (Windows Subsystem for Linux)

1. **Open WSL** terminal

2. **Navigate to project**:
```bash
cd /mnt/g/SunBaby/backend
```

3. **Run the deployment script**:
```bash
bash AWS_CLI_DEPLOYMENT.sh
```

## Option 3: Manual Step-by-Step Deployment

### Step 1: Login to AWS ECR

```powershell
aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin 390167164043.dkr.ecr.ap-south-1.amazonaws.com
```

### Step 2: Build Windows Docker Image

```powershell
# Ensure Docker Desktop is set to Windows containers mode
docker build -f Dockerfile.windows -t sunbaby-backend:latest .
```

### Step 3: Tag Image

```powershell
docker tag sunbaby-backend:latest 390167164043.dkr.ecr.ap-south-1.amazonaws.com/sunbaby-backend:latest
```

### Step 4: Push to ECR

```powershell
docker push 390167164043.dkr.ecr.ap-south-1.amazonaws.com/sunbaby-backend:latest
```

### Step 5: Create CloudWatch Log Group

```powershell
aws logs create-log-group --log-group-name /ecs/sunbaby-backend --region ap-south-1
```

### Step 6: Create ECS Cluster

```powershell
aws ecs create-cluster --cluster-name sunbaby-cluster --region ap-south-1
```

### Step 7: Register Task Definition

```powershell
aws ecs register-task-definition --cli-input-json file://task-definition.json --region ap-south-1
```

### Step 8: Create ECS Service

First, get your VPC and Subnet IDs:

```powershell
# List VPCs
aws ec2 describe-vpcs --region ap-south-1 --query 'Vpcs[*].[VpcId,CidrBlock]' --output table

# List Subnets (replace vpc-xxx with your VPC ID)
aws ec2 describe-subnets --filters "Name=vpc-id,Values=vpc-xxx" --region ap-south-1 --query 'Subnets[*].[SubnetId,AvailabilityZone]' --output table
```

Create security group:

```powershell
# Create security group (replace vpc-xxx with your VPC ID)
aws ec2 create-security-group --group-name sunbaby-backend-sg --description "Security group for SunBaby Backend" --vpc-id vpc-xxx --region ap-south-1

# Allow HTTP traffic (replace sg-xxx with security group ID)
aws ec2 authorize-security-group-ingress --group-id sg-xxx --protocol tcp --port 8000 --cidr 0.0.0.0/0 --region ap-south-1
```

Create ECS service:

```powershell
aws ecs create-service `
  --cluster sunbaby-cluster `
  --service-name sunbaby-backend `
  --task-definition sunbaby-backend `
  --desired-count 1 `
  --launch-type FARGATE `
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}" `
  --region ap-south-1
```

### Step 9: Get Public IP

```powershell
$TASK_ARN = aws ecs list-tasks --cluster sunbaby-cluster --service-name sunbaby-backend --region ap-south-1 --query 'taskArns[0]' --output text
$ENI_ID = aws ecs describe-tasks --cluster sunbaby-cluster --tasks $TASK_ARN --region ap-south-1 --query 'tasks[0].attachments[0].details[?name==`networkInterfaceId`].value' --output text
aws ec2 describe-network-interfaces --network-interface-ids $ENI_ID --region ap-south-1 --query 'NetworkInterfaces[0].Association.PublicIp' --output text
```

## Quick Deploy Script (Simplified)

Use the `deploy-aws.sh` script for just building and pushing the image:

```bash
# In Git Bash or WSL
bash deploy-aws.sh
```

## Prerequisites

1. **AWS CLI installed and configured**:
   ```powershell
   aws configure
   ```

2. **Docker Desktop with Windows containers enabled**:
   - Switch Docker Desktop to Windows containers mode
   - Verify: `docker version` should show `OS/Arch: windows/amd64`

3. **Git Bash or WSL** (for running bash scripts)

## Troubleshooting

### "bash: command not found"
- Install Git Bash: https://git-scm.com/downloads
- Or use WSL: `wsl --install`
- Or use PowerShell commands from Option 3 above

### "Cannot connect to Docker daemon"
- Ensure Docker Desktop is running
- Check Docker Desktop is in Windows containers mode

### "An error occurred (AccessDeniedException)"
- Check AWS credentials: `aws configure list`
- Verify IAM permissions for ECR, ECS, EC2, CloudWatch Logs

### "No space left on device"
- Clean up Docker: `docker system prune -a`
- Free up disk space

## After Deployment

1. **Get service URL**: Check the public IP output
2. **View logs**: CloudWatch Logs → `/ecs/sunbaby-backend`
3. **Test API**: `http://<public-ip>:8000/docs`

## Environment Variables in Task Definition

The task definition includes:
- `DB_SERVER`: `13.234.194.76\devtest,1435`
- `DB_NAME`: `fiesauthentication`
- `DB_USER`: `sa`
- `DB_PASSWORD`: `fiessystems@123`
- `DB_ENCRYPT`: `True`
- `DB_TRUST_SERVER_CERTIFICATE`: `True`

