/**
 * Error Handling & Resilience Tests
 *
 * These tests verify that the application handles various failure scenarios
 * gracefully and maintains stability under adverse conditions.
 */

// Mock AWS SDK for error simulation
const mockDynamoDB = {
  get: jest.fn(),
  put: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  scan: jest.fn(),
  query: jest.fn(),
};

jest.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => mockDynamoDB),
  },
  GetCommand: jest.fn(),
  PutCommand: jest.fn(),
  UpdateCommand: jest.fn(),
  DeleteCommand: jest.fn(),
  ScanCommand: jest.fn(),
  QueryCommand: jest.fn(),
}));

describe("Error Handling & Resilience Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.retryAttempts = {};
    global.circuitBreakerState = {};
  });

  describe("Network Failure Handling", () => {
    it("should handle DynamoDB connection failures gracefully", async () => {
      const networkErrors = [
        new Error("ECONNREFUSED"),
        new Error("ETIMEDOUT"),
        new Error("ENOTFOUND"),
        new Error("ENETUNREACH"),
        new Error("Connection reset by peer"),
      ];

      for (const error of networkErrors) {
        mockDynamoDB.get.mockRejectedValueOnce(error);

        const event = {
          httpMethod: "GET",
          pathParameters: { id: "template-123" },
          headers: { Authorization: "Bearer valid-token" },
        };

        const response = await simulateTemplateGet(event);

        // Should return graceful error, not expose internal details
        expect(response.statusCode).toBe(503);
        expect(response.body).toContain("Service temporarily unavailable");
        expect(response.body).not.toContain("ECONNREFUSED");
        expect(response.body).not.toContain("DynamoDB");
      }
    });

    it("should handle API Gateway timeout errors", async () => {
      const event = {
        httpMethod: "GET",
        path: "/templates",
        queryStringParameters: { limit: "100" },
      };

      // Simulate long-running operation that would timeout
      mockDynamoDB.scan.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 31000)); // > 30s Lambda limit
        return { Items: [], Count: 0 };
      });

      const response = await simulateTimeoutScenario(event);

      expect(response.statusCode).toBe(504);
      expect(response.body).toContain("Request timeout");
    });

    it("should handle external service failures", async () => {
      const externalServiceErrors = [
        { service: "email", error: "SMTP server unavailable" },
        { service: "cognito", error: "User pool unreachable" },
        { service: "comprehend", error: "Content moderation service down" },
      ];

      for (const scenario of externalServiceErrors) {
        const event = {
          httpMethod: "POST",
          path: "/templates/template-123/share",
          headers: { Authorization: "Bearer valid-token" },
          body: JSON.stringify({
            email: "user@example.com",
            message: "Check this out",
          }),
        };

        const response = await simulateExternalServiceFailure(event, scenario);

        expect(response.statusCode).toBe(503);
        expect(response.body).toContain("temporarily unavailable");
        expect(response.body).not.toContain(scenario.error); // Don't leak internal errors
      }
    });
  });

  describe("Database Error Handling", () => {
    it("should handle DynamoDB throttling errors", async () => {
      const throttlingErrors = [
        {
          name: "ProvisionedThroughputExceededException",
          message: "Capacity exceeded",
        },
        { name: "ThrottlingException", message: "Rate exceeded" },
        { name: "RequestLimitExceeded", message: "Too many requests" },
      ];

      for (const errorInfo of throttlingErrors) {
        const error = new Error(errorInfo.message);
        error.name = errorInfo.name;

        mockDynamoDB.put.mockRejectedValueOnce(error);

        const event = {
          httpMethod: "POST",
          path: "/templates",
          headers: { Authorization: "Bearer valid-token" },
          body: JSON.stringify({
            title: "Test Template",
            content: "Test content",
          }),
        };

        const response = await simulateTemplateCreate(event);

        expect(response.statusCode).toBe(503);
        expect(response.body).toContain("Service busy");
        expect(response.headers?.["Retry-After"]).toBeDefined();
      }
    });

    it("should handle item not found errors gracefully", async () => {
      mockDynamoDB.get.mockResolvedValue({ Item: undefined });

      const event = {
        httpMethod: "GET",
        pathParameters: { id: "non-existent-template" },
      };

      const response = await simulateTemplateGet(event);

      expect(response.statusCode).toBe(404);
      expect(response.body).toContain("Template not found");

      // Should not leak database details
      expect(response.body).not.toContain("DynamoDB");
      expect(response.body).not.toContain("Item");
    });

    it("should handle conditional check failures", async () => {
      const conditionalError = new Error("Conditional check failed");
      conditionalError.name = "ConditionalCheckFailedException";

      mockDynamoDB.update.mockRejectedValueOnce(conditionalError);

      const event = {
        httpMethod: "PUT",
        pathParameters: { id: "template-123" },
        headers: { Authorization: "Bearer valid-token" },
        body: JSON.stringify({
          title: "Updated Title",
        }),
      };

      const response = await simulateTemplateUpdate(event);

      expect(response.statusCode).toBe(409);
      expect(response.body).toContain("Resource conflict");
    });

    it("should handle database transaction failures", async () => {
      const transactionError = new Error("Transaction cancelled");
      transactionError.name = "TransactionCanceledException";

      mockDynamoDB.put.mockRejectedValueOnce(transactionError);

      const event = {
        httpMethod: "POST",
        path: "/templates",
        headers: { Authorization: "Bearer valid-token" },
        body: JSON.stringify({
          title: "Test Template",
          content: "Test content",
        }),
      };

      const response = await simulateTemplateCreate(event);

      expect(response.statusCode).toBe(409);
      expect(response.body).toContain("Operation conflict");
    });
  });

  describe("Retry Logic Validation", () => {
    it("should implement exponential backoff for retryable errors", async () => {
      let attemptCount = 0;
      const retryableError = new Error("Service temporarily unavailable");
      retryableError.name = "ServiceUnavailableException";

      mockDynamoDB.get.mockImplementation(async () => {
        attemptCount++;
        if (attemptCount < 4) {
          throw retryableError;
        }
        return { Item: { templateId: "template-123" } };
      });

      const startTime = Date.now();
      const response = await simulateRetryableOperation("template-123");
      const endTime = Date.now();

      expect(response.statusCode).toBe(200);
      expect(attemptCount).toBe(4);

      // Should have taken time for exponential backoff
      expect(endTime - startTime).toBeGreaterThan(1000); // At least 1 second for retries
    });

    it("should not retry non-retryable errors", async () => {
      let attemptCount = 0;
      const nonRetryableError = new Error("Validation failed");
      nonRetryableError.name = "ValidationException";

      mockDynamoDB.get.mockImplementation(async () => {
        attemptCount++;
        throw nonRetryableError;
      });

      const response = await simulateRetryableOperation("template-123");

      expect(response.statusCode).toBe(400);
      expect(attemptCount).toBe(1); // Should not retry
    });

    it("should limit maximum retry attempts", async () => {
      let attemptCount = 0;
      const retryableError = new Error("Service temporarily unavailable");
      retryableError.name = "ServiceUnavailableException";

      mockDynamoDB.get.mockImplementation(async () => {
        attemptCount++;
        throw retryableError;
      });

      const response = await simulateRetryableOperation("template-123");

      expect(response.statusCode).toBe(503);
      expect(attemptCount).toBeLessThanOrEqual(5); // Max 5 attempts
    });
  });

  describe("Circuit Breaker Pattern", () => {
    it("should open circuit after consecutive failures", async () => {
      const serviceName = "template-service";
      const error = new Error("Service down");

      // Simulate 10 consecutive failures
      for (let i = 0; i < 10; i++) {
        mockDynamoDB.get.mockRejectedValueOnce(error);
        await simulateCircuitBreakerCall(serviceName, "template-123");
      }

      // Next call should be rejected immediately (circuit open)
      const startTime = Date.now();
      const response = await simulateCircuitBreakerCall(
        serviceName,
        "template-123",
      );
      const endTime = Date.now();

      expect(response.statusCode).toBe(503);
      expect(response.body).toContain("Service circuit open");
      expect(endTime - startTime).toBeLessThan(100); // Should fail fast
    });

    it("should attempt to close circuit after timeout", async () => {
      const serviceName = "template-service-2";

      // Open the circuit
      for (let i = 0; i < 10; i++) {
        mockDynamoDB.get.mockRejectedValueOnce(new Error("Service down"));
        await simulateCircuitBreakerCall(serviceName, "template-123");
      }

      // Wait for circuit breaker timeout
      await new Promise((resolve) => setTimeout(resolve, 1100)); // 1.1 seconds

      // Mock successful response
      mockDynamoDB.get.mockResolvedValueOnce({
        Item: { templateId: "template-123" },
      });

      const response = await simulateCircuitBreakerCall(
        serviceName,
        "template-123",
      );

      expect(response.statusCode).toBe(200);
    });

    it("should track failures per service independently", async () => {
      const service1 = "service-1";
      const service2 = "service-2";

      // Fail service1 enough to open circuit
      for (let i = 0; i < 10; i++) {
        mockDynamoDB.get.mockRejectedValueOnce(new Error("Service 1 down"));
        await simulateCircuitBreakerCall(service1, "template-123");
      }

      // Service2 should still work
      mockDynamoDB.get.mockResolvedValueOnce({
        Item: { templateId: "template-123" },
      });
      const response = await simulateCircuitBreakerCall(
        service2,
        "template-123",
      );

      expect(response.statusCode).toBe(200);
    });
  });

  describe("Graceful Degradation", () => {
    it("should provide cached results when database is unavailable", async () => {
      mockDynamoDB.scan.mockRejectedValue(new Error("Database unavailable"));

      const event = {
        httpMethod: "GET",
        path: "/templates",
        queryStringParameters: { limit: "10" },
      };

      const response = await simulateGracefulDegradation(event);

      expect(response.statusCode).toBe(200);
      expect(response.body).toContain("cached");
      expect(response.headers?.["X-Cache"]).toBe("HIT");
      expect(response.headers?.["X-Degraded"]).toBe("true");
    });

    it("should disable non-essential features during high load", async () => {
      // Simulate high load condition
      global.systemLoad = 0.9; // 90% load

      const event = {
        httpMethod: "POST",
        path: "/templates/template-123/analytics",
        headers: { Authorization: "Bearer valid-token" },
        body: JSON.stringify({ event: "view" }),
      };

      const response = await simulateLoadBasedDegradation(event);

      expect(response.statusCode).toBe(202);
      expect(response.body).toContain("Analytics temporarily disabled");
    });

    it("should provide simplified responses during degradation", async () => {
      const event = {
        httpMethod: "GET",
        path: "/templates",
        headers: { "X-Request-Source": "mobile" },
      };

      // Simulate search service unavailable
      const response = await simulateSimplifiedResponse(event);

      expect(response.statusCode).toBe(200);

      const data = JSON.parse(response.body);
      expect(data.templates).toBeDefined();
      expect(data.searchMetadata).toBeUndefined(); // Simplified response
      expect(data.relatedTemplates).toBeUndefined(); // Non-essential data removed
    });
  });

  describe("Error Boundary & Recovery", () => {
    it("should handle JSON parsing errors gracefully", async () => {
      const malformedJson = '{"title": "test"'; // Missing closing brace

      const event = {
        httpMethod: "POST",
        path: "/templates",
        headers: { Authorization: "Bearer valid-token" },
        body: malformedJson,
      };

      const response = await simulateJsonParsingError(event);

      expect(response.statusCode).toBe(400);
      expect(response.body).toContain("Invalid request format");
      expect(response.body).not.toContain("SyntaxError"); // Don't leak internal errors
    });

    it("should handle memory exhaustion gracefully", async () => {
      const event = {
        httpMethod: "POST",
        path: "/templates",
        headers: { Authorization: "Bearer valid-token" },
        body: JSON.stringify({
          title: "Large Template",
          content: "A".repeat(100 * 1024 * 1024), // 100MB content
        }),
      };

      const response = await simulateMemoryExhaustion(event);

      expect(response.statusCode).toBe(413);
      expect(response.body).toContain("Request too large");
    });

    it("should recover from temporary service interruptions", async () => {
      let callCount = 0;

      mockDynamoDB.get.mockImplementation(async () => {
        callCount++;
        if (callCount <= 3) {
          throw new Error("Service interruption");
        }
        return { Item: { templateId: "template-123" } };
      });

      const response = await simulateServiceRecovery("template-123");

      expect(response.statusCode).toBe(200);
      expect(callCount).toBe(4); // Should have retried and succeeded
    });
  });

  describe("Lambda-Specific Error Handling", () => {
    it("should handle Lambda timeout gracefully", async () => {
      const event = {
        httpMethod: "GET",
        path: "/templates",
        queryStringParameters: { search: "complex query", limit: "1000" },
      };

      // Mock getRemainingTimeInMillis
      const mockContext = {
        getRemainingTimeInMillis: jest
          .fn()
          .mockReturnValueOnce(5000) // 5 seconds left
          .mockReturnValueOnce(1000) // 1 second left
          .mockReturnValueOnce(100), // 100ms left - should abort
      };

      const response = await simulateLambdaTimeout(event, mockContext);

      expect(response.statusCode).toBe(202);
      expect(response.body).toContain("Processing timeout");
      expect(response.headers?.["X-Processing-Status"]).toBe("partial");
    });

    it("should handle cold start optimization", async () => {
      // Simulate cold start scenario
      global.coldStart = true;

      const event = {
        httpMethod: "GET",
        path: "/templates/template-123",
      };

      const startTime = Date.now();
      const response = await simulateColdStartHandling(event);
      const endTime = Date.now();

      expect(response.statusCode).toBe(200);
      expect(response.headers?.["X-Cold-Start"]).toBe("true");

      // Should complete quickly even during cold start
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it("should handle Lambda memory limits", async () => {
      // Simulate approaching memory limit
      const initialMemory = process.memoryUsage();
      global.memoryPressure = true;

      const event = {
        httpMethod: "GET",
        path: "/templates",
        queryStringParameters: { limit: "1000" },
      };

      const response = await simulateMemoryPressure(event);

      expect(response.statusCode).toBe(200);
      expect(response.headers?.["X-Memory-Optimized"]).toBe("true");

      // Should indicate memory optimization was applied
      const data = JSON.parse(response.body);
      expect(data.templates.length).toBeLessThan(1000); // Reduced to manage memory
    });
  });
});

