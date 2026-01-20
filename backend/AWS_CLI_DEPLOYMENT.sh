#!/bin/bash
# AWS CLI Deployment Script for Windows Containers
# This script automates deployment of Windows containers to AWS ECS Fargate

set -e  # Exit on error

# Configuration Variables
AWS_REGION="ap-south-1"  # Mumbai region
AWS_ACCOUNT_ID="390167164043"  # Your AWS Account ID
ECR_REPO_NAME="sunbaby-backend"
ECR_REPO_URI="390167164043.dkr.ecr.ap-south-1.amazonaws.com/sunbaby-backend"
ECS_CLUSTER_NAME="sunbaby-cluster"
ECS_SERVICE_NAME="sunbaby-backend"
TASK_FAMILY="sunbaby-backend"
IMAGE_TAG="latest"

# Database Configuration (set via environment variables or parameters)
DB_SERVER="${DB_SERVER:-13.234.194.76\\devtest,1435}"
DB_NAME="${DB_NAME:-fiesauthentication}"
DB_USER="${DB_USER:-sa}"
DB_PASSWORD="${DB_PASSWORD:-fiessystems@123}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== AWS Windows Container Deployment Script ===${NC}\n"

# Step 1: Get AWS Account ID
# Verify AWS Account ID and ECR URI
echo -e "${YELLOW}AWS Account ID: $AWS_ACCOUNT_ID${NC}"
echo -e "${YELLOW}AWS Region: $AWS_REGION${NC}"
echo -e "${YELLOW}ECR Repository URI: $ECR_REPO_URI${NC}\n"

# Step 2: Create ECR Repository (if it doesn't exist)
echo -e "${YELLOW}Step 1: Creating ECR Repository...${NC}"
if aws ecr describe-repositories --repository-names $ECR_REPO_NAME --region $AWS_REGION 2>/dev/null; then
    echo -e "${GREEN}Repository $ECR_REPO_NAME already exists${NC}\n"
else
    aws ecr create-repository --repository-name $ECR_REPO_NAME --region $AWS_REGION
    echo -e "${GREEN}Repository $ECR_REPO_NAME created${NC}\n"
fi

# Step 3: Login to ECR
echo -e "${YELLOW}Step 2: Logging into ECR...${NC}"
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REPO_URI
echo -e "${GREEN}Logged into ECR${NC}\n"

# Step 4: Build Windows Docker Image
echo -e "${YELLOW}Step 3: Building Windows Docker Image...${NC}"
echo -e "${YELLOW}Note: This requires Docker Desktop with Windows containers enabled${NC}"
docker build -f Dockerfile.windows -t $ECR_REPO_NAME:$IMAGE_TAG .
echo -e "${GREEN}Image built successfully${NC}\n"

# Step 5: Tag Image
echo -e "${YELLOW}Step 4: Tagging Image...${NC}"
docker tag $ECR_REPO_NAME:$IMAGE_TAG $ECR_REPO_URI:$IMAGE_TAG
echo -e "${GREEN}Image tagged${NC}\n"

# Step 6: Push Image to ECR
echo -e "${YELLOW}Step 5: Pushing Image to ECR...${NC}"
docker push $ECR_REPO_URI:$IMAGE_TAG
echo -e "${GREEN}Image pushed to ECR${NC}\n"

# Step 7: Create CloudWatch Log Group
echo -e "${YELLOW}Step 6: Creating CloudWatch Log Group...${NC}"
if aws logs describe-log-groups --log-group-name-prefix /ecs/$ECS_SERVICE_NAME --region $AWS_REGION 2>/dev/null | grep -q $ECS_SERVICE_NAME; then
    echo -e "${GREEN}Log group /ecs/$ECS_SERVICE_NAME already exists${NC}\n"
else
    aws logs create-log-group --log-group-name /ecs/$ECS_SERVICE_NAME --region $AWS_REGION
    echo -e "${GREEN}Log group created${NC}\n"
fi

# Step 8: Create ECS Cluster (if it doesn't exist)
echo -e "${YELLOW}Step 7: Creating ECS Cluster...${NC}"
if aws ecs describe-clusters --clusters $ECS_CLUSTER_NAME --region $AWS_REGION --query 'clusters[0].status' --output text 2>/dev/null | grep -q ACTIVE; then
    echo -e "${GREEN}Cluster $ECS_CLUSTER_NAME already exists${NC}\n"
else
    aws ecs create-cluster --cluster-name $ECS_CLUSTER_NAME --region $AWS_REGION
    echo -e "${GREEN}Cluster $ECS_CLUSTER_NAME created${NC}\n"
fi

# Step 9: Register Task Definition
echo -e "${YELLOW}Step 8: Registering Task Definition...${NC}"

