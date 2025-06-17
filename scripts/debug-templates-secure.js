// Debug template visibility and API (SECURE VERSION)
// Run this in browser console
// SECURITY: Uses environment variable for API URL

(async function debugTemplates() {
  console.log("🔍 Debugging template system...\n");

  // Get API URL from environment or prompt user
  let API_URL = null;
  
  // Try to get from window object (if set by app)
  if (typeof window !== 'undefined' && window.ENV && window.ENV.NEXT_PUBLIC_API_URL) {
    API_URL = window.ENV.NEXT_PUBLIC_API_URL;
  }
  
  // If not found, ask user to provide it
  if (!API_URL) {
    API_URL = prompt("Enter your API URL (e.g., https://your-api-id.execute-api.us-east-1.amazonaws.com/production):");
    if (!API_URL) {
      console.error("❌ API URL is required for debugging");
      return;
    }
  }

  console.log(`🔗 Using API URL: ${API_URL.replace(/\/[^\/]*$/, '/***')}`); // Mask last part for security

  // Get the auth token
  const idTokenKey = Object.keys(localStorage).find((k) =>
    k.includes("idToken"),
  );
  const token = idTokenKey ? localStorage.getItem(idTokenKey) : null;

  if (!token) {
    console.error("❌ No auth token found. Please log in.");
    return;
  }

  console.log("✅ Auth token found\n");

  // 1. List all templates (public)
  console.log("📋 1. Fetching PUBLIC templates...");
  try {
    const response = await fetch(`${API_URL}/templates?filter=public`, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`   Found ${data.templates?.length || 0} public templates`);

    if (data.templates?.length > 0) {
      console.log("   Sample public template:", {
        id: data.templates[0].templateId,
        title: data.templates[0].title,
        visibility: data.templates[0].visibility,
        status: data.templates[0].status,
        views: data.templates[0].views,
      });
    }
  } catch (error) {
    console.error("❌ Error fetching public templates:", error.message);
  }

  console.log("\n" + "=".repeat(50) + "\n");

  // 2. List MY templates (authenticated)
  console.log("👤 2. Fetching MY templates...");
  try {
    const response = await fetch(`${API_URL}/templates?filter=mine`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`   Found ${data.templates?.length || 0} of my templates`);

    if (data.templates?.length > 0) {
      console.log("   My templates breakdown:");
      const breakdown = data.templates.reduce((acc, t) => {
        acc[t.visibility] = (acc[t.visibility] || 0) + 1;
        return acc;
      }, {});
      console.log("   ", breakdown);

      console.log("   Sample template:", {
        id: data.templates[0].templateId,
        title: data.templates[0].title,
        visibility: data.templates[0].visibility,
        status: data.templates[0].status,
      });
    }
  } catch (error) {
    console.error("❌ Error fetching my templates:", error.message);
  }

  console.log("\n" + "=".repeat(50) + "\n");

  // 3. Test creating a template
  console.log("✏️ 3. Testing template creation...");
  try {
    const testTemplate = {
      title: `Debug Test Template ${Date.now()}`,
      content: "This is a test template created by the debug script.",
      tags: ["debug", "test"],
      visibility: "private",
    };

    const response = await fetch(`${API_URL}/templates`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(testTemplate),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log("   ✅ Template created successfully:", {
      id: data.templateId,
      title: data.title,
      visibility: data.visibility,
      status: data.status,
    });

    // Clean up - delete the test template
    console.log("   🧹 Cleaning up test template...");
    const deleteResponse = await fetch(`${API_URL}/templates/${data.templateId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (deleteResponse.ok) {
      console.log("   ✅ Test template cleaned up");
    } else {
      console.log("   ⚠️ Could not clean up test template - you may need to delete it manually");
    }
  } catch (error) {
    console.error("❌ Error testing template creation:", error.message);
  }

  console.log("\n🏁 Debug complete!");
})();