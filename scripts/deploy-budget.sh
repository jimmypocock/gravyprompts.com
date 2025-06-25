#!/bin/bash

# Deploy Budget Stack
# This script deploys the AWS Budgets stack for cost monitoring

set -e

# Load configuration
source "$(dirname "$0")/config.sh"

echo "🚀 Deploying Budget Stack..."
echo "================================"

# Check AWS credentials
echo "🔐 Using AWS Profile: $AWS_PROFILE"
if ! aws sts get-caller-identity --profile "$AWS_PROFILE" &> /dev/null; then
    echo "❌ AWS credentials not configured for profile '$AWS_PROFILE'"
    echo "   Please run 'aws configure --profile $AWS_PROFILE' or set AWS_PROFILE to a configured profile"
    exit 1
fi

# Check if email is provided
if [ -z "$BUDGET_ALERT_EMAIL" ]; then
    echo "⚠️  No BUDGET_ALERT_EMAIL found in .env file"
    echo "📧 Please provide an email for budget alerts:"
    read -p "Email address: " email
    export BUDGET_ALERT_EMAIL="$email"
fi

echo "📧 Budget alerts will be sent to: $BUDGET_ALERT_EMAIL"
echo ""

# Navigate to CDK directory
cd cdk

# Bootstrap CDK if needed
echo "🔧 Checking CDK bootstrap status..."
npx cdk bootstrap aws://$(aws sts get-caller-identity --profile "$AWS_PROFILE" --query Account --output text)/us-east-1 --profile "$AWS_PROFILE" || true

# Deploy the budget stack
echo "💰 Deploying budget alerts..."
npx cdk deploy GRAVYPROMPTS-Budget \
  --context alertEmail="$BUDGET_ALERT_EMAIL" \
  --profile "$AWS_PROFILE" \
  --require-approval never

echo ""
echo "✅ Budget Stack deployed successfully!"
echo ""
echo "📊 Budget Configuration:"
echo "  - Total Monthly Budget: $50"
echo "  - Service-specific budgets for Lambda, DynamoDB, API Gateway, etc."
echo "  - Daily anomaly detection: Alerts if daily spend > $5"
echo "  - Alert thresholds: 80% and 100% of budget"
echo ""
echo "📧 You'll receive a confirmation email from AWS SNS."
echo "   Please click the link to confirm your subscription to budget alerts."
echo ""
echo "💡 To view your budgets in AWS Console:"
echo "   https://console.aws.amazon.com/billing/home#/budgets"