# AWS CLI Quick Start Guide

Quick reference for deploying Windows containers to AWS using AWS CLI.

## Prerequisites

1. **AWS CLI Installed**: [Install AWS CLI](https://aws.amazon.com/cli/)
2. **AWS Credentials Configured**: Run `aws configure`
3. **Docker Desktop**: With Windows containers enabled
4. **IAM Permissions**: Your AWS user needs these permissions:
   - ECR (Elastic Container Registry)
   - ECS (Elastic Container Service)
   - VPC, EC2 (for networking)
   - CloudWatch Logs
   - Secrets Manager (optional, for DB password)

## Quick Commands

### 1. Setup AWS CLI

```bash
# Install AWS CLI (if not installed)
# Windows: Download from https://aws.amazon.com/cli/
# Or use: pip install awscli

# Configure AWS credentials
aws configure
# Enter: AWS Access Key ID
# Enter: AWS Secret Access Key
# Enter: Default region (e.g., us-east-1)
# Enter: Default output format (json)
```

### 2. Quick Deployment (Automated Script)

```bash
# Make script executable (Linux/Mac/Git Bash)
chmod +x AWS_CLI_DEPLOYMENT.sh

# Set database credentials
export DB_SERVER="your_sql_server"
export DB_NAME="your_database"
export DB_USER="your_username"
export DB_PASSWORD="your_password"

# Run deployment script
./AWS_CLI_DEPLOYMENT.sh
```

### 3. Manual Deployment Steps

#### Step 1: Verify ECR Repository

**Your ECR Repository already exists:**
- Repository URI: `390167164043.dkr.ecr.ap-south-1.amazonaws.com/sunbaby-backend`
- Region: `ap-south-1` (Mumbai)

**Verify it exists:**
```bash
aws ecr describe-repositories \
  --repository-names sunbaby-backend \
  --region ap-south-1
```

#### Step 2: Login to ECR

```bash
aws ecr get-login-password --region ap-south-1 | \
  docker login --username AWS --password-stdin \
  390167164043.dkr.ecr.ap-south-1.amazonaws.com
```

#### Step 3: Build and Push Image

**Your ECR Repository:**
- Account ID: `390167164043`
- Region: `ap-south-1` (Mumbai)
- Repository URI: `390167164043.dkr.ecr.ap-south-1.amazonaws.com/sunbaby-backend`

**Quick Deploy Script:**
```bash
# Use the quick deploy script
bash deploy-aws.sh
```

**Manual Commands:**
```bash
# Login to ECR
aws ecr get-login-password --region ap-south-1 | \
  docker login --username AWS --password-stdin \
  390167164043.dkr.ecr.ap-south-1.amazonaws.com

# Build Windows image
docker build -f Dockerfile.windows -t sunbaby-backend:latest .

# Tag image
docker tag sunbaby-backend:latest \
  390167164043.dkr.ecr.ap-south-1.amazonaws.com/sunbaby-backend:latest

# Push to ECR
docker push 390167164043.dkr.ecr.ap-south-1.amazonaws.com/sunbaby-backend:latest
```

#### Step 4: Create CloudWatch Log Group

```bash
aws logs create-log-group \
  --log-group-name /ecs/sunbaby-backend \
  --region ap-south-1
```

#### Step 5: Create ECS Cluster

```bash
aws ecs create-cluster \
  --cluster-name sunbaby-cluster \
  --region ap-south-1
```

#### Step 6: Register Task Definition

Create `task-definition.json`:

```json
{
  "family": "sunbaby-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "containerDefinitions": [
    {
      "name": "sunbaby-backend",
        "image": "390167164043.dkr.ecr.ap-south-1.amazonaws.com/sunbaby-backend:latest",
      "essential": true,
      "portMappings": [{"containerPort": 8000, "protocol": "tcp"}],
      "environment": [
        {"name": "PORT", "value": "8000"},
        {"name": "DB_ENCRYPT", "value": "True"},
        {"name": "DB_TRUST_SERVER_CERTIFICATE", "value": "True"},
        {"name": "DB_SERVER", "value": "your_sql_server"},
        {"name": "DB_NAME", "value": "your_database"},
        {"name": "DB_USER", "value": "your_username"},
        {"name": "DB_DRIVER", "value": "ODBC Driver 17 for SQL Server"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/sunbaby-backend",
            "awslogs-region": "ap-south-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ],
  "platformVersion": "1.0.0",
  "runtimePlatform": {
    "operatingSystemFamily": "WINDOWS_SERVER_2019_CORE",
    "cpuArchitecture": "X86_64"
  }
}
```

Register task definition:

```bash
aws ecs register-task-definition \
  --cli-input-json file://task-definition.json \
  --region ap-south-1
```

#### Step 7: Get VPC and Subnet

```bash
# List VPCs
aws ec2 describe-vpcs --region us-east-1 \
  --query 'Vpcs[*].[VpcId,CidrBlock]' --output table

# List Subnets
aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=vpc-xxx" \
  --region us-east-1 \
  --query 'Subnets[*].[SubnetId,AvailabilityZone]' --output table
```

#### Step 8: Create Security Group

```bash
# Create security group
aws ec2 create-security-group \
  --group-name sunbaby-backend-sg \
  --description "Security group for SunBaby Backend" \
  --vpc-id vpc-xxx \
  --region us-east-1

# Allow HTTP traffic (port 8000)
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxx \
  --protocol tcp \
  --port 8000 \
  --cidr 0.0.0.0/0 \
  --region us-east-1
```

#### Step 9: Create ECS Service

```bash
aws ecs create-service \
  --cluster sunbaby-cluster \
  --service-name sunbaby-backend \
  --task-definition sunbaby-backend \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}" \
  --region us-east-1
```

#### Step 10: Get Public IP

```bash
# Get task ARN
TASK_ARN=$(aws ecs list-tasks \
  --cluster sunbaby-cluster \
  --service-name sunbaby-backend \
  --region us-east-1 \
  --query 'taskArns[0]' --output text)

# Get network interface
ENI_ID=$(aws ecs describe-tasks \
  --cluster sunbaby-cluster \
  --tasks $TASK_ARN \
  --region us-east-1 \
  --query 'tasks[0].attachments[0].details[?name==`networkInterfaceId`].value' \
  --output text)

# Get public IP
aws ec2 describe-network-interfaces \
  --network-interface-ids $ENI_ID \
  --region us-east-1 \
  --query 'NetworkInterfaces[0].Association.PublicIp' \
  --output text
```

## Useful Commands

### View Logs

```bash
# View CloudWatch Logs
aws logs tail /ecs/sunbaby-backend --follow --region us-east-1
```

### Check Service Status

```bash
# Describe service
aws ecs describe-services \
  --cluster sunbaby-cluster \
  --services sunbaby-backend \
  --region us-east-1
```

### Update Service

```bash
# Update service (force new deployment)
aws ecs update-service \
  --cluster sunbaby-cluster \
  --service sunbaby-backend \
  --force-new-deployment \
  --region us-east-1
```

### Scale Service

```bash
# Scale to 2 tasks
aws ecs update-service \
  --cluster sunbaby-cluster \
  --service sunbaby-backend \
  --desired-count 2 \
  --region us-east-1
```

### Delete Service

```bash
# Delete service
aws ecs update-service \
  --cluster sunbaby-cluster \
  --service sunbaby-backend \
  --desired-count 0 \
  --region us-east-1

aws ecs delete-service \
  --cluster sunbaby-cluster \
  --service sunbaby-backend \
  --region us-east-1
```

## Store Secrets in AWS Secrets Manager

```bash
# Store database password
aws secretsmanager create-secret \
  --name db-password \
  --secret-string "your_password" \
  --region us-east-1

# Update task definition to use secret
# Add to containerDefinitions:
{
  "secrets": [
    {
      "name": "DB_PASSWORD",
      "valueFrom": "arn:aws:secretsmanager:us-east-1:<account-id>:secret:db-password"
    }
  ]
}
```

## Troubleshooting

### Check Task Status

```bash
# List tasks
aws ecs list-tasks \
  --cluster sunbaby-cluster \
  --service-name sunbaby-backend \
  --region us-east-1

# Describe task
aws ecs describe-tasks \
  --cluster sunbaby-cluster \
  --tasks <task-arn> \
  --region us-east-1
```

### View Task Logs

```bash
# View logs from CloudWatch
aws logs tail /ecs/sunbaby-backend --follow --region us-east-1
```

### Common Issues

1. **"No space left on device"**: Increase task memory
2. **"Cannot pull image"**: Check ECR permissions
3. **"Task failed to start"**: Check CloudWatch logs
4. **"Connection timeout"**: Check security groups and SQL Server firewall

## Cost Estimation

- **ECS Fargate**: ~$0.04/vCPU-hour + ~$0.004/GB-hour
- **Data Transfer**: ~$0.01/GB out
- **CloudWatch Logs**: First 5GB free, then ~$0.50/GB

**Estimated Monthly Cost**: ~$60-80/month for 1 CPU, 2GB RAM, always on

## Next Steps

1. Set up Application Load Balancer (optional)
2. Configure Auto Scaling (optional)
3. Set up CI/CD pipeline
4. Monitor with CloudWatch

For detailed deployment, see [AWS_DEPLOYMENT.md](AWS_DEPLOYMENT.md)

