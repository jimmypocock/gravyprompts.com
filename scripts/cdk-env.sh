#!/bin/bash

# Helper script to set CDK environment variables
# This ensures CDK uses the correct stack names

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Source the config to get all variables
source "${SCRIPT_DIR}/config.sh"

# Export all required CDK environment variables
export APP_NAME="${APP_NAME}"
export DOMAIN_NAME="${DOMAIN_NAME}"
export STACK_PREFIX="${STACK_PREFIX}"
export CERTIFICATE_ARN="${CERTIFICATE_ARN}"
export ENVIRONMENT="${RAW_ENVIRONMENT}"
export CDK_DEFAULT_ACCOUNT="${CDK_DEFAULT_ACCOUNT:-$AWS_ACCOUNT_ID}"
export CDK_DEFAULT_REGION="${CDK_DEFAULT_REGION:-$AWS_REGION}"
export AWS_PROFILE="${AWS_PROFILE}"

# Execute the command passed as arguments with the environment set
exec "$@"