// Browser API Debug Script (SECURE VERSION)
// SECURITY: Uses environment variable for API URL
// Run this in browser console to test API connectivity

console.log("🚀 Starting API Debug (Secure Version)...");

// Configuration
const getApiUrl = () => {
  // Try to get from window object (if set by app)
  if (typeof window !== 'undefined' && window.ENV && window.ENV.NEXT_PUBLIC_API_URL) {
    return window.ENV.NEXT_PUBLIC_API_URL;
  }
  
  // Try to get from meta tag
  const metaTag = document.querySelector('meta[name="api-url"]');
  if (metaTag) {
    return metaTag.getAttribute('content');
  }
  
  // Ask user to provide it
  const apiUrl = prompt("Enter your API URL (e.g., https://your-api-id.execute-api.us-east-1.amazonaws.com/production):");
  return apiUrl;
};

const API_BASE_URL = getApiUrl();

if (!API_BASE_URL) {
  console.error("❌ API URL is required for debugging");
  throw new Error("API URL not provided");
}

console.log(`🔗 Using API: ${API_BASE_URL.replace(/\/[^\/]*$/, '/***')}`); // Mask for security

// Test endpoints
const endpoints = [
  { name: "Health Check", path: "/health", method: "GET", requiresAuth: false },
  { name: "Public Templates", path: "/templates?filter=public&limit=5", method: "GET", requiresAuth: false },
  { name: "My Templates", path: "/templates?filter=mine", method: "GET", requiresAuth: true },
  { name: "Create Template", path: "/templates", method: "POST", requiresAuth: true },
];

// Helper to get auth token
const getAuthToken = () => {
  const idTokenKey = Object.keys(localStorage).find((k) =>
    k.includes("idToken")
  );
  return idTokenKey ? localStorage.getItem(idTokenKey) : null;
};

// Helper to make API requests
const makeRequest = async (endpoint, body = null) => {
  const headers = {
    "Content-Type": "application/json",
  };

  const token = getAuthToken();
  if (endpoint.requiresAuth) {
    if (!token) {
      throw new Error("Authentication required but no token found");
    }
    headers.Authorization = `Bearer ${token}`;
  }

  const options = {
    method: endpoint.method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint.path}`, options);
  
  return {
    status: response.status,
    statusText: response.statusText,
    ok: response.ok,
    data: response.ok ? await response.json() : await response.text(),
    headers: Object.fromEntries(response.headers.entries()),
  };
};

// Run tests
(async () => {
  console.log("📊 Running API Tests...\n");

  for (const endpoint of endpoints) {
    console.log(`🧪 Testing: ${endpoint.name}`);
    
    try {
      let body = null;
      
      // Special handling for POST requests
      if (endpoint.method === "POST" && endpoint.path === "/templates") {
        body = {
          title: `Debug Test ${Date.now()}`,
          content: "Debug test template - will be deleted",
          tags: ["debug"],
          visibility: "private",
        };
      }

      const result = await makeRequest(endpoint, body);
      
      console.log(`   ✅ Status: ${result.status} ${result.statusText}`);
      
      if (result.ok) {
        if (typeof result.data === 'object') {
          console.log(`   📦 Data preview:`, Object.keys(result.data));
          
          // Log sample data (safely)
          if (result.data.templates && Array.isArray(result.data.templates)) {
            console.log(`   📋 Found ${result.data.templates.length} templates`);
          }
          
          // For created template, clean up
          if (endpoint.method === "POST" && result.data.templateId) {
            console.log(`   🧹 Cleaning up created template...`);
            try {
              await makeRequest({
                name: "Delete Test Template",
                path: `/templates/${result.data.templateId}`,
                method: "DELETE",
                requiresAuth: true,
              });
              console.log(`   ✅ Cleanup successful`);
            } catch (cleanupError) {
              console.log(`   ⚠️ Cleanup failed:`, cleanupError.message);
            }
          }
        } else {
          console.log(`   📄 Response:`, result.data.substring(0, 100) + "...");
        }
        
        // Check CORS headers
        const corsHeaders = Object.keys(result.headers)
          .filter(h => h.toLowerCase().includes('access-control'))
          .reduce((acc, h) => ({ ...acc, [h]: result.headers[h] }), {});
        
        if (Object.keys(corsHeaders).length > 0) {
          console.log(`   🌐 CORS Headers:`, corsHeaders);
        }
      } else {
        console.log(`   ❌ Error:`, result.data);
      }
      
    } catch (error) {
      console.log(`   💥 Exception:`, error.message);
    }
    
    console.log(""); // Empty line for readability
  }

  console.log("🏁 API Debug Complete!");
  
  // Summary
  const token = getAuthToken();
  console.log("\n📋 Summary:");
  console.log(`   API URL: ${API_BASE_URL.replace(/\/[^\/]*$/, '/***')}`);
  console.log(`   Auth Token: ${token ? '✅ Found' : '❌ Not found'}`);
  console.log(`   Time: ${new Date().toISOString()}`);
})();