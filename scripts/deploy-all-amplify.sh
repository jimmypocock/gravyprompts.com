#!/bin/bash
set -e

# Deploy all backend services for AWS Amplify hosting
# This replaces deploy-all-decoupled.sh for Amplify-based deployments

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

source "${SCRIPT_DIR}/config.sh"

echo "🚀 Deploying Backend Services for AWS Amplify..."
echo ""
echo "This script will deploy:"
echo "  ✓ Certificate Stack (if needed)"
echo "  ✓ Auth Stack (Cognito)"
echo "  ✓ API Stack (Lambda + DynamoDB)"
echo "  ✓ WAF Stack (optional)"
echo "  ✓ Monitoring Stack (adapted for Amplify)"
echo ""
echo "Frontend hosting will be handled by AWS Amplify"
echo ""

# Check AWS credentials
echo "🔐 Using AWS Profile: $AWS_PROFILE"
if ! aws sts get-caller-identity --profile "$AWS_PROFILE" &> /dev/null; then
    echo "❌ AWS credentials not configured for profile '$AWS_PROFILE'"
    echo "   Please run 'aws configure --profile $AWS_PROFILE' or set AWS_PROFILE to a configured profile"
    exit 1
fi

# Export environment variables for CDK
export APP_NAME="${APP_NAME}"
export DOMAIN_NAME="${DOMAIN_NAME}"
export STACK_PREFIX="${STACK_PREFIX}"
export CERTIFICATE_ARN="${CERTIFICATE_ARN}"

# Build CDK
echo "🔨 Building CDK..."
npm run build:cdk

cd "$SCRIPT_DIR/../cdk"

# Debug information
echo "🔍 Debug Information:"
echo "   AWS_REGION: ${AWS_REGION:-us-east-1}"
echo "   ENVIRONMENT: ${ENVIRONMENT}"
echo "   RAW_ENVIRONMENT: ${RAW_ENVIRONMENT}"
echo "   STACK_PREFIX: ${STACK_PREFIX}"
echo "   Current directory: $(pwd)"
echo ""

# First, synthesize all stacks
echo "📦 Synthesizing CDK stacks..."
"${SCRIPT_DIR}/cdk-env.sh" npx cdk synth --all --profile "$AWS_PROFILE"

# List available stacks
echo ""
echo "📋 Available stacks:"
"${SCRIPT_DIR}/cdk-env.sh" npx cdk list --profile "$AWS_PROFILE"
echo ""

# 1. Certificate Stack
echo ""
echo "========================================="
echo "1/5: Certificate Stack"
echo "========================================="

if [ ! -z "$CERTIFICATE_ARN" ] && [ "$CERTIFICATE_ARN" != "undefined" ]; then
    echo "✅ Using existing certificate: $CERTIFICATE_ARN"
else
    echo "📝 Creating new certificate..."
    "${SCRIPT_DIR}/cdk-env.sh" npx cdk deploy ${STACK_PREFIX}-Certificate \
        --require-approval never \
        --outputs-file certificate-outputs.json \
        --region ${AWS_REGION:-us-east-1} \
        --profile "$AWS_PROFILE"
    
    # Extract and save certificate ARN
    CERT_ARN=$(jq -r ".\"${STACK_PREFIX}-Certificate\".CertificateArn" certificate-outputs.json)
    
    # Update .env file
    if grep -q "CERTIFICATE_ARN=" "$SCRIPT_DIR/../.env" 2>/dev/null; then
        sed -i.bak "s|CERTIFICATE_ARN=.*|CERTIFICATE_ARN=$CERT_ARN|" "$SCRIPT_DIR/../.env"
    else
        echo "CERTIFICATE_ARN=$CERT_ARN" >> "$SCRIPT_DIR/../.env"
    fi
    
    echo "✅ Certificate ARN saved to .env file"
    echo ""
    echo "⚠️  IMPORTANT: Certificate validation required!"
    echo "================================="
    aws acm describe-certificate \
        --certificate-arn "$CERT_ARN" \
        --query 'Certificate.DomainValidationOptions[*].[DomainName,ResourceRecord.Name,ResourceRecord.Value]' \
        --output table \
        --region us-east-1 \
        --profile "$AWS_PROFILE"
    echo "================================="
    echo ""
    echo "1. Add the CNAME records shown above to your DNS provider"
    echo "2. Wait for validation (usually 5-30 minutes)"
    echo "3. Check validation status with: aws acm describe-certificate --certificate-arn \"$CERT_ARN\" --region us-east-1 --profile \"$AWS_PROFILE\" --query 'Certificate.Status'"
    echo ""
    read -p "Press Enter when certificate is validated..."
fi

# 2. Auth Stack
echo ""
echo "========================================="
echo "2/5: Auth Stack"
echo "========================================="
# Auth stack includes environment in the name
AUTH_STACK_NAME="${STACK_PREFIX}-Auth-${ENVIRONMENT}"
echo "Deploying Auth stack: ${AUTH_STACK_NAME}"

