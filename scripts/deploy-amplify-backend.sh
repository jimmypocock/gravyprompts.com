#!/bin/bash

# Deploy only backend services for AWS Amplify hosting setup
# This script deploys Auth and API stacks only, skipping frontend-related stacks

set -e

source "$(dirname "$0")/config.sh"

echo "🚀 Deploying backend services for AWS Amplify setup..."
echo "📋 This will deploy:"
echo "  ✓ Certificate Stack (reuse existing if available)"
echo "  ✓ Auth Stack (Cognito)"
echo "  ✓ API Stack (Lambda + DynamoDB)"
echo "  ✓ API WAF Stack (security for API Gateway)"
echo ""
echo "❌ This will NOT deploy:"
echo "  - Foundation Stack (S3 buckets)"
echo "  - Edge Functions Stack"
echo "  - CDN Stack (CloudFront)"
echo "  - App Stack (content deployment)"
echo "  - Monitoring Stack (requires CDN)"
echo ""

# Build CDK TypeScript files
echo "🔨 Building CDK..."
npm run build:cdk

cd "$SCRIPT_DIR/../cdk"

# Check for existing certificate
echo ""
echo "🔐 Checking for existing certificate..."
if [ ! -z "$CERTIFICATE_ARN" ] && [ "$CERTIFICATE_ARN" != "undefined" ]; then
    echo "✅ Using existing certificate: $CERTIFICATE_ARN"
else
    echo "📝 Deploying Certificate Stack..."
    npx cdk deploy ${STACK_PREFIX}-Certificate \
        --require-approval never \
        --outputs-file certificate-outputs.json
    
    # Extract and save certificate ARN
    CERT_ARN=$(jq -r ".\"${STACK_PREFIX}-Certificate\".CertificateArn" certificate-outputs.json)
    
    # Update .env file
    if grep -q "CERTIFICATE_ARN=" "$SCRIPT_DIR/../.env" 2>/dev/null; then
        sed -i.bak "s|CERTIFICATE_ARN=.*|CERTIFICATE_ARN=$CERT_ARN|" "$SCRIPT_DIR/../.env"
    else
        echo "CERTIFICATE_ARN=$CERT_ARN" >> "$SCRIPT_DIR/../.env"
    fi
    
    echo "✅ Certificate ARN saved to .env file"
    echo "🔍 Certificate validation status:"
    npm run check:cert
    echo ""
    echo "⚠️  Add the CNAME records shown above to your DNS provider"
    echo "⏳ Wait for validation (usually 5-30 minutes) before continuing"
    read -p "Press Enter when certificate is validated..."
fi

# Deploy Auth Stack
echo ""
echo "🔐 Deploying Auth Stack..."
npx cdk deploy ${STACK_PREFIX}-Auth \
    --require-approval never \
    --outputs-file auth-outputs.json

# Deploy API Stack
echo ""
echo "🌐 Deploying API Stack..."
npx cdk deploy ${STACK_PREFIX}-API \
    --require-approval never \
    --outputs-file api-outputs.json

# Deploy API WAF Stack
echo ""
echo "🛡️ Deploying API WAF Stack for enhanced security..."
npx cdk deploy ${STACK_PREFIX}-API-WAF \
    --require-approval never

# Note: The CloudFront WAF (${STACK_PREFIX}-WAF) is only needed if using CloudFront CDN

# Extract outputs for Amplify configuration
echo ""
echo "✅ Backend deployment complete!"
echo ""
echo "📋 Configuration for AWS Amplify:"
echo "================================"

# Get API URL
API_URL=$(jq -r ".\"${STACK_PREFIX}-API\".ApiUrl" api-outputs.json)
echo "NEXT_PUBLIC_API_URL=$API_URL"

# Get Auth configuration
USER_POOL_ID=$(jq -r ".\"${STACK_PREFIX}-Auth\".UserPoolId" auth-outputs.json)
CLIENT_ID=$(jq -r ".\"${STACK_PREFIX}-Auth\".UserPoolClientId" auth-outputs.json)
echo "NEXT_PUBLIC_COGNITO_USER_POOL_ID=$USER_POOL_ID"
echo "NEXT_PUBLIC_COGNITO_CLIENT_ID=$CLIENT_ID"

echo ""
echo "📝 Next steps:"
echo "1. Copy the environment variables above"
echo "2. Go to AWS Amplify Console"
echo "3. Create a new app and connect your GitHub repository"
echo "4. Add the environment variables in Amplify settings"
echo "5. Deploy your app!"
echo ""
echo "🔗 Useful links:"
echo "- Amplify Console: https://console.aws.amazon.com/amplify/home?region=${AWS_REGION}"
echo "- Setup Guide: See AMPLIFY_SETUP.md for detailed instructions"