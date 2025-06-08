#!/bin/bash

# Load configuration
source "$(dirname "$0")/config.sh"

echo "🔍 Checking Certificate Status"
echo "=============================="
echo ""

# Check if certificate ARN is in .env
if [ -z "$CERTIFICATE_ARN" ]; then
    echo "❌ No certificate ARN found in .env file"
    echo "   Please run: npm run deploy:cert:first"
    exit 1
fi

echo "📌 Certificate ARN: $CERTIFICATE_ARN"
echo ""

# Get certificate details
CERT_DETAILS=$(aws acm describe-certificate \
    --certificate-arn "$CERTIFICATE_ARN" \
    --region us-east-1 2>/dev/null)

if [ -z "$CERT_DETAILS" ]; then
    echo "❌ Certificate not found!"
    echo "   The certificate may have been deleted or the ARN is invalid."
    echo "   Please run: npm run deploy:cert:first"
    exit 1
fi

# Extract certificate status
CERT_STATUS=$(echo "$CERT_DETAILS" | jq -r '.Certificate.Status')
DOMAIN_NAME=$(echo "$CERT_DETAILS" | jq -r '.Certificate.DomainName')

echo "🌐 Domain: $DOMAIN_NAME"
echo "📊 Status: $CERT_STATUS"
echo ""

if [ "$CERT_STATUS" = "ISSUED" ]; then
    echo "✅ Certificate is validated and ready to use!"
    echo ""
    echo "🎉 You can now run: npm run deploy:all"
elif [ "$CERT_STATUS" = "PENDING_VALIDATION" ]; then
    echo "⚠️  Certificate is pending DNS validation!"
    echo ""
    echo "📝 DNS Validation Records Required:"
    echo "=================================="
    
    # Display validation records
    echo "$CERT_DETAILS" | jq -r '.Certificate.DomainValidationOptions[] | 
        "Domain: \(.DomainName)\nCNAME Name: \(.ResourceRecord.Name)\nCNAME Value: \(.ResourceRecord.Value)\n"'
    
    echo "=================================="
    echo ""
    echo "📋 Next Steps:"
    echo "1. Add these CNAME records to your DNS provider"
    echo "2. Wait for DNS propagation (5-30 minutes)"
    echo "3. Run this command again to check status"
    echo "4. Once validated, run: npm run deploy:all"
else
    echo "⚠️  Unexpected certificate status: $CERT_STATUS"
    echo ""
    echo "Please check the AWS Console for more details:"
    echo "https://console.aws.amazon.com/acm/home?region=us-east-1"
fi

