#!/bin/bash
# Check if Comprehend is being called RIGHT NOW

PROFILE="${AWS_PROFILE:-gravy}"
REGION="${AWS_REGION:-us-east-1}"

echo "🔍 Checking REAL-TIME Comprehend Activity..."
echo "==========================================="
echo ""

# Check last 15 minutes (macOS compatible)
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    START_TIME=$(date -u -v-15M '+%Y-%m-%dT%H:%M:%SZ')
    END_TIME=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
else
    # Linux
    START_TIME=$(date -u -d '15 minutes ago' '+%Y-%m-%dT%H:%M:%SZ')
    END_TIME=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
fi

echo "Checking from: $START_TIME"
echo "          to: $END_TIME"
echo ""

# Function to check recent metrics
check_recent_activity() {
    local operation=$1
    echo -n "Checking $operation (last 15 min): "
    
    result=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/Comprehend \
        --metric-name SuccessfulRequestCount \
        --dimensions Name=Operation,Value=$operation \
        --start-time $START_TIME \
        --end-time $END_TIME \
        --period 300 \
        --statistics Sum \
        --profile $PROFILE \
        --region $REGION \
        --query 'Datapoints[*].Sum' \
        --output text 2>/dev/null)
    
    if [ -z "$result" ] || [ "$result" = "0" ]; then
        echo "✅ NO CALLS"
    else
        total=$(echo "$result" | awk '{sum += $1} END {print sum}')
        echo "⚠️  $total CALLS DETECTED!"
    fi
}

echo "📊 Real-time Comprehend API Activity:"
echo "------------------------------------"
check_recent_activity "DetectSentiment"
check_recent_activity "DetectPiiEntities"
check_recent_activity "DetectToxicContent"

echo ""
echo "🔥 Checking Lambda Activity (last 5 minutes):"
echo "--------------------------------------------"

# Check if any moderation Lambdas are running
lambda_functions=$(aws lambda list-functions \
    --profile $PROFILE \
    --query "Functions[?contains(FunctionName, 'Moderat')].FunctionName" \
    --output text 2>/dev/null)

if [ -z "$lambda_functions" ]; then
    echo "✅ No moderation Lambda functions found (good!)"
else
    for func in $lambda_functions; do
        echo -n "Lambda $func: "
        
        # Check invocations in last 5 minutes
        if [[ "$OSTYPE" == "darwin"* ]]; then
            FIVE_MIN_AGO=$(date -u -v-5M '+%Y-%m-%dT%H:%M:%SZ')
        else
            FIVE_MIN_AGO=$(date -u -d '5 minutes ago' '+%Y-%m-%dT%H:%M:%SZ')
        fi
        
        invocations=$(aws cloudwatch get-metric-statistics \
            --namespace AWS/Lambda \
            --metric-name Invocations \
            --dimensions Name=FunctionName,Value=$func \
            --start-time $FIVE_MIN_AGO \
            --end-time $END_TIME \
            --period 300 \
            --statistics Sum \
            --profile $PROFILE \
            --query 'Datapoints[*].Sum' \
            --output text 2>/dev/null | awk '{sum += $1} END {print sum}')
        
        if [ -z "$invocations" ] || [ "$invocations" = "0" ]; then
            echo "✅ Not running"
        else
            echo "⚠️  $invocations invocations!"
            
            # Check concurrency setting
            concurrency=$(aws lambda get-function-concurrency \
                --function-name $func \
                --profile $PROFILE \
                --query 'ReservedConcurrentExecutions' \
                --output text 2>/dev/null)
            
            if [ "$concurrency" = "0" ]; then
                echo "   ✅ Concurrency is 0 (function is stopped)"
            else
                echo "   ⚠️  Concurrency: $concurrency (function can still run!)"
            fi
        fi
    done
fi

echo ""
echo "📝 Quick Status Summary:"
echo "-----------------------"
echo "If you see all ✅ above, Comprehend is NOT being called"
echo "If you see any ⚠️, there's still activity!"
echo ""
echo "💡 To see even more recent activity (last 1 minute):"
echo "aws logs tail /aws/lambda/<function-name> --since 1m --profile $PROFILE"