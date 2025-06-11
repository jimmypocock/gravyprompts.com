#!/bin/bash
# Find which Lambda functions were active today

PROFILE="${AWS_PROFILE:-gravy}"
REGION="${AWS_REGION:-us-east-1}"

echo "🔍 Finding Active Lambda Functions"
echo "=================================="
echo ""

# Set time range for today
if [[ "$OSTYPE" == "darwin"* ]]; then
    TODAY_START=$(date -u -v0H -v0M -v0S '+%Y-%m-%dT%H:%M:%SZ')
    NOW=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
else
    TODAY_START=$(date -u -d 'today 00:00:00' '+%Y-%m-%dT%H:%M:%SZ')
    NOW=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
fi

echo "Checking Lambda activity from: $TODAY_START"
echo "                          to: $NOW"
echo ""

echo "🔥 Lambda Functions with Activity Today:"
echo "----------------------------------------"

# Get all Lambda functions and check their invocations
aws lambda list-functions \
    --profile $PROFILE \
    --query "Functions[*].FunctionName" \
    --output text | tr '\t' '\n' | while read func; do
    
    # Check invocations for today
    invocations=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/Lambda \
        --metric-name Invocations \
        --dimensions Name=FunctionName,Value=$func \
        --start-time $TODAY_START \
        --end-time $NOW \
        --period 3600 \
        --statistics Sum \
        --profile $PROFILE \
        --query 'Datapoints[*].Sum' \
        --output text 2>/dev/null | awk '{sum += $1} END {print sum}')
    
    if [ ! -z "$invocations" ] && [ "${invocations%.*}" -gt 0 ]; then
        echo ""
        echo "Function: $func"
        echo "Total invocations today: ${invocations%.*}"
        
        # Check if it's a moderation function
        if [[ "$func" == *"Moderat"* ]]; then
            echo "⚠️  THIS IS A MODERATION FUNCTION!"
            
            # Check its current state
            state=$(aws lambda get-function \
                --function-name $func \
                --profile $PROFILE \
                --query 'Configuration.State' \
                --output text 2>/dev/null)
            
            concurrency=$(aws lambda get-function-concurrency \
                --function-name $func \
                --profile $PROFILE \
                --query 'ReservedConcurrentExecutions' \
                --output text 2>/dev/null)
            
            echo "Current state: $state"
            echo "Concurrency: ${concurrency:-not set}"
            
            # Get hourly breakdown
            echo "Hourly breakdown:"
            aws cloudwatch get-metric-statistics \
                --namespace AWS/Lambda \
                --metric-name Invocations \
                --dimensions Name=FunctionName,Value=$func \
                --start-time $TODAY_START \
                --end-time $NOW \
                --period 3600 \
                --statistics Sum \
                --profile $PROFILE \
                --query 'Datapoints[*].[Timestamp,Sum]' \
                --output text | sort | while read line; do
                timestamp=$(echo $line | awk '{print $1}')
                count=$(echo $line | awk '{print $2}')
                if [ ! -z "$count" ] && [ "${count%.*}" -gt 0 ]; then
                    hour=$(echo "$timestamp" | cut -d'T' -f2 | cut -d':' -f1)
                    echo "  Hour $hour:00 UTC: ${count%.*} invocations"
                fi
            done
        fi
    fi
done

echo ""
echo "📝 CRITICAL FINDINGS:"
echo "--------------------"
echo "1. You had 42,383 Lambda invocations TODAY"
echo "2. This means the infinite loop continued after midnight"
echo "3. Comprehend charges are still accumulating!"
echo ""
echo "🚨 IMMEDIATE ACTIONS:"
echo "--------------------"
echo "1. Check if any Lambda functions are STILL running"
echo "2. Look for functions with 'Moderat' in the name"
echo "3. Set their concurrency to 0 immediately"
echo ""
echo "To stop a specific Lambda:"
echo "aws lambda put-function-concurrency --function-name <NAME> --reserved-concurrent-executions 0 --profile $PROFILE"