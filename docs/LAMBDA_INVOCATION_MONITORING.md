# Lambda Invocation Monitoring Guide

This guide provides multiple methods to view the total number of Lambda invocations across your AWS account.

## Method 1: AWS CloudWatch Console

### Via CloudWatch Metrics

1. Go to AWS CloudWatch Console
2. Navigate to **Metrics** → **All metrics**
3. Select **Lambda** → **Across All Functions**
4. Check the box for **Invocations**
5. In the **Graphed metrics** tab, change the statistic to **Sum**
6. Adjust the time period as needed
7. The graph will show total invocations across all Lambda functions

### Via CloudWatch Insights

1. Go to CloudWatch → **Logs Insights**
2. Select all Lambda log groups (`/aws/lambda/*`)
3. Run this query:

```
fields @timestamp, @message
| stats count() as totalInvocations
```

## Method 2: AWS CLI Commands

### Get Total Invocations for All Functions

```bash
# List all Lambda functions and get their invocation counts
aws cloudwatch get-metric-statistics \
    --namespace AWS/Lambda \
    --metric-name Invocations \
    --dimensions Name=FunctionName,Value=ALL \
    --statistics Sum \
    --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
    --period 86400 \
    --region us-east-1
```

### Get Invocations by Function (then sum)

```bash
# First, list all functions
functions=$(aws lambda list-functions --query 'Functions[*].FunctionName' --output text)

# Then get metrics for each
for func in $functions; do
    echo "Function: $func"
    aws cloudwatch get-metric-statistics \
        --namespace AWS/Lambda \
        --metric-name Invocations \
        --dimensions Name=FunctionName,Value=$func \
        --statistics Sum \
        --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) \
        --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
        --period 86400 \
        --region us-east-1 \
        --query 'Datapoints[0].Sum'
done
```

### One-liner to get total across all functions

```bash
# Get total invocations for the last 24 hours
aws cloudwatch get-metric-statistics \
    --namespace AWS/Lambda \
    --metric-name Invocations \
    --statistics Sum \
    --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
    --period 86400 \
    --region us-east-1 \
    --query 'Datapoints[0].Sum' \
    --output text
```

## Method 3: AWS Lambda Console

1. Go to AWS Lambda Console
2. Click on **Monitor** in the left sidebar
3. Select **Metrics** tab
4. You'll see aggregated metrics including:
   - Total invocations
   - Error count
   - Success rate
   - Duration metrics

## Method 4: CloudWatch Dashboard

Create a custom dashboard for Lambda metrics:

```bash
# Create dashboard via CLI
aws cloudwatch put-dashboard \
    --dashboard-name LambdaInvocations \
    --dashboard-body '{
        "widgets": [
            {
                "type": "metric",
                "properties": {
                    "metrics": [
                        [ "AWS/Lambda", "Invocations", { "stat": "Sum" } ]
                    ],
                    "period": 300,
                    "stat": "Sum",
                    "region": "us-east-1",
                    "title": "Total Lambda Invocations"
                }
            }
        ]
    }'
```

## Method 5: AWS Cost Explorer

While primarily for costs, Cost Explorer can show usage:

1. Go to AWS Cost Explorer
2. Select **Usage Type** as the dimension
3. Filter for Lambda-related usage types
4. Look for invocation counts in the usage reports

## Method 6: AWS SDK (Python Example)

```python
import boto3
from datetime import datetime, timedelta

cloudwatch = boto3.client('cloudwatch')

# Get metrics for the last 24 hours
end_time = datetime.utcnow()
start_time = end_time - timedelta(days=1)

response = cloudwatch.get_metric_statistics(
    Namespace='AWS/Lambda',
    MetricName='Invocations',
    Dimensions=[],
    StartTime=start_time,
    EndTime=end_time,
    Period=86400,
    Statistics=['Sum']
)

total_invocations = sum(point['Sum'] for point in response['Datapoints'])
print(f"Total Lambda invocations: {total_invocations}")
```

## Method 7: AWS CloudFormation Outputs

