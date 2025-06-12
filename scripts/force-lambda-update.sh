#!/bin/bash

echo "🔨 Forcing Lambda function updates..."
echo "===================================="

cd "$(dirname "$0")/../cdk"

# Add a timestamp comment to force changes
TIMESTAMP=$(date +%s)

# Update each Lambda function with a comment to force redeploy
echo "// Force update: $TIMESTAMP" >> lambda/templates/list.js
echo "// Force update: $TIMESTAMP" >> lambda/templates/create.js
echo "// Force update: $TIMESTAMP" >> lambda/templates/get.js
echo "// Force update: $TIMESTAMP" >> lambda/templates/update.js
echo "// Force update: $TIMESTAMP" >> lambda/templates/delete.js
echo "// Force update: $TIMESTAMP" >> lambda/templates/share.js
echo "// Force update: $TIMESTAMP" >> lambda/templates/populate.js
echo "// Force update: $TIMESTAMP" >> lambda/prompts/save.js
echo "// Force update: $TIMESTAMP" >> lambda/prompts/list.js
echo "// Force update: $TIMESTAMP" >> lambda/prompts/delete.js
echo "// Force update: $TIMESTAMP" >> lambda/moderation/moderate.js

# Also update the layer
echo "// Force update: $TIMESTAMP" >> lambda-layers/shared/nodejs/utils.js

echo "✅ Added timestamps to force CDK updates"
echo ""
echo "Now run: npm run deploy:api"