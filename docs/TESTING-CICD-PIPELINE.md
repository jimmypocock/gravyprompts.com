# Testing CI/CD Pipeline Guide

## Before Going to Production

### 1. Test in a Feature Branch

```bash
# Create a test branch
git checkout -b test/cicd-pipeline

# Make a small change (like updating README)
echo "Testing CI/CD" >> README.md
git add README.md
git commit -m "test: CI/CD pipeline validation"
git push origin test/cicd-pipeline
```

### 2. Create a Draft PR

1. Go to GitHub → Pull requests → New pull request
2. Set base: `main`, compare: `test/cicd-pipeline`
3. Create as **draft PR** (won't trigger reviews)
4. Watch the "Checks" tab to see workflows run

### 3. Monitor the Pipeline

#### In the PR:

- Click **"Details"** next to each check to see logs
- Look for:
  - ✅ Code quality checks
  - ✅ Unit tests (all 4 parallel jobs)
  - ✅ Integration tests
  - ✅ Security scan
  - ✅ Build

#### In Actions Tab:

1. Go to your repo → **Actions** tab
2. Click on your workflow run
3. Click on any job to see detailed logs
4. Look for any ❌ failed steps

### 4. Test Manual Trigger

```yaml
# Your workflows support manual trigger
workflow_dispatch:
```

1. Go to Actions tab
2. Select "CI/CD Pipeline"
3. Click "Run workflow"
4. Choose branch and run

## Testing Without Deployment

Since you're using OIDC (not IAM users yet), the deployment steps will fail. That's OK! You can:

### Option A: Comment Out Deploy Steps

```yaml
# Temporarily disable deployment
# deploy-staging:
#   name: Deploy to Staging
#   ...
```

### Option B: Add Test Mode

```yaml
- name: Deploy backend (CDK)
  if: github.event_name != 'pull_request' # Skip on PRs
  run: |
    echo "Would deploy to AWS here"
    # npm run deploy:backend
```

### Option C: Use GitHub Environments

```yaml
environment:
  name: staging
  url: https://staging.gravyprompts.com
```

Then require manual approval in Settings → Environments.

## Viewing Results

### 1. GitHub UI

**Pull Request View**:

- Checks appear at bottom of PR
- Green checkmark = passed
- Red X = failed
- Yellow circle = running

**Actions Tab View**:

- Full workflow visualization
- Detailed logs for each step
- Artifacts (test reports, coverage)
- Timing information

### 2. Notifications

**Email**: GitHub sends emails for:

- Failed workflows
- Successful deployments (if subscribed)

**Slack** (if configured):

```yaml
- name: Notify deployment success
  uses: 8398a7/action-slack@v3
  with:
    status: success
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

### 3. Status Badges

Add to your README:

```markdown
![CI/CD](https://github.com/yourusername/gravyprompts/actions/workflows/ci-cd-pipeline.yml/badge.svg)
![Coverage](https://img.shields.io/codecov/c/github/yourusername/gravyprompts)
```

## Best Practices for Testing

### 1. Start Small

- Test with simple changes first
- Verify each job works independently
- Gradually enable more features

### 2. Use Draft PRs

- Create draft PRs for testing
- Convert to ready when tests pass
- Delete test branches after

### 3. Check Logs Carefully

- Look for warnings, not just errors
- Check execution time
- Verify cache is working

### 4. Test Different Scenarios

```bash
# Test PR flow
git checkout -b feature/test-pr
# make changes
git push origin feature/test-pr
# Create PR

# Test direct push (be careful!)
git checkout develop
# make small change
git push origin develop

# Test scheduled jobs
# Wait for Sunday 2 AM UTC or trigger manually
```

## Common Issues & Solutions

### "Could not assume role"

- OIDC not set up yet
- Solution: Set up OIDC first or comment out deploy steps

### "npm audit found vulnerabilities"

- Security check failed
- Solution: Run `npm audit fix` locally first

### "Resource not accessible by integration"

- Permissions issue
- Solution: Check workflow permissions in Settings → Actions

### Tests timing out

- Tests taking too long
- Solution: Increase timeout or optimize tests

## Gradual Rollout Strategy

### Phase 1: Test Core Features

1. Enable only linting and tests
2. Verify they pass consistently
3. Check execution time

### Phase 2: Add Security Scans

1. Enable security scanning
2. Fix any vulnerabilities
3. Set appropriate thresholds

### Phase 3: Enable Deployments

1. Set up OIDC
2. Test staging deployment
3. Test production deployment

### Phase 4: Add Advanced Features

1. Enable performance tests
2. Add coverage reporting
3. Set up monitoring

## Debugging Workflow Runs

### Enable Debug Logging

Add these secrets to your repo:

```
ACTIONS_RUNNER_DEBUG: true
ACTIONS_STEP_DEBUG: true
```

### Download Artifacts

```yaml
- uses: actions/upload-artifact@v4
  with:
    name: test-results
    path: coverage/
```

Then download from Actions → Workflow run → Artifacts.

### Re-run Failed Jobs

1. Go to failed workflow
2. Click "Re-run failed jobs"
3. Only failed jobs will run again

## Production Readiness Checklist

Before pushing to main:

- [ ] All checks pass in feature branch
- [ ] Deployment credentials configured (OIDC)
- [ ] Secrets added to GitHub
- [ ] Branch protection enabled
- [ ] Team notified of CI/CD activation
- [ ] Rollback plan ready

## Emergency Stop

If something goes wrong:

1. **Disable Actions**: Settings → Actions → Disable actions
2. **Cancel Running Workflows**: Actions tab → Cancel workflow
3. **Remove Workflow Files**: Delete `.github/workflows/*.yml`
4. **Revert Changes**: `git revert` the problematic commit

Remember: Start with read-only operations (tests, linting) before enabling deployments!
