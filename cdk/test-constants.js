// Common test constants to avoid magic numbers and strings
module.exports = {
  HTTP_STATUS: {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    RATE_LIMITED: 429,
    SERVER_ERROR: 500,
  },
  
  TEST_IDS: {
    USER: "user-123",
    OTHER_USER: "user-456",
    DIFFERENT_USER: "different-user",
    TEMPLATE: "template-123",
    TEMPLATE_2: "template-456",
    PROMPT: "prompt-123",
    NON_EXISTENT: "non-existent",
  },
  
  TEST_TABLES: {
    TEMPLATES: "test-templates",
    USER_PROMPTS: "test-user-prompts",
    TEMPLATE_VIEWS: "test-template-views",
    USER_PERMISSIONS: "test-user-permissions",
    APPROVAL_HISTORY: "test-approval-history",
  },
  
  TEST_DATES: {
    CREATED: "2024-01-01T00:00:00Z",
    UPDATED: "2024-01-02T00:00:00Z",
  },
  
  ERROR_MESSAGES: {
    UNAUTHORIZED: "Unauthorized",
    NOT_FOUND: "Template not found",
    PERMISSION_DENIED: "Permission denied",
    RATE_LIMITED: "Rate limit exceeded",
    VALIDATION_FAILED: "Validation failed",
    INTERNAL_ERROR: "Internal server error",
  },
};