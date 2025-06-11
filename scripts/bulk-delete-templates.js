#!/usr/bin/env node

/**
 * Bulk delete templates from DynamoDB
 * 
 * Usage:
 *   npm run templates:delete -- --all                    # Delete all templates
 *   npm run templates:delete -- --email system@gravyprompts.com  # Delete by author
 *   npm run templates:delete -- --tag test              # Delete by tag
 *   npm run templates:delete -- --all --env production  # Delete all in production
 */

const fs = require('fs');
const path = require('path');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');

// Load environment variables
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

// Parse command line arguments
const args = process.argv.slice(2);
const deleteAll = args.includes('--all');
const emailIndex = args.indexOf('--email');
const tagIndex = args.indexOf('--tag');
const envIndex = args.indexOf('--env');

const filterEmail = emailIndex !== -1 && args[emailIndex + 1] ? args[emailIndex + 1] : null;
const filterTag = tagIndex !== -1 && args[tagIndex + 1] ? args[tagIndex + 1] : null;
const environment = envIndex !== -1 && args[envIndex + 1] ? args[envIndex + 1] : 'development';

if (!deleteAll && !filterEmail && !filterTag) {
  console.error('Please specify what to delete:');
  console.error('  --all                Delete all templates');
  console.error('  --email <email>      Delete templates by author email');
  console.error('  --tag <tag>          Delete templates with specific tag');
  console.error('  --env <environment>  Specify environment (default: development)');
  process.exit(1);
}

// Configure AWS
const region = process.env.AWS_REGION || 'us-east-1';
const client = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(client);

// Determine table name based on environment
const appName = process.env.APP_NAME || 'nextjs-app';
const stackPrefix = appName.toUpperCase().replace(/[^A-Z0-9]/g, '');
const envSuffix = environment === 'production' ? 'Prod' : 'Dev';
const tableName = `${stackPrefix}-Templates-${envSuffix}`;

console.log(`Deleting templates from table: ${tableName}`);
console.log(`Region: ${region}`);
console.log(`Environment: ${environment}`);

if (deleteAll) {
  console.log('Mode: DELETE ALL TEMPLATES');
} else if (filterEmail) {
  console.log(`Mode: Delete templates by author: ${filterEmail}`);
} else if (filterTag) {
  console.log(`Mode: Delete templates with tag: ${filterTag}`);
}

// Function to scan and get all matching templates
async function scanTemplates() {
  const allTemplates = [];
  let lastEvaluatedKey = null;
  
  do {
    const scanParams = {
      TableName: tableName,
      ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey }),
    };
    
    try {
      const response = await docClient.send(new ScanCommand(scanParams));
      const templates = response.Items || [];
      
      // Filter based on criteria
      const filteredTemplates = templates.filter(template => {
        if (deleteAll) return true;
        if (filterEmail && template.authorEmail === filterEmail) return true;
        if (filterTag && template.tags && template.tags.includes(filterTag)) return true;
        return false;
      });
      
      allTemplates.push(...filteredTemplates);
      lastEvaluatedKey = response.LastEvaluatedKey;
      
      console.log(`Scanned ${templates.length} items, found ${filteredTemplates.length} matches...`);
    } catch (error) {
      console.error('Error scanning templates:', error);
      throw error;
    }
  } while (lastEvaluatedKey);
  
  return allTemplates;
}

// Function to batch delete templates
async function batchDeleteTemplates(templates) {
  const batches = [];
  
  // DynamoDB BatchWrite supports max 25 items per batch
  for (let i = 0; i < templates.length; i += 25) {
    batches.push(templates.slice(i, i + 25));
  }
  
  let totalDeleted = 0;
  
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const deleteRequests = batch.map(template => ({
      DeleteRequest: {
        Key: {
          templateId: template.templateId
        }
      }
    }));
    
    try {
      await docClient.send(new BatchWriteCommand({
        RequestItems: {
          [tableName]: deleteRequests
        }
      }));
      
      totalDeleted += batch.length;
      console.log(`Batch ${i + 1}/${batches.length} deleted (${batch.length} items)`);
    } catch (error) {
      console.error(`Error deleting batch ${i + 1}:`, error);
      // Continue with other batches even if one fails
    }
  }
  
  return totalDeleted;
}

// Function to prompt for confirmation
function promptConfirmation(message) {
  return new Promise((resolve) => {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    readline.question(message + ' (yes/no): ', (answer) => {
      readline.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

// Main function
async function main() {
  try {
    // Scan for templates
    console.log('\nScanning for templates to delete...');
    const templatesToDelete = await scanTemplates();
    
    if (templatesToDelete.length === 0) {
      console.log('\nNo templates found matching the criteria.');
      return;
    }
    
    console.log(`\nFound ${templatesToDelete.length} templates to delete:`);
    
    // Show sample of templates to be deleted
    console.log('\nSample of templates to be deleted:');
    templatesToDelete.slice(0, 5).forEach(template => {
      console.log(`- ${template.title} by ${template.authorEmail} (${template.tags?.join(', ') || 'no tags'})`);
    });
    
    if (templatesToDelete.length > 5) {
      console.log(`... and ${templatesToDelete.length - 5} more`);
    }
    
    // Confirm deletion
    const confirmed = await promptConfirmation(`\n⚠️  Are you sure you want to delete ${templatesToDelete.length} templates from ${tableName}?`);
    
    if (!confirmed) {
      console.log('Deletion cancelled.');
      return;
    }
    
    // Delete templates
    console.log('\nDeleting templates...');
    const totalDeleted = await batchDeleteTemplates(templatesToDelete);
    
    console.log(`\n✅ Successfully deleted ${totalDeleted} templates from ${tableName}`);
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();