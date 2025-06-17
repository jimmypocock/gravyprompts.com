# Secure CI/CD Setup Guide for GravyPrompts (OIDC-Based)

> **🔒 Security Note**: This guide implements AWS best practices using OIDC (OpenID Connect) for GitHub Actions. Unlike traditional IAM users with long-term access keys, this approach uses temporary credentials that are automatically rotated, providing significantly better security.

## 📋 Why OIDC Instead of IAM Users?

AWS explicitly recommends **NOT** giving third parties (including GitHub) access to IAM users with long-term credentials. Instead, use IAM roles with temporary security credentials.

Benefits of OIDC:

- ✅ No secrets stored in GitHub
- ✅ Temporary credentials (automatically rotated)
- ✅ Better audit trail
- ✅ Scoped to specific repositories/branches
- ✅ Follows AWS Well-Architected Framework

## 🚀 Setup Steps

### 1. Create OIDC Identity Provider in AWS

1. **Sign in to AWS Console** as an administrator

2. **Navigate to IAM**

   ```bash
   Services → IAM → Identity providers → Add provider
   ```

3. **Configure the Provider**
   - Provider type: `OpenID Connect`
   - Provider URL: `https://token.actions.githubusercontent.com`
   - Audience: `sts.amazonaws.com`
   - Click "Add provider"

### 2. Create IAM Role for GitHub Actions

1. **Create New Role**

   ```bash
   IAM → Roles → Create role
   ```

2. **Select Trusted Entity**

   - Type: `Web identity`
   - Identity provider: `token.actions.githubusercontent.com`
   - Audience: `sts.amazonaws.com`

3. **Configure Trust Policy**
   Click "Edit trust policy" and use this secure configuration:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Principal": {
           "Federated": "arn:aws:iam::${AWS_ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"
         },
         "Action": "sts:AssumeRoleWithWebIdentity",
         "Condition": {
           "StringEquals": {
             "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
             "token.actions.githubusercontent.com:sub": [
               "repo:${GITHUB_ORG}/${GITHUB_REPO}:ref:refs/heads/main",
               "repo:${GITHUB_ORG}/${GITHUB_REPO}:ref:refs/heads/develop",
               "repo:${GITHUB_ORG}/${GITHUB_REPO}:pull_request"
             ]
           }
         }
       }
     ]
   }
   ```

   **Important**: Replace:

   - `${AWS_ACCOUNT_ID}` with your AWS account ID
   - `${GITHUB_ORG}` with your GitHub organization/username
   - `${GITHUB_REPO}` with your repository name

4. **Attach Permission Policy**
   Use this secure policy that follows least privilege:

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

5. **Name the Role**
   - Role name: `gravyprompts-github-actions-oidc`
   - Description: "Role for GitHub Actions CI/CD pipeline using OIDC"

### 3. Update GitHub Actions Workflow

1. **Update Workflow Permissions**
   Add these permissions to your workflow file:

   ```yaml
   permissions:
     id-token: write # Required for OIDC
     contents: read # Required for actions/checkout
   ```

2. **Configure AWS Credentials Action**
   Replace the old credentials configuration with:

   ```yaml
   - name: Configure AWS credentials
     uses: aws-actions/configure-aws-credentials@v4
     with:
       role-to-assume: arn:aws:iam::${{ secrets.AWS_ACCOUNT_ID }}:role/gravyprompts-github-actions-oidc
       aws-region: us-east-1
   ```

### 4. GitHub Secrets Configuration

You only need these secrets now (much fewer than before!):

1. **Navigate to Repository Settings**

   ```bash
   Your Repo → Settings → Secrets and variables → Actions
   ```

2. **Add Required Secrets**

   ```bash
   Name: AWS_ACCOUNT_ID
   Value: [Your AWS Account ID]

   Name: AMPLIFY_APP_ID
   Value: [Your Amplify App ID]
   ```

3. **Add Optional Secrets** (if using)

   ```bash
   Name: GA_MEASUREMENT_ID
   Value: G-XXXXXXXXXX

   Name: ADSENSE_CLIENT_ID
   Value: ca-pub-XXXXXXXXXXXXXXXX

   Name: SNYK_TOKEN
   Value: [From https://app.snyk.io/account]

   Name: SLACK_WEBHOOK
   Value: https://hooks.slack.com/services/XXX/YYY/ZZZ
   ```

Note: No AWS access keys or secret keys needed! 🎉

### 5. Complete GitHub Actions Workflow Example

Here's a complete example of the updated workflow:

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

permissions:
  id-token: write
  contents: read
  pull-requests: write # For PR comments

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::${{ secrets.AWS_ACCOUNT_ID }}:role/gravyprompts-github-actions-oidc
          aws-region: us-east-1

      - name: Deploy to AWS
        run: |
          # Your deployment commands here
          npm run deploy:backend
```

## 🔒 Security Best Practices Implemented

1. **No Long-Term Credentials**: Uses temporary credentials via OIDC
2. **Scoped Access**: Role can only be assumed by specific repository and branches
3. **Least Privilege**: Permissions limited to exactly what's needed
4. **Audit Trail**: All actions are logged with repository context
5. **Automatic Rotation**: Credentials expire after each workflow run

## 🚨 Common Issues & Solutions

### "Could not assume role"

- Verify the trust policy includes your repository
- Check that `id-token: write` permission is set
- Ensure the OIDC provider is correctly configured

### "AccessDenied" errors

- Review the permission policy for missing actions
- Check resource ARNs match your actual resources
- Verify the role name in the workflow matches

### Testing the Setup

```bash
# Test locally with AWS CLI
aws sts get-caller-identity

# Verify OIDC provider
aws iam list-open-id-connect-providers

# Check role trust policy
aws iam get-role --role-name gravyprompts-github-actions-oidc
```

## 📊 Cost Comparison

Using OIDC has the same runtime costs as IAM users, but provides:

- Better security posture
- Reduced risk of credential leaks
- Compliance with AWS best practices
- Easier credential rotation (automatic)

## 🔄 Migration from IAM Users

If you're currently using IAM users with access keys:

1. **Set up OIDC** (follow this guide)
2. **Test in a feature branch** first
3. **Update all workflows** to use the new method
4. **Delete IAM user** and access keys
5. **Remove secrets** from GitHub

## 📚 Additional Resources

- [GitHub Docs: Configuring OIDC in AWS](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)
- [AWS Blog: Use IAM roles with GitHub Actions](https://aws.amazon.com/blogs/security/use-iam-roles-to-connect-github-actions-to-actions-in-aws/)
- [AWS Well-Architected Framework: Security Pillar](https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/welcome.html)

---

**Security Note**: This setup follows AWS best practices for third-party access. Never use IAM users with long-term credentials for CI/CD pipelines.
