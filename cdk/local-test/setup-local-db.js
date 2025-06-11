// Setup script to create DynamoDB tables locally
const { DynamoDBClient, CreateTableCommand } = require('@aws-sdk/client-dynamodb');

const client = new DynamoDBClient({
  endpoint: 'http://localhost:8000',
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'local',
    secretAccessKey: 'local'
  }
});

async function createTables() {
  // Templates table
  const templatesTable = {
    TableName: 'local-templates',
    KeySchema: [
      { AttributeName: 'templateId', KeyType: 'HASH' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'templateId', AttributeType: 'S' },
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'createdAt', AttributeType: 'S' },
      { AttributeName: 'visibility', AttributeType: 'S' },
      { AttributeName: 'moderationStatus', AttributeType: 'S' }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'userId-createdAt-index',
        KeySchema: [
          { AttributeName: 'userId', KeyType: 'HASH' },
          { AttributeName: 'createdAt', KeyType: 'RANGE' }
        ],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
      },
      {
        IndexName: 'visibility-createdAt-index',
        KeySchema: [
          { AttributeName: 'visibility', KeyType: 'HASH' },
          { AttributeName: 'createdAt', KeyType: 'RANGE' }
        ],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
      },
      {
        IndexName: 'visibility-moderationStatus-index',
        KeySchema: [
          { AttributeName: 'visibility', KeyType: 'HASH' },
          { AttributeName: 'moderationStatus', KeyType: 'RANGE' }
        ],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
      }
    ],
    BillingMode: 'PAY_PER_REQUEST',
    StreamSpecification: {
      StreamEnabled: true,
      StreamViewType: 'NEW_AND_OLD_IMAGES'
    }
  };

  // Template views table
  const viewsTable = {
    TableName: 'local-template-views',
    KeySchema: [
      { AttributeName: 'viewId', KeyType: 'HASH' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'viewId', AttributeType: 'S' },
      { AttributeName: 'templateId', AttributeType: 'S' },
      { AttributeName: 'timestamp', AttributeType: 'S' }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'templateId-timestamp-index',
        KeySchema: [
          { AttributeName: 'templateId', KeyType: 'HASH' },
          { AttributeName: 'timestamp', KeyType: 'RANGE' }
        ],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
      }
    ],
    BillingMode: 'PAY_PER_REQUEST'
  };

  try {
    console.log('Creating templates table...');
    await client.send(new CreateTableCommand(templatesTable));
    console.log('Templates table created successfully');
  } catch (error) {
    if (error.name === 'ResourceInUseException') {
      console.log('Templates table already exists - skipping');
    } else {
      console.error('Error creating templates table:', error);
      throw error;
    }
  }

  try {
    console.log('Creating template views table...');
    await client.send(new CreateTableCommand(viewsTable));
    console.log('Template views table created successfully');
  } catch (error) {
    if (error.name === 'ResourceInUseException') {
      console.log('Template views table already exists - skipping');
    } else {
      console.error('Error creating template views table:', error);
      throw error;
    }
  }

  // User prompts table
  const userPromptsTable = {
    TableName: 'local-user-prompts',
    KeySchema: [
      { AttributeName: 'promptId', KeyType: 'HASH' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'promptId', AttributeType: 'S' },
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'createdAt', AttributeType: 'S' }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'userId-createdAt-index',
        KeySchema: [
          { AttributeName: 'userId', KeyType: 'HASH' },
          { AttributeName: 'createdAt', KeyType: 'RANGE' }
        ],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
      }
    ],
    BillingMode: 'PAY_PER_REQUEST'
  };

  try {
    console.log('Creating user prompts table...');
    await client.send(new CreateTableCommand(userPromptsTable));
    console.log('User prompts table created successfully');
  } catch (error) {
    if (error.name === 'ResourceInUseException') {
      console.log('User prompts table already exists - skipping');
    } else {
      console.error('Error creating user prompts table:', error);
      throw error;
    }
  }

  console.log('\n✅ All tables ready!');
  console.log('📊 DynamoDB Admin UI: http://localhost:8001');
}

createTables();