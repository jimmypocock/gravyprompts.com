const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

// Initialize DynamoDB client
const dynamoClient = new DynamoDBClient({
  endpoint: process.env.AWS_SAM_LOCAL === 'true' ? 'http://dynamodb:8000' : undefined,
});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Get table name from environment
const TABLE_NAME = process.env.USER_PROMPTS_TABLE || 'user-prompts';

exports.handler = async (event) => {
  console.log('Delete prompt event:', JSON.stringify(event, null, 2));

  // Extract prompt ID from path parameters
  const promptId = event.pathParameters?.promptId;
  if (!promptId) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Missing promptId' }),
    };
  }

  // Extract user ID from Cognito authorizer
  const userId = event.requestContext?.authorizer?.claims?.sub;
  if (!userId) {
    return {
      statusCode: 401,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  try {
    // First, get the prompt to verify ownership
    const getResult = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { promptId },
    }));

    if (!getResult.Item) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Prompt not found' }),
      };
    }

    // Verify ownership
    if (getResult.Item.userId !== userId) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'You do not have permission to delete this prompt' }),
      };
    }

    // Delete the prompt
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { promptId },
    }));

    console.log('Prompt deleted successfully:', promptId);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ message: 'Prompt deleted successfully' }),
    };
  } catch (error) {
    console.error('Error deleting prompt:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Failed to delete prompt' }),
    };
  }
};
