#!/usr/bin/env node

/**
 * Comprehensive health check for all services
 * Run this to verify everything is working properly
 */

const http = require('http');
const https = require('https');
const { spawn } = require('child_process');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Services to check
const services = [
  {
    name: 'GravyPrompts App',
    url: 'http://localhost:6827',
    checkContent: (body) => body.includes('Gravy') || body.includes('Next.js')
  },
  {
    name: 'GravyJS Demo',
    url: 'http://localhost:5173',
    checkContent: (body) => body.includes('GravyJS') || body.includes('Vite')
  },
  {
    name: 'Local API',
    url: 'http://localhost:7429/templates',
    isJson: true,
    checkContent: (data) => data.templates && Array.isArray(data.templates)
  },
  {
    name: 'DynamoDB Admin',
    url: 'http://localhost:8001',
    checkContent: (body) => body.includes('DynamoDB')
  }
];

// Docker containers to check
const containers = [
  'gravyprompts-dynamodb-local',
  'gravyprompts-dynamodb-admin',
  'gravyprompts-localstack',
  'gravyprompts-redis'
];

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkUrl(service) {
  return new Promise((resolve) => {
    const protocol = service.url.startsWith('https') ? https : http;
    
    protocol.get(service.url, (res) => {
      let body = '';
      
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const success = res.statusCode === 200;
        let contentValid = true;
        
        if (success && service.checkContent) {
          try {
            const data = service.isJson ? JSON.parse(body) : body;
            contentValid = service.checkContent(data);
          } catch (e) {
            contentValid = false;
          }
        }
        
        resolve({
          name: service.name,
          url: service.url,
          status: res.statusCode,
          success: success && contentValid,
          message: success && contentValid ? 'OK' : `Failed (${res.statusCode})`
        });
      });
    }).on('error', (err) => {
      resolve({
        name: service.name,
        url: service.url,
        status: 0,
        success: false,
        message: `Error: ${err.message}`
      });
    });
  });
}

function checkDocker() {
  return new Promise((resolve) => {
    const docker = spawn('docker', ['ps', '--format', '{{.Names}}']);
    let output = '';
    
    docker.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    docker.on('close', (code) => {
      if (code !== 0) {
        resolve({ success: false, containers: [] });
        return;
      }
      
      const runningContainers = output.split('\n').filter(Boolean);
      const results = containers.map(container => ({
        name: container,
        running: runningContainers.includes(container)
      }));
      
      resolve({
        success: results.every(r => r.running),
        containers: results
      });
    });
  });
}

function checkProcesses() {
  return new Promise((resolve) => {
    const ps = spawn('ps', ['aux']);
    let output = '';
    
    ps.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    ps.on('close', () => {
      const processes = {
        'Next.js': /next-server|next dev/.test(output),
        'Vite': /vite/.test(output),
        'SAM Local': /sam local|aws-sam-cli/.test(output)
      };
      
      resolve(processes);
    });
  });
}

async function runHealthChecks() {
  log('\n🏥 Running Health Checks...', 'cyan');
  log('=' .repeat(50), 'cyan');
  
  // Check Docker containers
  log('\n📦 Docker Containers:', 'blue');
  const dockerStatus = await checkDocker();
  
  if (dockerStatus.success) {
    log('All containers running ✓', 'green');
  } else {
    dockerStatus.containers.forEach(container => {
      if (container.running) {
        log(`  ✓ ${container.name}`, 'green');
      } else {
        log(`  ✗ ${container.name}`, 'red');
      }
    });
  }
  
  // Check services
  log('\n🌐 Services:', 'blue');
  const serviceResults = await Promise.all(services.map(checkUrl));
  
  let allServicesOk = true;
  serviceResults.forEach(result => {
    if (result.success) {
      log(`  ✓ ${result.name} (${result.url})`, 'green');
    } else {
      log(`  ✗ ${result.name} - ${result.message}`, 'red');
      allServicesOk = false;
    }
  });
  
  // Check processes
  log('\n⚙️  Processes:', 'blue');
  const processes = await checkProcesses();
  
  Object.entries(processes).forEach(([name, running]) => {
    if (running) {
      log(`  ✓ ${name}`, 'green');
    } else {
      log(`  ✗ ${name}`, 'yellow');
    }
  });
  
  // Summary
  log('\n' + '=' .repeat(50), 'cyan');
  
  if (allServicesOk && dockerStatus.success) {
    log('✅ All systems operational!', 'green');
    log('\n📱 Access your apps:', 'blue');
    log('  - GravyPrompts: http://localhost:6827', 'cyan');
    log('  - GravyJS Demo: http://localhost:5173', 'cyan');
    log('  - API Docs: http://localhost:7429', 'cyan');
    log('  - DynamoDB Admin: http://localhost:8001', 'cyan');
  } else {
    log('❌ Some services are not running properly', 'red');
    log('\nTry running:', 'yellow');
    log('  npm run dev:all', 'cyan');
  }
  
  log('');
}

// Run the checks
runHealthChecks();