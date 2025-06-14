const { GetCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const {
  docClient,
  createResponse,
  checkRateLimit,
} = require('/opt/nodejs/utils');
const { getUserFromEvent } = require('/opt/nodejs/auth');

exports.handler = async (event) => {
  try {
    // Get user from authorizer
    const user = await getUserFromEvent(event);
    if (!user || !user.sub) {
      return createResponse(401, { error: 'Unauthorized' });
    }
    const userId = user.sub;

    const templateId = event.pathParameters?.templateId;
    if (!templateId) {
      return createResponse(400, { error: 'Template ID is required' });
    }

    // Check rate limit
    const rateLimitOk = await checkRateLimit(userId, 'deleteTemplate');
    
    if (!rateLimitOk) {
      return createResponse(429, { error: 'Rate limit exceeded' });
    }

    // Get existing template to check ownership
    const getResult = await docClient.send(new GetCommand({
      TableName: process.env.TEMPLATES_TABLE,
      Key: { templateId },
    }));

    if (!getResult.Item) {
      return createResponse(404, { error: 'Template not found' });
    }

    const existingTemplate = getResult.Item;

    // Check ownership
    if (existingTemplate.userId !== userId) {
      return createResponse(403, { error: 'You can only delete your own templates' });
    }

    // Delete from DynamoDB
    await docClient.send(new DeleteCommand({
      TableName: process.env.TEMPLATES_TABLE,
      Key: { templateId },
      ConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
    }));

    // TODO: In production, you might want to:
    // 1. Soft delete instead of hard delete
    // 2. Clean up related data (views, shares, etc.)
    // 3. Send notifications to users who had access

    return createResponse(200, {
      message: 'Template deleted successfully',
      templateId,
    });

  } catch (error) {
    console.error('Error deleting template:', error);
    
    if (error.name === 'ConditionalCheckFailedException') {
      return createResponse(403, { error: 'Permission denied' });
    }
    
    return createResponse(500, { 
      error: 'Internal server error',
      message: process.env.ENVIRONMENT === 'development' ? error.message : undefined,
    });
  }
};
