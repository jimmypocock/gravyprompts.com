#!/bin/bash
# Analyze AWS Comprehend usage and costs

PROFILE="${AWS_PROFILE:-gravy}"
REGION="${AWS_REGION:-us-east-1}"

echo "🔍 Analyzing AWS Comprehend Usage..."
echo "=================================="
echo ""

# Set date range (last 2 days)
START_DATE=$(date -u -d '2 days ago' '+%Y-%m-%dT00:00:00Z')
END_DATE=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

echo "Date range: $START_DATE to $END_DATE"
echo ""

# Function to check metrics for an operation
check_operation_metrics() {
    local operation=$1
    echo "Checking $operation..."
    
    result=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/Comprehend \
        --metric-name SuccessfulRequestCount \
        --dimensions Name=Operation,Value=$operation \
        --start-time $START_DATE \
        --end-time $END_DATE \
        --period 3600 \
        --statistics Sum \
        --profile $PROFILE \
        --region $REGION \
        --query 'Datapoints[*].[Timestamp,Sum]' \
        --output text 2>/dev/null)
    
    if [ -z "$result" ]; then
        echo "  No calls found"
    else
        total=$(echo "$result" | awk '{sum += $2} END {print sum}')
        echo "  Total calls: $total"
        echo "$result" | while read line; do
            timestamp=$(echo $line | awk '{print $1}')
            count=$(echo $line | awk '{print $2}')
            if [ ! -z "$count" ] && [ "$count" != "0" ]; then
                echo "    $timestamp: $count calls"
            fi
        done
    fi
    echo ""
}

echo "📊 Comprehend API Calls by Operation:"
echo "------------------------------------"
check_operation_metrics "DetectSentiment"
check_operation_metrics "DetectPiiEntities"
check_operation_metrics "DetectToxicContent"
check_operation_metrics "DetectEntities"
check_operation_metrics "DetectKeyPhrases"

echo "💰 Checking Cost Data..."
echo "------------------------"
echo "Note: Cost data may have up to 24-hour delay"
echo ""

# Get cost data from Cost Explorer
aws ce get-cost-and-usage \
    --time-period Start=$START_DATE,End=$END_DATE \
    --granularity DAILY \
    --metrics "UnblendedCost" \
    --filter '{
        "Dimensions": {
            "Key": "SERVICE",
            "Values": ["Amazon Comprehend"]
        }
    }' \
    --profile $PROFILE \
    --query 'ResultsByTime[*].[TimePeriod.Start,Total.UnblendedCost.Amount]' \
    --output table

echo ""
echo "🔥 Lambda Invocation Metrics:"
echo "-----------------------------"

# List Lambda functions with moderation in the name
lambda_functions=$(aws lambda list-functions \
    --profile $PROFILE \
    --query "Functions[?contains(FunctionName, 'Moderat')].FunctionName" \
    --output text)

for func in $lambda_functions; do
    echo "Function: $func"
    
    # Get invocation count
    invocations=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/Lambda \
        --metric-name Invocations \
        --dimensions Name=FunctionName,Value=$func \
        --start-time $START_DATE \
        --end-time $END_DATE \
        --period 3600 \
        --statistics Sum \
        --profile $PROFILE \
        --query 'Datapoints[*].Sum' \
        --output text | awk '{sum += $1} END {print sum}')
    
    echo "  Total invocations: ${invocations:-0}"
    
    # Get error count
    errors=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/Lambda \
        --metric-name Errors \
        --dimensions Name=FunctionName,Value=$func \
        --start-time $START_DATE \
        --end-time $END_DATE \
        --period 3600 \
        --statistics Sum \
        --profile $PROFILE \
        --query 'Datapoints[*].Sum' \
        --output text | awk '{sum += $1} END {print sum}')
    
    echo "  Total errors: ${errors:-0}"
    echo ""
done

echo "📈 To see detailed cost breakdown:"
echo "1. Go to AWS Console > Billing > Cost Explorer"
echo "2. Filter by Service: 'Amazon Comprehend'"
echo "3. Group by: 'Usage Type'"
echo "4. Set time range to last 7 days"
echo ""
echo "🔍 To investigate specific Lambda logs:"
echo "aws logs tail /aws/lambda/<function-name> --follow --profile $PROFILE"
echo ""
echo "⚠️  To set up billing alerts:"
echo "1. AWS Console > Billing > Budgets"
echo "2. Create budget with email alerts"
echo "3. Set threshold (e.g., \$10/day for Comprehend)"