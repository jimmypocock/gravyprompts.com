// Real DynamoDB integration test helpers
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, DeleteCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

// Create a real DynamoDB client pointing to local instance
const createTestClient = () => {
  const client = new DynamoDBClient({
    endpoint: process.env.AWS_SAM_LOCAL ? 'http://host.docker.internal:8000' : 'http://localhost:8000',
    region: 'us-east-1',
    credentials: {
      accessKeyId: 'test',
      secretAccessKey: 'test'
    }
  });
  
  return DynamoDBDocumentClient.from(client);
};

// Real test data that matches what the UI would send
const testTemplates = [
  {
    templateId: uuidv4(),
    title: 'Email Marketing Campaign',
    content: `Create an engaging email marketing campaign for {{product_name}}.

Target audience: {{target_audience}}
Key benefits: {{key_benefits}}
Call to action: {{cta_text}}

Subject Line Options:
1. "Discover the Future of {{product_category}}"
2. "{{discount_percentage}}% Off - Limited Time Only!"
3. "You're Invited: Exclusive {{product_name}} Launch"

Email Body:
Dear {{customer_name}},

We're excited to introduce you to {{product_name}}, the latest innovation in {{product_category}}.

[Continue with compelling copy...]`,
    tags: ['email', 'marketing', 'campaign', 'sales'],
    variables: ['product_name', 'target_audience', 'key_benefits', 'cta_text', 'product_category', 'discount_percentage', 'customer_name'],
    userId: 'test-user-1',
    visibility: 'public',
    moderationStatus: 'approved',
    useCount: 150,
    viewCount: 500,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    templateId: uuidv4(),
    title: 'Professional Business Email Template',
    content: `Subject: {{subject}}

Dear {{recipient_name}},

I hope this email finds you well. I'm reaching out regarding {{topic}}.

{{main_content}}

Please let me know if you have any questions or would like to schedule a call to discuss further.

Best regards,
{{sender_name}}
{{sender_title}}
{{company_name}}`,
    tags: ['email', 'business', 'professional', 'communication'],
    variables: ['subject', 'recipient_name', 'topic', 'main_content', 'sender_name', 'sender_title', 'company_name'],
    userId: 'test-user-2',
    visibility: 'public',
    moderationStatus: 'approved',
    useCount: 75,
    viewCount: 200,
    createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    updatedAt: new Date(Date.now() - 86400000).toISOString()
  },
  {
    templateId: uuidv4(),
    title: 'Marketing Strategy Planning Guide',
    content: `Comprehensive Marketing Strategy for {{company_name}}

1. Market Analysis
   - Target Market: {{target_market}}
   - Competition: {{main_competitors}}
   - Unique Value Proposition: {{uvp}}

2. Marketing Goals
   {{marketing_goals}}

3. Email Marketing Plan
   - Frequency: {{email_frequency}}
   - Segments: {{customer_segments}}
   
4. Content Strategy
   {{content_strategy}}

5. Budget Allocation
   Total Budget: {{total_budget}}
   - Digital Ads: {{digital_ad_budget}}
   - Content Creation: {{content_budget}}
   - Email Marketing: {{email_budget}}`,
    tags: ['marketing', 'strategy', 'planning', 'business'],
    variables: ['company_name', 'target_market', 'main_competitors', 'uvp', 'marketing_goals', 'email_frequency', 'customer_segments', 'content_strategy', 'total_budget', 'digital_ad_budget', 'content_budget', 'email_budget'],
    userId: 'test-user-1',
    visibility: 'public',
    moderationStatus: 'approved',
    useCount: 50,
    viewCount: 180,
    createdAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
    updatedAt: new Date(Date.now() - 172800000).toISOString()
  },
  {
    templateId: uuidv4(),
    title: 'Product Launch Announcement',
    content: `ANNOUNCING: {{product_name}}

We're thrilled to introduce {{product_name}}, our latest innovation designed to {{main_benefit}}.

Key Features:
{{key_features}}

Launch Date: {{launch_date}}
Special Offer: {{special_offer}}

Learn more at {{product_url}}`,
    tags: ['announcement', 'product', 'launch', 'marketing'],
    variables: ['product_name', 'main_benefit', 'key_features', 'launch_date', 'special_offer', 'product_url'],
    userId: 'test-user-3',
    visibility: 'public',
    moderationStatus: 'approved',
    useCount: 25,
    viewCount: 90,
    createdAt: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
    updatedAt: new Date(Date.now() - 259200000).toISOString()
  },
  {
    templateId: uuidv4(),
    title: 'Cold Outreach Email Template',
    content: `Subject: Quick question about {{company_name}}'s {{department}} goals

Hi {{first_name}},

I noticed that {{company_name}} has been {{recent_achievement}}. Congratulations!

Many {{industry}} companies I work with struggle with {{pain_point}}. 

We've helped companies like {{similar_company}} achieve {{specific_result}}.

Worth a quick chat to see if we could help {{company_name}} too?

Best,
{{sender_name}}`,
    tags: ['cold-email', 'outreach', 'sales', 'b2b'],
    variables: ['company_name', 'department', 'first_name', 'recent_achievement', 'industry', 'pain_point', 'similar_company', 'specific_result', 'sender_name'],
    userId: 'test-user-2',
    visibility: 'public',
    moderationStatus: 'approved',
    useCount: 200,
    viewCount: 750,
    createdAt: new Date(Date.now() - 345600000).toISOString(), // 4 days ago
    updatedAt: new Date(Date.now() - 345600000).toISOString()
  },
  {
    templateId: uuidv4(),
    title: 'User Testing Feedback Request',
    content: `Hi {{user_name}},

Thank you for participating in our user testing session for {{product_name}}.

We'd love to hear your feedback:
1. What did you like most about {{feature_tested}}?
2. What challenges did you encounter?
3. How would you rate the overall experience (1-10)?

Your feedback helps us improve {{product_name}} for everyone.

Thanks!
{{team_name}} Team`,
    tags: ['feedback', 'user-testing', 'product', 'email'],
    variables: ['user_name', 'product_name', 'feature_tested', 'team_name'],
    userId: 'test-user-1',
    visibility: 'private', // Private template
    moderationStatus: 'approved',
    useCount: 10,
    viewCount: 20,
    createdAt: new Date(Date.now() - 432000000).toISOString(), // 5 days ago
    updatedAt: new Date(Date.now() - 432000000).toISOString()
  },
  {
    templateId: uuidv4(),
    title: 'Email Newsletter Template',
    content: `# {{newsletter_title}}

*{{newsletter_date}}*

Dear {{subscriber_name}},

## This Week's Highlights

{{main_content}}

## Upcoming Events
{{events_list}}

## Featured Resource
{{featured_resource}}

---
*You're receiving this because you subscribed to {{newsletter_name}}.*
[Unsubscribe]({{unsubscribe_link}}) | [Update Preferences]({{preferences_link}})`,
    tags: ['newsletter', 'email', 'marketing', 'content'],
    variables: ['newsletter_title', 'newsletter_date', 'subscriber_name', 'main_content', 'events_list', 'featured_resource', 'newsletter_name', 'unsubscribe_link', 'preferences_link'],
    userId: 'test-user-3',
    visibility: 'public',
    moderationStatus: 'pending', // Pending approval
    useCount: 0,
    viewCount: 5,
    createdAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    updatedAt: new Date(Date.now() - 3600000).toISOString()
  }
];

