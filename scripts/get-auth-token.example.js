/**
 * Get authentication token for API testing
 * 
 * Before using:
 * 1. Copy this file to get-auth-token.js
 * 2. Set environment variables:
 *    export COGNITO_USER_POOL_ID=your-user-pool-id
 *    export COGNITO_CLIENT_ID=your-client-id
 *    export TEST_USERNAME=your-test-username
 *    export TEST_PASSWORD=your-test-password
 * 3. Run: node scripts/get-auth-token.js
 */

const AWS = require('aws-sdk');

// Get configuration from environment variables
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;
const CLIENT_ID = process.env.COGNITO_CLIENT_ID;
const USERNAME = process.env.TEST_USERNAME;
const PASSWORD = process.env.TEST_PASSWORD;

if (!USER_POOL_ID || !CLIENT_ID || !USERNAME || !PASSWORD) {
  console.error('ERROR: Required environment variables missing');
  console.error('Required: COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID, TEST_USERNAME, TEST_PASSWORD');
  process.exit(1);
}

const cognito = new AWS.CognitoIdentityServiceProvider({
  region: 'us-east-1'
});

async function getAuthToken() {
  try {
    const params = {
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: CLIENT_ID,
      AuthParameters: {
        USERNAME: USERNAME,
        PASSWORD: PASSWORD
      }
    };

    const result = await cognito.initiateAuth(params).promise();
    
    if (result.AuthenticationResult) {
      console.log('Access Token:', result.AuthenticationResult.AccessToken);
      console.log('\nID Token:', result.AuthenticationResult.IdToken);
      console.log('\nRefresh Token:', result.AuthenticationResult.RefreshToken);
      
      // Decode ID token to see user info
      const idToken = result.AuthenticationResult.IdToken;
      const payload = idToken.split('.')[1];
      const decoded = JSON.parse(Buffer.from(payload, 'base64').toString());
      console.log('\nDecoded ID Token:', JSON.stringify(decoded, null, 2));
    }
  } catch (error) {
    console.error('Authentication failed:', error.message);
  }
}

getAuthToken();