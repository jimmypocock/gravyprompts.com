// Fixed debug script for browser console
// Copy and paste this entire script into your browser console on gravyprompts.com

(async function debugAPI() {
  console.log('🔍 Starting API Debug...\n');
  
  // Check if we're on the right domain
  if (!window.location.hostname.includes('gravyprompts')) {
    console.error('❌ Please run this on gravyprompts.com');
    return;
  }
  
  console.log('📋 Looking for Cognito tokens...');
  
  // Find the idToken directly
  let idToken = null;
  let accessToken = null;
  
  // Look for Cognito tokens in localStorage
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.includes('idToken')) {
      idToken = localStorage.getItem(key);
      console.log('✅ Found idToken key:', key);
      console.log('Token preview:', idToken.substring(0, 50) + '...');
    }
    if (key && key.includes('accessToken')) {
      accessToken = localStorage.getItem(key);
      console.log('✅ Found accessToken key:', key);
    }
  }
  
  if (!idToken) {
    console.error('❌ No idToken found. Please make sure you are logged in.');
    return;
  }
  
  // Decode token to check expiry (without verification)
  try {
    const tokenParts = idToken.split('.');
    const payload = JSON.parse(atob(tokenParts[1]));
    console.log('\n📄 Token details:');
    console.log('- Email:', payload.email);
    console.log('- User ID:', payload.sub);
    console.log('- Issued at:', new Date(payload.iat * 1000).toLocaleString());
    console.log('- Expires at:', new Date(payload.exp * 1000).toLocaleString());
    console.log('- Token expired?', new Date() > new Date(payload.exp * 1000));
  } catch (e) {
    console.error('Could not decode token:', e);
  }
  
  // Test the API
  console.log('\n🚀 Testing API with your token...');
  
  const testPayload = {
    title: 'Debug Test Template ' + new Date().toISOString(),
    content: '<p>Test content from debug script</p>',
    tags: ['debug', 'test'],
    visibility: 'private'
  };
  
  console.log('Request payload:', testPayload);
  
  try {
    const response = await fetch('https://sg54tyu5dl.execute-api.us-east-1.amazonaws.com/production/templates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify(testPayload)
    });
    
    console.log('\n📡 Response:');
    console.log('- Status:', response.status, response.statusText);
    console.log('- Headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('- Raw response:', responseText);
    
    try {
      const data = JSON.parse(responseText);
      console.log('- Parsed response:', data);
      
      if (response.ok) {
        console.log('\n✅ Success! Template created:');
        console.log('- Template ID:', data.template?.templateId);
        console.log('- Title:', data.template?.title);
      } else {
        console.error('\n❌ API Error:');
        console.error('- Error:', data.error || data.message);
        if (data.details) {
          console.error('- Details:', data.details);
        }
      }
    } catch (e) {
      console.error('Could not parse response as JSON');
    }
  } catch (error) {
    console.error('❌ Request failed:', error);
  }
  
  // Generate curl command for manual testing
  console.log('\n📋 Test manually with curl:');
  const curlCommand = `curl -X POST "https://sg54tyu5dl.execute-api.us-east-1.amazonaws.com/production/templates" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${idToken}" \\
  -d '${JSON.stringify(testPayload)}' \\
  -v`;
  
  console.log(curlCommand);
  
  // Also test what the app is sending
  console.log('\n🔍 Checking what the app sends...');
  console.log('Try creating a template in the UI and check the Network tab for:');
  console.log('1. The Authorization header format');
  console.log('2. The request payload');
  console.log('3. Any other headers');
  
  console.log('\n✅ Debug complete');
})();