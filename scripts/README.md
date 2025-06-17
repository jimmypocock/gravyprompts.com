# Scripts Directory

This directory contains various scripts for deployment, maintenance, and development of the GravyPrompts application.

## Test Coverage & Commands

### Test Commands

```bash
# Unit Tests
npm test                     # Run all tests
npm run test:watch          # Run tests in watch mode
npm run test:coverage       # Generate coverage report
npm run test:ci             # Run tests in CI mode

# Integration & E2E Tests
npm run test:smoke:staging      # Run staging smoke tests
npm run test:smoke:production   # Run production smoke tests

# Backend Tests
npm run test:backend           # Run CDK/Lambda tests
npm run test:backend:watch     # Watch mode for backend tests
npm run test:backend:coverage  # Backend coverage report

# Type Checking
npm run type-check          # TypeScript type checking
```

### Test Coverage Status

The project includes comprehensive test suites:

- **Unit Tests**: Components, hooks, utilities
- **Integration Tests**: Auth flows, API interactions
- **E2E Tests**: Search functionality, template management
- **Performance Tests**: Load testing, response times
- **Security Tests**: CSRF, XSS, injection prevention
- **Accessibility Tests**: WCAG compliance
- **Contract Tests**: API schema validation
- **Smoke Tests**: Post-deployment verification

### Coverage Requirements

- **Target**: 80% overall coverage
- **Critical Paths**: 100% coverage required
- **New Features**: Must include tests
- **Bug Fixes**: Must include regression tests

## Script Organization

All scripts have corresponding npm commands for easy discovery and execution. Run `npm run` to see all available commands.

### Categories:

1. **Development Scripts** (`dev-*.sh`, `local-*.sh`)

   - Local environment setup and management
   - Testing and debugging tools

2. **Deployment Scripts** (`deploy-*.sh`)

   - AWS CDK stack deployments
   - Amplify configuration

3. **Check Scripts** (`check-*.sh`)

   - Infrastructure status checks
   - Certificate and DNS validation

4. **Template Scripts** (`*-templates.*`)

   - Bulk loading and management
   - Template analysis and conversion

5. **Utility Scripts**
   - TODO management
   - Configuration helpers
   - Cleanup tools

## Quick Reference

See `../SCRIPTS.md` for a complete guide to all npm commands.

## Script Naming Convention

- `.sh` - Shell scripts (Bash)
- `.js` - Node.js scripts
- `.py` - Python scripts
- `.md` - Documentation

## Adding New Scripts

When adding a new script:

1. Place it in this directory
2. Make it executable: `chmod +x script-name.sh`
3. Add a corresponding npm command in `package.json`
4. Document it in `../SCRIPTS.md`
5. Include a header comment explaining its purpose

Example script header:

```bash
#\!/bin/bash
# Script: deploy-api.sh
# Purpose: Deploy API Gateway and Lambda functions
# Usage: npm run deploy:api
# Dependencies: AWS CLI, CDK CLI
```

## Environment Variables

Most scripts source `config.sh` for common variables:

- `APP_NAME` - Application name for resource naming
- `AWS_REGION` - AWS region for deployment
- `DOMAIN_NAME` - Domain for the application
- `ENVIRONMENT` - Deployment environment (dev/prod)

## Error Handling

Scripts should:

- Exit with non-zero status on failure
- Provide clear error messages
- Clean up resources on failure when possible
- Log operations for debugging
