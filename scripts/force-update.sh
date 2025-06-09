#!/bin/bash

# Script to force update the website with cache clearing
set -e

# Load configuration
source "$(dirname "$0")/config.sh"

echo "🚀 Force Update Website Content"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Build Next.js with static export
echo "📦 Building Next.js application..."
cd "$(dirname "$0")/.."

# Ensure static export is enabled
if ! grep -q "output: 'export'" next.config.ts; then
    echo -e "${RED}❌ Error: Static export is not enabled in next.config.ts${NC}"
    echo "Please uncomment the 'output: 'export'' line"
    exit 1
fi

npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Next.js build failed${NC}"
    exit 1
fi

# Verify the out directory exists
if [ ! -d "out" ]; then
    echo -e "${RED}❌ Error: 'out' directory not found. Static export may have failed.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Next.js build complete${NC}"

# Step 2: Deploy to S3
echo "📤 Deploying to S3..."
npm run deploy:app

# Step 3: Create extensive CloudFront invalidation
echo "🌐 Creating CloudFront invalidation..."

# Get CloudFront distribution ID
DIST_ID=$(aws cloudformation describe-stacks \
    --stack-name "$CDN_STACK" \
    --query 'Stacks[0].Outputs[?OutputKey==`DistributionId`].OutputValue' \
    --output text \
    --region us-east-1)

if [ -z "$DIST_ID" ]; then
    echo -e "${RED}❌ Could not find CloudFront distribution ID${NC}"
    exit 1
fi

# Create invalidation with timestamp
INVALIDATION_ID=$(aws cloudfront create-invalidation \
    --distribution-id "$DIST_ID" \
    --paths "/*" \
    --query 'Invalidation.Id' \
    --output text)

echo -e "${YELLOW}⏳ CloudFront invalidation created: $INVALIDATION_ID${NC}"
echo "   This may take 5-10 minutes to complete globally."

# Step 4: Provide instructions for cache clearing
echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "To see your changes immediately:"
echo "1. Wait 5-10 minutes for CloudFront invalidation"
echo "2. Clear your browser cache or use incognito/private mode"
echo "3. Hard refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)"
echo ""
echo "Your site URLs:"
echo "  https://www.${DOMAIN_NAME}"
echo "  https://${DOMAIN_NAME}"

# Optional: Wait for invalidation to complete
echo ""
read -p "Would you like to wait for the invalidation to complete? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "⏳ Waiting for invalidation to complete..."
    aws cloudfront wait invalidation-completed \
        --distribution-id "$DIST_ID" \
        --id "$INVALIDATION_ID"
    echo -e "${GREEN}✅ Invalidation completed!${NC}"
fi