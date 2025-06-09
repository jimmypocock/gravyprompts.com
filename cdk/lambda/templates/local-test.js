// Local testing script for Lambda functions
// Run with: node local-test.js

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');

// Override AWS clients for local testing
const localDynamoClient = new DynamoDBClient({
  endpoint: 'http://localhost:8000',
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'local',
    secretAccessKey: 'local'
  }
});

const localDocClient = DynamoDBDocumentClient.from(localDynamoClient);

// Mock the Lambda context
const mockContext = {
  requestContext: {
    authorizer: {
      claims: {
        sub: 'test-user-123',
        email: 'test@example.com'
      }
    }
  }
};

// Test create template
async function testCreateTemplate() {
  console.log('\n🧪 Testing Create Template...');
  
  // Mock the require for utils to use local clients
  require.cache[require.resolve('/opt/nodejs/utils')] = {
    exports: {
      docClient: localDocClient,
      sanitizeHtml: (html) => html, // Simple mock
      extractVariables: (content) => {
        const regex = /\[\[([^\]]+)\]\]/g;
        const vars = [];
        let match;
        while ((match = regex.exec(content)) !== null) {
          vars.push(match[1]);
        }
        return vars;
      },
      createResponse: (status, body) => ({ statusCode: status, body: JSON.stringify(body) }),
      getUserIdFromEvent: (event) => event.requestContext?.authorizer?.claims?.sub,
      validateTemplate: (template) => [],
      checkRateLimit: async () => true
    }
  };

  const createHandler = require('./create').handler;
  
  const event = {
    ...mockContext,
    body: JSON.stringify({
      title: 'Test Email Template',
      content: '<p>Hello [[name]], welcome to [[company]]!</p>',
      visibility: 'private',
      tags: ['email', 'welcome']
    })
  };

  const result = await createHandler(event);
  console.log('Result:', JSON.parse(result.body));
  return JSON.parse(result.body).template;
}

// Test list templates
async function testListTemplates() {
  console.log('\n🧪 Testing List Templates...');
  
  const listHandler = require('./list').handler;
  
  const event = {
    ...mockContext,
    queryStringParameters: {
      filter: 'mine',
      limit: '10'
    }
  };

  const result = await listHandler(event);
  console.log('Result:', JSON.parse(result.body));
}

// Test get template
async function testGetTemplate(templateId) {
  console.log('\n🧪 Testing Get Template...');
  
  const getHandler = require('./get').handler;
  
  const event = {
    ...mockContext,
    pathParameters: {
      templateId
    }
  };

  const result = await getHandler(event);
  console.log('Result:', JSON.parse(result.body));
}

// Test populate template
async function testPopulateTemplate(templateId) {
  console.log('\n🧪 Testing Populate Template...');
  
  const populateHandler = require('./populate').handler;
  
  const event = {
    ...mockContext,
    pathParameters: {
      templateId
    },
    body: JSON.stringify({
      variables: {
        name: 'John Doe',
        company: 'Acme Corp'
      }
    })
  };

  const result = await populateHandler(event);
  console.log('Result:', JSON.parse(result.body));
}

// Run all tests
async function runTests() {
  try {
    // Override environment variables
    process.env.TEMPLATES_TABLE = 'local-templates';
    process.env.TEMPLATE_VIEWS_TABLE = 'local-template-views';
    process.env.ENVIRONMENT = 'development';
    
    console.log('🚀 Starting Lambda function tests...\n');
    
    // Test create
    const template = await testCreateTemplate();
    
    // Test list
    await testListTemplates();
    
    if (template?.templateId) {
      // Test get
      await testGetTemplate(template.templateId);
      
      // Test populate
      await testPopulateTemplate(template.templateId);
    }
    
    console.log('\n✅ All tests completed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

// Run if called directly
if (require.main === module) {
  runTests();
}

module.exports = { runTests };