If using CloudFormation, add outputs to track metrics:

```yaml
Outputs:
  LambdaInvocationMetric:
    Description: CloudWatch metric for Lambda invocations
    Value: !Sub |
      https://console.aws.amazon.com/cloudwatch/home?region=${AWS::Region}#metricsV2:graph=~();query=~'*7bAWS*2fLambda*2cFunctionName*7d*20Invocations
```

## Method 8: Third-Party Tools

### Using AWS CLI with jq

```bash
# Get total invocations across all functions for the last hour
aws lambda list-functions --query 'Functions[*].FunctionName' --output json | \
jq -r '.[]' | \
while read function; do
    aws cloudwatch get-metric-statistics \
        --namespace AWS/Lambda \
        --metric-name Invocations \
        --dimensions Name=FunctionName,Value=$function \
        --statistics Sum \
        --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
        --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
        --period 3600 \
        --query 'Datapoints[0].Sum' \
        --output text
done | \
awk '{sum += $1} END {print "Total invocations:", sum}'
```

## Method 9: AWS X-Ray

If X-Ray is enabled:

1. Go to AWS X-Ray Console
2. Navigate to **Service Map**
3. Click on Lambda functions
4. View invocation statistics in the details panel

## Method 10: Custom Scripts

### Bash script to monitor invocations

```bash
#!/bin/bash
# Save as check-lambda-invocations.sh

PERIOD=${1:-24} # Default 24 hours
REGION=${2:-us-east-1}

echo "Checking Lambda invocations for the last $PERIOD hours in $REGION"

# Calculate timestamps
END_TIME=$(date -u +%Y-%m-%dT%H:%M:%S)
START_TIME=$(date -u -d "$PERIOD hours ago" +%Y-%m-%dT%H:%M:%S)

# Get total invocations
TOTAL=$(aws cloudwatch get-metric-statistics \
    --namespace AWS/Lambda \
    --metric-name Invocations \
    --statistics Sum \
    --start-time $START_TIME \
    --end-time $END_TIME \
    --period $((PERIOD * 3600)) \
    --region $REGION \
    --query 'Datapoints[0].Sum' \
    --output text)

echo "Total Lambda invocations: ${TOTAL:-0}"

# Optional: Get per-function breakdown
if [ "$3" == "--detailed" ]; then
    echo -e "\nPer-function breakdown:"
    aws lambda list-functions --region $REGION --query 'Functions[*].FunctionName' --output text | \
    tr '\t' '\n' | \
    while read func; do
        count=$(aws cloudwatch get-metric-statistics \
            --namespace AWS/Lambda \
            --metric-name Invocations \
            --dimensions Name=FunctionName,Value=$func \
            --statistics Sum \
            --start-time $START_TIME \
            --end-time $END_TIME \
            --period $((PERIOD * 3600)) \
            --region $REGION \
            --query 'Datapoints[0].Sum' \
            --output text)
        echo "$func: ${count:-0}"
    done
fi
```

## Tips and Best Practices

1. **Time Ranges**: Adjust time ranges based on your needs:

   - Last hour: High granularity for debugging
   - Last 24 hours: Daily monitoring
   - Last 7 days: Weekly trends
   - Last 30 days: Monthly billing cycle

2. **Regions**: Remember to check all regions where you have Lambda functions

3. **Automation**: Set up CloudWatch Alarms for unusual invocation patterns

4. **Cost Monitoring**: High invocation counts can lead to increased costs

5. **Performance**: For large-scale monitoring, use CloudWatch Insights or custom dashboards

## Common Use Cases

- **Billing Alerts**: Monitor invocations to predict costs
- **Performance Monitoring**: Track invocation patterns
- **Debugging**: Identify unexpected invocation spikes
- **Capacity Planning**: Understand usage trends

## Related Metrics to Monitor

- **Duration**: Average execution time
- **Errors**: Failed invocations
- **Throttles**: Rate limit hits
- **Concurrent Executions**: Simultaneous function runs
- **Dead Letter Queue Errors**: Failed async invocations
