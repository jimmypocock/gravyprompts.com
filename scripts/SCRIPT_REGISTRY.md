# Script Registry

This document maps all scripts to their npm commands and purposes.

## Development Scripts

| Script | NPM Command | Purpose |
|--------|-------------|---------|
| dev-all.sh | `npm run dev:all` | Start all services for local development |
| check-templates.sh | **MISSING** | Check template status |
| cleanup-local.sh | `npm run local:cleanup` | Clean up local development environment |
| fix-local-auth.sh | `npm run local:fix-auth` | Fix local authentication issues |
| test-local-api.sh | `npm run local:test:api` | Test local API endpoints |

## Template Management Scripts

| Script | NPM Command | Purpose |
|--------|-------------|---------|
| bulk-load-templates.js | `npm run templates:load` | Load templates from file to production |
| bulk-load-templates-local.js | `npm run templates:load:local` | Load templates to local DynamoDB |
| bulk-delete-templates.js | `npm run templates:delete` | Delete templates in bulk |
| analyze-markdown-templates.js | `npm run templates:analyze` | Analyze markdown template files |
| consolidate-templates.py | **MISSING** | Consolidate template files |
| convert-plaintext-template.js | **USED BY OTHER SCRIPTS** | Convert plain text to HTML |

## Deployment Scripts

| Script | NPM Command | Purpose |
|--------|-------------|---------|
| deploy-all-amplify.sh | `npm run deploy:all` | Deploy all stacks for Amplify |
| deploy-amplify-backend.sh | `npm run deploy:backend` | Deploy backend services |
| deploy-api.sh | `npm run deploy:api` | Deploy API Gateway and Lambda |
| deploy-auth.sh | `npm run deploy:auth` | Deploy Cognito authentication |
| deploy-cert-first.sh | `npm run deploy:cert:first` | Initial certificate deployment |
| deploy-cert.sh | **MISSING** | Deploy certificate updates |
| deploy-waf.sh | `npm run deploy:waf` | Deploy Web Application Firewall |
| force-update.sh | `npm run deploy:force` | Force update deployments |
| pre-flight-check.sh | `npm run pre-flight` | Pre-deployment checks |

## Infrastructure Check Scripts

| Script | NPM Command | Purpose |
|--------|-------------|---------|
| check-all-stacks.sh | `npm run status:all` | Check all stack statuses |
| check-amplify-app.sh | `npm run check:amplify:app` | Check Amplify app status |
| check-amplify-dns.sh | `npm run check:amplify:dns` | Check DNS configuration |
| check-amplify-domain-status.sh | `npm run check:amplify:domain` | Check domain status |
| check-certificate.sh | `npm run check:cert` | Check certificate validation |
| check-ssl.sh | **MISSING** | Check SSL certificate status |
| check-stack-status.sh | `npm run status` | Check CDK stack status |
| diagnose-stack.sh | `npm run diagnose:stack` | Diagnose stack issues |
| protect-certificate.sh | `npm run protect:cert` | Protect certificate from deletion |

## Utility Scripts

| Script | NPM Command | Purpose |
|--------|-------------|---------|
| analyze-comprehend-usage.sh | `npm run analyze:comprehend` | Analyze AWS Comprehend usage |
| setup-amplify-custom-cert.sh | **MISSING** | Setup custom certificate for Amplify |
| setup-gravyjs.js | **POSTINSTALL HOOK** | Setup GravyJS after install |
| update-todos.sh | `npm run todo*` | Manage TODO items |
| cdk-env.sh | **MISSING** | Set CDK environment variables |
| config.sh | **SOURCED BY OTHER SCRIPTS** | Configuration variables |

## Destruction Scripts

| Script | NPM Command | Purpose |
|--------|-------------|---------|
| destroy-all.sh | `npm run destroy:all` | Destroy all CDK stacks |
| destroy-monitoring.sh | `npm run destroy:monitoring` | Destroy monitoring stack |
| destroy-waf.sh | `npm run destroy:waf` | Destroy WAF stack |

## Testing Scripts

| Script | NPM Command | Purpose |
|--------|-------------|---------|
| test-infrastructure.sh | `npm run test:infra` | Test infrastructure deployment |

## Scripts Missing NPM Commands

The following scripts don't have corresponding npm commands:

1. **check-templates.sh** - Needs `npm run check:templates`
2. **consolidate-templates.py** - Needs `npm run templates:consolidate`
3. **deploy-cert.sh** - Needs `npm run deploy:cert`
4. **check-ssl.sh** - Needs `npm run check:ssl`
5. **setup-amplify-custom-cert.sh** - Needs `npm run amplify:setup:cert`
6. **cdk-env.sh** - Needs `npm run cdk:env`

## Internal/Helper Scripts

These scripts are used by other scripts and don't need direct npm commands:

- **config.sh** - Sourced by other scripts for configuration
- **convert-plaintext-template.js** - Used by bulk-load scripts
- **check-comprehend-manual.md** - Documentation, not executable

## Recommendations

1. Add missing npm commands for better discoverability
2. Group related commands with colons (e.g., `deploy:*`, `check:*`)
3. Add descriptions to package.json scripts section
4. Consider removing unused or duplicate scripts
5. Standardize script extensions (.sh for shell, .js for Node)