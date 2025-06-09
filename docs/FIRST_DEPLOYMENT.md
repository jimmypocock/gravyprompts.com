# First Deployment Guide for GravyPrompts

This guide helps you deploy GravyPrompts (the AI prompt template management platform) for the first time, including all infrastructure and the template API.

## Prerequisites

1. AWS CLI configured with credentials
2. Domain name ready (gravyprompts.com)
3. Access to DNS provider to add CNAME records

## Step 1: Initial Setup

```bash
# Install dependencies
npm install

# Build the Next.js app
npm run build

# Install CDK dependencies
npm run cdk:install
```

## Step 2: Deploy Certificate (if using custom domain)

The certificate must be deployed and validated BEFORE other stacks:

```bash
# Deploy the certificate
npm run deploy:cert
```

After deployment, you'll see DNS validation records. Add these CNAME records to your DNS provider immediately.

Example output:
```
┌─────────────────┬─────────────────────────────────┬─────────────────────────────────┐
│ Domain          │ CNAME Name                      │ CNAME Value                     │
├─────────────────┼─────────────────────────────────┼─────────────────────────────────┤
│ gravyprompts.com│ _abc123.gravyprompts.com        │ _def456.acm-validations.aws.    │
└─────────────────┴─────────────────────────────────┴─────────────────────────────────┘
```

## Step 3: Validate Certificate

Wait 5-30 minutes for DNS propagation, then check status:

```bash
# Check certificate validation status
npm run check:cert
```

Look for "Certificate is valid and issued!" before proceeding.

## Step 4: Deploy Everything Else

Once the certificate shows as ISSUED:

```bash
# Deploy all remaining stacks
npm run deploy:all
```

This will deploy:
- Foundation (S3 buckets)
- Edge Functions
- WAF
- CDN
- Authentication (Cognito)
- API (Template management with API Gateway, Lambda, DynamoDB)
- Application
- Monitoring

**Important**: When the Auth and API stacks complete, save the outputs:
- Cognito User Pool ID and Client ID
- API Gateway URL

You'll need these for your `.env.local` file.

## Alternative: Deploy Without Custom Domain

If you want to deploy without a custom domain (using CloudFront URL only):

```bash
# Run deploy:all and choose option 2 when prompted
npm run deploy:all
```

## Troubleshooting

### Certificate Stuck in PENDING_VALIDATION
- Double-check CNAME records are added correctly
- Wait up to 72 hours for validation
- Check DNS propagation with: `dig _abc123.gravyprompts.com CNAME`

### Certificate Gets Deleted
- The certificate is now independent of other stacks
- Other stacks won't delete it
- Save the certificate ARN after creation to reuse it

### Reusing an Existing Certificate
After certificate is validated, save the ARN:
```bash
# The ARN will be shown in the output
# Add it to cdk/cdk.json:
{
  "context": {
    "certificateArn": "arn:aws:acm:us-east-1:123456789012:certificate/abc-def-ghi"
  }
}
```

## Success!

Once deployed, your site will be available at:
- https://gravyprompts.com
- https://www.gravyprompts.com

CloudFront URL (always available):
- https://dxxxxx.cloudfront.net