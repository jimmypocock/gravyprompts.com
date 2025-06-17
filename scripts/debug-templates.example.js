/**
 * Debug template fetching
 * 
 * Before using:
 * 1. Copy this file to debug-templates.js
 * 2. Set the API_URL environment variable:
 *    export API_URL=https://your-api-gateway-url.execute-api.region.amazonaws.com/stage
 * 3. Run: node scripts/debug-templates.js
 */

const https = require('https');

const API_URL = process.env.API_URL;

if (!API_URL) {
  console.error('ERROR: API_URL environment variable is required');
  console.error('Example: export API_URL=https://your-api-gateway.execute-api.us-east-1.amazonaws.com/production');
  process.exit(1);
}

const makeRequest = (path) => {
  const url = new URL(path, API_URL);
  
  console.log('Requesting:', url.href);
  
  https.get(url, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('Status:', res.statusCode);
      console.log('Headers:', JSON.stringify(res.headers, null, 2));
      
      try {
        const parsed = JSON.parse(data);
        console.log('Response:', JSON.stringify(parsed, null, 2));
      } catch (e) {
        console.log('Raw response:', data);
      }
    });
  }).on('error', (err) => {
    console.error('Error:', err);
  });
};

// Test template list endpoint
makeRequest('/templates');