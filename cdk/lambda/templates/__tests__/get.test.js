const {
  createMockDocClient,
  createMockEvent,
  createMockUser,
} = require("../../../test-utils/dynamodb-mock");

// Create mock client before mocking
const mockDocClient = createMockDocClient();

// Mock uuid
jest.mock("uuid", () => ({
  v4: jest.fn(() => "view-123"),
}));

// Mock the auth module
jest.mock("/opt/nodejs/auth", () => ({
  getUserFromEvent: jest.fn(),
}), { virtual: true });

// Mock the cache module
jest.mock("/opt/nodejs/cache", () => ({
  get: jest.fn().mockResolvedValue(null), // Default to cache miss
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
  keyGenerators: {
    template: jest.fn((id) => `templates:get:${id}`),
  }
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
  PutCommand: jest.fn((params) => params),
  UpdateCommand: jest.fn((params) => params),
}));

// Now require the modules
const { handler } = require("../get");
const { getUserFromEvent } = require("/opt/nodejs/auth");
const cache = require("/opt/nodejs/cache");

describe("Get Template Lambda", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset cache to default behavior (cache miss)
    cache.get.mockResolvedValue(null);
    cache.set.mockResolvedValue(undefined);
  });

  const publicTemplate = {
    templateId: "template-123",
    userId: "user-123",
    title: "Public Template",
    content: "Hello {{name}}!",
    variables: ["name"],
    visibility: "public",
    moderationStatus: "approved",
    tags: ["greeting"],
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    viewCount: 10,
    useCount: 5,
    authorEmail: "author@example.com",
    viewers: [],
    shareTokens: {},
  };

  const privateTemplate = {
    ...publicTemplate,
    templateId: "private-template",
    title: "Private Template",
    visibility: "private",
    moderationStatus: "not_required",
    viewers: ["viewer-123"],
  };

  const pendingTemplate = {
    ...publicTemplate,
    templateId: "pending-template",
    title: "Pending Template",
    moderationStatus: "pending",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockDocClient.mockSend.mockReset();
    process.env.TEMPLATES_TABLE = "test-templates";
    process.env.TEMPLATE_VIEWS_TABLE = "test-template-views";
    process.env.ENVIRONMENT = "test";

    mockUtils.checkRateLimit.mockResolvedValue(true);
  });

  describe("Public template access", () => {
    it("should return public approved template for anonymous user", async () => {
      getUserFromEvent.mockResolvedValue(null); // Anonymous user

      mockDocClient.mockSend.mockResolvedValueOnce({ Item: publicTemplate });

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/templates/template-123",
        pathParameters: { templateId: "template-123" },
        requestContext: { identity: { sourceIp: "192.168.1.1" } },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedResponse.templateId).toBe("template-123");
      expect(parsedResponse.title).toBe("Public Template");
      expect(parsedResponse.isOwner).toBeFalsy(); // Can be false or null for anonymous

      // Should not include owner-specific fields
      expect(parsedResponse.viewers).toBeUndefined();
      expect(parsedResponse.moderationDetails).toBeUndefined();
    });

    it("should return public approved template for authenticated non-owner", async () => {
      const user = createMockUser({ sub: "other-user" });
      getUserFromEvent.mockResolvedValue(user);

      mockDocClient.mockSend
        .mockResolvedValueOnce({ Item: publicTemplate }) // GetCommand
        .mockResolvedValueOnce({}) // PutCommand for view tracking
        .mockResolvedValueOnce({}); // UpdateCommand for view count

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/templates/template-123",
        pathParameters: { templateId: "template-123" },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedResponse.isOwner).toBe(false);

      // Verify view tracking was called
      expect(mockDocClient.mockSend).toHaveBeenCalledTimes(3);
      const putCall = mockDocClient.mockSend.mock.calls[1][0];
      expect(putCall.TableName).toBe("test-template-views");
      expect(putCall.Item.viewerId).toBe("other-user");
    });

    it("should not track views for template owner", async () => {
      const user = createMockUser({ sub: "user-123" }); // Owner
      getUserFromEvent.mockResolvedValue(user);

      mockDocClient.mockSend.mockResolvedValueOnce({ Item: publicTemplate });

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/templates/template-123",
        pathParameters: { templateId: "template-123" },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedResponse.isOwner).toBe(true);

      // Should not track view for owner
      expect(mockDocClient.mockSend).toHaveBeenCalledTimes(1); // Only GetCommand
    });
  });

  describe("Private template access", () => {
    it("should allow owner to view their private template", async () => {
      const user = createMockUser({ sub: "user-123" }); // Owner
      getUserFromEvent.mockResolvedValue(user);

      mockDocClient.mockSend.mockResolvedValueOnce({ Item: privateTemplate });

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/templates/private-template",
        pathParameters: { templateId: "private-template" },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedResponse.isOwner).toBe(true);
      expect(parsedResponse.viewers).toEqual(["viewer-123"]);
      expect(parsedResponse.moderationStatus).toBe("not_required");
    });

    it("should allow viewer to access private template", async () => {
      const user = createMockUser({ sub: "viewer-123" }); // Listed viewer
      getUserFromEvent.mockResolvedValue(user);

      mockDocClient.mockSend
        .mockResolvedValueOnce({ Item: privateTemplate })
        .mockResolvedValueOnce({}) // View tracking
        .mockResolvedValueOnce({});

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/templates/private-template",
        pathParameters: { templateId: "private-template" },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedResponse.isOwner).toBe(false);
      // Should not include owner-specific fields
      expect(parsedResponse.viewers).toBeUndefined();
    });

    it("should deny access to private template for non-viewer", async () => {
      const user = createMockUser({ sub: "other-user" });
      getUserFromEvent.mockResolvedValue(user);

      mockDocClient.mockSend.mockResolvedValueOnce({ Item: privateTemplate });

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/templates/private-template",
        pathParameters: { templateId: "private-template" },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(403);
      expect(parsedResponse.error).toBe("Access denied");
    });

    it("should deny anonymous access to private template", async () => {
      getUserFromEvent.mockResolvedValue(null);

      mockDocClient.mockSend.mockResolvedValueOnce({ Item: privateTemplate });

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/templates/private-template",
        pathParameters: { templateId: "private-template" },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(403);
      expect(parsedResponse.error).toBe("Access denied");
    });
  });

  describe("Share token access", () => {
    it("should allow access with valid share token", async () => {
      getUserFromEvent.mockResolvedValue(null); // Anonymous

      const templateWithToken = {
        ...privateTemplate,
        shareTokens: {
          "valid-token": {
            createdAt: "2024-01-01T00:00:00Z",
            expiresAt: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
          },
        },
      };

      mockDocClient.mockSend.mockResolvedValueOnce({ Item: templateWithToken });

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/templates/private-template",
        pathParameters: { templateId: "private-template" },
        queryStringParameters: { token: "valid-token" },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedResponse.templateId).toBe("private-template");
    });

    it("should deny access with expired share token", async () => {
      getUserFromEvent.mockResolvedValue(null);

      const templateWithExpiredToken = {
        ...privateTemplate,
        shareTokens: {
          "expired-token": {
            createdAt: "2024-01-01T00:00:00Z",
            expiresAt: "2024-01-02T00:00:00Z", // Past date
          },
        },
      };

      mockDocClient.mockSend.mockResolvedValueOnce({
        Item: templateWithExpiredToken,
      });

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/templates/private-template",
        pathParameters: { templateId: "private-template" },
        queryStringParameters: { token: "expired-token" },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(403);
      expect(parsedResponse.error).toBe("Access denied");
    });

    it("should deny access with invalid share token", async () => {
      getUserFromEvent.mockResolvedValue(null);

      mockDocClient.mockSend.mockResolvedValueOnce({ Item: privateTemplate });

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/templates/private-template",
        pathParameters: { templateId: "private-template" },
        queryStringParameters: { token: "invalid-token" },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(403);
      expect(parsedResponse.error).toBe("Access denied");
    });
  });

  describe("Moderation status handling", () => {
    it("should deny access to pending template for non-owner", async () => {
      const user = createMockUser({ sub: "other-user" });
      getUserFromEvent.mockResolvedValue(user);

      mockDocClient.mockSend.mockResolvedValueOnce({ Item: pendingTemplate });

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/templates/pending-template",
        pathParameters: { templateId: "pending-template" },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(403);
      expect(parsedResponse.error).toBe("Access denied");
    });

    it("should allow owner to view their pending template", async () => {
      const user = createMockUser({ sub: "user-123" }); // Owner
      getUserFromEvent.mockResolvedValue(user);

      mockDocClient.mockSend.mockResolvedValueOnce({ Item: pendingTemplate });

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/templates/pending-template",
        pathParameters: { templateId: "pending-template" },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedResponse.moderationStatus).toBe("pending");
    });
  });

  describe("Error handling", () => {
    it("should handle missing templateId parameter", async () => {
      const event = createMockEvent({
        httpMethod: "GET",
        path: "/templates/",
        pathParameters: {},
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(parsedResponse.error).toBe("Template ID is required");
    });

    it("should handle non-existent template", async () => {
      getUserFromEvent.mockResolvedValue(null);

      mockDocClient.mockSend.mockResolvedValueOnce({ Item: null });

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/templates/non-existent",
        pathParameters: { templateId: "non-existent" },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(404);
      expect(parsedResponse.error).toBe("Template not found");
    });

    it("should handle DynamoDB errors", async () => {
      getUserFromEvent.mockResolvedValue(null);

      mockDocClient.mockSend.mockRejectedValueOnce(new Error("DynamoDB error"));

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/templates/template-123",
        pathParameters: { templateId: "template-123" },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(500);
      expect(parsedResponse.error).toBe("Internal server error");
    });

    it("should handle view tracking errors gracefully", async () => {
      const user = createMockUser({ sub: "other-user" });
      getUserFromEvent.mockResolvedValue(user);

      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      mockDocClient.mockSend
        .mockResolvedValueOnce({ Item: publicTemplate }) // GetCommand succeeds
        .mockRejectedValueOnce(new Error("View tracking error")); // PutCommand fails

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/templates/template-123",
        pathParameters: { templateId: "template-123" },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      // Should still return template despite view tracking error
      expect(response.statusCode).toBe(200);
      expect(parsedResponse.templateId).toBe("template-123");

      // Wait for async error handling
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should log the error
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.any(Error));

      consoleErrorSpy.mockRestore();
    });
  });

  describe("Rate limiting", () => {
    it("should reject when rate limit is exceeded", async () => {
      mockUtils.checkRateLimit.mockResolvedValue(false);

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/templates/template-123",
        pathParameters: { templateId: "template-123" },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(429);
      expect(parsedResponse.error).toBe("Too many requests");
      expect(parsedResponse.message).toBe("Please slow down your requests");
    });

    it("should use userId for rate limiting when authenticated", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      mockDocClient.mockSend.mockResolvedValueOnce({ Item: publicTemplate });

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/templates/template-123",
        pathParameters: { templateId: "template-123" },
      });

      await handler(event);

      expect(mockUtils.checkRateLimit).toHaveBeenCalledWith(
        "user-123",
        "getTemplate",
      );
    });

    it("should use IP for rate limiting when anonymous", async () => {
      getUserFromEvent.mockResolvedValue(null);

      mockDocClient.mockSend.mockResolvedValueOnce({ Item: publicTemplate });

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/templates/template-123",
        pathParameters: { templateId: "template-123" },
        requestContext: { identity: { sourceIp: "192.168.1.1" } },
      });

      await handler(event);

      expect(mockUtils.checkRateLimit).toHaveBeenCalledWith(
        "192.168.1.1",
        "getTemplate",
      );
    });
  });

  describe("Owner-specific fields", () => {
    it("should include active share links info for owner", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      const templateWithTokens = {
        ...publicTemplate,
        shareTokens: {
          "active-token": {
            createdAt: "2024-01-01T00:00:00Z",
            expiresAt: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
          },
          "expired-token": {
            createdAt: "2024-01-01T00:00:00Z",
            expiresAt: "2024-01-02T00:00:00Z", // Past
          },
        },
      };

      mockDocClient.mockSend.mockResolvedValueOnce({
        Item: templateWithTokens,
      });

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/templates/template-123",
        pathParameters: { templateId: "template-123" },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedResponse.activeShareLinks).toHaveLength(1);
      expect(parsedResponse.activeShareLinks[0]).toHaveProperty("createdAt");
      expect(parsedResponse.activeShareLinks[0]).toHaveProperty("expiresAt");
      // Should not expose actual token
      expect(parsedResponse.activeShareLinks[0]).not.toHaveProperty("token");
    });

    it("should include moderation details for owner", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      const rejectedTemplate = {
        ...publicTemplate,
        moderationStatus: "rejected",
        moderationDetails: {
          reason: "Inappropriate content",
          timestamp: "2024-01-02T00:00:00Z",
        },
      };

      mockDocClient.mockSend.mockResolvedValueOnce({ Item: rejectedTemplate });

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/templates/template-123",
        pathParameters: { templateId: "template-123" },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedResponse.moderationStatus).toBe("rejected");
      expect(parsedResponse.moderationDetails).toEqual({
        reason: "Inappropriate content",
        timestamp: "2024-01-02T00:00:00Z",
      });
    });
  });

  describe("View tracking", () => {
    it("should track view with correct TTL", async () => {
      const user = createMockUser({ sub: "viewer-123" });
      getUserFromEvent.mockResolvedValue(user);

      const now = Date.now();
      jest.spyOn(Date, "now").mockReturnValue(now);

      mockDocClient.mockSend
        .mockResolvedValueOnce({ Item: publicTemplate })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/templates/template-123",
        pathParameters: { templateId: "template-123" },
      });

      await handler(event);

      const putCall = mockDocClient.mockSend.mock.calls[1][0];
      expect(putCall.Item.ttl).toBe(Math.floor(now / 1000) + 90 * 24 * 60 * 60); // 90 days

      Date.now.mockRestore();
    });

    it("should increment view count", async () => {
      const user = createMockUser({ sub: "viewer-123" });
      getUserFromEvent.mockResolvedValue(user);

      mockDocClient.mockSend
        .mockResolvedValueOnce({ Item: publicTemplate })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/templates/template-123",
        pathParameters: { templateId: "template-123" },
      });

      await handler(event);

      const updateCall = mockDocClient.mockSend.mock.calls[2][0];
      expect(updateCall).toMatchObject({
        TableName: "test-templates",
        Key: { templateId: "template-123" },
        UpdateExpression: "ADD viewCount :inc",
        ExpressionAttributeValues: { ":inc": 1 },
      });
    });
  });
});
