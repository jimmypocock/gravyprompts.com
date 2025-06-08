#!/bin/bash
set -e

# Load configuration
source "$(dirname "$0")/config.sh"

echo "🚀 Deploying All Stacks (Decoupled Architecture)..."

# Pass all arguments to each deployment script
ARGS="$@"

# Check if NextJS build is requested
BUILD_NEXTJS=false
for arg in "$@"; do
    if [[ $arg == "--nextjs" ]]; then
        BUILD_NEXTJS=true
    fi
done

# Build NextJS once if requested
if [ "$BUILD_NEXTJS" = true ]; then
    echo "🏗️  Building NextJS application..."
    npm install
    npm run build
fi

# Check if foundation exists
FOUNDATION_EXISTS=$(aws cloudformation describe-stacks --stack-name "$FOUNDATION_STACK" --region us-east-1 2>&1 | grep -c "$FOUNDATION_STACK" || true)

if [ "$FOUNDATION_EXISTS" -gt 0 ]; then
    echo "✅ Foundation stack already exists"
else
    echo ""
    echo "========================================="
    echo "1/6: Deploying Foundation Stack"
    echo "========================================="
    ./scripts/deploy-foundation.sh $ARGS
fi

# Check if certificate ARN is configured
if [ -z "$CERTIFICATE_ARN" ]; then
    echo ""
    echo "❌ No certificate ARN found in .env file"
    echo "   Please run: npm run deploy:cert:first"
    echo "   This will create a certificate and save the ARN to your .env file"
    echo ""
    exit 1
fi

echo "✅ Using certificate: $CERTIFICATE_ARN"

# Verify certificate exists and is valid
CERT_STATUS=$(aws acm describe-certificate \
    --certificate-arn "$CERTIFICATE_ARN" \
    --query 'Certificate.Status' \
    --output text \
        --region us-east-1 2>/dev/null || echo "UNKNOWN")

if [ "$CERT_STATUS" = "ISSUED" ]; then
    echo "✅ Certificate is validated and ready"
elif [ "$CERT_STATUS" = "PENDING_VALIDATION" ]; then
    echo "⚠️  Certificate is pending validation!"
    echo "   Please add the DNS validation records and wait for validation"
    echo "   Run: npm run check:cert"
    echo ""
    read -p "Continue deployment without custom domain? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Deployment cancelled. Please validate certificate first."
        exit 1
    fi
    # Clear certificate ARN to deploy without custom domain
    CERTIFICATE_ARN=""
elif [ "$CERT_STATUS" = "UNKNOWN" ]; then
    echo "❌ Certificate ARN not found or invalid!"
    echo "   Please run: npm run deploy:cert:first"
    exit 1
else
    echo "⚠️  Certificate status: $CERT_STATUS"
fi

# Deploy Edge Functions
echo ""
echo "========================================="
echo "3/6: Deploying Edge Functions Stack"
echo "========================================="
# Make sure CERTIFICATE_ARN is available to subscripts
export CERTIFICATE_ARN
# Pass certificate ARN as context to prevent certificate stack creation
ARGS_WITH_CERT="$ARGS --context certificateArn=$CERTIFICATE_ARN"
./scripts/deploy-edge-functions.sh $ARGS_WITH_CERT

# Deploy WAF
echo ""
echo "========================================="
echo "4/6: Deploying WAF Stack"
echo "========================================="
./scripts/deploy-waf.sh $ARGS_WITH_CERT

# Deploy CDN
echo ""
echo "========================================="
echo "5/7: Deploying CDN Stack"
echo "========================================="
# Don't pass --nextjs again since we already built it
./scripts/deploy-cdn.sh ${ARGS_WITH_CERT//--nextjs/}

# Deploy App Content
echo ""
echo "========================================="
echo "6/7: Deploying Application Content"
echo "========================================="
./scripts/deploy-app-content.sh $ARGS_WITH_CERT

# Deploy Monitoring
echo ""
echo "========================================="
echo "7/7: Deploying Monitoring Stack"
echo "========================================="
./scripts/deploy-monitoring.sh $ARGS_WITH_CERT

echo ""
echo "========================================="
echo "✅ ALL STACKS DEPLOYED SUCCESSFULLY!"
echo "========================================="
echo ""
echo "📋 Your infrastructure:"
echo "   Foundation:     S3 buckets for content and logs"
echo "   Certificate:    SSL/TLS certificate"
echo "   Edge Functions: URL redirects and security headers"
echo "   WAF:           Rate limiting and security rules"
echo "   CDN:           CloudFront distribution"
echo "   App:           Application content deployment"
echo "   Monitoring:    CloudWatch dashboards and alerts"
echo ""
echo "🌐 Your site is available at:"
echo "   https://www.$DOMAIN_NAME"
echo ""
echo "📊 CloudWatch Dashboard:"
echo "   https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:"

# Check if notification email was provided
for arg in "$@"; do
    if [[ $arg == *"notificationEmail="* ]]; then
        EMAIL=$(echo $arg | cut -d'=' -f2)
        echo ""
        echo "📧 Remember to check $EMAIL for SNS subscription confirmation!"
    fi
done