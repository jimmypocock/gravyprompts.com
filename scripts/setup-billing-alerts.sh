#!/bin/bash
# Set up AWS billing alerts to prevent future surprises

PROFILE="${AWS_PROFILE:-gravy}"
ACCOUNT_ID=$(aws sts get-caller-identity --profile $PROFILE --query Account --output text)
EMAIL="${ALERT_EMAIL:-your-email@example.com}"

echo "🚨 Setting up AWS Billing Alerts"
echo "================================"
echo ""
echo "Account ID: $ACCOUNT_ID"
echo "Email: $EMAIL"
echo ""

# Create CloudWatch alarm for Comprehend spending
create_comprehend_alarm() {
    echo "Creating Comprehend spending alarm..."
    
    aws cloudwatch put-metric-alarm \
        --alarm-name "ComprehendHighSpending" \
        --alarm-description "Alert when Comprehend spending exceeds $10 in 24 hours" \
        --metric-name "EstimatedCharges" \
        --namespace "AWS/Billing" \
        --statistic "Maximum" \
        --period 86400 \
        --threshold 10 \
        --comparison-operator "GreaterThanThreshold" \
        --dimensions Name=Currency,Value=USD Name=ServiceName,Value=AmazonComprehend \
        --evaluation-periods 1 \
        --treat-missing-data "breaching" \
        --profile $PROFILE
    
    echo "✅ Comprehend alarm created"
}

# Create Lambda throttling alarm
create_lambda_alarm() {
    local function_name=$1
    echo "Creating Lambda runaway alarm for $function_name..."
    
    aws cloudwatch put-metric-alarm \
        --alarm-name "Lambda-${function_name}-HighInvocations" \
        --alarm-description "Alert when Lambda invocations exceed 1000 per hour" \
        --metric-name "Invocations" \
        --namespace "AWS/Lambda" \
        --statistic "Sum" \
        --period 3600 \
        --threshold 1000 \
        --comparison-operator "GreaterThanThreshold" \
        --dimensions Name=FunctionName,Value=$function_name \
        --evaluation-periods 1 \
        --treat-missing-data "notBreaching" \
        --profile $PROFILE
    
    echo "✅ Lambda alarm created for $function_name"
}

# Budget creation (requires budgets API)
create_comprehend_budget() {
    echo "Creating daily Comprehend budget..."
    
    cat > /tmp/budget.json << EOF
{
    "BudgetName": "ComprehendDailyLimit",
    "BudgetLimit": {
        "Amount": "10",
        "Unit": "USD"
    },
    "TimeUnit": "DAILY",
    "BudgetType": "COST",
    "CostFilters": {
        "Service": ["Amazon Comprehend"]
    },
    "NotificationsWithSubscribers": [
        {
            "Notification": {
                "NotificationType": "ACTUAL",
                "ComparisonOperator": "GREATER_THAN",
                "Threshold": 80,
                "ThresholdType": "PERCENTAGE"
            },
            "Subscribers": [
                {
                    "SubscriptionType": "EMAIL",
                    "Address": "$EMAIL"
                }
            ]
        }
    ]
}
EOF

    aws budgets create-budget \
        --account-id $ACCOUNT_ID \
        --budget file:///tmp/budget.json \
        --profile $PROFILE
    
    rm /tmp/budget.json
    echo "✅ Budget created"
}

echo "📋 Recommended Manual Steps:"
echo "----------------------------"
echo ""
echo "1. Enable AWS Cost Anomaly Detection:"
echo "   - Go to AWS Console > Billing > Cost Anomaly Detection"
echo "   - Create a monitor for 'Services'"
echo "   - Set alert threshold to $10"
echo "   - Add your email for notifications"
echo ""
echo "2. Create Service-Specific Budget:"
echo "   - Go to AWS Console > Billing > Budgets"
echo "   - Create new budget > Cost budget"
echo "   - Filter by Service: Amazon Comprehend"
echo "   - Set daily limit: $10"
echo "   - Add email alerts at 80% and 100%"
echo ""
echo "3. Enable Billing Alerts:"
echo "   - Go to AWS Console > Billing > Billing preferences"
echo "   - Check 'Receive Billing Alerts'"
echo "   - This enables CloudWatch billing metrics"
echo ""
echo "4. Set up Lambda Reserved Concurrency:"
echo "   - For each moderation Lambda, set reserved concurrency to 10"
echo "   - This limits max concurrent executions"
echo ""
echo "5. Create CloudWatch Dashboard:"
echo "   aws cloudwatch put-dashboard \\"
echo "     --dashboard-name ComprehendMonitoring \\"
echo "     --dashboard-body file://dashboard.json \\"
echo "     --profile $PROFILE"
echo ""
echo "🛡️ Prevention Tips:"
echo "-------------------"
echo "1. Always test Lambda functions with DynamoDB streams locally first"
echo "2. Set up Dead Letter Queues (DLQ) for stream processing"
echo "3. Use Step Functions for complex workflows instead of direct triggers"
echo "4. Implement circuit breakers in Lambda code"
echo "5. Use AWS X-Ray to trace and debug distributed systems"
echo ""
echo "📊 Monitoring Commands:"
echo "----------------------"
echo "# Check current Comprehend usage:"
echo "./scripts/analyze-comprehend-usage.sh"
echo ""
echo "# Watch Lambda logs in real-time:"
echo "aws logs tail /aws/lambda/<function-name> --follow --profile $PROFILE"
echo ""
echo "# Check current billing estimate:"
echo "aws ce get-cost-forecast \\"
echo "  --time-period Start=$(date +%Y-%m-%d),End=$(date -d '+1 month' +%Y-%m-%d) \\"
echo "  --metric UNBLENDED_COST \\"
echo "  --granularity MONTHLY \\"
echo "  --profile $PROFILE"