// Helper to seed test data
const seedTestData = async (docClient, tableName = 'local-templates') => {
  console.log(`Seeding ${testTemplates.length} test templates...`);
  
  for (const template of testTemplates) {
    await docClient.send(new PutCommand({
      TableName: tableName,
      Item: template
    }));
  }
  
  console.log('✅ Test data seeded successfully');
  return testTemplates;
};

// Helper to clean up test data
const cleanupTestData = async (docClient, tableName = 'local-templates') => {
  console.log('Cleaning up test data...');
  
  // Scan for all items (in production, you'd want to be more selective)
  const scanResult = await docClient.send(new ScanCommand({
    TableName: tableName
  }));
  
  // Delete each item
  for (const item of scanResult.Items || []) {
    await docClient.send(new DeleteCommand({
      TableName: tableName,
      Key: { templateId: item.templateId }
    }));
  }
  
  console.log('✅ Test data cleaned up');
};

// Helper to create a test event that matches API Gateway format
const createTestEvent = (options = {}) => {
  return {
    httpMethod: options.method || 'GET',
    path: options.path || '/templates',
    headers: options.headers || {},
    queryStringParameters: options.queryStringParameters || null,
    pathParameters: options.pathParameters || null,
    body: options.body ? JSON.stringify(options.body) : null,
    requestContext: {
      authorizer: options.authorizer || null
    }
  };
};

module.exports = {
  createTestClient,
  testTemplates,
  seedTestData,
  cleanupTestData,
  createTestEvent
};