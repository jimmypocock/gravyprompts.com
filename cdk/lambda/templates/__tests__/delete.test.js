const {
  createMockDocClient,
  createMockEvent,
  createMockUser,
} = require("../../../test-utils/dynamodb-mock");

// Create mock client before mocking
const mockDocClient = createMockDocClient();

// Mock the auth module
jest.mock("/opt/nodejs/auth", () => ({
  getUserFromEvent: jest.fn(),
}), { virtual: true });

// Mock the utils module
const mockUtils = {
  docClient: mockDocClient,
  createResponse: jest.fn((statusCode, body) => ({
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })),
  checkRateLimit: jest.fn(() => true),
};

jest.mock("/opt/nodejs/utils", () => mockUtils, { virtual: true });

// Mock DynamoDB
jest.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => mockDocClient),
  },
  GetCommand: jest.fn((params) => params),
  DeleteCommand: jest.fn((params) => params),
}));

// Now require the modules
const { handler } = require("../delete");
const { getUserFromEvent } = require("/opt/nodejs/auth");

describe("Delete Template Lambda", () => {
  const existingTemplate = {
    templateId: "template-123",
    userId: "user-123",
    title: "My Template",
    content: "Hello {{name}}!",
    visibility: "public",
    createdAt: "2024-01-01T00:00:00Z",
    viewCount: 10,
    shares: 5,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockDocClient.mockSend.mockReset();
    process.env.TEMPLATES_TABLE = "test-templates";
    process.env.ENVIRONMENT = "test";

    // Default: template exists and delete succeeds
    mockDocClient.mockSend
      .mockResolvedValueOnce({ Item: existingTemplate }) // GetCommand
      .mockResolvedValueOnce({}); // DeleteCommand

    mockUtils.checkRateLimit.mockResolvedValue(true);
  });

  describe("Successful deletion", () => {
    it("should delete template successfully when user owns it", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      const event = createMockEvent({
        httpMethod: "DELETE",
        path: "/templates/template-123",
        pathParameters: { templateId: "template-123" },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedResponse.message).toBe("Template deleted successfully");
      expect(parsedResponse.templateId).toBe("template-123");

      // Verify delete command was called with ownership check
      const deleteCall = mockDocClient.mockSend.mock.calls[1][0];
      expect(deleteCall).toMatchObject({
        TableName: "test-templates",
        Key: { templateId: "template-123" },
        ConditionExpression: "userId = :userId",
        ExpressionAttributeValues: { ":userId": "user-123" },
      });
    });

    it("should check template existence before deletion", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      const event = createMockEvent({
        httpMethod: "DELETE",
        path: "/templates/template-123",
        pathParameters: { templateId: "template-123" },
      });

      await handler(event);

      // Verify GetCommand was called first
      expect(mockDocClient.mockSend).toHaveBeenCalledTimes(2);
      const getCall = mockDocClient.mockSend.mock.calls[0][0];
      expect(getCall).toMatchObject({
        TableName: "test-templates",
        Key: { templateId: "template-123" },
      });
    });
  });

  describe("Authorization and ownership", () => {
    it("should reject deletion from non-owner", async () => {
      const user = createMockUser({ sub: "different-user" });
      getUserFromEvent.mockResolvedValue(user);

      const event = createMockEvent({
        httpMethod: "DELETE",
        path: "/templates/template-123",
        pathParameters: { templateId: "template-123" },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(403);
      expect(parsedResponse.error).toBe(
        "You can only delete your own templates",
      );

      // Ensure no delete was attempted
      expect(mockDocClient.mockSend).toHaveBeenCalledTimes(1); // Only GetCommand
    });

    it("should reject unauthenticated requests", async () => {
      getUserFromEvent.mockResolvedValue(null);

      const event = createMockEvent({
        httpMethod: "DELETE",
        path: "/templates/template-123",
        pathParameters: { templateId: "template-123" },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(401);
      expect(parsedResponse.error).toBe("Unauthorized");

      // Ensure no database operations were attempted
      expect(mockDocClient.mockSend).not.toHaveBeenCalled();
    });

    it("should reject when user sub is missing", async () => {
      getUserFromEvent.mockResolvedValue({ email: "user@example.com" }); // No sub

      const event = createMockEvent({
        httpMethod: "DELETE",
        path: "/templates/template-123",
        pathParameters: { templateId: "template-123" },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(401);
      expect(parsedResponse.error).toBe("Unauthorized");
    });
  });

  describe("Error handling", () => {
    it("should handle missing templateId parameter", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      const event = createMockEvent({
        httpMethod: "DELETE",
        path: "/templates/",
        pathParameters: {}, // No templateId
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(parsedResponse.error).toBe("Template ID is required");
    });

    it("should handle non-existent template", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      // Reset and configure mock for this specific test
      mockDocClient.mockSend.mockReset();
      mockDocClient.mockSend.mockResolvedValueOnce({ Item: null }); // Template not found

      const event = createMockEvent({
        httpMethod: "DELETE",
        path: "/templates/non-existent",
        pathParameters: { templateId: "non-existent" },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(404);
      expect(parsedResponse.error).toBe("Template not found");
    });

    it("should handle DynamoDB GetCommand errors", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      // Reset and configure mock for this specific test
      mockDocClient.mockSend.mockReset();
      mockDocClient.mockSend.mockRejectedValueOnce(
        new Error("DynamoDB Get error"),
      );

      const event = createMockEvent({
        httpMethod: "DELETE",
        path: "/templates/template-123",
        pathParameters: { templateId: "template-123" },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(500);
      expect(parsedResponse.error).toBe("Internal server error");
      // Message field is not included in test environment
    });

    it("should handle DynamoDB DeleteCommand errors", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      // Reset and configure mock for this specific test
      mockDocClient.mockSend.mockReset();
      mockDocClient.mockSend
        .mockResolvedValueOnce({ Item: existingTemplate })
        .mockRejectedValueOnce(new Error("DynamoDB Delete error"));

      const event = createMockEvent({
        httpMethod: "DELETE",
        path: "/templates/template-123",
        pathParameters: { templateId: "template-123" },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(500);
      expect(parsedResponse.error).toBe("Internal server error");
    });

    it("should handle ConditionalCheckFailedException", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      const error = new Error("The conditional request failed");
      error.name = "ConditionalCheckFailedException";

      // Reset and configure mock for this specific test
      mockDocClient.mockSend.mockReset();
      mockDocClient.mockSend
        .mockResolvedValueOnce({ Item: existingTemplate })
        .mockRejectedValueOnce(error);

      const event = createMockEvent({
        httpMethod: "DELETE",
        path: "/templates/template-123",
        pathParameters: { templateId: "template-123" },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(403);
      expect(parsedResponse.error).toBe("Permission denied");
    });
  });

  describe("Rate limiting", () => {
    it("should reject when rate limit is exceeded", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      mockUtils.checkRateLimit.mockResolvedValue(false);

      const event = createMockEvent({
        httpMethod: "DELETE",
        path: "/templates/template-123",
        pathParameters: { templateId: "template-123" },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(429);
      expect(parsedResponse.error).toBe("Rate limit exceeded");

      // Ensure no database operations were attempted
      expect(mockDocClient.mockSend).not.toHaveBeenCalled();
    });

    it("should check rate limit with correct parameters", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      const event = createMockEvent({
        httpMethod: "DELETE",
        path: "/templates/template-123",
        pathParameters: { templateId: "template-123" },
      });

      await handler(event);

      expect(mockUtils.checkRateLimit).toHaveBeenCalledWith(
        "user-123",
        "deleteTemplate",
      );
    });
  });

  describe("Edge cases", () => {
    it("should handle template with related data gracefully", async () => {
      const templateWithRelatedData = {
        ...existingTemplate,
        shareTokens: { "token-123": { createdAt: "2024-01-01" } },
        viewers: ["user-456", "user-789"],
      };

      mockDocClient.mockSend
        .mockResolvedValueOnce({ Item: templateWithRelatedData })
        .mockResolvedValueOnce({});

      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      const event = createMockEvent({
        httpMethod: "DELETE",
        path: "/templates/template-123",
        pathParameters: { templateId: "template-123" },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      // Note: The TODO comment in the handler mentions cleaning up related data
      // This test verifies the current behavior deletes the template regardless
    });

    it("should handle missing pathParameters gracefully", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      const event = createMockEvent({
        httpMethod: "DELETE",
        path: "/templates/",
        // pathParameters is undefined
      });
      delete event.pathParameters;

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(parsedResponse.error).toBe("Template ID is required");
    });
  });

  describe("Security considerations", () => {
    it("should not leak template information to unauthorized users", async () => {
      const user = createMockUser({ sub: "attacker" });
      getUserFromEvent.mockResolvedValue(user);

      const event = createMockEvent({
        httpMethod: "DELETE",
        path: "/templates/template-123",
        pathParameters: { templateId: "template-123" },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      // Should only say they can't delete, not reveal template details
      expect(response.statusCode).toBe(403);
      expect(parsedResponse.error).toBe(
        "You can only delete your own templates",
      );
      expect(parsedResponse).not.toHaveProperty("title");
      expect(parsedResponse).not.toHaveProperty("content");
    });

    it("should use condition expression for atomic deletion", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      const event = createMockEvent({
        httpMethod: "DELETE",
        path: "/templates/template-123",
        pathParameters: { templateId: "template-123" },
      });

      await handler(event);

      // Verify the delete uses a condition to ensure ownership hasn't changed
      const deleteCall = mockDocClient.mockSend.mock.calls[1][0];
      expect(deleteCall.ConditionExpression).toBe("userId = :userId");
      expect(deleteCall.ExpressionAttributeValues[":userId"]).toBe("user-123");
    });
  });
});
