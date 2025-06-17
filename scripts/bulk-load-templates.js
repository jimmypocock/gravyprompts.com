#!/usr/bin/env node

/**
 * Bulk load templates into DynamoDB from CSV or JSON file
 *
 * Usage:
 *   npm run templates:load -- --file ./data/templates.csv
 *   npm run templates:load -- --file ./data/templates.json
 *   npm run templates:load -- --file ./data/templates.csv --env production
 */

const fs = require("fs");
const path = require("path");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  BatchWriteCommand,
} = require("@aws-sdk/lib-dynamodb");
const { parse } = require("csv-parse/sync");
const { v4: uuidv4 } = require("uuid");
const { convertPlainTextToHTML } = require("./convert-plaintext-template");

// Load environment variables
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  require("dotenv").config({ path: envPath });
}

// Parse command line arguments
const args = process.argv.slice(2);
const fileIndex = args.indexOf("--file");
const envIndex = args.indexOf("--env");

if (fileIndex === -1 || !args[fileIndex + 1]) {
  console.error("Please provide a file path using --file parameter");
  console.error(
    "Example: npm run templates:load -- --file ./data/templates.csv",
  );
  process.exit(1);
}

const filePath = args[fileIndex + 1];
const environment =
  envIndex !== -1 && args[envIndex + 1] ? args[envIndex + 1] : "development";

// Configure AWS
const region = process.env.AWS_REGION || "us-east-1";
const client = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(client);

// Determine table name - now environment-agnostic
const appName = process.env.APP_NAME || "nextjs-app";
const tableName = `GravyPrompts-templates`;

console.log(`Loading templates into table: ${tableName}`);
console.log(`Region: ${region}`);
console.log(`Environment: ${environment}`);

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

  return records.map((record) => {
    let content = record.content || "";

    // Check if content format is specified
    const format = record.format || "html";
    if (format === "plain" || format === "text") {
      // Convert plain text to HTML
      content = convertPlainTextToHTML(content);
    }

    const variables = extractVariables(content);

    return {
      templateId: uuidv4(),
      title: record.title || "Untitled Template",
      content: content,
      variables: variables,
      variableCount: variables.length,
      visibility: record.visibility || "public",
      tags: record.tags
        ? record.tags.split(",").map((t) => t.trim().toLowerCase())
        : [],
      authorEmail: record.authorEmail || "system@gravyprompts.com",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      viewCount: parseInt(record.viewCount) || 0,
      useCount: parseInt(record.useCount) || 0,
      moderationStatus: "approved", // Auto-approve bulk loaded templates
      category: record.category || "general",
    };
  });
}

// Function to process JSON data
function processJSON(data) {
  const records = JSON.parse(data);

  return records.map((record) => {
    let content = record.content || "";

    // Check if content format is specified
    const format = record.format || "html";
    if (format === "plain" || format === "text") {
      // Convert plain text to HTML
      content = convertPlainTextToHTML(content);
    }

    const variables = record.variables || extractVariables(content);

    return {
      templateId: record.templateId || uuidv4(),
      title: record.title || "Untitled Template",
      content: content,
      variables: variables,
      variableCount: variables.length,
      visibility: record.visibility || "public",
      tags: record.tags || [],
      authorEmail: record.authorEmail || "system@gravyprompts.com",
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
      console.error(`Error writing batch ${i + 1}:`, error);
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
      `\n✅ Successfully loaded ${totalWritten} templates into ${tableName}`,
    );

    // Show sample of loaded templates
    console.log("\nSample of loaded templates:");
    templates.slice(0, 3).forEach((template) => {
      console.log(
        `- ${template.title} (${template.variables.length} variables, ${template.tags.join(", ")})`,
      );
    });
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

// Run the script
main();
