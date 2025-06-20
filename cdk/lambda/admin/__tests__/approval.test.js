// Mock the auth module first
jest.mock("/opt/nodejs/auth", () => ({
  getUserFromEvent: jest.fn(),
}), { virtual: true });

// Mock the DynamoDB Document Client
const mockSend = jest.fn();
jest.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => ({ send: mockSend })),
  },
  QueryCommand: jest.fn(),
  PutCommand: jest.fn(),
  GetCommand: jest.fn(),
  UpdateCommand: jest.fn(),
  ScanCommand: jest.fn(),
}));

// Now require the modules
const { handler } = require("../approval");
const { getUserFromEvent } = require("/opt/nodejs/auth");
const {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
  GetCommand,
  UpdateCommand,
  ScanCommand,
} = require("@aws-sdk/lib-dynamodb");

describe("Approval Lambda", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockReset();

    // Set up environment variables
    process.env.USER_PERMISSIONS_TABLE = "test-permissions";
    process.env.TEMPLATES_TABLE = "test-templates";
    process.env.APPROVAL_HISTORY_TABLE = "test-approval-history";
  });

  describe("GET /admin/approval/queue", () => {
    it("should return 401 when no user authentication", async () => {
      getUserFromEvent.mockResolvedValue(null);

      const event = {
        httpMethod: "GET",
        path: "/admin/approval/queue",
        headers: {},
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.body)).toEqual({
        error: "Unauthorized",
      });
    });

    it("should return 403 when user lacks approval permission", async () => {
      getUserFromEvent.mockResolvedValue({
        sub: "user-123",
        email: "test@example.com",
      });

      // Mock permission check - no results
      mockSend.mockResolvedValueOnce({
        Items: [],
      });

      const event = {
        httpMethod: "GET",
        path: "/admin/approval/queue",
        headers: {
          Authorization: "Bearer token",
        },
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.body)).toEqual({
        error: "Forbidden: Approval permission required",
      });
    });

    it("should return approval queue when user has permission", async () => {
      getUserFromEvent.mockResolvedValue({
        sub: "user-123",
        email: "test@example.com",
      });

      // Mock permission check - user has approval permission
      mockSend
        .mockResolvedValueOnce({
          Items: [{ userId: "user-123", permission: "approval" }],
        })
        .mockResolvedValueOnce({
          Items: [], // Admin permission check
        })
        .mockResolvedValueOnce({
          // Mock templates query
          Items: [
            {
              templateId: "template-1",
              title: "Test Template",
              moderationStatus: "pending",
              createdAt: "2024-01-01T00:00:00Z",
            },
          ],
          Count: 1,
        });

      const event = {
        httpMethod: "GET",
        path: "/admin/approval/queue",
        headers: {
          Authorization: "Bearer token",
        },
        queryStringParameters: {
          status: "pending",
        },
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.templates).toHaveLength(1);
      expect(body.templates[0].templateId).toBe("template-1");
    });
  });

  describe("POST /admin/approval/template/{templateId}", () => {
    it("should approve a template", async () => {
      getUserFromEvent.mockResolvedValue({
        sub: "admin-123",
        email: "admin@example.com",
      });

      // Mock permission check
      mockSend
        .mockResolvedValueOnce({
          Items: [{ userId: "admin-123", permission: "approval" }],
        })
        .mockResolvedValueOnce({
          Items: [], // Admin permission check
        })
        .mockResolvedValueOnce({
          // Mock update response - THIS IS THE THIRD CALL
          Attributes: {
            templateId: "template-1",
            title: "Test Template",
            moderationStatus: "approved",
            userId: "template-author-123",
            updatedAt: "2024-01-01T00:00:00Z",
          },
          $metadata: {},
        })
        .mockResolvedValueOnce({}); // Mock history put

      const event = {
        httpMethod: "POST",
        path: "/admin/approval/template/template-1",
        pathParameters: {
          templateId: "template-1",
        },
        headers: {
          Authorization: "Bearer token",
        },
        body: JSON.stringify({
          action: "approve",
        }),
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          constructor: PutCommand,
        }),
      );
    });

    it("should reject a template with reason", async () => {
      getUserFromEvent.mockResolvedValue({
        sub: "admin-123",
        email: "admin@example.com",
      });

      // Mock permission check
      mockSend
        .mockResolvedValueOnce({
          Items: [{ userId: "admin-123", permission: "approval" }],
        })
        .mockResolvedValueOnce({
          Items: [], // Admin permission check
        })
        .mockResolvedValueOnce({
          // Mock update response
          Attributes: {
            templateId: "template-1",
            title: "Test Template",
            moderationStatus: "rejected",
            userId: "template-author-123",
            updatedAt: "2024-01-01T00:00:00Z",
          },
          $metadata: {},
        })
        .mockResolvedValueOnce({}); // Mock history put

      const event = {
        httpMethod: "POST",
        path: "/admin/approval/template/template-1",
        pathParameters: {
          templateId: "template-1",
        },
        headers: {
          Authorization: "Bearer token",
        },
        body: JSON.stringify({
          action: "reject",
          reason: "Inappropriate content",
        }),
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("rejected");
    });
  });
});