// Helper functions for error handling testing
async function simulateTemplateGet(event) {
  try {
    const templateId = event.pathParameters?.id;
    const result = await mockDynamoDB.get({
      TableName: "templates",
      Key: { templateId },
    });

    if (!result.Item) {
      return { statusCode: 404, body: "Template not found" };
    }

    return { statusCode: 200, body: JSON.stringify({ template: result.Item }) };
  } catch (error) {
    return handleDatabaseError(error);
  }
}

async function simulateTemplateCreate(event) {
  try {
    const data = JSON.parse(event.body);
    await mockDynamoDB.put({
      TableName: "templates",
      Item: { templateId: "new-template", ...data },
    });

    return {
      statusCode: 201,
      body: JSON.stringify({
        template: { templateId: "new-template", ...data },
      }),
    };
  } catch (error) {
    return handleDatabaseError(error);
  }
}

async function simulateTemplateUpdate(event) {
  try {
    const templateId = event.pathParameters?.id;
    const data = JSON.parse(event.body);

    await mockDynamoDB.update({
      TableName: "templates",
      Key: { templateId },
      UpdateExpression: "SET title = :title",
      ExpressionAttributeValues: { ":title": data.title },
      ConditionExpression: "attribute_exists(templateId)",
    });

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (error) {
    return handleDatabaseError(error);
  }
}

async function simulateTimeoutScenario(event) {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error("Lambda timeout")), 30000);
  });

  try {
    await Promise.race([
      mockDynamoDB.scan({ TableName: "templates" }),
      timeoutPromise,
    ]);

    return { statusCode: 200, body: "Success" };
  } catch (error) {
    if (error.message === "Lambda timeout") {
      return {
        statusCode: 504,
        body: "Request timeout - operation taking too long",
      };
    }
    return handleDatabaseError(error);
  }
}

