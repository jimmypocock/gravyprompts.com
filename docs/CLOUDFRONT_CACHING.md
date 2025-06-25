# CloudFront Caching Documentation

## Overview

GravyPrompts uses AWS CloudFront as a CDN to cache API responses globally, reducing latency and Lambda invocation costs.

## Cache Strategy

### Cache-Control Headers

Lambda functions set appropriate `Cache-Control` headers based on content type:

| Content Type | Cache Duration | Header |
|-------------|----------------|---------|
| Public Templates (approved) | 1 hour browser, 24 hours CDN | `public, max-age=3600, s-maxage=86400` |
| Template Lists (popular) | 5 min browser, 1 hour CDN | `public, max-age=300, s-maxage=3600` |
| Template Lists (public) | 1 min browser, 5 min CDN | `public, max-age=60, s-maxage=300` |
| Search Results | 30s browser, 1 min CDN | `public, max-age=30, s-maxage=60` |
| User-specific Content | No CDN cache | `private, max-age=0, no-cache` |
| Mutations (POST/PUT/DELETE) | No cache | `no-cache, no-store, must-revalidate` |
| Admin Endpoints | No cache | `no-cache, no-store, must-revalidate` |

### Cache Invalidation Strategy

**IMPORTANT**: CloudFront invalidations cost $0.005 per path after 1000 free/month.

#### When NOT to Invalidate

1. **Template Updates**: Let cache expire naturally (max 24 hours)
2. **New Templates**: No invalidation needed - new URLs
3. **Private → Public**: No invalidation needed - was never cached

#### When to Invalidate (Emergency Only)

1. **Security Issues**: Exposed sensitive data
2. **Legal Requirements**: DMCA takedowns, etc.
3. **Critical Bugs**: Broken content affecting many users

#### How to Invalidate

```bash
# Single template
aws cloudfront create-invalidation \
  --distribution-id YOUR_DIST_ID \
  --paths "/templates/TEMPLATE_ID"

# All templates (expensive!)
aws cloudfront create-invalidation \
  --distribution-id YOUR_DIST_ID \
  --paths "/templates/*"
```

## Cost Protection

### 1. Data Transfer Monitoring
- **Alert**: > 10 GB/day data transfer
- **Action**: Review large templates, consider compression

### 2. Origin Request Monitoring  
- **Alert**: > 10k requests/hour to origin
- **Action**: Review cache hit rate, adjust TTLs

### 3. Cache Hit Rate Monitoring
- **Alert**: < 80% cache hit rate
- **Action**: Review cache headers, user patterns

### 4. Price Class Limitation
- Using `PRICE_CLASS_100` (North America & Europe only)
- Reduces edge locations to control costs

## Monitoring

### CloudWatch Dashboard
- **Name**: `GravyPrompts-CloudFront-Monitoring`
- **Metrics**: Cache hit rate, data transfer, origin requests

### SNS Alerts
- **Topic**: `GravyPrompts-CloudFront-Alerts`
- Subscribe your email after deployment!

### Key Metrics to Watch

1. **Cache Hit Ratio**: Should be > 80% for public content
2. **Origin Requests**: High numbers = high Lambda costs
3. **Bytes Downloaded**: High numbers = high transfer costs
4. **4xx/5xx Errors**: May indicate caching issues

## Troubleshooting

### Low Cache Hit Rate

1. **Check Headers**: Verify Lambda returns correct Cache-Control
   ```bash
   curl -I https://cloudfront-url/templates/TEMPLATE_ID
   ```

2. **Check Vary Header**: Too many vary headers = cache fragmentation

3. **Check Query Strings**: Different query strings = different cache entries

### Content Not Updating

1. **Check TTL**: Public templates cache for 24 hours max
2. **Check Cache-Control**: Verify Lambda sends correct headers
3. **Emergency**: Use invalidation (costs money!)

### High Costs

1. **Data Transfer**: 
   - Check for large templates
   - Enable compression
   - Review access patterns

2. **Origin Requests**:
   - Increase cache TTLs
   - Fix cache headers
   - Review user access patterns

## Testing Cache Headers

Run the test suite:
```bash
cd cdk && npm test -- lambda/templates/__tests__/cache-headers.test.js
```

## Deployment

```bash
# Deploy CloudFront
npm run deploy:cache

# After deployment, subscribe to alerts
aws sns subscribe \
  --topic-arn [Outputted ARN] \
  --protocol email \
  --notification-endpoint your-email@example.com
```

## Best Practices

1. **Never Cache User Data**: Always use `private` cache control
2. **Version Assets**: For static content, use versioned URLs
3. **Monitor Costs**: Check CloudFront bill weekly
4. **Test Headers**: Always verify Cache-Control in responses
5. **Avoid Invalidations**: Design around natural expiration

## Cost Estimation

- **Data Transfer**: ~$0.085/GB (varies by region)
- **HTTP Requests**: ~$0.0075 per 10,000 requests
- **Invalidations**: $0.005 per path after 1000 free

Example monthly costs for moderate traffic:
- 100 GB transfer: ~$8.50
- 10M requests: ~$7.50
- Total: ~$16/month + invalidations

## Security Considerations

1. **Signed URLs**: Not implemented - consider for premium content
2. **WAF Integration**: Can add WAF to CloudFront (additional cost)
3. **Cache Poisoning**: Vary headers prevent this
4. **DDoS Protection**: CloudFront provides basic DDoS protection