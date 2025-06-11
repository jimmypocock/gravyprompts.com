#!/bin/bash

# Script to analyze AWS Comprehend usage and identify potential issues

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Source the configuration
source "$SCRIPT_DIR/config.sh"

echo "=== AWS Comprehend Usage Analysis ==="
echo ""

# Check if AWS CLI is configured
if ! command -v aws &> /dev/null; then
    echo "Error: AWS CLI is not installed"
    exit 1
fi

# Check if AWS credentials are configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo "Error: AWS credentials not configured. Please run 'aws configure' or check AWS_PROFILE"
    echo "Current AWS_PROFILE: ${AWS_PROFILE:-not set}"
    exit 1
fi

# Get the region from environment or use default
REGION=${AWS_REGION:-us-east-1}
echo "Using region: $REGION"
echo "Using AWS Profile: ${AWS_PROFILE:-default}"
echo ""

# Detect OS for date command compatibility
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    START_DATE=$(date -u -v-7d +%Y-%m-%dT%H:%M:%S)
    END_DATE=$(date -u +%Y-%m-%dT%H:%M:%S)
else
    # Linux
    START_DATE=$(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%S)
    END_DATE=$(date -u +%Y-%m-%dT%H:%M:%S)
fi

# 1. Check CloudWatch metrics for Comprehend usage
echo "1. Checking Comprehend API call metrics from CloudWatch..."
echo "   (Last 7 days of API calls)"
echo "   Period: $START_DATE to $END_DATE"
aws cloudwatch get-metric-statistics \
    --namespace AWS/Comprehend \
    --metric-name UserRequestCount \
    --dimensions Name=Operation,Value=DetectSentiment \
    --start-time $START_DATE \
    --end-time $END_DATE \
    --period 86400 \
    --statistics Sum \
    --region $REGION \
    --output table 2>/dev/null || echo "   No DetectSentiment metrics found"

echo ""
echo "2. Checking for DetectToxicContent calls..."
aws cloudwatch get-metric-statistics \
    --namespace AWS/Comprehend \
    --metric-name UserRequestCount \
    --dimensions Name=Operation,Value=DetectToxicContent \
    --start-time $START_DATE \
    --end-time $END_DATE \
    --period 86400 \
    --statistics Sum \
    --region $REGION \
    --output table 2>/dev/null || echo "   No DetectToxicContent metrics found"

echo ""
echo "3. Checking for DetectPiiEntities calls..."
aws cloudwatch get-metric-statistics \
    --namespace AWS/Comprehend \
    --metric-name UserRequestCount \
    --dimensions Name=Operation,Value=DetectPiiEntities \
    --start-time $START_DATE \
    --end-time $END_DATE \
    --period 86400 \
    --statistics Sum \
    --region $REGION \
    --output table 2>/dev/null || echo "   No DetectPiiEntities metrics found"

# 2. Check Lambda function logs
echo ""
echo "4. Checking Lambda function logs for moderation..."
FUNCTION_NAMES=$(aws lambda list-functions --region $REGION --query "Functions[?contains(FunctionName, 'ModerateContent')].FunctionName" --output text)

if [ -n "$FUNCTION_NAMES" ]; then
    # Get the first function name (handle multiple results)
    FUNCTION_NAME=$(echo $FUNCTION_NAMES | awk '{print $1}')
    echo "   Found function: $FUNCTION_NAME"
    echo "   Recent invocations:"
    
    # Get log group name
    LOG_GROUP="/aws/lambda/$FUNCTION_NAME"
    
    # Get recent log streams
    STREAMS=$(aws logs describe-log-streams \
        --log-group-name "$LOG_GROUP" \
        --order-by LastEventTime \
        --descending \
        --limit 5 \
        --region $REGION \
        --query 'logStreams[*].logStreamName' \
        --output text 2>/dev/null)
    
    if [ -n "$STREAMS" ]; then
        for STREAM in $STREAMS; do
            echo "   Checking log stream: $STREAM"
            aws logs filter-log-events \
                --log-group-name "$LOG_GROUP" \
                --log-stream-names "$STREAM" \
                --filter-pattern "Moderation event" \
                --limit 10 \
                --region $REGION \
                --query 'events[*].message' \
                --output text 2>/dev/null | head -20
        done
    else
        echo "   No log streams found"
    fi
