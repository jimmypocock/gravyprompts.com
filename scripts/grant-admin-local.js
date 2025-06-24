#!/usr/bin/env node

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");

// Parse command line arguments
const args = process.argv.slice(2);
const userIdIndex = args.findIndex(arg => arg === '--userId' || arg === '-u');
const userId = userIdIndex !== -1 && args[userIdIndex + 1] ? args[userIdIndex + 1] : null;

if (!userId) {
  console.error('Error: User ID is required');
  console.error('Usage: node grant-admin-local.js --userId <userId>');
  process.exit(1);
}

// Configure DynamoDB client for local
const client = new DynamoDBClient({
  endpoint: "http://localhost:8000",
  region: "us-east-1",
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test"
  }
});

const docClient = DynamoDBDocumentClient.from(client);

async function grantAdminPermissions() {
  try {
    // Grant both admin and approval permissions - each permission is a separate item
    const permissions = ["admin", "approval"];
    const timestamp = new Date().toISOString();
    
    for (const permission of permissions) {
      const params = {
        TableName: "local-user-permissions",
        Item: {
          userId: userId,
          permission: permission,
          grantedAt: timestamp,
          grantedBy: "local-script"
        }
      };

      await docClient.send(new PutCommand(params));
      console.log(`✅ Granted ${permission} permission to user: ${userId}`);
    }
    
    console.log('\n🎉 Successfully granted all admin permissions!');
    console.log('Permissions granted: admin, approval');
    
    // Also log to help debug
    console.log('\nTo verify, you can:');
    console.log('1. Check the DynamoDB Admin UI at http://localhost:8001');
    console.log('2. Refresh your browser to see the updated permissions in the Auth Debug panel');
  } catch (error) {
    console.error('❌ Error granting admin permissions:', error);
    if (error.name === 'ResourceNotFoundException') {
      console.error('\nMake sure the local DynamoDB is running and tables are created:');
      console.error('1. Run: npm run local:setup');
      console.error('2. Run: npm run local:start');
    }
    process.exit(1);
  }
}

grantAdminPermissions();