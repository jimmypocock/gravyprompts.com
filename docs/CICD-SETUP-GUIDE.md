# CI/CD Setup Guide for GravyPrompts

This guide walks you through setting up a professional CI/CD pipeline using GitHub Actions for the GravyPrompts application.

## 📊 Cost Breakdown

### CI/CD Pipeline Costs (GitHub Actions)

- **Estimated Cost**: ~$0.40/month
- **Free Tier**: 2,000 minutes/month for private repos (unlimited for public repos)
- **Usage**: ~2,060 minutes/month
- **Overage**: ~60 minutes @ $0.008/minute = $0.48

### AWS Hosting Costs (NOT CI/CD related)

These are your regular hosting costs regardless of CI/CD:

- **Amplify Hosting**: ~$5-20/month
- **API Gateway**: ~$3-10/month
- **Lambda**: Usually free tier
- **DynamoDB**: ~$2-20/month
- **Total Hosting**: ~$10-50/month depending on traffic

**Total Monthly Cost**: ~$0.40 (CI/CD) + $10-50 (hosting) = ~$10-50/month

## 🔐 Getting Required Keys

### 1. AWS Access Keys

**⚠️ Security Best Practice**: Create a dedicated IAM user for deployments with minimal permissions.

1. **Sign in to AWS Console**

   - Go to https://console.aws.amazon.com/

2. **Create IAM User for CI/CD**

   ```
   Services → IAM → Users → Add User
   - User name: gravyprompts-cicd
   - Access type: ✅ Programmatic access
   ```

