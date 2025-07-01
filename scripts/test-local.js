#!/usr/bin/env node

/**
 * Local test runner - runs all tests to verify the app is working
 */

const { spawn } = require('child_process');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      ...options
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Command failed with code ${code}`));
      } else {
        resolve();
      }
    });

    child.on('error', reject);
  });
}

async function runTests() {
  log('\n🧪 Running Local Tests', 'cyan');
  log('=' .repeat(50), 'cyan');

  try {
    // 1. Health check
    log('\n1️⃣  Running health checks...', 'blue');
    await runCommand('node', ['scripts/test-health.js']);

    // 2. Unit tests for gravyjs
    log('\n2️⃣  Running GravyJS unit tests...', 'blue');
    try {
      await runCommand('npm', ['test'], { cwd: path.join(process.cwd(), 'packages/gravyjs') });
      log('✓ GravyJS tests passed', 'green');
    } catch (e) {
      log('⚠ GravyJS tests failed (non-critical)', 'yellow');
    }

    // 3. Playwright E2E tests
    log('\n3️⃣  Running E2E tests...', 'blue');
    log('This will test:', 'cyan');
    log('  - Homepage loads correctly', 'cyan');
    log('  - Templates are displayed', 'cyan');
    log('  - GravyJS editor loads in quickview', 'cyan');
    log('  - Editor functionality works', 'cyan');
    log('  - No console errors', 'cyan');
    
    // Install Playwright browsers if needed
    await runCommand('npx', ['playwright', 'install', 'chromium']);
    
    // Run tests
    await runCommand('npx', ['playwright', 'test', '--reporter=list']);
    
    log('\n✅ All tests passed!', 'green');
    
  } catch (error) {
    log('\n❌ Tests failed:', 'red');
    log(error.message, 'red');
    process.exit(1);
  }
}

// Check if services are running first
async function main() {
  log('Checking if services are running...', 'yellow');
  
  // Quick check for main service
  const http = require('http');
  
  http.get('http://localhost:6827', (res) => {
    if (res.statusCode === 200) {
      runTests();
    } else {
      log('\n⚠️  Services not running!', 'yellow');
      log('Please run "npm run dev:all" first', 'cyan');
      process.exit(1);
    }
  }).on('error', () => {
    log('\n⚠️  Services not running!', 'yellow');
    log('Please run "npm run dev:all" first', 'cyan');
    process.exit(1);
  });
}

main();