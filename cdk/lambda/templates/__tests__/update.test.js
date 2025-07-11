const {
  createMockDocClient,
  createMockEvent,
  createMockUser,
} = require("../../../test-utils/dynamodb-mock");
const { HTTP_STATUS, TEST_IDS, ERROR_MESSAGES } = require("../../../test-constants");
const { parseResponse, expectSuccessResponse, expectErrorResponse } = require("../../../test-utils/response");

// Create mock client before mocking
const mockDocClient = createMockDocClient();

// Mock the auth module
jest.mock("/opt/nodejs/auth", () => ({
  getUserFromEvent: jest.fn(),
}), { virtual: true });

// Mock the cache module
jest.mock("/opt/nodejs/cache", () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
  clearPattern: jest.fn().mockResolvedValue(undefined),
  keyGenerators: {
    template: jest.fn((id) => `templates:get:${id}`),
    userTemplates: jest.fn((userId) => `templates:user:${userId}`),
  },
}), { virtual: true });

// Mock the utils module
const mockUtils = {
  docClient: mockDocClient,
  sanitizeHtml: jest.fn((html) => html),
  extractVariables: jest.fn(),
  createResponse: jest.fn((statusCode, body, headers = {}) => ({
    statusCode,
    headers: { 
      "Content-Type": "application/json",
      ...headers 
    },
    body: JSON.stringify(body),
  })),
  validateTemplate: jest.fn(() => []),
  checkRateLimit: jest.fn(() => true),
  CACHE_PRESETS: {
    PUBLIC_LONG: "public, max-age=3600, s-maxage=86400",
    PUBLIC_MEDIUM: "public, max-age=300, s-maxage=3600",
    PUBLIC_SHORT: "public, max-age=60, s-maxage=300",
    PRIVATE: "private, max-age=0, no-cache",
    NO_CACHE: "no-cache, no-store, must-revalidate",
    SEARCH: "public, max-age=30, s-maxage=60",
  },
};

jest.mock("/opt/nodejs/utils", () => mockUtils, { virtual: true });

// Mock DynamoDB
jest.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => mockDocClient),
  },
  GetCommand: jest.fn((params) => params),
  UpdateCommand: jest.fn((params) => params),
}));

// Now require the modules
const { handler } = require("../update");
const { getUserFromEvent } = require("/opt/nodejs/auth");