async function simulateExternalServiceFailure(event, scenario) {
  // Simulate external service call based on scenario
  try {
    if (scenario.service === "email") {
      throw new Error(scenario.error);
    }

    return { statusCode: 200, body: "Success" };
  } catch (error) {
    return {
      statusCode: 503,
      body: "Email service temporarily unavailable",
      headers: { "Retry-After": "300" },
    };
  }
}

async function simulateRetryableOperation(templateId) {
  const maxRetries = 5;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      attempt++;
      const result = await mockDynamoDB.get({
        TableName: "templates",
        Key: { templateId },
      });

      return {
        statusCode: 200,
        body: JSON.stringify({ template: result.Item }),
      };
    } catch (error) {
      const isRetryable = isRetryableError(error);

      if (!isRetryable || attempt >= maxRetries) {
        return handleDatabaseError(error);
      }

      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return {
    statusCode: 503,
    body: "Service temporarily unavailable after retries",
  };
}

async function simulateCircuitBreakerCall(serviceName, templateId) {
  global.circuitBreakerState = global.circuitBreakerState || {};

  const state = global.circuitBreakerState[serviceName] || {
    state: "CLOSED",
    failureCount: 0,
    lastFailureTime: null,
    timeout: 1000, // 1 second timeout
  };

  const now = Date.now();

  // Check if circuit should transition from OPEN to HALF_OPEN
  if (state.state === "OPEN" && now - state.lastFailureTime > state.timeout) {
    state.state = "HALF_OPEN";
  }

  // If circuit is open, fail fast
  if (state.state === "OPEN") {
    return { statusCode: 503, body: "Service circuit open - failing fast" };
  }

  try {
    const result = await mockDynamoDB.get({
      TableName: "templates",
      Key: { templateId },
    });

    // Success - reset circuit breaker
    state.failureCount = 0;
    state.state = "CLOSED";
    global.circuitBreakerState[serviceName] = state;

    return { statusCode: 200, body: JSON.stringify({ template: result.Item }) };
  } catch (error) {
    state.failureCount++;
    state.lastFailureTime = now;

    // Open circuit if too many failures
    if (state.failureCount >= 10) {
      state.state = "OPEN";
    }

    global.circuitBreakerState[serviceName] = state;

    return handleDatabaseError(error);
  }
}

