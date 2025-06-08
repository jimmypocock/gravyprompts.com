#!/bin/bash
set -e

# Load configuration
source "$(dirname "$0")/config.sh"

echo "🔐 Certificate-First Deployment Process"
echo "======================================"
echo ""

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS CLI is not configured. Please run 'aws configure' or set AWS_PROFILE"
    exit 1
fi

# Step 1: Check if certificate exists
echo "🔍 Step 1: Checking for existing certificate..."
EXISTING_CERT_ARN=$(aws acm list-certificates \
    --query "CertificateSummaryList[?DomainName=='$DOMAIN_NAME'].CertificateArn | [0]" \
    --output text \
    --region us-east-1 2>/dev/null)

if [ "$EXISTING_CERT_ARN" != "null" ] && [ "$EXISTING_CERT_ARN" != "None" ] && [ ! -z "$EXISTING_CERT_ARN" ]; then
    echo "✅ Found existing certificate: $EXISTING_CERT_ARN"
    
    # Update .env file
    if grep -q "^CERTIFICATE_ARN=" .env; then
        sed -i.bak "s|^CERTIFICATE_ARN=.*|CERTIFICATE_ARN=$EXISTING_CERT_ARN|" .env
    else
        echo "" >> .env
        echo "# Certificate Manager" >> .env
        echo "CERTIFICATE_ARN=$EXISTING_CERT_ARN" >> .env
    fi
    
    echo "✅ Updated .env file with certificate ARN"
    echo ""
    echo "🎉 Certificate already exists! You can proceed with:"
    echo "   npm run deploy:all"
    exit 0
fi

# Step 2: Deploy certificate stack to create new certificate
echo ""
echo "🆕 Step 2: Creating new certificate..."
cd cdk

# Ensure dependencies are installed
if [ ! -d "node_modules" ]; then
    npm install
fi

# Build CDK
rm -f lib/*.d.ts lib/*.js
npm run build

# Deploy certificate stack with createCertificate context
npx cdk deploy "$CERTIFICATE_STACK" \
    --require-approval never \
    --context createCertificate=true \
    "$@"

cd ..

# Step 3: Get the new certificate ARN
echo ""
echo "🔍 Step 3: Retrieving new certificate ARN..."
NEW_CERT_ARN=$(aws cloudformation describe-stacks \
    --stack-name "$CERTIFICATE_STACK" \
    --query 'Stacks[0].Outputs[?OutputKey==`CertificateArn`].OutputValue | [0]' \
    --output text \
    --region us-east-1 2>/dev/null)

if [ -z "$NEW_CERT_ARN" ] || [ "$NEW_CERT_ARN" == "null" ]; then
    echo "❌ Failed to retrieve certificate ARN from stack"
    exit 1
fi

echo "✅ Certificate created: $NEW_CERT_ARN"

# Step 4: Update .env file
echo ""
echo "📝 Step 4: Updating .env file..."
if grep -q "^CERTIFICATE_ARN=" .env; then
    sed -i.bak "s|^CERTIFICATE_ARN=.*|CERTIFICATE_ARN=$NEW_CERT_ARN|" .env
else
    echo "" >> .env
    echo "# Certificate Manager" >> .env
    echo "CERTIFICATE_ARN=$NEW_CERT_ARN" >> .env
fi

echo "✅ Updated .env file with certificate ARN"

# Step 5: Show DNS validation records
echo ""
echo "⚠️  Step 5: DNS VALIDATION REQUIRED"
echo "=================================="
aws acm describe-certificate \
    --certificate-arn "$NEW_CERT_ARN" \
    --query 'Certificate.DomainValidationOptions[*].[DomainName,ResourceRecord.Name,ResourceRecord.Value]' \
    --output table \
    --region us-east-1
echo "=================================="

echo ""
echo "📋 NEXT STEPS:"
echo "1. Add the CNAME records above to your DNS provider"
echo "2. Wait for DNS propagation (5-30 minutes)"
echo "3. Check validation status: npm run check:cert"
echo "4. Once validated, run: npm run deploy:all"
echo ""
echo "💡 Your certificate ARN has been saved to .env"
echo "   Future deployments will use this certificate automatically!"