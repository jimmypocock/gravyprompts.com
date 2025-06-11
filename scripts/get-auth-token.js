// Script to get auth token from browser console
// Run this in the browser console on gravyprompts.com while logged in

async function getAuthToken() {
  try {
    // Check if user is logged in
    if (!window.currentUser) {
      console.error('Not logged in! Please log in first.');
      return;
    }
    
    // Get the ID token
    const token = await window.currentUser.getIdToken();
    
    console.log('Your auth token (valid for 1 hour):');
    console.log('=====================================');
    console.log(token);
    console.log('=====================================');
    
    // Create test command
    const testCommand = `curl -X POST "https://sg54tyu5dl.execute-api.us-east-1.amazonaws.com/production/templates" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${token}" \\
  -d '{"title":"Test Template","content":"<p>Test content</p>","tags":["test"],"visibility":"private"}'`;
    
    console.log('\nTest command (copy and run in terminal):');
    console.log('=========================================');
    console.log(testCommand);
    
    // Also test the token directly from browser
    console.log('\nTesting token with fetch...');
    try {
      const response = await fetch('https://sg54tyu5dl.execute-api.us-east-1.amazonaws.com/production/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: 'Browser Test',
          content: '<p>Test from browser</p>',
          tags: ['test'],
          visibility: 'private'
        })
      });
      
      const data = await response.json();
      console.log('Response status:', response.status);
      console.log('Response data:', data);
      
      if (!response.ok) {
        console.error('API Error:', data);
      }
    } catch (error) {
      console.error('Fetch error:', error);
    }
    
  } catch (error) {
    console.error('Error getting token:', error);
  }
}

// Run the function
getAuthToken();