// Debug the actual create template flow
// Run this in browser console while on the editor page

(async function() {
  console.log('🔍 Debugging template creation...\n');
  
  // Hook into fetch to see what's being sent
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const [url, options] = args;
    
    if (url.includes('/templates') && options?.method === 'POST') {
      console.log('🚀 Intercepted template creation request:');
      console.log('URL:', url);
      console.log('Method:', options.method);
      console.log('Headers:', options.headers);
      console.log('Body:', options.body);
      
      try {
        const body = JSON.parse(options.body);
        console.log('Parsed body:', body);
      } catch (e) {
        console.log('Could not parse body');
      }
      
      // Check the auth header specifically
      const authHeader = options.headers?.['Authorization'] || options.headers?.['authorization'];
      console.log('Auth header:', authHeader);
      console.log('Auth header starts with Bearer?', authHeader?.startsWith('Bearer '));
    }
    
    // Call the original fetch
    const response = await originalFetch.apply(this, args);
    
    if (url.includes('/templates') && options?.method === 'POST') {
      console.log('📡 Response received:');
      console.log('Status:', response.status);
      console.log('Status text:', response.statusText);
      
      // Clone response to read it without consuming
      const clonedResponse = response.clone();
      try {
        const data = await clonedResponse.json();
        console.log('Response data:', data);
      } catch (e) {
        console.log('Could not parse response');
      }
    }
    
    return response;
  };
  
  console.log('✅ Fetch interceptor installed');
  console.log('Now try to create a template in the UI and watch the console output');
  
  // Also let's check if the auth hook is working
  console.log('\n🔐 Checking auth setup...');
  
  // Try to find the React auth context
  if (window.React && window.React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED) {
    console.log('React internals available');
  }
  
  // Check if we can access the auth token getter
  console.log('\n📝 Instructions:');
  console.log('1. Go to the editor page if not already there');
  console.log('2. Fill in a title and some content');
  console.log('3. Click Save Template');
  console.log('4. Watch this console for the intercepted request details');
  
})();