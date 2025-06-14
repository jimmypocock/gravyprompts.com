const { CognitoIdentityProviderClient, GetUserCommand } = require('@aws-sdk/client-cognito-identity-provider');

const cognitoClient = new CognitoIdentityProviderClient({});

/**
 * Extract claims from API Gateway authorizer context
 * @param {Object} event - Lambda event object
 * @returns {Object|null} User claims if found
 */
function getClaimsFromAuthorizer(event) {
  // Standard API Gateway + Cognito Authorizer
  if (event.requestContext?.authorizer?.claims) {
    return event.requestContext.authorizer.claims;
  }
  
  // API Gateway v2 format
  if (event.requestContext?.authorizer?.jwt?.claims) {
    return event.requestContext.authorizer.jwt.claims;
  }
  
  return null;
}

/**
 * Extract and decode JWT token from Authorization header
 * @param {Object} headers - Request headers
 * @returns {string|null} JWT token if found
 */
function extractBearerToken(headers) {
  const authHeader = headers?.Authorization || headers?.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

/**
 * Decode JWT payload without verification (for local development)
 * WARNING: This should only be used in local development with SAM Local
 * @param {string} token - JWT token
 * @returns {Object|null} Decoded payload
 */
function decodeJwtPayload(token) {
  // SECURITY: Only allow JWT decoding in local development
  // This prevents any possibility of bypassing authentication in production
  if (!process.env.AWS_SAM_LOCAL) {
    console.error('SECURITY: Attempted to decode JWT outside of SAM Local environment');
    return null;
  }
  
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.error('Invalid JWT format');
      return null;
    }
    
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    return payload;
  } catch (error) {
    console.error('Error decoding JWT:', error);
    return null;
  }
}

/**
 * Extract user claims from JWT payload
 * @param {Object} payload - Decoded JWT payload
 * @returns {Object} User claims
 */
function extractUserClaims(payload) {
  return {
    sub: payload.sub,
    email: payload.email,
    name: payload.name,
    email_verified: payload.email_verified,
    username: payload['cognito:username']
  };
}

/**
 * Get user information from Lambda event
 * @param {Object} event - Lambda event object
 * @returns {Object|null} User information
 */
async function getUserFromEvent(event) {
  console.log('Getting user from event');
  
  // First, check if claims are already available from authorizer
  const authorizerClaims = getClaimsFromAuthorizer(event);
  if (authorizerClaims) {
    console.log('Found user in authorizer context');
    return authorizerClaims;
  }
  
  // If not, try to extract from bearer token (needed for SAM Local)
  // SECURITY: This path should ONLY be accessible in local development
  if (!process.env.AWS_SAM_LOCAL) {
    console.error('SECURITY: No authorizer claims found in production environment');
    return null;
  }
  
  const token = extractBearerToken(event.headers);
  if (!token) {
    console.log('No bearer token found');
    return null;
  }
  
  console.log('Found bearer token in SAM Local, attempting to decode...');
  
  // Decode the JWT payload
  // Note: In production, API Gateway handles validation
  // This is primarily for local development with SAM Local
  const payload = decodeJwtPayload(token);
  if (!payload) {
    console.log('Failed to decode token');
    return null;
  }
  
  const userClaims = extractUserClaims(payload);
  console.log('Decoded user claims:', {
    sub: userClaims.sub,
    email: userClaims.email,
    name: userClaims.name
  });
  
  return userClaims;
}

module.exports = {
  getUserFromEvent,
  extractBearerToken,
  decodeJwtPayload
};