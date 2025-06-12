#!/bin/bash

echo "🔧 Fixing Lambda Layer Structure for Production..."
echo "================================================"

cd "$(dirname "$0")/../cdk/lambda-layers/shared"

# Create the proper structure for custom modules
echo "1. Creating proper layer structure..."
mkdir -p nodejs/node_modules/utils

# Move utils.js to be a proper module
echo "2. Setting up utils module..."
cp nodejs/utils.js nodejs/node_modules/utils/index.js

# Create a proper package.json for the utils module
echo "3. Creating utils module package.json..."
cat > nodejs/node_modules/utils/package.json << 'EOF'
{
  "name": "utils",
  "version": "1.0.0",
  "main": "index.js",
  "description": "Shared utilities for Lambda functions"
}
EOF

# Clean up old structure
echo "4. Cleaning up old files..."
rm -f nodejs/utils.js
rm -f nodejs/utils-local.js

# Remove any timestamp comments
echo "5. Cleaning up source files..."
cd ../../
find . -name "*.js" -exec sed -i '' '/\/\/ Force update:/d' {} \; 2>/dev/null || true
find . -name "*.js" -exec sed -i '' '/\/\/ Force layer update:/d' {} \; 2>/dev/null || true

echo ""
echo "✅ Layer structure fixed!"
echo ""
echo "The utils module is now properly located at:"
echo "  nodejs/node_modules/utils/index.js"
echo ""
echo "Lambda functions can now require it with:"
echo "  const { ... } = require('utils');"
echo ""
echo "Next step: npm run deploy:api"