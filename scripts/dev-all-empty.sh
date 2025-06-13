#!/bin/bash

echo "🚀 Starting complete local development environment (without sample data)..."

# Change to local test directory
cd cdk/local-test

# Cleanup any existing containers
echo "🧹 Cleaning up existing containers..."
docker-compose down 2>/dev/null || true

# Start DynamoDB
echo "📦 Starting DynamoDB..."
docker-compose up -d

# Wait for DynamoDB to be ready
echo "⏳ Waiting for DynamoDB to start..."
max_attempts=30
attempt=0
while ! curl -s http://localhost:8000 >/dev/null 2>&1; do
  if [ $attempt -eq $max_attempts ]; then
    echo "❌ DynamoDB failed to start after 30 seconds"
    exit 1
  fi
  attempt=$((attempt + 1))
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

# Skip loading sample templates
echo "📝 Skipping sample templates (starting with empty database)..."

# Start all services
echo "🎯 Starting all services..."
cd ../..
concurrently \
  --names "api,nextjs,gravyjs" \
  --prefix-colors "blue,green,yellow" \
  "npm run local:start" \
  "NEXT_PUBLIC_API_URL=http://localhost:7429 next dev --turbopack -p 6827" \
  "npm run demo:dev"