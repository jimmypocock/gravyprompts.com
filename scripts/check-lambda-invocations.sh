#!/bin/bash

# Script to check Lambda invocations across the AWS account
# Usage: ./check-lambda-invocations.sh [hours] [region] [--detailed]
# Example: ./check-lambda-invocations.sh 24 us-east-1 --detailed

set -e

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Source the config script to load environment variables from .env
source "$SCRIPT_DIR/config.sh"

# Parse arguments
PERIOD=24
REGION="us-east-1"
DETAILED=""
PROFILE="${AWS_PROFILE:-default}"

for arg in "$@"; do
    if [[ "$arg" == "--detailed" ]]; then
        DETAILED="--detailed"
    elif [[ "$arg" =~ ^[0-9]+$ ]]; then
        PERIOD=$arg
    elif [[ "$arg" =~ ^[a-z]{2}-[a-z]+-[0-9]+$ ]]; then
        REGION=$arg
    fi
done

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Lambda Invocation Monitor${NC}"
echo "=================================="
echo "Checking Lambda invocations for the last $PERIOD hours in $REGION"
echo "Using AWS Profile: $PROFILE"
echo ""

# Calculate timestamps
END_TIME=$(date -u +%Y-%m-%dT%H:%M:%S)
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    START_TIME=$(date -u -v-${PERIOD}H +%Y-%m-%dT%H:%M:%S)
else
    # Linux
    START_TIME=$(date -u -d "$PERIOD hours ago" +%Y-%m-%dT%H:%M:%S)
fi

echo "Time range: $START_TIME to $END_TIME"
echo ""

# Get total invocations across all functions
echo -e "${YELLOW}Fetching total invocations...${NC}"

# Get all Lambda functions that have metrics (including deleted ones)
FUNCTION_NAMES=$(aws cloudwatch list-metrics \
    --namespace AWS/Lambda \
    --metric-name Invocations \
    --region $REGION \
    --profile $PROFILE \
    --output json 2>/dev/null | jq -r '.Metrics[].Dimensions[] | select(.Name=="FunctionName") | .Value' | sort | uniq)

# Calculate total invocations by summing across all functions
TOTAL=0
if [ -n "$FUNCTION_NAMES" ]; then
    echo -e "Found $(echo "$FUNCTION_NAMES" | wc -l) functions with metrics"
    while IFS= read -r func_name; do
        FUNC_INVOCATIONS=$(aws cloudwatch get-metric-statistics \
            --namespace AWS/Lambda \
            --metric-name Invocations \
            --dimensions Name=FunctionName,Value="$func_name" \
            --statistics Sum \
            --start-time $START_TIME \
            --end-time $END_TIME \
            --period $((PERIOD * 3600)) \
            --region $REGION \
            --profile $PROFILE \
            --output json 2>/dev/null | jq -r '[.Datapoints[].Sum] | add // 0')
        TOTAL=$((TOTAL + FUNC_INVOCATIONS))
    done <<< "$FUNCTION_NAMES"
fi

echo -e "${GREEN}Total Lambda invocations: ${TOTAL}${NC}"
echo ""

# Get per-function breakdown if requested
if [ "$DETAILED" == "--detailed" ]; then
    echo -e "${YELLOW}Fetching per-function breakdown...${NC}"
    echo ""
    
    # Use the same function list we already have
    if [ -z "$FUNCTION_NAMES" ]; then
        echo "No Lambda functions with metrics found in region $REGION"
        exit 0
    fi
    
    # Get invocation count for each function and store in temp file
    TEMP_FILE="/tmp/lambda_counts_$$.txt"
    > "$TEMP_FILE"
    
    while IFS= read -r func; do
        COUNT=$(aws cloudwatch get-metric-statistics \
            --namespace AWS/Lambda \
            --metric-name Invocations \
            --dimensions Name=FunctionName,Value=$func \
            --statistics Sum \
            --start-time $START_TIME \
            --end-time $END_TIME \
            --period $((PERIOD * 3600)) \
            --region $REGION \
            --profile $PROFILE \
            --output json 2>/dev/null | jq -r '[.Datapoints[].Sum] | add // 0')
        
        if [ "$COUNT" != "0" ]; then
            echo "$COUNT|$func" >> "$TEMP_FILE"
        fi
    done <<< "$FUNCTION_NAMES"
    
    # Sort and display functions by invocation count
    echo "Functions with invocations (sorted by count):"
    echo "--------------------------------------------"
    
    # Sort by count in descending order and display
    sort -t'|' -k1 -nr "$TEMP_FILE" | while IFS='|' read -r count func; do
        printf "%-50s %10s\n" "$func" "$count"
    done
    
    # Clean up temp file
    rm -f "$TEMP_FILE"
    
    echo ""
    
    # Calculate actual total from individual functions
    CALCULATED_TOTAL=0
    for count in "${FUNCTION_COUNTS[@]}"; do
        CALCULATED_TOTAL=$((CALCULATED_TOTAL + count))
    done
    
    echo "--------------------------------------------"
    echo -e "${GREEN}Calculated total from individual functions: ${CALCULATED_TOTAL}${NC}"
fi

# Additional statistics
echo ""
echo -e "${YELLOW}Additional Statistics:${NC}"

# Get error count
ERRORS=$(aws cloudwatch get-metric-statistics \
    --namespace AWS/Lambda \
    --metric-name Errors \
    --statistics Sum \
    --start-time $START_TIME \
    --end-time $END_TIME \
    --period $((PERIOD * 3600)) \
    --region $REGION \
    --query 'Datapoints[0].Sum' \
    --output text 2>/dev/null || echo "0")

if [ "$ERRORS" == "None" ]; then
    ERRORS=0
fi

echo "Total errors: $ERRORS"

# Get throttles
THROTTLES=$(aws cloudwatch get-metric-statistics \
    --namespace AWS/Lambda \
    --metric-name Throttles \
    --statistics Sum \
    --start-time $START_TIME \
    --end-time $END_TIME \
    --period $((PERIOD * 3600)) \
    --region $REGION \
    --query 'Datapoints[0].Sum' \
    --output text 2>/dev/null || echo "0")

if [ "$THROTTLES" == "None" ]; then
    THROTTLES=0
fi

echo "Total throttles: $THROTTLES"

# Calculate success rate
if [ "$TOTAL" -gt 0 ]; then
    SUCCESS_RATE=$(echo "scale=2; (($TOTAL - $ERRORS) / $TOTAL) * 100" | bc 2>/dev/null || echo "N/A")
    echo "Success rate: ${SUCCESS_RATE}%"
fi

echo ""
echo "=================================="
echo -e "${GREEN}Report complete!${NC}"