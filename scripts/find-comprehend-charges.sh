#!/bin/bash
# Find where the Comprehend charges are hiding

PROFILE="${AWS_PROFILE:-gravy}"
REGION="${AWS_REGION:-us-east-1}"

echo "🔍 Finding Comprehend Charges - Deep Dive"
echo "========================================="
echo ""

# Check multiple date ranges to catch timezone issues
echo "📅 Checking multiple date ranges (to catch timezone issues):"
echo "-----------------------------------------------------------"

# Function to check a date range
check_date_range() {
    local start_date=$1
    local end_date=$2
    local label=$3
    
    echo "Checking $label ($start_date to $end_date):"
    
    # Check all possible Comprehend operations
    operations=("DetectSentiment" "DetectPiiEntities" "DetectToxicContent" "DetectEntities" "DetectKeyPhrases" "DetectDominantLanguage" "BatchDetectSentiment" "BatchDetectEntities")
    
    total=0
    for op in "${operations[@]}"; do
        result=$(aws cloudwatch get-metric-statistics \
            --namespace AWS/Comprehend \
            --metric-name SuccessfulRequestCount \
            --dimensions Name=Operation,Value=$op \
            --start-time $start_date \
            --end-time $end_date \
            --period 86400 \
            --statistics Sum \
            --profile $PROFILE \
            --region $REGION \
            --query 'Datapoints[0].Sum' \
            --output text 2>/dev/null)
        
        if [ ! -z "$result" ] && [ "$result" != "None" ] && [ "$result" != "0" ]; then
            echo "  - $op: $result calls"
            total=$((total + ${result%.*}))
        fi
    done
    
    if [ $total -eq 0 ]; then
        echo "  No Comprehend calls found"
    else
        echo "  Total: $total calls"
    fi
    echo ""
}

# Check last 3 days with different date ranges
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS date commands
    check_date_range $(date -u -v-3d '+%Y-%m-%dT00:00:00Z') $(date -u '+%Y-%m-%dT%H:%M:%SZ') "Last 3 days"
    check_date_range $(date -v-2d '+%Y-%m-%dT00:00:00Z') $(date '+%Y-%m-%dT23:59:59Z') "2 days ago (local time)"
    check_date_range $(date -v-1d '+%Y-%m-%dT00:00:00Z') $(date -v-1d '+%Y-%m-%dT23:59:59Z') "Yesterday (local time)"
else
    # Linux date commands
    check_date_range $(date -u -d '3 days ago' '+%Y-%m-%dT00:00:00Z') $(date -u '+%Y-%m-%dT%H:%M:%SZ') "Last 3 days"
    check_date_range $(date -d '2 days ago' '+%Y-%m-%dT00:00:00Z') $(date '+%Y-%m-%dT23:59:59Z') "2 days ago (local time)"
    check_date_range $(date -d 'yesterday' '+%Y-%m-%dT00:00:00Z') $(date -d 'yesterday' '+%Y-%m-%dT23:59:59Z') "Yesterday (local time)"
fi

echo "🔥 Lambda Invocation Details:"
echo "-----------------------------"

# Get more detailed Lambda metrics
if [[ "$OSTYPE" == "darwin"* ]]; then
    START=$(date -u -v-3d '+%Y-%m-%dT00:00:00Z')
    END=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
else
    START=$(date -u -d '3 days ago' '+%Y-%m-%dT00:00:00Z')
    END=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
fi

# Find all Lambda functions that were active
echo "Searching for Lambda functions with high invocations..."
aws cloudwatch list-metrics \
    --namespace AWS/Lambda \
    --metric-name Invocations \
    --profile $PROFILE \
    --query 'Metrics[?Dimensions[?Name==`FunctionName`]].Dimensions[0].Value' \
    --output text 2>/dev/null | while read func; do
    
    if [[ "$func" == *"gravy"* ]] || [[ "$func" == *"GRAVY"* ]] || [[ "$func" == *"Moderat"* ]]; then
        invocations=$(aws cloudwatch get-metric-statistics \
            --namespace AWS/Lambda \
            --metric-name Invocations \
            --dimensions Name=FunctionName,Value=$func \
            --start-time $START \
            --end-time $END \
            --period 86400 \
            --statistics Sum \
            --profile $PROFILE \
            --query 'Datapoints[*].[Timestamp,Sum]' \
            --output text 2>/dev/null)
        
        if [ ! -z "$invocations" ]; then
            echo ""
            echo "Function: $func"
            echo "$invocations" | while read line; do
                date=$(echo $line | awk '{print $1}')
                count=$(echo $line | awk '{print $2}')
                if [ ! -z "$count" ] && [ "${count%.*}" -gt 1000 ]; then
                    echo "  $date: ${count%.*} invocations"
                fi
            done
        fi
    fi
done

echo ""
echo "💳 Checking Cost and Usage Report (if enabled):"
echo "-----------------------------------------------"

# Check if Cost and Usage Reports are configured
cur_bucket=$(aws cur describe-report-definitions \
    --profile $PROFILE \
    --query 'ReportDefinitions[0].S3Bucket' \
    --output text 2>/dev/null)

if [ "$cur_bucket" != "None" ] && [ ! -z "$cur_bucket" ]; then
    echo "Cost and Usage Reports found in bucket: $cur_bucket"
    echo "You can download detailed usage data from this S3 bucket"
else
    echo "Cost and Usage Reports not configured"
    echo "Enable them for detailed billing analysis"
fi

echo ""
echo "📊 Checking CloudWatch Logs for actual API calls:"
echo "-------------------------------------------------"
echo "Looking for log groups with Comprehend activity..."

# List log groups that might contain Comprehend calls
aws logs describe-log-groups \
    --profile $PROFILE \
    --query 'logGroups[?contains(logGroupName, `lambda`)].logGroupName' \
    --output text 2>/dev/null | while read log_group; do
    
    if [[ "$log_group" == *"Moderat"* ]] || [[ "$log_group" == *"gravy"* ]]; then
        echo ""
        echo "Checking log group: $log_group"
        
        # Search for Comprehend API calls in logs
        if [[ "$OSTYPE" == "darwin"* ]]; then
            START_TIME=$(($(date -v-2d +%s) * 1000))
        else
            START_TIME=$(($(date -d '2 days ago' +%s) * 1000))
        fi
        
        comprehend_calls=$(aws logs filter-log-events \
            --log-group-name "$log_group" \
            --start-time $START_TIME \
            --filter-pattern "Comprehend" \
            --profile $PROFILE \
            --query 'events | length(@)' \
            --output text 2>/dev/null)
        
        if [ ! -z "$comprehend_calls" ] && [ "$comprehend_calls" != "0" ]; then
            echo "  Found $comprehend_calls log entries mentioning Comprehend"
        fi
    fi
done

echo ""
echo "🎯 NEXT STEPS:"
echo "--------------"
echo "1. Check AWS Cost Explorer with these specific filters:"
echo "   - Service: 'Amazon Comprehend'"
echo "   - Group by: 'Usage Type' AND 'Operation'"
echo "   - Time: Last 7 days"
echo ""
echo "2. The 288,461 Lambda invocations suggest the loop ran for hours"
echo "3. If Comprehend metrics show 0, the charges might be:"
echo "   - Still processing (can take 24-48 hours)"
echo "   - Under a different service name"
echo "   - In a different region"
echo ""
echo "4. To see the exact charges, go to:"
echo "   AWS Console > Billing > Bills > Current Month"
echo "   Look for 'Amazon Comprehend' line items"