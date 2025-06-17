#!/bin/bash

# Deploy Budget Stack
# This script deploys the AWS Budgets stack for cost monitoring

set -e

# Load environment variables from .env file if it exists
if [ -f .env ]; then
    # Use a safer method to export variables to handle special characters
    set -a
    source .env
    set +a
fi

echo "🚀 Deploying Budget Stack..."
echo "================================"

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

# Set AWS profile if provided in .env
if [ ! -z "$AWS_PROFILE" ]; then
    echo "🔑 Using AWS Profile: $AWS_PROFILE"
    export AWS_PROFILE
fi

# Bootstrap CDK if needed
echo "🔧 Checking CDK bootstrap status..."
if [ ! -z "$AWS_PROFILE" ]; then
    npx cdk bootstrap aws://$(aws sts get-caller-identity --profile $AWS_PROFILE --query Account --output text)/us-east-1 --profile $AWS_PROFILE || true
else
    npx cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/us-east-1 || true
fi

# Deploy the budget stack
echo "💰 Deploying budget alerts..."
if [ ! -z "$AWS_PROFILE" ]; then
    npx cdk deploy GRAVYPROMPTS-Budget \
      --context alertEmail="$BUDGET_ALERT_EMAIL" \
      --profile $AWS_PROFILE \
      --require-approval never
else
    npx cdk deploy GRAVYPROMPTS-Budget \
      --context alertEmail="$BUDGET_ALERT_EMAIL" \
      --require-approval never
fi

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