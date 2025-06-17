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
  GetCommand: jest.fn((params) => params),
  DeleteCommand: jest.fn((params) => params),
}));

// Now require the handler
const { handler } = require("../delete");
const { getUserFromEvent } = require("/opt/nodejs/auth");

describe("Delete Prompt Lambda", () => {
  const existingPrompt = {
    promptId: "prompt-123",
    userId: "user-123",
    templateId: "template-456",
    templateTitle: "Email Template",
    content: "Hello John!",
    variables: { name: "John" },
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockDocClient.mockSend.mockReset();
    process.env.USER_PROMPTS_TABLE = "test-user-prompts";
  });

  describe("Successful deletion", () => {
    it("should delete prompt successfully when user owns it", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      mockDocClient.mockSend
        .mockResolvedValueOnce({ Item: existingPrompt }) // GetCommand
        .mockResolvedValueOnce({}); // DeleteCommand

      const event = createMockEvent({
        httpMethod: "DELETE",
        path: "/prompts/prompt-123",
        pathParameters: { promptId: "prompt-123" },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(response.headers).toEqual({
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      });
      expect(parsedResponse.message).toBe("Prompt deleted successfully");

      // Verify both commands were called
      expect(mockDocClient.mockSend).toHaveBeenCalledTimes(2);

      // Verify GetCommand
      const getCall = mockDocClient.mockSend.mock.calls[0][0];
      expect(getCall).toMatchObject({
        TableName: "test-user-prompts",
        Key: { promptId: "prompt-123" },
      });

      // Verify DeleteCommand
      const deleteCall = mockDocClient.mockSend.mock.calls[1][0];
      expect(deleteCall).toMatchObject({
        TableName: "test-user-prompts",
        Key: { promptId: "prompt-123" },
      });
    });
  });

  describe("Authorization and ownership", () => {
    it("should require authentication", async () => {
      getUserFromEvent.mockResolvedValue(null);

      const event = createMockEvent({
        httpMethod: "DELETE",
        path: "/prompts/prompt-123",
        pathParameters: { promptId: "prompt-123" },
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
        httpMethod: "DELETE",
        path: "/prompts/prompt-123",
        pathParameters: { promptId: "prompt-123" },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(401);
      expect(parsedResponse.error).toBe("Unauthorized");
    });

    it("should reject deletion from non-owner", async () => {
      const user = createMockUser({ sub: "different-user" });
      getUserFromEvent.mockResolvedValue(user);

      mockDocClient.mockSend.mockResolvedValueOnce({ Item: existingPrompt });

      const event = createMockEvent({
        httpMethod: "DELETE",
        path: "/prompts/prompt-123",
        pathParameters: { promptId: "prompt-123" },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(403);
      expect(parsedResponse.error).toBe(
        "You do not have permission to delete this prompt",
      );

      // Should only call GetCommand, not DeleteCommand
      expect(mockDocClient.mockSend).toHaveBeenCalledTimes(1);
    });
  });

  describe("Validation", () => {
    it("should require promptId parameter", async () => {
      const event = createMockEvent({
        httpMethod: "DELETE",
        path: "/prompts/",
        pathParameters: {},
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(parsedResponse.error).toBe("Missing promptId");
    });

    it("should handle missing pathParameters", async () => {
      const event = createMockEvent({
        httpMethod: "DELETE",
        path: "/prompts/",
      });
      delete event.pathParameters;

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(parsedResponse.error).toBe("Missing promptId");
    });
  });

  describe("Error handling", () => {
    it("should handle non-existent prompt", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      mockDocClient.mockSend.mockResolvedValueOnce({ Item: null }); // Prompt not found

      const event = createMockEvent({
        httpMethod: "DELETE",
        path: "/prompts/non-existent",
        pathParameters: { promptId: "non-existent" },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(404);
      expect(parsedResponse.error).toBe("Prompt not found");

      // Should only call GetCommand
      expect(mockDocClient.mockSend).toHaveBeenCalledTimes(1);
    });

    it("should handle DynamoDB GetCommand errors", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      mockDocClient.mockSend.mockRejectedValueOnce(
        new Error("DynamoDB Get error"),
      );

      const event = createMockEvent({
        httpMethod: "DELETE",
        path: "/prompts/prompt-123",
        pathParameters: { promptId: "prompt-123" },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(500);
      expect(parsedResponse.error).toBe("Failed to delete prompt");
    });

    it("should handle DynamoDB DeleteCommand errors", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      mockDocClient.mockSend
        .mockResolvedValueOnce({ Item: existingPrompt })
        .mockRejectedValueOnce(new Error("DynamoDB Delete error"));

      const event = createMockEvent({
        httpMethod: "DELETE",
        path: "/prompts/prompt-123",
        pathParameters: { promptId: "prompt-123" },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(500);
      expect(parsedResponse.error).toBe("Failed to delete prompt");
    });

    it("should handle getUserFromEvent errors", async () => {
      getUserFromEvent.mockRejectedValueOnce(new Error("Auth error"));

      const event = createMockEvent({
        httpMethod: "DELETE",
        path: "/prompts/prompt-123",
        pathParameters: { promptId: "prompt-123" },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(500);
      expect(parsedResponse.error).toBe("Failed to delete prompt");
    });
  });

  describe("Logging", () => {
    it("should log delete event and success", async () => {
      const consoleLogSpy = jest
        .spyOn(console, "log")
        .mockImplementation(() => {});
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      mockDocClient.mockSend
        .mockResolvedValueOnce({ Item: existingPrompt })
        .mockResolvedValueOnce({});

      const event = createMockEvent({
        httpMethod: "DELETE",
        path: "/prompts/prompt-123",
        pathParameters: { promptId: "prompt-123" },
      });

      await handler(event);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "Delete prompt event:",
        expect.stringContaining('"httpMethod": "DELETE"'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "Prompt deleted successfully:",
        "prompt-123",
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
        httpMethod: "DELETE",
        path: "/prompts/prompt-123",
        pathParameters: { promptId: "prompt-123" },
      });

      await handler(event);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error deleting prompt:",
        error,
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe("Edge cases", () => {
    it("should handle prompts with minimal data", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      const minimalPrompt = {
        promptId: "prompt-123",
        userId: "user-123",
        templateTitle: "Title",
        content: "Content",
      };

      mockDocClient.mockSend
        .mockResolvedValueOnce({ Item: minimalPrompt })
        .mockResolvedValueOnce({});

      const event = createMockEvent({
        httpMethod: "DELETE",
        path: "/prompts/prompt-123",
        pathParameters: { promptId: "prompt-123" },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
    });

    it("should handle prompts with complex data", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      const complexPrompt = {
        ...existingPrompt,
        variables: {
          user: { name: "John", details: { age: 30 } },
          items: ["item1", "item2"],
        },
        metadata: {
          tags: ["important", "archived"],
          version: 2,
        },
      };

      mockDocClient.mockSend
        .mockResolvedValueOnce({ Item: complexPrompt })
        .mockResolvedValueOnce({});

      const event = createMockEvent({
        httpMethod: "DELETE",
        path: "/prompts/prompt-123",
        pathParameters: { promptId: "prompt-123" },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
    });
  });

  describe("Environment variables", () => {
    it("should use environment variable for table name", async () => {
      process.env.USER_PROMPTS_TABLE = "custom-prompts-table";

      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      mockDocClient.mockSend
        .mockResolvedValueOnce({ Item: existingPrompt })
        .mockResolvedValueOnce({});

      const event = createMockEvent({
        httpMethod: "DELETE",
        path: "/prompts/prompt-123",
        pathParameters: { promptId: "prompt-123" },
      });

      await handler(event);

      const getCall = mockDocClient.mockSend.mock.calls[0][0];
      expect(getCall.TableName).toBe("custom-prompts-table");

      const deleteCall = mockDocClient.mockSend.mock.calls[1][0];
      expect(deleteCall.TableName).toBe("custom-prompts-table");
    });
  });
});
