# Security Checklist

This checklist ensures the GravyPrompts application maintains security standards for both development and public repository release.

## Pre-Deployment Security Checklist

### Code Security

- [ ] No hardcoded API keys, credentials, or secrets in any files
- [ ] All sensitive configuration uses environment variables
- [ ] No debug console.log statements with sensitive data
- [ ] Input validation on all user inputs
- [ ] SQL injection protection (parameterized queries)
- [ ] XSS protection (output encoding)
- [ ] CSRF protection on state-changing operations

### Configuration Files

- [ ] `.env` files are in `.gitignore`
- [ ] `.env.example` contains only placeholder values
- [ ] No real AWS account IDs in example files
- [ ] No real domain names in non-production configs
- [ ] AWS profile names are generic (not personal)

### API Security

- [ ] Rate limiting is enabled and configured
- [ ] Authentication required on all protected endpoints
- [ ] CORS properly configured for production domain
- [ ] API responses don't leak sensitive information
- [ ] Error messages are generic (no stack traces)

### Infrastructure

- [ ] WAF rules are active and configured
- [ ] DynamoDB encryption is enabled
- [ ] Lambda functions have appropriate timeouts
- [ ] IAM roles follow least privilege principle
- [ ] S3 buckets (if any) are not publicly accessible

## Public Repository Checklist

### Before Making Repository Public

#### Environment & Configuration

- [ ] Remove all `.env` files (keep only `.env.example`)
- [ ] Verify `.gitignore` includes all sensitive file patterns
- [ ] Check `git log` for accidentally committed secrets
- [ ] Remove any personal AWS account information
- [ ] Replace production URLs with placeholders

#### Scripts & Debug Files

- [ ] Remove or sanitize debug scripts with hardcoded values
- [ ] Check all `.sh` scripts for embedded credentials
- [ ] Remove temporary test files
- [ ] Clean up any generated reports with sensitive data
- [ ] Verify no API tokens in test files

#### Documentation

- [ ] Remove internal email addresses
- [ ] Remove internal URLs or endpoints
- [ ] Sanitize example commands
- [ ] Update README with public-appropriate content
- [ ] Add SECURITY.md for vulnerability reporting

#### AWS & Infrastructure

- [ ] CDK outputs don't contain sensitive values
- [ ] CloudFormation templates use parameters, not hardcoded values
- [ ] Remove AWS account IDs from documentation
- [ ] Ensure no S3 bucket names are exposed
- [ ] Remove internal domain names

#### Git History

- [ ] Run `git-secrets` scan on entire history
- [ ] Use `git filter-branch` if secrets found in history
- [ ] Consider fresh repository if extensive cleanup needed
- [ ] Verify no sensitive commits in history

### Post-Public Checklist

#### Monitoring

- [ ] Set up GitHub secret scanning alerts
- [ ] Enable Dependabot security alerts
- [ ] Configure branch protection rules
- [ ] Set up CODEOWNERS file
- [ ] Enable security policy

#### Access Control

- [ ] Review collaborator permissions
- [ ] Disable force pushes to main branch
- [ ] Require PR reviews for main branch
- [ ] Set up appropriate GitHub Actions permissions
- [ ] Audit third-party app access

## Quick Security Audit Commands

```bash
# Search for potential secrets
grep -r "aws_access_key\|aws_secret\|api_key\|apikey\|secret\|password" . --exclude-dir=node_modules

# Check for hardcoded AWS account IDs (replace with your pattern)
grep -r "[0-9]{12}" . --exclude-dir=node_modules

# Find environment variable usage
grep -r "process.env\|AWS_" . --exclude-dir=node_modules

# List all shell scripts for manual review
find . -name "*.sh" -type f | grep -v node_modules

# Check git history for secrets
git log -p | grep -i "secret\|key\|token\|password"
```

## Security Tools Integration

### Recommended GitHub Apps

- [ ] GitHub Advanced Security (if available)
- [ ] GitGuardian
- [ ] Snyk
- [ ] LGTM / CodeQL
- [ ] Renovate / Dependabot

### Pre-commit Hooks

```bash
# Install pre-commit hooks
npm install --save-dev husky
npx husky add .husky/pre-commit "npm run security:scan"
```

### Security Scanning Script

Create `scripts/security-scan.sh`:

```bash
#!/bin/bash
# Basic security scan before commits
grep -r "password\|secret\|key\|token" . --exclude-dir=node_modules --exclude-dir=.git
```

## Emergency Response

If secrets are accidentally exposed:

1. **Immediately rotate the exposed credentials**
2. **Remove from repository**
   ```bash
   git rm --cached file-with-secret
   git commit -m "Remove sensitive file"
   ```
3. **Clean git history**
   ```bash
   git filter-branch --force --index-filter \
   "git rm --cached --ignore-unmatch path/to/file" \
   --prune-empty --tag-name-filter cat -- --all
   ```
4. **Force push cleaned history** (coordinate with team)
5. **Audit access logs** for any unauthorized use
6. **Update incident log** with details and remediation

## Regular Security Reviews

### Weekly

- [ ] Review CloudWatch logs for anomalies
- [ ] Check rate limiting effectiveness
- [ ] Review failed authentication attempts
- [ ] Monitor API usage patterns

### Monthly

- [ ] Full repository secret scan
- [ ] Dependency vulnerability check
- [ ] IAM permission audit
- [ ] Cost anomaly review

### Quarterly

- [ ] Penetration testing
- [ ] Security training update
- [ ] Incident response drill
- [ ] Policy review and update
