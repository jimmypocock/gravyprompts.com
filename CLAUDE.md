# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a production-ready Next.js 15 template with comprehensive AWS infrastructure, designed for scalable web applications with Google Analytics, AdSense integration, and modern web development tools.

## Development Commands

### Core Development
- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint (check this after code changes)

### CDK Infrastructure
- `npm run cdk:install` - Install CDK dependencies
- `npm run cdk:synth` - Synthesize CDK templates
- `npm run build:cdk` - Build CDK TypeScript files

### Deployment Commands
- `npm run deploy:all` - Deploy all AWS stacks (recommended)
- `npm run deploy:foundation` - Deploy S3 buckets and core infrastructure
- `npm run deploy:cert` - Deploy SSL certificates
- `npm run deploy:edge` - Deploy Lambda@Edge functions
- `npm run deploy:waf` - Deploy Web Application Firewall
- `npm run deploy:cdn` - Deploy CloudFront distribution
- `npm run deploy:app` - Deploy application content
- `npm run deploy:monitoring` - Deploy CloudWatch dashboards and alerts

### Monitoring & Maintenance
- `npm run status:all` - Check all stack deployment status
- `npm run maintenance:on` - Enable maintenance mode
- `npm run maintenance:off` - Disable maintenance mode

### TODO Management
- `npm run todo` - Display current TODO items
- `npm run todo:add` - Add a new TODO item
- `npm run todo:complete` - Mark a TODO item as completed
- `npm run todo:progress` - Update a TODO item's progress

## Architecture

### Frontend Stack
- **Next.js 15** with App Router and Turbopack
- **TypeScript** for type safety
- **Tailwind CSS** for styling with custom CSS variables in `app/globals.css`
- **Google Fonts**: Noto Sans (UI) and Noto Serif (content)

### AWS Infrastructure (Decoupled Stacks)
The infrastructure uses a decoupled stack architecture (see `cdk/src/ARCHITECTURE.md`) with these independent stacks:

1. **Foundation Stack** - S3 buckets for content and logs (deploy once)
2. **Certificate Stack** - ACM SSL certificates (deploy once)
3. **Edge Functions Stack** - CloudFront functions for redirects and security headers
4. **WAF Stack** - Web Application Firewall with rate limiting and geo-blocking
5. **CDN Stack** - CloudFront distribution with custom domains
6. **App Stack** - Content deployment and CloudFront invalidation
7. **Monitoring Stack** - CloudWatch dashboards, SNS alerts, and billing alarms

### Google Integrations
- **Google Analytics** with consent management (`components/GoogleAnalytics.tsx`)
- **Google AdSense** with privacy-compliant setup (`components/AdSense/`)
- **Cookie Consent Management Platform** (`components/GoogleCMP.tsx`)
- **Consent Initialization** (`components/GoogleConsentInit.tsx`) - Handles initial consent state setup

## Key Directories

- `app/` - Next.js App Router pages and layouts
- `components/` - Reusable React components
- `cdk/` - AWS CDK infrastructure code (separate TypeScript project)
- `scripts/` - Deployment and maintenance shell scripts
- `public/` - Static assets including `ads.txt` and `sitemap.xml`

## Environment Configuration

Copy `.env.example` to `.env` and configure:
- `NEXT_PUBLIC_GA_MEASUREMENT_ID` - Google Analytics measurement ID
- `NEXT_PUBLIC_ADSENSE_CLIENT_ID` - Google AdSense publisher ID
- `AWS_REGION`, `AWS_ACCOUNT_ID`, `DOMAIN_NAME` - AWS deployment settings
- `APP_NAME` - Application name for CDK stacks

## Customization Areas

### Brand Colors
Update CSS variables in `app/globals.css` and `tailwind.config.ts`:
- `--primary`, `--secondary`, `--accent`, `--neutral`

### Content & Metadata
- `app/layout.tsx` - Site metadata, Open Graph, schema markup
- `app/page.tsx` - Home page content
- `package.json` - Project name and description

### AdSense Setup
- Update `public/ads.txt` with your Google AdSense publisher ID
- Configure ad units in `components/AdSense/` components

## Development Notes

### CDK Infrastructure
- CDK code is in a separate TypeScript project under `cdk/`
- Run `npm run build:cdk` before CDK operations
- Stack dependencies must be deployed in order (see ARCHITECTURE.md)
- Use `npm run deploy:all` for full deployment

### ESLint Configuration
- Ignores `cdk/` directory (separate linting rules)
- Extends Next.js recommended configs
- Always run `npm run lint` after making code changes

### Theme System
- Uses Tailwind CSS with custom CSS variables for easy theme customization
- Animated gradient orbs provide dynamic background effects
- Theme toggle component supports light/dark modes