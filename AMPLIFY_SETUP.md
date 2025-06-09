# AWS Amplify Setup Guide

This guide walks you through migrating from S3/CloudFront static hosting to AWS Amplify for dynamic routing support.

## Why Amplify?

- **Dynamic Routes**: Full support for Next.js `/templates/[id]` routes
- **Server-Side Rendering**: Better SEO and user experience
- **AWS Integration**: Seamless with your existing Cognito, API Gateway, and DynamoDB
- **Automatic Deployments**: Git-based CI/CD pipeline
- **Cost-Effective**: ~$10/month for typical usage

## Prerequisites

Before starting, ensure you have:
1. Committed all changes to your GitHub repository
2. Your AWS API Gateway URL handy
3. Your Cognito User Pool and Client IDs

## Step 1: Clean Up Old Frontend Stacks

Since Amplify will handle hosting, remove the old S3/CloudFront stacks:

```bash
# This will delete App, CDN, EdgeFunctions, and Foundation stacks
# It will KEEP your API, Auth, Certificate, WAF, and Monitoring stacks
npm run destroy:frontend
```

## Step 2: Set Up Amplify in AWS Console

1. Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify/)
2. Click **"New app"** → **"Host web app"**
3. Choose **GitHub** and authorize AWS Amplify
4. Select your repository and branch (usually `main`)
5. Amplify should auto-detect Next.js. If not:
   - App name: `gravyprompts`
   - Build settings will be auto-populated from `amplify.yml`

## Step 3: Configure Environment Variables

In the Amplify Console, go to **App settings** → **Environment variables** and add:

```bash
# API Configuration (REQUIRED)
NEXT_PUBLIC_API_URL=https://your-api-id.execute-api.region.amazonaws.com/production

# Auth Configuration (REQUIRED)
NEXT_PUBLIC_COGNITO_USER_POOL_ID_PROD=us-east-1_xxxxxxxxx
NEXT_PUBLIC_COGNITO_CLIENT_ID_PROD=xxxxxxxxxxxxxxxxxxxxxxxxxx

# Analytics (OPTIONAL)
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-xxxxxxxxxxxxxxxx

# App URL (REQUIRED)
NEXT_PUBLIC_APP_URL=https://gravyprompts.com
```

To find your API URL:
```bash
aws cloudformation describe-stacks \
  --stack-name YourStackPrefix-Api \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text
```

## Step 4: Configure Build Settings

Amplify should automatically use the `amplify.yml` file in your repository. Verify it shows:

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
```

## Step 5: Set Up Custom Domain

1. In Amplify Console, go to **Domain management**
2. Click **Add domain**
3. Enter `gravyprompts.com`
4. Amplify will provide DNS records to add to your domain provider
5. Add both the root domain and `www` subdomain

## Step 6: Update API CORS Settings

Your API needs to accept requests from the Amplify domain:

1. Update your API stack to include Amplify URLs in CORS:
   ```typescript
   allowOrigins: [
     'https://gravyprompts.com',
     'https://www.gravyprompts.com',
     'https://main.xxxxxx.amplifyapp.com', // Your Amplify URL
     'http://localhost:3000'
   ]
   ```

2. Redeploy the API stack:
   ```bash
   npm run deploy:api
   ```

## Step 7: Deploy

1. Click **Save and deploy** in Amplify Console
2. First deployment takes 5-10 minutes
3. Monitor the build logs for any issues

## Step 8: Test Your Application

Once deployed, test these critical paths:

- [ ] Home page loads
- [ ] Can create an account
- [ ] Can log in
- [ ] Can create a template
- [ ] Can view template at `/templates/[id]`
- [ ] Can share template links
- [ ] API calls work correctly

## Troubleshooting

### Build Failures

If the build fails, check:
1. All environment variables are set
2. `amplify.yml` is in the root directory
3. `next.config.ts` has `output: 'standalone'`

### API Connection Issues

If API calls fail:
1. Verify `NEXT_PUBLIC_API_URL` is correct
2. Check CORS settings on API Gateway
3. Ensure API stack is still running

### Authentication Issues

If login doesn't work:
1. Verify Cognito IDs are correct
2. Check browser console for errors
3. Ensure cookies are enabled

## Monitoring

Your existing CloudWatch monitoring will continue to work for the API. For Amplify-specific metrics:

1. Go to **Monitoring** in Amplify Console
2. Set up alarms for:
   - Build failures
   - 4xx/5xx errors
   - Response times

## Cost Optimization

Amplify charges:
- $0.01 per build minute
- $0.15 per GB served
- $0.15 per GB stored

To minimize costs:
1. Use build cache (already configured)
2. Optimize images and assets
3. Enable Amplify's built-in CDN caching

## Rollback Plan

If you need to rollback:
1. Keep your old CloudFront distribution for 24 hours
2. Update DNS to point back to CloudFront
3. Redeploy with `npm run deploy:app`

## Next Steps

After successful deployment:
1. Delete old frontend stacks (if not already done)
2. Update your README with new deployment instructions
3. Set up branch previews for pull requests
4. Configure custom headers if needed

## Additional Resources

- [AWS Amplify Hosting Docs](https://docs.aws.amazon.com/amplify/latest/userguide/welcome.html)
- [Next.js on Amplify](https://docs.aws.amazon.com/amplify/latest/userguide/ssr-nextjs.html)
- [Amplify Environment Variables](https://docs.aws.amazon.com/amplify/latest/userguide/environment-variables.html)