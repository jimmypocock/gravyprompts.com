// Debug template visibility and API
// Run this in browser console

(async function debugTemplates() {
  console.log('🔍 Debugging template system...\n');
  
  // Get the auth token
  const idTokenKey = Object.keys(localStorage).find(k => k.includes('idToken'));
  const token = idTokenKey ? localStorage.getItem(idTokenKey) : null;
  
  if (!token) {
    console.error('❌ No auth token found. Please log in.');
    return;
  }
  
  console.log('✅ Auth token found\n');
  
  const API_URL = 'https://sg54tyu5dl.execute-api.us-east-1.amazonaws.com/production';
  
  // 1. List all templates (public)
  console.log('📋 1. Fetching PUBLIC templates...');
  try {
    const response = await fetch(`${API_URL}/templates?filter=public`, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    const data = await response.json();
    console.log('Public templates response:', data);
    console.log('Count:', data.count || 0);
    if (data.items && data.items.length > 0) {
      console.log('First template:', data.items[0]);
    }
  } catch (error) {
    console.error('Error fetching public templates:', error);
  }
  
  // 2. List user's own templates
  console.log('\n📋 2. Fetching YOUR templates...');
  try {
    const response = await fetch(`${API_URL}/templates?filter=mine`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await response.json();
    console.log('Your templates response:', data);
    console.log('Count:', data.count || 0);
    if (data.items && data.items.length > 0) {
      console.log('Templates:', data.items.map(t => ({
        id: t.templateId,
        title: t.title,
        visibility: t.visibility,
        moderationStatus: t.moderationStatus,
        createdAt: t.createdAt
      })));
    }
  } catch (error) {
    console.error('Error fetching your templates:', error);
  }
  
  // 3. List ALL templates (if allowed)
  console.log('\n📋 3. Fetching ALL templates...');
  try {
    const response = await fetch(`${API_URL}/templates?filter=all`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await response.json();
    console.log('All templates response:', data);
    console.log('Count:', data.count || 0);
  } catch (error) {
    console.error('Error fetching all templates:', error);
  }
  
  // 4. Create a test template and check its status
  console.log('\n🧪 4. Creating test template...');
  try {
    const testTemplate = {
      title: 'Debug Test ' + new Date().toISOString(),
      content: '<p>Test template for debugging</p>',
      tags: ['debug'],
      visibility: 'public'  // Create as public to test moderation
    };
    
    const createResponse = await fetch(`${API_URL}/templates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(testTemplate)
    });
    
    const createData = await createResponse.json();
    console.log('Create response:', createData);
    
    if (createData.template) {
      const templateId = createData.template.templateId;
      console.log('Created template ID:', templateId);
      console.log('Moderation status:', createData.template.moderationStatus);
      
      // Try to fetch it back
      console.log('\n📋 5. Fetching created template back...');
      const getResponse = await fetch(`${API_URL}/templates/${templateId}`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (getResponse.ok) {
        const getData = await getResponse.json();
        console.log('Retrieved template:', {
          id: getData.templateId,
          title: getData.title,
          visibility: getData.visibility,
          moderationStatus: getData.moderationStatus,
          isOwner: getData.isOwner
        });
      } else {
        console.error('Failed to retrieve template:', getResponse.status, await getResponse.text());
      }
    }
  } catch (error) {
    console.error('Error in test template creation:', error);
  }
  
  // 6. Check what the UI is showing vs API
  console.log('\n🖥️ 6. Checking UI state...');
  const templateElements = document.querySelectorAll('[href*="/templates/"]');
  console.log('Template links found in UI:', templateElements.length);
  
  const noTemplatesMessage = Array.from(document.querySelectorAll('*')).find(el => 
    el.textContent?.includes('No templates found') || 
    el.textContent?.includes('0 templates available')
  );
  
  if (noTemplatesMessage) {
    console.log('UI shows no templates message:', noTemplatesMessage.textContent);
  }
  
  console.log('\n✅ Debug complete');
  console.log('\n📊 Summary:');
  console.log('- Check if templates are being created (they should show in "Your templates")');
  console.log('- Check moderation status (pending/approved/rejected)');
  console.log('- Public templates need moderationStatus = "approved" to show');
  console.log('- The "Access denied" error might be because the template is still pending moderation');
})();