# Scripts Directory

This directory contains various scripts for deployment, maintenance, and development of the GravyPrompts application.

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
