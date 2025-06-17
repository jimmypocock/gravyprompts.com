# GravyPrompts Scripts Guide

This guide documents all available npm scripts for the GravyPrompts project.

## 🚀 Quick Start

```bash
# Start local development (frontend + API + database)
npm run dev:all

# Build for production
npm run build:all

# Deploy to AWS
npm run deploy:backend
```

## 📁 Script Categories

### Development & Testing

```bash
# Local Development
npm run dev:all           # Start all services (recommended)
npm run build            # Build Next.js app
npm run build:all        # Build app + GravyJS package
npm run start            # Start production server on port 6827
npm run lint             # Run ESLint

# Local API & Database
npm run local:setup      # Setup local DynamoDB and tables
npm run local:start      # Start local API Gateway
npm run local:stop       # Stop all local services
npm run local:test:api   # Test API endpoints
npm run local:logs       # View DynamoDB logs
npm run local:cleanup    # Clean up local environment

# Testing
npm run test:infra       # Test infrastructure deployment
npm run pre-flight       # Pre-deployment checks
```

### Template Management

```bash
# Template Operations
npm run templates:load -- --file ./data/templates.csv      # Load templates to production
npm run templates:load:local -- --file ./data/templates.json  # Load to local DB
npm run templates:delete -- --filter <condition>           # Delete templates
npm run templates:analyze                                  # Analyze markdown templates
npm run templates:consolidate                              # Consolidate template files

# Template Checking
npm run check:templates   # Check template status in database
```

### AWS Deployment

```bash
# Backend Deployment (CDK)
npm run deploy:backend    # Deploy all backend services
npm run deploy:auth       # Deploy Cognito authentication
npm run deploy:api        # Deploy API Gateway + Lambda
npm run deploy:waf        # Deploy Web Application Firewall
npm run deploy:cert:first # Initial certificate deployment
npm run deploy:cert       # Update certificate
npm run deploy:all        # Deploy all stacks

# Amplify Frontend
npm run check:amplify:app     # Check Amplify app status
npm run check:amplify:dns     # Check DNS configuration
npm run check:amplify:domain  # Check custom domain
npm run amplify:setup:cert    # Setup custom certificate
```

### Infrastructure Management

```bash
# Status Checks
npm run status           # Check stack deployment status
npm run status:all       # Check all stacks
npm run check:cert       # Check certificate validation
npm run check:ssl        # Check SSL certificate status
npm run diagnose:stack   # Diagnose stack issues

# Protection & Cleanup
npm run protect:cert     # Protect certificate from deletion
npm run destroy:waf      # Destroy WAF stack
npm run destroy:monitoring # Destroy monitoring stack
npm run destroy:all      # Destroy all stacks (use with caution!)

# Utilities
npm run analyze:comprehend  # Analyze AWS Comprehend usage
npm run cdk:env            # Display CDK environment variables
```

### TODO Management

```bash
npm run todo              # Show current TODOs
npm run todo:add          # Add a new TODO
npm run todo:complete     # Mark TODO as complete
npm run todo:progress     # Update TODO progress
```

### GravyJS Demo

```bash
npm run demo:dev         # Start demo in development
npm run demo:build       # Build demo
npm run demo:preview     # Preview built demo
npm run demo:deploy      # Deploy demo to Vercel
npm run demo:setup       # Setup demo configuration
```

## 🔧 Script Details

### Local Development Setup

The `npm run dev:all` command orchestrates:

1. Docker containers for DynamoDB and LocalStack
2. SAM Local API Gateway on port 7429
3. Next.js development server on port 3000
4. Automatic table creation and data loading

### Template Loading

Load templates from CSV:

```bash
npm run templates:load -- --file ./data/templates.csv
```

Load templates from JSON:

```bash
npm run templates:load:local -- --file ./data/templates.json
```

The scripts support both CSV and JSON formats and automatically:

- Extract variables from content
- Assign unique IDs
- Set proper timestamps
- Handle batch uploads

### Deployment Workflow

1. **First-time setup:**

   ```bash
   npm run deploy:cert:first  # Deploy certificate
   npm run deploy:backend     # Deploy all backend services
   ```

2. **Updates:**

   ```bash
   npm run deploy:api        # Update API only
   npm run deploy:auth       # Update auth only
   ```

3. **Frontend (via Amplify Console):**
   - Push to GitHub
   - Amplify automatically builds and deploys

## 🛠️ Troubleshooting

### Common Issues

1. **Port already in use:**

   ```bash
   npm run local:stop
   npm run local:cleanup
   ```

2. **Templates not showing:**

   ```bash
   npm run templates:load:local -- --file ./data/consolidated-templates.json
   ```

3. **CORS errors:**

   - The app now uses a proxy in development
   - Check that you're accessing via http://localhost:3000

4. **Authentication issues:**
   ```bash
   npm run local:fix-auth
   ```

## 📝 Environment Variables

Create `.env.local` with:

```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:7429

# AWS Configuration (for deployment)
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=your-account-id
DOMAIN_NAME=gravyprompts.com
APP_NAME=gravyprompts

# Google Services (optional)
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-XXXXXXXXXXXXXXXX
```

## 🔄 Script Execution Order

### For New Developers:

1. `npm install`
2. `npm run local:setup`
3. `npm run templates:load:local -- --file ./data/consolidated-templates.json`
4. `npm run dev:all`

### For Deployment:

1. `npm run build:cdk`
2. `npm run pre-flight`
3. `npm run deploy:backend`
4. Push to GitHub for Amplify deployment

## 📚 Additional Resources

- See `scripts/README.md` for detailed script documentation
- See `docs/LOCAL_DEVELOPMENT.md` for local setup guide
- See `docs/DEPLOYMENT.md` for production deployment
- See `CLAUDE.md` for AI assistant instructions
