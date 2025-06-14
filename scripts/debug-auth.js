#!/usr/bin/env node

/**
 * Debug authentication state
 * Usage: npm run debug:auth
 */

const { CognitoIdentityProviderClient, ListUsersCommand } = require('@aws-sdk/client-cognito-identity-provider');

const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || 'us-east-1_bMHTxqM6e';

async function debugAuth() {
  console.log('\n🔍 Debugging Authentication State\n');
  
  console.log('1. Environment Variables:');
  console.log(`   NEXT_PUBLIC_COGNITO_USER_POOL_ID: ${process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || 'Not set (using default)'}`);
  console.log(`   NEXT_PUBLIC_COGNITO_CLIENT_ID: ${process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || 'Not set'}`);
  console.log(`   NEXT_PUBLIC_API_URL: ${process.env.NEXT_PUBLIC_API_URL || 'Not set'}\n`);

  console.log('2. Browser Debug Commands:');
  console.log('   Run these in your browser console when signed in:\n');
  console.log('   // Get current auth debug info');
  console.log('   await window.getAuthDebugInfo();\n');
  console.log('   // Clear all Amplify storage (logout)');
  console.log('   localStorage.clear();');
  console.log('   sessionStorage.clear();');
  console.log('   location.reload();\n');

  console.log('3. Common Issues & Solutions:');
  console.log('   - "Already signed in" error:');
  console.log('     → Clear browser storage (see commands above)');
  console.log('     → Check for multiple tabs/windows signed in');
  console.log('   - Navigation not updating:');
  console.log('     → Auth context may be stale');
  console.log('     → Try hard refresh (Cmd+Shift+R)\n');

  // Try to list some users if we have AWS credentials
  try {
    const client = new CognitoIdentityProviderClient({ region: 'us-east-1' });
    const command = new ListUsersCommand({
      UserPoolId: userPoolId,
      Limit: 5,
      AttributesToGet: ['email', 'sub']
    });
    
    console.log('4. Recent Users (requires AWS credentials):');
    const response = await client.send(command);
    response.Users?.forEach(user => {
      const email = user.Attributes?.find(a => a.Name === 'email')?.Value;
      const sub = user.Attributes?.find(a => a.Name === 'sub')?.Value;
      console.log(`   - ${email} (${sub?.substring(0, 8)}...)`);
    });
  } catch (error) {
    console.log('4. Could not fetch users (AWS credentials needed)');
  }

  console.log('\n✅ Debug info complete\n');
}

debugAuth().catch(console.error);