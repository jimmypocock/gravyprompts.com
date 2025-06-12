const { GetCommand, PutCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const {
  docClient,
  createResponse,
  getUserIdFromEvent,
} = require('./utils');

exports.handler = async (event) => {
  try {
    const templateId = event.pathParameters?.templateId;
    if (!templateId) {
      return createResponse(400, { error: 'Template ID is required' });
    }

    // Get user ID from authorizer (might be null for public access)
    const userId = getUserIdFromEvent(event);
    
    // Get share token from query parameters if provided
    const shareToken = event.queryStringParameters?.token;

    // Get template from DynamoDB
    const result = await docClient.send(new GetCommand({
      TableName: process.env.TEMPLATES_TABLE,
      Key: { templateId },
    }));

    if (!result.Item) {
      return createResponse(404, { error: 'Template not found' });
    }

    const template = result.Item;

    // Check access permissions
    const isLocal = process.env.IS_LOCAL === 'true' || process.env.AWS_SAM_LOCAL === 'true';
    const isOwner = userId && template.userId === userId;
    // In local mode, don't check moderation status for public templates
    const isPublic = template.visibility === 'public' && (isLocal || template.moderationStatus === 'approved');
    const isViewer = userId && template.viewers?.includes(userId);
    const hasValidShareToken = shareToken && template.shareTokens?.[shareToken] && 
      new Date(template.shareTokens[shareToken].expiresAt) > new Date();

    // Owner can always see their own templates regardless of moderation status
    if (!isOwner && !isPublic && !isViewer && !hasValidShareToken) {
      return createResponse(403, { error: 'Access denied' });
    }

    // Track view (async, don't wait)
    if (!isOwner) {
      trackView(templateId, userId || 'anonymous').catch(console.error);
    }

    // Prepare response based on access level
    const response = {
      templateId: template.templateId,
      title: template.title,
      content: template.content,
      variables: template.variables,
      visibility: template.visibility,
      tags: template.tags,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
      viewCount: template.viewCount,
      useCount: template.useCount,
      authorEmail: template.authorEmail,
      isOwner,
    };

    // Add owner-specific fields
    if (isOwner) {
      response.viewers = template.viewers;
      response.moderationStatus = template.moderationStatus;
      response.moderationDetails = template.moderationDetails;
      // Add active share tokens info (without the actual tokens)
      response.activeShareLinks = Object.entries(template.shareTokens || {})
        .filter(([_, info]) => new Date(info.expiresAt) > new Date())
        .map(([token, info]) => ({
          createdAt: info.createdAt,
          expiresAt: info.expiresAt,
          // Don't expose the actual token in the list
        }));
    }

    return createResponse(200, response);

  } catch (error) {
    console.error('Error getting template:', error);
    return createResponse(500, { 
      error: 'Internal server error',
      message: process.env.ENVIRONMENT === 'development' ? error.message : undefined,
    });
  }
};

// Track template view
async function trackView(templateId, viewerId) {
  const viewId = uuidv4();
  const timestamp = new Date().toISOString();
  const ttl = Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60); // 90 days

  // Record view
  await docClient.send(new PutCommand({
    TableName: process.env.TEMPLATE_VIEWS_TABLE,
    Item: {
      viewId,
      templateId,
      viewerId,
      timestamp,
      ttl,
    },
  }));

  // Increment view count on template
  await docClient.send(new UpdateCommand({
    TableName: process.env.TEMPLATES_TABLE,
    Key: { templateId },
    UpdateExpression: 'ADD viewCount :inc',
    ExpressionAttributeValues: {
      ':inc': 1,
    },
  }));
