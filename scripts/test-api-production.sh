#!/bin/bash

# Test API endpoints in production

API_URL="https://sg54tyu5dl.execute-api.us-east-1.amazonaws.com/production"

echo "Testing API endpoints..."
echo "========================"

# Test 1: Check if API is reachable (should return 401 without auth)
echo "1. Testing API reachability (GET /templates - no auth):"
curl -X GET "$API_URL/templates" -H "Content-Type: application/json" -v 2>&1 | grep -E "(< HTTP|{)"
echo ""

# Test 2: Test create template without auth (should return 401)
echo "2. Testing create template without auth (should return 401):"
curl -X POST "$API_URL/templates" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","content":"Test content","tags":[],"visibility":"private"}' \
  -v 2>&1 | grep -E "(< HTTP|{)"
echo ""

# Test 3: Test with a dummy Bearer token (should return 401 but different error)
echo "3. Testing with dummy Bearer token:"
curl -X POST "$API_URL/templates" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dummy-token" \
  -d '{"title":"Test","content":"Test content","tags":[],"visibility":"private"}' \
  -v 2>&1 | grep -E "(< HTTP|{)"
echo ""

echo "========================"
echo "To test with a real token, you need to:"
echo "1. Open your browser's developer console on gravyprompts.com"
echo "2. Run this command: "
echo "   await window.currentUser.getIdToken()"
echo "3. Copy the token and run:"
echo "   curl -X POST \"$API_URL/templates\" \\"
echo "     -H \"Content-Type: application/json\" \\"
echo "     -H \"Authorization: Bearer YOUR_TOKEN_HERE\" \\"
echo "     -d '{\"title\":\"Test\",\"content\":\"Test content\",\"tags\":[],\"visibility\":\"private\"}'"