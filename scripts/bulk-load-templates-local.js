#!/usr/bin/env node

/**
 * Bulk load templates into LOCAL DynamoDB from CSV or JSON file
 *
 * Usage:
 *   npm run templates:load:local -- --file ./data/templates.csv
 *   npm run templates:load:local -- --file ./data/templates.json
 */

const fs = require("fs");
const path = require("path");

// Load .env.local file if it exists
const dotenv = require("dotenv");
const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log("✅ Loaded .env.local");
  if (process.env.LOCAL_USER_ID) {
    console.log(`✅ Found LOCAL_USER_ID: ${process.env.LOCAL_USER_ID.substring(0, 8)}...`);
  } else {
    console.log("⚠️  LOCAL_USER_ID not found in .env.local");
    console.log("   Add LOCAL_USER_ID=your-cognito-user-id to .env.local");
  }
}

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  BatchWriteCommand,
} = require("@aws-sdk/lib-dynamodb");
const { parse } = require("csv-parse/sync");
const { v4: uuidv4 } = require("uuid");
const { convertPlainTextToHTML } = require("./convert-plaintext-template");

// Configure AWS SDK for local DynamoDB
const client = new DynamoDBClient({
  endpoint: "http://localhost:8000",
  region: "local",
  credentials: {
    accessKeyId: "local",
    secretAccessKey: "local",
  },
});
const docClient = DynamoDBDocumentClient.from(client);

// Local table name
const tableName = "local-templates";

// Parse command line arguments
const args = process.argv.slice(2);
const fileIndex = args.indexOf("--file");

if (fileIndex === -1 || !args[fileIndex + 1]) {
  console.error("Please provide a file path using --file parameter");
  console.error(
    "Example: npm run templates:load:local -- --file ./data/templates.csv",
  );
  process.exit(1);
}

const filePath = args[fileIndex + 1];

console.log(`Loading templates into LOCAL DynamoDB table: ${tableName}`);
console.log(`Endpoint: http://localhost:8000`);

// Function to extract variables from content
function extractVariables(content) {
  const variablePattern = /\[\[([^\]]+)\]\]/g;
  const variables = [];
  let match;

  while ((match = variablePattern.exec(content)) !== null) {
    const variable = match[1];
    if (!variables.includes(variable)) {
      variables.push(variable);
    }
  }

  return variables;
}

// Function to process CSV data
function processCSV(data) {
  const records = parse(data, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  return records.map((record, index) => {
    let content = record.content || "";

    // Check if content format is specified
    const format = record.format || "html";
    if (format === "plain" || format === "text") {
      // Convert plain text to HTML
      content = convertPlainTextToHTML(content);
    }

    const variables = extractVariables(content);

    // Use LOCAL_USER_ID for the first two templates, stub for others
    const isTopTwo = index < 2;
    const userId = isTopTwo 
      ? process.env.LOCAL_USER_ID || "stub-user-demo" // Use env var for your user ID
      : "stub-user-" + (record.authorEmail || "demo@localhost").replace("@", "-at-");

    return {
      templateId: uuidv4(),
      userId: userId,
      title: record.title || "Untitled Template",
      content: content,
      variables: variables,
      variableCount: variables.length,
      visibility: record.visibility || "public",
      tags: record.tags
        ? record.tags.split(",").map((t) => t.trim().toLowerCase())
        : [],
      authorEmail: record.authorEmail || "demo@localhost",
      authorName: record.authorName || (record.authorEmail || "demo@localhost").split('@')[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      viewCount: parseInt(record.viewCount) || 0,
      useCount: parseInt(record.useCount) || 0,
      moderationStatus: "approved", // Auto-approve for local
      category: record.category || "general",
    };
  });
}

// Function to process JSON data
function processJSON(data) {
  const records = JSON.parse(data);

  return records.map((record, index) => {
    let content = record.content || "";

    // Check if content format is specified
    const format = record.format || "html";
    if (format === "plain" || format === "text") {
      // Convert plain text to HTML
      content = convertPlainTextToHTML(content);
    }

    const variables = record.variables || extractVariables(content);

    // Use LOCAL_USER_ID for the first two templates, stub for others
    const isTopTwo = index < 2;
    const userId = isTopTwo 
      ? process.env.LOCAL_USER_ID || "stub-user-demo" // Use env var for your user ID
      : "stub-user-" + (record.authorEmail || "demo@localhost").replace("@", "-at-");

    return {
      templateId: record.templateId || uuidv4(),
      userId: record.userId || userId,
      title: record.title || "Untitled Template",
      content: content,
      variables: variables,
      variableCount: variables.length,
      visibility: record.visibility || "public",
      tags: Array.isArray(record.tags)
        ? record.tags
        : typeof record.tags === 'string'
          ? record.tags.includes(',') 
            ? record.tags.split(',').map(t => t.trim().toLowerCase())
            : [record.tags.trim().toLowerCase()]
          : [],
      authorEmail: record.authorEmail || "demo@localhost",
      authorName: record.authorName || (record.authorEmail || "demo@localhost").split('@')[0],
      createdAt: record.createdAt || new Date().toISOString(),
      updatedAt: record.updatedAt || new Date().toISOString(),
      viewCount: record.viewCount || 0,
      useCount: record.useCount || 0,
      moderationStatus: record.moderationStatus || "approved",
      category: record.category || "general",
    };
  });
}

// Function to batch write to DynamoDB
async function batchWriteTemplates(templates) {
  const batches = [];

  // DynamoDB BatchWrite supports max 25 items per batch
  for (let i = 0; i < templates.length; i += 25) {
    batches.push(templates.slice(i, i + 25));
  }

  let totalWritten = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const putRequests = batch.map((template) => ({
      PutRequest: {
        Item: template,
      },
    }));

    try {
      await docClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [tableName]: putRequests,
          },
        }),
      );

      totalWritten += batch.length;
      console.log(
        `Batch ${i + 1}/${batches.length} written (${batch.length} items)`,
      );
    } catch (error) {
      console.error(`Error writing batch ${i + 1}:`, error.message);
      // Continue with other batches even if one fails
    }
  }

  return totalWritten;
}

// Main function
async function main() {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Read file
    const fileContent = fs.readFileSync(filePath, "utf8");
    const fileExtension = path.extname(filePath).toLowerCase();

    let templates;

    // Process based on file type
    if (fileExtension === ".csv") {
      console.log("Processing CSV file...");
      templates = processCSV(fileContent);
    } else if (fileExtension === ".json") {
      console.log("Processing JSON file...");
      templates = processJSON(fileContent);
    } else {
      throw new Error("Unsupported file type. Please use .csv or .json");
    }

    console.log(`Found ${templates.length} templates to load`);

    // Write to DynamoDB
    const totalWritten = await batchWriteTemplates(templates);

    console.log(
      `\n✅ Successfully loaded ${totalWritten} templates into LOCAL DynamoDB`,
    );

    // Show sample of loaded templates
    console.log("\nSample of loaded templates:");
    templates.slice(0, 3).forEach((template) => {
      const tags = Array.isArray(template.tags) ? template.tags : [];
      console.log(
        `- ${template.title} (${template.variables.length} variables, ${tags.join(", ")})`,
      );
    });

    console.log("\n🚀 View your templates at: http://localhost:8001");
    console.log("   Table: templates");
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

// Run the script
main();
