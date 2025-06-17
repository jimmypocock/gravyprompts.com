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
}));

// Mock DynamoDB
jest.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: jest.fn(() => ({})),
}));

jest.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => mockDocClient),
  },
  QueryCommand: jest.fn((params) => params),
}));

// Now require the handler
const { handler } = require("../list");
const { getUserFromEvent } = require("/opt/nodejs/auth");

describe("List Prompts Lambda", () => {
  const mockPrompts = [
    {
      promptId: "prompt-1",
      userId: "user-123",
      templateId: "template-1",
      templateTitle: "Email Template",
      content: "Hello John!",
      variables: { name: "John" },
      createdAt: "2024-01-03T00:00:00Z",
      updatedAt: "2024-01-03T00:00:00Z",
    },
    {
      promptId: "prompt-2",
      userId: "user-123",
      templateId: "template-2",
      templateTitle: "Welcome Template",
      content: "Welcome to Acme Corp!",
      variables: { company: "Acme Corp" },
      createdAt: "2024-01-02T00:00:00Z",
      updatedAt: "2024-01-02T00:00:00Z",
    },
    {
      promptId: "prompt-3",
      userId: "user-123",
      templateId: null,
      templateTitle: "Custom Note",
      content: "Custom content here",
      variables: {},
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockDocClient.mockSend.mockReset();
    process.env.USER_PROMPTS_TABLE = "test-user-prompts";
  });

  describe("Successful listing", () => {
    it("should list user prompts successfully", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      mockDocClient.mockSend.mockResolvedValueOnce({
        Items: mockPrompts,
        Count: 3,
      });

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/prompts",
        queryStringParameters: null,
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(response.headers).toEqual({
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      });
      expect(parsedResponse.items).toEqual(mockPrompts);
      expect(parsedResponse.count).toBe(3);
      expect(parsedResponse.lastKey).toBeUndefined();

      // Verify query parameters
      const queryCall = mockDocClient.mockSend.mock.calls[0][0];
      expect(queryCall).toMatchObject({
        TableName: "test-user-prompts",
        IndexName: "userId-createdAt-index",
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: { ":userId": "user-123" },
        ScanIndexForward: false, // Most recent first
        Limit: 20, // Default limit
      });
    });

    it("should handle empty results", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      mockDocClient.mockSend.mockResolvedValueOnce({
        Items: [],
        Count: 0,
      });

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/prompts",
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedResponse.items).toEqual([]);
      expect(parsedResponse.count).toBe(0);
    });

    it("should handle custom limit parameter", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      mockDocClient.mockSend.mockResolvedValueOnce({
        Items: mockPrompts.slice(0, 2),
        Count: 2,
      });

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/prompts",
        queryStringParameters: { limit: "10" },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedResponse.count).toBe(2);

      const queryCall = mockDocClient.mockSend.mock.calls[0][0];
      expect(queryCall.Limit).toBe(10);
    });

    it("should handle pagination with lastKey", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      const lastEvaluatedKey = {
        userId: "user-123",
        createdAt: "2024-01-02T00:00:00Z",
        promptId: "prompt-2",
      };

      mockDocClient.mockSend.mockResolvedValueOnce({
        Items: [mockPrompts[2]], // Only the oldest item
        Count: 1,
        LastEvaluatedKey: null,
      });

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/prompts",
        queryStringParameters: {
          lastKey: encodeURIComponent(JSON.stringify(lastEvaluatedKey)),
        },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedResponse.count).toBe(1);
      expect(parsedResponse.lastKey).toBeUndefined();

      const queryCall = mockDocClient.mockSend.mock.calls[0][0];
      expect(queryCall.ExclusiveStartKey).toEqual(lastEvaluatedKey);
    });

    it("should return nextKey when more results exist", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      const lastEvaluatedKey = {
        userId: "user-123",
        createdAt: "2024-01-02T00:00:00Z",
        promptId: "prompt-2",
      };

      mockDocClient.mockSend.mockResolvedValueOnce({
        Items: mockPrompts.slice(0, 2),
        Count: 2,
        LastEvaluatedKey: lastEvaluatedKey,
      });

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/prompts",
        queryStringParameters: { limit: "2" },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedResponse.lastKey).toBe(
        encodeURIComponent(JSON.stringify(lastEvaluatedKey)),
      );
    });
  });

  describe("Authentication", () => {
    it("should require authentication", async () => {
      getUserFromEvent.mockResolvedValue(null);

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/prompts",
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(401);
      expect(parsedResponse.error).toBe("Unauthorized");
      expect(mockDocClient.mockSend).not.toHaveBeenCalled();
    });

    it("should reject when user has no sub", async () => {
      getUserFromEvent.mockResolvedValue({ email: "user@example.com" }); // No sub

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/prompts",
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(401);
      expect(parsedResponse.error).toBe("Unauthorized");
    });
  });

  describe("Error handling", () => {
    it("should handle DynamoDB errors", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      mockDocClient.mockSend.mockRejectedValueOnce(new Error("DynamoDB error"));

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/prompts",
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(500);
      expect(parsedResponse.error).toBe("Failed to list prompts");
    });

    it("should handle invalid lastKey parameter", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      const consoleWarnSpy = jest
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      mockDocClient.mockSend.mockResolvedValueOnce({
        Items: mockPrompts,
        Count: 3,
      });

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/prompts",
        queryStringParameters: {
          lastKey: "invalid-json",
        },
      });

      const response = await handler(event);

      // Should still work, just ignore invalid lastKey
      expect(response.statusCode).toBe(200);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Invalid lastKey parameter:",
        expect.any(String),
      );

      consoleWarnSpy.mockRestore();
    });

    it("should handle getUserFromEvent errors", async () => {
      getUserFromEvent.mockRejectedValueOnce(new Error("Auth error"));

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/prompts",
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(500);
      expect(parsedResponse.error).toBe("Failed to list prompts");
    });
  });

  describe("Query parameters", () => {
    it("should handle invalid limit parameter", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      mockDocClient.mockSend.mockResolvedValueOnce({
        Items: mockPrompts,
        Count: 3,
      });

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/prompts",
        queryStringParameters: { limit: "invalid" },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);

      // Should use default limit
      const queryCall = mockDocClient.mockSend.mock.calls[0][0];
      expect(queryCall.Limit).toBe(20);
    });

    it("should handle negative limit parameter", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      mockDocClient.mockSend.mockResolvedValueOnce({
        Items: mockPrompts,
        Count: 3,
      });

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/prompts",
        queryStringParameters: { limit: "-5" },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);

      // Should use default limit
      const queryCall = mockDocClient.mockSend.mock.calls[0][0];
      expect(queryCall.Limit).toBe(20);
    });

    it("should handle very large limit parameter", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      mockDocClient.mockSend.mockResolvedValueOnce({
        Items: mockPrompts,
        Count: 3,
      });

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/prompts",
        queryStringParameters: { limit: "1000" },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);

      // Should allow large limit (DynamoDB will cap it)
      const queryCall = mockDocClient.mockSend.mock.calls[0][0];
      expect(queryCall.Limit).toBe(1000);
    });
  });

  describe("Logging", () => {
    it("should log list event and results", async () => {
      const consoleLogSpy = jest
        .spyOn(console, "log")
        .mockImplementation(() => {});
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      mockDocClient.mockSend.mockResolvedValueOnce({
        Items: mockPrompts,
        Count: 3,
      });

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/prompts",
      });

      await handler(event);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "List prompts event:",
        expect.stringContaining('"httpMethod": "GET"'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "Found 3 prompts for user user-123",
      );

      consoleLogSpy.mockRestore();
    });

    it("should log errors", async () => {
      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      const error = new Error("DynamoDB error");
      mockDocClient.mockSend.mockRejectedValueOnce(error);

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/prompts",
      });

      await handler(event);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error listing prompts:",
        error,
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe("Environment variables", () => {
    it.skip("should use environment variable for table name", async () => {
      process.env.USER_PROMPTS_TABLE = "custom-prompts-table";

      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      mockDocClient.mockSend.mockResolvedValueOnce({
        Items: [],
        Count: 0,
      });

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/prompts",
      });

      await handler(event);

      const queryCall = mockDocClient.mockSend.mock.calls[0][0];
      expect(queryCall.TableName).toBe("custom-prompts-table");
    });
  });

  describe("Edge cases", () => {
    it("should handle undefined Items in response", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      mockDocClient.mockSend.mockResolvedValueOnce({
        // No Items property
        Count: 0,
      });

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/prompts",
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedResponse.items).toEqual([]);
      expect(parsedResponse.count).toBe(0);
    });

    it("should handle missing queryStringParameters", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      mockDocClient.mockSend.mockResolvedValueOnce({
        Items: mockPrompts,
        Count: 3,
      });

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/prompts",
      });
      delete event.queryStringParameters;

      const response = await handler(event);

      expect(response.statusCode).toBe(200);

      // Should use default limit
      const queryCall = mockDocClient.mockSend.mock.calls[0][0];
      expect(queryCall.Limit).toBe(20);
      expect(queryCall.ExclusiveStartKey).toBeUndefined();
    });
  });
});
