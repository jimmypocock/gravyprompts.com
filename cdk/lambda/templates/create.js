const { PutCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

// Use local utils if running locally, otherwise use Lambda layer
let utils;
try {
  // In Lambda, the layer modules are available directly
  utils = require('utils');
} catch (e) {
  // Fallback for local development
  try {
    utils = require('./utils-local');
  } catch (e2) {
    console.error('Failed to load utils from layer:', e);
    console.error('Failed to load utils-local:', e2);
    throw new Error('Unable to load utils module');
  }
}

const {
  docClient,
  sanitizeHtml,
  extractVariables,
  createResponse,
  getUserIdFromEvent,
  validateTemplate,
  checkRateLimit,
} = utils;

exports.handler = async (event) => {
  try {
    console.log('Event headers:', event.headers);
    console.log('IS_LOCAL:', process.env.IS_LOCAL);
    console.log('AWS_SAM_LOCAL:', process.env.AWS_SAM_LOCAL);
    
    // Get user ID from authorizer
    const userId = getUserIdFromEvent(event);
    console.log('User ID:', userId);
    
    if (!userId) {
      return createResponse(401, { error: 'Unauthorized' });
    }

    // Check rate limit
    const rateLimitOk = await checkRateLimit(userId, 'create_template', {
      perMinute: 10,
      perHour: 100,
    });
    
    if (!rateLimitOk) {
      return createResponse(429, { error: 'Rate limit exceeded' });
    }

    // Parse request body
    const body = JSON.parse(event.body || '{}');
    
    // Log the received body for debugging
    console.log('Received body:', JSON.stringify(body, null, 2));
    
    // Validate template
    const validationErrors = validateTemplate(body);
    if (validationErrors.length > 0) {
      console.error('Validation errors:', validationErrors);
      return createResponse(400, { 
        error: 'Validation failed', 
        details: validationErrors 
      });
    }

    // Sanitize HTML content
    const sanitizedContent = sanitizeHtml(body.content);
    
    // Extract variables from content
    const variables = extractVariables(sanitizedContent);
    
    // Create template object
    const template = {
      templateId: uuidv4(),
      userId,
      title: body.title.trim(),
      content: sanitizedContent,
      variables,
      visibility: body.visibility || 'private',
      tags: (body.tags || []).map(tag => tag.trim().toLowerCase()),
      viewers: body.viewers || [],
      shareTokens: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      viewCount: 0,
      useCount: 0,
      // Moderation fields
      // In local mode, auto-approve public templates
      moderationStatus: body.visibility === 'public' 
        ? (process.env.IS_LOCAL === 'true' || process.env.AWS_SAM_LOCAL === 'true' ? 'approved' : 'pending')
        : 'not_required',
      moderationDetails: null,
    };

    // Get user info for author details
    // Note: In production, you might want to cache this or store it differently
    const userEmail = event.requestContext?.authorizer?.claims?.email || 
                     event.requestContext?.authorizer?.claims?.sub || 
                     'Anonymous';
    template.authorEmail = userEmail;
    
    // Save to DynamoDB
    await docClient.send(new PutCommand({
      TableName: process.env.TEMPLATES_TABLE,
      Item: template,
      ConditionExpression: 'attribute_not_exists(templateId)',
    }));

    return createResponse(201, {
      message: 'Template created successfully',
      template: {
        templateId: template.templateId,
        title: template.title,
        visibility: template.visibility,
        variables: template.variables,
        tags: template.tags,
        createdAt: template.createdAt,
        moderationStatus: template.moderationStatus,
      },
    });

  } catch (error) {
    console.error('Error creating template:', error);
    
    if (error.name === 'ConditionalCheckFailedException') {
      return createResponse(409, { error: 'Template already exists' });
    }
    
    return createResponse(500, { 
      error: 'Internal server error',
      message: process.env.ENVIRONMENT === 'development' ? error.message : undefined,
    });
  }
};