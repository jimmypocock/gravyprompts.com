const {
  createMockDocClient,
  createMockEvent,
  createMockUser,
} = require("../../../test-utils/dynamodb-mock");

// Create mock client before mocking
const mockDocClient = createMockDocClient();

// Mock uuid
jest.mock("uuid", () => ({
  v4: jest.fn(() => "prompt-123"),
}));

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
  PutCommand: jest.fn((params) => params),
}));

// Now require the handler
const { handler } = require("../save");
const { getUserFromEvent } = require("/opt/nodejs/auth");

describe("Save Prompt Lambda", () => {
  const mockTimestamp = "2024-01-01T00:00:00.000Z";

  beforeEach(() => {
    jest.clearAllMocks();
    mockDocClient.mockSend.mockReset();

    // Mock Date
    jest.spyOn(Date.prototype, "toISOString").mockReturnValue(mockTimestamp);

    // Default successful save
    mockDocClient.mockSend.mockResolvedValue({});
  });

  afterEach(() => {
    Date.prototype.toISOString.mockRestore();
  });

  describe("Successful saves", () => {
    it("should save prompt with all fields successfully", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/prompts",
        body: JSON.stringify({
          templateId: "template-456",
          templateTitle: "Email Template",
          content: "Hello John, Welcome to Acme Corp!",
          variables: {
            name: "John",
            company: "Acme Corp",
          },
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(201);
      expect(response.headers).toEqual({
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      });
      expect(parsedResponse.message).toBe("Prompt saved successfully");
      expect(parsedResponse.promptId).toBe("prompt-123");
      expect(parsedResponse.userId).toBe("user-123");
      expect(parsedResponse.templateId).toBe("template-456");
      expect(parsedResponse.templateTitle).toBe("Email Template");
      expect(parsedResponse.content).toBe("Hello John, Welcome to Acme Corp!");
      expect(parsedResponse.variables).toEqual({
        name: "John",
        company: "Acme Corp",
      });
      expect(parsedResponse.createdAt).toBe(mockTimestamp);
      expect(parsedResponse.updatedAt).toBe(mockTimestamp);

      // Verify DynamoDB put was called
      expect(mockDocClient.mockSend).toHaveBeenCalledTimes(1);
      const putCall = mockDocClient.mockSend.mock.calls[0][0];
      expect(putCall).toMatchObject({
        TableName: "test-user-prompts",
        Item: {
          promptId: "prompt-123",
          userId: "user-123",
          templateId: "template-456",
          templateTitle: "Email Template",
          content: "Hello John, Welcome to Acme Corp!",
          variables: {
            name: "John",
            company: "Acme Corp",
          },
          createdAt: mockTimestamp,
          updatedAt: mockTimestamp,
        },
      });
    });

    it("should save prompt without templateId", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/prompts",
        body: JSON.stringify({
          templateTitle: "Custom Note",
          content: "This is my custom content",
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(201);
      expect(parsedResponse.templateId).toBeNull();
      expect(parsedResponse.variables).toEqual({});
    });

    it("should save prompt with empty variables object", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/prompts",
        body: JSON.stringify({
          templateId: "template-456",
          templateTitle: "Static Template",
          content: "This template has no variables",
          variables: {},
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(201);
      expect(parsedResponse.variables).toEqual({});
    });

    it("should handle multi-line content", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      const multiLineContent = `Dear John,

Welcome to our team at Acme Corp!

Best regards,
The Team`;

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/prompts",
        body: JSON.stringify({
          templateTitle: "Welcome Email",
          content: multiLineContent,
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(201);
      expect(parsedResponse.content).toBe(multiLineContent);
    });

    it("should handle special characters in content", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/prompts",
        body: JSON.stringify({
          templateTitle: "Special Characters",
          content: 'Price: $99.99 (10% off!) & "free" shipping',
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(201);
      expect(parsedResponse.content).toBe(
        'Price: $99.99 (10% off!) & "free" shipping',
      );
    });
  });

  describe("Authentication", () => {
    it("should require authentication", async () => {
      getUserFromEvent.mockResolvedValue(null);

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/prompts",
        body: JSON.stringify({
          templateTitle: "Test",
          content: "Test content",
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(401);
      expect(parsedResponse.error).toBe("Unauthorized");
    });

    it("should reject when user has no sub", async () => {
      getUserFromEvent.mockResolvedValue({ email: "user@example.com" }); // No sub

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/prompts",
        body: JSON.stringify({
          templateTitle: "Test",
          content: "Test content",
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(401);
      expect(parsedResponse.error).toBe("Unauthorized");
    });
  });

  describe("Validation", () => {
    it("should require templateTitle", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/prompts",
        body: JSON.stringify({
          content: "Test content",
          // missing templateTitle
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(parsedResponse.error).toBe(
        "Missing required fields: templateTitle and content",
      );
    });

    it("should require content", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/prompts",
        body: JSON.stringify({
          templateTitle: "Test Title",
          // missing content
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(parsedResponse.error).toBe(
        "Missing required fields: templateTitle and content",
      );
    });

    it("should handle empty string values", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/prompts",
        body: JSON.stringify({
          templateTitle: "",
          content: "",
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(parsedResponse.error).toBe(
        "Missing required fields: templateTitle and content",
      );
    });

    it("should handle invalid JSON in request body", async () => {
      const event = createMockEvent({
        httpMethod: "POST",
        path: "/prompts",
        body: "invalid json",
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(parsedResponse.error).toBe("Invalid request body");
    });

    it("should handle missing request body", async () => {
      const event = createMockEvent({
        httpMethod: "POST",
        path: "/prompts",
        body: null,
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(parsedResponse.error).toBe(
        "Missing required fields: templateTitle and content",
      );
    });
  });

  describe("Error handling", () => {
    it("should handle DynamoDB errors", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      mockDocClient.mockSend.mockRejectedValueOnce(new Error("DynamoDB error"));

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/prompts",
        body: JSON.stringify({
          templateTitle: "Test",
          content: "Test content",
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(500);
      expect(parsedResponse.error).toBe("Failed to save prompt");
    });

    it("should handle getUserFromEvent errors", async () => {
      getUserFromEvent.mockRejectedValueOnce(new Error("Auth error"));

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/prompts",
        body: JSON.stringify({
          templateTitle: "Test",
          content: "Test content",
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(500);
      expect(parsedResponse.error).toBe("Failed to save prompt");
    });
  });

  describe("Logging", () => {
    it("should log save event", async () => {
      const consoleLogSpy = jest
        .spyOn(console, "log")
        .mockImplementation(() => {});
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/prompts",
        body: JSON.stringify({
          templateTitle: "Test",
          content: "Test content",
        }),
      });

      await handler(event);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "Save prompt event:",
        expect.stringContaining('"httpMethod": "POST"'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "Prompt saved successfully:",
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
        httpMethod: "POST",
        path: "/prompts",
        body: JSON.stringify({
          templateTitle: "Test",
          content: "Test content",
        }),
      });

      await handler(event);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error saving prompt:",
        error,
      );

      consoleErrorSpy.mockRestore();
    });
  });


  describe("Edge cases", () => {
    it("should handle very long content", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      const longContent = "x".repeat(10000);

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/prompts",
        body: JSON.stringify({
          templateTitle: "Long Content",
          content: longContent,
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(201);
      expect(parsedResponse.content).toBe(longContent);
    });

    it("should handle complex nested variables", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      const complexVariables = {
        user: {
          name: "John",
          details: {
            age: 30,
            location: "NYC",
          },
        },
        items: ["item1", "item2"],
        settings: {
          theme: "dark",
          notifications: true,
        },
      };

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/prompts",
        body: JSON.stringify({
          templateTitle: "Complex Variables",
          content: "Test content",
          variables: complexVariables,
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(201);
      expect(parsedResponse.variables).toEqual(complexVariables);
    });

    it("should handle null values in optional fields", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/prompts",
        body: JSON.stringify({
          templateId: null,
          templateTitle: "Null Template ID",
          content: "Test content",
          variables: null,
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(201);
      expect(parsedResponse.templateId).toBeNull();
      expect(parsedResponse.variables).toEqual({});
    });
  });
});
