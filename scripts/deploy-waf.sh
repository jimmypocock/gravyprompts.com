#!/bin/bash
set -e

# Load configuration
source "$(dirname "$0")/config.sh"

echo "🛡️  Deploying WAF Stack..."
echo "📝 Stack name: $WAF_STACK"

# Check AWS credentials
echo "🔐 Using AWS Profile: $AWS_PROFILE"
if ! aws sts get-caller-identity --profile "$AWS_PROFILE" &> /dev/null; then
    echo "❌ AWS credentials not configured for profile '$AWS_PROFILE'"
    echo "   Please run 'aws configure --profile $AWS_PROFILE' or set AWS_PROFILE to a configured profile"
    exit 1
fi

# Build CDK if needed
cd cdk
if [ ! -d "node_modules" ]; then
    npm install
fi
rm -f lib/*.d.ts lib/*.js
npm run build

# Deploy only the WAF stack
echo "☁️  Deploying WAF rules..."
npx cdk deploy "$WAF_STACK" --require-approval never --profile "$AWS_PROFILE" "$@"

cd ..

echo "✅ WAF deployment complete!"