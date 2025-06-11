#!/bin/bash
# Check if moderation Lambda is stopped

echo "🔍 Checking if moderation Lambda is stopped..."
echo ""

# 1. Check function concurrency (0 means stopped)
echo "1. Checking Lambda concurrency:"
aws lambda get-function-concurrency \
  --function-name gravy-prompts-production-ModerateContentFunction \
  --query 'ReservedConcurrentExecutions' \
  --output text

echo ""
echo "If it shows '0' or 'None', the Lambda is stopped."
echo ""

# 2. Check current invocations
echo "2. Checking current invocations:"
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name ConcurrentExecutions \
  --dimensions Name=FunctionName,Value=gravy-prompts-production-ModerateContentFunction \
  --start-time $(date -u -d '5 minutes ago' --iso-8601) \
  --end-time $(date -u --iso-8601) \
  --period 60 \
  --statistics Maximum \
  --query 'Datapoints[*].[Timestamp,Maximum]' \
  --output table

echo ""
echo "3. Check for recent invocations (last 5 minutes):"
aws logs filter-log-events \
  --log-group-name '/aws/lambda/gravy-prompts-production-ModerateContentFunction' \
  --start-time $(date -d '5 minutes ago' +%s000) \
  --query 'events[-10:].timestamp' \
  --output text | while read ts; do
    if [ ! -z "$ts" ]; then
      date -d @$(($ts/1000))
    fi
done

echo ""
echo "If no recent timestamps, the Lambda has stopped running."
echo ""

# 4. Check Comprehend API calls
echo "4. Checking recent Comprehend API usage:"
aws cloudwatch get-metric-statistics \
  --namespace AWS/Comprehend \
  --metric-name SuccessfulRequestCount \
  --start-time $(date -u -d '10 minutes ago' --iso-8601) \
  --end-time $(date -u --iso-8601) \
  --period 300 \
  --statistics Sum \
  --query 'Datapoints[*].[Timestamp,Sum]' \
  --output table

echo ""
echo "✅ If all checks show no recent activity, the Lambda is stopped."
echo ""
echo "To check your AWS bill/usage:"
echo "1. Go to AWS Console > Billing > Bills"
echo "2. Look for Amazon Comprehend charges"
echo "3. Check CloudWatch > Billing to see current charges"