describe("Update Template Lambda", () => {
  // Helper to mock successful GetCommand
  const mockGetTemplate = () => {
    mockDocClient.mockSend.mockResolvedValueOnce({ Item: existingTemplate });
  };

  const existingTemplate = {
    templateId: TEST_IDS.TEMPLATE,
    userId: TEST_IDS.USER,
    title: "Original Title",
    content: "Hello {{name}}!",
    variables: ["name"],
    tags: ["greeting"],
    visibility: "public",
    moderationStatus: "approved",
    createdAt: "2024-01-01T00:00:00Z",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockDocClient.mockSend.mockReset();
    process.env.TEMPLATES_TABLE = "test-templates";
    process.env.ENVIRONMENT = "test";

    // Default mock implementations
    mockUtils.validateTemplate.mockReturnValue([]);
    mockUtils.checkRateLimit.mockResolvedValue(true);
  });

  describe("Successful updates", () => {
    it("should update template title successfully", async () => {
      const user = createMockUser({ sub: TEST_IDS.USER });
      getUserFromEvent.mockResolvedValue(user);

      mockDocClient.mockSend
        .mockResolvedValueOnce({ Item: existingTemplate }) // GetCommand
        .mockResolvedValueOnce({
          // UpdateCommand
          Attributes: {
            ...existingTemplate,
            title: "Updated Title",
            updatedAt: "2024-01-02T00:00:00Z",
          },
        });

      const event = createMockEvent({
        httpMethod: "PUT",
        path: `/templates/${TEST_IDS.TEMPLATE}`,
        pathParameters: { templateId: TEST_IDS.TEMPLATE },
        body: JSON.stringify({
          title: "Updated Title",
        }),
      });

      const response = await handler(event);
      const body = expectSuccessResponse(response, HTTP_STATUS.OK);

      expect(body.message).toBe("Template updated successfully");
      expect(body.template.title).toBe("Updated Title");

      // Verify update command was called correctly
      const updateCall = mockDocClient.mockSend.mock.calls[1][0];
      expect(updateCall.UpdateExpression).toContain("#title = :title");
      expect(updateCall.ExpressionAttributeValues[":title"]).toBe(
        "Updated Title",
      );
    });

    it("should update template content and extract variables", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      mockUtils.extractVariables.mockReturnValue(["firstName", "lastName"]);
      mockDocClient.mockSend
        .mockResolvedValueOnce({ Item: existingTemplate })
        .mockResolvedValueOnce({
          Attributes: {
            ...existingTemplate,
            content: "Hello {{firstName}} {{lastName}}!",
            variables: ["firstName", "lastName"],
            updatedAt: "2024-01-02T00:00:00Z",
          },
        });

      const event = createMockEvent({
        httpMethod: "PUT",
        path: "/templates/template-123",
        pathParameters: { templateId: "template-123" },
        body: JSON.stringify({
          content: "Hello {{firstName}} {{lastName}}!",
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedResponse.template.variables).toEqual([
        "firstName",
        "lastName",
      ]);

      // Verify content was sanitized and variables extracted
      expect(mockUtils.sanitizeHtml).toHaveBeenCalledWith(
        "Hello {{firstName}} {{lastName}}!",
      );
      expect(mockUtils.extractVariables).toHaveBeenCalledWith(
        "Hello {{firstName}} {{lastName}}!",
      );
    });

    it("should update visibility from private to public and reset moderation", async () => {
      const privateTemplate = {
        templateId: "template-123",
        userId: "user-123",
        title: "Original Title",
        content: "Hello {{name}}!",
        variables: ["name"],
        tags: ["greeting"],
        visibility: "private",
        moderationStatus: "not_required",
        createdAt: "2024-01-01T00:00:00Z",
      };
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      mockDocClient.mockSend
        .mockResolvedValueOnce({ Item: privateTemplate })
        .mockResolvedValueOnce({
          Attributes: {
            ...privateTemplate,
            visibility: "public",
            moderationStatus: "pending",
            moderationDetails: null,
            updatedAt: "2024-01-02T00:00:00Z",
          },
        });

      const event = createMockEvent({
        httpMethod: "PUT",
        path: "/templates/template-123",
        pathParameters: { templateId: "template-123" },
        body: JSON.stringify({
          visibility: "public",
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedResponse.template.visibility).toBe("public");
      expect(parsedResponse.template.moderationStatus).toBe("pending");

      // Verify moderation fields were reset
      const updateCall = mockDocClient.mockSend.mock.calls[1][0];
      expect(updateCall.ExpressionAttributeValues[":moderationStatus"]).toBe(
        "pending",
      );
      expect(
        updateCall.ExpressionAttributeValues[":moderationDetails"],
      ).toBeNull();
    });

    it("should update multiple fields at once", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      mockUtils.extractVariables.mockReturnValue(["name", "company"]);

      mockDocClient.mockSend
        .mockResolvedValueOnce({ Item: existingTemplate }) // GetCommand
        .mockResolvedValueOnce({
          // UpdateCommand
          Attributes: {
            ...existingTemplate,
            title: "New Title",
            content: "Welcome {{name}} from {{company}}",
            variables: ["name", "company"],
            tags: ["welcome", "corporate"],
            updatedAt: "2024-01-02T00:00:00Z",
          },
        });

      const event = createMockEvent({
        httpMethod: "PUT",
        path: "/templates/template-123",
        pathParameters: { templateId: "template-123" },
        body: JSON.stringify({
          title: "New Title",
          content: "Welcome {{name}} to {{company}}!",
          tags: ["welcome", "business"],
          viewers: ["user-456", "user-789"],
        }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);

      const updateCall = mockDocClient.mockSend.mock.calls[1][0];
      expect(updateCall.UpdateExpression).toContain("#title = :title");
      expect(updateCall.UpdateExpression).toContain("#content = :content");
      expect(updateCall.UpdateExpression).toContain("#tags = :tags");
      expect(updateCall.UpdateExpression).toContain("#viewers = :viewers");
      expect(updateCall.UpdateExpression).toContain("#variables = :variables");
    });

    it("should handle empty update (no changes)", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      mockDocClient.mockSend
        .mockResolvedValueOnce({ Item: existingTemplate }) // GetCommand
        .mockResolvedValueOnce({
          // UpdateCommand
          Attributes: {
            ...existingTemplate,
            updatedAt: "2024-01-02T00:00:00Z",
          },
        });

      const event = createMockEvent({
        httpMethod: "PUT",
        path: "/templates/template-123",
        pathParameters: { templateId: "template-123" },
        body: JSON.stringify({}),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);

      // Should still update the updatedAt timestamp
      const updateCall = mockDocClient.mockSend.mock.calls[1][0];
      expect(updateCall.UpdateExpression).toBe("SET updatedAt = :updatedAt");
    });
  });

  describe("Authorization and ownership", () => {
    it("should reject updates from non-owner", async () => {
      const user = createMockUser({ sub: TEST_IDS.DIFFERENT_USER });
      getUserFromEvent.mockResolvedValue(user);

      mockDocClient.mockSend
        .mockResolvedValueOnce({ Item: existingTemplate }); // GetCommand - owner is TEST_IDS.USER

      const event = createMockEvent({
        httpMethod: "PUT",
        path: `/templates/${TEST_IDS.TEMPLATE}`,
        pathParameters: { templateId: TEST_IDS.TEMPLATE },
        body: JSON.stringify({
          title: "Hacked Title",
        }),
      });

      const response = await handler(event);
      expectErrorResponse(response, HTTP_STATUS.FORBIDDEN, "You can only edit your own templates");

      // Ensure no update was attempted
      expect(mockDocClient.mockSend).toHaveBeenCalledTimes(1); // Only GetCommand
    });

    it("should reject unauthenticated requests", async () => {
      getUserFromEvent.mockResolvedValue(null);

      const event = createMockEvent({
        httpMethod: "PUT",
        path: `/templates/${TEST_IDS.TEMPLATE}`,
        pathParameters: { templateId: TEST_IDS.TEMPLATE },
        body: JSON.stringify({
          title: "Updated Title",
        }),
      });

      const response = await handler(event);
      expectErrorResponse(response, HTTP_STATUS.UNAUTHORIZED, ERROR_MESSAGES.UNAUTHORIZED);
    });
  });

  describe("Validation", () => {
    it("should reject invalid visibility value", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);
      mockGetTemplate();

      const event = createMockEvent({
        httpMethod: "PUT",
        path: "/templates/template-123",
        pathParameters: { templateId: "template-123" },
        body: JSON.stringify({
          visibility: "secret",
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(parsedResponse.error).toBe(
        "Visibility must be either public or private",
      );
    });

    it("should reject too many tags", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);
      mockGetTemplate();

      const event = createMockEvent({
        httpMethod: "PUT",
        path: "/templates/template-123",
        pathParameters: { templateId: "template-123" },
        body: JSON.stringify({
          tags: Array(11).fill("tag"),
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(parsedResponse.error).toBe("Maximum 10 tags allowed");
    });

    it("should reject non-array tags", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);
      mockGetTemplate();

      const event = createMockEvent({
        httpMethod: "PUT",
        path: "/templates/template-123",
        pathParameters: { templateId: "template-123" },
        body: JSON.stringify({
          tags: "not-an-array",
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(parsedResponse.error).toBe("Tags must be an array");
    });

    it("should reject non-array viewers", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);
      mockGetTemplate();

      const event = createMockEvent({
        httpMethod: "PUT",
        path: "/templates/template-123",
        pathParameters: { templateId: "template-123" },
        body: JSON.stringify({
          viewers: "not-an-array",
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(parsedResponse.error).toBe("Viewers must be an array");
    });

    it("should reject updates that fail template validation", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);
      mockGetTemplate();

      mockUtils.validateTemplate.mockReturnValue([
        "Content is too long",
        "Title contains invalid characters",
      ]);

      const event = createMockEvent({
        httpMethod: "PUT",
        path: "/templates/template-123",
        pathParameters: { templateId: "template-123" },
        body: JSON.stringify({
          title: "Invalid@Title!",
          content: "x".repeat(100000),
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(parsedResponse.error).toBe("Validation failed");
      expect(parsedResponse.details).toEqual([
        "Content is too long",
        "Title contains invalid characters",
      ]);
    });

    it("should trim and lowercase tags", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);
      mockGetTemplate();
      mockDocClient.mockSend.mockResolvedValueOnce({
        Attributes: {
          ...existingTemplate,
          tags: ["greeting", "welcome", "test"],
          updatedAt: "2024-01-02T00:00:00Z",
        },
      });

      const event = createMockEvent({
        httpMethod: "PUT",
        path: "/templates/template-123",
        pathParameters: { templateId: "template-123" },
        body: JSON.stringify({
          tags: ["  GREETING  ", "Welcome", "  test  "],
        }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);

      const updateCall = mockDocClient.mockSend.mock.calls[1][0];
      expect(updateCall.ExpressionAttributeValues[":tags"]).toEqual([
        "greeting",
        "welcome",
        "test",
      ]);
    });

    it("should trim title", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);
      mockGetTemplate();
      mockDocClient.mockSend.mockResolvedValueOnce({
        Attributes: {
          ...existingTemplate,
          title: "Trimmed Title",
          updatedAt: "2024-01-02T00:00:00Z",
        },
      });

      const event = createMockEvent({
        httpMethod: "PUT",
        path: "/templates/template-123",
        pathParameters: { templateId: "template-123" },
        body: JSON.stringify({
          title: "  Trimmed Title  ",
        }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);

      const updateCall = mockDocClient.mockSend.mock.calls[1][0];
      expect(updateCall.ExpressionAttributeValues[":title"]).toBe(
        "Trimmed Title",
      );
    });
  });

  describe("Error handling", () => {
    it("should handle missing templateId parameter", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      const event = createMockEvent({
        httpMethod: "PUT",
        path: "/templates/",
        pathParameters: {},
        body: JSON.stringify({
          title: "Updated Title",
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(parsedResponse.error).toBe("Template ID is required");
    });

    it("should handle non-existent template", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      mockDocClient.mockSend.mockResolvedValueOnce({});

      const event = createMockEvent({
        httpMethod: "PUT",
        path: "/templates/non-existent",
        pathParameters: { templateId: "non-existent" },
        body: JSON.stringify({
          title: "Updated Title",
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(404);
      expect(parsedResponse.error).toBe("Template not found");
    });

    it("should handle DynamoDB errors", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      mockDocClient.mockSend
        .mockResolvedValueOnce({ Item: existingTemplate })
        .mockRejectedValueOnce(new Error("DynamoDB error"));

      const event = createMockEvent({
        httpMethod: "PUT",
        path: "/templates/template-123",
        pathParameters: { templateId: "template-123" },
        body: JSON.stringify({
          title: "Updated Title",
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(500);
      expect(parsedResponse.error).toBe("Internal server error");
    });

    it("should handle invalid JSON in request body", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      const event = createMockEvent({
        httpMethod: "PUT",
        path: "/templates/template-123",
        pathParameters: { templateId: "template-123" },
        body: "invalid json",
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(500);
      expect(parsedResponse.error).toBe("Internal server error");
    });
  });

  describe("Rate limiting", () => {
    it("should reject when rate limit is exceeded", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      mockUtils.checkRateLimit.mockResolvedValue(false);

      const event = createMockEvent({
        httpMethod: "PUT",
        path: "/templates/template-123",
        pathParameters: { templateId: "template-123" },
        body: JSON.stringify({
          title: "Updated Title",
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(429);
      expect(parsedResponse.error).toBe("Rate limit exceeded");
    });
  });

  describe("Edge cases", () => {
    it("should not change visibility from public to public", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);
      mockGetTemplate();
      mockDocClient.mockSend.mockResolvedValueOnce({
        Attributes: {
          ...existingTemplate,
          updatedAt: "2024-01-02T00:00:00Z",
        },
      });

      const event = createMockEvent({
        httpMethod: "PUT",
        path: "/templates/template-123",
        pathParameters: { templateId: "template-123" },
        body: JSON.stringify({
          visibility: "public", // Already public
        }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);

      // Should not reset moderation status
      const updateCall = mockDocClient.mockSend.mock.calls[1][0];
      expect(
        updateCall.ExpressionAttributeValues[":moderationStatus"],
      ).toBeUndefined();
    });

    it("should handle undefined fields gracefully", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);
      mockGetTemplate();
      mockDocClient.mockSend.mockResolvedValueOnce({
        Attributes: {
          ...existingTemplate,
          title: "New Title",
          updatedAt: "2024-01-02T00:00:00Z",
        },
      });

      const event = createMockEvent({
        httpMethod: "PUT",
        path: "/templates/template-123",
        pathParameters: { templateId: "template-123" },
        body: JSON.stringify({
          title: undefined,
          content: "New content",
          tags: undefined,
        }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);

      // Only content should be updated
      const updateCall = mockDocClient.mockSend.mock.calls[1][0];
      expect(updateCall.UpdateExpression).toContain("#content = :content");
      expect(updateCall.UpdateExpression).not.toContain("#title");
      expect(updateCall.UpdateExpression).not.toContain("#tags");
    });
  });
});
