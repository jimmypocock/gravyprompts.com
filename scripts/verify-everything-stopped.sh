#!/bin/bash
# Verify that ALL moderation components are stopped

PROFILE="${AWS_PROFILE:-gravy}"

echo "🛑 Verifying Everything is Stopped"
echo "=================================="
echo ""

# 1. Check DynamoDB Streams
echo "1️⃣ Checking DynamoDB Streams:"
echo "------------------------------"
tables=("gravy-prompts-production-templates" "gravy-prompts-dev-templates")

for table in "${tables[@]}"; do
    echo -n "Table $table: "
    stream_status=$(aws dynamodbstreams list-streams \
        --table-name $table \
        --profile $PROFILE \
        --query 'Streams[0].StreamStatus' \
        --output text 2>/dev/null)
    
    if [ -z "$stream_status" ]; then
        echo "✅ No stream found"
    else
        echo "Stream status: $stream_status"
        
        # Check if any Lambda is attached
        stream_arn=$(aws dynamodbstreams list-streams \
            --table-name $table \
            --profile $PROFILE \
            --query 'Streams[0].StreamArn' \
            --output text 2>/dev/null)
        
        if [ ! -z "$stream_arn" ]; then
            mappings=$(aws lambda list-event-source-mappings \
                --event-source-arn $stream_arn \
                --profile $PROFILE \
                --query 'EventSourceMappings[*].[FunctionArn,State]' \
                --output text 2>/dev/null)
            
            if [ ! -z "$mappings" ]; then
                echo "  ⚠️  Stream has Lambda mappings:"
                echo "$mappings"
            fi
        fi
    fi
done

echo ""
echo "2️⃣ Checking ALL Lambda Functions:"
echo "----------------------------------"
# List ALL Lambdas that might call Comprehend
lambdas=$(aws lambda list-functions \
    --profile $PROFILE \
    --query "Functions[?contains(FunctionName, 'gravy') || contains(FunctionName, 'GRAVY')].FunctionName" \
    --output text 2>/dev/null)

for lambda in $lambdas; do
    echo -n "$lambda: "
    
    # Check if it has Comprehend permissions
    policy=$(aws lambda get-policy \
        --function-name $lambda \
        --profile $PROFILE 2>/dev/null | grep -i comprehend)
    
    if [ ! -z "$policy" ]; then
        echo "⚠️  Has Comprehend permissions!"
        
        # Check concurrency
        concurrency=$(aws lambda get-function-concurrency \
            --function-name $lambda \
            --profile $PROFILE \
            --query 'ReservedConcurrentExecutions' \
            --output text 2>/dev/null)
        
        echo "     Concurrency: ${concurrency:-not set}"
    else
        echo "✅ No Comprehend access"
    fi
done

echo ""
echo "3️⃣ Checking Event Source Mappings:"
echo "-----------------------------------"
mappings=$(aws lambda list-event-source-mappings \
    --profile $PROFILE \
    --query 'EventSourceMappings[?State!=`Disabled`].[FunctionArn,State,EventSourceArn]' \
    --output text 2>/dev/null)

if [ -z "$mappings" ]; then
    echo "✅ No active event source mappings"
else
    echo "⚠️  Active mappings found:"
    echo "$mappings"
fi

echo ""
echo "4️⃣ Final Safety Check - Comprehend Permissions:"
echo "------------------------------------------------"
echo "Checking which roles have Comprehend access..."

roles=$(aws iam list-roles \
    --profile $PROFILE \
    --query "Roles[?contains(RoleName, 'gravy') || contains(RoleName, 'GRAVY')].RoleName" \
    --output text 2>/dev/null)

for role in $roles; do
    policies=$(aws iam list-attached-role-policies \
        --role-name $role \
        --profile $PROFILE \
        --query 'AttachedPolicies[*].PolicyName' \
        --output text 2>/dev/null | grep -i comprehend)
    
    if [ ! -z "$policies" ]; then
        echo "⚠️  Role $role has Comprehend policies: $policies"
    fi
done

echo ""
echo "📊 SUMMARY:"
echo "-----------"
echo "✅ If you see mostly green checkmarks, you're safe"
echo "⚠️  If you see warnings, investigate those components"
echo ""
echo "🚨 EMERGENCY: If anything is still running:"
echo "1. Delete the entire API stack: aws cloudformation delete-stack --stack-name GRAVYPROMPTS-API-Prod --profile $PROFILE"
echo "2. Disable all event source mappings"
echo "3. Set Lambda concurrency to 0"