#!/bin/bash

echo "🔍 Validating Auth Setup"
echo "======================="

# Check shared auth stack
echo ""
echo "Shared Auth Stack (GRAVYPROMPTS-Auth):"
POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name GRAVYPROMPTS-Auth \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" \
  --output text 2>/dev/null)

if [ -z "$POOL_ID" ]; then
  echo "❌ Auth stack not found"
else
  echo "✅ User Pool ID: $POOL_ID"
  CLIENT_ID=$(aws cloudformation describe-stacks \
    --stack-name GRAVYPROMPTS-Auth \
    --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" \
    --output text)
  echo "✅ Client ID: $CLIENT_ID"
  
  # Check stack status
  STACK_STATUS=$(aws cloudformation describe-stacks \
    --stack-name GRAVYPROMPTS-Auth \
    --query "Stacks[0].StackStatus" \
    --output text)
  echo "✅ Stack Status: $STACK_STATUS"
fi

# Check API stack authorizer
echo ""
echo "API Stack Authorizer:"
AUTHORIZER_ARNS=$(aws cloudformation describe-stacks \
  --stack-name GRAVYPROMPTS-API \
  --query "Stacks[0].Resources[?ResourceType=='AWS::ApiGateway::Authorizer'].PhysicalResourceId" \
  --output text 2>/dev/null)

if [ -z "$AUTHORIZER_ARNS" ]; then
  echo "❌ API stack not found or no authorizer"
else
  echo "✅ API Gateway has authorizer configured"
fi

# Check local .env.local file
echo ""
echo "Local Environment File (.env.local):"
if [ -f ".env.local" ]; then
  if grep -q "NEXT_PUBLIC_COGNITO_USER_POOL_ID" .env.local; then
    echo "✅ Cognito User Pool ID configured"
  else
    echo "❌ Missing NEXT_PUBLIC_COGNITO_USER_POOL_ID"
  fi
  
  if grep -q "NEXT_PUBLIC_COGNITO_CLIENT_ID" .env.local; then
    echo "✅ Cognito Client ID configured"
  else
    echo "❌ Missing NEXT_PUBLIC_COGNITO_CLIENT_ID"
  fi
else
  echo "❌ .env.local file not found"
fi

# Provide recommendations
echo ""
echo "📋 Recommendations:"
echo "==================="

if [ -n "$POOL_ID" ] && [ -n "$CLIENT_ID" ]; then
  echo ""
  echo "Add to .env.local for local development:"
  echo "NEXT_PUBLIC_COGNITO_USER_POOL_ID=$POOL_ID"
  echo "NEXT_PUBLIC_COGNITO_CLIENT_ID=$CLIENT_ID"
  echo ""
  echo "Add to Amplify environment variables for production:"
  echo "NEXT_PUBLIC_COGNITO_USER_POOL_ID=$POOL_ID"
  echo "NEXT_PUBLIC_COGNITO_CLIENT_ID=$CLIENT_ID"
fi

# Check for orphaned stacks
echo ""
echo "🔍 Checking for orphaned stacks:"
if aws cloudformation describe-stacks --stack-name GRAVYPROMPTS-Auth-Prod &>/dev/null 2>&1; then
  echo "⚠️  Found old stack: GRAVYPROMPTS-Auth-Prod (should be deleted)"
fi