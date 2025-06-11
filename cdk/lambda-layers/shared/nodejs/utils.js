const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const { CognitoIdentityProviderClient } = require('@aws-sdk/client-cognito-identity-provider');
const DOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

// Initialize AWS clients
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const cognitoClient = new CognitoIdentityProviderClient({});

// Initialize DOMPurify
const window = new JSDOM('').window;
const purify = DOMPurify(window);

// Sanitize HTML content
const sanitizeHtml = (html) => {
  return purify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'span', 'a', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: ['href', 'class', 'data-variable'],
    ALLOW_DATA_ATTR: true,
  });
};

// Extract variables from template content
const extractVariables = (content) => {
  const variableRegex = /\[\[([^\]]+)\]\]/g;
  const variables = [];
  let match;
  
  while ((match = variableRegex.exec(content)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1]);
    }
  }
  
  return variables;
};

// Strip HTML tags for text analysis
const stripHtml = (html) => {
  const tmp = window.document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
};

// Rate limiting check
const checkRateLimit = async (userId, action, limits) => {
  // This would typically check against a rate limiting service or DynamoDB
  // For now, we'll implement a simple in-memory check
  // In production, use AWS API Gateway rate limiting or a service like Redis
  return true;
};

// Generate share token
const generateShareToken = () => {
  return require('uuid').v4();
};

// Standard response helper
const createResponse = (statusCode, body, headers = {}) => {
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
};

// Extract user ID from Cognito authorizer
const getUserIdFromEvent = (event) => {
  if (event.requestContext?.authorizer?.claims?.sub) {
    return event.requestContext.authorizer.claims.sub;
  }
  if (event.requestContext?.authorizer?.principalId) {
    return event.requestContext.authorizer.principalId;
  }
  return null;
};

// Validate template data
const validateTemplate = (template) => {
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
};

module.exports = {
  docClient,
  cognitoClient,
  sanitizeHtml,
  extractVariables,
  stripHtml,
  checkRateLimit,
  generateShareToken,
  createResponse,
  getUserIdFromEvent,
  validateTemplate,
};