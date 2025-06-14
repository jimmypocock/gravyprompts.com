const { GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { PutCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const {
  docClient,
  createResponse,
  getUserIdFromEvent,
  sanitizeHtml,
} = require('/opt/nodejs/utils');

exports.handler = async (event) => {
  try {
    // Get user ID from authorizer (optional for public templates)
    const userId = getUserIdFromEvent(event);
    
    const templateId = event.pathParameters?.templateId;
    if (!templateId) {
      return createResponse(400, { error: 'Template ID is required' });
    }

    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { variables, returnHtml = true } = body;

    if (!variables || typeof variables !== 'object') {
      return createResponse(400, { 
        error: 'Variables object is required' 
      });
    }

    // Get template
    const getResult = await docClient.send(new GetCommand({
      TableName: process.env.TEMPLATES_TABLE,
      Key: { templateId },
    }));

    if (!getResult.Item) {
      return createResponse(404, { error: 'Template not found' });
    }

    const template = getResult.Item;

    // Check access permissions
    const hasAccess = await checkTemplateAccess(template, userId, event);
    if (!hasAccess) {
      return createResponse(403, { 
        error: 'You do not have access to this template' 
      });
    }

    // Populate template content with variables
    let populatedContent = template.content;
    const missingVariables = [];
    const usedVariables = [];

    // Replace all variable placeholders
    template.variables.forEach(varName => {
      const placeholder = `[[${varName}]]`;
      const value = variables[varName];
      
      if (value === undefined || value === null) {
        missingVariables.push(varName);
      } else {
        // Sanitize the variable value to prevent XSS
        const sanitizedValue = sanitizeHtml(String(value));
        populatedContent = populatedContent.replace(
          new RegExp(escapeRegExp(placeholder), 'g'),
          sanitizedValue
        );
        usedVariables.push(varName);
      }
    });

    // Track template usage
    await trackTemplateUsage(templateId, userId);

    // Prepare response
    const response = {
      templateId,
      title: template.title,
      populatedContent: returnHtml ? populatedContent : stripHtml(populatedContent),
      variables: {
        required: template.variables,
        provided: Object.keys(variables),
        missing: missingVariables,
        used: usedVariables,
      },
    };

    // Include warning if variables are missing
    if (missingVariables.length > 0) {
      response.warning = `Missing values for variables: ${missingVariables.join(', ')}`;
    }

    return createResponse(200, response);

  } catch (error) {
    console.error('Error populating template:', error);
    return createResponse(500, { 
      error: 'Internal server error',
      message: process.env.ENVIRONMENT === 'development' ? error.message : undefined,
    });
  }
};

// Check if user has access to the template
async function checkTemplateAccess(template, userId, event) {
  // Public templates are accessible to everyone if approved
  if (template.visibility === 'public' && template.moderationStatus === 'approved') {
    return true;
  }

  // Owner always has access
  if (userId && template.userId === userId) {
    return true;
  }

  // Check if user is in viewers list
  if (userId && template.viewers && template.viewers.includes(userId)) {
    return true;
  }

  // Check share token
  const token = event.queryStringParameters?.token;
  if (token && template.shareTokens && template.shareTokens[token]) {
    const tokenInfo = template.shareTokens[token];
    const expiresAt = new Date(tokenInfo.expiresAt);
    if (expiresAt > new Date()) {
      return true;
    }
  }

  return false;
}

// Track template usage for analytics
async function trackTemplateUsage(templateId, userId) {
  try {
    // Update template use count
    await docClient.send(new UpdateCommand({
      TableName: process.env.TEMPLATES_TABLE,
      Key: { templateId },
      UpdateExpression: 'ADD useCount :inc',
      ExpressionAttributeValues: {
        ':inc': 1,
      },
    }));

    // Record individual usage for analytics
    const viewRecord = {
      viewId: uuidv4(),
      templateId,
      viewerId: userId || 'anonymous',
      timestamp: new Date().toISOString(),
      viewType: 'populate',
      ttl: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60), // 90 days
    };

    await docClient.send(new PutCommand({
      TableName: process.env.TEMPLATE_VIEWS_TABLE,
      Item: viewRecord,
    }));
  } catch (error) {
    // Don't fail the request if tracking fails
    console.error('Error tracking usage:', error);
  }
}

// Escape special regex characters
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Strip HTML tags (simple implementation)
function stripHtml(html) {
  return html.replace(/<[^>]*>/g, '');