else
    echo "   ModerateContent function not found"
fi

# 3. Check DynamoDB table for templates
echo ""
echo "5. Checking DynamoDB tables for public templates..."
TABLES=$(aws dynamodb list-tables --region $REGION --query "TableNames[?contains(@, 'templates')]" --output text)

for TABLE in $TABLES; do
    echo "   Checking table: $TABLE"
    
    # Count public templates
    PUBLIC_COUNT=$(aws dynamodb scan \
        --table-name "$TABLE" \
        --filter-expression "visibility = :vis" \
        --expression-attribute-values '{":vis":{"S":"public"}}' \
        --select COUNT \
        --region $REGION \
        --query 'Count' \
        --output text 2>/dev/null)
    
    if [ -n "$PUBLIC_COUNT" ]; then
        echo "   Public templates in $TABLE: $PUBLIC_COUNT"
        
        # Check moderation status distribution
        echo "   Moderation status distribution:"
        aws dynamodb scan \
            --table-name "$TABLE" \
            --filter-expression "visibility = :vis" \
            --expression-attribute-values '{":vis":{"S":"public"}}' \
            --projection-expression "moderationStatus" \
            --region $REGION \
            --query 'Items[*].moderationStatus.S' \
            --output text 2>/dev/null | sort | uniq -c
    fi
done

# 4. Check Lambda function configuration
echo ""
echo "6. Checking Lambda function configuration..."
if [ -n "$FUNCTION_NAME" ]; then
    echo "   Memory: $(aws lambda get-function-configuration --function-name $FUNCTION_NAME --region $REGION --query 'MemorySize' --output text) MB"
    echo "   Timeout: $(aws lambda get-function-configuration --function-name $FUNCTION_NAME --region $REGION --query 'Timeout' --output text) seconds"
    echo "   Reserved Concurrent Executions: $(aws lambda get-function-configuration --function-name $FUNCTION_NAME --region $REGION --query 'ReservedConcurrentExecutions' --output text)"
    
    # Check event source mappings
    echo ""
    echo "   Event Source Mappings:"
    aws lambda list-event-source-mappings \
        --function-name $FUNCTION_NAME \
        --region $REGION \
        --query 'EventSourceMappings[*].[EventSourceArn,BatchSize,MaximumBatchingWindowInSeconds,ParallelizationFactor]' \
        --output table
fi

# 5. Get cost breakdown
echo ""
echo "7. Checking AWS Cost Explorer for Comprehend usage (if available)..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    COST_START_DATE=$(date -u -v-7d +%Y-%m-%d)
    COST_END_DATE=$(date -u +%Y-%m-%d)
else
    # Linux
    COST_START_DATE=$(date -u -d '7 days ago' +%Y-%m-%d)
    COST_END_DATE=$(date -u +%Y-%m-%d)
fi

aws ce get-cost-and-usage \
    --time-period Start=$COST_START_DATE,End=$COST_END_DATE \
    --granularity DAILY \
    --metrics "UsageQuantity" \
    --filter '{
        "Dimensions": {
            "Key": "SERVICE",
            "Values": ["Amazon Comprehend"]
        }
    }' \
    --group-by Type=DIMENSION,Key=USAGE_TYPE \
    --region us-east-1 \
    --output table 2>/dev/null || echo "   Cost Explorer API not available or no permissions"

echo ""
echo "=== Analysis Complete ==="
echo ""
echo "Potential issues to investigate:"
echo "1. Check if DynamoDB stream is triggering multiple times for the same record"
echo "2. Verify that the moderation function is not being invoked by other sources"
echo "3. Look for any infinite loops where updating moderation status triggers another stream event"
echo "4. Check if there are any retries happening due to Lambda timeouts or errors"
echo "5. Verify batch size configuration for DynamoDB streams (default is 100 records)"