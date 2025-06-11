# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GravyPrompts is a production-ready AI prompt template marketplace built with Next.js 15 and deployed on AWS Amplify. It features instant search, template management, and a sleek user interface inspired by modern web applications.

### Key Features
- **Instant Template Search** - Advanced search with relevance scoring, fuzzy matching, and content search
- **Template Quickview** - Slide-out panel for quick template preview and variable population
- **Local Development** - Full local stack with DynamoDB, API Gateway, and authentication mocking
- **Persistent Storage** - Local DynamoDB data persists between restarts
- **CORS Proxy** - Built-in proxy for local development to avoid CORS issues
- **User Prompt Saving** - Save populated templates to user accounts

## Recent Updates

### UI/UX Improvements
- **Airbnb-style Search** - Hero search bar that transitions to navbar on scroll
- **Full-width Grid Layout** - Replaced split view with responsive template grid
- **Quickview Panel** - Slide-out panel (80% width on desktop) with inline variable inputs
- **Inter Font** - Clean, modern typography throughout
- **Primary Color Accents** - Subtle red (#FF385C) highlights for interactive elements
- **Fixed Navigation** - Persistent top nav with integrated search

### Search Enhancements
- **Relevance Scoring** - Templates ranked by title, tag, and content matches
- **Fuzzy Matching** - Handles typos and partial matches
- **Multi-term Search** - Each word searched independently
- **Content Search** - Searches within template content, not just titles/tags
- **Popularity Weighting** - Popular templates get slight ranking boost

### Backend Updates
- **User Prompts Table** - DynamoDB table for saving user's populated templates
- **Prompt API Endpoints** - Save, list, and delete user prompts
- **Enhanced Search Lambda** - Improved search algorithm with scoring
- **Persistent Local Storage** - DynamoDB data persists in `cdk/local-test/dynamodb-data/`

## Development Commands

### 🚀 Quick Start for Local Development
```bash
npm run dev:all
```
This single command:
- Starts Docker containers (DynamoDB, LocalStack)
- Creates database tables
- Starts SAM Local API (port 7429)
- Starts Next.js dev server (port 6827)
- Opens DynamoDB Admin UI (port 8001)

### Core Development
- `npm run dev` - DEPRECATED - Use `npm run dev:all` instead
- `npm run build` - Build for production
- `npm run build:all` - Build both app and gravyjs package
- `npm run start` - Start production server on port 6827
- `npm run lint` - Run ESLint (always check after code changes)

### Template Management
- `npm run templates:load -- --file ./data/templates.csv` - Load to production
- `npm run templates:load:local -- --file ./data/consolidated-templates.json` - Load to local
- `npm run templates:delete` - Delete templates in bulk
- `npm run templates:analyze` - Analyze markdown templates
- `npm run templates:consolidate` - Consolidate template files
- `npm run check:templates` - Check template status

### Local Development & Testing
- `npm run local:setup` - Setup local DynamoDB with persistent storage
- `npm run local:start` - Start local API Gateway
- `npm run local:stop` - Stop local services
- `npm run local:test:api` - Test API endpoints
- `npm run local:logs` - View DynamoDB logs
- `npm run local:cleanup` - Clean up local environment

### AWS Deployment

#### Backend (CDK)
```bash
npm run deploy:backend     # Deploy all backend stacks
npm run deploy:auth        # Deploy Cognito only
npm run deploy:api         # Deploy API Gateway + Lambda
npm run deploy:waf         # Deploy WAF
npm run deploy:cert:first  # Initial certificate deployment
```

#### Frontend (Amplify)
- Push to GitHub - Amplify auto-deploys
- Check status: `npm run check:amplify:app`
- Check DNS: `npm run check:amplify:dns`
- Check domain: `npm run check:amplify:domain`

### Infrastructure Management
- `npm run status:all` - Check all stack statuses
- `npm run diagnose:stack` - Diagnose stack issues
- `npm run protect:cert` - Protect certificate from deletion
- `npm run destroy:all` - Destroy all stacks (use carefully!)

## Architecture

### Frontend Stack
- **Next.js 15** with App Router and Turbopack
- **TypeScript** for type safety
- **Tailwind CSS** with custom Airbnb-inspired design
- **Inter Font** - Modern, readable typography
- **Search Context** - Global search state management
- **API Proxy** - `/api/proxy` routes for CORS handling in development

### Backend Services (AWS CDK)
1. **DynamoDB Tables**
   - `templates` - Template storage with GSIs for queries
   - `template-views` - View tracking
   - `user-prompts` - Saved user prompts with userId GSI

2. **Lambda Functions**
   - Enhanced search with relevance scoring
   - Template CRUD operations
   - User prompt management
   - Content moderation (AWS Comprehend)

3. **API Gateway**
   - RESTful endpoints
   - CORS configuration
   - Local development via SAM

### Local Development Stack
- **Docker Compose** - Orchestrates local services
- **DynamoDB Local** - Persistent data storage
- **LocalStack** - AWS service mocking
- **SAM Local** - API Gateway simulation
- **Next.js Proxy** - CORS bypass for local dev

## Key Directories

- `app/` - Next.js App Router pages
  - `api/proxy/` - CORS proxy for local development
  - `page.tsx` - Home page with search and grid layout
- `components/` 
  - `TemplateQuickview.tsx` - Slide-out panel component
  - `Navigation.tsx` - Fixed nav with search integration
- `lib/`
  - `search-context.tsx` - Global search state
  - `api/templates.ts` - API client with proxy support
- `cdk/` - AWS infrastructure
  - `lambda/templates/list.js` - Enhanced search implementation
  - `local-test/` - Local development configuration
- `scripts/` - All scripts have npm commands (see SCRIPTS.md)
- `data/` - Template data files for bulk loading

## Local Development Tips

### First Time Setup
```bash
npm install
npm run local:setup
npm run templates:load:local -- --file ./data/consolidated-templates.json
npm run dev:all
```

### Common Issues & Solutions

1. **Templates disappearing** - DynamoDB now uses persistent storage
2. **CORS errors** - API proxy automatically handles this
3. **Port conflicts** - Run `npm run local:cleanup` first
4. **Search not working** - Enhanced algorithm searches content too

### Environment Variables

Create `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:7429
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-XXXXXXXXXXXXXXXX
```

## Recent Script Organization

All scripts now have npm commands. See:
- `SCRIPTS.md` - Complete command reference
- `scripts/README.md` - Script organization guide
- `scripts/SCRIPT_REGISTRY.md` - Full script mapping

### Script Naming Convention
- `deploy:*` - Deployment scripts
- `check:*` - Status checks
- `templates:*` - Template operations
- `local:*` - Local development
- `destroy:*` - Cleanup operations

## UI/UX Guidelines

### Design System
- **Primary Color**: #FF385C (Airbnb red)
- **Font**: Inter (clean, modern)
- **Animations**: 500ms ease-in-out transitions
- **Spacing**: Consistent 4/6/8 unit spacing
- **Shadows**: Subtle elevation with hover states

### Component Patterns
- **Search Bar**: Transitions from hero to nav on scroll
- **Template Cards**: Hover effects with primary color
- **Quickview Panel**: 80% width on desktop, full on mobile
- **Buttons**: Primary color with hover states

## Best Practices

1. **Always use `npm run dev:all`** for local development
2. **Run `npm run lint`** after code changes
3. **Use the proxy** - Templates API automatically uses `/api/proxy` locally
4. **Persistent data** - Local templates survive restarts
5. **Test search** - Try partial words, typos, and content searches

## ✅ Content Moderation Update

**AWS Comprehend has been completely removed from this application.**

After a $100+ infinite loop incident with AWS Comprehend, the moderation system has been replaced with a simple, cost-free alternative that performs basic content checks without any external API calls.

See `/docs/CONTENT_MODERATION.md` for details. Current implementation:
- Basic word filtering (customizable blocked words list)
- Spam detection (excessive caps, repetitive content)
- No external API calls = No surprise charges
- Moderation states: `approved`, `rejected`, `review`

The new system is safe to deploy and won't incur any API costs.

## Deployment Checklist

1. Run `npm run lint`
2. Run `npm run build:all`
3. Run `npm run pre-flight`
4. Deploy backend: `npm run deploy:backend`
5. Push to GitHub for Amplify deployment
6. Check deployment: `npm run status:all`