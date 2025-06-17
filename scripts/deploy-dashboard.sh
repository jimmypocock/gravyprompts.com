#!/bin/bash

# Deploy Monitoring Dashboard Stack
# This script deploys the comprehensive CloudWatch dashboard

set -e

# Load environment variables from .env file if it exists
if [ -f .env ]; then
    # Use a safer method to export variables to handle special characters
    set -a
    source .env
    set +a
fi

echo "📊 Deploying Monitoring Dashboard..."
echo "================================"

# Navigate to CDK directory
cd cdk

# Set AWS profile if provided in .env
if [ ! -z "$AWS_PROFILE" ]; then
    echo "🔑 Using AWS Profile: $AWS_PROFILE"
    export AWS_PROFILE
fi

# Deploy the dashboard stack
echo "📈 Creating comprehensive monitoring dashboard..."
if [ ! -z "$AWS_PROFILE" ]; then
    npx cdk deploy GRAVYPROMPTS-Dashboard \
      --profile $AWS_PROFILE \
      --require-approval never
else
    npx cdk deploy GRAVYPROMPTS-Dashboard \
      --require-approval never
fi

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