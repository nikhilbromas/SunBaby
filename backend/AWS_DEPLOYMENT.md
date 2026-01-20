# AWS Deployment Guide for Windows Containers

AWS supports Windows containers through:
- **Amazon ECS (Fargate)** - Serverless Windows containers
- **Amazon ECS (EC2)** - Windows EC2 instances
- **Amazon EKS** - Kubernetes with Windows nodes (more complex)

## Prerequisites

1. **AWS Account**: Sign up at https://aws.amazon.com
2. **AWS CLI**: Install from https://aws.amazon.com/cli
3. **Docker Desktop**: With Windows containers enabled

## Option 1: Amazon ECS with Fargate (Recommended)

### Build and Push to Amazon ECR

```powershell
# Configure AWS CLI
aws configure

# Create ECR repository (ap-south-1 region - Mumbai)
aws ecr create-repository --repository-name sunbaby-backend --region ap-south-1

# Get login token
$loginToken = aws ecr get-login-password --region us-east-1
$loginToken | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com
aws user name Nikhil.fies@gmail.com password =Nikhil8606039661@
# Build and push
docker build -f Dockerfile.windows -t sunbaby-backend:latest .
docker tag sunbaby-backend:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/sunbaby-backend:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/sunbaby-backend:latest
```

### Create ECS Task Definition

Create `ecs-task-definition.json`:

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
      "image": "<account-id>.dkr.ecr.us-east-1.amazonaws.com/sunbaby-backend:latest",
      "essential": true,
      "portMappings": [
        {
          "containerPort": 8000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "PORT",
          "value": "8000"
        },
        {
          "name": "DB_ENCRYPT",
          "value": "True"
        },
        {
          "name": "DB_TRUST_SERVER_CERTIFICATE",
          "value": "True"
        },
        {
          "name": "DB_SERVER",
          "value": "your_sql_server"
        },
        {
          "name": "DB_NAME",
          "value": "your_database"
        },
        {
          "name": "DB_USER",
          "value": "your_username"
        },
        {
          "name": "DB_DRIVER",
          "value": "ODBC Driver 17 for SQL Server"
        }
      ],
      "secrets": [
        {
          "name": "DB_PASSWORD",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:<account-id>:secret:db-password"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/sunbaby-backend",
          "awslogs-region": "us-east-1",
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

### Register Task Definition and Create Service

```powershell
# Create CloudWatch log group
aws logs create-log-group --log-group-name /ecs/sunbaby-backend --region us-east-1

# Register task definition
aws ecs register-task-definition --cli-input-json file://ecs-task-definition.json --region us-east-1

# Create ECS cluster
aws ecs create-cluster --cluster-name sunbaby-cluster --region us-east-1

# Create VPC and subnets (or use existing)
# ... VPC setup ...

# Create ECS service
aws ecs create-service `
  --cluster sunbaby-cluster `
  --service-name sunbaby-backend `
  --task-definition sunbaby-backend `
  --desired-count 1 `
  --launch-type FARGATE `
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}" `
  --region us-east-1
```

## Option 2: Amazon ECS with EC2 Windows Instances

### Create ECS Cluster with Windows EC2 Instances

```powershell
# Create cluster
aws ecs create-cluster --cluster-name sunbaby-ec2-cluster --region us-east-1

# Launch Windows EC2 instance with ECS agent
# Use AWS Console or CloudFormation template with:
# - Windows Server 2019 Base or 2022 Base AMI
# - ECS-optimized AMI recommended
# - IAM role with ECS container instance policy
```

### Register Task Definition (Same as Fargate)

Use the same task definition but change:
```json
"requiresCompatibilities": ["EC2"]
```

## Option 3: Amazon EKS with Windows Nodes (Advanced)

### Create EKS Cluster

```powershell
# Create EKS cluster
eksctl create cluster --name sunbaby-eks --region us-east-1 --nodegroup-name linux-nodes --nodes 1

# Add Windows node group
eksctl create nodegroup `
  --cluster sunbaby-eks `
  --region us-east-1 `
  --name windows-nodes `
  --node-type t3.medium `
  --nodes 1 `
  --nodes-min 1 `
  --nodes-max 3 `
  --node-ami-family WindowsServer2019FullContainer `
  --ssh-access
```

### Deploy Using Kubernetes

Use the same `k8s-deployment.yaml` as Azure, but ensure node selector is:
```yaml
nodeSelector:
  kubernetes.io/os: windows
```

## Store Secrets in AWS Secrets Manager

```powershell
# Store database password
aws secretsmanager create-secret `
  --name db-password `
  --secret-string "your_password" `
  --region us-east-1
```

## Create Application Load Balancer

```powershell
# Create target group
aws elbv2 create-target-group `
  --name sunbaby-backend-tg `
  --protocol HTTP `
  --port 80 `
  --vpc-id vpc-xxx `
  --target-type ip `
  --health-check-path /docs `
  --region us-east-1

# Create load balancer
aws elbv2 create-load-balancer `
  --name sunbaby-backend-alb `
  --subnets subnet-xxx subnet-yyy `
  --security-groups sg-xxx `
  --region us-east-1
```

## Advantages of Windows Containers on AWS

1. **Fargate Support**: Serverless Windows containers
2. **Native Windows**: Better SQL Server compatibility
3. **No OpenSSL Issues**: Uses Windows Schannel
4. **Scalable**: Auto-scaling with ECS/Fargate

## Cost Estimation

- **ECS Fargate**: ~$0.04/vCPU-hour + ~$0.004/GB-hour
- **ECS EC2**: EC2 instance costs (~$0.0464/hour for t3.medium Windows)
- **EKS**: Control plane ($0.10/hour) + node costs

## Troubleshooting

1. **Check CloudWatch Logs**: Container logs in `/ecs/sunbaby-backend`
2. **Task Status**: Check ECS console for task failures
3. **Network**: Ensure security groups allow port 8000
4. **SQL Server Firewall**: Add AWS VPC IP ranges

