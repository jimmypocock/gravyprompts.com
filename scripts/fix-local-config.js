#!/usr/bin/env node

/**
 * Fix local development configuration for DynamoDB endpoints
 */

const fs = require('fs');
const path = require('path');

console.log('\n🔧 Fixing Local Development Configuration\n');

let fixedCount = 0;

// Fix env.json
const envJsonPath = path.join(__dirname, '../cdk/local-test/env.json');
try {
  const envConfig = JSON.parse(fs.readFileSync(envJsonPath, 'utf8'));
  
  if (envConfig.Parameters?.AWS_ENDPOINT_URL_DYNAMODB !== 'http://host.docker.internal:8000') {
    envConfig.Parameters.AWS_ENDPOINT_URL_DYNAMODB = 'http://host.docker.internal:8000';
    fs.writeFileSync(envJsonPath, JSON.stringify(envConfig, null, 2));
    console.log('✅ Fixed env.json');
    fixedCount++;
  } else {
    console.log('✓ env.json already correct');
  }
} catch (error) {
  console.log('❌ Could not fix env.json:', error.message);
}

// Fix template-local.yaml
const templatePath = path.join(__dirname, '../cdk/local-test/template-local.yaml');
try {
  let templateContent = fs.readFileSync(templatePath, 'utf8');
  const originalContent = templateContent;
  
  // Replace the endpoint
  templateContent = templateContent.replace(
    /AWS_ENDPOINT_URL_DYNAMODB:\s*.+/,
    'AWS_ENDPOINT_URL_DYNAMODB: http://host.docker.internal:8000'
  );
  
  if (templateContent !== originalContent) {
    fs.writeFileSync(templatePath, templateContent);
    console.log('✅ Fixed template-local.yaml');
    fixedCount++;
  } else {
    console.log('✓ template-local.yaml already correct');
  }
} catch (error) {
  console.log('❌ Could not fix template-local.yaml:', error.message);
}

if (fixedCount > 0) {
  console.log(`\n✅ Fixed ${fixedCount} configuration file(s)`);
  console.log('\n⚠️  Important: Restart your local services for changes to take effect:');
  console.log('   1. Stop services: npm run local:stop');
  console.log('   2. Start again: npm run dev:all');
} else {
  console.log('\n✅ All configuration files are already correct');
}

console.log('');