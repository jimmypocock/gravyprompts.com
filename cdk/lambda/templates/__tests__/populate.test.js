const {
  createMockDocClient,
  createMockEvent,
  createMockUser,
} = require("../../../test-utils/dynamodb-mock");

// Create mock client before mocking
const mockDocClient = createMockDocClient();

// Mock uuid
jest.mock("uuid", () => ({
  v4: jest.fn(() => "usage-123"),
}));

// Mock the utils module
const mockUtils = {
  docClient: mockDocClient,
  createResponse: jest.fn((statusCode, body, headers = {}) => ({
    statusCode,
    headers: { 
      "Content-Type": "application/json",
      ...headers 
    },
    body: JSON.stringify(body),
  })),
  getUserIdFromEvent: jest.fn(),
  sanitizeHtml: jest.fn((html) => html),
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
  PutCommand: jest.fn((params) => params),
  UpdateCommand: jest.fn((params) => params),
}));

// Now require the handler
const { handler } = require("../populate");

describe("Populate Template Lambda", () => {
  const publicTemplate = {
    templateId: "template-123",
    userId: "user-123",
    title: "Email Template",
    content: "Hello [[name]], Welcome to [[company]]! Your email is [[email]].",
    variables: ["name", "company", "email"],
    visibility: "public",
    moderationStatus: "approved",
    viewers: [],
  };

  const privateTemplate = {
    ...publicTemplate,
    templateId: "private-template",
    visibility: "private",
    moderationStatus: "not_required",
    viewers: ["viewer-123"],
  };

  const htmlTemplate = {
    ...publicTemplate,
    templateId: "html-template",
    content:
      "<h1>Hello [[name]]!</h1><p>Welcome to <strong>[[company]]</strong></p>",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockDocClient.mockSend.mockReset();
    process.env.TEMPLATES_TABLE = "test-templates";
    process.env.TEMPLATE_VIEWS_TABLE = "test-template-views";
    process.env.ENVIRONMENT = "test";
  });

  describe("Successful population", () => {
    it("should populate template with all variables", async () => {
      mockUtils.getUserIdFromEvent.mockReturnValue("user-456");
      mockDocClient.mockSend
        .mockResolvedValueOnce({ Item: publicTemplate }) // GetCommand
        .mockResolvedValueOnce({}) // UpdateCommand (use count)
        .mockResolvedValueOnce({}); // PutCommand (usage tracking)

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates/template-123/populate",
        pathParameters: { templateId: "template-123" },
        body: JSON.stringify({
          variables: {
            name: "John Doe",
            company: "Acme Corp",
            email: "john@acme.com",
          },
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedResponse.populatedContent).toBe(
        "Hello John Doe, Welcome to Acme Corp! Your email is john@acme.com.",
      );
      expect(parsedResponse.variables).toEqual({
        required: ["name", "company", "email"],
        provided: ["name", "company", "email"],
        missing: [],
        used: ["name", "company", "email"],
      });
      expect(parsedResponse.warning).toBeUndefined();
    });

    it("should populate with partial variables and warn about missing ones", async () => {
      mockUtils.getUserIdFromEvent.mockReturnValue("user-456");
      mockDocClient.mockSend
        .mockResolvedValueOnce({ Item: publicTemplate })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates/template-123/populate",
        pathParameters: { templateId: "template-123" },
        body: JSON.stringify({
          variables: {
            name: "John Doe",
            company: "Acme Corp",
            // email is missing
          },
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedResponse.populatedContent).toBe(
        "Hello John Doe, Welcome to Acme Corp! Your email is [[email]].",
      );
      expect(parsedResponse.variables.missing).toEqual(["email"]);
      expect(parsedResponse.warning).toBe(
        "Missing values for variables: email",
      );
    });

    it("should return plain text when returnHtml is false", async () => {
      mockUtils.getUserIdFromEvent.mockReturnValue("user-456");
      mockDocClient.mockSend
        .mockResolvedValueOnce({ Item: htmlTemplate })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates/html-template/populate",
        pathParameters: { templateId: "html-template" },
        body: JSON.stringify({
          variables: {
            name: "John Doe",
            company: "Acme Corp",
          },
          returnHtml: false,
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedResponse.populatedContent).toBe(
        "Hello John Doe!Welcome to Acme Corp",
      );
    });

    it("should sanitize variable values to prevent XSS", async () => {
      mockUtils.getUserIdFromEvent.mockReturnValue("user-456");
      mockUtils.sanitizeHtml.mockImplementation((val) =>
        val.replace(/<script>/g, "&lt;script&gt;"),
      );

      mockDocClient.mockSend
        .mockResolvedValueOnce({ Item: publicTemplate })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates/template-123/populate",
        pathParameters: { templateId: "template-123" },
        body: JSON.stringify({
          variables: {
            name: '<script>alert("XSS")</script>',
            company: "Acme Corp",
            email: "john@acme.com",
          },
        }),
      });

      await handler(event);

      expect(mockUtils.sanitizeHtml).toHaveBeenCalledWith(
        '<script>alert("XSS")</script>',
      );
    });

    it("should handle numeric and boolean variable values", async () => {
      mockUtils.getUserIdFromEvent.mockReturnValue("user-456");

      const numberTemplate = {
        ...publicTemplate,
        content: "Your order #[[orderNumber]] totals $[[amount]]",
        variables: ["orderNumber", "amount"],
      };

      mockDocClient.mockSend
        .mockResolvedValueOnce({ Item: numberTemplate })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates/template-123/populate",
        pathParameters: { templateId: "template-123" },
        body: JSON.stringify({
          variables: {
            orderNumber: 12345,
            amount: 99.99,
          },
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedResponse.populatedContent).toBe(
        "Your order #12345 totals $99.99",
      );
    });
  });

  describe("Access control", () => {
    it("should allow anonymous access to public approved templates", async () => {
      mockUtils.getUserIdFromEvent.mockReturnValue(null); // Anonymous
      mockDocClient.mockSend
        .mockResolvedValueOnce({ Item: publicTemplate })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates/template-123/populate",
        pathParameters: { templateId: "template-123" },
        body: JSON.stringify({
          variables: { name: "John", company: "Acme", email: "john@acme.com" },
        }),
      });

      const response = await handler(event);
      expect(response.statusCode).toBe(200);
    });

    it("should deny access to private template for non-viewer", async () => {
      mockUtils.getUserIdFromEvent.mockReturnValue("other-user");
      mockDocClient.mockSend.mockResolvedValueOnce({ Item: privateTemplate });

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates/private-template/populate",
        pathParameters: { templateId: "private-template" },
        body: JSON.stringify({
          variables: { name: "John" },
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(403);
      expect(parsedResponse.error).toBe(
        "You do not have access to this template",
      );
    });

    it("should allow owner access to their own template", async () => {
      mockUtils.getUserIdFromEvent.mockReturnValue("user-123"); // Owner
      mockDocClient.mockSend
        .mockResolvedValueOnce({ Item: privateTemplate })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates/private-template/populate",
        pathParameters: { templateId: "private-template" },
        body: JSON.stringify({
          variables: { name: "John", company: "Acme", email: "john@acme.com" },
        }),
      });

      const response = await handler(event);
      expect(response.statusCode).toBe(200);
    });

    it("should allow viewer access to private template", async () => {
      mockUtils.getUserIdFromEvent.mockReturnValue("viewer-123");
      mockDocClient.mockSend
        .mockResolvedValueOnce({ Item: privateTemplate })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates/private-template/populate",
        pathParameters: { templateId: "private-template" },
        body: JSON.stringify({
          variables: { name: "John", company: "Acme", email: "john@acme.com" },
        }),
      });

      const response = await handler(event);
      expect(response.statusCode).toBe(200);
    });

    it("should allow access with valid share token", async () => {
      mockUtils.getUserIdFromEvent.mockReturnValue(null);

      const templateWithToken = {
        ...privateTemplate,
        shareTokens: {
          "valid-token": {
            createdAt: "2024-01-01T00:00:00Z",
            expiresAt: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
          },
        },
      };

      mockDocClient.mockSend
        .mockResolvedValueOnce({ Item: templateWithToken })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates/private-template/populate",
        pathParameters: { templateId: "private-template" },
        queryStringParameters: { token: "valid-token" },
        body: JSON.stringify({
          variables: { name: "John", company: "Acme", email: "john@acme.com" },
        }),
      });

      const response = await handler(event);
      expect(response.statusCode).toBe(200);
    });

    it("should deny access with expired share token", async () => {
      mockUtils.getUserIdFromEvent.mockReturnValue(null);

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
        httpMethod: "POST",
        path: "/templates/private-template/populate",
        pathParameters: { templateId: "private-template" },
        queryStringParameters: { token: "expired-token" },
        body: JSON.stringify({
          variables: { name: "John" },
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(403);
      expect(parsedResponse.error).toBe(
        "You do not have access to this template",
      );
    });

    it("should deny access to pending moderation template for non-owner", async () => {
      mockUtils.getUserIdFromEvent.mockReturnValue("other-user");

      const pendingTemplate = {
        ...publicTemplate,
        moderationStatus: "pending",
      };

      mockDocClient.mockSend.mockResolvedValueOnce({ Item: pendingTemplate });

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates/template-123/populate",
        pathParameters: { templateId: "template-123" },
        body: JSON.stringify({
          variables: { name: "John" },
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(403);
    });
  });

  describe("Validation and error handling", () => {
    it("should require templateId parameter", async () => {
      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates//populate",
        pathParameters: {},
        body: JSON.stringify({ variables: {} }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(parsedResponse.error).toBe("Template ID is required");
    });

    it("should require variables object", async () => {
      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates/template-123/populate",
        pathParameters: { templateId: "template-123" },
        body: JSON.stringify({}),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(parsedResponse.error).toBe("Variables object is required");
    });

    it("should validate variables is an object", async () => {
      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates/template-123/populate",
        pathParameters: { templateId: "template-123" },
        body: JSON.stringify({ variables: "not-an-object" }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(400);
      expect(parsedResponse.error).toBe("Variables object is required");
    });

    it("should handle non-existent template", async () => {
      mockUtils.getUserIdFromEvent.mockReturnValue("user-123");
      mockDocClient.mockSend.mockResolvedValueOnce({ Item: null });

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates/non-existent/populate",
        pathParameters: { templateId: "non-existent" },
        body: JSON.stringify({ variables: { name: "John" } }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(404);
      expect(parsedResponse.error).toBe("Template not found");
    });

    it("should handle invalid JSON in request body", async () => {
      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates/template-123/populate",
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
        path: "/templates/template-123/populate",
        pathParameters: { templateId: "template-123" },
        body: JSON.stringify({ variables: { name: "John" } }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(500);
      expect(parsedResponse.error).toBe("Internal server error");
    });
  });

  describe("Usage tracking", () => {
    it("should track template usage for authenticated users", async () => {
      mockUtils.getUserIdFromEvent.mockReturnValue("user-456");
      mockDocClient.mockSend
        .mockResolvedValueOnce({ Item: publicTemplate })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates/template-123/populate",
        pathParameters: { templateId: "template-123" },
        body: JSON.stringify({
          variables: { name: "John", company: "Acme", email: "john@acme.com" },
        }),
      });

      await handler(event);

      // Check use count update
      const updateCall = mockDocClient.mockSend.mock.calls[1][0];
      expect(updateCall).toMatchObject({
        TableName: "test-templates",
        Key: { templateId: "template-123" },
        UpdateExpression: "ADD useCount :inc",
        ExpressionAttributeValues: { ":inc": 1 },
      });

      // Check usage tracking
      const putCall = mockDocClient.mockSend.mock.calls[2][0];
      expect(putCall.TableName).toBe("test-template-views");
      expect(putCall.Item).toMatchObject({
        viewId: "usage-123",
        templateId: "template-123",
        viewerId: "user-456",
        viewType: "populate",
      });
    });

    it("should track anonymous usage", async () => {
      mockUtils.getUserIdFromEvent.mockReturnValue(null);
      mockDocClient.mockSend
        .mockResolvedValueOnce({ Item: publicTemplate })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates/template-123/populate",
        pathParameters: { templateId: "template-123" },
        body: JSON.stringify({
          variables: { name: "John", company: "Acme", email: "john@acme.com" },
        }),
      });

      await handler(event);

      const putCall = mockDocClient.mockSend.mock.calls[2][0];
      expect(putCall.Item.viewerId).toBe("anonymous");
    });

    it("should continue even if tracking fails", async () => {
      mockUtils.getUserIdFromEvent.mockReturnValue("user-456");
      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      mockDocClient.mockSend
        .mockResolvedValueOnce({ Item: publicTemplate })
        .mockRejectedValueOnce(new Error("Tracking error")) // UpdateCommand fails
        .mockResolvedValueOnce({});

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates/template-123/populate",
        pathParameters: { templateId: "template-123" },
        body: JSON.stringify({
          variables: { name: "John", company: "Acme", email: "john@acme.com" },
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      // Should still return success
      expect(response.statusCode).toBe(200);
      expect(parsedResponse.populatedContent).toBe(
        "Hello John, Welcome to Acme! Your email is john@acme.com.",
      );

      // Should log the error
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error tracking usage:",
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe("Edge cases", () => {
    it("should handle null and undefined variable values", async () => {
      mockUtils.getUserIdFromEvent.mockReturnValue("user-456");
      mockDocClient.mockSend
        .mockResolvedValueOnce({ Item: publicTemplate })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates/template-123/populate",
        pathParameters: { templateId: "template-123" },
        body: JSON.stringify({
          variables: {
            name: null,
            company: undefined,
            email: "john@acme.com",
          },
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedResponse.variables.missing).toEqual(["name", "company"]);
      expect(parsedResponse.warning).toBe(
        "Missing values for variables: name, company",
      );
    });

    it("should handle templates with no variables", async () => {
      mockUtils.getUserIdFromEvent.mockReturnValue("user-456");

      const noVarTemplate = {
        ...publicTemplate,
        content: "This is a static template with no variables.",
        variables: [],
      };

      mockDocClient.mockSend
        .mockResolvedValueOnce({ Item: noVarTemplate })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates/template-123/populate",
        pathParameters: { templateId: "template-123" },
        body: JSON.stringify({
          variables: {},
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedResponse.populatedContent).toBe(
        "This is a static template with no variables.",
      );
      expect(parsedResponse.variables.missing).toEqual([]);
    });

    it("should handle variables with special regex characters", async () => {
      mockUtils.getUserIdFromEvent.mockReturnValue("user-456");

      const specialTemplate = {
        ...publicTemplate,
        content: "Price: [[price]] (includes [[discount]])",
        variables: ["price", "discount"],
      };

      mockDocClient.mockSend
        .mockResolvedValueOnce({ Item: specialTemplate })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates/template-123/populate",
        pathParameters: { templateId: "template-123" },
        body: JSON.stringify({
          variables: {
            price: "$99.99",
            discount: "10% ($9.99)",
          },
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedResponse.populatedContent).toBe(
        "Price: $99.99 (includes 10% ($9.99))",
      );
    });

    it("should handle repeated variable placeholders", async () => {
      mockUtils.getUserIdFromEvent.mockReturnValue("user-456");

      const repeatedVarTemplate = {
        ...publicTemplate,
        content: "Dear [[name]], [[name]] has won! Congratulations [[name]]!",
        variables: ["name"],
      };

      mockDocClient.mockSend
        .mockResolvedValueOnce({ Item: repeatedVarTemplate })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/templates/template-123/populate",
        pathParameters: { templateId: "template-123" },
        body: JSON.stringify({
          variables: {
            name: "John",
          },
        }),
      });

      const response = await handler(event);
      const parsedResponse = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedResponse.populatedContent).toBe(
        "Dear John, John has won! Congratulations John!",
      );
    });
  });
});
