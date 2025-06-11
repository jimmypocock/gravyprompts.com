// Local version of utils.js for development
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const DOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

// Check if running locally
const isLocal = process.env.AWS_SAM_LOCAL === 'true' || process.env.IS_LOCAL === 'true';

// Initialize AWS clients with local endpoint if running locally
const dynamoConfig = isLocal ? {
  endpoint: 'http://host.docker.internal:8000', // Use host.docker.internal for Docker
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'local',
    secretAccessKey: 'local'
  }
} : {};

const dynamoClient = new DynamoDBClient(dynamoConfig);
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Comprehend removed - no longer needed

// Mock Cognito client for local testing
const cognitoClient = {
  send: async (command) => {
    console.log('Mock Cognito command:', command.constructor.name);
    
    if (command.constructor.name === 'AdminGetUserCommand') {
      return {
        UserAttributes: [
          { Name: 'sub', Value: 'mock-user-' + Date.now() },
          { Name: 'email', Value: command.input.Username }
        ]
      };
    }
    
    return {};
  }
};

// Initialize DOMPurify
const window = new JSDOM('').window;
const purify = DOMPurify(window);

// Export the same interface as the real utils
module.exports = {
  docClient,
  cognitoClient: isLocal ? cognitoClient : require('@aws-sdk/client-cognito-identity-provider').CognitoIdentityProviderClient,
  
  sanitizeHtml: (html) => {
    return purify.sanitize(html, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'span', 'a', 'ul', 'ol', 'li'],
      ALLOWED_ATTR: ['href', 'class', 'data-variable'],
      ALLOW_DATA_ATTR: true,
    });
  },
  
  extractVariables: (content) => {
    const variableRegex = /\[\[([^\]]+)\]\]/g;
    const variables = [];
    let match;
    
    while ((match = variableRegex.exec(content)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }
    
    return variables;
  },
  
  stripHtml: (html) => {
    const tmp = window.document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  },
  
  checkRateLimit: async (userId, action, limits) => {
    // Always return true for local testing
    if (isLocal) {
      console.log(`Mock rate limit check: ${userId} - ${action}`);
      return true;
    }
    return true;
  },
  
  generateShareToken: () => {
    return require('uuid').v4();
  },
  
  createResponse: (statusCode, body, headers = {}) => {
    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        ...headers,
      },
      body: JSON.stringify(body),
    };
  },
  
  getUserIdFromEvent: (event) => {
    // For local testing, always return a mock user ID
    if (isLocal) {
      // Check if there's an Authorization header with a mock token
      const authHeader = event.headers?.Authorization || event.headers?.authorization;
      if (authHeader) {
        // Extract a simple user ID from the token for local testing
        // In production, this would be properly validated
        return 'local-user-' + Date.now();
      }
      return 'local-test-user';
    }
    
    if (event.requestContext?.authorizer?.claims?.sub) {
      return event.requestContext.authorizer.claims.sub;
    }
    if (event.requestContext?.authorizer?.principalId) {
      return event.requestContext.authorizer.principalId;
    }
    return null;
  },
  
  validateTemplate: (template) => {
    const errors = [];
    
    if (!template.title || template.title.trim().length === 0) {
      errors.push('Title is required');
    }
    
    if (template.title && template.title.length > 200) {
      errors.push('Title must be 200 characters or less');
    }
    
    if (!template.content || template.content.trim().length === 0) {
      errors.push('Content is required');
    }
    
    if (template.content && template.content.length > 10000) {
      errors.push('Content must be 10,000 characters or less');
    }
    
    if (template.visibility && !['public', 'private'].includes(template.visibility)) {
      errors.push('Visibility must be either public or private');
    }
    
    if (template.tags && !Array.isArray(template.tags)) {
      errors.push('Tags must be an array');
    }
    
    if (template.tags && template.tags.length > 10) {
      errors.push('Maximum 10 tags allowed');
    }
    
    if (template.tags) {
      template.tags.forEach((tag, index) => {
        if (typeof tag !== 'string' || tag.trim().length === 0) {
          errors.push(`Tag at index ${index} must be a non-empty string`);
        }
        if (tag.length > 50) {
          errors.push(`Tag at index ${index} must be 50 characters or less`);
        }
      });
    }
    
    return errors;
  }
};