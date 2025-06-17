#!/bin/bash

# Check Budget Status
# This script checks the current spend against budgets

set -e

# Load environment variables from .env file if it exists
if [ -f .env ]; then
    # Use a safer method to export variables to handle special characters
    set -a
    source .env
    set +a
fi

# Set AWS profile if provided
if [ ! -z "$AWS_PROFILE" ]; then
    AWS_PROFILE_FLAG="--profile $AWS_PROFILE"
else
    AWS_PROFILE_FLAG=""
fi

echo "💰 Checking Budget Status..."
echo "================================"
if [ ! -z "$AWS_PROFILE" ]; then
    echo "🔑 Using AWS Profile: $AWS_PROFILE"
fi

# Get current month spend
CURRENT_MONTH=$(date +%Y-%m)
START_DATE="${CURRENT_MONTH}-01"
END_DATE=$(date +%Y-%m-%d)

echo "📅 Period: $START_DATE to $END_DATE"
echo ""

# Get cost and usage
echo "📊 Current Month-to-Date Spend:"
TOTAL_COST=$(aws ce get-cost-and-usage \
  --time-period Start=$START_DATE,End=$END_DATE \
  --granularity MONTHLY \
  --metrics "UnblendedCost" \
  --query 'ResultsByTime[0].Total.UnblendedCost.Amount' \
  --output text $AWS_PROFILE_FLAG)
printf "  Total: $%.2f\n" "$TOTAL_COST"

echo ""
echo "📈 Top 5 Services by Cost:"
aws ce get-cost-and-usage \
  --time-period Start=$START_DATE,End=$END_DATE \
  --granularity MONTHLY \
  --metrics "UnblendedCost" \
  --group-by Type=DIMENSION,Key=SERVICE \
  --query 'ResultsByTime[0].Groups[:5]' \
  --output json $AWS_PROFILE_FLAG | jq -r '.[] | "\(.Keys[0])|\(.Metrics.UnblendedCost.Amount)"' | while IFS='|' read -r service cost; do
    printf "  %-30s $%.2f\n" "$service" "$cost"
done

echo ""
echo "🚨 Budget Alerts Status:"
# List all budgets
aws budgets describe-budgets \
  --account-id $(aws sts get-caller-identity $AWS_PROFILE_FLAG --query Account --output text) \
  --query 'Budgets[?starts_with(BudgetName, `GravyPrompts`)].{Name:BudgetName,Limit:BudgetLimit.Amount,Type:TimeUnit}' \
  --output table $AWS_PROFILE_FLAG

echo ""
echo "💡 To view detailed budget information:"
echo "   https://console.aws.amazon.com/billing/home#/budgets"