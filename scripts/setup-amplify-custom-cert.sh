#!/bin/bash

# Setup Amplify with custom certificate
set -e

# Source AWS configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

CERTIFICATE_ARN="arn:aws:acm:us-east-1:823155919699:certificate/79bed212-e78b-41dd-8982-c62aada1ea6c"

echo -e "${BLUE}🔍 Checking certificate status${NC}"

# Check certificate details
aws acm describe-certificate --certificate-arn "$CERTIFICATE_ARN" \
    --query "Certificate.[Status,DomainValidationOptions[0].ValidationStatus,InUseBy]" \
    --output table

echo -e "\n${YELLOW}Is this certificate currently used by another service? (CloudFront, etc.)${NC}"
echo "If yes, you'll need to either:"
echo "1. Use a different certificate for Amplify"
echo "2. Remove it from the other service first"

echo -e "\n${BLUE}💡 To use this certificate with Amplify via CLI:${NC}"
echo "Note: This requires using AWS CLI to update the domain association"

# Get Amplify app ID
echo -e "\n${YELLOW}Enter your Amplify App ID:${NC}"
read -r APP_ID

if [ -z "$APP_ID" ]; then
    echo -e "${RED}❌ No App ID provided${NC}"
    exit 1
fi

echo -e "\n${BLUE}Creating domain association with custom certificate...${NC}"
cat > /tmp/amplify-domain.json <<EOF
{
    "domainName": "gravyprompts.com",
    "subDomainSettings": [
        {
            "prefix": "",
            "branchName": "main"
        },
        {
            "prefix": "www",
            "branchName": "main"
        }
    ],
    "customCertificateArn": "$CERTIFICATE_ARN"
}
EOF

echo -e "${YELLOW}This will create the domain association. Continue? (y/n)${NC}"
read -r CONFIRM

if [ "$CONFIRM" = "y" ]; then
    aws amplify create-domain-association \
        --app-id "$APP_ID" \
        --domain-name "gravyprompts.com" \
        --sub-domain-settings prefix="",branchName="main" prefix="www",branchName="main" \
        --enable-auto-sub-domain
else
    echo -e "${YELLOW}Skipped. You can also do this in the Amplify Console.${NC}"
fi