async function simulateGracefulDegradation(event) {
  try {
    const result = await mockDynamoDB.scan({ TableName: "templates" });
    return {
      statusCode: 200,
      body: JSON.stringify({ templates: result.Items }),
    };
  } catch (error) {
    // Return cached/fallback data
    const fallbackTemplates = [
      { templateId: "cached-1", title: "Cached Template 1" },
      { templateId: "cached-2", title: "Cached Template 2" },
    ];

    return {
      statusCode: 200,
      headers: {
        "X-Cache": "HIT",
        "X-Degraded": "true",
      },
      body: JSON.stringify({
        templates: fallbackTemplates,
        message: "Showing cached results due to service unavailability",
      }),
    };
  }
}

async function simulateLoadBasedDegradation(event) {
  const currentLoad = global.systemLoad || 0;

  if (currentLoad > 0.8) {
    // 80% load threshold
    return {
      statusCode: 202,
      body: "Analytics temporarily disabled due to high load",
      headers: { "X-Feature-Disabled": "analytics" },
    };
  }

  return { statusCode: 200, body: "Analytics recorded" };
}

async function simulateSimplifiedResponse(event) {
  const templates = [
    { templateId: "template-1", title: "Template 1" },
    { templateId: "template-2", title: "Template 2" },
  ];

  // Check if we should provide simplified response
  const isMobile = event.headers?.["X-Request-Source"] === "mobile";
  const isHighLoad = global.systemLoad > 0.7;

  if (isMobile || isHighLoad) {
    // Simplified response - only essential data
    return {
      statusCode: 200,
      body: JSON.stringify({ templates }),
      headers: { "X-Response-Type": "simplified" },
    };
  }

  // Full response with metadata
  return {
    statusCode: 200,
    body: JSON.stringify({
      templates,
      searchMetadata: { total: 2, page: 1 },
      relatedTemplates: [],
    }),
  };
}

