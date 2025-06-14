const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const { getUserFromEvent } = require('/opt/nodejs/auth');

// Initialize DynamoDB client
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Get table name from environment
const TABLE_NAME = process.env.USER_PROMPTS_TABLE || 'user-prompts';

exports.handler = async (event) => {
  console.log('Save prompt event:', JSON.stringify(event, null, 2));

  // Parse request body
  let body;
  try {
    body = JSON.parse(event.body);
  } catch (error) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Invalid request body' }),
    };
  }

  // Extract user information from event
  const user = await getUserFromEvent(event);
  if (!user || !user.sub) {
    return {
      statusCode: 401,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }
  
  const userId = user.sub;

  // Validate required fields
  const { templateId, templateTitle, content, variables } = body;
  if (!templateTitle || !content) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Missing required fields: templateTitle and content' }),
    };
  }

  // Create prompt item
  const promptId = uuidv4();
  const timestamp = new Date().toISOString();
  
  const promptItem = {
    promptId,
    userId,
    templateId: templateId || null,
    templateTitle,
    content,
    variables: variables || {},
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  try {
    // Save to DynamoDB
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: promptItem,
    }));

    console.log('Prompt saved successfully:', promptId);

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'Prompt saved successfully',
        promptId,
        ...promptItem,
      }),
    };
  } catch (error) {
    console.error('Error saving prompt:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Failed to save prompt' }),
    };
  }
};