# Pass environment context to CDK
CDK_CONTEXT=""
if [ "$RAW_ENVIRONMENT" = "production" ]; then
    CDK_CONTEXT="-c environment=production"
fi

"${SCRIPT_DIR}/cdk-env.sh" npx cdk deploy ${AUTH_STACK_NAME} \
    --require-approval never \
    --outputs-file auth-outputs.json \
    --region ${AWS_REGION:-us-east-1} \
    --profile "$AWS_PROFILE" \
    $CDK_CONTEXT

# 3. API Stack
echo ""
echo "========================================="
echo "3/5: API Stack"
echo "========================================="
# API stack name varies by environment
if [ "$ENVIRONMENT" = "Prod" ]; then
    API_STACK_NAME="${STACK_PREFIX}-API-Prod"
else
    API_STACK_NAME="${STACK_PREFIX}-API"
fi
echo "Deploying API stack: ${API_STACK_NAME}"

"${SCRIPT_DIR}/cdk-env.sh" npx cdk deploy ${API_STACK_NAME} \
    --require-approval never \
    --outputs-file api-outputs.json \
    --region ${AWS_REGION:-us-east-1} \
    --profile "$AWS_PROFILE"

# 4. WAF Stack (optional)
echo ""
echo "========================================="
echo "4/5: WAF Stack (Optional)"
echo "========================================="
read -p "Deploy WAF Stack for additional security? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    "${SCRIPT_DIR}/cdk-env.sh" npx cdk deploy ${STACK_PREFIX}-WAF \
        --require-approval never \
        --region ${AWS_REGION:-us-east-1} \
        --profile "$AWS_PROFILE"
    echo "✅ WAF Stack deployed"
else
    echo "⏭️  Skipping WAF Stack"
fi

# 5. Monitoring Stack
echo ""
echo "========================================="
echo "5/5: Monitoring Stack"
echo "========================================="
read -p "Deploy Monitoring Stack? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "Enter email for alerts (optional): " EMAIL
    
    # Get API name for monitoring
    API_NAME=$(jq -r ".\"${API_STACK_NAME}\".ApiName" api-outputs.json 2>/dev/null || echo "")
    
    MONITORING_PARAMS="-c amplifyMonitoring=true"
    if [ ! -z "$EMAIL" ]; then
        MONITORING_PARAMS="$MONITORING_PARAMS -c emailAddress=$EMAIL"
    fi
    if [ ! -z "$API_NAME" ]; then
        MONITORING_PARAMS="$MONITORING_PARAMS -c apiGatewayName=$API_NAME"
    fi
    
    "${SCRIPT_DIR}/cdk-env.sh" npx cdk deploy ${STACK_PREFIX}-Monitoring-Amplify \
        --require-approval never \
        --region ${AWS_REGION:-us-east-1} \
        --profile "$AWS_PROFILE" \
        $MONITORING_PARAMS
    
    echo "✅ Monitoring Stack deployed"
else
    echo "⏭️  Skipping Monitoring Stack"
fi

# Extract outputs for Amplify
echo ""
echo "✅ Backend deployment complete!"
echo ""
echo "========================================="
echo "📋 Environment Variables for AWS Amplify"
echo "========================================="
echo ""

# API configuration
API_URL=$(jq -r ".\"${API_STACK_NAME}\".ApiUrl" api-outputs.json)
echo "NEXT_PUBLIC_API_URL=$API_URL"

# Auth configuration
USER_POOL_ID=$(jq -r ".\"${AUTH_STACK_NAME}\".UserPoolId" auth-outputs.json)
CLIENT_ID=$(jq -r ".\"${AUTH_STACK_NAME}\".UserPoolClientId" auth-outputs.json)
echo "NEXT_PUBLIC_COGNITO_USER_POOL_ID_PROD=$USER_POOL_ID"
echo "NEXT_PUBLIC_COGNITO_CLIENT_ID_PROD=$CLIENT_ID"

# App URL
echo "NEXT_PUBLIC_APP_URL=https://${DOMAIN_NAME}"

# Optional analytics
echo ""
echo "# Optional Analytics:"
echo "NEXT_PUBLIC_GA_MEASUREMENT_ID=${NEXT_PUBLIC_GA_MEASUREMENT_ID:-G-XXXXXXXXXX}"
echo "NEXT_PUBLIC_ADSENSE_CLIENT_ID=${NEXT_PUBLIC_ADSENSE_CLIENT_ID:-ca-pub-xxxxxxxxxxxxxxxx}"

echo ""
echo "========================================="
echo "📝 Next Steps"
echo "========================================="
echo ""
echo "1. Copy all environment variables above"
echo "2. Go to AWS Amplify Console:"
echo "   https://console.aws.amazon.com/amplify/home?region=${AWS_REGION}"
echo "3. Click 'New app' → 'Host web app'"
echo "4. Connect your GitHub repository"
echo "5. Add environment variables in Amplify settings"
echo "6. Deploy!"
echo ""
echo "For detailed instructions, see AMPLIFY_SETUP.md"
echo ""

# Clean up output files
rm -f certificate-outputs.json auth-outputs.json api-outputs.json