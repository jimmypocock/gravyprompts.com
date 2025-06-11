#!/bin/bash
# Check YESTERDAY's Comprehend usage (when the infinite loop happened)

PROFILE="${AWS_PROFILE:-gravy}"
REGION="${AWS_REGION:-us-east-1}"

echo "📊 Checking YESTERDAY's Comprehend Usage"
echo "========================================"
echo ""

# Get yesterday's date range
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    YESTERDAY_START=$(date -u -v-1d -v0H -v0M -v0S '+%Y-%m-%dT%H:%M:%SZ')
    YESTERDAY_END=$(date -u -v-1d -v23H -v59M -v59S '+%Y-%m-%dT%H:%M:%SZ')
else
    # Linux
    YESTERDAY_START=$(date -u -d 'yesterday 00:00:00' '+%Y-%m-%dT%H:%M:%SZ')
    YESTERDAY_END=$(date -u -d 'yesterday 23:59:59' '+%Y-%m-%dT%H:%M:%SZ')
fi

echo "Date range: $YESTERDAY_START to $YESTERDAY_END"
echo ""

# Function to check yesterday's metrics
check_yesterdays_usage() {
    local operation=$1
    echo "Checking $operation..."
    
    result=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/Comprehend \
        --metric-name SuccessfulRequestCount \
        --dimensions Name=Operation,Value=$operation \
        --start-time $YESTERDAY_START \
        --end-time $YESTERDAY_END \
        --period 3600 \
        --statistics Sum \
        --profile $PROFILE \
        --region $REGION \
        --query 'Datapoints[*].[Timestamp,Sum]' \
        --output text 2>/dev/null)
    
    if [ -z "$result" ]; then
        echo "  Total: 0 calls"
    else
        total=$(echo "$result" | awk '{sum += $2} END {print sum}')
        echo "  Total: $total calls"
        
        # Show hourly breakdown
        echo "  Hourly breakdown:"
        echo "$result" | sort | while read line; do
            timestamp=$(echo $line | awk '{print $1}')
            count=$(echo $line | awk '{print $2}')
            if [ ! -z "$count" ] && [ "$count" != "0" ]; then
                # Extract hour for display
                hour=$(echo "$timestamp" | cut -d'T' -f2 | cut -d':' -f1)
                echo "    Hour $hour:00 UTC: $count calls"
            fi
        done
    fi
    echo ""
}

echo "🔍 YESTERDAY's Comprehend API Calls:"
echo "------------------------------------"
check_yesterdays_usage "DetectSentiment"
check_yesterdays_usage "DetectPiiEntities"
check_yesterdays_usage "DetectToxicContent"

echo "💰 Cost Calculation:"
echo "-------------------"

# Get totals for cost calculation
total_sentiment=$(aws cloudwatch get-metric-statistics \
    --namespace AWS/Comprehend \
    --metric-name SuccessfulRequestCount \
    --dimensions Name=Operation,Value=DetectSentiment \
    --start-time $YESTERDAY_START \
    --end-time $YESTERDAY_END \
    --period 86400 \
    --statistics Sum \
    --profile $PROFILE \
    --query 'Datapoints[0].Sum' \
    --output text 2>/dev/null || echo "0")

total_pii=$(aws cloudwatch get-metric-statistics \
    --namespace AWS/Comprehend \
    --metric-name SuccessfulRequestCount \
    --dimensions Name=Operation,Value=DetectPiiEntities \
    --start-time $YESTERDAY_START \
    --end-time $YESTERDAY_END \
    --period 86400 \
    --statistics Sum \
    --profile $PROFILE \
    --query 'Datapoints[0].Sum' \
    --output text 2>/dev/null || echo "0")

total_toxic=$(aws cloudwatch get-metric-statistics \
    --namespace AWS/Comprehend \
    --metric-name SuccessfulRequestCount \
    --dimensions Name=Operation,Value=DetectToxicContent \
    --start-time $YESTERDAY_START \
    --end-time $YESTERDAY_END \
    --period 86400 \
    --statistics Sum \
    --profile $PROFILE \
    --query 'Datapoints[0].Sum' \
    --output text 2>/dev/null || echo "0")

# Calculate costs
# Assuming average 1000 characters per request
# $0.0001 per 100 characters = $0.001 per 1000 characters
sentiment_cost=$(echo "scale=2; ${total_sentiment:-0} * 0.001" | bc 2>/dev/null || echo "0")
pii_cost=$(echo "scale=2; ${total_pii:-0} * 0.001" | bc 2>/dev/null || echo "0")

total_calls=$((${total_sentiment:-0} + ${total_pii:-0} + ${total_toxic:-0}))
total_cost=$(echo "scale=2; $sentiment_cost + $pii_cost" | bc 2>/dev/null || echo "0")

echo "DetectSentiment calls: ${total_sentiment:-0} (≈ \$${sentiment_cost})"
echo "DetectPiiEntities calls: ${total_pii:-0} (≈ \$${pii_cost})"
echo "DetectToxicContent calls: ${total_toxic:-0} (cost unknown)"
echo ""
echo "YESTERDAY's total API calls: $total_calls"
echo "YESTERDAY's estimated minimum cost: \$${total_cost}"
echo ""
echo "⚠️  IMPORTANT NOTES:"
echo "1. This assumes 1000 characters per request (actual may be higher)"
echo "2. DetectToxicContent pricing is not publicly available"
echo "3. Your actual bill of \$103 suggests either:"
echo "   - Much longer text per request (10,000+ characters)"
echo "   - Many more API calls than shown here"
echo "   - DetectToxicContent has premium pricing"
echo ""
echo "🔥 Check Lambda invocations from yesterday:"
echo "--------------------------------------------"

# Check Lambda invocations
lambda_invocations=$(aws cloudwatch get-metric-statistics \
    --namespace AWS/Lambda \
    --metric-name Invocations \
    --start-time $YESTERDAY_START \
    --end-time $YESTERDAY_END \
    --period 86400 \
    --statistics Sum \
    --profile $PROFILE \
    --query 'Datapoints[0].Sum' \
    --output text 2>/dev/null || echo "0")

echo "Total Lambda invocations yesterday: ${lambda_invocations:-0}"
echo ""
echo "If this number is very high (10,000+), that explains the infinite loop!"