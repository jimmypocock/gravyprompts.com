#!/bin/bash

# Check Amplify domain status and required DNS records
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

echo -e "${BLUE}🔍 Checking Amplify Domain Status${NC}"

# Get Amplify app ID
echo -e "\n${YELLOW}Enter your Amplify App ID (e.g., d6yrms6v3h9j2):${NC}"
read -r APP_ID

if [ -z "$APP_ID" ]; then
    echo -e "${RED}❌ No App ID provided${NC}"
    exit 1
fi

# Get domain association details
echo -e "\n${BLUE}Domain Association Details:${NC}"
aws amplify get-domain-association \
    --app-id "$APP_ID" \
    --domain-name "gravyprompts.com" \
    --query "domainAssociation.[domainStatus,statusReason,certificateVerificationDNSRecord]" \
    --output json | jq '.'

# Get subdomain settings
echo -e "\n${BLUE}Subdomain Configuration:${NC}"
aws amplify get-domain-association \
    --app-id "$APP_ID" \
    --domain-name "gravyprompts.com" \
    --query "domainAssociation.subDomains[*].[prefix,dnsRecord,verified]" \
    --output table

# Get the DNS records you need to add
echo -e "\n${YELLOW}📝 DNS Records to Add to Route 53:${NC}"
aws amplify get-domain-association \
    --app-id "$APP_ID" \
    --domain-name "gravyprompts.com" \
    --query "domainAssociation.subDomains[*].dnsRecord" \
    --output text | while read -r record; do
    echo "Add this CNAME: $record"
done

# Check current Route 53 records
ZONE_ID=$(aws route53 list-hosted-zones --query "HostedZones[?Name=='gravyprompts.com.'].Id" --output text | cut -d'/' -f3)
if [ -n "$ZONE_ID" ]; then
    echo -e "\n${BLUE}Current Route 53 Records:${NC}"
    aws route53 list-resource-record-sets --hosted-zone-id "$ZONE_ID" \
        --query "ResourceRecordSets[?Type=='CNAME' || Type=='A'].[Name,Type,ResourceRecords[0].Value || AliasTarget.DNSName]" \
        --output table
fi