3. **Attach Permissions**

   - Click "Attach existing policies directly"
   - Create a custom policy with ONLY needed permissions:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "AmplifyPermissions",
         "Effect": "Allow",
         "Action": [
           "amplify:StartJob",
           "amplify:GetApp",
           "amplify:GetJob",
           "amplify:ListJobs"
         ],
         "Resource": "arn:aws:amplify:*:${AWS::AccountId}:apps/${AmplifyAppId}/*"
       },
       {
         "Sid": "CloudFormationPermissions",
         "Effect": "Allow",
         "Action": [
           "cloudformation:CreateStack",
           "cloudformation:UpdateStack",
           "cloudformation:DeleteStack",
           "cloudformation:DescribeStacks",
           "cloudformation:DescribeStackEvents",
           "cloudformation:GetTemplate",
           "cloudformation:ValidateTemplate"
         ],
         "Resource": "arn:aws:cloudformation:*:${AWS::AccountId}:stack/GRAVYPROMPTS-*/*"
       },
       {
         "Sid": "LambdaPermissions",
         "Effect": "Allow",
         "Action": [
           "lambda:CreateFunction",
           "lambda:UpdateFunctionCode",
           "lambda:UpdateFunctionConfiguration",
           "lambda:DeleteFunction",
           "lambda:GetFunction",
           "lambda:ListFunctions",
           "lambda:InvokeFunction",
           "lambda:TagResource"
         ],
         "Resource": "arn:aws:lambda:*:${AWS::AccountId}:function:GRAVYPROMPTS-*"
       },
       {
         "Sid": "APIGatewayPermissions",
         "Effect": "Allow",
         "Action": [
           "apigateway:GET",
           "apigateway:POST",
           "apigateway:PUT",
           "apigateway:DELETE",
           "apigateway:PATCH"
         ],
         "Resource": [
           "arn:aws:apigateway:*::/restapis",
           "arn:aws:apigateway:*::/restapis/*"
         ]
       },
       {
         "Sid": "DynamoDBPermissions",
         "Effect": "Allow",
         "Action": [
           "dynamodb:CreateTable",
           "dynamodb:UpdateTable",
           "dynamodb:DeleteTable",
           "dynamodb:DescribeTable",
           "dynamodb:ListTables",
           "dynamodb:TagResource"
         ],
         "Resource": "arn:aws:dynamodb:*:${AWS::AccountId}:table/GRAVYPROMPTS-*"
       },
       {
         "Sid": "S3Permissions",
         "Effect": "Allow",
         "Action": [
           "s3:CreateBucket",
           "s3:DeleteBucket",
           "s3:PutObject",
           "s3:GetObject",
           "s3:DeleteObject",
           "s3:ListBucket",
           "s3:GetBucketLocation"
         ],
         "Resource": [
           "arn:aws:s3:::gravyprompts-*",
           "arn:aws:s3:::gravyprompts-*/*"
         ]
       },
       {
         "Sid": "LogsPermissions",
         "Effect": "Allow",
         "Action": [
           "logs:CreateLogGroup",
           "logs:CreateLogStream",
           "logs:PutLogEvents",
           "logs:DescribeLogGroups"
         ],
         "Resource": "arn:aws:logs:*:${AWS::AccountId}:log-group:/aws/lambda/GRAVYPROMPTS-*:*"
       },
       {
         "Sid": "IAMPassRolePermission",
         "Effect": "Allow",
         "Action": "iam:PassRole",
         "Resource": "arn:aws:iam::${AWS::AccountId}:role/GRAVYPROMPTS-*",
         "Condition": {
           "StringEquals": {
             "iam:PassedToService": [
               "lambda.amazonaws.com",
               "apigateway.amazonaws.com"
             ]
           }
         }
       },
       {
         "Sid": "IAMServiceLinkedRolePermission",
         "Effect": "Allow",
         "Action": "iam:CreateServiceLinkedRole",
         "Resource": "arn:aws:iam::${AWS::AccountId}:role/aws-service-role/*/*",
         "Condition": {
           "StringLike": {
             "iam:AWSServiceName": [
               "amplify.amazonaws.com",
               "apigateway.amazonaws.com",
               "lambda.amazonaws.com"
             ]
           }
         }
       },
       {
         "Sid": "IAMRoleManagement",
         "Effect": "Allow",
         "Action": [
           "iam:CreateRole",
           "iam:DeleteRole",
           "iam:AttachRolePolicy",
           "iam:DetachRolePolicy",
           "iam:PutRolePolicy",
           "iam:DeleteRolePolicy",
           "iam:GetRole",
           "iam:GetRolePolicy"
         ],
         "Resource": "arn:aws:iam::${AWS::AccountId}:role/GRAVYPROMPTS-*"
       }
     ]
   }
   ```

   **Note**: Replace `${AWS::AccountId}` with your actual AWS account ID and `${AmplifyAppId}` with your Amplify app ID when creating the policy.

4. **Save Credentials**

   - `AWS_ACCESS_KEY_ID`: AKIA...
   - `AWS_SECRET_ACCESS_KEY`: wJal...

5. **Get AWS Account ID**
   ```
   Top right corner → Account → Account ID
   Example: 123456789012
   ```

### 2. Amplify App ID

1. **Open Amplify Console**

   ```
   Services → AWS Amplify → Your App
   ```

2. **Find App ID**
   ```
   App settings → General → App ARN
   Example: d2xyzabc123
   ```

### 3. GitHub Secrets Setup

1. **Navigate to Repository Settings**

   ```
   Your Repo → Settings → Secrets and variables → Actions
   ```

2. **Add Required Secrets**
   Click "New repository secret" for each:

   ```
   Name: AWS_ACCESS_KEY_ID
   Value: [Your AWS Access Key ID]

   Name: AWS_SECRET_ACCESS_KEY
   Value: [Your AWS Secret Access Key]

   Name: AWS_ACCOUNT_ID
   Value: [Your AWS Account ID]

   Name: AMPLIFY_APP_ID
   Value: [Your Amplify App ID]
   ```

3. **Add Optional Secrets** (if using)

   ```
   Name: GA_MEASUREMENT_ID
   Value: G-XXXXXXXXXX (from Google Analytics)

   Name: ADSENSE_CLIENT_ID
   Value: ca-pub-XXXXXXXXXXXXXXXX (from Google AdSense)

   Name: SNYK_TOKEN
   Value: [From https://app.snyk.io/account]

   Name: SLACK_WEBHOOK
   Value: https://hooks.slack.com/services/XXX/YYY/ZZZ
   ```

## 🚀 Pipeline Setup Steps

### 1. Enable GitHub Actions

1. Go to **Settings → Actions → General**
2. Under "Actions permissions":
   - Select "Allow all actions and reusable workflows"
3. Under "Workflow permissions":
   - Select "Read and write permissions"
   - ✅ Check "Allow GitHub Actions to create and approve pull requests"

### 2. Create Workflow Files

The repository already contains these workflow files:

- `.github/workflows/ci-cd-pipeline.yml` - Main pipeline
- `.github/workflows/pr-checks.yml` - Pull request checks
- `.github/workflows/scheduled-tasks.yml` - Weekly maintenance

### 3. Configure Branch Protection

1. Go to **Settings → Branches**
2. Add rule for `main` branch:
   - ✅ Require a pull request before merging
   - ✅ Require approvals: 1
   - ✅ Dismiss stale pull request approvals
   - ✅ Require status checks to pass:
     - `code-quality`
     - `unit-tests`
     - `integration-tests`
   - ✅ Require branches to be up to date
   - ✅ Include administrators

### 4. Connect Amplify to GitHub

1. **Open Amplify Console**
2. **Connect Repository**

   ```
   App settings → General → Connect repository
   - Choose GitHub
   - Authorize AWS Amplify
   - Select your repository
   ```

3. **Configure Build Settings**
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

## 📋 Testing Your Setup

### 1. Test PR Workflow

```bash
git checkout -b test/ci-setup
echo "# Test" >> README.md
git add README.md
git commit -m "test: CI pipeline"
git push origin test/ci-setup
```

Create a PR and watch the checks run!

### 2. Test Deployment

Once PR is merged:

- Merge to `develop` → Deploys to staging
- Merge to `main` → Deploys to production

### 3. Monitor Pipeline

- Go to **Actions** tab in GitHub
- Click on a workflow run to see details
- Check logs for any issues

## 🛠️ Customization Options

### Adjust Test Parallelization

In `.github/workflows/ci-cd-pipeline.yml`:

```yaml
strategy:
  matrix:
    test-suite:
      - "lambda"
      - "components"
      - "security"
      - "contracts"
      # Add more suites here
```

### Change Deployment Branches

```yaml
# Deploy to staging from develop
if: github.ref == 'refs/heads/develop'

# Deploy to production from main
if: github.ref == 'refs/heads/main'
```

### Add Environment Variables

```yaml
env:
  NODE_ENV: production
  API_URL: ${{ secrets.API_URL }}
```

## 🚨 Troubleshooting

### Common Issues

1. **"Resource not accessible by integration"**

   - Check workflow permissions in Settings → Actions

2. **AWS Credentials Invalid**

   - Verify IAM user has correct permissions
   - Check secrets are set correctly (no extra spaces)

3. **Amplify Deployment Fails**

   - Check Amplify app is connected to correct repo
   - Verify build settings in Amplify console

4. **Tests Timeout**
   - Increase timeout in test files
   - Check for async operations not completing

### Debug Commands

```bash
# Check GitHub Actions locally
act -l

# Validate workflow syntax
actionlint .github/workflows/*.yml

# Test AWS credentials
aws sts get-caller-identity
```

## 📈 Monitoring & Optimization

### View Usage

1. Go to **Settings → Billing → Actions**
2. See minutes used and remaining

### Reduce Usage

- Use `paths` filters to skip unnecessary runs
- Cache dependencies aggressively
- Run heavy tests only on main branch
- Use Ubuntu runners (cheaper than Windows/Mac)

### Example Path Filter

```yaml
on:
  push:
    paths:
      - "src/**"
      - "package.json"
      - ".github/workflows/**"
    paths-ignore:
      - "**.md"
      - "docs/**"
```

## 🎯 Next Steps

1. **Set up monitoring**

   - CloudWatch dashboards
   - Slack notifications
   - Email alerts

2. **Add badges to README**

   ```markdown
   ![CI/CD](https://github.com/yourusername/gravyprompts/actions/workflows/ci-cd-pipeline.yml/badge.svg)
   ![Coverage](https://img.shields.io/codecov/c/github/yourusername/gravyprompts)
   ```

3. **Implement feature flags**
   - Safer deployments
   - A/B testing
   - Gradual rollouts

## 📚 Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [AWS IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [Amplify Build Settings](https://docs.aws.amazon.com/amplify/latest/userguide/build-settings.html)

---

**Note**: This pipeline is designed for the GravyPrompts application. Adjust permissions and settings based on your specific security requirements.
