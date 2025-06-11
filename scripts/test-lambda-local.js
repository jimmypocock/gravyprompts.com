#!/usr/bin/env node

// Test Lambda function locally to debug issues
const path = require('path');

// Set up environment variables that Lambda would have
process.env.TEMPLATES_TABLE = 'gravyprompts-templates';
process.env.TEMPLATE_VIEWS_TABLE = 'gravyprompts-template-views';
process.env.USER_PROMPTS_TABLE = 'gravyprompts-user-prompts';
process.env.USER_POOL_ID = 'us-east-1_test';

// Mock the Lambda layer by adding it to require paths
const layerPath = path.join(__dirname, '../cdk/lambda-layers/shared/nodejs');
require.main.paths.unshift(layerPath);

console.log('Testing Lambda function locally...');
console.log('Layer path:', layerPath);
console.log('Environment:', {
  TEMPLATES_TABLE: process.env.TEMPLATES_TABLE,
  TEMPLATE_VIEWS_TABLE: process.env.TEMPLATE_VIEWS_TABLE,
  USER_PROMPTS_TABLE: process.env.USER_PROMPTS_TABLE,
});

try {
  // Test loading the handler
  const listHandler = require('../cdk/lambda/templates/list');
  console.log('✅ List handler loaded successfully');
  
  // Test the handler with a mock event
  const mockEvent = {
    queryStringParameters: {
      filter: 'popular',
      limit: '12'
    },
    headers: {}
  };
  
  console.log('\nTesting handler with mock event...');
  listHandler.handler(mockEvent, {}, (err, result) => {
    if (err) {
      console.error('❌ Handler error:', err);
    } else {
      console.log('✅ Handler result:', JSON.stringify(result, null, 2));
    }
  });
  
} catch (error) {
  console.error('❌ Error loading handler:', error.message);
  console.error('Stack trace:', error.stack);
  
  // Check if it's a module resolution error
  if (error.code === 'MODULE_NOT_FOUND') {
    console.error('\nMissing module. Make sure the Lambda layer dependencies are installed:');
    console.error('cd cdk/lambda-layers/shared/nodejs && npm install');
  }
}