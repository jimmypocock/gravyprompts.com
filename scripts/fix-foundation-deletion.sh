#!/bin/bash

# Script to fix foundation stack deletion by manually cleaning up S3 buckets

set -e

source "$(dirname "$0")/config.sh"

echo "🔧 Fixing Foundation Stack deletion issue..."
echo ""
echo "This script will:"
echo "1. Manually empty and delete S3 buckets"
echo "2. Remove the failed custom resource"
echo "3. Retry stack deletion"
echo ""

# Get bucket names
WEBSITE_BUCKET="${DOMAIN_NAME}-app"
LOGS_BUCKET="${DOMAIN_NAME}-logs"

echo "📋 Buckets to clean up:"
echo "  - ${WEBSITE_BUCKET}"
echo "  - ${LOGS_BUCKET}"
echo ""

read -p "Continue? (yes/no): " -r
echo

if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "❌ Cancelled."
    exit 1
fi

# Function to safely delete a bucket
delete_bucket() {
    local bucket=$1
    echo "🗑️  Processing bucket: ${bucket}"
    
    # Check if bucket exists
    if aws s3api head-bucket --bucket "${bucket}" 2>/dev/null; then
        echo "  ✓ Bucket exists"
        
        # Remove bucket policy (if exists)
        echo "  - Removing bucket policy..."
        aws s3api delete-bucket-policy --bucket "${bucket}" 2>/dev/null || true
        
        # Disable versioning
        echo "  - Disabling versioning..."
        aws s3api put-bucket-versioning --bucket "${bucket}" \
            --versioning-configuration Status=Suspended 2>/dev/null || true
        
        # Delete all objects
        echo "  - Deleting all objects..."
        aws s3 rm "s3://${bucket}" --recursive 2>/dev/null || true
        
        # Delete all versions (if versioning was enabled)
        echo "  - Deleting object versions..."
        aws s3api list-object-versions --bucket "${bucket}" \
            --query 'Versions[].{Key:Key,VersionId:VersionId}' \
            --output text 2>/dev/null | while read key version; do
            if [ ! -z "$key" ] && [ "$key" != "None" ]; then
                aws s3api delete-object --bucket "${bucket}" \
                    --key "$key" --version-id "$version" 2>/dev/null || true
            fi
        done
        
        # Delete delete markers
        echo "  - Deleting delete markers..."
        aws s3api list-object-versions --bucket "${bucket}" \
            --query 'DeleteMarkers[].{Key:Key,VersionId:VersionId}' \
            --output text 2>/dev/null | while read key version; do
            if [ ! -z "$key" ] && [ "$key" != "None" ]; then
                aws s3api delete-object --bucket "${bucket}" \
                    --key "$key" --version-id "$version" 2>/dev/null || true
            fi
        done
        
        # Finally, delete the bucket
        echo "  - Deleting bucket..."
        aws s3api delete-bucket --bucket "${bucket}" --region ${AWS_REGION} 2>/dev/null || true
        
        echo "  ✅ Bucket deleted"
    else
        echo "  ⏭️  Bucket not found, skipping..."
    fi
    echo ""
}

# Delete both buckets
delete_bucket "${WEBSITE_BUCKET}"
delete_bucket "${LOGS_BUCKET}"

# Now try to delete the CloudFormation stack again
echo "🔄 Retrying Foundation Stack deletion..."
echo ""

# First, try to delete the stack normally
if aws cloudformation delete-stack \
    --stack-name "${STACK_PREFIX}-Foundation" \
    --region ${AWS_REGION} 2>/dev/null; then
    echo "✅ Stack deletion initiated"
else
    echo "⚠️  Stack deletion failed, trying with retain resources..."
    
    # Get the logical IDs of the problematic resources
    RESOURCES_TO_RETAIN=$(aws cloudformation list-stack-resources \
        --stack-name "${STACK_PREFIX}-Foundation" \
        --region ${AWS_REGION} \
        --query "StackResourceSummaries[?ResourceStatus=='DELETE_FAILED'].LogicalResourceId" \
        --output text 2>/dev/null || echo "")
    
    if [ ! -z "$RESOURCES_TO_RETAIN" ]; then
        echo "  Retaining resources: $RESOURCES_TO_RETAIN"
        
        # Delete stack while retaining failed resources
        aws cloudformation delete-stack \
            --stack-name "${STACK_PREFIX}-Foundation" \
            --retain-resources $RESOURCES_TO_RETAIN \
            --region ${AWS_REGION} || true
    fi
fi

# Wait for stack deletion
echo ""
echo "⏳ Waiting for stack deletion..."
echo "  This may take a few minutes..."

STACK_STATUS="DELETE_IN_PROGRESS"
while [ "$STACK_STATUS" == "DELETE_IN_PROGRESS" ]; do
    sleep 10
    STACK_STATUS=$(aws cloudformation describe-stacks \
        --stack-name "${STACK_PREFIX}-Foundation" \
        --region ${AWS_REGION} \
        --query 'Stacks[0].StackStatus' \
        --output text 2>/dev/null || echo "DELETED")
    
    if [ "$STACK_STATUS" != "DELETED" ]; then
        echo "  Status: $STACK_STATUS"
    fi
done

if [ "$STACK_STATUS" == "DELETED" ] || [ "$STACK_STATUS" == "DELETE_COMPLETE" ]; then
    echo ""
    echo "✅ Foundation Stack successfully deleted!"
else
    echo ""
    echo "❌ Stack deletion failed with status: $STACK_STATUS"
    echo ""
    echo "Manual cleanup may be required:"
    echo "1. Go to CloudFormation console"
    echo "2. Select the ${STACK_PREFIX}-Foundation stack"
    echo "3. Click 'Delete' and select 'Retain' for any failed resources"
    echo "4. After deletion, manually clean up any retained resources"
fi