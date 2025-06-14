#!/usr/bin/env node

/**
 * Sets up admin permissions for local development
 * Usage: npm run local:setup:admin
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const PERMISSIONS_TABLE = 'local-user-permissions';
const ADMIN_PERMISSIONS = ['admin', 'approval'];

// Create DynamoDB client
const dynamoClient = new DynamoDBClient({
  endpoint: 'http://localhost:8000',
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'local',
    secretAccessKey: 'local'
  }
});

const docClient = DynamoDBDocumentClient.from(dynamoClient);

async function setupAdminPermissions() {
  const userId = process.env.LOCAL_ADMIN_USER_ID;
  const email = process.env.LOCAL_ADMIN_EMAIL || 'admin@gravyprompts.com';
  
  if (!userId) {
    console.error('❌ LOCAL_ADMIN_USER_ID not found in .env.local');
    process.exit(1);
  }

  console.log(`\n🔧 Setting up admin permissions for user: ${userId}`);
  console.log(`   Email: ${email}\n`);

  try {
    // Grant each permission
    for (const permission of ADMIN_PERMISSIONS) {
      // Check if permission already exists
      const existing = await docClient.send(new GetCommand({
        TableName: PERMISSIONS_TABLE,
        Key: {
          userId: userId,
          permission: permission
        }
      }));

      if (existing.Item) {
        console.log(`✓ Permission '${permission}' already exists`);
        continue;
      }

      // Grant the permission
      await docClient.send(new PutCommand({
        TableName: PERMISSIONS_TABLE,
        Item: {
          userId: userId,
          permission: permission,
          email: email,
          grantedAt: new Date().toISOString(),
          grantedBy: 'setup-script'
        }
      }));

      console.log(`✅ Granted '${permission}' permission`);
    }

    console.log('\n✨ Admin permissions setup complete!');
    console.log('\nYou can now:');
    console.log('  - Access /admin page');
    console.log('  - Manage user permissions');
    console.log('  - Approve/reject templates');
    
  } catch (error) {
    console.error('❌ Error setting up permissions:', error);
    process.exit(1);
  }
}

// Run the setup
setupAdminPermissions();