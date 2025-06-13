const { GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const {
  docClient,
  sanitizeHtml,
  extractVariables,
  createResponse,
  getUserIdFromEvent,
  validateTemplate,
  checkRateLimit,
} = require('/opt/nodejs/utils');

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
    const rateLimitOk = await checkRateLimit(userId, 'update_template', {
      perMinute: 20,
      perHour: 200,
    });
    
    if (!rateLimitOk) {
      return createResponse(429, { error: 'Rate limit exceeded' });
    }

    // Get existing template
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
      return createResponse(403, { error: 'You can only edit your own templates' });
    }

    // Parse request body
    const body = JSON.parse(event.body || '{}');
    
    // Prepare update object with only changed fields
    const updates = {};
    
    if (body.title !== undefined) {
      updates.title = body.title.trim();
    }
    
    if (body.content !== undefined) {
      updates.content = sanitizeHtml(body.content);
      updates.variables = extractVariables(updates.content);
    }
    
    if (body.visibility !== undefined) {
      if (!['public', 'private'].includes(body.visibility)) {
        return createResponse(400, { error: 'Visibility must be either public or private' });
      }
      updates.visibility = body.visibility;
      
      // If changing to public, reset moderation status
      if (body.visibility === 'public' && existingTemplate.visibility === 'private') {
        updates.moderationStatus = 'pending';
        updates.moderationDetails = null;
      }
    }
    
    if (body.tags !== undefined) {
      if (!Array.isArray(body.tags)) {
        return createResponse(400, { error: 'Tags must be an array' });
      }
      if (body.tags.length > 10) {
        return createResponse(400, { error: 'Maximum 10 tags allowed' });
      }
      updates.tags = body.tags.map(tag => tag.trim().toLowerCase());
    }
    
    if (body.viewers !== undefined) {
      if (!Array.isArray(body.viewers)) {
        return createResponse(400, { error: 'Viewers must be an array' });
      }
      updates.viewers = body.viewers;
    }

    // Validate the complete updated template
    const updatedTemplate = { ...existingTemplate, ...updates };
    const validationErrors = validateTemplate(updatedTemplate);
    if (validationErrors.length > 0) {
      return createResponse(400, { 
        error: 'Validation failed', 
        details: validationErrors 
      });
    }

    // Build update expression
    const updateExpressions = ['updatedAt = :updatedAt'];
    const expressionAttributeNames = {};
    const expressionAttributeValues = { ':updatedAt': new Date().toISOString() };

    Object.entries(updates).forEach(([key, value]) => {
      updateExpressions.push(`#${key} = :${key}`);
      expressionAttributeNames[`#${key}`] = key;
      expressionAttributeValues[`:${key}`] = value;
    });

    // Update in DynamoDB
    const updateResult = await docClient.send(new UpdateCommand({
      TableName: process.env.TEMPLATES_TABLE,
      Key: { templateId },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    }));

    return createResponse(200, {
      message: 'Template updated successfully',
      template: {
        templateId: updateResult.Attributes.templateId,
        title: updateResult.Attributes.title,
        visibility: updateResult.Attributes.visibility,
        variables: updateResult.Attributes.variables,
        tags: updateResult.Attributes.tags,
        updatedAt: updateResult.Attributes.updatedAt,
        moderationStatus: updateResult.Attributes.moderationStatus,
      },
    });

  } catch (error) {
    console.error('Error updating template:', error);
    return createResponse(500, { 
      error: 'Internal server error',
      message: process.env.ENVIRONMENT === 'development' ? error.message : undefined,
    });
  }
};
