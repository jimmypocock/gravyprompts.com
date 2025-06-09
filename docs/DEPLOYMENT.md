# Complete Deployment Guide

This comprehensive guide covers all aspects of deploying your Next.js application to AWS using CDK.

## Table of Contents
- [Quick Start](#quick-start)
- [Prerequisites](#prerequisites)
- [Architecture Overview](#architecture-overview)
- [Initial Setup](#initial-setup)
- [Deployment Process](#deployment-process)
- [Post-Deployment Configuration](#post-deployment-configuration)
- [Common Operations](#common-operations)
- [Troubleshooting](#troubleshooting)
- [Cost Considerations](#cost-considerations)
- [Security Features](#security-features)

## Quick Start

### 🚀 Deploy Your Site in 3 Steps

#### Step 1: Environment Setup
```bash
# Copy and configure environment
cp .env.example .env

# Edit .env and add:
# - AWS_PROFILE=your-profile-name (if using SSO)
# - DOMAIN_NAME=yourdomain.com
# - APP_NAME=your-app-name

# Install CDK dependencies (one time only)
npm run cdk:install
```

#### Step 2: First Time Deployment
```bash
# Deploy everything including new certificate
npm run deploy:all -- -c createCertificate=true -c notificationEmail=your-email@example.com

# After deployment:
# 1. Find certificate validation records in AWS Certificate Manager
# 2. Add CNAME records to your DNS provider
# 3. Wait for validation (5-30 minutes)
# 4. Configure DNS to point to CloudFront (see Post-Deployment)
```

#### Step 3: Regular Updates
```bash
# Just deploy app changes
npm run build && npm run deploy:app

# Update everything (except certificate)
npm run deploy:all
```

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **AWS CLI** configured:
   ```bash
   # For standard credentials
   aws configure

   # For AWS SSO (recommended)
   aws sso login --profile your-profile-name
   # Add to .env: AWS_PROFILE=your-profile-name
   ```
3. **Node.js** 18.x or later
4. **Domain** registered (for production)

## Architecture Overview

This application uses a decoupled AWS architecture with these stacks:

| Stack | Purpose | Resources | Deploy Order |
|-------|---------|-----------|--------------|
| **Foundation** | Core infrastructure | S3 buckets for content and logs | 1st |
| **Certificate** | SSL/TLS | ACM certificate (create once, never delete) | 2nd |
| **Edge Functions** | URL handling | CloudFront functions for redirects | 3rd |
| **WAF** | Security | Rate limiting, geo-blocking | 4th |
| **CDN** | Content delivery | CloudFront distribution | 5th |
| **Auth** | Authentication | Cognito user pools (dev/prod) | 6th |
| **API** | Template management | API Gateway, Lambda, DynamoDB | 7th |
| **App** | Website content | Static files deployment | 8th |
| **Monitoring** | Observability | CloudWatch dashboards, billing alerts | 9th |

### Key Features
- **Automatic S3 bucket policy configuration** - No manual fixes needed
- **CloudFront Origin Access Control (OAC)** for secure S3 access
- **Smart redirect handling** - All traffic goes to `https://www.yourdomain.com`
- **Security headers** automatically applied
- **Cost monitoring** with automatic billing alerts

## Initial Setup

### 1. Install Dependencies
```bash
# Install Next.js dependencies
npm install

# Install CDK dependencies
npm run cdk:install

# Copy environment file
cp .env.example .env
```

### 2. Configure Environment Variables
Edit `.env` with your values:
```bash
# Google Analytics (optional)
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX

# Google AdSense (optional)
NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-XXXXXXXXXXXXXXXXX

# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=123456789012
AWS_PROFILE=your-profile-name  # If using SSO
DOMAIN_NAME=yourdomain.com
APP_NAME=your-app-name
```

### 3. Set up Google Services (Optional)
- **Google Analytics**: Create GA4 property at [analytics.google.com](https://analytics.google.com)
- **Google AdSense**: Apply at [adsense.google.com](https://adsense.google.com)

## Deployment Process

### First-Time Deployment

Deploy all stacks with a new certificate:
```bash
npm run deploy:all -- -c createCertificate=true -c notificationEmail=your-email@example.com
```

This command will:
1. Check AWS credentials
2. Build the CDK TypeScript code
3. Deploy all stacks in the correct order
4. Create SSL certificate (requires DNS validation)
5. Set up monitoring with email alerts

**Certificate Validation Steps:**
1. Go to AWS Certificate Manager in the AWS Console
2. Find your certificate and click on it
3. Copy the CNAME validation records
4. Add BOTH records to your DNS provider:
   - One for `yourdomain.com`
   - One for `www.yourdomain.com`
5. Wait for status to show "Issued" (5-30 minutes)

### Individual Stack Deployment

You can also deploy stacks individually:
```bash
# 1. Foundation (S3 buckets)
npm run deploy:foundation

# 2. Certificate (if creating new)
npm run deploy:cert -- -c createCertificate=true

# 3. Edge Functions
npm run deploy:edge

# 4. WAF (optional but recommended)
npm run deploy:waf

# 5. CDN
npm run deploy:cdn

# 6. Authentication (deploy production pool)
ENVIRONMENT=production npm run deploy:auth
# Save the User Pool ID and Client ID from output!

# 7. API (Template management for production)
ENVIRONMENT=production npm run deploy:api
# Save the API Gateway URL from output!

# 8. Application content
npm run deploy:app

# 9. Monitoring (optional)
npm run deploy:monitoring -- -c notificationEmail=your-email@example.com
```

### Updating Your Site

**Important**: Before building for production, ensure:
1. `.env.local` has production API URL and Cognito IDs
2. `next.config.ts` has `output: 'export'` uncommented

For content updates only:
```bash
# Uncomment output: 'export' in next.config.ts first!
npm run build && npm run deploy:app
```

For infrastructure updates:
```bash
npm run deploy:all
```

## Post-Deployment Configuration

### Configure Environment Variables

After deploying Auth and API stacks, update your `.env.local` file:

```bash
# Copy the example file
cp .env.local.example .env.local

# Edit .env.local and add:
# From Auth stack output:
NEXT_PUBLIC_COGNITO_USER_POOL_ID_PROD=us-east-1_XXXXXXXXX
NEXT_PUBLIC_COGNITO_CLIENT_ID_PROD=XXXXXXXXXXXXXXXXXXXXXXXXX

# From API stack output:
NEXT_PUBLIC_API_URL=https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/production
```

### DNS Configuration

After deployment completes, configure your DNS:

1. **Note CloudFront domain** from deployment output (e.g., `d1234abcd.cloudfront.net`)

2. **Configure DNS Records:**

   **Option A - Route 53 (Recommended):**
   - Create ALIAS record: `yourdomain.com` → CloudFront distribution
   - Create ALIAS record: `www.yourdomain.com` → CloudFront distribution

   **Option B - Other DNS Providers:**
   - Create CNAME: `www` → `d1234abcd.cloudfront.net`
   - Create CNAME/ALIAS: `@` → `d1234abcd.cloudfront.net`

3. **Wait for propagation** (15 minutes to 2 hours)

### URL Redirect Behavior

All traffic is automatically redirected to `https://www.yourdomain.com`:
- `http://yourdomain.com` → `https://www.yourdomain.com`
- `https://yourdomain.com` → `https://www.yourdomain.com`
- `http://www.yourdomain.com` → `https://www.yourdomain.com`
- CloudFront URLs → `https://www.yourdomain.com`

## Common Operations

### Maintenance Mode
```bash
# Enable maintenance page
npm run maintenance:on

# Disable maintenance page
npm run maintenance:off
```

### Update Security Rules
```bash
npm run deploy:waf
```

### Change Monitoring Alerts
```bash
npm run deploy:monitoring -- -c notificationEmail=new-email@example.com
```

### Check Stack Status
```bash
# All stacks
npm run status:all

# Specific stack
npm run status
```

### Validate Configuration
```bash
npm run validate
```

## Troubleshooting

### Common Issues and Solutions

#### 403 Forbidden After Deployment
- **Normal!** CloudFront takes 15-20 minutes to propagate globally
- S3 bucket policy is automatically configured - no manual fix needed
- Verify DNS records point to CloudFront (not S3)
- Check S3 has content: `aws s3 ls s3://yourdomain.com-app/`
- Clear browser cache or test in incognito mode

#### Certificate Validation Issues
- Ensure certificate is in `us-east-1` region
- Verify BOTH www and non-www validation records are added
- Check validation: `dig _abc123.yourdomain.com CNAME +short`
- Both domains must show "Issued" status in ACM

#### Stack Stuck in UPDATE_IN_PROGRESS
- Run `npm run status:all` to check current state
- Wait for completion (can take 30+ minutes for some stacks)
- If truly stuck, check CloudFormation console for rollback

#### Build and Development Errors
```bash
# Clear Next.js cache
rm -rf .next out

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# CDK TypeScript errors
cd cdk && rm -rf lib/*.js lib/*.d.ts && npm run build
```

#### AWS Credential Issues
```bash
# Verify credentials
aws sts get-caller-identity

# For SSO users
aws sso login --profile your-profile-name

# Bootstrap CDK (first time per account/region)
cd cdk && npx cdk bootstrap
```

### Getting Help

1. Check AWS CloudFormation console for detailed error messages
2. Review CloudWatch logs for runtime issues
3. Use browser developer tools to check for client-side errors
4. Verify all prerequisites are met

## Cost Considerations

### Estimated Monthly Costs

For a low-traffic site, expect ~$6-10/month:
- **S3**: ~$0.023/GB for storage
- **CloudFront**: ~$0.085/GB data transfer
- **WAF**: ~$5/month + $0.60/million requests
- **Route 53**: ~$0.50/month (if used)
- **CloudWatch**: ~$0.30/GB for logs

### Cost Optimization
- WAF is the largest fixed cost - disable if not needed
- CloudFront costs scale with traffic
- S3 costs are minimal for static sites
- Monitoring stack includes automatic billing alerts at $10, $50, and $100

## Security Features

### Automatic Security Headers
- **Strict-Transport-Security**: Forces HTTPS for 2 years
- **X-Content-Type-Options**: Prevents MIME sniffing
- **X-Frame-Options**: Prevents clickjacking
- **X-XSS-Protection**: Enables XSS filtering
- **Referrer-Policy**: Controls referrer information
- **Permissions-Policy**: Restricts browser features

### WAF Protection
- Rate limiting (2000 requests per 5 minutes per IP)
- Geographic restrictions (configurable)
- IP reputation lists
- Bot protection

### Infrastructure Security
- S3 buckets are private (no public access)
- CloudFront Origin Access Control for S3
- All traffic forced to HTTPS
- Automated security patches via managed services

## Advanced Operations

### Complete Redeployment
If you need to start fresh while keeping your certificate:
```bash
# 1. Delete stacks in reverse order (keep certificate!)
npm run destroy:monitoring
npm run destroy:waf
aws cloudformation delete-stack --stack-name YOUR-APP-App
aws cloudformation delete-stack --stack-name YOUR-APP-CDN
aws cloudformation delete-stack --stack-name YOUR-APP-EdgeFunctions
# DO NOT delete certificate stack
aws cloudformation delete-stack --stack-name YOUR-APP-Foundation

# 2. Redeploy
npm run deploy:all
```

### Using Existing Certificate
```bash
# Add to .env
CERTIFICATE_ARN=arn:aws:acm:us-east-1:123456789012:certificate/abc-def-ghi

# Deploy without creating certificate
npm run deploy:all
```

### Custom Domain Configuration
```bash
# Deploy with custom parameters
npm run deploy:cdn -- -c domainName=custom.example.com
```

## Monitoring and Logs

- **CloudWatch Dashboard**: View metrics in AWS Console
- **Application Logs**: CloudFront access logs in S3
- **WAF Logs**: Blocked requests in WAF console
- **Billing Alerts**: Automatic emails at thresholds
- **Google Analytics**: Real-time visitor data

## Next Steps

After successful deployment:
1. Verify site loads at `https://www.yourdomain.com`
2. Test redirect behavior from non-www domain
3. Check security headers in browser dev tools
4. Monitor CloudWatch dashboard for metrics
5. Set up Google Analytics events (if using)

For additional help, check:
- AWS CloudFormation console for stack details
- CloudWatch logs for errors
- [GitHub Issues](https://github.com/your-repo/issues) for known problems

---

**Need more help?** The deployment scripts provide detailed error messages. Check the AWS Console for specific failure reasons, and ensure all prerequisites are met before deployment.