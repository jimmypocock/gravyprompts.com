#!/bin/bash

# Script to destroy frontend-related stacks when migrating to Amplify
# These stacks are no longer needed as Amplify handles hosting

set -e

source "$(dirname "$0")/config.sh"

echo "🗑️  Destroying frontend stacks for migration to AWS Amplify..."
echo "⚠️  WARNING: This will delete the following stacks:"
echo "  - ${STACK_PREFIX}-App (content deployment)"
echo "  - ${STACK_PREFIX}-CDN (CloudFront distribution)"
echo "  - ${STACK_PREFIX}-EdgeFunctions (CloudFront functions)"
echo "  - ${STACK_PREFIX}-Foundation (S3 buckets)"
echo ""
echo "The following stacks will be KEPT:"
echo "  ✓ ${STACK_PREFIX}-Api (Lambda + DynamoDB)"
echo "  ✓ ${STACK_PREFIX}-Auth-${ENVIRONMENT} (Cognito)"
echo "  ✓ ${STACK_PREFIX}-Certificate (ACM)"
echo "  ✓ ${STACK_PREFIX}-WAF (optional security)"
echo "  ✓ ${STACK_PREFIX}-Monitoring (CloudWatch)"
echo ""
read -p "Are you sure you want to proceed? (yes/no): " -r
echo

if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "❌ Destruction cancelled."
    exit 1
fi

# Function to safely destroy a stack
destroy_stack() {
    local stack_name=$1
    echo "🔍 Checking if stack ${stack_name} exists..."
    
    if aws cloudformation describe-stacks --stack-name "${stack_name}" --region ${AWS_REGION} >/dev/null 2>&1; then
        echo "🗑️  Destroying stack: ${stack_name}..."
        cd "$SCRIPT_DIR/../cdk"
        npx cdk destroy "${stack_name}" --force
        echo "✅ Stack ${stack_name} destroyed"
    else
        echo "⏭️  Stack ${stack_name} not found, skipping..."
    fi
}

# Destroy in reverse dependency order
echo ""
echo "1️⃣  Destroying App stack..."
destroy_stack "${STACK_PREFIX}-App"

echo ""
echo "2️⃣  Destroying CDN stack..."
destroy_stack "${STACK_PREFIX}-CDN"

echo ""
echo "3️⃣  Destroying Edge Functions stack..."
destroy_stack "${STACK_PREFIX}-EdgeFunctions"

echo ""
echo "4️⃣  Destroying Foundation stack..."
echo "⚠️  This will delete S3 buckets. Make sure you've backed up any important data!"
read -p "Continue with Foundation stack deletion? (yes/no): " -r
echo

if [[ $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    # First, empty the S3 buckets
    BUCKET_NAME="${APP_NAME}-content-${AWS_ACCOUNT_ID}-${AWS_REGION}"
    LOGS_BUCKET="${APP_NAME}-logs-${AWS_ACCOUNT_ID}-${AWS_REGION}"
    
    echo "🧹 Emptying S3 buckets..."
    aws s3 rm "s3://${BUCKET_NAME}" --recursive || true
    aws s3 rm "s3://${LOGS_BUCKET}" --recursive || true
    
    destroy_stack "${STACK_PREFIX}-Foundation"
else
    echo "⏭️  Skipping Foundation stack deletion"
fi

echo ""
echo "✅ Frontend stack cleanup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Set up AWS Amplify hosting in the AWS Console"
echo "2. Connect your GitHub repository"
echo "3. Configure environment variables in Amplify:"
echo "   - NEXT_PUBLIC_API_URL (your API Gateway URL)"
echo "   - NEXT_PUBLIC_COGNITO_USER_POOL_ID_PROD"
echo "   - NEXT_PUBLIC_COGNITO_CLIENT_ID_PROD"
echo "   - NEXT_PUBLIC_GA_MEASUREMENT_ID"
echo "   - NEXT_PUBLIC_ADSENSE_CLIENT_ID"
echo "4. Deploy your app through Amplify"
echo ""
echo "🔗 Your API is still available at:"
aws cloudformation describe-stacks \
    --stack-name "${STACK_PREFIX}-Api" \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
    --output text \
    --region ${AWS_REGION} 2>/dev/null || echo "API stack not found"