#!/bin/bash
# Check TODAY's actual Comprehend usage

PROFILE="${AWS_PROFILE:-gravy}"
REGION="${AWS_REGION:-us-east-1}"

echo "📊 Checking TODAY's Comprehend Usage"
echo "===================================="
echo ""

# Get today's date range
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    TODAY_START=$(date -u -v0H -v0M -v0S '+%Y-%m-%dT%H:%M:%SZ')
    NOW=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
else
    # Linux
    TODAY_START=$(date -u -d 'today 00:00:00' '+%Y-%m-%dT%H:%M:%SZ')
    NOW=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
fi

echo "Date range: $TODAY_START to $NOW"
echo ""

# Function to check today's metrics
check_todays_usage() {
    local operation=$1
    echo -n "$operation: "
    
    result=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/Comprehend \
        --metric-name SuccessfulRequestCount \
        --dimensions Name=Operation,Value=$operation \
        --start-time $TODAY_START \
        --end-time $NOW \
        --period 3600 \
        --statistics Sum \
        --profile $PROFILE \
        --region $REGION \
        --query 'Datapoints[*].[Timestamp,Sum]' \
        --output text 2>/dev/null)
    
    if [ -z "$result" ]; then
        echo "0 calls today"
    else
        total=$(echo "$result" | awk '{sum += $2} END {print sum}')
        echo "$total calls today"
        
        # Show hourly breakdown if there were calls
        if [ "$total" != "0" ]; then
            echo "  Hourly breakdown:"
            echo "$result" | while read line; do
                timestamp=$(echo $line | awk '{print $1}')
                count=$(echo $line | awk '{print $2}')
                if [ ! -z "$count" ] && [ "$count" != "0" ]; then
                    hour=$(date -d "$timestamp" '+%H:%M' 2>/dev/null || echo "$timestamp")
                    echo "    $hour UTC: $count calls"
                fi
            done
        fi
    fi
}

echo "🔍 TODAY's Comprehend API Calls:"
echo "--------------------------------"
check_todays_usage "DetectSentiment"
check_todays_usage "DetectPiiEntities"
check_todays_usage "DetectToxicContent"

echo ""
echo "💰 Estimated Cost:"
echo "------------------"
echo "Each API call costs approximately:"
echo "- DetectSentiment: \$0.0001 per 100 characters"
echo "- DetectPiiEntities: \$0.0001 per 100 characters"
echo ""
echo "For a 1000-character template:"
echo "- Cost per template: ~\$0.002"
echo ""

# Calculate rough estimate
total_sentiment=$(aws cloudwatch get-metric-statistics \
    --namespace AWS/Comprehend \
    --metric-name SuccessfulRequestCount \
    --dimensions Name=Operation,Value=DetectSentiment \
    --start-time $TODAY_START \
    --end-time $NOW \
    --period 86400 \
    --statistics Sum \
    --profile $PROFILE \
    --query 'Datapoints[0].Sum' \
    --output text 2>/dev/null || echo "0")

total_pii=$(aws cloudwatch get-metric-statistics \
    --namespace AWS/Comprehend \
    --metric-name SuccessfulRequestCount \
    --dimensions Name=Operation,Value=DetectPiiEntities \
    --start-time $TODAY_START \
    --end-time $NOW \
    --period 86400 \
    --statistics Sum \
    --profile $PROFILE \
    --query 'Datapoints[0].Sum' \
    --output text 2>/dev/null || echo "0")

total_calls=$((${total_sentiment:-0} + ${total_pii:-0}))
estimated_cost=$(echo "scale=2; $total_calls * 0.002" | bc 2>/dev/null || echo "0")

echo "TODAY's total API calls: $total_calls"
echo "TODAY's estimated cost: \$${estimated_cost:-0}"
echo ""
echo "⚠️  Note: This is a rough estimate. Actual costs depend on text length."
echo "    Check AWS Cost Explorer tomorrow for exact charges."

echo ""
echo "🔥 Lambda Invocations Today:"
echo "---------------------------"

# Check Lambda invocations for today
lambda_invocations=$(aws cloudwatch get-metric-statistics \
    --namespace AWS/Lambda \
    --metric-name Invocations \
    --start-time $TODAY_START \
    --end-time $NOW \
    --period 86400 \
    --statistics Sum \
    --profile $PROFILE \
    --query 'Datapoints[0].Sum' \
    --output text 2>/dev/null || echo "0")

echo "Total Lambda invocations today: ${lambda_invocations:-0}"

if [ "${lambda_invocations:-0}" != "0" ]; then
    echo ""
    echo "⚠️  WARNING: Lambda functions were invoked today!"
    echo "    This could mean the loop ran before you stopped it."
fi