# Deployment Options for GravyPrompts

Since GravyPrompts uses dynamic routes and server-side features, it requires a different deployment strategy than static hosting.

## Current Infrastructure Issue

The current setup uses S3 + CloudFront, which only supports static files. However, GravyPrompts needs:
- Dynamic routes (`/templates/[id]`)
- Server-side API calls
- User authentication
- Real-time template creation

## Recommended Deployment Options

### Option 1: AWS Amplify Hosting (Recommended for AWS users)
**Pros:**
- Native Next.js SSR support
- Automatic CI/CD from Git
- Uses existing AWS account
- Built-in environment variables
- Custom domains with SSL

**Setup:**
```bash
npm install -g @aws-amplify/cli
amplify init
amplify add hosting
amplify publish
```

### Option 2: Vercel (Recommended for simplicity)
**Pros:**
- Created by Next.js team
- Zero configuration
- Excellent performance
- Free tier available
- Automatic deployments from Git

**Setup:**
```bash
npm i -g vercel
vercel
```

### Option 3: AWS App Runner
**Pros:**
- Fully managed containers
- Auto-scaling
- Pay per use
- Integrates with existing AWS services

**Setup requires:**
1. Dockerfile for Next.js
2. App Runner service in CDK
3. Environment variable configuration

### Option 4: Self-hosted on EC2/ECS
**Pros:**
- Full control
- Can use existing infrastructure
- Cost-effective at scale

**Cons:**
- More complex setup
- Requires maintenance

## Migration Path

1. **Keep existing infrastructure** for:
   - API Gateway + Lambda (template API)
   - DynamoDB (data storage)
   - Cognito (authentication)
   - CloudFront (CDN for API)

2. **Replace static hosting** with one of the above options

3. **Update environment variables**:
   ```env
   NEXT_PUBLIC_API_URL=https://api.gravyprompts.com
   NEXT_PUBLIC_COGNITO_USER_POOL_ID_PROD=xxx
   NEXT_PUBLIC_COGNITO_CLIENT_ID_PROD=xxx
   ```

## Quick Start with Vercel

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Deploy:
   ```bash
   vercel
   ```

3. Set environment variables in Vercel dashboard

4. Connect to GitHub for automatic deployments

## Quick Start with AWS Amplify

1. In AWS Console, go to AWS Amplify
2. Click "Host web app"
3. Connect your GitHub repository
4. Configure build settings:
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
5. Add environment variables
6. Deploy!

## Keeping CloudFront for API

Your existing CloudFront can still be used for:
- Caching API responses
- Serving static assets
- Geographic distribution

Just update your API calls to use the CloudFront distribution URL instead of direct API Gateway.