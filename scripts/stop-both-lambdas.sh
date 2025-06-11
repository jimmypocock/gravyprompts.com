#!/bin/bash
# Stop both moderation Lambdas

PROFILE="gravy"

echo "🚨 Stopping BOTH moderation Lambdas..."
echo ""

# Stop first Lambda
echo "Stopping Lambda 1..."
aws lambda put-function-concurrency \
  --function-name "GRAVYPROMPTS-API-ModerateContentFunction03485027-moOUJl1PTiXE" \
  --reserved-concurrent-executions 0 \
  --profile $PROFILE

# Stop second Lambda
echo "Stopping Lambda 2..."
aws lambda put-function-concurrency \
  --function-name "GRAVYPROMPTS-API-Prod-ModerateContentFunction03485-tEEOvoE3P9PU" \
  --reserved-concurrent-executions 0 \
  --profile $PROFILE

echo ""
echo "✅ Both Lambdas should be stopped"
echo ""
echo "Checking status..."

# Check both
echo "Lambda 1 concurrency:"
aws lambda get-function-concurrency \
  --function-name "GRAVYPROMPTS-API-ModerateContentFunction03485027-moOUJl1PTiXE" \
  --profile $PROFILE \
  --query 'ReservedConcurrentExecutions' 2>/dev/null || echo "Not set"

echo "Lambda 2 concurrency:"
aws lambda get-function-concurrency \
  --function-name "GRAVYPROMPTS-API-Prod-ModerateContentFunction03485-tEEOvoE3P9PU" \
  --profile $PROFILE \
  --query 'ReservedConcurrentExecutions' 2>/dev/null || echo "Not set"