# Migration Guide: From IAM Users to OIDC for GitHub Actions

This guide helps you migrate from using IAM users with long-term access keys to the more secure OIDC (OpenID Connect) approach for GitHub Actions.

## 🚨 Why Migrate?

AWS explicitly states: **"Do not give [third parties] access to an IAM user and its long-term credentials"**

Current risks with IAM users:

- ❌ Long-term credentials can be leaked
- ❌ Manual rotation required
- ❌ Secrets stored in GitHub
- ❌ Less granular access control
- ❌ Poor audit trail

Benefits of OIDC:

- ✅ No secrets in GitHub
- ✅ Automatic credential rotation
- ✅ Temporary credentials only
- ✅ Better security posture
- ✅ Detailed audit logs

## 📋 Pre-Migration Checklist

Before starting:

- [ ] List all workflows using AWS credentials
- [ ] Document current IAM user permissions
- [ ] Identify AWS resources accessed
- [ ] Plan testing strategy
- [ ] Schedule maintenance window

## 🔄 Migration Steps

### Step 1: Create OIDC Setup (Without Breaking Existing)

1. **Follow the CICD-SETUP-GUIDE-SECURE.md** to create:

   - OIDC Identity Provider
   - IAM Role with proper trust policy
   - Permission policies

2. **Do NOT delete IAM user yet!**

### Step 2: Create Test Branch

```bash
git checkout -b migration/oidc-setup
```

### Step 3: Update a Test Workflow

1. **Create a test workflow** `.github/workflows/test-oidc.yml`:

```yaml
name: Test OIDC Setup

on:
  workflow_dispatch: # Manual trigger only

permissions:
  id-token: write
  contents: read

jobs:
  test-oidc:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Configure AWS credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::${{ secrets.AWS_ACCOUNT_ID }}:role/gravyprompts-github-actions-oidc
          aws-region: us-east-1

      - name: Test AWS access
        run: |
          echo "Testing AWS access with OIDC..."
          aws sts get-caller-identity
          aws s3 ls
          echo "✅ OIDC setup working!"
```

2. **Push and test**:

```bash
git add .github/workflows/test-oidc.yml
git commit -m "test: Add OIDC test workflow"
git push origin migration/oidc-setup
```

3. **Run the test workflow** from Actions tab

### Step 4: Update Existing Workflows

For each workflow using AWS credentials:

**Before (IAM User):**

```yaml
- name: Configure AWS credentials
  uses: aws-actions/configure-aws-credentials@v4
  with:
    aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
    aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
    aws-region: us-east-1
```

**After (OIDC):**

```yaml
permissions:
  id-token: write # Add this at job or workflow level
  contents: read

steps:
  - name: Configure AWS credentials
    uses: aws-actions/configure-aws-credentials@v4
    with:
      role-to-assume: arn:aws:iam::${{ secrets.AWS_ACCOUNT_ID }}:role/gravyprompts-github-actions-oidc
      aws-region: us-east-1
```

### Step 5: Test Each Updated Workflow

1. **Create PR to test**
2. **Verify all checks pass**
3. **Check AWS actions work correctly**

### Step 6: Merge and Monitor

1. **Merge PR to main branch**
2. **Monitor workflows for 24-48 hours**
3. **Check CloudTrail for successful assumptions**

### Step 7: Clean Up IAM User (After Verification)

⚠️ **Only do this after confirming all workflows work with OIDC!**

1. **Disable IAM user first** (don't delete immediately):

```bash
aws iam update-access-key \
  --access-key-id AKIAXXXXXXXX \
  --status Inactive \
  --user-name gravyprompts-cicd
```

2. **Wait 1 week** to ensure no issues

3. **Delete IAM user**:

```bash
# Delete access keys
aws iam delete-access-key \
  --access-key-id AKIAXXXXXXXX \
  --user-name gravyprompts-cicd

# Detach policies
aws iam detach-user-policy \
  --user-name gravyprompts-cicd \
  --policy-arn arn:aws:iam::123456789012:policy/gravyprompts-cicd-policy

# Delete user
aws iam delete-user --user-name gravyprompts-cicd
```

4. **Remove GitHub secrets**:
   - Go to Settings → Secrets → Actions
   - Delete `AWS_ACCESS_KEY_ID`
   - Delete `AWS_SECRET_ACCESS_KEY`

## 🔍 Verification Steps

### Check Role Assumptions

```bash
# View recent role assumptions
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=EventName,AttributeValue=AssumeRoleWithWebIdentity \
  --max-results 10
```

### Verify Workflows

- Check Actions tab for successful runs
- Review deployment logs
- Test application functionality

### Monitor for Issues

- Set up CloudWatch alarms for failed assumptions
- Check Slack/email notifications
- Review error logs

## 🚨 Rollback Plan

If issues occur:

1. **Re-enable IAM user** (if not deleted):

```bash
aws iam update-access-key \
  --access-key-id AKIAXXXXXXXX \
  --status Active \
  --user-name gravyprompts-cicd
```

2. **Revert workflow changes**:

```bash
git revert <commit-hash>
git push origin main
```

3. **Re-add GitHub secrets** if removed

## 📊 Migration Timeline

Recommended timeline for zero-downtime migration:

- **Day 1**: Create OIDC setup
- **Day 2-3**: Test in feature branches
- **Day 4**: Update non-critical workflows
- **Day 5-7**: Monitor and verify
- **Day 8**: Update critical workflows
- **Day 9-14**: Monitor production
- **Day 15**: Disable IAM user
- **Day 22**: Delete IAM user

## ❓ Common Issues

### "Could not assume role"

```yaml
# Ensure permissions are set
permissions:
  id-token: write
  contents: read
```

### "Trust policy error"

- Verify repository name in trust policy
- Check branch restrictions
- Ensure OIDC provider exists

### "AccessDenied on resource"

- Compare IAM user policies with role policies
- Add missing permissions to role
- Check resource ARNs

## 📚 Resources

- [GitHub: OIDC Migration](https://github.blog/changelog/2021-10-27-github-actions-secure-cloud-deployments-with-openid-connect/)
- [AWS: OIDC Provider Setup](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_create_oidc.html)
- [Security Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)

---

**Remember**: Take your time with this migration. It's better to move slowly and maintain stability than rush and cause outages.
