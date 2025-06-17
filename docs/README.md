# GravyPrompts Documentation

Welcome to the GravyPrompts documentation. This directory contains all technical documentation for the project.

## Documentation Structure

### 🚀 Getting Started

- [**Local Development Setup**](DEVELOPMENT/LOCAL_SETUP.md) - Complete guide for running the app locally
- [**Production Standards**](DEVELOPMENT/PRODUCTION_STANDARDS.md) - Code quality and security standards
- [**Architecture Overview**](../cdk/src/ARCHITECTURE.md) - System design and components

### 🔧 Development

- [**Local Setup**](DEVELOPMENT/LOCAL_SETUP.md) - Development environment configuration
- [**Scripts Reference**](DEVELOPMENT/SCRIPTS.md) - Complete NPM scripts documentation
- [**Testing Guide**](TEST_COVERAGE_PLAN.md) - Testing strategies and coverage requirements
- [**Test Coverage Report**](DEVELOPMENT/TEST_COVERAGE_REPORT.md) - Current test implementation status
- [**API Documentation**](API.md) - API endpoints and usage
- [**API Optimization**](API/API_USAGE_ANALYSIS_AND_OPTIMIZATION.md) - Performance analysis and improvements

### 🚢 Deployment

- [**Deployment Guide**](DEPLOYMENT.md) - Step-by-step deployment instructions
- [**CI/CD Pipeline**](CI-CD-PIPELINE.md) - Automated deployment process
- [**First Deployment**](FIRST_DEPLOYMENT.md) - Initial setup guide
- [**Deployment Options**](DEPLOYMENT_OPTIONS.md) - Different deployment strategies

### 🔐 Security

- [**Security Overview**](SECURITY/OVERVIEW.md) - Comprehensive security documentation
- [**Security Checklist**](SECURITY/CHECKLIST.md) - Pre-deployment and ongoing security checks
- [**Audit Log**](SECURITY/AUDIT_LOG.md) - Historical security fixes and incidents

### 📦 Packages

- [**GravyJS Publishing**](GRAVYJS_PUBLISHING_GUIDE.md) - Guide for publishing the GravyJS package
- [**GravyJS Roadmap**](GRAVYJS_ROADMAP.md) - Future plans for the editor

### 🛠️ Operations

- [**Budget Alerts**](BUDGET_ALERTS_SETUP.md) - Cost monitoring configuration
- [**Lambda Monitoring**](LAMBDA_INVOCATION_MONITORING.md) - Function performance tracking
- [**Content Moderation**](CONTENT_MODERATION.md) - Content filtering system

### 📋 Other Guides

- [**Authentication Setup**](AUTH_SETUP.md) - Cognito configuration
- [**Search Improvements**](SEARCH_IMPROVEMENTS.md) - Search algorithm documentation
- [**Docker Keychain Fix**](FIX_DOCKER_KEYCHAIN_MACOS.md) - macOS Docker issues

### 📚 Archive

The [ARCHIVE](ARCHIVE/) directory contains historical documentation that is no longer current but preserved for reference.

## Quick Links

### Common Tasks

- **Start local development**: See [Local Setup Guide](DEVELOPMENT/LOCAL_SETUP.md)
- **Deploy to AWS**: See [Deployment Guide](DEPLOYMENT.md)
- **Run tests**: See [Testing Guide](TEST_COVERAGE_PLAN.md)
- **Security review**: See [Security Checklist](SECURITY/CHECKLIST.md)

### Important Commands

```bash
# Local development
npm run dev:all

# Run tests
npm test
npm run test:coverage

# Deploy
npm run deploy:backend
npm run deploy:all

# Security check
npm run check:budget
```

## Contributing

When adding new documentation:

1. Place it in the appropriate subdirectory
2. Update this README with a link
3. Keep documentation concise and practical
4. Include examples where helpful

## Documentation Standards

- Use Markdown format
- Include a clear title and purpose
- Add code examples with syntax highlighting
- Keep line length reasonable for readability
- Update when implementation changes
