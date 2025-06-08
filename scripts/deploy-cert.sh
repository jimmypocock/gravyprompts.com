#!/bin/bash
set -e

# Load configuration
source "$(dirname "$0")/config.sh"

echo "🔐 Deploying Certificate Stack..."
echo "📝 Stack name: $CERTIFICATE_STACK"

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

# Deploy only the certificate stack
echo "☁️  Deploying certificate..."
# If we have an existing certificate ARN, use it
if [ ! -z "$CERTIFICATE_ARN" ]; then
    echo "Using existing certificate: $CERTIFICATE_ARN"
    npx cdk deploy "$CERTIFICATE_STACK" --require-approval never --context certificateArn="$CERTIFICATE_ARN" "$@"
else
    echo "Creating new certificate..."
    npx cdk deploy "$CERTIFICATE_STACK" --require-approval never --context createCertificate=true "$@"
fi

cd ..

echo "✅ Certificate deployment complete!"
echo ""

# Try to get certificate details immediately
CERT_ARN=$(aws cloudformation describe-stacks \
    --stack-name "$CERTIFICATE_STACK" \
    --query 'Stacks[0].Outputs[?OutputKey==`CertificateArnForReuse` || OutputKey==`ImportedCertificateArn` || OutputKey==`NewCertificateArn`].OutputValue | [0]' \
    --output text \
    --region us-east-1 2>/dev/null)

if [ ! -z "$CERT_ARN" ]; then
    echo "🔐 Certificate ARN: $CERT_ARN"
    echo ""
    
    # Get validation records
    echo "⚠️  DNS VALIDATION REQUIRED:"
    echo "================================="
    aws acm describe-certificate \
        --certificate-arn "$CERT_ARN" \
        --query 'Certificate.DomainValidationOptions[*].[DomainName,ResourceRecord.Name,ResourceRecord.Value]' \
        --output table \
        --region us-east-1
    echo "================================="
fi

echo ""
echo "📝 NEXT STEPS:"
echo "1. Add the CNAME records above to your DNS provider"
echo "2. Wait for DNS propagation (5-30 minutes)"
echo "3. Check validation status: npm run check:cert"
echo "4. Once validated, continue deployment: npm run deploy:all"
echo ""
echo "💡 TIP: Keep this terminal open to reference the CNAME records!"