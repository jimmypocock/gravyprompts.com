// Debug script for browser console
// Copy and paste this entire script into your browser console on gravyprompts.com

(async function debugAPI() {
  console.log('🔍 Starting API Debug...\n');
  
  // Check if we're on the right domain
  if (!window.location.hostname.includes('gravyprompts')) {
    console.error('❌ Please run this on gravyprompts.com');
    return;
  }
  
  // Find the auth context by looking for React fiber
  const findReactFiber = (element) => {
    const key = Object.keys(element).find(key => key.startsWith('__reactFiber'));
    return element[key];
  };
  
  // Try to get auth info from React context
  let authHook = null;
  try {
    // Find any element that might have the auth context
    const appElement = document.getElementById('__next') || document.querySelector('[data-reactroot]');
    if (appElement) {
      const fiber = findReactFiber(appElement);
      // This is a simplified approach - in practice you'd need to traverse the fiber tree
      console.log('📦 React fiber found:', !!fiber);
    }
  } catch (e) {
    console.log('⚠️ Could not access React internals directly');
  }
  
  // Try the simpler approach - check localStorage/sessionStorage
  console.log('\n📋 Checking Storage:');
  console.log('localStorage keys:', Object.keys(localStorage).filter(k => k.includes('aws') || k.includes('cognito')));
  console.log('sessionStorage keys:', Object.keys(sessionStorage).filter(k => k.includes('aws') || k.includes('cognito')));
  
  // Check for Amplify
  if (typeof window.aws !== 'undefined' || typeof window.Amplify !== 'undefined') {
    console.log('✅ AWS Amplify detected');
  } else {
    console.log('❌ AWS Amplify not detected in window');
  }
  
  // Try to make a test API call
  console.log('\n🔬 Testing API directly:');
  
  // First, try without auth
  try {
    const response = await fetch('https://sg54tyu5dl.execute-api.us-east-1.amazonaws.com/production/templates', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log('GET /templates (no auth):', response.status, response.statusText);
    if (!response.ok) {
      const data = await response.json();
      console.log('Response:', data);
    }
  } catch (error) {
    console.error('GET request failed:', error);
  }
  
  // Now let's try to find auth token from storage
  console.log('\n🔐 Looking for auth tokens in storage...');
  
  const findTokenInStorage = () => {
    // Check all storage items for potential tokens
    const checkStorage = (storage, name) => {
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && (key.includes('idToken') || key.includes('accessToken') || key.includes('CognitoIdentityServiceProvider'))) {
          try {
            const value = storage.getItem(key);
            console.log(`Found in ${name} - ${key}:`, value ? value.substring(0, 50) + '...' : 'empty');
            
            // Try to parse if it's JSON
            if (value && value.startsWith('{')) {
              const parsed = JSON.parse(value);
              if (parsed.idToken || parsed.IdToken) {
                return parsed.idToken || parsed.IdToken;
              }
            }
          } catch (e) {
            // Not JSON, might be the token directly
            if (key.includes('idToken')) {
              return storage.getItem(key);
            }
          }
        }
      }
      return null;
    };
    
    let token = checkStorage(localStorage, 'localStorage');
    if (!token) {
      token = checkStorage(sessionStorage, 'sessionStorage');
    }
    
    return token;
  };
  
  const token = findTokenInStorage();
  
  if (token) {
    console.log('\n✅ Found potential auth token!');
    console.log('Token preview:', token.substring(0, 50) + '...');
    
    // Test with the token
    console.log('\n🚀 Testing authenticated API call...');
    try {
      const response = await fetch('https://sg54tyu5dl.execute-api.us-east-1.amazonaws.com/production/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: 'Debug Test Template',
          content: '<p>Test content from debug script</p>',
          tags: ['debug', 'test'],
          visibility: 'private'
        })
      });
      
      console.log('POST /templates response:', response.status, response.statusText);
      const data = await response.json();
      console.log('Response data:', data);
      
      if (response.ok) {
        console.log('✅ Template created successfully!');
        console.log('Template ID:', data.template?.templateId);
      } else {
        console.error('❌ API Error:', data);
        if (data.details) {
          console.error('Validation details:', data.details);
        }
      }
    } catch (error) {
      console.error('❌ Request failed:', error);
    }
    
    // Generate curl command
    console.log('\n📋 Test with curl:');
    console.log(`curl -X POST "https://sg54tyu5dl.execute-api.us-east-1.amazonaws.com/production/templates" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${token}" \\
  -d '{"title":"Test Template","content":"<p>Test content</p>","tags":["test"],"visibility":"private"}'`);
  } else {
    console.log('\n❌ No auth token found in storage');
    console.log('Please make sure you are logged in');
  }
  
  console.log('\n✅ Debug complete');
})();