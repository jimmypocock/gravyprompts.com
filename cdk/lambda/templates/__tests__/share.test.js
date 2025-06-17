const {
  createMockDocClient,
  createMockEvent,
  createMockUser,
} = require("../../../test-utils/dynamodb-mock");

// Create mock client before mocking
const mockDocClient = createMockDocClient();
const mockCognitoClient = {
  send: jest.fn(),
};

// Mock the auth module
jest.mock("/opt/nodejs/auth", () => ({
  getUserFromEvent: jest.fn(),
}));

// Mock the utils module
const mockUtils = {
  docClient: mockDocClient,
  cognitoClient: mockCognitoClient,
  createResponse: jest.fn((statusCode, body) => ({
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })),
  getUserIdFromEvent: jest.fn(),
  generateShareToken: jest.fn(() => "share-token-123"),
  checkRateLimit: jest.fn(() => true),
};

jest.mock("/opt/nodejs/utils", () => mockUtils);

// Mock DynamoDB
jest.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => mockDocClient),
  },
  GetCommand: jest.fn((params) => params),
  UpdateCommand: jest.fn((params) => params),
}));

// Mock Cognito
jest.mock("@aws-sdk/client-cognito-identity-provider", () => ({
  AdminGetUserCommand: jest.fn((params) => params),
  CognitoIdentityProviderClient: jest.fn(),
}));

// Now require the handler
const { handler } = require("../share");

