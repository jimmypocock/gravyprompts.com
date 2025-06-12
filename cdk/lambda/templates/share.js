const { GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { AdminGetUserCommand } = require('@aws-sdk/client-cognito-identity-provider');
const {
  docClient,
  cognitoClient,
  createResponse,
  getUserIdFromEvent,
  generateShareToken,
  checkRateLimit,
} = require('./utils');

exports.handler = async (event) => {
  try {
    // Get user ID from authorizer
    const userId = getUserIdFromEvent(event);
    if (!userId) {
      return createResponse(401, { error: 'Unauthorized' });
    }

    const templateId = event.pathParameters?.templateId;
    if (!templateId) {
      return createResponse(400, { error: 'Template ID is required' });
    }

    // Check rate limit
    const rateLimitOk = await checkRateLimit(userId, 'share_template', {
      perMinute: 10,
      perHour: 100,
    });
    
    if (!rateLimitOk) {
      return createResponse(429, { error: 'Rate limit exceeded' });
    }

    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { action, emails, expiresIn = 7 } = body; // expiresIn in days

    if (!action || !['add', 'remove', 'generate_link'].includes(action)) {
      return createResponse(400, { 
        error: 'Invalid action. Must be one of: add, remove, generate_link' 
      });
    }

    // Get existing template
    const getResult = await docClient.send(new GetCommand({
      TableName: process.env.TEMPLATES_TABLE,
      Key: { templateId },
    }));

    if (!getResult.Item) {
      return createResponse(404, { error: 'Template not found' });
    }

    const template = getResult.Item;

    // Check ownership
    if (template.userId !== userId) {
      return createResponse(403, { error: 'You can only share your own templates' });
    }

    let updateExpression;
    let expressionAttributeNames = {};
    let expressionAttributeValues = {};
    let responseData = {};

    if (action === 'generate_link') {
      // Generate shareable link with token
      const token = generateShareToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + Math.min(expiresIn, 30)); // Max 30 days

      // Store token info
      const shareTokens = template.shareTokens || {};
      shareTokens[token] = {
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
      };

      // Clean up expired tokens
      Object.entries(shareTokens).forEach(([key, value]) => {
        if (new Date(value.expiresAt) < new Date()) {
          delete shareTokens[key];
        }
      });

      updateExpression = 'SET shareTokens = :shareTokens, updatedAt = :updatedAt';
      expressionAttributeValues = {
        ':shareTokens': shareTokens,
        ':updatedAt': new Date().toISOString(),
      };

      // Generate shareable URL
      const baseUrl = process.env.FRONTEND_URL || 'https://gravyprompts.com';
      responseData = {
        shareUrl: `${baseUrl}/templates/${templateId}?token=${token}`,
        expiresAt: expiresAt.toISOString(),
        token, // Include token for API access
      };

    } else if (action === 'add' || action === 'remove') {
      if (!emails || !Array.isArray(emails) || emails.length === 0) {
        return createResponse(400, { error: 'Emails array is required' });
      }

      // Validate emails and get user IDs
      const userIds = await getUserIdsByEmails(emails);
      
      if (userIds.length === 0) {
        return createResponse(400, { 
          error: 'No valid users found with the provided emails' 
        });
      }

      const viewers = new Set(template.viewers || []);
      
      if (action === 'add') {
        userIds.forEach(id => viewers.add(id));
      } else {
        userIds.forEach(id => viewers.delete(id));
      }

      updateExpression = 'SET viewers = :viewers, updatedAt = :updatedAt';
      expressionAttributeValues = {
        ':viewers': Array.from(viewers),
        ':updatedAt': new Date().toISOString(),
      };

      responseData = {
        message: `Successfully ${action === 'add' ? 'added' : 'removed'} ${userIds.length} viewer(s)`,
        viewerCount: viewers.size,
      };
    }

    // Update template
    await docClient.send(new UpdateCommand({
      TableName: process.env.TEMPLATES_TABLE,
      Key: { templateId },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 
        ? expressionAttributeNames 
        : undefined,
      ExpressionAttributeValues: expressionAttributeValues,
    }));

    return createResponse(200, responseData);

  } catch (error) {
    console.error('Error sharing template:', error);
    return createResponse(500, { 
      error: 'Internal server error',
      message: process.env.ENVIRONMENT === 'development' ? error.message : undefined,
    });
  }
};

// Helper function to get user IDs by email addresses
async function getUserIdsByEmails(emails) {
  const userIds = [];
  
  // In a production environment, you might want to batch this
  for (const email of emails) {
    try {
      const command = new AdminGetUserCommand({
        UserPoolId: process.env.USER_POOL_ID,
        Username: email,
      });
      
      const result = await cognitoClient.send(command);
      
      // Get the sub (user ID) from attributes
      const subAttribute = result.UserAttributes?.find(attr => attr.Name === 'sub');
      if (subAttribute?.Value) {
        userIds.push(subAttribute.Value);
      }
    } catch (error) {
      // User not found or other error - skip this email
      console.warn(`Could not find user with email ${email}:`, error.message);
    }
  }
  
  return userIds;
