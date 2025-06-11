# Manual AWS Comprehend Usage Check

Since AWS CLI isn't configured, here's how to manually check your Comprehend usage:

## 1. Check AWS Billing Dashboard
1. Go to AWS Console → Billing & Cost Management
2. Click on "Bills" in the left sidebar
3. Look for "Amazon Comprehend" in the service list
4. You should see your usage breakdown by operation type

## 2. Check CloudWatch Metrics (AWS Console)
1. Go to CloudWatch → Metrics → All metrics
2. Search for "Comprehend"
3. Click on "AWS/Comprehend" → "By Operation Name"
4. Look for these metrics:
   - DetectSentiment
   - DetectToxicContent
   - DetectPiiEntities
5. Set time range to last 7 days
6. Check the graph for usage spikes

## 3. Check Lambda Function Logs
1. Go to Lambda → Functions
2. Find your moderation function (should contain "ModerateContent" in the name)
3. Click on "Monitor" tab → "View logs in CloudWatch"
4. Look for log entries containing:
   - "Moderation event received"
   - "Starting moderation for template"
   - "Skipping template" (this indicates the fix is working)

## 4. Check DynamoDB Streams
1. Go to DynamoDB → Tables
2. Find your templates table
3. Click on "Exports and streams" tab
4. Check the stream details and look for:
   - Batch size (if it's 100, that could cause bulk processing)
   - Error rate
   - Number of records processed

## 5. What to Look For

### Signs the Fix is Working:
- Log entries showing "Skipping template - content unchanged and already moderated"
- Log entries showing "just moderated X seconds ago"
- No more increasing Comprehend usage after deployment

### Signs of the Previous Problem:
- Multiple moderation events for the same templateId within seconds
- Comprehend API calls in the thousands when you only have a few templates
- Lambda invocation count much higher than number of templates

## 6. Expected Usage Pattern
With the fix deployed, you should see:
- 3 Comprehend API calls per unique public template content
- No repeated processing of the same content
- Moderation only when content actually changes

## 7. Monitor Going Forward
Set up a CloudWatch alarm:
1. Go to CloudWatch → Alarms
2. Create alarm for Comprehend UserRequestCount
3. Set threshold to alert if > 100 calls per hour
4. This will help catch any future issues early