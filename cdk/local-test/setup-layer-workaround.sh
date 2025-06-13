#!/bin/bash

# Layer setup for SAM Local
# With proper layer configuration, SAM Local should handle this automatically

echo "Verifying layer structure for local development..."

# Check if the layer has the required structure
if [ -f "../lambda-layers/shared/nodejs/utils.js" ]; then
    echo "✅ Layer structure verified - nodejs/utils.js exists"
    
    # Ensure node_modules exist in the layer
    if [ -d "../lambda-layers/shared/nodejs/node_modules" ]; then
        echo "✅ Layer dependencies found"
    else
        echo "⚠️  Layer dependencies not found - running npm install"
        cd ../lambda-layers/shared/nodejs && npm install && cd -
    fi
else
    echo "❌ Layer structure invalid - utils.js not found in nodejs directory"
    exit 1
fi

echo "✅ Layer setup complete for local development"