#!/bin/bash

echo "🔧 Embedding utils directly in Lambda functions..."
echo "================================================="

cd "$(dirname "$0")/../cdk"

# Copy utils.js to each Lambda function directory
echo "1. Copying utils to Lambda functions..."
cp lambda-layers/shared/nodejs/node_modules/utils/index.js lambda/templates/utils.js
cp lambda-layers/shared/nodejs/node_modules/utils/index.js lambda/prompts/utils.js
cp lambda-layers/shared/nodejs/node_modules/utils/index.js lambda/moderation/utils.js

echo "✅ Utils embedded in Lambda functions"
echo ""
echo "This is a workaround for the Lambda layer issue."
echo "Now run: npm run deploy:api"