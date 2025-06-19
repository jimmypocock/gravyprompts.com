# GitHub Actions Workflows

This directory contains the CI/CD workflows for the GravyPrompts project.

## Active Workflows

### 1. `ci.yml` - Continuous Integration
- **Triggers**: Push to main, Pull requests to main
- **Purpose**: Run tests, linting, security scans, and builds
- **Timeout**: 45 minutes max
- **Jobs**: Code quality, parallel tests, integration tests, security scan, build

### 2. `scheduled-tasks.yml` - Weekly Maintenance
- **Triggers**: Every Sunday at 2 AM UTC, Manual dispatch
- **Timeout**: 120 minutes max
- **Jobs**:
  - ✅ Security Audit - npm audit & dependency checks, creates GitHub issues
  - ✅ Performance Check - Runs performance test suite
  - ✅ Accessibility Check - Runs accessibility test suite
  - ✅ Database Maintenance - Gets DynamoDB read capacity metrics  
  - ✅ Cost Analysis - Monitors AWS spending, alerts if >$100/week

## Workflow Consolidation

**Before**: 7 separate workflow files with overlapping functionality
**After**: 2 focused workflows (removed E2E tests, deployment, and OIDC test workflows)

## Security & Cost-Effectiveness

### Security Best Practices
- **Minimal permissions**: Only necessary permissions granted
- **No hardcoded secrets**: Everything in GitHub Secrets
- **Dependency security**: Using `npm ci` with lock files
- **Telemetry disabled**: `NEXT_TELEMETRY_DISABLED=1`

### Cost Optimization
- **Concurrency control**: Cancels old runs when new commits pushed
- **Smart caching**: ~70% faster installs with cache
- **Parallel execution**: Tests run in matrix
- **Timeouts**: Prevents runaway jobs (10-15min per job)

### Monitoring & Alerts
- **Security Issues** → GitHub Issues created automatically
- **Cost Overruns** → GitHub Issues if weekly spend >$100
- **Failed Builds** → PR comments with details

## OIDC Configuration

**Current Status**: Enabled for production environment only.

### Enabling AWS Cost Monitoring

1. **Create OIDC Provider** in AWS:
   - Provider URL: `https://token.actions.githubusercontent.com`
   - Audience: `sts.amazonaws.com`

2. **Create IAM Role** with trust policy:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Principal": {
         "Federated": "arn:aws:iam::YOUR_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
       },
       "Action": "sts:AssumeRoleWithWebIdentity",
       "Condition": {
         "StringEquals": {
           "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
         },
         "StringLike": {
           "token.actions.githubusercontent.com:sub": [
             "repo:YOUR_GITHUB_USERNAME/gravyprompts.com:ref:refs/heads/main",
             "repo:YOUR_GITHUB_USERNAME/gravyprompts.com:environment:production"
           ]
         }
       }
     }]
   }
   ```

3. **Add Permissions Policy**:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": ["ce:GetCostAndUsage", "ce:GetCostForecast"],
         "Resource": "*"
       },
       {
         "Effect": "Allow",
         "Action": ["cloudwatch:GetMetricStatistics", "cloudwatch:ListMetrics"],
         "Resource": "*"
       }
     ]
   }
   ```

4. **Set up GitHub Environment**:
   - Go to Settings → Environments → New environment
   - Name: `production`
   - Add protection rules (optional):
     - Required reviewers
     - Restrict to main branch
   - Add environment secret: `AWS_ACCOUNT_ID`

5. **Uncomment** the cost-analysis and/or database-maintenance jobs in `scheduled-tasks.yml`

**Cost**: Free (under 1,000 API calls/month)

## Secrets

### Currently Used
- `SNYK_TOKEN` - ✅ Enhanced security scanning (added)

### Required for OIDC jobs
- `AWS_ACCOUNT_ID` - In production environment secrets

## Common Issues & Solutions

### Tests timing out
- Split large test suites
- Mock slow external calls
- Use `--runInBand` for flaky tests

### High GitHub Actions bills
- Review workflow runs for stuck jobs
- Check timeout configuration
- Use concurrency controls

### E2E Tests
- Removed from CI due to flakiness
- Run locally with `npm run test:e2e`

## Workflow Debugging

### Enable Debug Logging
1. Go to Settings → Secrets → Actions
2. Add: `ACTIONS_STEP_DEBUG` = `true`
3. Add: `ACTIONS_RUNNER_DEBUG` = `true`

### Test Locally
```bash
# Install act
brew install act

# Test CI workflow
act push -W .github/workflows/ci.yml

# Test scheduled tasks
act schedule -W .github/workflows/scheduled-tasks.yml
```

## Future Improvements

1. **Self-hosted runners** for cost reduction
2. **Test result tracking** with DataDog
3. **Automated dependency updates** with Dependabot
4. **Performance budgets** with automatic fails