const {
  GetCommand,
  PutCommand,
  UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");
const { v4: uuidv4 } = require("uuid");
const {
  docClient,
  createResponse,
  checkRateLimit,
  CACHE_PRESETS,
} = require("/opt/nodejs/utils");
const { getUserFromEvent } = require("/opt/nodejs/auth");
const cache = require("/opt/nodejs/cache");

exports.handler = async (event) => {
  let template; // Declare template in outer scope for cache header access
  
  try {
    const templateId = event.pathParameters?.templateId;
    if (!templateId) {
      return createResponse(400, { error: "Template ID is required" });
    }

    // Get user from authorizer (might be null for public access)
    const user = await getUserFromEvent(event);
    const userId = user ? user.sub : null;

    // Check rate limit - use IP for anonymous users
    const rateLimitKey =
      userId || event.requestContext?.identity?.sourceIp || "unknown";
    const isAllowed = await checkRateLimit(rateLimitKey, "getTemplate");

    if (!isAllowed) {
      return createResponse(429, {
        error: "Too many requests",
        message: "Please slow down your requests",
      });
    }

    // Get share token from query parameters if provided
    const shareToken = event.queryStringParameters?.token;

    // Check cache first for public templates (no share token)
    const cacheKey = cache.keyGenerators.template(templateId);
    if (!shareToken && !userId) {
      const cachedTemplate = await cache.get(cacheKey);
      if (cachedTemplate) {
        console.log(`Cache hit for template: ${templateId}`);
        return createResponse(200, cachedTemplate);
      }
    }

    // Get template from DynamoDB
    const result = await docClient.send(
      new GetCommand({
        TableName: process.env.TEMPLATES_TABLE,
        Key: { templateId },
      }),
    );

    if (!result.Item) {
      return createResponse(404, { error: "Template not found" });
    }

    template = result.Item;

    // Check access permissions
    const isOwner = userId && template.userId === userId;
    const isPublic =
      template.visibility === "public" &&
      template.moderationStatus === "approved";
    const isViewer = userId && template.viewers?.includes(userId);
    const hasValidShareToken =
      shareToken &&
      template.shareTokens?.[shareToken] &&
      new Date(template.shareTokens[shareToken].expiresAt) > new Date();

    // Owner can always see their own templates regardless of moderation status
    if (!isOwner && !isPublic && !isViewer && !hasValidShareToken) {
      return createResponse(403, { error: "Access denied" });
    }

    // Track view only for authenticated users (prevent anonymous view bombing)
    if (!isOwner && userId) {
      trackView(templateId, userId).catch(console.error);
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

    // Cache public templates for anonymous users
    if (!shareToken && !userId && isPublic) {
      await cache.set(cacheKey, response, cache.DEFAULT_TTL);
      console.log(`Cached public template: ${templateId}`);
    }

    // Determine cache headers based on template visibility and user
    let cacheControl;
    if (template.visibility === 'private' || response.isOwner) {
      // Private templates or owner views should not be cached by CDN
      cacheControl = CACHE_PRESETS.PRIVATE;
    } else if (template.moderationStatus === 'approved' && template.visibility === 'public') {
      // Public approved templates can be cached longer
      cacheControl = CACHE_PRESETS.PUBLIC_LONG;
    } else {
      // Default to no caching for templates pending moderation
      cacheControl = CACHE_PRESETS.NO_CACHE;
    }

    return createResponse(200, response, {
      'Cache-Control': cacheControl,
    });
  } catch (error) {
    console.error("Error getting template:", error);
    return createResponse(500, {
      error: "Internal server error",
      message:
        process.env.ENVIRONMENT === "development" ? error.message : undefined,
    });
  }
};

// Track template view
async function trackView(templateId, viewerId) {
  const viewId = uuidv4();
  const timestamp = new Date().toISOString();
  const ttl = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60; // 90 days

  // Record view
  await docClient.send(
    new PutCommand({
      TableName: process.env.TEMPLATE_VIEWS_TABLE,
      Item: {
        viewId,
        templateId,
        viewerId,
        timestamp,
        ttl,
      },
    }),
  );

  // Increment view count on template
  await docClient.send(
    new UpdateCommand({
      TableName: process.env.TEMPLATES_TABLE,
      Key: { templateId },
      UpdateExpression: "ADD viewCount :inc",
      ExpressionAttributeValues: {
        ":inc": 1,
      },
    }),
  );
}
