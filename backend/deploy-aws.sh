#!/bin/bash
# Quick Deployment Script for AWS ECR Repository
# Repository: 390167164043.dkr.ecr.ap-south-1.amazonaws.com/sunbaby-backend
# Region: ap-south-1 (Mumbai)

set -e

AWS_REGION="ap-south-1"
AWS_ACCOUNT_ID="390167164043"
ECR_REPO_URI="390167164043.dkr.ecr.ap-south-1.amazonaws.com/sunbaby-backend"
IMAGE_TAG="${IMAGE_TAG:-latest}"

echo "=== Deploying to AWS ECR ==="
echo "Repository: $ECR_REPO_URI"
echo "Region: $AWS_REGION"
echo "Image Tag: $IMAGE_TAG"
echo ""

# Step 1: Login to ECR
echo "Step 1: Logging into ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REPO_URI
echo "✓ Logged into ECR"
echo ""

# Step 2: Build Windows Docker Image
echo "Step 2: Building Windows Docker Image..."
echo "Note: Ensure Docker Desktop is set to Windows containers"
docker build -f Dockerfile.windows -t sunbaby-backend:$IMAGE_TAG .
echo "✓ Image built successfully"
echo ""

# Step 3: Tag Image
echo "Step 3: Tagging Image..."
docker tag sunbaby-backend:$IMAGE_TAG $ECR_REPO_URI:$IMAGE_TAG
echo "✓ Image tagged"
echo ""

# Step 4: Push Image to ECR
echo "Step 4: Pushing Image to ECR..."
docker push $ECR_REPO_URI:$IMAGE_TAG
echo "✓ Image pushed to ECR"
echo ""

echo "=== Deployment Complete ==="
echo "Image URI: $ECR_REPO_URI:$IMAGE_TAG"
echo ""
echo "Next steps:"
echo "1. Create ECS task definition using this image"
echo "2. Create/update ECS service"
echo "See AWS_CLI_QUICK_START.md for ECS deployment commands"

