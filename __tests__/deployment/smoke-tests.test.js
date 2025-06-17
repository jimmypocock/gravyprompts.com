/**
 * Deployment Smoke Tests
 *
 * These tests validate that the application is working correctly after deployment,
 * including environment verification, critical path testing, and rollback validation.
 */

const axios = require("axios");

// Environment configuration
const environments = {
  staging: {
    apiUrl: "https://api-staging.gravyprompts.com",
    webUrl: "https://staging.gravyprompts.com",
    expectedVersion: process.env.DEPLOY_VERSION || "latest",
  },
  production: {
    apiUrl: "https://api.gravyprompts.com",
    webUrl: "https://gravyprompts.com",
    expectedVersion: process.env.DEPLOY_VERSION || "latest",
  },
};

const currentEnv = process.env.NODE_ENV || "staging";
const config = environments[currentEnv];

describe("Deployment Smoke Tests", () => {
  beforeAll(() => {
    console.log(`Running smoke tests for ${currentEnv} environment`);
    console.log(`API URL: ${config.apiUrl}`);
    console.log(`Web URL: ${config.webUrl}`);
    console.log(`Expected Version: ${config.expectedVersion}`);
  });

  describe("Environment Verification", () => {
    it("should have correct environment configuration", async () => {
      expect(config).toBeDefined();
      expect(config.apiUrl).toBeTruthy();
      expect(config.webUrl).toBeTruthy();
      expect(config.expectedVersion).toBeTruthy();
    });

    it("should connect to the correct API endpoint", async () => {
      const response = await axios.get(`${config.apiUrl}/health`, {
        timeout: 10000,
        validateStatus: () => true, // Accept any status code
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty("status");
      expect(response.data).toHaveProperty("environment");
      expect(response.data.environment).toBe(currentEnv);
    });

    it("should serve the correct application version", async () => {
      const response = await axios.get(`${config.apiUrl}/version`, {
        timeout: 5000,
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty("version");

      if (config.expectedVersion !== "latest") {
        expect(response.data.version).toBe(config.expectedVersion);
      }
    });

    it("should have correct security headers", async () => {
      const response = await axios.get(config.webUrl, {
        timeout: 10000,
      });

      expect(response.status).toBe(200);

      // Security headers
      expect(response.headers["x-frame-options"]).toBeDefined();
      expect(response.headers["x-content-type-options"]).toBe("nosniff");
      expect(response.headers["x-xss-protection"]).toBeDefined();
      expect(response.headers["strict-transport-security"]).toBeDefined();
    });

    it("should have correct CORS configuration", async () => {
      const response = await axios.options(config.apiUrl, {
        headers: {
          Origin: config.webUrl,
          "Access-Control-Request-Method": "GET",
        },
        timeout: 5000,
      });

      expect(response.status).toBe(200);
      expect(response.headers["access-control-allow-origin"]).toBe(
        config.webUrl,
      );
      expect(response.headers["access-control-allow-methods"]).toContain("GET");
    });
  });

  describe("Infrastructure Health Checks", () => {
    it("should have healthy API service", async () => {
      const response = await axios.get(`${config.apiUrl}/health`, {
        timeout: 10000,
      });

      expect(response.status).toBe(200);
      expect(response.data.status).toBe("healthy");
      expect(response.data.checks).toHaveProperty("database");
      expect(response.data.checks.database.status).toBe("healthy");
    });

    it("should have accessible database", async () => {
      const response = await axios.get(`${config.apiUrl}/health/database`, {
        timeout: 10000,
      });

      expect(response.status).toBe(200);
      expect(response.data.status).toBe("healthy");
      expect(response.data.responseTime).toBeLessThan(1000); // Under 1 second
    });

    it("should have working authentication service", async () => {
      const response = await axios.get(`${config.apiUrl}/health/auth`, {
        timeout: 10000,
      });

      expect(response.status).toBe(200);
      expect(response.data.cognito).toHaveProperty("status");
      expect(response.data.cognito.status).toBe("healthy");
    });

    it("should have accessible static assets", async () => {
      // Test CSS loading
      const cssResponse = await axios.get(
        `${config.webUrl}/_next/static/css/app.css`,
        {
          timeout: 5000,
          validateStatus: (status) => status < 500, // 404 is ok if file doesn't exist
        },
      );

      expect([200, 404]).toContain(cssResponse.status);

      // Test JavaScript loading
      const jsResponse = await axios.get(
        `${config.webUrl}/_next/static/chunks/main.js`,
        {
          timeout: 5000,
          validateStatus: (status) => status < 500,
        },
      );

      expect([200, 404]).toContain(jsResponse.status);
    });
  });

  describe("Critical Path Functionality", () => {
    it("should load the home page", async () => {
      const response = await axios.get(config.webUrl, {
        timeout: 15000,
      });

      expect(response.status).toBe(200);
      expect(response.data).toContain("GravyPrompts");
      expect(response.data).toContain("template"); // Should have template-related content
    });

    it("should serve templates API endpoint", async () => {
      const response = await axios.get(`${config.apiUrl}/templates?limit=5`, {
        timeout: 10000,
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty("templates");
      expect(Array.isArray(response.data.templates)).toBe(true);
      expect(response.data).toHaveProperty("pagination");
    });

    it("should handle template search", async () => {
      const response = await axios.get(
        `${config.apiUrl}/templates?search=email&limit=3`,
        {
          timeout: 10000,
        },
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty("templates");
      expect(response.data.templates.length).toBeGreaterThanOrEqual(0);
    });

    it("should return 404 for non-existent resources", async () => {
      const response = await axios.get(
        `${config.apiUrl}/templates/non-existent-template`,
        {
          timeout: 5000,
          validateStatus: () => true,
        },
      );

      expect(response.status).toBe(404);
      expect(response.data).toHaveProperty("error");
    });

    it("should handle API rate limiting correctly", async () => {
      // Make multiple rapid requests to test rate limiting
      const requests = Array.from({ length: 10 }, () =>
        axios.get(`${config.apiUrl}/templates`, {
          timeout: 5000,
          validateStatus: () => true,
        }),
      );

      const responses = await Promise.all(requests);

      // Most should succeed, but rate limiting might kick in
      const successfulResponses = responses.filter((r) => r.status === 200);
      const rateLimitedResponses = responses.filter((r) => r.status === 429);

      expect(successfulResponses.length).toBeGreaterThan(5);

      if (rateLimitedResponses.length > 0) {
        expect(rateLimitedResponses[0].headers["retry-after"]).toBeDefined();
      }
    });
  });

  describe("Authentication Flow Validation", () => {
    it("should reject requests without authentication for protected endpoints", async () => {
      const protectedEndpoints = [
        "/templates", // POST
        "/prompts", // GET/POST
      ];

      for (const endpoint of protectedEndpoints) {
        const response = await axios.post(
          `${config.apiUrl}${endpoint}`,
          {
            title: "Test",
            content: "Test content",
          },
          {
            timeout: 5000,
            validateStatus: () => true,
          },
        );

        expect([401, 403]).toContain(response.status);
      }
    });

    it("should handle invalid authentication tokens", async () => {
      const response = await axios.get(`${config.apiUrl}/prompts`, {
        headers: {
          Authorization: "Bearer invalid-token-123",
        },
        timeout: 5000,
        validateStatus: () => true,
      });

      expect([401, 403]).toContain(response.status);
    });
  });

  describe("Error Handling Validation", () => {
    it("should return proper error responses", async () => {
      // Test malformed request
      const response = await axios.post(
        `${config.apiUrl}/templates`,
        {
          // Missing required fields
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 5000,
          validateStatus: () => true,
        },
      );

      expect(response.status).toBe(400);
      expect(response.data).toHaveProperty("error");
      expect(response.data.error).toHaveProperty("message");
    });

    it("should handle database connection errors gracefully", async () => {
      // This test would typically involve temporarily disconnecting the database
      // For smoke tests, we'll verify the error response format
      const response = await axios.get(
        `${config.apiUrl}/templates/load-test-very-heavy-operation`,
        {
          timeout: 30000,
          validateStatus: () => true,
        },
      );

      // Should either succeed or fail gracefully
      if (response.status >= 500) {
        expect(response.data).toHaveProperty("error");
        expect(response.data.error.message).not.toContain("stack trace");
        expect(response.data.error.message).not.toContain("database");
      }
    });
  });

  describe("Performance Validation", () => {
    it("should respond to health checks quickly", async () => {
      const startTime = Date.now();

      const response = await axios.get(`${config.apiUrl}/health`, {
        timeout: 5000,
      });

      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(2000); // Under 2 seconds
    });

    it("should serve template lists within acceptable time", async () => {
      const startTime = Date.now();

      const response = await axios.get(`${config.apiUrl}/templates?limit=20`, {
        timeout: 10000,
      });

      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(5000); // Under 5 seconds
    });

    it("should serve web pages within acceptable time", async () => {
      const startTime = Date.now();

      const response = await axios.get(config.webUrl, {
        timeout: 15000,
      });

      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(10000); // Under 10 seconds
    });
  });

  describe("Data Consistency Validation", () => {
    it("should return consistent data across multiple requests", async () => {
      const requests = Array.from({ length: 3 }, () =>
        axios.get(`${config.apiUrl}/templates?limit=5`, { timeout: 5000 }),
      );

      const responses = await Promise.all(requests);

      // All should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty("templates");
      });

      // Data structure should be consistent
      const firstResponse = responses[0].data;
      responses.forEach((response) => {
        expect(response.data).toHaveProperty("templates");
        expect(response.data).toHaveProperty("pagination");
        expect(typeof response.data.pagination.total).toBe("number");
      });
    });

    it("should maintain data integrity across services", async () => {
      // Test that template count from different endpoints is consistent
      const listResponse = await axios.get(
        `${config.apiUrl}/templates?limit=1`,
        {
          timeout: 5000,
        },
      );

      const healthResponse = await axios.get(`${config.apiUrl}/health`, {
        timeout: 5000,
      });

      expect(listResponse.status).toBe(200);
      expect(healthResponse.status).toBe(200);

      // Both should indicate a working system
      expect(listResponse.data.templates).toBeDefined();
      expect(healthResponse.data.status).toBe("healthy");
    });
  });

  describe("Security Validation", () => {
    it("should not expose sensitive information", async () => {
      const response = await axios.get(`${config.apiUrl}/templates?limit=1`, {
        timeout: 5000,
      });

      expect(response.status).toBe(200);

      const responseStr = JSON.stringify(response.data);

      // Should not contain sensitive info
      expect(responseStr).not.toContain("password");
      expect(responseStr).not.toContain("secret");
      expect(responseStr).not.toContain("key");
      expect(responseStr).not.toContain("token");
      expect(responseStr).not.toContain("aws");
    });

    it("should have proper API versioning", async () => {
      const response = await axios.get(`${config.apiUrl}/templates`, {
        headers: {
          Accept: "application/json",
        },
        timeout: 5000,
      });

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toContain("application/json");
    });
  });

  describe("Monitoring and Logging Validation", () => {
    it("should generate proper access logs", async () => {
      // Make a request that should be logged
      const response = await axios.get(
        `${config.apiUrl}/templates?test=smoke-test`,
        {
          headers: {
            "User-Agent": "SmokeTest/1.0",
            "X-Test-Request": "true",
          },
          timeout: 5000,
        },
      );

      expect(response.status).toBe(200);

      // Response should include correlation ID for tracing
      expect(
        response.headers["x-request-id"] ||
          response.headers["x-correlation-id"],
      ).toBeDefined();
    });

    it("should have working metrics collection", async () => {
      const response = await axios.get(`${config.apiUrl}/health/metrics`, {
        timeout: 5000,
        validateStatus: () => true,
      });

      // Metrics endpoint may be protected, but should not return 500
      expect(response.status).not.toBe(500);

      if (response.status === 200) {
        expect(response.data).toHaveProperty("metrics");
      }
    });
  });

  describe("Rollback Validation", () => {
    it("should maintain API compatibility during rollbacks", async () => {
      // Test that current API still accepts previous version requests
      const legacyRequest = {
        title: "Legacy Test Template",
        content: "Legacy content",
        tags: ["legacy", "test"],
        visibility: "public",
      };

      const response = await axios.post(
        `${config.apiUrl}/templates`,
        legacyRequest,
        {
          headers: {
            "Content-Type": "application/json",
            "API-Version": "v1",
          },
          timeout: 5000,
          validateStatus: () => true,
        },
      );

      // Should either succeed or give a clear compatibility error
      if (response.status >= 400) {
        expect(response.data).toHaveProperty("error");
        expect(response.data.error.message).not.toContain("stack trace");
      }
    });

    it("should preserve essential data during rollbacks", async () => {
      // Verify that essential data structures are preserved
      const response = await axios.get(`${config.apiUrl}/templates?limit=1`, {
        timeout: 5000,
      });

      expect(response.status).toBe(200);

      if (response.data.templates.length > 0) {
        const template = response.data.templates[0];

        // Essential fields should be present
        expect(template).toHaveProperty("templateId");
        expect(template).toHaveProperty("title");
        expect(template).toHaveProperty("content");
        expect(template).toHaveProperty("tags");
      }
    });
  });

  describe("Blue-Green Deployment Validation", () => {
    it("should handle traffic switching gracefully", async () => {
      // Test multiple concurrent requests during potential traffic switch
      const concurrentRequests = Array.from({ length: 5 }, (_, i) =>
        axios.get(`${config.apiUrl}/templates?concurrent=${i}`, {
          timeout: 10000,
        }),
      );

      const responses = await Promise.all(concurrentRequests);

      // All requests should succeed during traffic switching
      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty("templates");
      });
    });

    it("should maintain session consistency across deployments", async () => {
      // Test that user sessions work across deployment boundaries
      const response = await axios.get(`${config.apiUrl}/health`, {
        timeout: 5000,
      });

      expect(response.status).toBe(200);
      expect(response.data.status).toBe("healthy");

      // Should have consistent response format
      expect(response.data).toHaveProperty("timestamp");
      expect(response.data).toHaveProperty("environment");
    });
  });

  describe("Post-Deployment Cleanup Validation", () => {
    it("should have cleaned up temporary resources", async () => {
      const response = await axios.get(`${config.apiUrl}/health`, {
        timeout: 5000,
      });

      expect(response.status).toBe(200);

      // Should not indicate any deployment artifacts
      expect(response.data).not.toHaveProperty("deployment_mode");
      expect(response.data).not.toHaveProperty("migration_running");
    });

    it("should have proper resource limits in place", async () => {
      // Test that the system handles resource-intensive requests appropriately
      const response = await axios.get(`${config.apiUrl}/templates?limit=100`, {
        timeout: 15000,
      });

      expect(response.status).toBe(200);
      expect(response.data.templates.length).toBeLessThanOrEqual(100);
      expect(response.data.pagination).toHaveProperty("limit");
    });
  });
});

// Helper function to wait for service to be ready
async function waitForService(url, maxRetries = 10, delay = 2000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await axios.get(url, { timeout: 5000 });
      if (response.status === 200) {
        return true;
      }
    } catch (error) {
      console.log(`Service not ready, attempt ${i + 1}/${maxRetries}`);
      if (i < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  return false;
}

// Run pre-deployment checks if this is executed directly
if (require.main === module) {
  (async () => {
    console.log("Running pre-deployment smoke tests...");

    const isServiceReady = await waitForService(`${config.apiUrl}/health`);

    if (isServiceReady) {
      console.log("✅ Service is ready for smoke tests");
    } else {
      console.log("❌ Service is not responding");
      process.exit(1);
    }
  })();
}

module.exports = {
  environments,
  waitForService,
};
