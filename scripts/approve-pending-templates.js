#!/usr/bin/env node

/**
 * Script to manually approve pending templates
 * Usage: node scripts/approve-pending-templates.js [--all | --template-id <id>]
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const REGION = process.env.AWS_REGION || 'us-east-1';
const PROFILE = process.env.AWS_PROFILE || 'gravy';

// Configure AWS SDK
process.env.AWS_PROFILE = PROFILE;

const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

const TEMPLATES_TABLE = 'gravy-prompts-production-templates';

async function listPendingTemplates() {
  try {
    const params = {
      TableName: TEMPLATES_TABLE,
      FilterExpression: 'moderationStatus = :status',
      ExpressionAttributeValues: {
        ':status': 'pending',
      },
    };

    const result = await docClient.send(new ScanCommand(params));
    return result.Items || [];
  } catch (error) {
    console.error('Error scanning for pending templates:', error);
    throw error;
  }
}

async function approveTemplate(templateId) {
  try {
    const params = {
      TableName: TEMPLATES_TABLE,
      Key: { templateId },
      UpdateExpression: 'SET moderationStatus = :status, moderatedAt = :moderatedAt, moderationDetails = :details',
      ExpressionAttributeValues: {
        ':status': 'approved',
        ':moderatedAt': new Date().toISOString(),
        ':details': {
          approvedManually: true,
          approvedAt: new Date().toISOString(),
          moderationVersion: 'manual-1.0',
        },
      },
      ReturnValues: 'ALL_NEW',
    };

    const result = await docClient.send(new UpdateCommand(params));
    return result.Attributes;
  } catch (error) {
    console.error(`Error approving template ${templateId}:`, error);
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const approveAll = args.includes('--all');
  const templateIdIndex = args.indexOf('--template-id');
  const specificTemplateId = templateIdIndex !== -1 ? args[templateIdIndex + 1] : null;

  if (!approveAll && !specificTemplateId) {
    console.log('Usage: node scripts/approve-pending-templates.js [--all | --template-id <id>]');
    console.log('\nOptions:');
    console.log('  --all                Approve all pending templates');
    console.log('  --template-id <id>   Approve a specific template');
    console.log('\nFirst, let\'s see what templates are pending...\n');
  }

  // List pending templates
  console.log('🔍 Fetching pending templates...\n');
  const pendingTemplates = await listPendingTemplates();
  
  if (pendingTemplates.length === 0) {
    console.log('✅ No pending templates found!');
    return;
  }

  console.log(`Found ${pendingTemplates.length} pending templates:\n`);
  pendingTemplates.forEach(template => {
    console.log(`ID: ${template.templateId}`);
    console.log(`Title: ${template.title}`);
    console.log(`Owner: ${template.owner}`);
    console.log(`Created: ${template.createdAt}`);
    console.log(`Visibility: ${template.visibility}`);
    console.log('---');
  });

  // Approve templates based on command
  if (approveAll) {
    console.log('\n🚀 Approving all pending templates...\n');
    for (const template of pendingTemplates) {
      try {
        await approveTemplate(template.templateId);
        console.log(`✅ Approved: ${template.templateId} - ${template.title}`);
      } catch (error) {
        console.log(`❌ Failed to approve: ${template.templateId} - ${error.message}`);
      }
    }
  } else if (specificTemplateId) {
    console.log(`\n🚀 Approving template ${specificTemplateId}...\n`);
    try {
      const result = await approveTemplate(specificTemplateId);
      console.log(`✅ Approved: ${result.templateId} - ${result.title}`);
    } catch (error) {
      console.log(`❌ Failed to approve: ${error.message}`);
    }
  } else {
    console.log('\nTo approve templates, run:');
    console.log('  node scripts/approve-pending-templates.js --all');
    console.log('  node scripts/approve-pending-templates.js --template-id <id>');
  }
}

main().catch(console.error);