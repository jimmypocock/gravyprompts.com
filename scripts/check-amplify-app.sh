#!/bin/bash

# Check Amplify app configuration
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

echo -e "${BLUE}🔍 Checking Amplify Apps${NC}"

# List all Amplify apps
echo -e "\n${BLUE}Amplify Apps:${NC}"
aws amplify list-apps --query "apps[*].[name,appId,defaultDomain]" --output table

# Get app details
echo -e "\n${YELLOW}Enter your Amplify App ID (from the table above):${NC}"
read -r APP_ID

if [ -z "$APP_ID" ]; then
    echo -e "${RED}❌ No App ID provided${NC}"
    exit 1
fi

# Check domain associations
echo -e "\n${BLUE}Domain Associations:${NC}"
aws amplify list-domain-associations --app-id "$APP_ID" --query "domainAssociations[*].[domainName,domainStatus,statusReason]" --output table

# Get detailed domain info
DOMAIN_NAME="gravyprompts.com"
echo -e "\n${BLUE}Detailed info for $DOMAIN_NAME:${NC}"
aws amplify get-domain-association --app-id "$APP_ID" --domain-name "$DOMAIN_NAME" 2>/dev/null || echo -e "${YELLOW}Domain not yet associated${NC}"

echo -e "\n${BLUE}💡 Next Steps:${NC}"
echo "1. If domain is not associated, add it in Amplify Console"
echo "2. If domain shows 'PENDING_VERIFICATION', add the CNAME records to Route 53"
echo "3. If domain shows 'FAILED', check the statusReason for details"