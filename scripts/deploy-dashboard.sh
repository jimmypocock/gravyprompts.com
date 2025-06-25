#!/bin/bash

# Deploy Monitoring Dashboard Stack
# This script deploys the comprehensive CloudWatch dashboard

set -e

# Load configuration
source "$(dirname "$0")/config.sh"

echo "📊 Deploying Monitoring Dashboard..."
echo "================================"

# Check AWS credentials
echo "🔐 Using AWS Profile: $AWS_PROFILE"
if ! aws sts get-caller-identity --profile "$AWS_PROFILE" &> /dev/null; then
    echo "❌ AWS credentials not configured for profile '$AWS_PROFILE'"
    echo "   Please run 'aws configure --profile $AWS_PROFILE' or set AWS_PROFILE to a configured profile"
    exit 1
fi

# Navigate to CDK directory
cd cdk

# Deploy the dashboard stack
echo "📈 Creating comprehensive monitoring dashboard..."
npx cdk deploy GRAVYPROMPTS-Dashboard \
  --profile "$AWS_PROFILE" \
  --require-approval never

echo ""
echo "✅ Monitoring Dashboard deployed successfully!"
echo ""
echo "📊 Dashboard Features:"
echo "  - Real-time cost tracking by service"
echo "  - API Gateway metrics (requests, errors, latency)"
echo "  - Lambda function performance"
echo "  - DynamoDB capacity and throttling"
echo "  - Cognito user activity"
echo "  - Amplify build metrics"
echo ""
echo "🔗 Access your dashboard at:"
echo "   https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=GRAVYPROMPTS-Complete-Dashboard"
echo ""
echo "💡 Tip: Bookmark the dashboard URL for quick access!"