# Create task definition JSON
cat > task-definition.json << EOF
{
  "family": "$TASK_FAMILY",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "containerDefinitions": [
    {
      "name": "$ECS_SERVICE_NAME",
      "image": "390167164043.dkr.ecr.ap-south-1.amazonaws.com/sunbaby-backend:$IMAGE_TAG",
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
          "value": "$DB_SERVER"
        },
        {
          "name": "DB_NAME",
          "value": "$DB_NAME"
        },
        {
          "name": "DB_USER",
          "value": "$DB_USER"
        },
        {
          "name": "DB_DRIVER",
          "value": "ODBC Driver 17 for SQL Server"
        },
        {
          "name": "DB_PASSWORD",
          "value": "$DB_PASSWORD"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/$ECS_SERVICE_NAME",
          "awslogs-region": "$AWS_REGION",
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
EOF

aws ecs register-task-definition --cli-input-json file://task-definition.json --region $AWS_REGION
echo -e "${GREEN}Task definition registered${NC}\n"

# Step 10: Get VPC and Subnet IDs (requires user input or existing VPC)
echo -e "${YELLOW}Step 9: VPC Configuration${NC}"
echo -e "${YELLOW}Please provide VPC and Subnet IDs, or press Enter to use defaults:${NC}"
read -p "VPC ID (or press Enter to list available): " VPC_ID
if [ -z "$VPC_ID" ]; then
    echo "Available VPCs:"
    aws ec2 describe-vpcs --region $AWS_REGION --query 'Vpcs[*].[VpcId,CidrBlock,Tags[?Key==`Name`].Value|[0]]' --output table
    read -p "Enter VPC ID: " VPC_ID
fi

read -p "Subnet ID (or press Enter to list available): " SUBNET_ID
if [ -z "$SUBNET_ID" ]; then
    echo "Available Subnets in $VPC_ID:"
    aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" --region $AWS_REGION --query 'Subnets[*].[SubnetId,AvailabilityZone,CidrBlock]' --output table
    read -p "Enter Subnet ID: " SUBNET_ID
fi

# Step 11: Create Security Group (if needed)
echo -e "${YELLOW}Step 10: Creating Security Group...${NC}"
SG_NAME="sunbaby-backend-sg"
SG_ID=$(aws ec2 create-security-group \
    --group-name $SG_NAME \
    --description "Security group for SunBaby Backend" \
    --vpc-id $VPC_ID \
    --region $AWS_REGION \
    --query 'GroupId' \
    --output text 2>/dev/null || \
    aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=$SG_NAME" "Name=vpc-id,Values=$VPC_ID" \
    --region $AWS_REGION \
    --query 'SecurityGroups[0].GroupId' \
    --output text)

# Allow HTTP traffic
aws ec2 authorize-security-group-ingress \
    --group-id $SG_ID \
    --protocol tcp \
    --port 8000 \
    --cidr 0.0.0.0/0 \
    --region $AWS_REGION 2>/dev/null || echo "Security group rule already exists"

echo -e "${GREEN}Security Group: $SG_ID${NC}\n"

# Step 12: Create or Update ECS Service
echo -e "${YELLOW}Step 11: Creating/Updating ECS Service...${NC}"

if aws ecs describe-services --cluster $ECS_CLUSTER_NAME --services $ECS_SERVICE_NAME --region $AWS_REGION --query 'services[0].status' --output text 2>/dev/null | grep -q ACTIVE; then
    echo -e "${YELLOW}Service exists, updating...${NC}"
    aws ecs update-service \
        --cluster $ECS_CLUSTER_NAME \
        --service $ECS_SERVICE_NAME \
        --task-definition $TASK_FAMILY \
        --force-new-deployment \
        --region $AWS_REGION
    echo -e "${GREEN}Service updated${NC}\n"
else
    aws ecs create-service \
        --cluster $ECS_CLUSTER_NAME \
        --service-name $ECS_SERVICE_NAME \
        --task-definition $TASK_FAMILY \
        --desired-count 1 \
        --launch-type FARGATE \
        --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_ID],securityGroups=[$SG_ID],assignPublicIp=ENABLED}" \
        --region $AWS_REGION
    echo -e "${GREEN}Service created${NC}\n"
fi

# Step 13: Wait for Service to be Stable
echo -e "${YELLOW}Step 12: Waiting for service to be stable...${NC}"
aws ecs wait services-stable \
    --cluster $ECS_CLUSTER_NAME \
    --services $ECS_SERVICE_NAME \
    --region $AWS_REGION

echo -e "${GREEN}Service is stable${NC}\n"

# Step 14: Get Public IP
echo -e "${YELLOW}Step 13: Getting Public IP...${NC}"
TASK_ARN=$(aws ecs list-tasks --cluster $ECS_CLUSTER_NAME --service-name $ECS_SERVICE_NAME --region $AWS_REGION --query 'taskArns[0]' --output text)
ENI_ID=$(aws ecs describe-tasks --cluster $ECS_CLUSTER_NAME --tasks $TASK_ARN --region $AWS_REGION --query 'tasks[0].attachments[0].details[?name==`networkInterfaceId`].value' --output text)
PUBLIC_IP=$(aws ec2 describe-network-interfaces --network-interface-ids $ENI_ID --region $AWS_REGION --query 'NetworkInterfaces[0].Association.PublicIp' --output text)

echo -e "${GREEN}=== Deployment Complete ===${NC}"
echo -e "${GREEN}Service URL: http://$PUBLIC_IP:8000${NC}"
echo -e "${GREEN}API Docs: http://$PUBLIC_IP:8000/docs${NC}"
echo -e "${GREEN}CloudWatch Logs: https://$AWS_REGION.console.aws.amazon.com/cloudwatch/home?region=$AWS_REGION#logsV2:log-groups/log-group/%2Fecs%2F$ECS_SERVICE_NAME${NC}\n"

# Cleanup
rm -f task-definition.json

echo -e "${GREEN}Deployment script completed successfully!${NC}"

