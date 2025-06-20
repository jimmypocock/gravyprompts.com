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
jest.mock("/opt/nodejs/utils", () => ({
  docClient: mockDocClient,
  createResponse: jest.fn((statusCode, body) => ({
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify(body),
  })),
  checkRateLimit: jest.fn(() => true),
}), { virtual: true });

// Mock DynamoDB
jest.mock("@aws-sdk/lib-dynamodb", () => ({
  QueryCommand: jest.fn((params) => params),
  ScanCommand: jest.fn((params) => params),
}));

// Now require the handler
const { handler } = require("../list");
const { getUserFromEvent } = require("/opt/nodejs/auth");
const { checkRateLimit } = require("/opt/nodejs/utils");

describe("List Templates Lambda", () => {
  const mockTemplates = [
    {
      templateId: "template-1",
      title: "Email Welcome Template",
      content:
        "Welcome {{name}} to our company! We are excited to have you join {{department}}.",
      tags: ["email", "welcome", "onboarding"],
      variables: ["name", "department"],
      visibility: "public",
      moderationStatus: "approved",
      userId: "user-123",
      authorEmail: "author1@example.com",
      createdAt: "2024-01-01T00:00:00Z",
      viewCount: 100,
      useCount: 50,
    },
    {
      templateId: "template-2",
      title: "Marketing Campaign",
      content:
        "Check out our latest {{product}} sale! Get {{discount}}% off today only.",
      tags: ["marketing", "sales"],
      variables: ["product", "discount"],
      visibility: "public",
      moderationStatus: "approved",
      userId: "user-456",
      authorEmail: "author2@example.com",
      createdAt: "2024-01-02T00:00:00Z",
      viewCount: 200,
      useCount: 150,
    },
    {
      templateId: "template-3",
      title: "Private Template",
      content: "Internal use only: {{secret}}",
      tags: ["private"],
      variables: ["secret"],
      visibility: "private",
      moderationStatus: "approved",
      userId: "user-123",
      authorEmail: "author1@example.com",
      createdAt: "2024-01-03T00:00:00Z",
      viewCount: 10,
      useCount: 5,
    },
    {
      templateId: "template-4",
      title: "Newsletter Template",
      content:
        "Monthly newsletter for {{month}}. Featured articles: {{article1}}, {{article2}}",
      tags: ["newsletter", "email"],
      variables: ["month", "article1", "article2"],
      visibility: "public",
      moderationStatus: "pending",
      userId: "user-789",
      authorEmail: "author3@example.com",
      createdAt: "2024-01-04T00:00:00Z",
      viewCount: 50,
      useCount: 20,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockDocClient.mockSend.mockReset();
    process.env.TEMPLATES_TABLE = "test-templates";
    checkRateLimit.mockResolvedValue(true);
  });

  describe("Public templates filter", () => {
    it("should list public approved templates", async () => {
      const publicTemplates = mockTemplates.filter(
        (t) => t.visibility === "public" && t.moderationStatus === "approved",
      );

      mockDocClient.mockSend.mockResolvedValueOnce({
        Items: publicTemplates,
        Count: publicTemplates.length,
      });

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/templates",
        queryStringParameters: { filter: "public" },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedResponse.items).toHaveLength(2);
      expect(parsedResponse.items[0].templateId).toBe("template-1");
      expect(parsedResponse.items[0].preview).toBe(
        "Welcome {{name}} to our company! We are excited to have you join {{department}}.",
      );
      expect(parsedResponse.items[0].variables).toEqual(["name", "department"]);
      expect(parsedResponse.items[0].isOwner).toBe(false);

      // Verify query parameters
      const queryCall = mockDocClient.mockSend.mock.calls[0][0];
      expect(queryCall).toMatchObject({
        TableName: "test-templates",
        IndexName: "visibility-moderationStatus-index",
        KeyConditionExpression:
          "visibility = :visibility AND moderationStatus = :status",
        ExpressionAttributeValues: {
          ":visibility": "public",
          ":status": "approved",
        },
      });
    });

    it("should handle pagination with nextToken", async () => {
      const lastKey = {
        templateId: "template-1",
        visibility: "public",
        moderationStatus: "approved",
      };
      const nextToken = Buffer.from(JSON.stringify(lastKey)).toString("base64");

      mockDocClient.mockSend.mockResolvedValueOnce({
        Items: [mockTemplates[1]],
        Count: 1,
        LastEvaluatedKey: { templateId: "template-2" },
      });

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/templates",
        queryStringParameters: {
          filter: "public",
          nextToken,
        },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedResponse.nextToken).toBeDefined();

      const queryCall = mockDocClient.mockSend.mock.calls[0][0];
      expect(queryCall.ExclusiveStartKey).toEqual(lastKey);
    });
  });

  describe("User templates filter", () => {
    it("should list user's own templates", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      const userTemplates = mockTemplates.filter(
        (t) => t.userId === "user-123",
      );

      mockDocClient.mockSend.mockResolvedValueOnce({
        Items: userTemplates,
        Count: userTemplates.length,
      });

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/templates",
        queryStringParameters: { filter: "mine" },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedResponse.items).toHaveLength(2);
      expect(parsedResponse.items.every((item) => item.isOwner)).toBe(true);

      const queryCall = mockDocClient.mockSend.mock.calls[0][0];
      expect(queryCall).toMatchObject({
        TableName: "test-templates",
        IndexName: "userId-createdAt-index",
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: {
          ":userId": "user-123",
        },
      });
    });

    it("should return empty array if user not authenticated", async () => {
      getUserFromEvent.mockResolvedValue(null);

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/templates",
        queryStringParameters: { filter: "mine" },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedResponse.items).toEqual([]);
      expect(mockDocClient.mockSend).not.toHaveBeenCalled();
    });
  });

  describe("Popular templates filter", () => {
    it("should sort templates by useCount", async () => {
      const publicTemplates = mockTemplates.filter(
        (t) => t.visibility === "public" && t.moderationStatus === "approved",
      );

      mockDocClient.mockSend.mockResolvedValueOnce({
        Items: publicTemplates,
        Count: publicTemplates.length,
      });

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/templates",
        queryStringParameters: { filter: "popular" },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedResponse.items[0].templateId).toBe("template-2"); // Highest useCount
      expect(parsedResponse.items[1].templateId).toBe("template-1"); // Second highest

      // Verify it requests more items for sorting
      const queryCall = mockDocClient.mockSend.mock.calls[0][0];
      expect(queryCall.Limit).toBe(40); // 20 * 2
    });
  });

  describe("All templates filter", () => {
    it("should combine public and user templates", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      const publicTemplates = mockTemplates.filter(
        (t) => t.visibility === "public" && t.moderationStatus === "approved",
      );
      const userTemplates = mockTemplates.filter(
        (t) => t.userId === "user-123",
      );

      mockDocClient.mockSend
        .mockResolvedValueOnce({
          Items: publicTemplates,
          Count: publicTemplates.length,
        })
        .mockResolvedValueOnce({
          Items: userTemplates,
          Count: userTemplates.length,
        });

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/templates",
        queryStringParameters: { filter: "all" },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(mockDocClient.mockSend).toHaveBeenCalledTimes(2);

      // Should deduplicate templates
      const uniqueIds = new Set(
        parsedResponse.items.map((item) => item.templateId),
      );
      expect(uniqueIds.size).toBe(parsedResponse.items.length);
    });
  });

  describe("Tag filtering", () => {
    it("should filter templates by tag", async () => {
      mockDocClient.mockSend.mockResolvedValueOnce({
        Items: mockTemplates.filter(
          (t) => t.visibility === "public" && t.moderationStatus === "approved",
        ),
        Count: 2,
      });

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/templates",
        queryStringParameters: {
          filter: "public",
          tag: "email",
        },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedResponse.items).toHaveLength(1);
      expect(parsedResponse.items[0].tags).toContain("email");
    });

    it("should handle templates without tags", async () => {
      const templatesWithoutTags = [
        {
          ...mockTemplates[0],
          tags: undefined,
        },
      ];

      mockDocClient.mockSend.mockResolvedValueOnce({
        Items: templatesWithoutTags,
        Count: 1,
      });

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/templates",
        queryStringParameters: {
          filter: "public",
          tag: "email",
        },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedResponse.items).toHaveLength(0);
    });
  });

  describe("Search functionality", () => {
    it("should search templates by title", async () => {
      mockDocClient.mockSend.mockResolvedValueOnce({
        Items: mockTemplates.filter(
          (t) => t.visibility === "public" && t.moderationStatus === "approved",
        ),
        Count: 2,
      });

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/templates",
        queryStringParameters: {
          filter: "public",
          search: "welcome",
        },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedResponse.items).toHaveLength(1);
      expect(parsedResponse.items[0].title).toContain("Welcome");
    });

    it("should search templates by content", async () => {
      mockDocClient.mockSend.mockResolvedValueOnce({
        Items: mockTemplates.filter(
          (t) => t.visibility === "public" && t.moderationStatus === "approved",
        ),
        Count: 2,
      });

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/templates",
        queryStringParameters: {
          filter: "public",
          search: "company",
        },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedResponse.items).toHaveLength(1);
      expect(parsedResponse.items[0].templateId).toBe("template-1");
    });

    it("should search templates by tags", async () => {
      mockDocClient.mockSend.mockResolvedValueOnce({
        Items: mockTemplates.filter(
          (t) => t.visibility === "public" && t.moderationStatus === "approved",
        ),
        Count: 2,
      });

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/templates",
        queryStringParameters: {
          filter: "public",
          search: "marketing",
        },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedResponse.items).toHaveLength(1);
      expect(parsedResponse.items[0].tags).toContain("marketing");
    });

    it("should handle fuzzy search for typos", async () => {
      mockDocClient.mockSend.mockResolvedValueOnce({
        Items: mockTemplates.filter(
          (t) => t.visibility === "public" && t.moderationStatus === "approved",
        ),
        Count: 2,
      });

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/templates",
        queryStringParameters: {
          filter: "public",
          search: "welcom", // Missing 'e'
        },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedResponse.items).toHaveLength(1);
      expect(parsedResponse.items[0].title).toContain("Welcome");
    });

    it("should handle multi-term search", async () => {
      mockDocClient.mockSend.mockResolvedValueOnce({
        Items: mockTemplates.filter(
          (t) => t.visibility === "public" && t.moderationStatus === "approved",
        ),
        Count: 2,
      });

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/templates",
        queryStringParameters: {
          filter: "public",
          search: "email template",
        },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedResponse.items).toHaveLength(1);
      expect(parsedResponse.items[0].title).toContain("Email");
    });

    it("should search by variable names", async () => {
      mockDocClient.mockSend.mockResolvedValueOnce({
        Items: mockTemplates.filter(
          (t) => t.visibility === "public" && t.moderationStatus === "approved",
        ),
        Count: 2,
      });

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/templates",
        queryStringParameters: {
          filter: "public",
          search: "department",
        },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedResponse.items).toHaveLength(1);
      expect(parsedResponse.items[0].variables).toContain("department");
    });

    it("should rank results by relevance", async () => {
      const templates = [
        {
          ...mockTemplates[0],
          title: "Marketing Email",
          content: "Send marketing emails",
          tags: ["email"],
        },
        {
          ...mockTemplates[1],
          title: "Email Template",
          content: "Generic template",
          tags: ["template"],
        },
      ];

      mockDocClient.mockSend.mockResolvedValueOnce({
        Items: templates,
        Count: 2,
      });

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/templates",
        queryStringParameters: {
          filter: "public",
          search: "email",
        },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedResponse.items).toHaveLength(2);
      // Exact title match should rank higher
      expect(parsedResponse.items[0].title).toBe("Email Template");
    });
  });

  describe("Sorting", () => {
    it("should sort by createdAt descending by default", async () => {
      mockDocClient.mockSend.mockResolvedValueOnce({
        Items: mockTemplates.filter(
          (t) => t.visibility === "public" && t.moderationStatus === "approved",
        ),
        Count: 2,
      });

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/templates",
        queryStringParameters: { filter: "public" },
      });

      const response = await handler(event);

      const queryCall = mockDocClient.mockSend.mock.calls[0][0];
      expect(queryCall.ScanIndexForward).toBe(false);
    });

    it("should sort by viewCount", async () => {
      mockDocClient.mockSend.mockResolvedValueOnce({
        Items: mockTemplates.filter(
          (t) => t.visibility === "public" && t.moderationStatus === "approved",
        ),
        Count: 2,
      });

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/templates",
        queryStringParameters: {
          filter: "public",
          sortBy: "viewCount",
          sortOrder: "desc",
        },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedResponse.items[0].viewCount).toBe(200);
      expect(parsedResponse.items[1].viewCount).toBe(100);
    });

    it("should sort ascending when specified", async () => {
      mockDocClient.mockSend.mockResolvedValueOnce({
        Items: mockTemplates.filter(
          (t) => t.visibility === "public" && t.moderationStatus === "approved",
        ),
        Count: 2,
      });

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/templates",
        queryStringParameters: {
          filter: "public",
          sortBy: "useCount",
          sortOrder: "asc",
        },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedResponse.items[0].useCount).toBe(50);
      expect(parsedResponse.items[1].useCount).toBe(150);
    });
  });

  describe("Rate limiting", () => {
    it("should check rate limit for authenticated users", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      mockDocClient.mockSend.mockResolvedValueOnce({
        Items: [],
        Count: 0,
      });

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/templates",
        queryStringParameters: { filter: "public" },
      });

      await handler(event);

      expect(checkRateLimit).toHaveBeenCalledWith("user-123", "listTemplates");
    });

    it("should check rate limit using IP for anonymous users", async () => {
      getUserFromEvent.mockResolvedValue(null);

      mockDocClient.mockSend.mockResolvedValueOnce({
        Items: [],
        Count: 0,
      });

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/templates",
        queryStringParameters: { filter: "public" },
        requestContext: {
          identity: { sourceIp: "192.168.1.1" },
        },
      });

      await handler(event);

      expect(checkRateLimit).toHaveBeenCalledWith(
        "192.168.1.1",
        "listTemplates",
      );
    });

    it("should return 429 when rate limit exceeded", async () => {
      checkRateLimit.mockResolvedValueOnce(false);

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/templates",
        queryStringParameters: { filter: "public" },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(429);
      expect(parsedResponse.error).toBe("Too many requests");
      expect(mockDocClient.mockSend).not.toHaveBeenCalled();
    });
  });

  describe("Response formatting", () => {
    it("should limit content preview to 200 characters", async () => {
      const longContent = "x".repeat(300);
      const templates = [
        {
          ...mockTemplates[0],
          content: longContent,
        },
      ];

      mockDocClient.mockSend.mockResolvedValueOnce({
        Items: templates,
        Count: 1,
      });

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/templates",
        queryStringParameters: { filter: "public" },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedResponse.items[0].preview).toHaveLength(203); // 200 + '...'
      expect(parsedResponse.items[0].preview).toMatch(/\.\.\.$/);
    });

    it("should include all required fields in response", async () => {
      mockDocClient.mockSend.mockResolvedValueOnce({
        Items: [mockTemplates[0]],
        Count: 1,
      });

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/templates",
        queryStringParameters: { filter: "public" },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      const item = parsedResponse.items[0];

      expect(item).toHaveProperty("templateId");
      expect(item).toHaveProperty("title");
      expect(item).toHaveProperty("preview");
      expect(item).toHaveProperty("variables");
      expect(item).toHaveProperty("tags");
      expect(item).toHaveProperty("visibility");
      expect(item).toHaveProperty("authorEmail");
      expect(item).toHaveProperty("createdAt");
      expect(item).toHaveProperty("viewCount");
      expect(item).toHaveProperty("useCount");
      expect(item).toHaveProperty("variableCount");
      expect(item).toHaveProperty("isOwner");
    });

    it("should handle templates without content", async () => {
      const templates = [
        {
          ...mockTemplates[0],
          content: undefined,
        },
      ];

      mockDocClient.mockSend.mockResolvedValueOnce({
        Items: templates,
        Count: 1,
      });

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/templates",
        queryStringParameters: { filter: "public" },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedResponse.items[0].preview).toBe("");
    });
  });

  describe("Error handling", () => {
    it("should handle DynamoDB errors", async () => {
      mockDocClient.mockSend.mockRejectedValueOnce(new Error("DynamoDB error"));

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/templates",
        queryStringParameters: { filter: "public" },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(500);
      expect(parsedResponse.error).toBe("Internal server error");
    });

    it("should include error message in development", async () => {
      process.env.ENVIRONMENT = "development";
      mockDocClient.mockSend.mockRejectedValueOnce(new Error("Specific error"));

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/templates",
        queryStringParameters: { filter: "public" },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(500);
      expect(parsedResponse.message).toBe("Specific error");

      delete process.env.ENVIRONMENT;
    });

    it("should handle getUserFromEvent errors gracefully", async () => {
      getUserFromEvent.mockRejectedValueOnce(new Error("Auth error"));

      mockDocClient.mockSend.mockResolvedValueOnce({
        Items: mockTemplates.filter(
          (t) => t.visibility === "public" && t.moderationStatus === "approved",
        ),
        Count: 2,
      });

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/templates",
        queryStringParameters: { filter: "public" },
      });

      const response = await handler(event);

      // Should continue without user
      expect(response.statusCode).toBe(200);
    });
  });

  describe("Edge cases", () => {
    it("should handle missing query parameters", async () => {
      mockDocClient.mockSend.mockResolvedValueOnce({
        Items: mockTemplates.filter(
          (t) => t.visibility === "public" && t.moderationStatus === "approved",
        ),
        Count: 2,
      });

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/templates",
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedResponse.items).toHaveLength(2);
    });

    it("should limit results to maximum 100 items", async () => {
      mockDocClient.mockSend.mockResolvedValueOnce({
        Items: [],
        Count: 0,
      });

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/templates",
        queryStringParameters: {
          filter: "public",
          limit: "500",
        },
      });

      await handler(event);

      const queryCall = mockDocClient.mockSend.mock.calls[0][0];
      expect(queryCall.Limit).toBe(100);
    });

    it("should handle empty search terms", async () => {
      mockDocClient.mockSend.mockResolvedValueOnce({
        Items: mockTemplates.filter(
          (t) => t.visibility === "public" && t.moderationStatus === "approved",
        ),
        Count: 2,
      });

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/templates",
        queryStringParameters: {
          filter: "public",
          search: "   ", // Only whitespace
        },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedResponse.items).toHaveLength(2); // No filtering applied
    });

    it("should handle non-array tags", async () => {
      const templates = [
        {
          ...mockTemplates[0],
          tags: "email", // String instead of array
        },
      ];

      mockDocClient.mockSend.mockResolvedValueOnce({
        Items: templates,
        Count: 1,
      });

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/templates",
        queryStringParameters: {
          filter: "public",
          tag: "email",
        },
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedResponse.items).toHaveLength(1);
    });
  });
});
