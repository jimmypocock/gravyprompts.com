#!/bin/bash

# Load environment variables
if [ -f .env ]; then
    set -a
    source .env
    set +a
fi

# Use API URL from environment variable or default
API_URL="${NEXT_PUBLIC_API_URL:-https://your-api-id.execute-api.us-east-1.amazonaws.com/production}"

echo "Testing API CORS headers..."
echo "=============================="

# Test with curl to see raw response
echo "1. Testing GET /templates endpoint:"
curl -v -X GET "$API_URL/templates?filter=popular&limit=12" \
  -H "Origin: https://www.gravyprompts.com" \
  -H "Accept: application/json" \
  2>&1 | grep -E "(< HTTP|< Access-Control|error|Error)"

echo -e "\n\n2. Testing OPTIONS /templates (preflight):"
curl -v -X OPTIONS "$API_URL/templates" \
  -H "Origin: https://www.gravyprompts.com" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Content-Type" \
  2>&1 | grep -E "(< HTTP|< Access-Control)"

echo -e "\n\nDone!"