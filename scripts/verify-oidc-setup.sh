#!/bin/bash

# Verify OIDC Setup for GitHub Actions
# This script checks that OIDC is properly configured

echo "🔍 Verifying OIDC Setup..."
echo "=========================="

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found. Please install it first."
    exit 1
fi

# Get current AWS identity
echo -e "\n📋 Current AWS Identity:"
aws sts get-caller-identity

# List OIDC providers
echo -e "\n📋 OIDC Providers in your account:"
aws iam list-open-id-connect-providers

# Check for GitHub OIDC provider
GITHUB_OIDC=$(aws iam list-open-id-connect-providers --query "OpenIDConnectProviderList[?contains(Arn, 'token.actions.githubusercontent.com')]" --output text)

if [ -z "$GITHUB_OIDC" ]; then
    echo "❌ GitHub OIDC provider not found!"
    echo "   You need to create it with URL: https://token.actions.githubusercontent.com"
else
    echo "✅ GitHub OIDC provider found: $GITHUB_OIDC"
    
    # Get provider details
    echo -e "\n📋 OIDC Provider Details:"
    aws iam get-open-id-connect-provider --open-id-connect-provider-arn $GITHUB_OIDC
fi

# Check for the IAM role
echo -e "\n📋 Checking for gravyprompts-github-actions-oidc role:"
ROLE_CHECK=$(aws iam get-role --role-name gravyprompts-github-actions-oidc 2>&1)

if [[ $? -eq 0 ]]; then
    echo "✅ IAM Role found!"
    echo -e "\n📋 Trust Policy:"
    echo "$ROLE_CHECK" | jq '.Role.AssumeRolePolicyDocument'
    
    echo -e "\n📋 Attached Policies:"
    aws iam list-attached-role-policies --role-name gravyprompts-github-actions-oidc
    
    echo -e "\n📋 Inline Policies:"
    aws iam list-role-policies --role-name gravyprompts-github-actions-oidc
else
    echo "❌ IAM Role 'gravyprompts-github-actions-oidc' not found!"
    echo "   Please create it following the CICD-SETUP-GUIDE-SECURE.md"
fi

echo -e "\n📋 GitHub Secrets Check:"
echo "Make sure you have these secrets in your GitHub repository:"
echo "  - AWS_ACCOUNT_ID"
echo "  - AMPLIFY_APP_ID"
echo ""
echo "To check: Go to Settings → Secrets and variables → Actions"

echo -e "\n✅ Verification complete!"
echo ""
echo "If everything above shows ✅, your OIDC setup is ready!"
echo "If you see any ❌, fix those issues before running the pipeline."