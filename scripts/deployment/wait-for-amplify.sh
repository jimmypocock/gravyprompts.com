#!/bin/bash

# Wait for Amplify deployment to complete
# Used in CI/CD pipeline

set -e

echo "Waiting for Amplify deployment to complete..."

APP_ID="${AMPLIFY_APP_ID}"
BRANCH_NAME="${AMPLIFY_BRANCH:-main}"
MAX_ATTEMPTS=40  # 20 minutes with 30s intervals
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    ATTEMPT=$((ATTEMPT + 1))
    echo "Checking deployment status (attempt $ATTEMPT/$MAX_ATTEMPTS)..."
    
    # Get the latest job
    JOB_STATUS=$(aws amplify list-jobs \
        --app-id "$APP_ID" \
        --branch-name "$BRANCH_NAME" \
        --max-items 1 \
        --query 'jobSummaries[0].status' \
        --output text)
    
    echo "Current status: $JOB_STATUS"
    
    case $JOB_STATUS in
        "SUCCEED")
            echo "✅ Deployment completed successfully!"
            exit 0
            ;;
        "FAILED")
            echo "❌ Deployment failed!"
            exit 1
            ;;
        "CANCELLED")
            echo "⚠️ Deployment was cancelled!"
            exit 1
            ;;
        *)
            echo "Deployment still in progress..."
            sleep 30
            ;;
    esac
done

echo "❌ Deployment timed out after 20 minutes"
exit 1