const {
  createMockDocClient,
  createMockEvent,
  createMockUser,
} = require("../../../test-utils/dynamodb-mock");

// Create mock client before mocking
const mockDocClient = createMockDocClient();

// Mock uuid
jest.mock("uuid", () => ({
  v4: jest.fn(() => "template-123"),
}));

// Mock the auth module
jest.mock("/opt/nodejs/auth", () => ({
  getUserFromEvent: jest.fn(),
}));

// Mock the utils module
const mockUtils = {
  docClient: mockDocClient,
  sanitizeHtml: jest.fn((html) => html),
  extractVariables: jest.fn(),
  createResponse: jest.fn((statusCode, body) => ({
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })),
  validateTemplate: jest.fn(() => []),
  checkRateLimit: jest.fn(() => true),
};

jest.mock("/opt/nodejs/utils", () => mockUtils);

// Mock DynamoDB
jest.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => mockDocClient),
  },
  PutCommand: jest.fn((params) => params),
}));

// Now require the modules
const { handler } = require("../create");
const { getUserFromEvent } = require("/opt/nodejs/auth");
const { PutCommand } = require("@aws-sdk/lib-dynamodb");

describe("Create Template Lambda", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDocClient.mockSend.mockReset();
    process.env.TEMPLATES_TABLE = "test-templates";
    process.env.ENVIRONMENT = "test";

    // Default mock implementations
    mockUtils.extractVariables.mockReturnValue(["name", "email"]);
    mockUtils.validateTemplate.mockReturnValue([]);
    mockUtils.checkRateLimit.mockResolvedValue(true);
    mockDocClient.mockSend.mockResolvedValue({});
  });

  describe("Successful template creation", () => {
    it("should create a public template successfully", async () => {
      const user = createMockUser({
        sub: "user-123",
        email: "test@example.com",
      });
      getUserFromEvent.mockResolvedValue(user);

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates",
        body: JSON.stringify({
          title: "Test Template",
          content: "Hello {{name}}, welcome to {{company}}!",
          tags: ["greeting", "welcome"],
          visibility: "public",
        }),
        requestContext: {
          authorizer: {
            claims: {
              email: "test@example.com",
            },
          },
        },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(201);
      expect(parsedResponse.message).toBe("Template created successfully");
      expect(parsedResponse.template).toMatchObject({
        templateId: "template-123",
        title: "Test Template",
        visibility: "public",
        moderationStatus: "pending",
        tags: ["greeting", "welcome"],
      });

      // Verify DynamoDB put was called
      expect(mockDocClient.mockSend).toHaveBeenCalledTimes(1);
      const putCommandCall = mockDocClient.mockSend.mock.calls[0][0];
      expect(putCommandCall).toMatchObject({
        TableName: "test-templates",
        Item: expect.objectContaining({
          templateId: "template-123",
          title: "Test Template",
          content: "Hello {{name}}, welcome to {{company}}!",
          visibility: "public",
          moderationStatus: "pending",
          authorId: "user-123",
        }),
        ConditionExpression: "attribute_not_exists(templateId)",
      });
    });

    it("should create a private template without moderation", async () => {
      const user = createMockUser({
        sub: "user-123",
        email: "test@example.com",
      });
      getUserFromEvent.mockResolvedValue(user);

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates",
        body: JSON.stringify({
          title: "Private Template",
          content: "Internal use only: {{secret}}",
          tags: ["private"],
          visibility: "private",
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(201);
      expect(parsedResponse.template.visibility).toBe("private");
      expect(parsedResponse.template.moderationStatus).toBe("not_required");
    });
  });

  describe("Validation failures", () => {
    it("should reject template with validation errors", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      mockUtils.validateTemplate.mockReturnValue([
        "Title is required",
        "Content is too short",
      ]);

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates",
        body: JSON.stringify({
          content: "Hi",
          tags: ["test"],
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(parsedResponse.error).toBe("Validation failed");
      expect(parsedResponse.details).toEqual([
        "Title is required",
        "Content is too short",
      ]);
    });
  });

  describe("Rate limiting", () => {
    it("should reject when rate limit is exceeded", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      mockUtils.checkRateLimit.mockResolvedValue(false);

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates",
        body: JSON.stringify({
          title: "Test Template",
          content: "Content",
          tags: ["test"],
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(429);
      expect(parsedResponse.error).toBe("Rate limit exceeded");
    });
  });

  describe("Authentication", () => {
    it("should reject unauthenticated requests", async () => {
      getUserFromEvent.mockResolvedValue(null);

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates",
        body: JSON.stringify({
          title: "Test Template",
          content: "Content",
          tags: ["test"],
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(401);
      expect(parsedResponse.error).toBe("Unauthorized");
    });
  });

  describe("Error handling", () => {
    it("should handle DynamoDB errors gracefully", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      // Mock DynamoDB error
      mockDocClient.mockSend.mockRejectedValue(new Error("DynamoDB error"));

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates",
        body: JSON.stringify({
          title: "Test Template",
          content: "Content",
          tags: ["test"],
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(500);
      expect(parsedResponse.error).toBe("Internal server error");
    });

    it("should handle duplicate template error", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      // Mock ConditionalCheckFailedException
      const error = new Error("The conditional request failed");
      error.name = "ConditionalCheckFailedException";
      mockDocClient.mockSend.mockRejectedValue(error);

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates",
        body: JSON.stringify({
          title: "Test Template",
          content: "Content",
          tags: ["test"],
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(409);
      expect(parsedResponse.error).toBe("Template already exists");
    });

    it("should handle invalid JSON in request body", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates",
        body: "invalid json",
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(500);
      expect(parsedResponse.error).toBe("Internal server error");
    });
  });

  describe("Variable extraction", () => {
    it("should extract and store template variables", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      mockUtils.extractVariables.mockReturnValue([
        "firstName",
        "lastName",
        "email",
      ]);

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates",
        body: JSON.stringify({
          title: "Contact Template",
          content:
            "Hello {{firstName}} {{lastName}}, we will contact you at {{email}}",
          tags: ["contact"],
          visibility: "public",
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(201);
      expect(parsedResponse.template.variables).toEqual([
        "firstName",
        "lastName",
        "email",
      ]);

      // Verify that extractVariables was called with the content
      expect(mockUtils.extractVariables).toHaveBeenCalledWith(
        "Hello {{firstName}} {{lastName}}, we will contact you at {{email}}",
      );
    });
  });
});
