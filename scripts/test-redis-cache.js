#!/usr/bin/env node

/**
 * Test Redis caching performance in local development
 * 
 * This script tests the Redis cache implementation and measures
 * performance improvements for local development.
 */

const axios = require('axios');
const colors = require('colors/safe');

const API_URL = 'http://localhost:7429';

async function testEndpoint(name, url, iterations = 5) {
  console.log(colors.cyan(`\n📊 Testing ${name}...`));
  
  const times = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    try {
      await axios.get(url);
      const duration = Date.now() - start;
      times.push(duration);
      
      if (i === 0) {
        console.log(`  ❄️  Cold request: ${duration}ms`);
      } else {
        console.log(`  🔥 Warm request ${i}: ${duration}ms`);
      }
    } catch (error) {
      console.error(colors.red(`  ❌ Error: ${error.message}`));
      return;
    }
  }
  
  // Calculate statistics
  const coldTime = times[0];
  const warmTimes = times.slice(1);
  const avgWarm = warmTimes.reduce((a, b) => a + b, 0) / warmTimes.length;
  const improvement = ((coldTime - avgWarm) / coldTime * 100).toFixed(1);
  
  console.log(colors.green(`\n  📈 Results:`));
  console.log(`     • First request: ${coldTime}ms`);
  console.log(`     • Average cached: ${avgWarm.toFixed(0)}ms`);
  console.log(`     • Performance improvement: ${improvement}%`);
  
  return { name, coldTime, avgWarm, improvement };
}

async function checkRedisConnection() {
  console.log(colors.yellow('\n🔍 Checking Redis connection...'));
  
  try {
    const Redis = require('ioredis');
    const redis = new Redis({
      host: 'localhost',
      port: 6379,
    });
    
    await redis.ping();
    console.log(colors.green('✅ Redis is connected and working!'));
    
    const info = await redis.info('stats');
    const keyCount = await redis.dbsize();
    console.log(`   • Total keys in cache: ${keyCount}`);
    
    await redis.quit();
    return true;
  } catch (error) {
    console.error(colors.red('❌ Redis connection failed:'), error.message);
    return false;
  }
}

async function main() {
  console.log(colors.cyan.bold('\n🚀 Redis Cache Performance Test\n'));
  
  // Check if API is running
  try {
    await axios.get(`${API_URL}/health`);
  } catch (error) {
    console.error(colors.red('\n❌ API is not running at http://localhost:7429'));
    console.log(colors.yellow('\n💡 Start the local environment with: npm run dev:all\n'));
    process.exit(1);
  }
  
  // Check Redis connection
  const redisConnected = await checkRedisConnection();
  if (!redisConnected) {
    console.log(colors.yellow('\n⚠️  Redis is not running. Cache will use in-memory fallback.\n'));
  }
  
  // Test different endpoints
  const results = [];
  
  // Test template listing
  results.push(await testEndpoint(
    'Template Listing (Public)',
    `${API_URL}/templates?filter=public&limit=20`
  ));
  
  // Test popular templates
  results.push(await testEndpoint(
    'Popular Templates',
    `${API_URL}/templates?filter=popular&limit=10`
  ));
  
  // Get a template ID for testing individual template endpoint
  try {
    const response = await axios.get(`${API_URL}/templates?filter=public&limit=1`);
    if (response.data.items && response.data.items.length > 0) {
      const templateId = response.data.items[0].templateId;
      
      results.push(await testEndpoint(
        'Individual Template',
        `${API_URL}/templates/${templateId}`
      ));
    }
  } catch (error) {
    console.log(colors.yellow('\n⚠️  Could not test individual template endpoint\n'));
  }
  
  // Summary
  console.log(colors.cyan.bold('\n\n📊 Performance Summary\n'));
  console.log(colors.white('┌─────────────────────────┬────────────┬─────────────┬──────────────┐'));
  console.log(colors.white('│ Endpoint                │ First (ms) │ Cached (ms) │ Improvement  │'));
  console.log(colors.white('├─────────────────────────┼────────────┼─────────────┼──────────────┤'));
  
  results.forEach(result => {
    if (result) {
      const name = result.name.padEnd(23);
      const cold = result.coldTime.toString().padStart(10);
      const warm = result.avgWarm.toFixed(0).padStart(11);
      const imp = (result.improvement + '%').padStart(12);
      console.log(`│ ${name} │ ${cold} │ ${warm} │ ${imp} │`);
    }
  });
  
  console.log(colors.white('└─────────────────────────┴────────────┴─────────────┴──────────────┘'));
  
  if (redisConnected) {
    console.log(colors.green('\n✅ Redis caching is working! Your local development is now fast! 🚀\n'));
  } else {
    console.log(colors.yellow('\n⚠️  Using in-memory cache. Install Redis for persistent caching.\n'));
  }
}

// Run the test
main().catch(console.error);