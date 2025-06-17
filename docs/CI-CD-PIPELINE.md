# CI/CD Pipeline Documentation

## Overview

GravyPrompts uses a **cost-effective CI/CD pipeline** built with GitHub Actions that provides enterprise-grade deployment automation while minimizing costs.

## 🏗️ Pipeline Architecture

### Cost Optimization Strategies

1. **GitHub Actions** (2000 free minutes/month for private repos)
2. **Parallelized jobs** to reduce total runtime
3. **Caching** for dependencies and build artifacts
4. **Conditional deployments** to avoid unnecessary runs
5. **Amplify auto-deployment** (GitHub integration)

## 📊 Pipeline Stages

### 1. **Pull Request Checks** (`pr-checks.yml`)

- **Runs on:** Every PR
- **Duration:** ~3-5 minutes
- **Features:**
  - Semantic PR title validation
  - Lint only changed files
  - Run only affected tests
  - Bundle size checks
  - Auto PR comments with results

### 2. **Main CI/CD Pipeline** (`ci-cd-pipeline.yml`)

#### Stage 1: Code Quality (2 min)

```yaml
- ESLint checking
- TypeScript validation
- Prettier formatting
- Runs in parallel with other checks
```

#### Stage 2: Unit Tests (5 min - parallelized)

```yaml
- Lambda tests
- Component tests
- Security tests
- Contract tests
- Each runs in separate job
```

#### Stage 3: Integration Tests (5 min)

```yaml
- Local DynamoDB setup
- API integration tests
- E2E tests
- Runs with real services
```

#### Stage 4: Security Scanning (3 min)

```yaml
- npm audit
- Snyk vulnerability scan
- OWASP dependency check
- License compliance
```

#### Stage 5: Build & Deploy (10 min)

```yaml
- Build Next.js app
- Build CDK infrastructure
- Deploy to staging (develop branch)
- Deploy to production (main branch)
```

### 3. **Scheduled Tasks** (`scheduled-tasks.yml`)

- **Runs:** Weekly (Sundays 2 AM UTC)
- **Features:**
  - Security audits
  - Performance regression checks
  - Accessibility compliance
  - Cost analysis
  - Database maintenance

## 💰 Cost Breakdown

### GitHub Actions Usage (Monthly)

- **PR Checks:** ~200 runs × 5 min = 1000 minutes
- **Main Pipeline:** ~50 runs × 20 min = 1000 minutes
- **Scheduled Tasks:** 4 runs × 15 min = 60 minutes
- **Total:** ~2060 minutes (just over free tier)
- **Cost:** ~$0.40/month for overage

### AWS Costs

- **Amplify Hosting:** $0.01/GB served + $0.15/GB stored
- **API Gateway:** $3.50/million requests
- **Lambda:** Free tier covers most usage
- **DynamoDB:** On-demand pricing, ~$0.25/million requests
- **Total:** ~$10-50/month depending on traffic

## 🚀 Setup Instructions

### 1. GitHub Secrets Configuration

Add these secrets to your GitHub repository:

```bash
# AWS Credentials
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_ACCOUNT_ID

# Amplify
AMPLIFY_APP_ID

# Analytics (optional)
GA_MEASUREMENT_ID
ADSENSE_CLIENT_ID

# Security scanning (optional)
SNYK_TOKEN

# Notifications (optional)
SLACK_WEBHOOK
```

### 2. Branch Protection Rules

Configure for `main` branch:

- ✅ Require PR reviews
- ✅ Require status checks to pass
- ✅ Require branches to be up to date
- ✅ Include administrators

### 3. Enable GitHub Actions

1. Go to Settings → Actions
2. Allow all actions
3. Enable workflow permissions

### 4. Amplify Setup

1. Connect GitHub repo to Amplify
2. Configure auto-build settings:

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
      - "**/*"
  cache:
    paths:
      - node_modules/**/*
```

## 📈 Pipeline Optimization Tips

### 1. **Reduce Build Times**

- Use `npm ci` instead of `npm install`
- Cache node_modules between runs
- Parallelize test suites
- Use shallow clones for faster checkout

### 2. **Save GitHub Actions Minutes**

- Skip CI for documentation changes
- Use path filters to run only relevant tests
- Combine related jobs when possible
- Use self-hosted runners for heavy workloads

### 3. **Cost Monitoring**

```bash
# Add to package.json
"scripts": {
  "ci:analyze": "github-actions-usage",
  "costs:report": "aws ce get-cost-and-usage --time-period Start=2024-01-01,End=2024-01-31"
}
```

## 🔧 Deployment Strategies

### Development Workflow

1. Create feature branch
2. Make changes
3. PR triggers checks
4. Merge to develop → staging deploy
5. Merge to main → production deploy

### Hotfix Process

```bash
# Create hotfix from main
git checkout -b hotfix/critical-fix main

# Make fix and push
git push origin hotfix/critical-fix

# PR directly to main (bypasses develop)
```

### Rollback Process

1. **Amplify:** Use console to redeploy previous build
2. **Lambda/CDK:**
   ```bash
   git revert <commit>
   git push origin main
   ```

## 📊 Monitoring & Alerts

### Pipeline Health

- GitHub Actions dashboard
- Slack notifications on failure
- Weekly summary reports

### Deployment Tracking

```javascript
// Add to deployment scripts
const deployment = {
  version: process.env.GITHUB_SHA,
  timestamp: new Date().toISOString(),
  environment: process.env.ENVIRONMENT,
  triggeredBy: process.env.GITHUB_ACTOR,
};
```

## 🛡️ Security Best Practices

1. **Least Privilege IAM**

   - Separate deploy user with minimal permissions
   - Rotate credentials quarterly

2. **Secret Management**

   - Use GitHub encrypted secrets
   - Never commit sensitive data
   - Audit secret usage

3. **Dependency Updates**
   - Automated PRs for updates (Dependabot)
   - Weekly security scans
   - Manual review for major updates

## 📈 Performance Metrics

Track these KPIs:

- **Pipeline Duration:** Target < 15 minutes
- **Success Rate:** Target > 95%
- **Cost per Deployment:** Target < $0.10
- **Time to Production:** Target < 30 minutes

## 🚨 Troubleshooting

### Common Issues

1. **Cache Problems**

   ```yaml
   - name: Clear cache
     run: |
       npm cache clean --force
       rm -rf node_modules
   ```

2. **Amplify Sync Issues**

   ```bash
   aws amplify stop-job --app-id $APP_ID --job-id $JOB_ID
   aws amplify start-job --app-id $APP_ID --branch-name main --job-type RELEASE
   ```

3. **Test Flakiness**
   ```javascript
   // Add retry logic for flaky tests
   jest.retryTimes(3, { logErrorsBeforeRetry: true });
   ```

## 🎯 Future Improvements

1. **Blue-Green Deployments** for zero-downtime
2. **Canary Releases** for gradual rollout
3. **Feature Flags** for safer deployments
4. **Multi-region** deployment support
5. **Self-hosted runners** for cost savings at scale

---

This CI/CD pipeline provides professional-grade deployment automation while keeping costs minimal. The combination of GitHub Actions and AWS Amplify provides a robust, scalable solution perfect for GravyPrompts.
