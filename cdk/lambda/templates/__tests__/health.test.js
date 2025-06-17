const { createMockEvent } = require("../../../test-utils/dynamodb-mock");

// Mock environment variables
const originalEnv = process.env;

describe("Health Check Lambda", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.TEMPLATES_TABLE = "test-templates";
    process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE = "1024";

    // Mock console
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    console.log.mockRestore();
  });

  describe("Basic functionality", () => {
    it("should return 200 status with health information", async () => {
      const { handler } = require("../health");

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/health",
      });

      const response = await handler(event);
      const parsedBody = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedBody.status).toBe("ok");
      expect(parsedBody.timestamp).toBeDefined();
      expect(parsedBody.environment).toBeDefined();
    });

    it("should include proper CORS headers", async () => {
      const { handler } = require("../health");

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/health",
      });

      const response = await handler(event);

      expect(response.headers).toEqual({
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      });
    });

    it("should log health check call", async () => {
      const { handler } = require("../health");

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/health",
      });

      await handler(event);

      expect(console.log).toHaveBeenCalledWith("Health check handler called");
    });
  });

  describe("Environment information", () => {
    it("should include environment variables", async () => {
      const { handler } = require("../health");

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/health",
      });

      const response = await handler(event);
      const parsedBody = JSON.parse(response.body);

      expect(parsedBody.environment.TEMPLATES_TABLE).toBe("test-templates");
      expect(parsedBody.environment.memoryLimit).toBe("1024");
      expect(parsedBody.environment.nodeVersion).toBe(process.version);
      expect(parsedBody.environment.hasUtils).toBe(false);
    });

    it("should handle missing environment variables", async () => {
      delete process.env.TEMPLATES_TABLE;
      delete process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE;

      // Re-require to get fresh module
      jest.resetModules();
      const { handler } = require("../health");

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/health",
      });

      const response = await handler(event);
      const parsedBody = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(parsedBody.environment.TEMPLATES_TABLE).toBeUndefined();
      expect(parsedBody.environment.memoryLimit).toBeUndefined();
    });
  });

  describe("Timestamp validation", () => {
    it("should return valid ISO timestamp", async () => {
      const { handler } = require("../health");

      const beforeTime = new Date().toISOString();

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/health",
      });

      const response = await handler(event);
      const parsedBody = JSON.parse(response.body);

      const afterTime = new Date().toISOString();

      expect(parsedBody.timestamp).toBeDefined();
      expect(new Date(parsedBody.timestamp).toISOString()).toBe(
        parsedBody.timestamp,
      );
      expect(parsedBody.timestamp >= beforeTime).toBe(true);
      expect(parsedBody.timestamp <= afterTime).toBe(true);
    });
  });

  describe("Response format", () => {
    it("should return properly formatted JSON", async () => {
      const { handler } = require("../health");

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/health",
      });

      const response = await handler(event);

      // Should not throw
      expect(() => JSON.parse(response.body)).not.toThrow();

      const parsedBody = JSON.parse(response.body);
      expect(typeof parsedBody).toBe("object");
    });

    it("should always return 200 regardless of event content", async () => {
      const { handler } = require("../health");

      // Various event types
      const events = [
        createMockEvent({ httpMethod: "GET", path: "/health" }),
        createMockEvent({
          httpMethod: "POST",
          path: "/health",
          body: '{"test": true}',
        }),
        createMockEvent({ httpMethod: "PUT", path: "/health" }),
        createMockEvent({ httpMethod: "DELETE", path: "/health" }),
        createMockEvent({ httpMethod: "OPTIONS", path: "/health" }),
        createMockEvent({
          httpMethod: "GET",
          path: "/health",
          queryStringParameters: { foo: "bar" },
        }),
        createMockEvent({
          httpMethod: "GET",
          path: "/health",
          headers: { "X-Custom": "header" },
        }),
        {}, // Empty event
      ];

      for (const event of events) {
        const response = await handler(event);
        expect(response.statusCode).toBe(200);
        const parsedBody = JSON.parse(response.body);
        expect(parsedBody.status).toBe("ok");
      }
    });
  });

  describe("Edge cases", () => {
    it("should handle null event", async () => {
      const { handler } = require("../health");

      const response = await handler(null);

      expect(response.statusCode).toBe(200);
      const parsedBody = JSON.parse(response.body);
      expect(parsedBody.status).toBe("ok");
    });

    it("should handle undefined event", async () => {
      const { handler } = require("../health");

      const response = await handler(undefined);

      expect(response.statusCode).toBe(200);
      const parsedBody = JSON.parse(response.body);
      expect(parsedBody.status).toBe("ok");
    });

    it("should not expose sensitive information", async () => {
      process.env.SECRET_KEY = "super-secret";
      process.env.AWS_SECRET_ACCESS_KEY = "secret-access-key";

      const { handler } = require("../health");

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/health",
      });

      const response = await handler(event);
      const parsedBody = JSON.parse(response.body);
      const responseString = JSON.stringify(parsedBody);

      // Should not contain sensitive values
      expect(responseString).not.toContain("super-secret");
      expect(responseString).not.toContain("secret-access-key");
      expect(parsedBody.environment.SECRET_KEY).toBeUndefined();
      expect(parsedBody.environment.AWS_SECRET_ACCESS_KEY).toBeUndefined();
    });
  });

  describe("Performance", () => {
    it("should respond quickly", async () => {
      const { handler } = require("../health");

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/health",
      });

      const startTime = Date.now();
      await handler(event);
      const endTime = Date.now();

      // Health check should be very fast (under 100ms)
      expect(endTime - startTime).toBeLessThan(100);
    });

    it("should handle multiple concurrent requests", async () => {
      const { handler } = require("../health");

      const event = createMockEvent({
        httpMethod: "GET",
        path: "/health",
      });

      // Make 10 concurrent requests
      const promises = Array(10)
        .fill(null)
        .map(() => handler(event));
      const responses = await Promise.all(promises);

      // All should succeed
      responses.forEach((response) => {
        expect(response.statusCode).toBe(200);
        const parsedBody = JSON.parse(response.body);
        expect(parsedBody.status).toBe("ok");
      });
    });
  });

  describe("Module caching", () => {
    it("should work correctly when module is cached", async () => {
      // First call
      const { handler: handler1 } = require("../health");
      const response1 = await handler1(
        createMockEvent({ httpMethod: "GET", path: "/health" }),
      );

      // Second call (module should be cached)
      const { handler: handler2 } = require("../health");
      const response2 = await handler2(
        createMockEvent({ httpMethod: "GET", path: "/health" }),
      );

      expect(handler1).toBe(handler2); // Same function reference
      expect(response1.statusCode).toBe(200);
      expect(response2.statusCode).toBe(200);
    });
  });
});
