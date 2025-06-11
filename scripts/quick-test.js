// Quick test - paste this in browser console

const token = localStorage.getItem('CognitoIdentityServiceProvider.ss1j997tk4v02rplcgcv7erip.14b84498-b071-7069-7232-a868c488bbb7.idToken');
console.log('Token found:', !!token);
console.log('Token preview:', token ? token.substring(0, 50) + '...' : 'No token');

// Make test request
fetch('https://sg54tyu5dl.execute-api.us-east-1.amazonaws.com/production/templates', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    title: 'Test ' + Date.now(),
    content: '<p>Test</p>',
    tags: [],
    visibility: 'private'
  })
}).then(r => r.json()).then(data => {
  console.log('Response:', data);
}).catch(e => console.error('Error:', e));