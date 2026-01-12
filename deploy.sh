#!/bin/bash

# CiKnight Cloud Run Deployment Script

set -e

# Configuration
PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-your-project-id}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="ciknight"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo "🚀 Deploying CiKnight to Google Cloud Run"
echo "Project: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo ""

# Check if required environment variables are set
if [ -z "$GITHUB_APP_ID" ]; then
  echo "❌ Error: GITHUB_APP_ID environment variable is not set"
  exit 1
fi

if [ -z "$GITHUB_WEBHOOK_SECRET" ]; then
  echo "❌ Error: GITHUB_WEBHOOK_SECRET environment variable is not set"
  exit 1
fi

# Build the Docker image
echo "📦 Building Docker image..."
docker build -t ${IMAGE_NAME}:latest .

# Push to Google Container Registry
echo "⬆️  Pushing to Google Container Registry..."
docker push ${IMAGE_NAME}:latest

# Deploy to Cloud Run
echo "🌐 Deploying to Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
  --image ${IMAGE_NAME}:latest \
  --platform managed \
  --region ${REGION} \
  --allow-unauthenticated \
  --set-env-vars "GITHUB_APP_ID=${GITHUB_APP_ID},GITHUB_WEBHOOK_SECRET=${GITHUB_WEBHOOK_SECRET},NODE_ENV=production,PORT=8080,WEBHOOK_IP_RESTRICTION_ENABLED=true,WEBHOOK_IP_FAIL_OPEN=false,TRUST_PROXY=true" \
  --set-secrets "GITHUB_PRIVATE_KEY=github-private-key:latest" \
  --memory 512Mi \
  --cpu 1 \
  --max-instances 10 \
  --timeout 60 \
  --port 8080

# Get the service URL
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --platform managed --region ${REGION} --format 'value(status.url)')

echo ""
echo "✅ Deployment complete!"
echo "🌐 Service URL: ${SERVICE_URL}"
echo "📡 Webhook URL: ${SERVICE_URL}/webhook"
echo ""
echo "Next steps:"
echo "1. Go to your GitHub App settings"
echo "2. Update the Webhook URL to: ${SERVICE_URL}/webhook"
echo "3. Test by creating a pull request"
