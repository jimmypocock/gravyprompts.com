#!/usr/bin/env node

const { execSync } = require('child_process');

// Check if we're in a CI/production environment
const isProduction = process.env.CI || process.env.AMPLIFY_APP_ID || process.env.NODE_ENV === 'production';

// Skip if we're not in production
if (!isProduction) {
  console.log('💻 Local development - using workspace GravyJS');
  process.exit(0);
}

console.log('🏭 Production environment detected - setting up GravyJS from GitHub');

try {
  // Check if gravyjs exists and is not a symlink
  const gravyjsPath = require.resolve('gravyjs/package.json');
  console.log('📦 GravyJS is already installed at:', gravyjsPath);
} catch (error) {
  // GravyJS not found or is a symlink, install from GitHub
  console.log('📥 Installing GravyJS from GitHub...');
  
  try {
    execSync('npm install github:jimmypocock/GravyJS --no-save', { stdio: 'inherit' });
    console.log('✅ GravyJS installed from GitHub successfully');
  } catch (installError) {
    console.error('❌ Failed to install GravyJS:', installError.message);
    process.exit(1);
  }
}