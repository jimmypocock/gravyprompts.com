# AWS Comprehend Removal Summary

## What Happened

On January 10, 2025, an infinite loop in the content moderation Lambda resulted in $100+ of AWS Comprehend charges. The Lambda was updating templates, which triggered DynamoDB streams, which triggered the Lambda again, creating an infinite loop with ~330,000 invocations.

## What Was Removed

### 1. **Lambda Layer Dependencies**

- Removed `@aws-sdk/client-comprehend` from `/cdk/lambda-layers/shared/nodejs/package.json`
- Removed `comprehendClient` from `/cdk/lambda-layers/shared/nodejs/utils.js`

### 2. **IAM Permissions**

- Removed Comprehend permissions from `/cdk/src/api-stack.ts`:
  - `comprehend:DetectSentiment`
  - `comprehend:DetectToxicContent`
  - `comprehend:DetectPiiEntities`

### 3. **Moderation Lambda**

- Replaced `/cdk/lambda/moderation/moderate.js` with a Comprehend-free version
- New implementation uses basic content checks instead of API calls
- No external dependencies = No surprise costs

### 4. **Documentation**

- Updated `/docs/CONTENT_MODERATION.md` to reflect new approach
- Updated `/CLAUDE.md` with warning about Comprehend removal

## New Moderation System

The new system performs basic checks without any external API calls:

```javascript
// Basic content checking without external APIs
function checkContent(title, content) {
  // 1. Check for blocked words
  // 2. Check for excessive CAPS (spam indicator)
  // 3. Check for repetitive content (spam indicator)
  // Returns: approved, rejected, or review
}
```

## Cost Savings

- AWS Comprehend: ~$0.001-0.002 per template
- New system: $0 (no external API calls)
- With 330,000 invocations, you save hundreds of dollars

## Deployment Steps

1. **Clean and rebuild Lambda layer**:

   ```bash
   cd cdk/lambda-layers/shared/nodejs
   npm install
   ```

2. **Build CDK**:

   ```bash
   npm run build:cdk
   ```

3. **Deploy updated infrastructure**:
   ```bash
   npm run deploy:api
   ```

## Alternative Moderation Options

If you need more sophisticated moderation in the future, consider:

1. **OpenAI Moderation API** - Free tier available
2. **Perspective API** - Google's free toxicity detection
3. **Manual review queue** - For smaller volumes
4. **Community reporting** - Let users flag inappropriate content

## Lessons Learned

1. **Always implement circuit breakers** for Lambda functions with DynamoDB streams
2. **Set up billing alerts** before using any metered AWS service
3. **Test thoroughly** with DynamoDB streams to prevent loops
4. **Consider cost implications** of API-based services at scale
5. **Simple solutions** are often better than complex ones

## Files Archived

The following files contain Comprehend references but are kept for reference:

- `/cdk/lambda/moderation/moderate-original.js` (original with Comprehend)
- `/cdk/lambda/moderation/moderate-fixed.js` (attempted fix)
- `/scripts/analyze-comprehend-usage.sh` (usage analysis)
- `/scripts/check-comprehend-manual.md` (manual checks)

These can be deleted if no longer needed.