describe("Share Template Lambda", () => {
  const existingTemplate = {
    templateId: "template-123",
    userId: "user-123",
    title: "My Template",
    content: "Hello [[name]]!",
    visibility: "private",
    viewers: ["existing-viewer"],
    shareTokens: {
      "old-token": {
        createdAt: "2024-01-01T00:00:00Z",
        expiresAt: "2024-01-02T00:00:00Z", // Expired
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockDocClient.mockSend.mockReset();
    mockCognitoClient.send.mockReset();
    process.env.TEMPLATES_TABLE = "test-templates";
    process.env.USER_POOL_ID = "test-pool";
    process.env.FRONTEND_URL = "https://test.gravyprompts.com";
    process.env.ENVIRONMENT = "test";

    mockUtils.checkRateLimit.mockResolvedValue(true);
  });

  describe("Generate share link", () => {
    it("should generate share link successfully", async () => {
      mockUtils.getUserIdFromEvent.mockReturnValue("user-123");
      mockDocClient.mockSend
        .mockResolvedValueOnce({ Item: existingTemplate }) // GetCommand
        .mockResolvedValueOnce({}); // UpdateCommand

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates/template-123/share",
        pathParameters: { templateId: "template-123" },
        body: JSON.stringify({
          action: "generate_link",
          expiresIn: 7,
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedResponse.shareUrl).toBe(
        "https://test.gravyprompts.com/templates/template-123?token=share-token-123",
      );
      expect(parsedResponse.token).toBe("share-token-123");
      expect(parsedResponse.expiresAt).toBeDefined();

      // Verify update was called correctly
      const updateCall = mockDocClient.mockSend.mock.calls[1][0];
      expect(
        updateCall.ExpressionAttributeValues[":shareTokens"],
      ).toHaveProperty("share-token-123");
      // Should not include the expired token
      expect(
        updateCall.ExpressionAttributeValues[":shareTokens"],
      ).not.toHaveProperty("old-token");
    });

    it("should limit expiration to maximum 30 days", async () => {
      mockUtils.getUserIdFromEvent.mockReturnValue("user-123");
      mockDocClient.mockSend
        .mockResolvedValueOnce({ Item: existingTemplate })
        .mockResolvedValueOnce({});

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates/template-123/share",
        pathParameters: { templateId: "template-123" },
        body: JSON.stringify({
          action: "generate_link",
          expiresIn: 365, // Try to set 1 year
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);

      // Check that expiration is capped at 30 days
      const expiresAt = new Date(parsedResponse.expiresAt);
      const now = new Date();
      const diffInDays = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
      expect(diffInDays).toBeLessThanOrEqual(30);
    });

    it("should clean up expired tokens when generating new one", async () => {
      mockUtils.getUserIdFromEvent.mockReturnValue("user-123");

      const templateWithMultipleTokens = {
        ...existingTemplate,
        shareTokens: {
          "expired-1": {
            createdAt: "2024-01-01T00:00:00Z",
            expiresAt: "2024-01-02T00:00:00Z", // Expired
          },
          "valid-token": {
            createdAt: "2024-01-01T00:00:00Z",
            expiresAt: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
          },
          "expired-2": {
            createdAt: "2024-01-01T00:00:00Z",
            expiresAt: "2024-01-03T00:00:00Z", // Expired
          },
        },
      };

      mockDocClient.mockSend
        .mockResolvedValueOnce({ Item: templateWithMultipleTokens })
        .mockResolvedValueOnce({});

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates/template-123/share",
        pathParameters: { templateId: "template-123" },
        body: JSON.stringify({
          action: "generate_link",
        }),
      });

      await handler(event);

      const updateCall = mockDocClient.mockSend.mock.calls[1][0];
      const updatedTokens =
        updateCall.ExpressionAttributeValues[":shareTokens"];

      // Should keep valid tokens and new token, remove expired ones
      expect(updatedTokens).toHaveProperty("valid-token");
      expect(updatedTokens).toHaveProperty("share-token-123");
      expect(updatedTokens).not.toHaveProperty("expired-1");
      expect(updatedTokens).not.toHaveProperty("expired-2");
    });
  });

  describe("Add viewers", () => {
    it("should add viewers by email successfully", async () => {
      mockUtils.getUserIdFromEvent.mockReturnValue("user-123");
      mockDocClient.mockSend
        .mockResolvedValueOnce({ Item: existingTemplate })
        .mockResolvedValueOnce({});

      // Mock Cognito responses
      mockCognitoClient.send
        .mockResolvedValueOnce({
          UserAttributes: [
            { Name: "sub", Value: "viewer-456" },
            { Name: "email", Value: "viewer1@example.com" },
          ],
        })
        .mockResolvedValueOnce({
          UserAttributes: [
            { Name: "sub", Value: "viewer-789" },
            { Name: "email", Value: "viewer2@example.com" },
          ],
        });

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates/template-123/share",
        pathParameters: { templateId: "template-123" },
        body: JSON.stringify({
          action: "add",
          emails: ["viewer1@example.com", "viewer2@example.com"],
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedResponse.message).toBe("Successfully added 2 viewer(s)");
      expect(parsedResponse.viewerCount).toBe(3); // existing + 2 new

      // Verify viewers were added
      const updateCall = mockDocClient.mockSend.mock.calls[1][0];
      const viewers = updateCall.ExpressionAttributeValues[":viewers"];
      expect(viewers).toContain("existing-viewer");
      expect(viewers).toContain("viewer-456");
      expect(viewers).toContain("viewer-789");
    });

    it("should handle non-existent email addresses", async () => {
      mockUtils.getUserIdFromEvent.mockReturnValue("user-123");
      mockDocClient.mockSend
        .mockResolvedValueOnce({ Item: existingTemplate })
        .mockResolvedValueOnce({});

      // Mock Cognito responses - one found, one not found
      mockCognitoClient.send
        .mockResolvedValueOnce({
          UserAttributes: [{ Name: "sub", Value: "viewer-456" }],
        })
        .mockRejectedValueOnce(new Error("User not found"));

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates/template-123/share",
        pathParameters: { templateId: "template-123" },
        body: JSON.stringify({
          action: "add",
          emails: ["valid@example.com", "invalid@example.com"],
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedResponse.message).toBe("Successfully added 1 viewer(s)");
    });

    it("should return error if no valid users found", async () => {
      mockUtils.getUserIdFromEvent.mockReturnValue("user-123");
      mockDocClient.mockSend.mockResolvedValueOnce({ Item: existingTemplate });

      // All Cognito lookups fail
      mockCognitoClient.send.mockRejectedValue(new Error("User not found"));

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates/template-123/share",
        pathParameters: { templateId: "template-123" },
        body: JSON.stringify({
          action: "add",
          emails: ["invalid1@example.com", "invalid2@example.com"],
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(parsedResponse.error).toBe(
        "No valid users found with the provided emails",
      );
    });

    it("should not add duplicate viewers", async () => {
      mockUtils.getUserIdFromEvent.mockReturnValue("user-123");
      mockDocClient.mockSend
        .mockResolvedValueOnce({ Item: existingTemplate })
        .mockResolvedValueOnce({});

      // Return existing viewer ID
      mockCognitoClient.send.mockResolvedValueOnce({
        UserAttributes: [{ Name: "sub", Value: "existing-viewer" }],
      });

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates/template-123/share",
        pathParameters: { templateId: "template-123" },
        body: JSON.stringify({
          action: "add",
          emails: ["existing@example.com"],
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedResponse.viewerCount).toBe(1); // No duplicates
    });
  });

  describe("Remove viewers", () => {
    it("should remove viewers successfully", async () => {
      mockUtils.getUserIdFromEvent.mockReturnValue("user-123");

      const templateWithViewers = {
        ...existingTemplate,
        viewers: ["viewer-123", "viewer-456", "viewer-789"],
      };

      mockDocClient.mockSend
        .mockResolvedValueOnce({ Item: templateWithViewers })
        .mockResolvedValueOnce({});

      mockCognitoClient.send
        .mockResolvedValueOnce({
          UserAttributes: [{ Name: "sub", Value: "viewer-456" }],
        })
        .mockResolvedValueOnce({
          UserAttributes: [{ Name: "sub", Value: "viewer-789" }],
        });

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates/template-123/share",
        pathParameters: { templateId: "template-123" },
        body: JSON.stringify({
          action: "remove",
          emails: ["viewer1@example.com", "viewer2@example.com"],
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedResponse.message).toBe("Successfully removed 2 viewer(s)");
      expect(parsedResponse.viewerCount).toBe(1); // Only viewer-123 remains

      const updateCall = mockDocClient.mockSend.mock.calls[1][0];
      const viewers = updateCall.ExpressionAttributeValues[":viewers"];
      expect(viewers).toEqual(["viewer-123"]);
    });

    it("should handle removing non-existent viewers", async () => {
      mockUtils.getUserIdFromEvent.mockReturnValue("user-123");
      mockDocClient.mockSend
        .mockResolvedValueOnce({ Item: existingTemplate })
        .mockResolvedValueOnce({});

      mockCognitoClient.send.mockResolvedValueOnce({
        UserAttributes: [{ Name: "sub", Value: "non-viewer" }],
      });

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates/template-123/share",
        pathParameters: { templateId: "template-123" },
        body: JSON.stringify({
          action: "remove",
          emails: ["notaviewer@example.com"],
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedResponse.viewerCount).toBe(1); // existing-viewer remains
    });
  });

  describe("Authorization and validation", () => {
    it("should require authentication", async () => {
      mockUtils.getUserIdFromEvent.mockReturnValue(null);

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates/template-123/share",
        pathParameters: { templateId: "template-123" },
        body: JSON.stringify({ action: "generate_link" }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(401);
      expect(parsedResponse.error).toBe("Unauthorized");
    });

    it("should require templateId parameter", async () => {
      mockUtils.getUserIdFromEvent.mockReturnValue("user-123");

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates//share",
        pathParameters: {},
        body: JSON.stringify({ action: "generate_link" }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(parsedResponse.error).toBe("Template ID is required");
    });

    it("should validate action parameter", async () => {
      mockUtils.getUserIdFromEvent.mockReturnValue("user-123");

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates/template-123/share",
        pathParameters: { templateId: "template-123" },
        body: JSON.stringify({ action: "invalid_action" }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(parsedResponse.error).toBe(
        "Invalid action. Must be one of: add, remove, generate_link",
      );
    });

    it("should require emails for add/remove actions", async () => {
      mockUtils.getUserIdFromEvent.mockReturnValue("user-123");
      mockDocClient.mockSend.mockResolvedValueOnce({ Item: existingTemplate });

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates/template-123/share",
        pathParameters: { templateId: "template-123" },
        body: JSON.stringify({ action: "add" }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(parsedResponse.error).toBe("Emails array is required");
    });

    it("should reject sharing non-owned templates", async () => {
      mockUtils.getUserIdFromEvent.mockReturnValue("other-user");
      mockDocClient.mockSend.mockResolvedValueOnce({ Item: existingTemplate });

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates/template-123/share",
        pathParameters: { templateId: "template-123" },
        body: JSON.stringify({ action: "generate_link" }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(403);
      expect(parsedResponse.error).toBe(
        "You can only share your own templates",
      );
    });

    it("should handle non-existent template", async () => {
      mockUtils.getUserIdFromEvent.mockReturnValue("user-123");
      mockDocClient.mockSend.mockResolvedValueOnce({ Item: null });

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates/template-123/share",
        pathParameters: { templateId: "template-123" },
        body: JSON.stringify({ action: "generate_link" }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(404);
      expect(parsedResponse.error).toBe("Template not found");
    });
  });

  describe("Rate limiting", () => {
    it("should reject when rate limit is exceeded", async () => {
      mockUtils.getUserIdFromEvent.mockReturnValue("user-123");
      mockUtils.checkRateLimit.mockResolvedValue(false);

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates/template-123/share",
        pathParameters: { templateId: "template-123" },
        body: JSON.stringify({ action: "generate_link" }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(429);
      expect(parsedResponse.error).toBe("Rate limit exceeded");
    });

    it("should check rate limit with custom limits", async () => {
      mockUtils.getUserIdFromEvent.mockReturnValue("user-123");
      mockDocClient.mockSend.mockResolvedValueOnce({ Item: existingTemplate });

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates/template-123/share",
        pathParameters: { templateId: "template-123" },
        body: JSON.stringify({ action: "generate_link" }),
      });

      await handler(event);

      expect(mockUtils.checkRateLimit).toHaveBeenCalledWith(
        "user-123",
        "share_template",
        {
          perMinute: 10,
          perHour: 100,
        },
      );
    });
  });

  describe("Error handling", () => {
    it("should handle invalid JSON in request body", async () => {
      mockUtils.getUserIdFromEvent.mockReturnValue("user-123");

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates/template-123/share",
        pathParameters: { templateId: "template-123" },
        body: "invalid json",
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(500);
      expect(parsedResponse.error).toBe("Internal server error");
    });

    it("should handle DynamoDB errors", async () => {
      mockUtils.getUserIdFromEvent.mockReturnValue("user-123");
      mockDocClient.mockSend.mockRejectedValueOnce(new Error("DynamoDB error"));

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates/template-123/share",
        pathParameters: { templateId: "template-123" },
        body: JSON.stringify({ action: "generate_link" }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(500);
      expect(parsedResponse.error).toBe("Internal server error");
    });

    it("should handle Cognito errors gracefully", async () => {
      mockUtils.getUserIdFromEvent.mockReturnValue("user-123");
      mockDocClient.mockSend
        .mockResolvedValueOnce({ Item: existingTemplate })
        .mockResolvedValueOnce({});

      // Mock console.warn to verify error logging
      const consoleWarnSpy = jest
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      mockCognitoClient.send.mockRejectedValue(new Error("Cognito error"));

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates/template-123/share",
        pathParameters: { templateId: "template-123" },
        body: JSON.stringify({
          action: "add",
          emails: ["test@example.com"],
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(parsedResponse.error).toBe(
        "No valid users found with the provided emails",
      );
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });
  });

  describe("Edge cases", () => {
    it("should handle template with no existing viewers", async () => {
      mockUtils.getUserIdFromEvent.mockReturnValue("user-123");

      const templateNoViewers = {
        ...existingTemplate,
        viewers: undefined,
      };

      mockDocClient.mockSend
        .mockResolvedValueOnce({ Item: templateNoViewers })
        .mockResolvedValueOnce({});

      mockCognitoClient.send.mockResolvedValueOnce({
        UserAttributes: [{ Name: "sub", Value: "viewer-456" }],
      });

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates/template-123/share",
        pathParameters: { templateId: "template-123" },
        body: JSON.stringify({
          action: "add",
          emails: ["viewer@example.com"],
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedResponse.viewerCount).toBe(1);
    });

    it("should handle template with no existing share tokens", async () => {
      mockUtils.getUserIdFromEvent.mockReturnValue("user-123");

      const templateNoTokens = {
        ...existingTemplate,
        shareTokens: undefined,
      };

      mockDocClient.mockSend
        .mockResolvedValueOnce({ Item: templateNoTokens })
        .mockResolvedValueOnce({});

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates/template-123/share",
        pathParameters: { templateId: "template-123" },
        body: JSON.stringify({
          action: "generate_link",
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedResponse.token).toBe("share-token-123");
    });

    it("should handle empty emails array", async () => {
      mockUtils.getUserIdFromEvent.mockReturnValue("user-123");
      mockDocClient.mockSend.mockResolvedValueOnce({ Item: existingTemplate });

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates/template-123/share",
        pathParameters: { templateId: "template-123" },
        body: JSON.stringify({
          action: "add",
          emails: [],
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(parsedResponse.error).toBe("Emails array is required");
    });

    it("should use default expiration when not specified", async () => {
      mockUtils.getUserIdFromEvent.mockReturnValue("user-123");
      mockDocClient.mockSend
        .mockResolvedValueOnce({ Item: existingTemplate })
        .mockResolvedValueOnce({});

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates/template-123/share",
        pathParameters: { templateId: "template-123" },
        body: JSON.stringify({
          action: "generate_link",
          // expiresIn not specified
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);

      // Check default is 7 days
      const expiresAt = new Date(parsedResponse.expiresAt);
      const now = new Date();
      const diffInDays = Math.round((expiresAt - now) / (1000 * 60 * 60 * 24));
      expect(diffInDays).toBe(7);
    });
  });
});
