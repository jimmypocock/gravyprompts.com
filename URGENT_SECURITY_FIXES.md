# 🚨 URGENT: Security Fixes Required

## Critical Issues

### 1. Disable View/Usage Tracking for Anonymous Users
The `/templates/{id}` endpoint creates DynamoDB records for EVERY view. This is a **cost bomb** waiting to happen.

**Immediate fix needed in `/cdk/lambda/templates/get.js`:**
```javascript
// Only track views for authenticated users
if (!isOwner && userId) {  // Add userId check
  trackView(templateId, userId).catch(console.error);
}
```

### 2. Implement Real Rate Limiting
The `checkRateLimit` function in `/cdk/lambda/layers/nodejs/utils.js` is empty!

**Quick fix - Add IP-based rate limiting:**
```javascript
const checkRateLimit = async (identifier, action, limits) => {
  const key = `rate:${identifier}:${action}`;
  const now = Date.now();
  const windowMs = 60000; // 1 minute
  
  try {
    const result = await docClient.send(new GetCommand({
      TableName: process.env.RATE_LIMITS_TABLE || 'rate-limits',
      Key: { key }
    }));
    
    if (result.Item) {
      const { count, windowStart } = result.Item;
      
      if (now - windowStart < windowMs) {
        if (count >= (limits.perMinute || 60)) {
          return false; // Rate limit exceeded
        }
        
        // Increment counter
        await docClient.send(new UpdateCommand({
          TableName: process.env.RATE_LIMITS_TABLE || 'rate-limits',
          Key: { key },
          UpdateExpression: 'ADD #count :inc',
          ExpressionAttributeNames: { '#count': 'count' },
          ExpressionAttributeValues: { ':inc': 1 }
        }));
      } else {
        // Reset window
        await docClient.send(new PutCommand({
          TableName: process.env.RATE_LIMITS_TABLE || 'rate-limits',
          Item: { key, count: 1, windowStart: now, ttl: Math.floor((now + 300000) / 1000) }
        }));
      }
    } else {
      // First request
      await docClient.send(new PutCommand({
        TableName: process.env.RATE_LIMITS_TABLE || 'rate-limits',
        Item: { key, count: 1, windowStart: now, ttl: Math.floor((now + 300000) / 1000) }
      }));
    }
    
    return true;
  } catch (error) {
    console.error('Rate limit check failed:', error);
    return true; // Fail open for now
  }
};
```

### 3. Add Rate Limiting to Public Endpoints

**In `/cdk/lambda/templates/list.js`:**
```javascript
// Add at the beginning of handler
const clientIp = event.requestContext?.identity?.sourceIp || 'unknown';
const rateLimitOk = await checkRateLimit(clientIp, 'list_templates', {
  perMinute: 30,  // 30 requests per minute per IP
});

if (!rateLimitOk) {
  return createResponse(429, { error: 'Too many requests. Please try again later.' });
}
```

**In `/cdk/lambda/templates/get.js`:**
```javascript
// Add rate limiting for anonymous users
if (!userId) {
  const clientIp = event.requestContext?.identity?.sourceIp || 'unknown';
  const rateLimitOk = await checkRateLimit(clientIp, 'get_template', {
    perMinute: 60,
  });
  
  if (!rateLimitOk) {
    return createResponse(429, { error: 'Too many requests. Please try again later.' });
  }
}
```

### 4. Reduce Response Sizes

**In `/cdk/lambda/templates/list.js`:**
```javascript
// Don't return full content in list responses
const responseItems = items.map(item => ({
  templateId: item.templateId,
  title: item.title,
  // content: item.content,  // REMOVE THIS
  preview: item.content?.substring(0, 200) + '...', // Add preview instead
  variables: item.variables || [],
  // ... rest of fields
}));
```

### 5. Deploy WAF (if not already deployed)
```bash
npm run deploy:waf
```

## Cost Protection Measures

1. **Set up billing alerts:**
   - Go to AWS Billing Console
   - Create alert for $50, $100, $500
   - Enable detailed billing reports

2. **Add DynamoDB alarms:**
   ```bash
   aws cloudwatch put-metric-alarm \
     --alarm-name "DynamoDB-HighUsage" \
     --alarm-description "Alert when DynamoDB usage is high" \
     --metric-name ConsumedReadCapacityUnits \
     --namespace AWS/DynamoDB \
     --statistic Sum \
     --period 300 \
     --threshold 1000 \
     --comparison-operator GreaterThanThreshold \
     --evaluation-periods 2
   ```

3. **Consider switching to DynamoDB On-Demand** with limits:
   - Set account-level limits
   - Monitor consumed capacity

## Temporary Mitigation

Until these fixes are deployed, consider:

1. **Temporarily require auth for all endpoints** by modifying API Gateway
2. **Set stricter WAF rules** (lower rate limits)
3. **Monitor CloudWatch closely** for unusual patterns
4. **Have a kill switch ready** to disable public endpoints if attacked

## Long-term Solutions

1. **Implement CloudFront** for caching and DDoS protection
2. **Use API Keys** for public endpoints with quotas
3. **Add CAPTCHA** for high-risk operations
4. **Implement cost controls** with AWS Budgets
5. **Use AWS Shield Advanced** if you expect targeted attacks

## Testing After Fixes

```bash
# Test rate limiting
for i in {1..100}; do
  curl -s -o /dev/null -w "%{http_code}\n" https://api.gravyprompts.com/templates
done

# Should see 429 responses after limit exceeded
```

Remember: **It's better to be too restrictive than to wake up to a huge AWS bill!**