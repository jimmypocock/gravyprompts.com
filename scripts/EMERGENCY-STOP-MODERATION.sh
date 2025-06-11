#!/bin/bash
# EMERGENCY SCRIPT TO STOP MODERATION LAMBDA

echo "🚨 EMERGENCY: Stopping moderation Lambda..."

# 1. Disable the Lambda function
echo "Disabling Lambda function..."
aws lambda put-function-concurrency \
  --function-name gravy-prompts-production-ModerateContentFunction \
  --reserved-concurrent-executions 0

# 2. Also try to disable the trigger
echo "Listing event source mappings..."
aws lambda list-event-source-mappings \
  --function-name gravy-prompts-production-ModerateContentFunction \
  --query 'EventSourceMappings[*].[UUID,State]' \
  --output table

echo ""
echo "To disable a specific trigger, run:"
echo "aws lambda update-event-source-mapping --uuid <UUID> --enabled false"
echo ""
echo "To re-enable later (after fixing):"
echo "aws lambda put-function-concurrency --function-name gravy-prompts-production-ModerateContentFunction --reserved-concurrent-executions 10"