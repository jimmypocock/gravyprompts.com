#!/bin/bash

echo "🔧 Fixing Lambda deployment issue..."
echo "===================================="

cd "$(dirname "$0")/../cdk"

# 1. Clean up any local development artifacts
echo "1. Cleaning up local development files..."
rm -rf lambda/templates/node_modules lambda/templates/utils.js lambda/templates/package-lock.json
rm -rf lambda/prompts/node_modules lambda/prompts/utils.js lambda/prompts/package-lock.json
rm -rf lambda/moderation/node_modules lambda/moderation/utils.js lambda/moderation/package-lock.json

# 2. Ensure Lambda layer is properly built
echo -e "\n2. Building Lambda layer..."
cd lambda-layers/shared/nodejs
npm install
cd ../../..

# 3. Force CDK to rebuild by touching files
echo -e "\n3. Forcing CDK rebuild..."
touch lambda/templates/*.js
touch lambda/prompts/*.js
touch lambda/moderation/*.js
touch lambda-layers/shared/nodejs/utils.js

# 4. Build TypeScript
echo -e "\n4. Building CDK TypeScript..."
npm run build

# 5. Deploy with force flag
echo -e "\n5. Deploying with --force flag..."
cdk deploy GRAVYPROMPTS-API --require-approval never --force

echo -e "\n✅ Deployment fix complete!"