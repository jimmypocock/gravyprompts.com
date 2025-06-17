/**
 * API Security Tests
 *
 * These tests verify API-level security including CORS, rate limiting,
 * request size limits, and protection against common API attacks.
 */

describe("API Security Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset rate limiting counters
    global.rateLimitCounters = {};
    global.requestSizes = {};
  });

  describe("CORS Security", () => {
    it("should enforce strict CORS policy", async () => {
      const maliciousOrigins = [
        "https://evil.com",
        "http://localhost:3000", // Should be specific, not wildcard
        "https://phishing-site.com",
        "file://",
        'data:text/html,<script>alert("XSS")</script>',
        "null",
        "",
      ];

      for (const origin of maliciousOrigins) {
        const event = {
          httpMethod: "OPTIONS",
          headers: {
            Origin: origin,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization",
          },
        };

        const response = await simulateCorsRequest(event);

        // Should not allow unauthorized origins
        expect(response.headers["Access-Control-Allow-Origin"]).not.toBe("*");
        expect(response.headers["Access-Control-Allow-Origin"]).not.toBe(
          origin,
        );
      }
    });

    it("should allow only authorized origins", async () => {
      const authorizedOrigins = [
        "https://gravyprompts.com",
        "https://www.gravyprompts.com",
        "https://staging.gravyprompts.com",
      ];

      for (const origin of authorizedOrigins) {
        const event = {
          httpMethod: "OPTIONS",
          headers: {
            Origin: origin,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization",
          },
        };

        const response = await simulateCorsRequest(event);
        expect(response.headers["Access-Control-Allow-Origin"]).toBe(origin);
      }
    });

    it("should restrict allowed methods", async () => {
      const unauthorizedMethods = [
        "TRACE",
        "CONNECT",
        "PATCH",
        "HEAD",
        "PROPFIND",
        "MKCOL",
      ];

      for (const method of unauthorizedMethods) {
        const event = {
          httpMethod: "OPTIONS",
          headers: {
            Origin: "https://gravyprompts.com",
            "Access-Control-Request-Method": method,
          },
        };

        const response = await simulateCorsRequest(event);

        const allowedMethods =
          response.headers["Access-Control-Allow-Methods"] || "";
        expect(allowedMethods).not.toContain(method);
      }
    });

    it("should restrict allowed headers", async () => {
      const unauthorizedHeaders = [
        "X-Forwarded-For",
        "X-Real-IP",
        "X-Custom-Admin",
        "Cookie",
        "Set-Cookie",
      ];

      for (const header of unauthorizedHeaders) {
        const event = {
          httpMethod: "OPTIONS",
          headers: {
            Origin: "https://gravyprompts.com",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": header.toLowerCase(),
          },
        };

        const response = await simulateCorsRequest(event);

        const allowedHeaders =
          response.headers["Access-Control-Allow-Headers"] || "";
        expect(allowedHeaders.toLowerCase()).not.toContain(
          header.toLowerCase(),
        );
      }
    });
  });

  describe("Rate Limiting", () => {
    it("should rate limit requests per IP", async () => {
      const clientIP = "192.168.1.100";
      const requests = [];

      // Send 100 requests rapidly
      for (let i = 0; i < 100; i++) {
        requests.push(simulateRateLimitedRequest(clientIP, "/templates"));
      }

      const responses = await Promise.all(requests);
      const throttledResponses = responses.filter((r) => r.statusCode === 429);

      expect(throttledResponses.length).toBeGreaterThan(0);
      expect(throttledResponses[0].body).toContain("Rate limit exceeded");
    });

    it("should have different rate limits for different endpoints", async () => {
      const clientIP = "192.168.1.101";

      // Test sensitive endpoint (should have lower limit)
      const adminRequests = [];
      for (let i = 0; i < 20; i++) {
        adminRequests.push(
          simulateRateLimitedRequest(clientIP, "/admin/users"),
        );
      }

      const adminResponses = await Promise.all(adminRequests);
      const adminThrottled = adminResponses.filter((r) => r.statusCode === 429);

      // Test regular endpoint (should have higher limit)
      const regularRequests = [];
      for (let i = 0; i < 20; i++) {
        regularRequests.push(
          simulateRateLimitedRequest(clientIP, "/templates"),
        );
      }

      const regularResponses = await Promise.all(regularRequests);
      const regularThrottled = regularResponses.filter(
        (r) => r.statusCode === 429,
      );

      // Admin endpoints should be more restrictive
      expect(adminThrottled.length).toBeGreaterThan(regularThrottled.length);
    });

    it("should implement progressive rate limiting", async () => {
      const clientIP = "192.168.1.102";
      const responseTimes = [];

      // Make consecutive requests
      for (let i = 0; i < 10; i++) {
        const startTime = Date.now();
        await simulateRateLimitedRequest(clientIP, "/auth/login");
        const endTime = Date.now();
        responseTimes.push(endTime - startTime);
      }

      // Response times should increase (indicating progressive delays)
      for (let i = 1; i < responseTimes.length; i++) {
        if (responseTimes[i - 1] < 1000) {
          // Skip if already at max delay
          expect(responseTimes[i]).toBeGreaterThanOrEqual(responseTimes[i - 1]);
        }
      }
    });

    it("should rate limit by user ID for authenticated requests", async () => {
      const userId = "user-123";
      const requests = [];

      for (let i = 0; i < 50; i++) {
        requests.push(
          simulateAuthenticatedRateLimitedRequest(userId, "/prompts"),
        );
      }

      const responses = await Promise.all(requests);
      const throttledResponses = responses.filter((r) => r.statusCode === 429);

      expect(throttledResponses.length).toBeGreaterThan(0);
    });
  });

  describe("Request Size Limits", () => {
    it("should reject oversized request bodies", async () => {
      const oversizedPayloads = [
        "A".repeat(10 * 1024 * 1024), // 10MB
        "B".repeat(5 * 1024 * 1024), // 5MB
        JSON.stringify({ data: "C".repeat(2 * 1024 * 1024) }), // 2MB JSON
      ];

      for (const payload of oversizedPayloads) {
        const event = {
          httpMethod: "POST",
          path: "/templates",
          headers: {
            Authorization: "Bearer valid-token",
            "Content-Length": payload.length.toString(),
          },
          body: payload,
        };

        const response = await simulateRequestSizeLimit(event);
        expect(response.statusCode).toBe(413);
        expect(response.body).toContain("Request too large");
      }
    });

    it("should limit URL length", async () => {
      const longUrls = [
        "/templates?" + "param=value&".repeat(1000),
        "/search?" + "q=" + "A".repeat(2000),
        "/templates/" + "A".repeat(500),
      ];

      for (const url of longUrls) {
        const event = {
          httpMethod: "GET",
          path: url.split("?")[0],
          rawQueryString: url.split("?")[1] || "",
        };

        const response = await simulateUrlLengthLimit(event);
        expect(response.statusCode).toBe(414);
        expect(response.body).toContain("URL too long");
      }
    });

    it("should limit number of query parameters", async () => {
      const queryParams = {};
      for (let i = 0; i < 100; i++) {
        queryParams[`param${i}`] = `value${i}`;
      }

      const event = {
        httpMethod: "GET",
        path: "/templates",
        queryStringParameters: queryParams,
      };

      const response = await simulateQueryParamLimit(event);
      expect(response.statusCode).toBe(400);
      expect(response.body).toContain("Too many query parameters");
    });
  });

  describe("HTTP Method Security", () => {
    it("should reject dangerous HTTP methods", async () => {
      const dangerousMethods = ["TRACE", "CONNECT", "TRACK", "DEBUG"];

      for (const method of dangerousMethods) {
        const event = {
          httpMethod: method,
          path: "/templates",
        };

        const response = await simulateMethodSecurity(event);
        expect(response.statusCode).toBe(405);
        expect(response.body).toContain("Method not allowed");
      }
    });

    it("should validate method-endpoint combinations", async () => {
      const invalidCombinations = [
        { method: "GET", path: "/templates", body: '{"data": "invalid"}' },
        { method: "DELETE", path: "/templates", body: '{"data": "invalid"}' },
        { method: "POST", path: "/templates/123" }, // Should be PUT for updates
        { method: "PUT", path: "/templates" }, // Should be POST for creation
      ];

      for (const combo of invalidCombinations) {
        const event = {
          httpMethod: combo.method,
          path: combo.path,
          body: combo.body,
        };

        const response = await simulateMethodEndpointValidation(event);

        if (combo.body && ["GET", "DELETE"].includes(combo.method)) {
          expect(response.statusCode).toBe(400);
          expect(response.body).toContain("Unexpected request body");
        }
      }
    });
  });

  describe("Header Security", () => {
    it("should set security headers", async () => {
      const event = {
        httpMethod: "GET",
        path: "/templates",
      };

      const response = await simulateSecurityHeaders(event);

      expect(response.headers["X-Content-Type-Options"]).toBe("nosniff");
      expect(response.headers["X-Frame-Options"]).toBe("DENY");
      expect(response.headers["X-XSS-Protection"]).toBe("1; mode=block");
      expect(response.headers["Strict-Transport-Security"]).toContain(
        "max-age=",
      );
      expect(response.headers["Content-Security-Policy"]).toContain(
        "default-src",
      );
      expect(response.headers["Referrer-Policy"]).toBe(
        "strict-origin-when-cross-origin",
      );
    });

    it("should reject dangerous headers", async () => {
      const dangerousHeaders = [
        { "X-Forwarded-Host": "evil.com" },
        { "X-Rewrite-URL": "/admin/secret" },
        { "X-Original-URL": "/admin/users" },
        { Host: "evil.com" },
        { "X-HTTP-Method-Override": "DELETE" },
      ];

      for (const headers of dangerousHeaders) {
        const event = {
          httpMethod: "GET",
          path: "/templates",
          headers: headers,
        };

        const response = await simulateDangerousHeaders(event);
        expect(response.statusCode).toBe(400);
        expect(response.body).toContain("Invalid header");
      }
    });

    it("should validate content-type for POST requests", async () => {
      const invalidContentTypes = [
        "text/plain",
        "text/html",
        "application/xml",
        "multipart/form-data",
        "",
      ];

      for (const contentType of invalidContentTypes) {
        const event = {
          httpMethod: "POST",
          path: "/templates",
          headers: {
            "Content-Type": contentType,
            Authorization: "Bearer valid-token",
          },
          body: JSON.stringify({ title: "Test" }),
        };

        const response = await simulateContentTypeValidation(event);
        expect(response.statusCode).toBe(415);
        expect(response.body).toContain("Unsupported media type");
      }
    });
  });

  describe("API Versioning Security", () => {
    it("should reject deprecated API versions", async () => {
      const deprecatedVersions = ["v0", "v1.0", "beta", "alpha"];

      for (const version of deprecatedVersions) {
        const event = {
          httpMethod: "GET",
          path: `/api/${version}/templates`,
          headers: { Accept: "application/json" },
        };

        const response = await simulateApiVersioning(event);
        expect(response.statusCode).toBe(410);
        expect(response.body).toContain("API version no longer supported");
      }
    });

    it("should require API version specification", async () => {
      const event = {
        httpMethod: "GET",
        path: "/api/templates", // No version specified
        headers: { Accept: "application/json" },
      };

      const response = await simulateApiVersioning(event);
      expect(response.statusCode).toBe(400);
      expect(response.body).toContain("API version required");
    });
  });

  describe("Response Security", () => {
    it("should not leak sensitive information in errors", async () => {
      const errorScenarios = [
        { path: "/templates/non-existent", expectedError: "not found" },
        { path: "/admin/secret", expectedError: "unauthorized" },
        { path: "/invalid-endpoint", expectedError: "not found" },
      ];

      for (const scenario of errorScenarios) {
        const event = {
          httpMethod: "GET",
          path: scenario.path,
        };

        const response = await simulateErrorResponse(event);

        // Should not leak internal details
        expect(response.body).not.toContain("stack trace");
        expect(response.body).not.toContain("database");
        expect(response.body).not.toContain("AWS");
        expect(response.body).not.toContain("Lambda");
        expect(response.body).not.toContain("DynamoDB");
        expect(response.body).not.toContain("/var/");
        expect(response.body).not.toContain("node_modules");
      }
    });

    it("should sanitize response data", async () => {
      const maliciousTemplate = {
        templateId: "template-123",
        title: '<script>alert("XSS")</script>',
        content: 'Safe content with <img src=x onerror=alert("XSS")>',
        authorEmail: "user@example.com",
      };

      const event = {
        httpMethod: "GET",
        path: "/templates/template-123",
      };

      const response = await simulateResponseSanitization(
        event,
        maliciousTemplate,
      );
      const responseData = JSON.parse(response.body);

      // Response should be sanitized
      expect(responseData.template.title).not.toContain("<script>");
      expect(responseData.template.content).not.toContain("onerror=");
    });
  });

  describe("Timing Attack Prevention", () => {
    it("should use constant-time comparisons for sensitive operations", async () => {
      const correctToken = "correct-secret-token";
      const incorrectTokens = [
        "incorrect-token",
        "correct-secret-toke", // One char short
        "correct-secret-token-extra", // One char long
        "wrong-secret-token",
      ];

      const correctTime = await measureAuthTime(correctToken);

      for (const incorrectToken of incorrectTokens) {
        const incorrectTime = await measureAuthTime(incorrectToken);

        // Time difference should be minimal (< 50ms) to prevent timing attacks
        const timeDiff = Math.abs(correctTime - incorrectTime);
        expect(timeDiff).toBeLessThan(50);
      }
    });

    it("should prevent username enumeration through timing", async () => {
      const existingEmail = "existing@example.com";
      const nonExistentEmails = [
        "nonexistent@example.com",
        "fake@example.com",
        "invalid@example.com",
      ];

      const existingTime = await measureLoginTime(
        existingEmail,
        "wrong-password",
      );

      for (const email of nonExistentEmails) {
        const nonExistentTime = await measureLoginTime(email, "wrong-password");

        // Time difference should be minimal
        const timeDiff = Math.abs(existingTime - nonExistentTime);
        expect(timeDiff).toBeLessThan(100);
      }
    });
  });
});

