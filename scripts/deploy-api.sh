#!/bin/bash
set -e

# Save command line ENVIRONMENT if provided
CLI_ENVIRONMENT=$ENVIRONMENT

# Load configuration
source "$(dirname "$0")/config.sh"

# API is always deployed for production only
# Development uses local SAM
ENVIRONMENT=production
echo "ℹ️  API stack is production-only (development uses local SAM)"

API_STACK="${STACK_PREFIX}-API"

echo "🚀 Deploying API Stack..."
echo "📝 Stack name: $API_STACK"
echo "🌍 Environment: $ENVIRONMENT"

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS CLI is not configured. Please run 'aws configure' or set AWS_PROFILE"
    exit 1
fi

# Check if Auth stack exists
AUTH_STACK_NAME="${STACK_PREFIX}-Auth"

if ! aws cloudformation describe-stacks --stack-name "$AUTH_STACK_NAME" --region us-east-1 &>/dev/null; then
    echo "❌ Error: Auth stack ($AUTH_STACK_NAME) not found. Deploy auth first:"
    echo "   ENVIRONMENT=$ENVIRONMENT npm run deploy:auth"
    exit 1
fi

# Build CDK if needed
cd cdk
if [ ! -d "node_modules" ]; then
    npm install
fi

# Install Lambda layer dependencies
echo "📦 Installing Lambda layer dependencies..."
cd lambda-layers/shared/nodejs
npm install --production
cd ../../../

# Build CDK project
echo "🔨 Building CDK project..."
rm -f lib/*.d.ts lib/*.js
npm run build

# Deploy API stack
echo "☁️  Deploying API Gateway, Lambda, and DynamoDB..."
ENVIRONMENT=$ENVIRONMENT npx cdk deploy "$API_STACK" --require-approval never "$@"

cd ..

echo "✅ API stack deployment complete!"
echo ""

# Get outputs
API_URL=$(aws cloudformation describe-stacks \
    --stack-name "$API_STACK" \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
    --output text \
    --region us-east-1 2>/dev/null)

if [ ! -z "$API_URL" ]; then
    echo "📋 API Configuration:"
    echo "   API URL: $API_URL"
    echo ""
    echo "💡 Add this to your .env.local file:"
    echo "   NEXT_PUBLIC_API_URL=$API_URL"
    
    if [ "$ENVIRONMENT" = "production" ]; then
        echo ""
        echo "🚨 Production API deployed!"
        echo "   Make sure to update your production environment variables"
    fi
fi