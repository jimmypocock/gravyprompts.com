// Import mock utilities
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

// Mock DynamoDB
jest.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => mockDocClient),
  },
  QueryCommand: jest.fn(),
  PutCommand: jest.fn(),
  DeleteCommand: jest.fn(),
  ScanCommand: jest.fn(),
}));

// Now require the modules
const { handler } = require("../permissions");
const { getUserFromEvent } = require("/opt/nodejs/auth");

describe("Permissions Lambda", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDocClient.mockSend.mockReset();
    process.env.USER_PERMISSIONS_TABLE = "test-permissions";
  });

  describe("POST /admin/permissions", () => {
    it("should grant permission when user is admin", async () => {
      const adminUser = createMockUser({ sub: "admin-123" });
      getUserFromEvent.mockResolvedValue(adminUser);

      // Mock admin permission check
      mockDocClient.mockQuery([{ userId: "admin-123", permission: "admin" }]);

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/admin/permissions",
        body: JSON.stringify({
          userId: "target-user-123",
          permission: "approval",
        }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("granted successfully");
      expect(mockDocClient.mockSend).toHaveBeenCalledTimes(2); // Check + Grant
    });

    it("should return 403 when user is not admin", async () => {
      const regularUser = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(regularUser);

      // Mock permission check - no admin permission
      mockDocClient.mockQuery([]);

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/admin/permissions",
        body: JSON.stringify({
          userId: "target-user-123",
          permission: "approval",
        }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.body).error).toBe(
        "Forbidden: Admin permission required",
      );
    });

    it("should validate required fields", async () => {
      const adminUser = createMockUser({ sub: "admin-123" });
      getUserFromEvent.mockResolvedValue(adminUser);

      // Mock admin permission check
      mockDocClient.mockQuery([{ userId: "admin-123", permission: "admin" }]);

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/admin/permissions",
        body: JSON.stringify({
          userId: "target-user-123",
          // Missing permission field
        }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error).toBe(
        "userId and permission are required",
      );
    });

    it("should validate permission types", async () => {
      const adminUser = createMockUser({ sub: "admin-123" });
      getUserFromEvent.mockResolvedValue(adminUser);

      // Mock admin permission check
      mockDocClient.mockQuery([{ userId: "admin-123", permission: "admin" }]);

      const event = createMockEvent({
        httpMethod: "POST",
        path: "/admin/permissions",
        body: JSON.stringify({
          userId: "target-user-123",
          permission: "invalid-permission",
        }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error).toContain("Invalid permission");
    });
  });

  describe("GET /admin/permissions/users", () => {
    it("should list users with permissions", async () => {
      const adminUser = createMockUser({ sub: "admin-123" });
      getUserFromEvent.mockResolvedValue(adminUser);

      // Mock admin permission check
      mockDocClient.mockQuery([{ userId: "admin-123", permission: "admin" }]);

      // Mock scan for all permissions
      mockDocClient.mockScan([
        {
          userId: "user-1",
          permission: "approval",
          grantedAt: "2024-01-01T00:00:00Z",
          grantedBy: "admin-123",
        },
        {
          userId: "user-2",
          permission: "admin",
          grantedAt: "2024-01-02T00:00:00Z",
          grantedBy: "system",
        },
      ]);

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/admin/permissions/users",
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.users).toHaveLength(2);
      expect(body.users[0].userId).toBe("user-1");
      expect(body.users[0].permission).toBe("approval");
    });
  });

  describe("DELETE /admin/permissions/{userId}/{permission}", () => {
    it("should revoke permission when user is admin", async () => {
      const adminUser = createMockUser({ sub: "admin-123" });
      getUserFromEvent.mockResolvedValue(adminUser);

      // Mock admin permission check
      mockDocClient.mockQuery([{ userId: "admin-123", permission: "admin" }]);

      const event = createMockEvent({
        httpMethod: "DELETE",
        path: "/admin/permissions/target-user-123/approval",
        pathParameters: {
          userId: "target-user-123",
          permission: "approval",
        },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("revoked successfully");
    });

    it("should prevent revoking own admin permission", async () => {
      const adminUser = createMockUser({ sub: "admin-123" });
      getUserFromEvent.mockResolvedValue(adminUser);

      // Mock admin permission check
      mockDocClient.mockQuery([{ userId: "admin-123", permission: "admin" }]);

      const event = createMockEvent({
        httpMethod: "DELETE",
        path: "/admin/permissions/admin-123/admin",
        pathParameters: {
          userId: "admin-123",
          permission: "admin",
        },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Cannot revoke your own admin permission");
    });
  });

  describe("GET /admin/permissions/me", () => {
    it("should return current user permissions", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      // Mock user permissions query
      mockDocClient.mockQuery([
        { userId: "user-123", permission: "approval" },
        { userId: "user-123", permission: "admin" },
      ]);

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/admin/permissions/me",
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.permissions).toEqual(["approval", "admin"]);
    });

    it("should auto-grant admin in local development for LOCAL_ADMIN_USER_ID", async () => {
      // Set up local development environment
      process.env.AWS_SAM_LOCAL = "true";
      process.env.LOCAL_ADMIN_USER_ID = "local-admin-123";

      const user = createMockUser({ sub: "local-admin-123" });
      getUserFromEvent.mockResolvedValue(user);

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/admin/permissions/me",
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.permissions).toEqual(["admin", "approval"]);

      // Should not query database in local dev for admin user
      expect(mockDocClient.mockSend).not.toHaveBeenCalled();

      // Clean up
      delete process.env.AWS_SAM_LOCAL;
      delete process.env.LOCAL_ADMIN_USER_ID;
    });

    it("should return empty array if user has no permissions", async () => {
      const user = createMockUser({ sub: "user-123" });
      getUserFromEvent.mockResolvedValue(user);

      // Mock empty permissions query
      mockDocClient.mockQuery([]);

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/admin/permissions/me",
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.permissions).toEqual([]);
    });

    it("should return 401 if not authenticated", async () => {
      getUserFromEvent.mockResolvedValue(null);

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/admin/permissions/me",
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.body).error).toBe("Unauthorized");
    });
  });
});
