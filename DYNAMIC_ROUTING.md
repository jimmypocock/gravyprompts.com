# Dynamic Routing Solutions for GravyPrompts

## The Problem

GravyPrompts has evolved into a dynamic application that requires:
- **Dynamic routes**: `/templates/[id]` for viewing individual templates
- **User authentication**: Protected routes that check auth state
- **Real-time content**: Templates created by users, not at build time
- **API integration**: Fetching data from DynamoDB through API Gateway
- **Server-side features**: Can't be pre-rendered as static HTML

The current S3 + CloudFront setup only supports static files, which won't work for this application.

## Solution Options

### Option 1: Vercel (Simplest & Fastest)
**Best for**: Quick deployment, minimal configuration

**Pros:**
- Zero configuration for Next.js
- Automatic deployments from Git
- Built-in edge functions
- Free tier includes 100GB bandwidth
- Custom domains with automatic SSL
- Excellent performance globally

**Implementation:**
```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Deploy
vercel

# 3. Set environment variables in Vercel dashboard:
# - NEXT_PUBLIC_API_URL
# - NEXT_PUBLIC_COGNITO_USER_POOL_ID_PROD
# - NEXT_PUBLIC_COGNITO_CLIENT_ID_PROD
# - NEXT_PUBLIC_GA_MEASUREMENT_ID
# - NEXT_PUBLIC_ADSENSE_CLIENT_ID

# 4. Connect GitHub for auto-deploy
vercel git connect
```

**Cost**: Free for personal use, $20/month for Pro

### Option 2: AWS Amplify Hosting (Best AWS Integration)
**Best for**: Staying within AWS ecosystem

**Pros:**
- Native Next.js SSR support
- Integrated with AWS services
- Built-in CI/CD
- Environment variables from AWS Systems Manager
- Custom domains via Route 53

**Implementation:**
1. Go to AWS Amplify Console
2. Click "Host web app"
3. Connect GitHub repository
4. Use this build config:
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

**Cost**: ~$0.01 per build minute + $0.15 per GB served

### Option 3: Containerized on AWS (Most Flexible)
**Best for**: Full control, complex requirements

#### Option 3A: AWS App Runner
**Pros:**
- Fully managed containers
- Auto-scaling
- No infrastructure to manage

**Implementation:**
```dockerfile
# Dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]
```

Then add to CDK:
```typescript
import * as apprunner from '@aws-cdk/aws-apprunner-alpha';

new apprunner.Service(this, 'NextJsService', {
  source: apprunner.Source.fromEcrPublic({
    imageIdentifier: 'public.ecr.aws/your-app/gravyprompts:latest',
  }),
  environmentVariables: {
    NEXT_PUBLIC_API_URL: api.url,
    // ... other env vars
  },
});
```

#### Option 3B: ECS Fargate
**Pros:**
- More control over scaling
- Integration with ALB
- Blue/green deployments

**Cost**: ~$0.04/hour for small container

### Option 4: Edge Computing (Advanced)
**Best for**: Global performance, complex caching

#### Option 4A: Cloudflare Pages
**Pros:**
- Edge runtime
- Excellent performance
- Built-in DDoS protection

**Implementation:**
```bash
# Install Wrangler
npm i -g wrangler

# Deploy
npx wrangler pages deploy .next
```

#### Option 4B: AWS Lambda@Edge with OpenNext
**Pros:**
- Uses existing CloudFront
- Serverless
- Pay per request

**Implementation:**
```bash
# Install OpenNext
npm i -D open-next

# Build for Lambda
npx open-next build

# Deploy with CDK
```

### Option 5: Hybrid Approach (Recommended for Your Setup)
**Best for**: Maximizing existing infrastructure

**Architecture:**
1. **Keep existing AWS infrastructure**:
   - API Gateway + Lambda (Template API)
   - DynamoDB (Data storage)
   - Cognito (Authentication)
   - CloudFront (API caching)

2. **Add Next.js hosting**:
   - Use Vercel/Amplify for the Next.js app
   - Point API calls to your CloudFront distribution
   - Use CloudFront for static assets

**Benefits:**
- Minimal changes to existing infrastructure
- Best of both worlds
- Easy rollback

## Migration Steps

### 1. Prepare the Application
```bash
# Ensure these are set in .env.local
NEXT_PUBLIC_API_URL=https://your-api.execute-api.region.amazonaws.com/production
NEXT_PUBLIC_COGNITO_USER_POOL_ID_PROD=your-pool-id
NEXT_PUBLIC_COGNITO_CLIENT_ID_PROD=your-client-id
```

### 2. Update API CORS
Make sure your API Gateway allows requests from your new domain:
```typescript
defaultCorsPreflightOptions: {
  allowOrigins: [
    'https://gravyprompts.com',
    'https://www.gravyprompts.com',
    'https://gravyprompts.vercel.app', // If using Vercel
    'http://localhost:3000'
  ],
  // ... rest of CORS config
}
```

### 3. Choose Deployment Method
Based on your needs:
- **Quick start**: Go with Vercel
- **AWS integration**: Use Amplify
- **Full control**: Use containers
- **Global edge**: Use Cloudflare

### 4. Update DNS
Point your domain to the new hosting:
- Vercel: CNAME to `cname.vercel-dns.com`
- Amplify: CNAME to Amplify domain
- Custom: Update A/CNAME records

## Quick Decision Matrix

| Solution | Setup Time | Cost | Complexity | Best For |
|----------|------------|------|------------|----------|
| Vercel | 5 mins | Free-$20/mo | Very Low | Quick deployment |
| Amplify | 30 mins | ~$10/mo | Low | AWS integration |
| App Runner | 2 hours | ~$30/mo | Medium | Containers |
| ECS Fargate | 4 hours | ~$30/mo | High | Full control |
| Lambda@Edge | 1 day | Pay per use | Very High | Global edge |

## Recommended Path Forward

1. **Tomorrow**: Deploy to Vercel for immediate results
   - Get the app live with dynamic routing
   - Test all features
   - Gather user feedback

2. **Next Week**: Evaluate AWS Amplify
   - Better AWS integration
   - Keep everything in one account
   - Consider costs

3. **Future**: Consider containerization if you need:
   - WebSockets
   - Long-running processes
   - Custom runtime configuration

## Testing Dynamic Routes

After deployment, test these scenarios:
1. Create a new template
2. Navigate to `/templates/[id]`
3. Share a template link
4. Test authentication flows
5. Verify API calls work

## Environment Variables Needed

Regardless of platform, you'll need:
```env
# API Configuration
NEXT_PUBLIC_API_URL=https://your-api.execute-api.region.amazonaws.com/production

# Auth Configuration  
NEXT_PUBLIC_COGNITO_USER_POOL_ID_PROD=us-east-1_xxxxxxxx
NEXT_PUBLIC_COGNITO_CLIENT_ID_PROD=xxxxxxxxxxxxxxxxxxxxxxxxxx

# Analytics (Optional)
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-xxxxxxxxxxxxxxxx
```

## Next Steps

1. Review this document
2. Choose a deployment method
3. Set up environment variables
4. Deploy and test
5. Update DNS records
6. Monitor performance

Remember: The current S3/CloudFront setup can remain for serving the API and static assets. You're just changing how the Next.js app is hosted.