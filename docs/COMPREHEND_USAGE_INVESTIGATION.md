# AWS Comprehend Usage Investigation

## Issue Summary
The AWS Comprehend free tier limit (50,000 units) is being hit despite claiming only 2 template uses. This suggests excessive API calls are being made.

## Analysis of the Code

### 1. Moderation Function Behavior
The moderation Lambda function (`cdk/lambda/moderation/moderate.js`) is triggered by DynamoDB streams when:
- A new template is created with `visibility: 'public'`
- An existing template is modified and has `visibility: 'public'`

### 2. Comprehend API Calls per Moderation
For each template moderation, the function makes **3 parallel API calls**:
1. `DetectSentimentCommand` - Analyzes sentiment
2. `DetectToxicContentCommand` - Checks for toxic content
3. `DetectPiiEntitiesCommand` - Detects personal information

**This means each template moderation consumes 3 Comprehend units, not 1.**

### 3. Potential Causes of Excessive Usage

#### A. **Infinite Loop in DynamoDB Streams**
**CRITICAL ISSUE FOUND**: The moderation function updates the template with moderation results, which triggers another MODIFY event on the DynamoDB stream!

```javascript
// Line 48-57 in moderate.js
await docClient.send(new UpdateCommand({
  TableName: process.env.TEMPLATES_TABLE,
  Key: { templateId },
  UpdateExpression: 'SET moderationStatus = :status, moderationDetails = :details, moderatedAt = :moderatedAt',
  // This update triggers another stream event!
}));
```

The function does check for this (lines 28-36), but there's a potential race condition or edge case where:
1. Template is created/modified
2. Moderation runs and updates the template
3. The update triggers another stream event
4. If the check fails (timing issue, eventual consistency), it moderates again

#### B. **Batch Processing**
DynamoDB streams can batch up to 100 records by default. If you had multiple updates to the same template in quick succession, they might all be processed.

#### C. **Lambda Retries**
If the Lambda function fails after calling Comprehend but before updating the moderation status, it will retry and call Comprehend again.

#### D. **Stream Shard Iterator Issues**
If there are issues with the stream processing, records might be reprocessed.

## Immediate Fixes

### Fix 1: Prevent Infinite Loop (CRITICAL)
Update the moderation function to use a condition expression that prevents re-triggering:

```javascript
// In moderate.js, modify the update to include a condition
await docClient.send(new UpdateCommand({
  TableName: process.env.TEMPLATES_TABLE,
  Key: { templateId },
  UpdateExpression: 'SET moderationStatus = :status, moderationDetails = :details, moderatedAt = :moderatedAt',
  ExpressionAttributeValues: {
    ':status': moderationResult.status,
    ':details': moderationResult.details,
    ':moderatedAt': new Date().toISOString(),
    ':currentStatus': newImage.moderationStatus?.S || 'none',
  },
  // Only update if status is different or not yet moderated
  ConditionExpression: 'attribute_not_exists(moderationStatus) OR moderationStatus <> :status OR moderationStatus = :currentStatus',
}));
```

### Fix 2: Add Deduplication
Add a check to prevent processing the same content multiple times:

```javascript
// At the beginning of moderation function
const contentHash = crypto.createHash('md5').update(content).digest('hex');
const moderationKey = `${templateId}-${contentHash}`;

// Check if we've already moderated this exact content
const existingModeration = await docClient.send(new GetCommand({
  TableName: process.env.MODERATION_CACHE_TABLE, // New table needed
  Key: { moderationKey },
}));

if (existingModeration.Item && existingModeration.Item.expiresAt > Date.now()) {
  console.log(`Using cached moderation for ${templateId}`);
  return existingModeration.Item.result;
}
```

### Fix 3: Add Better Logging
Add comprehensive logging to track every Comprehend call:

```javascript
console.log(`Starting moderation for template ${templateId}`, {
  eventName: record.eventName,
  visibility: newImage.visibility?.S,
  currentModerationStatus: newImage.moderationStatus?.S,
  contentLength: content.length,
});

// Before Comprehend calls
console.log(`Calling Comprehend APIs for template ${templateId}`);

// After Comprehend calls
console.log(`Comprehend APIs completed for template ${templateId}`, {
  sentiment: sentimentResult.Sentiment,
  toxicityLabelsCount: moderationDetails.toxicityLabels.length,
  piiEntitiesCount: moderationDetails.piiEntities.length,
});
```

### Fix 4: Configure Event Source Mapping
Update the CDK stack to set proper batch configuration:

```typescript
// In api-stack.ts, modify the event source mapping
moderateContentFunction.addEventSourceMapping('ModerateContentTrigger', {
  eventSourceArn: this.templatesTable.tableStreamArn!,
  startingPosition: lambda.StartingPosition.LATEST,
  batchSize: 10, // Reduce from default 100
  maxBatchingWindowInSeconds: 5,
  parallelizationFactor: 1, // Process shards sequentially
  retryAttempts: 2, // Limit retries
  bisectBatchOnError: true, // Isolate problematic records
  filters: [/* existing filters */],
});
```

## Monitoring Scripts

### 1. Check Current Usage
Run the provided script to analyze current usage:
```bash
npm run scripts:analyze-comprehend
```

### 2. Monitor Real-time Lambda Logs
```bash
aws logs tail /aws/lambda/YOUR-FUNCTION-NAME --follow --filter-pattern "Comprehend"
```

### 3. Check DynamoDB Stream Metrics
```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name StreamRecordsCount \
  --dimensions Name=TableName,Value=YOUR-TABLE-NAME \
  --statistics Sum \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-10T00:00:00Z \
  --period 3600
```

## Long-term Improvements

1. **Implement Caching**: Cache moderation results for identical content
2. **Batch Processing**: Accumulate templates and moderate in batches
3. **Conditional Moderation**: Only moderate when content significantly changes
4. **Use Step Functions**: Better control over the moderation workflow
5. **Add Dead Letter Queue**: Capture and analyze failed moderation attempts

## Cost Optimization

1. **Free Tier Limits**: 
   - 50,000 units per month for first 12 months
   - After that: $0.0001 per unit (100 units = $0.01)

2. **Reduce API Calls**:
   - Consider if all 3 Comprehend APIs are necessary
   - DetectToxicContent might be sufficient for basic moderation

3. **Alternative Services**:
   - Consider using AWS Rekognition for image moderation
   - Use simple keyword filtering for basic checks before Comprehend

## Action Items

1. **Immediate**: Deploy Fix 1 to prevent the infinite loop
2. **Today**: Add comprehensive logging (Fix 3)
3. **This Week**: Implement deduplication (Fix 2)
4. **Next Sprint**: Configure proper event source mapping (Fix 4)
5. **Monitor**: Run the analysis script daily until issue is resolved