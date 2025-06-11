#!/bin/bash
# Find and stop the moderation Lambda

PROFILE="gravy"

echo "🔍 Finding moderation Lambda function..."
echo ""

# List all Lambda functions with 'moderate' in the name
echo "Lambda functions with 'moderate' in name:"
aws lambda list-functions \
  --profile $PROFILE \
  --query "Functions[?contains(FunctionName, 'moderat') || contains(FunctionName, 'Moderat')].FunctionName" \
  --output table

echo ""
echo "All Lambda functions for gravy-prompts:"
aws lambda list-functions \
  --profile $PROFILE \
  --query "Functions[?contains(FunctionName, 'gravy-prompts') || contains(FunctionName, 'gravy-prompts')].FunctionName" \
  --output table

echo ""
echo "To stop a Lambda, run:"
echo "aws lambda put-function-concurrency --function-name <FUNCTION_NAME> --reserved-concurrent-executions 0 --profile $PROFILE"
echo ""
echo "To check CloudWatch logs for high usage:"
echo "aws logs describe-log-groups --profile $PROFILE | grep -i moderat"