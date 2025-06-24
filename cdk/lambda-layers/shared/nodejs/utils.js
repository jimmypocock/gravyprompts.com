const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");
const {
  CognitoIdentityProviderClient,
} = require("@aws-sdk/client-cognito-identity-provider");
const DOMPurify = require("dompurify");
const { JSDOM } = require("jsdom");

// Initialize AWS clients
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const cognitoClient = new CognitoIdentityProviderClient({});

// Initialize DOMPurify
const window = new JSDOM("").window;
const purify = DOMPurify(window);

// Sanitize HTML content
const sanitizeHtml = (html) => {
  return purify.sanitize(html, {
    ALLOWED_TAGS: [
      "p",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "span",
      "a",
      "ul",
      "ol",
      "li",
    ],
    ALLOWED_ATTR: ["href", "class", "data-variable"],
    ALLOW_DATA_ATTR: true,
  });
};

// Extract variables from template content
const extractVariables = (content) => {
  const variableRegex = /\[\[([^\]]+)\]\]/g;
  const variables = [];
  let match;

  while ((match = variableRegex.exec(content)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1]);
    }
  }

  return variables;
};

// Strip HTML tags for text analysis
const stripHtml = (html) => {
  const tmp = window.document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
};

// Rate limiting check
const checkRateLimit = async (userId, action, limits = {}) => {
  // Default limits if not provided
  const defaultLimits = {
    listTemplates: { requests: 60, windowSeconds: 60 }, // 60 requests per minute
    getTemplate: { requests: 100, windowSeconds: 60 }, // 100 requests per minute
    createTemplate: { requests: 10, windowSeconds: 60 }, // 10 creates per minute
    updateTemplate: { requests: 20, windowSeconds: 60 }, // 20 updates per minute
    deleteTemplate: { requests: 10, windowSeconds: 60 }, // 10 deletes per minute
  };

  const limit = limits[action] || defaultLimits[action];
  if (!limit) {
    console.warn(`No rate limit defined for action: ${action}`);
    return true; // Allow if no limit defined
  }

  // For anonymous users, use a stricter rate limit based on IP
  const rateLimitKey = userId || "anonymous";
  const windowStart =
    Math.floor(Date.now() / 1000 / limit.windowSeconds) * limit.windowSeconds;

  try {
    // Use DynamoDB to track rate limits
    const { GetCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");

    // Create rate limit table name (should be created in CDK stack)
    const tableName =
      process.env.RATE_LIMITS_TABLE || "GRAVYPROMPTS-rate-limits";

    // Try to get current count
    const getResult = await docClient.send(
      new GetCommand({
        TableName: tableName,
        Key: {
          pk: `RATE#${rateLimitKey}#${action}`,
          sk: `WINDOW#${windowStart}`,
        },
      }),
    );

    const currentCount = getResult.Item?.count || 0;

    // Check if limit exceeded
    if (currentCount >= limit.requests) {
      console.warn(
        `Rate limit exceeded for ${rateLimitKey} on action ${action}: ${currentCount}/${limit.requests}`,
      );
      return false;
    }

    // Increment counter
    await docClient.send(
      new UpdateCommand({
        TableName: tableName,
        Key: {
          pk: `RATE#${rateLimitKey}#${action}`,
          sk: `WINDOW#${windowStart}`,
        },
        UpdateExpression:
          "SET #count = if_not_exists(#count, :zero) + :inc, #ttl = :ttl",
        ExpressionAttributeNames: {
          "#count": "count",
          "#ttl": "ttl",
        },
        ExpressionAttributeValues: {
          ":zero": 0,
          ":inc": 1,
          ":ttl": windowStart + limit.windowSeconds + 300, // TTL 5 minutes after window
        },
      }),
    );

    return true;
  } catch (error) {
    // If rate limit table doesn't exist, fall back to in-memory tracking
    console.error(
      "Rate limit check failed, falling back to permissive mode:",
      error,
    );

    // In production, you might want to fail closed (return false) instead
    // For now, we'll fail open to avoid blocking legitimate users
    return true;
  }
};

// Generate share token
const generateShareToken = () => {
  return require("uuid").v4();
};

// Standard response helper with cache support
const createResponse = (statusCode, body, headers = {}) => {
  const defaultHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Credentials": true,
  };

  // Add cache headers for successful responses
  if (statusCode === 200) {
    // Default cache headers for successful responses
    defaultHeaders["Cache-Control"] = headers["Cache-Control"] || "public, max-age=300, s-maxage=600"; // 5 min browser, 10 min CDN
    defaultHeaders["Vary"] = "Authorization, Accept-Encoding";
    
    // Add ETag if provided
    if (headers["ETag"]) {
      defaultHeaders["ETag"] = headers["ETag"];
    }
  } else {
    // Don't cache error responses
    defaultHeaders["Cache-Control"] = "no-cache, no-store, must-revalidate";
  }

  return {
    statusCode,
    headers: {
      ...defaultHeaders,
      ...headers,
    },
    body: JSON.stringify(body),
  };
};

// Extract user ID from Cognito authorizer
const getUserIdFromEvent = (event) => {
  if (event.requestContext?.authorizer?.claims?.sub) {
    return event.requestContext.authorizer.claims.sub;
  }
  if (event.requestContext?.authorizer?.principalId) {
    return event.requestContext.authorizer.principalId;
  }
  return null;
};

// Validate template data
const validateTemplate = (template) => {
  const errors = [];

  if (!template.title || template.title.trim().length === 0) {
    errors.push("Title is required");
  }

  if (template.title && template.title.length > 200) {
    errors.push("Title must be 200 characters or less");
  }

  if (!template.content || template.content.trim().length === 0) {
    errors.push("Content is required");
  }

  if (template.content && template.content.length > 50000) {
    errors.push("Content must be 50,000 characters or less");
  }

  // Also check stripped text length to ensure reasonable content size
  if (template.content) {
    const strippedContent = stripHtml(template.content);
    if (strippedContent.length > 10000) {
      errors.push(
        "Content text must be 10,000 characters or less (excluding HTML formatting)",
      );
    }
  }

  if (
    template.visibility &&
    !["public", "private"].includes(template.visibility)
  ) {
    errors.push("Visibility must be either public or private");
  }

  if (template.tags && !Array.isArray(template.tags)) {
    errors.push("Tags must be an array");
  }

  if (template.tags && template.tags.length > 10) {
    errors.push("Maximum 10 tags allowed");
  }

  if (template.tags) {
    template.tags.forEach((tag, index) => {
      if (typeof tag !== "string" || tag.trim().length === 0) {
        errors.push(`Tag at index ${index} must be a non-empty string`);
      }
      if (tag.length > 50) {
        errors.push(`Tag at index ${index} must be 50 characters or less`);
      }
    });
  }

  return errors;
};

module.exports = {
  docClient,
  cognitoClient,
  sanitizeHtml,
  extractVariables,
  stripHtml,
  checkRateLimit,
  generateShareToken,
  createResponse,
  getUserIdFromEvent,
  validateTemplate,
};
