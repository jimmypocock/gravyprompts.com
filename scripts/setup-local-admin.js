#!/usr/bin/env node

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");

const userId = process.argv[2];

if (!userId) {
  console.error("Usage: npm run setup:admin:local <COGNITO_USER_ID>");
  console.error("\nTo find your Cognito User ID:");
  console.error("1. Log into the app");
  console.error('2. Check AWS Cognito console for your user\'s "sub" value');
  process.exit(1);
}

const client = new DynamoDBClient({
  endpoint: "http://localhost:8000",
  region: "us-east-1",
  credentials: {
    accessKeyId: "local",
    secretAccessKey: "local",
  },
});

const docClient = DynamoDBDocumentClient.from(client);

async function setupAdmin() {
  try {
    await docClient.send(
      new PutCommand({
        TableName: "local-user-permissions",
        Item: {
          userId,
          permission: "admin",
          grantedAt: new Date().toISOString(),
          grantedBy: "system",
        },
      }),
    );

    console.log(`✅ Successfully granted admin permission to user: ${userId}`);
    console.log(
      "\nYou can now access the admin panel at /admin when logged in with this user.",
    );
  } catch (error) {
    console.error("❌ Error setting up admin:", error.message);
    console.error("\nMake sure:");
    console.error("1. Local DynamoDB is running (npm run dev:all)");
    console.error("2. The user ID is correct");
  }
}

setupAdmin();
