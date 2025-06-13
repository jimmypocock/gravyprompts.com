#!/usr/bin/env node

const { DynamoDBClient, DescribeTableCommand } = require('@aws-sdk/client-dynamodb');
const { APIGatewayClient, GetRestApisCommand, GetAuthorizersCommand } = require('@aws-sdk/client-api-gateway');
const { CognitoIdentityProviderClient, ListUserPoolsCommand } = require('@aws-sdk/client-cognito-identity-provider');

const region = process.env.AWS_REGION || 'us-east-1';

async function diagnoseAuth() {
  console.log('🔍 Diagnosing Authentication Issues\n');

  try {
    // Check API Gateway
    const apiClient = new APIGatewayClient({ region });
    const apisResponse = await apiClient.send(new GetRestApisCommand({}));
    
    console.log('📡 API Gateways:');
    for (const api of apisResponse.items || []) {
      if (api.name?.includes('Gravy') || api.name?.includes('gravy')) {
        console.log(`  - ${api.name} (${api.id})`);
        
        // Get authorizers for this API
        const authResponse = await apiClient.send(new GetAuthorizersCommand({ restApiId: api.id }));
        console.log('  Authorizers:');
        for (const auth of authResponse.items || []) {
          console.log(`    - ${auth.name} (Type: ${auth.type})`);
          if (auth.providerARNs) {
            console.log(`      User Pools: ${auth.providerARNs.join(', ')}`);
          }
        }
      }
    }

    // Check Cognito User Pools
    const cognitoClient = new CognitoIdentityProviderClient({ region });
    const poolsResponse = await cognitoClient.send(new ListUserPoolsCommand({ MaxResults: 20 }));
    
    console.log('\n👥 Cognito User Pools:');
    for (const pool of poolsResponse.UserPools || []) {
      if (pool.Name?.includes('Gravy') || pool.Name?.includes('gravy')) {
        console.log(`  - ${pool.Name} (${pool.Id})`);
      }
    }

    // Check DynamoDB tables
    const dbClient = new DynamoDBClient({ region });
    console.log('\n📊 DynamoDB Tables:');
    const tableNames = ['GravyPrompts-templates', 'GravyPrompts-template-views', 'GravyPrompts-user-prompts'];
    
    for (const tableName of tableNames) {
      try {
        await dbClient.send(new DescribeTableCommand({ TableName: tableName }));
        console.log(`  ✓ ${tableName} - exists`);
      } catch (error) {
        console.log(`  ✗ ${tableName} - not found`);
      }
    }

    console.log('\n💡 Common Issues:');
    console.log('1. Token expired - ID tokens expire after 1 hour');
    console.log('2. Wrong token type - API Gateway expects ID token, not access token');
    console.log('3. User pool mismatch - Frontend and API using different user pools');
    console.log('4. CORS preflight - OPTIONS requests failing');
    
    console.log('\n🔧 To fix token issues:');
    console.log('1. Clear browser cache and cookies');
    console.log('2. Sign out and sign back in');
    console.log('3. Check browser console for the actual token being sent');
    console.log('4. Verify the token at https://jwt.io to see expiration time');

  } catch (error) {
    console.error('Error running diagnostics:', error.message);
    console.error('\nMake sure you have AWS credentials configured:');
    console.error('  export AWS_PROFILE=your-profile');
    console.error('  or');
    console.error('  aws configure');
  }
}

diagnoseAuth();