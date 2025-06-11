// Comprehensive debug script
// Paste this in browser console and then try to save a template

(async function() {
  console.log('🔍 Starting comprehensive debug...\n');
  
  // 1. Check current page
  console.log('Current URL:', window.location.href);
  console.log('On editor page?', window.location.pathname.includes('editor'));
  
  // 2. Hook into ALL network activity
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.name.includes('templates') && entry.initiatorType === 'fetch') {
        console.log('📡 Network activity detected:', {
          name: entry.name,
          duration: entry.duration,
          transferSize: entry.transferSize,
          responseStatus: entry.responseStatus
        });
      }
    }
  });
  observer.observe({ entryTypes: ['resource'] });
  
  // 3. Override console.error to catch any errors
  const originalError = console.error;
  console.error = function(...args) {
    console.log('❌ Error caught:', ...args);
    originalError.apply(console, args);
  };
  
  // 4. Hook into XMLHttpRequest as well (in case it's using that)
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;
  
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._method = method;
    this._url = url;
    if (url.includes('templates')) {
      console.log('📡 XHR Request:', method, url);
    }
    return originalXHROpen.apply(this, [method, url, ...rest]);
  };
  
  XMLHttpRequest.prototype.send = function(body) {
    if (this._url && this._url.includes('templates')) {
      console.log('📡 XHR Body:', body);
      
      this.addEventListener('load', () => {
        console.log('📡 XHR Response:', this.status, this.responseText);
      });
      
      this.addEventListener('error', () => {
        console.log('❌ XHR Error');
      });
    }
    return originalXHRSend.apply(this, arguments);
  };
  
  // 5. Try to access the template API directly from the page context
  console.log('\n🔍 Looking for API instance...');
  
  // Check if there's a global reference
  if (window._templateApi) {
    console.log('Found global template API');
  }
  
  // 6. Monitor for any promise rejections
  window.addEventListener('unhandledrejection', event => {
    console.log('❌ Unhandled promise rejection:', event.reason);
    if (event.reason?.message?.includes('template') || event.reason?.message?.includes('401') || event.reason?.message?.includes('400')) {
      console.log('This might be the template creation error!');
      console.log('Full error:', event.reason);
    }
  });
  
  // 7. Also intercept fetch more aggressively
  const originalFetch = window.fetch;
  let fetchIntercepted = false;
  
  Object.defineProperty(window, 'fetch', {
    get() {
      return function(...args) {
        const [url, options = {}] = args;
        
        // Log all API calls
        if (typeof url === 'string' && url.includes('execute-api')) {
          fetchIntercepted = true;
          console.log('🚀 API Call Intercepted:');
          console.log('- URL:', url);
          console.log('- Method:', options.method || 'GET');
          console.log('- Headers:', options.headers);
          console.log('- Body:', options.body);
          
          // Log auth header specifically
          if (options.headers) {
            Object.entries(options.headers).forEach(([key, value]) => {
              if (key.toLowerCase() === 'authorization') {
                console.log('- Auth header:', value);
                console.log('  - Starts with Bearer?', value.startsWith('Bearer '));
                console.log('  - Length:', value.length);
              }
            });
          }
        }
        
        return originalFetch.apply(this, args).then(response => {
          if (typeof url === 'string' && url.includes('execute-api')) {
            console.log('📡 API Response:');
            console.log('- Status:', response.status);
            console.log('- OK?', response.ok);
            
            // Clone and log response
            const clone = response.clone();
            clone.text().then(text => {
              console.log('- Response body:', text);
              try {
                const json = JSON.parse(text);
                console.log('- Parsed response:', json);
              } catch (e) {
                // Not JSON
              }
            });
          }
          return response;
        }).catch(error => {
          if (typeof url === 'string' && url.includes('execute-api')) {
            console.log('❌ Fetch error:', error);
          }
          throw error;
        });
      };
    },
    configurable: true
  });
  
  console.log('\n✅ All interceptors installed');
  console.log('Fetch intercepted?', fetchIntercepted);
  console.log('\nNow try to save a template and watch for output above ☝️');
  
  // 8. Also log when buttons are clicked
  document.addEventListener('click', (e) => {
    const target = e.target;
    if (target.tagName === 'BUTTON' && (target.textContent.includes('Save') || target.textContent.includes('Create'))) {
      console.log('🖱️ Save/Create button clicked:', target.textContent);
    }
  }, true);
  
})();