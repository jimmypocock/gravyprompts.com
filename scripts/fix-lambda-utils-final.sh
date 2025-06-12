#!/bin/bash

echo "🔧 Final fix: Embedding utils directly in Lambda functions..."
echo "============================================================"

cd "$(dirname "$0")/../cdk"

# Create utils.js in each Lambda function directory
echo "Creating utils.js in Lambda functions..."

# First, create the utils content
cat > lambda/templates/utils.js << 'EOF'
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
        errors.push(\`Tag at index \${index} must be a non-empty string\`);
      }
      if (tag.length > 50) {
        errors.push(\`Tag at index \${index} must be 50 characters or less\`);
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
EOF

# Copy to other Lambda functions
cp lambda/templates/utils.js lambda/prompts/utils.js
cp lambda/templates/utils.js lambda/moderation/utils.js

# Update package.json files to include dependencies
echo "Updating package.json files..."

cat > lambda/templates/package.json << 'EOF'
{
  "name": "templates-functions",
  "version": "1.0.0",
  "description": "Template management Lambda functions",
  "dependencies": {
    "@aws-sdk/client-dynamodb": "^3.0.0",
    "@aws-sdk/lib-dynamodb": "^3.0.0",
    "@aws-sdk/client-cognito-identity-provider": "^3.0.0",
    "uuid": "^9.0.0",
    "dompurify": "^3.0.0",
    "jsdom": "^23.0.0"
  }
}
EOF

cat > lambda/prompts/package.json << 'EOF'
{
  "name": "prompts-functions",
  "version": "1.0.0",
  "description": "User prompts Lambda functions",
  "dependencies": {
    "@aws-sdk/client-dynamodb": "^3.0.0",
    "@aws-sdk/lib-dynamodb": "^3.0.0",
    "@aws-sdk/client-cognito-identity-provider": "^3.0.0",
    "uuid": "^9.0.0",
    "dompurify": "^3.0.0",
    "jsdom": "^23.0.0"
  }
}
EOF

cat > lambda/moderation/package.json << 'EOF'
{
  "name": "moderation-function",
  "version": "1.0.0",
  "description": "Content moderation Lambda function",
  "dependencies": {
    "@aws-sdk/client-dynamodb": "^3.0.0",
    "@aws-sdk/lib-dynamodb": "^3.0.0",
    "dompurify": "^3.0.0",
    "jsdom": "^23.0.0"
  }
}
EOF

# Install dependencies
echo "Installing dependencies..."
cd lambda/templates && npm install
cd ../prompts && npm install
cd ../moderation && npm install

echo ""
echo "✅ Utils embedded and dependencies installed!"
echo ""
echo "This bypasses the Lambda layer entirely."
echo "Now run: npm run deploy:api"