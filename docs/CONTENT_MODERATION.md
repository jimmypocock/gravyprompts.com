# Content Moderation System

## Overview

The content moderation system automatically reviews public templates using basic content checks to detect:
- Blocked words/phrases
- Excessive capitalization (spam indicator)
- Repetitive content (spam indicator)

**AWS Comprehend has been completely removed from this application** due to unexpected costs from an infinite loop incident ($100+ charges).

## Current Status

**✅ MODERATION ACTIVE - Comprehend-Free Version**

The moderation system now uses simple, cost-free checks without any external API calls.

## The Problem

### Infinite Loop Issue
1. User creates/updates a public template
2. DynamoDB stream triggers moderation Lambda
3. Moderation Lambda analyzes content and updates the template with moderation results
4. This update triggers the DynamoDB stream again
5. Loop continues indefinitely

### API Error Issue
The `DetectToxicContentCommand` was failing with:
```
ValidationException: 1 validation error detected: Value null at 'textSegments' failed to satisfy constraint: Member must not be null
```

This API is not available in the standard Comprehend API and requires special access.

## The Solution

### Comprehend-Free Moderation (`moderate.js`)
1. **Loop Prevention**:
   - Checks if update is from moderation itself (by checking `moderatedAt` timestamp)
   - Uses content hash to prevent re-moderation of same content
   - Conditional updates to prevent race conditions

2. **Basic Content Checks**:
   - Blocked words detection (customizable list)
   - Excessive capitalization detection (>70% caps = potential spam)
   - Repetitive content detection (>70% repeated words = potential spam)
   - No external API calls = No surprise charges!

3. **Moderation States**:
   - `approved` - Passes all basic checks
   - `rejected` - Contains blocked content
   - `review` - Suspicious patterns detected (manual review needed)

## Emergency Procedures

### Stop Moderation Lambda
```bash
# Find Lambda function names
./scripts/find-and-stop-lambda.sh

# Stop specific Lambda
aws lambda put-function-concurrency \
  --function-name <FUNCTION_NAME> \
  --reserved-concurrent-executions 0 \
  --profile gravy

# Or use the emergency script
./scripts/stop-both-lambdas.sh
```

### Check if Lambda is Stopped
```bash
./scripts/check-moderation-stopped.sh
```

### Manually Approve Templates
```bash
# List pending templates
node scripts/approve-pending-templates.js

# Approve all pending templates
node scripts/approve-pending-templates.js --all

# Approve specific template
node scripts/approve-pending-templates.js --template-id <template-id>
```

## Re-enabling Moderation

1. **Deploy the fixed Lambda**:
   ```bash
   # Replace moderate.js with one of the fixed versions
   cp cdk/lambda/moderation/moderate-fixed.js cdk/lambda/moderation/moderate.js
   # OR for temporary auto-approval
   cp cdk/lambda/moderation/moderate-simple.js cdk/lambda/moderation/moderate.js
   
   # Deploy the API stack
   npm run deploy:api
   ```

2. **Re-enable Lambda concurrency**:
   ```bash
   aws lambda put-function-concurrency \
     --function-name <FUNCTION_NAME> \
     --reserved-concurrent-executions 10 \
     --profile gravy
   ```

3. **Monitor for issues**:
   ```bash
   # Watch CloudWatch logs
   aws logs tail /aws/lambda/<FUNCTION_NAME> --follow --profile gravy
   
   # Check Comprehend usage
   ./scripts/check-moderation-stopped.sh
   ```

## Architecture

### DynamoDB Table Structure
- `moderationStatus`: 'pending' | 'approved' | 'rejected' | 'review'
- `moderatedAt`: ISO timestamp of last moderation
- `moderationDetails`: Object with analysis results
- `contentHash`: MD5 hash of title+content to detect changes

### Lambda Trigger
- Triggered by DynamoDB Streams on INSERT and MODIFY events
- Only processes templates with `visibility: 'public'`
- Skips templates already moderated for same content

### Moderation Logic
- **Approved**: No issues detected
- **Rejected**: Sensitive PII detected
- **Review**: High negative sentiment or API errors
- **Pending**: Awaiting moderation

## Cost Considerations

AWS Comprehend pricing (as of 2024):
- Sentiment Analysis: $0.0001 per unit (100 characters)
- PII Detection: $0.0001 per unit (100 characters)
- Toxic Content Detection: Not publicly available

For a 1000-character template:
- Cost per moderation: ~$0.002
- With infinite loop: Can quickly escalate to $100s

## Future Improvements

1. **Implement rate limiting** in the Lambda itself
2. **Add CloudWatch alarms** for high invocation rates
3. **Consider alternative moderation services** (OpenAI, Perspective API)
4. **Implement moderation queue** with batch processing
5. **Add manual review interface** for templates marked as 'review'
6. **Cache moderation results** by content hash

## Related Files

- `/cdk/lambda/moderation/moderate.js` - Current moderation Lambda
- `/cdk/lambda/moderation/moderate-fixed.js` - Fixed version with loop prevention
- `/cdk/lambda/moderation/moderate-simple.js` - Simple auto-approval version
- `/scripts/approve-pending-templates.js` - Manual approval script
- `/scripts/stop-both-lambdas.sh` - Emergency stop script
- `/scripts/check-moderation-stopped.sh` - Check if Lambda is stopped