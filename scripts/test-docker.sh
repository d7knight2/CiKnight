#!/bin/bash

# Docker Test Script for CiKnight
# Tests that the application correctly binds to the specified PORT in a containerized environment

set -e

echo "🐳 Testing CiKnight Docker Deployment"
echo ""

# Configuration
IMAGE_NAME="ciknight-test"
CONTAINER_NAME="ciknight-test-container"
TEST_PORT="${TEST_PORT:-8080}"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Cleanup function
cleanup() {
  echo ""
  echo "🧹 Cleaning up..."
  docker stop ${CONTAINER_NAME} 2>/dev/null || true
  docker rm ${CONTAINER_NAME} 2>/dev/null || true
}

# Set trap to cleanup on exit
trap cleanup EXIT

echo "📦 Building Docker image..."
docker build -t ${IMAGE_NAME} .

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Docker build failed${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Docker build successful${NC}"
echo ""

echo "🚀 Starting container on port ${TEST_PORT}..."
docker run -d \
  --name ${CONTAINER_NAME} \
  -p ${TEST_PORT}:${TEST_PORT} \
  -e PORT=${TEST_PORT} \
  -e NODE_ENV=production \
  -e GITHUB_APP_ID=test_app_id \
  -e GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----" \
  -e GITHUB_WEBHOOK_SECRET=test_secret \
  ${IMAGE_NAME}

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Failed to start container${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Container started${NC}"
echo ""

# Wait for application to start
echo "⏳ Waiting for application to start (up to 30 seconds)..."
TIMEOUT=30
ELAPSED=0

while [ $ELAPSED -lt $TIMEOUT ]; do
  if curl -s -f http://localhost:${TEST_PORT}/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Application is healthy!${NC}"
    break
  fi
  sleep 2
  ELAPSED=$((ELAPSED + 2))
  echo "   Checking... (${ELAPSED}s/${TIMEOUT}s)"
done

if [ $ELAPSED -ge $TIMEOUT ]; then
  echo -e "${RED}❌ Application failed to start within ${TIMEOUT} seconds${NC}"
  echo ""
  echo "📋 Container logs:"
  docker logs ${CONTAINER_NAME}
  exit 1
fi

echo ""
echo "🧪 Running tests..."
echo ""

# Test 1: Health check endpoint
echo "Test 1: Health check endpoint"
HEALTH_RESPONSE=$(curl -s http://localhost:${TEST_PORT}/health)
if echo "$HEALTH_RESPONSE" | grep -q "healthy"; then
  echo -e "${GREEN}✅ Health check passed${NC}"
else
  echo -e "${RED}❌ Health check failed${NC}"
  echo "Response: $HEALTH_RESPONSE"
  exit 1
fi

# Test 2: Root endpoint
echo "Test 2: Root endpoint"
ROOT_RESPONSE=$(curl -s http://localhost:${TEST_PORT}/)
if echo "$ROOT_RESPONSE" | grep -q "CiKnight"; then
  echo -e "${GREEN}✅ Root endpoint passed${NC}"
else
  echo -e "${RED}❌ Root endpoint failed${NC}"
  echo "Response: $ROOT_RESPONSE"
  exit 1
fi

# Test 3: Check container logs for port information
echo "Test 3: Verify port in logs"
LOGS=$(docker logs ${CONTAINER_NAME} 2>&1)
if echo "$LOGS" | grep -q "port ${TEST_PORT}"; then
  echo -e "${GREEN}✅ Application correctly reports port ${TEST_PORT}${NC}"
else
  echo -e "${YELLOW}⚠️  Warning: Port ${TEST_PORT} not found in logs${NC}"
  echo "Logs:"
  echo "$LOGS"
fi

echo ""
echo -e "${GREEN}🎉 All tests passed!${NC}"
echo ""
echo "📋 Container information:"
docker ps -a --filter "name=${CONTAINER_NAME}" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "📊 Application response:"
curl -s http://localhost:${TEST_PORT}/ | jq . 2>/dev/null || curl -s http://localhost:${TEST_PORT}/

echo ""
echo "💡 To test with a different port, run:"
echo "   TEST_PORT=3000 ./scripts/test-docker.sh"
echo ""
echo "🔍 To view container logs, run:"
echo "   docker logs ${CONTAINER_NAME}"
