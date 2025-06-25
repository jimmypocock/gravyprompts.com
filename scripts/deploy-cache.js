#!/usr/bin/env node

/**
 * Deploy the CloudFront cache stack for API performance optimization
 * 
 * This script deploys a CloudFront distribution that caches API responses,
 * significantly improving performance and reducing Lambda invocations.
 * 
 * Usage:
 *   npm run deploy:cache
 * 
 * What this does:
 * - Creates a CloudFront distribution in front of your API Gateway
 * - Caches template listings for 10 minutes
 * - Caches individual templates for 5 minutes
 * - Compresses responses with gzip/brotli
 * - Costs approximately $0.01-0.10/day for moderate traffic
 * 
 * Prerequisites:
 * - API stack must be deployed first
 * - AWS credentials configured
 */

const { execSync } = require('child_process');
const colors = require('colors/safe');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env file
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

// Get AWS profile from environment
const AWS_PROFILE = process.env.AWS_PROFILE || 'default';
console.log(colors.blue(`Using AWS Profile: ${AWS_PROFILE}`));

console.log(colors.cyan('\n🚀 Deploying CloudFront Cache Stack...\n'));

console.log(colors.yellow('This will:'));
console.log('  ✓ Create a CloudFront distribution for API caching');
console.log('  ✓ Configure cache policies for different endpoints');
console.log('  ✓ Enable response compression');
console.log('  ✓ Reduce API response times by 80-90%\n');

console.log(colors.green('Estimated costs:'));
console.log('  • CloudFront: ~$0.085/GB transfer');
console.log('  • Requests: ~$0.0075 per 10,000 requests');
console.log('  • Total: < $5/month for moderate traffic\n');

// Check if user wants to proceed
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});

readline.question(colors.yellow('Deploy cache stack? (y/N): '), (answer) => {
  readline.close();
  
  if (answer.toLowerCase() !== 'y') {
    console.log(colors.red('\n❌ Deployment cancelled\n'));
    process.exit(0);
  }

  try {
    console.log(colors.cyan('\n📦 Building CDK app...\n'));
    execSync('npm run build', { 
      stdio: 'inherit',
      cwd: './cdk'
    });

    console.log(colors.cyan('\n🚀 Deploying cache stack...\n'));
    
    // Get email from environment or use a placeholder
    const alertEmail = process.env.BUDGET_ALERT_EMAIL || 'admin@gravyprompts.com';
    
    // First, get the stack prefix
    const stackList = execSync(`npx cdk list --profile ${AWS_PROFILE}`, { 
      cwd: './cdk',
      env: { ...process.env, AWS_PROFILE }
    }).toString();
    const stackPrefix = stackList.split('-')[0].trim();
    
    execSync(`npx cdk deploy ${stackPrefix}-Cache --require-approval never --context alertEmail=${alertEmail} --profile ${AWS_PROFILE}`, {
      stdio: 'inherit',
      cwd: './cdk',
      env: { ...process.env, AWS_PROFILE }
    });

    console.log(colors.green('\n✅ Cache stack deployed successfully!\n'));
    console.log(colors.yellow('Next steps:'));
    console.log('1. The CloudFront URL will be displayed above');
    console.log('2. Update your frontend to use the CloudFront URL');
    console.log('3. Monitor performance improvements in CloudWatch\n');
    
    console.log(colors.cyan('To get the CloudFront URL again:'));
    console.log('  npm run status:cache\n');

  } catch (error) {
    console.error(colors.red('\n❌ Deployment failed:\n'));
    console.error(error.message);
    process.exit(1);
  }
});