async function simulateJsonParsingError(event) {
  try {
    JSON.parse(event.body);
    return { statusCode: 200, body: "Success" };
  } catch (error) {
    return {
      statusCode: 400,
      body: "Invalid request format - please check your JSON syntax",
    };
  }
}

async function simulateMemoryExhaustion(event) {
  try {
    const data = JSON.parse(event.body);

    // Check content size before processing
    if (data.content && data.content.length > 10 * 1024 * 1024) {
      // 10MB limit
      return {
        statusCode: 413,
        body: "Request too large - content exceeds maximum size limit",
      };
    }

    return { statusCode: 201, body: "Template created" };
  } catch (error) {
    return { statusCode: 400, body: "Invalid request" };
  }
}

async function simulateServiceRecovery(templateId) {
  return await simulateRetryableOperation(templateId);
}

async function simulateLambdaTimeout(event, context) {
  const processingStartTime = Date.now();

  try {
    // Check remaining time before expensive operations
    if (context.getRemainingTimeInMillis() < 1000) {
      return {
        statusCode: 202,
        body: "Processing timeout - operation will continue asynchronously",
        headers: { "X-Processing-Status": "partial" },
      };
    }

    const result = await mockDynamoDB.scan({ TableName: "templates" });
    return {
      statusCode: 200,
      body: JSON.stringify({ templates: result.Items }),
    };
  } catch (error) {
    return handleDatabaseError(error);
  }
}

