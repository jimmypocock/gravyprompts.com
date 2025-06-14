// Debug test to check DynamoDB connection
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

describe('DynamoDB Connection Debug', () => {
  it('should connect to DynamoDB and perform basic operations', async () => {
    // Create client directly
    const client = new DynamoDBClient({
      endpoint: 'http://localhost:8000',
      region: 'us-east-1',
      credentials: {
        accessKeyId: 'test',
        secretAccessKey: 'test'
      }
    });
    
    const docClient = DynamoDBDocumentClient.from(client);
    
    console.log('docClient:', docClient);
    console.log('docClient.send:', docClient.send);
    
    // Try a simple put
    const testItem = {
      templateId: 'test-123',
      title: 'Test Template',
      content: 'Test content',
      visibility: 'public',
      moderationStatus: 'approved',
      userId: 'test-user',
      tags: ['test'],
      variables: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    try {
      const putResult = await docClient.send(new PutCommand({
        TableName: 'local-templates',
        Item: testItem
      }));
      
      console.log('Put successful:', putResult.$metadata.httpStatusCode);
      
      // Try to get it back
      const getResult = await docClient.send(new GetCommand({
        TableName: 'local-templates',
        Key: { templateId: 'test-123' }
      }));
      
      console.log('Get successful:', getResult.Item?.title);
      
      expect(getResult.Item).toBeDefined();
      expect(getResult.Item.title).toBe('Test Template');
    } catch (error) {
      console.error('Error:', error);
      throw error;
    }
  });
});