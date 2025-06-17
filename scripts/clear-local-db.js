#!/usr/bin/env node

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  ScanCommand,
  DeleteCommand,
} = require("@aws-sdk/lib-dynamodb");

// Initialize DynamoDB client for local
const dynamoClient = new DynamoDBClient({
  endpoint: "http://localhost:8000",
  region: "us-east-1",
  credentials: {
    accessKeyId: "local",
    secretAccessKey: "local",
  },
});

const docClient = DynamoDBDocumentClient.from(dynamoClient);

const tables = [
  "local-templates",
  "local-template-views",
  "local-user-prompts",
];

async function clearTable(tableName) {
  console.log(`\n🗑️  Clearing table: ${tableName}`);

  try {
    // First, scan to get all items
    const scanResult = await docClient.send(
      new ScanCommand({
        TableName: tableName,
      }),
    );

    if (!scanResult.Items || scanResult.Items.length === 0) {
      console.log(`   ✅ Table ${tableName} is already empty`);
      return;
    }

    console.log(`   Found ${scanResult.Items.length} items to delete`);

    // Delete each item
    let deletedCount = 0;
    for (const item of scanResult.Items) {
      // Determine the key based on table
      let key;
      if (tableName === "local-templates") {
        key = { templateId: item.templateId };
      } else if (tableName === "local-template-views") {
        key = { viewId: item.viewId };
      } else if (tableName === "local-user-prompts") {
        key = { promptId: item.promptId };
      }

      if (key) {
        await docClient.send(
          new DeleteCommand({
            TableName: tableName,
            Key: key,
          }),
        );
        deletedCount++;

        // Show progress for large datasets
        if (deletedCount % 10 === 0) {
          process.stdout.write(
            `   Deleted ${deletedCount}/${scanResult.Items.length} items\r`,
          );
        }
      }
    }

    console.log(`   ✅ Deleted ${deletedCount} items from ${tableName}     `);
  } catch (error) {
    console.error(`   ❌ Error clearing ${tableName}:`, error.message);
  }
}

async function clearAllTables() {
  console.log("🧹 Clearing all local DynamoDB tables...\n");
  console.log(
    "⚠️  WARNING: This will delete ALL data from your local database!",
  );
  console.log("   Tables to clear:", tables.join(", "));

  // Give user a chance to cancel
  console.log("\n   Press Ctrl+C to cancel, or wait 3 seconds to continue...");
  await new Promise((resolve) => setTimeout(resolve, 3000));

  for (const table of tables) {
    await clearTable(table);
  }

  console.log("\n✅ All local tables cleared!");
  console.log(
    '\n💡 Tip: Run "npm run templates:load:local" to reload sample templates',
  );
}

// Check if DynamoDB is running
async function checkDynamoDB() {
  try {
    await docClient.send(
      new ScanCommand({
        TableName: "local-templates",
        Limit: 1,
      }),
    );
    return true;
  } catch (error) {
    if (error.name === "ResourceNotFoundException") {
      console.error(
        '❌ Table "local-templates" not found. Make sure local DynamoDB is running with tables created.',
      );
    } else {
      console.error(
        "❌ Cannot connect to local DynamoDB. Make sure it's running on port 8000.",
      );
    }
    return false;
  }
}

// Main execution
(async () => {
  const isRunning = await checkDynamoDB();
  if (!isRunning) {
    console.log('\n💡 Run "npm run dev:all" to start local DynamoDB first');
    process.exit(1);
  }

  await clearAllTables();
})();
