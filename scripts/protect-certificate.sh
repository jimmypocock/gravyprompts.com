#!/bin/bash

# This script protects the certificate from deletion by ensuring we always import it

source "$(dirname "$0")/config.sh"

echo "🔒 Protecting Certificate from Deletion"
echo "======================================"

# Get the current certificate ARN from the stack
CURRENT_CERT_ARN=$(aws cloudformation describe-stacks \
    --stack-name "$CERTIFICATE_STACK" \
    --query 'Stacks[0].Resources[?ResourceType==`AWS::CertificateManager::Certificate`].PhysicalResourceId' \
    --output text \
    --region us-east-1 2>/dev/null)

if [ ! -z "$CURRENT_CERT_ARN" ]; then
    echo "Found certificate in stack: $CURRENT_CERT_ARN"
    
    # Update .env file
    if grep -q "CERTIFICATE_ARN=" .env; then
        sed -i.bak "s|CERTIFICATE_ARN=.*|CERTIFICATE_ARN=$CURRENT_CERT_ARN|" .env
    else
        echo "CERTIFICATE_ARN=$CURRENT_CERT_ARN" >> .env
    fi
    
    echo "✅ Updated .env with certificate ARN"
    echo ""
    echo "IMPORTANT: The certificate is now protected!"
    echo "Future deployments will import this certificate instead of creating a new one."
else
    echo "⚠️  No certificate found in the stack"
fi