#!/bin/bash

# Configuration script for AWS CDK deployment
# This script sets up stack names and other deployment variables
# based on environment variables or defaults

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Load environment variables from .env file if it exists (secure method)
if [ -f "$SCRIPT_DIR/../.env" ]; then
    set -a
    source "$SCRIPT_DIR/../.env"
    set +a
elif [ -f .env ]; then
    set -a
    source .env
    set +a
fi

# Set default values if environment variables are not set
export APP_NAME=${APP_NAME:-"nextjs-app"}
export DOMAIN_NAME=${DOMAIN_NAME:-"example.com"}
export STACK_PREFIX=${STACK_PREFIX:-$(echo "$APP_NAME" | tr '[:lower:]' '[:upper:]' | sed 's/[^A-Z0-9]//g')}

# Environment configuration
# Map "production" to "Prod" for CDK stack naming
export RAW_ENVIRONMENT=${ENVIRONMENT:-"development"}
if [ "$RAW_ENVIRONMENT" = "production" ]; then
    export ENVIRONMENT="Prod"
elif [ "$RAW_ENVIRONMENT" = "development" ]; then
    export ENVIRONMENT="Dev"
else
    export ENVIRONMENT="$RAW_ENVIRONMENT"
fi

# Stack names based on the configured prefix
export FOUNDATION_STACK="${STACK_PREFIX}-Foundation"
export CERTIFICATE_STACK="${STACK_PREFIX}-Certificate"
export EDGE_FUNCTIONS_STACK="${STACK_PREFIX}-EdgeFunctions"
export WAF_STACK="${STACK_PREFIX}-WAF"
export CDN_STACK="${STACK_PREFIX}-CDN"
export MONITORING_STACK="${STACK_PREFIX}-Monitoring"
export APP_STACK="${STACK_PREFIX}-App"
export AUTH_STACK="${STACK_PREFIX}-Auth"

# Legacy stack names for cleanup/migration
export LEGACY_STACK="VocalTechniqueTranslatorStack"
export LEGACY_WAF_STACK="VocalTechniqueTranslatorWafStack"
export LEGACY_MONITORING_STACK="VocalTechniqueTranslatorMonitoringStack"

# Display configuration
if [ "${1:-}" = "--show-config" ]; then
    echo "🔧 Current configuration:"
    echo "   APP_NAME: $APP_NAME"
    echo "   DOMAIN_NAME: $DOMAIN_NAME"
    echo "   STACK_PREFIX: $STACK_PREFIX"
    echo ""
    echo "📚 Stack names:"
    echo "   Foundation: $FOUNDATION_STACK"
    echo "   Certificate: $CERTIFICATE_STACK"
    echo "   Edge Functions: $EDGE_FUNCTIONS_STACK"
    echo "   WAF: $WAF_STACK"
    echo "   CDN: $CDN_STACK"
    echo "   Monitoring: $MONITORING_STACK"
    echo "   App: $APP_STACK"
    echo "   Auth: $AUTH_STACK"
fi