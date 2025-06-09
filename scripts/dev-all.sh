#!/bin/bash

echo "🚀 Starting complete local development environment..."

# Function to check if DynamoDB is ready
check_dynamodb() {
  curl -s http://localhost:8000 > /dev/null 2>&1
  return $?
}

# Clean up any existing containers
echo "🧹 Cleaning up existing containers..."
cd cdk/local-test
docker-compose down 2>/dev/null || true

# Start DynamoDB in the background
echo "📦 Starting DynamoDB..."
docker-compose up -d

# Wait for DynamoDB to be ready
echo "⏳ Waiting for DynamoDB to start..."
while ! check_dynamodb; do
  sleep 1
done
echo "✅ DynamoDB is ready!"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "📦 Installing local test dependencies..."
  npm install
fi

# Setup tables
echo "📊 Setting up database tables..."
node setup-local-db.js

# Go back to root
cd ../..

# Start all services
echo "🎯 Starting all services..."
concurrently \
  --names "api,nextjs,gravyjs" \
  --prefix-colors "cyan.bold,blue.bold,green.bold" \
  --handle-input \
  --kill-others \
  "cd cdk/local-test && ./run-local.sh" \
  "NEXT_PUBLIC_API_URL=http://localhost:7429 next dev --turbopack -p 6827" \
  "cd GravyJS/demo && npm run dev"