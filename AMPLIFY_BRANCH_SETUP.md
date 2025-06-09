# Amplify Branch-Based Deployment Setup

This guide sets up a professional branch-based deployment strategy with AWS Amplify.

## Branch Strategy

```
main          → Development (local testing)
staging       → Staging environment (pre-production testing)
production    → Production environment (live site)
```

## Step 1: Create Branches

```bash
# Create production branch from current main
git checkout -b production
git push origin production

# Create staging branch
git checkout main
git checkout -b staging
git push origin staging

# Return to main
git checkout main
```

## Step 2: Configure Amplify for Multiple Environments

### In AWS Amplify Console:

1. **Production Branch**:
   - Connect `production` branch
   - Set as "Production branch" in settings
   - Add production environment variables:
   ```
   NEXT_PUBLIC_API_URL=https://api.gravyprompts.com/production
   NEXT_PUBLIC_COGNITO_USER_POOL_ID_PROD=us-east-1_xxxxPROD
   NEXT_PUBLIC_COGNITO_CLIENT_ID_PROD=xxxxxxxxxxxxPROD
   ENVIRONMENT=production
   ```

2. **Staging Branch**:
   - Connect `staging` branch
   - Add staging environment variables:
   ```
   NEXT_PUBLIC_API_URL=https://api.gravyprompts.com/staging
   NEXT_PUBLIC_COGNITO_USER_POOL_ID_PROD=us-east-1_xxxxSTAG
   NEXT_PUBLIC_COGNITO_CLIENT_ID_PROD=xxxxxxxxxxxxSTAG
   ENVIRONMENT=staging
   ```

3. **Main Branch** (Optional):
   - For development preview
   - Use development Cognito pool

## Step 3: Update Build Configuration

Create branch-specific build configs:

### `amplify.yml` (already exists for all branches)

For branch-specific settings, use environment variables in your code:

```typescript
// lib/config.ts
export const config = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL,
  cognitoPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID_PROD,
  cognitoClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID_PROD,
  environment: process.env.ENVIRONMENT || 'development',
};
```

## Step 4: Set Up Domain Routing

### Production Branch:
- Domain: `gravyprompts.com`
- Subdomain: `www.gravyprompts.com`

### Staging Branch:
- Subdomain: `staging.gravyprompts.com`

### Development (main):
- Amplify default: `main.d1234567890.amplifyapp.com`

## Step 5: Deployment Workflow

### Development Workflow:
```bash
# Work on main branch
git checkout main
# Make changes
git add .
git commit -m "Add new feature"
git push origin main
```

### Staging Deployment:
```bash
# Merge main into staging
git checkout staging
git merge main
git push origin staging
# Amplify auto-deploys to staging
```

### Production Deployment:
```bash
# After testing in staging
git checkout production
git merge staging
git push origin production
# Amplify auto-deploys to production
```

## Step 6: Branch Protection Rules

In GitHub, set up branch protection for `production`:

1. Go to Settings → Branches
2. Add rule for `production`
3. Enable:
   - Require pull request reviews
   - Dismiss stale PR approvals
   - Require status checks (Amplify build)
   - Require branches to be up to date
   - Include administrators

## Step 7: Environment-Specific Features

Use environment detection in your app:

```typescript
// components/DevBanner.tsx
export function DevBanner() {
  const env = process.env.NEXT_PUBLIC_ENVIRONMENT;
  
  if (env === 'production') return null;
  
  return (
    <div className={`text-center py-2 ${
      env === 'staging' ? 'bg-yellow-500' : 'bg-blue-500'
    }`}>
      {env === 'staging' ? '🚧 Staging Environment' : '🔧 Development Environment'}
    </div>
  );
}
```

## Step 8: Monitoring by Environment

Set up separate CloudWatch dashboards:
- Production alerts → PagerDuty/Critical
- Staging alerts → Slack/Warning
- Development → Logs only

## Best Practices

1. **Never commit directly to production**
   - Always go through staging
   - Use pull requests for visibility

2. **Tag releases**:
   ```bash
   git tag -a v1.0.0 -m "First production release"
   git push origin v1.0.0
   ```

3. **Rollback strategy**:
   ```bash
   # If production has issues
   git checkout production
   git reset --hard HEAD~1
   git push --force-with-lease origin production
   ```

4. **Feature flags** for gradual rollouts:
   ```typescript
   const FEATURES = {
     newEditor: process.env.NEXT_PUBLIC_ENABLE_NEW_EDITOR === 'true',
   };
   ```

## Quick Reference

| Branch | Purpose | URL | Cognito Pool |
|--------|---------|-----|--------------|
| main | Development | dev.amplifyapp.com | Development |
| staging | Pre-production testing | staging.gravyprompts.com | Staging/Prod |
| production | Live site | gravyprompts.com | Production |

## Troubleshooting

### Build fails on specific branch
- Check branch-specific environment variables
- Verify API endpoints are accessible
- Check Cognito pool configuration

### Wrong environment showing
- Clear build cache in Amplify
- Verify ENVIRONMENT variable is set correctly
- Check runtime vs build-time variables

### Domain not working
- Verify DNS propagation (can take 24-48h)
- Check SSL certificate status
- Ensure domain is verified in Amplify