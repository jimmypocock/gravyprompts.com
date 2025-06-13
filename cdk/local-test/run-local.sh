#!/bin/bash

echo "🚀 Starting local development environment..."

# Start Docker services
echo "Starting DynamoDB local..."
docker-compose up -d

# Wait for DynamoDB to be ready
echo "Waiting for DynamoDB to start..."
sleep 5

# Setup tables
echo "Creating DynamoDB tables..."
node setup-local-db.js

# Copy Lambda layer files EXCEPT utils.js to preserve local version
echo "Setting up Lambda layers..."
# Check if rsync is available, otherwise use cp with exclusion
# Don't copy layer files into Lambda folders - they should use the layer
# if command -v rsync &> /dev/null; then
#     # Use rsync to exclude utils.js
#     rsync -av --exclude='utils.js' ../lambda-layers/shared/nodejs/* ../lambda/templates/
# else
#     # Fallback: copy everything then overwrite with local version
#     # cp -r ../lambda-layers/shared/nodejs/* ../lambda/templates/
# fi

# Always ensure we have the local version of utils.js
# echo "Setting up local utils.js..."
# cp ../lambda-layers/shared/nodejs/utils-local.js ../lambda/templates/utils.js
# cp ../lambda-layers/shared/nodejs/utils-local.js ../lambda/templates/utils-local.js

# Verify the Lambda layer has utils module
echo "Verifying Lambda layer setup..."
if [ -f "../lambda-layers/shared/nodejs/utils.js" ]; then
    echo "✅ Lambda layer utils module is properly configured"
else
    echo "❌ Lambda layer utils module is NOT found"
    exit 1
fi

# Apply layer workaround for local development
./setup-layer-workaround.sh

# Create or update env.json for SAM Local
echo "Setting up environment variables..."
cat > env.json << 'EOF'
{
  "CreateTemplateFunction": {
    "IS_LOCAL": "true",
    "AWS_SAM_LOCAL": "true",
    "TEMPLATES_TABLE": "local-templates",
    "ENVIRONMENT": "development"
  },
  "GetTemplateFunction": {
    "IS_LOCAL": "true",
    "AWS_SAM_LOCAL": "true",
    "TEMPLATES_TABLE": "local-templates",
    "TEMPLATE_VIEWS_TABLE": "local-template-views",
    "ENVIRONMENT": "development"
  },
  "ListTemplatesFunction": {
    "IS_LOCAL": "true",
    "AWS_SAM_LOCAL": "true",
    "TEMPLATES_TABLE": "local-templates",
    "ENVIRONMENT": "development"
  },
  "UpdateTemplateFunction": {
    "IS_LOCAL": "true",
    "AWS_SAM_LOCAL": "true",
    "TEMPLATES_TABLE": "local-templates",
    "ENVIRONMENT": "development"
  },
  "DeleteTemplateFunction": {
    "IS_LOCAL": "true",
    "AWS_SAM_LOCAL": "true",
    "TEMPLATES_TABLE": "local-templates",
    "ENVIRONMENT": "development"
  },
  "ShareTemplateFunction": {
    "IS_LOCAL": "true",
    "AWS_SAM_LOCAL": "true",
    "TEMPLATES_TABLE": "local-templates",
    "ENVIRONMENT": "development"
  },
  "PopulateTemplateFunction": {
    "IS_LOCAL": "true",
    "AWS_SAM_LOCAL": "true",
    "TEMPLATES_TABLE": "local-templates",
    "ENVIRONMENT": "development"
  }
}
EOF

# Start SAM Local API
echo "Starting SAM Local API Gateway..."
echo ""
echo "📌 Local API will be available at: http://localhost:7429"
echo "📌 DynamoDB Admin UI: http://localhost:8001"
echo ""

# Export environment variables for local testing
export AWS_SAM_LOCAL=true
export IS_LOCAL=true
export AWS_ACCESS_KEY_ID=local
export AWS_SECRET_ACCESS_KEY=local
export AWS_REGION=us-east-1

# Run SAM local with environment variables file and layer caching
echo "Starting SAM Local API Gateway (this may take a while on first run)..."
sam local start-api \
  --port 7429 \
  --template template-local.yaml \
  --docker-network host \
  --env-vars env.json \
  --layer-cache-basedir .aws-sam/layers-pkg \
  --skip-pull-image