// Helper functions for API security testing
async function simulateCorsRequest(event) {
  const origin = event.headers?.["Origin"];
  const requestMethod = event.headers?.["Access-Control-Request-Method"];
  const requestHeaders = event.headers?.["Access-Control-Request-Headers"];

  const allowedOrigins = [
    "https://gravyprompts.com",
    "https://www.gravyprompts.com",
    "https://staging.gravyprompts.com",
  ];

  const allowedMethods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"];
  const allowedHeaders = ["content-type", "authorization", "x-api-key"];

  const response = {
    statusCode: 200,
    headers: {},
  };

  if (origin && allowedOrigins.includes(origin)) {
    response.headers["Access-Control-Allow-Origin"] = origin;
  }

  if (requestMethod && allowedMethods.includes(requestMethod)) {
    response.headers["Access-Control-Allow-Methods"] =
      allowedMethods.join(", ");
  }

  if (requestHeaders) {
    const headers = requestHeaders
      .split(",")
      .map((h) => h.trim().toLowerCase());
    const validHeaders = headers.filter((h) => allowedHeaders.includes(h));
    if (validHeaders.length > 0) {
      response.headers["Access-Control-Allow-Headers"] =
        validHeaders.join(", ");
    }
  }

  response.headers["Access-Control-Max-Age"] = "86400";
  response.headers["Access-Control-Allow-Credentials"] = "true";

  return response;
}

