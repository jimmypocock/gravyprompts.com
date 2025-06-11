#!/bin/bash

# Temporary workaround for SAM Local layer issues
# This copies only the utils files (not node_modules) to Lambda folders

echo "Setting up local layer workaround..."

# Copy utils-local.js as utils.js to templates folder
cp ../lambda-layers/shared/nodejs/utils-local.js ../lambda/templates/utils.js
cp ../lambda-layers/shared/nodejs/utils-local.js ../lambda/prompts/utils.js
cp ../lambda-layers/shared/nodejs/utils-local.js ../lambda/moderation/utils.js

echo "✅ Layer workaround applied - utils.js copied to Lambda folders"
echo "Note: This is a temporary solution for local development only"