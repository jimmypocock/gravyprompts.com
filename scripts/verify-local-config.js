#!/usr/bin/env node

/**
 * Verify local development configuration
 */

const fs = require('fs');
const path = require('path');

console.log('\n🔍 Verifying Local Development Configuration\n');

// Check env.json
const envJsonPath = path.join(__dirname, '../cdk/local-test/env.json');
try {
  const envConfig = JSON.parse(fs.readFileSync(envJsonPath, 'utf8'));
  const endpoint = envConfig.Parameters?.AWS_ENDPOINT_URL_DYNAMODB;
  
  if (endpoint === 'http://host.docker.internal:8000') {
    console.log('✅ env.json is correctly configured');
  } else if (endpoint === 'http://dynamodb:8000') {
    console.log('❌ env.json needs update:');
    console.log('   Current: ' + endpoint);
    console.log('   Should be: http://host.docker.internal:8000');
    console.log('   Run: npm run fix:local-config');
  } else {
    console.log('⚠️  env.json has unexpected endpoint: ' + endpoint);
  }
} catch (error) {
  console.log('❌ Could not read env.json:', error.message);
}

// Check template-local.yaml
const templatePath = path.join(__dirname, '../cdk/local-test/template-local.yaml');
try {
  const templateContent = fs.readFileSync(templatePath, 'utf8');
  const match = templateContent.match(/AWS_ENDPOINT_URL_DYNAMODB:\s*(.+)/);
  
  if (match) {
    const endpoint = match[1].trim();
    if (endpoint === 'http://host.docker.internal:8000') {
      console.log('✅ template-local.yaml is correctly configured');
    } else if (endpoint === 'http://dynamodb:8000') {
      console.log('❌ template-local.yaml needs update:');
      console.log('   Current: ' + endpoint);
      console.log('   Should be: http://host.docker.internal:8000');
      console.log('   Run: npm run fix:local-config');
    } else {
      console.log('⚠️  template-local.yaml has unexpected endpoint: ' + endpoint);
    }
  } else {
    console.log('❌ Could not find AWS_ENDPOINT_URL_DYNAMODB in template-local.yaml');
  }
} catch (error) {
  console.log('❌ Could not read template-local.yaml:', error.message);
}

// Check if DynamoDB is running
const { execSync } = require('child_process');
try {
  const containers = execSync('docker ps --format "table {{.Names}}\t{{.Status}}"', { encoding: 'utf8' });
  
  if (containers.includes('gravyprompts-dynamodb-local')) {
    console.log('✅ DynamoDB Local is running');
  } else {
    console.log('❌ DynamoDB Local is not running');
    console.log('   Run: npm run dev:all');
  }
} catch (error) {
  console.log('⚠️  Could not check Docker containers');
}

console.log('\n📚 Documentation:');
console.log('   - SAM Local Lambda functions need: http://host.docker.internal:8000');
console.log('   - Docker Compose services use: http://dynamodb:8000');
console.log('   - Host machine uses: http://localhost:8000');
console.log('');