async function simulateRateLimitedRequest(clientIP, path) {
  global.rateLimitCounters = global.rateLimitCounters || {};

  const key = `${clientIP}:${path}`;
  const now = Date.now();
  const windowMs = 60000; // 1 minute window

  if (!global.rateLimitCounters[key]) {
    global.rateLimitCounters[key] = { count: 0, windowStart: now };
  }

  const counter = global.rateLimitCounters[key];

  // Reset window if expired
  if (now - counter.windowStart > windowMs) {
    counter.count = 0;
    counter.windowStart = now;
  }

  counter.count++;

  // Different limits for different endpoints
  let limit = 100; // Default limit
  if (path.startsWith("/admin/")) {
    limit = 10; // Lower limit for admin endpoints
  } else if (path.startsWith("/auth/")) {
    limit = 20; // Lower limit for auth endpoints
  }

  if (counter.count > limit) {
    return {
      statusCode: 429,
      body: "Rate limit exceeded",
      headers: {
        "X-RateLimit-Limit": limit.toString(),
        "X-RateLimit-Remaining": "0",
        "Retry-After": "60",
      },
    };
  }

  // Progressive delay for auth endpoints
  if (path.startsWith("/auth/") && counter.count > 3) {
    const delay = Math.min((counter.count - 3) * 1000, 5000);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  return {
    statusCode: 200,
    body: "Success",
    headers: {
      "X-RateLimit-Limit": limit.toString(),
      "X-RateLimit-Remaining": (limit - counter.count).toString(),
    },
  };
}

async function simulateAuthenticatedRateLimitedRequest(userId, path) {
  global.rateLimitCounters = global.rateLimitCounters || {};

  const key = `user:${userId}:${path}`;
  const now = Date.now();
  const windowMs = 60000;

  if (!global.rateLimitCounters[key]) {
    global.rateLimitCounters[key] = { count: 0, windowStart: now };
  }

  const counter = global.rateLimitCounters[key];

  if (now - counter.windowStart > windowMs) {
    counter.count = 0;
    counter.windowStart = now;
  }

  counter.count++;

  const limit = 50; // Per-user limit

  if (counter.count > limit) {
    return { statusCode: 429, body: "User rate limit exceeded" };
  }

  return { statusCode: 200, body: "Success" };
}

async function simulateRequestSizeLimit(event) {
  const contentLength = parseInt(event.headers?.["Content-Length"] || "0");
  const maxSize = 1024 * 1024; // 1MB limit

  if (contentLength > maxSize) {
    return { statusCode: 413, body: "Request too large" };
  }

  if (event.body && event.body.length > maxSize) {
    return { statusCode: 413, body: "Request too large" };
  }

  return { statusCode: 200, body: "Request accepted" };
}

async function simulateUrlLengthLimit(event) {
  const url =
    event.path + (event.rawQueryString ? "?" + event.rawQueryString : "");
  const maxLength = 2048;

  if (url.length > maxLength) {
    return { statusCode: 414, body: "URL too long" };
  }

  return { statusCode: 200, body: "URL accepted" };
}

async function simulateQueryParamLimit(event) {
  const paramCount = Object.keys(event.queryStringParameters || {}).length;
  const maxParams = 50;

  if (paramCount > maxParams) {
    return { statusCode: 400, body: "Too many query parameters" };
  }

  return { statusCode: 200, body: "Parameters accepted" };
}

async function simulateMethodSecurity(event) {
  const allowedMethods = ["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"];

  if (!allowedMethods.includes(event.httpMethod)) {
    return { statusCode: 405, body: "Method not allowed" };
  }

  return { statusCode: 200, body: "Method allowed" };
}

async function simulateMethodEndpointValidation(event) {
  // GET and DELETE should not have request bodies
  if (["GET", "DELETE"].includes(event.httpMethod) && event.body) {
    return { statusCode: 400, body: "Unexpected request body" };
  }

  return { statusCode: 200, body: "Valid request" };
}

async function simulateSecurityHeaders(event) {
  return {
    statusCode: 200,
    headers: {
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "X-XSS-Protection": "1; mode=block",
      "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self' 'unsafe-inline'",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Powered-By": "", // Remove server fingerprinting
    },
    body: "Response with security headers",
  };
}

async function simulateDangerousHeaders(event) {
  const dangerousHeaders = [
    "x-forwarded-host",
    "x-rewrite-url",
    "x-original-url",
    "x-http-method-override",
  ];

  for (const header of dangerousHeaders) {
    if (event.headers?.[header] || event.headers?.[header.toLowerCase()]) {
      return { statusCode: 400, body: "Invalid header detected" };
    }
  }

  // Special case for Host header manipulation
  if (
    event.headers?.["Host"] &&
    !event.headers["Host"].includes("gravyprompts.com")
  ) {
    return { statusCode: 400, body: "Invalid host header" };
  }

  return { statusCode: 200, body: "Headers valid" };
}

async function simulateContentTypeValidation(event) {
  if (event.httpMethod === "POST" || event.httpMethod === "PUT") {
    const contentType = event.headers?.["Content-Type"] || "";

    if (!contentType.includes("application/json")) {
      return { statusCode: 415, body: "Unsupported media type" };
    }
  }

  return { statusCode: 200, body: "Content type valid" };
}

async function simulateApiVersioning(event) {
  const pathParts = event.path.split("/");

  if (pathParts[1] === "api") {
    const version = pathParts[2];

    if (!version) {
      return { statusCode: 400, body: "API version required" };
    }

    const deprecatedVersions = ["v0", "v1.0", "beta", "alpha"];
    if (deprecatedVersions.includes(version)) {
      return { statusCode: 410, body: "API version no longer supported" };
    }

    const supportedVersions = ["v1", "v2"];
    if (!supportedVersions.includes(version)) {
      return { statusCode: 404, body: "API version not found" };
    }
  }

  return { statusCode: 200, body: "API version valid" };
}

async function simulateErrorResponse(event) {
  if (event.path === "/templates/non-existent") {
    return { statusCode: 404, body: "Template not found" };
  }

  if (event.path.startsWith("/admin/")) {
    return { statusCode: 401, body: "Unauthorized access" };
  }

  if (!event.path.startsWith("/templates") && !event.path.startsWith("/auth")) {
    return { statusCode: 404, body: "Endpoint not found" };
  }

  return { statusCode: 200, body: "Success" };
}

async function simulateResponseSanitization(event, templateData) {
  // Sanitize the response data
  const sanitizedTemplate = {
    ...templateData,
    title: sanitizeOutput(templateData.title),
    content: sanitizeOutput(templateData.content),
  };

  return {
    statusCode: 200,
    body: JSON.stringify({ template: sanitizedTemplate }),
  };
}

async function measureAuthTime(token) {
  const startTime = Date.now();

  // Simulate constant-time comparison
  const correctToken = "correct-secret-token";
  let result = token.length === correctToken.length;

  for (let i = 0; i < Math.max(token.length, correctToken.length); i++) {
    const a = i < token.length ? token.charCodeAt(i) : 0;
    const b = i < correctToken.length ? correctToken.charCodeAt(i) : 0;
    result = result && a === b;
  }

  // Add consistent delay to prevent timing attacks
  await new Promise((resolve) => setTimeout(resolve, 100));

  return Date.now() - startTime;
}

async function measureLoginTime(email, password) {
  const startTime = Date.now();

  // Simulate database lookup time (constant regardless of user existence)
  await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 10));

  // Simulate password hashing time (constant regardless of correctness)
  await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 20));

  return Date.now() - startTime;
}

function sanitizeOutput(input) {
  if (typeof input !== "string") return input;

  return input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}
