#!/bin/bash
set -e

# Save command line ENVIRONMENT if provided
CLI_ENVIRONMENT=$ENVIRONMENT

# Load configuration
source "$(dirname "$0")/config.sh"

# Use CLI environment if provided, otherwise use from config/default
ENVIRONMENT=${CLI_ENVIRONMENT:-${ENVIRONMENT:-development}}

# Use different stack name for production
if [ "$ENVIRONMENT" = "production" ]; then
    AUTH_STACK="${STACK_PREFIX}-Auth-Prod"
else
    AUTH_STACK="${STACK_PREFIX}-Auth"
fi

echo "🔐 Deploying Auth Stack..."
echo "📝 Stack name: $AUTH_STACK"
echo "🌍 Environment: $ENVIRONMENT"

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS CLI is not configured. Please run 'aws configure' or set AWS_PROFILE"
    exit 1
fi

# Build CDK if needed
cd cdk
if [ ! -d "node_modules" ]; then
    npm install
fi
rm -f lib/*.d.ts lib/*.js
npm run build

# Deploy auth stack
echo "☁️  Deploying Cognito User Pool..."
ENVIRONMENT=$ENVIRONMENT npx cdk deploy "$AUTH_STACK" --require-approval never "$@"

cd ..

echo "✅ Auth stack deployment complete!"
echo ""

# Get outputs
USER_POOL_ID=$(aws cloudformation describe-stacks \
    --stack-name "$AUTH_STACK" \
    --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
    --output text \
    --region us-east-1 2>/dev/null)

CLIENT_ID=$(aws cloudformation describe-stacks \
    --stack-name "$AUTH_STACK" \
    --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' \
    --output text \
    --region us-east-1 2>/dev/null)

if [ ! -z "$USER_POOL_ID" ] && [ ! -z "$CLIENT_ID" ]; then
    echo "📋 Cognito Configuration:"
    echo "   User Pool ID: $USER_POOL_ID"
    echo "   Client ID: $CLIENT_ID"
    echo ""
    echo "💡 Add these to your .env.local file:"
    echo "   NEXT_PUBLIC_COGNITO_USER_POOL_ID=$USER_POOL_ID"
    echo "   NEXT_PUBLIC_COGNITO_CLIENT_ID=$CLIENT_ID"
    echo "   NEXT_PUBLIC_COGNITO_REGION=us-east-1"
fi