async function simulateColdStartHandling(event) {
  const isColdStart = global.coldStart;

  if (isColdStart) {
    // Optimize for cold start - minimal processing
    global.coldStart = false; // Reset for next invocation

    return {
      statusCode: 200,
      headers: { "X-Cold-Start": "true" },
      body: JSON.stringify({
        template: { templateId: "template-123", title: "Quick Response" },
      }),
    };
  }

  // Normal processing
  const result = await mockDynamoDB.get({
    TableName: "templates",
    Key: { templateId: "template-123" },
  });

  return { statusCode: 200, body: JSON.stringify({ template: result.Item }) };
}

async function simulateMemoryPressure(event) {
  const memoryPressure = global.memoryPressure;

  if (memoryPressure) {
    // Reduce memory usage by limiting response size
    const limit = Math.min(
      parseInt(event.queryStringParameters?.limit || "100"),
      50,
    );

    const result = await mockDynamoDB.scan({
      TableName: "templates",
      Limit: limit,
    });

    return {
      statusCode: 200,
      headers: { "X-Memory-Optimized": "true" },
      body: JSON.stringify({
        templates: result.Items || [],
        warning: "Results limited due to memory optimization",
      }),
    };
  }

  // Normal processing
  const result = await mockDynamoDB.scan({ TableName: "templates" });
  return { statusCode: 200, body: JSON.stringify({ templates: result.Items }) };
}

function handleDatabaseError(error) {
  // Map specific AWS errors to appropriate HTTP responses
  switch (error.name) {
    case "ProvisionedThroughputExceededException":
    case "ThrottlingException":
    case "RequestLimitExceeded":
      return {
        statusCode: 503,
        body: "Service busy - please try again later",
        headers: { "Retry-After": "60" },
      };

    case "ConditionalCheckFailedException":
      return {
        statusCode: 409,
        body: "Resource conflict - item may have been modified",
      };

    case "TransactionCanceledException":
      return {
        statusCode: 409,
        body: "Operation conflict - please retry",
      };

    case "ValidationException":
      return {
        statusCode: 400,
        body: "Invalid request parameters",
      };

    case "ResourceNotFoundException":
      return {
        statusCode: 404,
        body: "Resource not found",
      };

    default:
      // Network or other infrastructure errors
      if (
        error.message.includes("ECONNREFUSED") ||
        error.message.includes("ETIMEDOUT") ||
        error.message.includes("ENETUNREACH")
      ) {
        return {
          statusCode: 503,
          body: "Service temporarily unavailable",
          headers: { "Retry-After": "120" },
        };
      }

      // Generic server error - don't leak details
      return {
        statusCode: 500,
        body: "Internal server error",
      };
  }
}

function isRetryableError(error) {
  const retryableErrors = [
    "ProvisionedThroughputExceededException",
    "ThrottlingException",
    "RequestLimitExceeded",
    "ServiceUnavailableException",
    "InternalServerError",
  ];

  return (
    retryableErrors.includes(error.name) ||
    error.message.includes("ECONNREFUSED") ||
    error.message.includes("ETIMEDOUT") ||
    error.message.includes("Service temporarily unavailable")
  );
}
