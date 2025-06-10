#!/bin/bash

# Check Amplify DNS configuration
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

echo -e "${BLUE}🔍 Checking DNS Configuration for Amplify${NC}"

# Get Route 53 hosted zone
DOMAIN="gravyprompts.com"
ZONE_ID=$(aws route53 list-hosted-zones --query "HostedZones[?Name=='${DOMAIN}.'].Id" --output text | cut -d'/' -f3)

if [ -z "$ZONE_ID" ]; then
    echo -e "${RED}❌ No hosted zone found for $DOMAIN${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Found hosted zone: $ZONE_ID${NC}"

# List all records
echo -e "\n${BLUE}Current DNS Records:${NC}"
aws route53 list-resource-record-sets --hosted-zone-id "$ZONE_ID" \
    --query "ResourceRecordSets[?Type=='CNAME' || Type=='A' || Type=='AAAA'].[Name,Type,ResourceRecords[0].Value || AliasTarget.DNSName]" \
    --output table

echo -e "\n${YELLOW}📝 Amplify DNS Requirements:${NC}"
echo "1. Domain verification CNAME (usually _abc123.gravyprompts.com)"
echo "2. Root domain (gravyprompts.com) - A/AAAA record or ALIAS"
echo "3. WWW subdomain (www.gravyprompts.com) - CNAME record"

echo -e "\n${BLUE}💡 To add records:${NC}"
echo "1. Go to AWS Amplify Console → App settings → Domain management"
echo "2. Click 'View DNS records' to see required CNAME values"
echo "3. Add those records to Route 53"

# Check if common Amplify records exist
echo -e "\n${BLUE}Checking for Amplify patterns:${NC}"
aws route53 list-resource-record-sets --hosted-zone-id "$ZONE_ID" \
    --query "ResourceRecordSets[?contains(Name, '_') && Type=='CNAME']" \
    --output json | jq -r '.[] | "Verification CNAME: \(.Name)"'