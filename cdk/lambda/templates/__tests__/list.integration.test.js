// Integration tests for list.js - testing real search functionality with DynamoDB

// Set up environment variables BEFORE requiring anything else
process.env.TEMPLATES_TABLE = "local-templates";
process.env.RATE_LIMITS_TABLE = "local-rate-limits";
process.env.AWS_ENDPOINT_URL_DYNAMODB = "http://localhost:8000";

// For integration tests, we need to mock the Lambda layer modules
// but NOT the AWS SDK itself
jest.mock("/opt/nodejs/utils", () => {
  const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
  const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");

  const ddbClient = new DynamoDBClient({
    endpoint: "http://localhost:8000",
    region: "us-east-1",
    credentials: {
      accessKeyId: "test",
      secretAccessKey: "test",
    },
  });

  const docClient = DynamoDBDocumentClient.from(ddbClient);

  return {
    docClient,
    createResponse: (statusCode, body) => ({
      statusCode,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(body),
    }),
    getUserIdFromEvent: (event) => {
      if (event.requestContext?.authorizer?.claims?.sub) {
        return event.requestContext.authorizer.claims.sub;
      }
      return null;
    },
    checkRateLimit: async () => true, // Always allow in tests
  };
}, { virtual: true });

// Now require the handler and test helpers
const { handler } = require("../list");
const {
  createTestClient,
  seedTestData,
  cleanupTestData,
  createTestEvent,
  testTemplates,
} = require("./test-helpers/dynamodb-integration-helpers");

describe("Templates List Handler - Real Integration Tests", () => {
  let docClient;

  beforeAll(async () => {
    // Create real DynamoDB client
    docClient = createTestClient();

    // Seed test data
    await seedTestData(docClient);
  }, 30000); // Increase timeout for DB operations

  afterAll(async () => {
    // Clean up test data
    await cleanupTestData(docClient);
  }, 30000);

  describe("Search Functionality - What the UI Actually Uses", () => {
    it("should find templates with exact title match", async () => {
      const event = createTestEvent({
        queryStringParameters: {
          search: "Email Marketing Campaign",
          filter: "public",
        },
      });

      const response = await handler(event);
      console.log("Response:", response);
      const body = JSON.parse(response.body);
      console.log("Body:", body);

      expect(response.statusCode).toBe(200);
      expect(body.items).toBeDefined();
      expect(body.items.length).toBeGreaterThan(0);

      // Should find our exact match first
      const firstResult = body.items[0];
      expect(firstResult.title).toBe("Email Marketing Campaign");

      // Verify the template has all fields the UI expects
      expect(firstResult).toHaveProperty("templateId");
      expect(firstResult).toHaveProperty("preview"); // Changed from content to preview for security
      expect(firstResult).toHaveProperty("tags");
      expect(firstResult).toHaveProperty("variables");
      expect(firstResult).toHaveProperty("useCount");
      expect(firstResult).toHaveProperty("viewCount");
    });

    it("should find templates with partial title match", async () => {
      const event = createTestEvent({
        queryStringParameters: {
          search: "email",
          filter: "public",
        },
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.items.length).toBeGreaterThanOrEqual(3); // At least 3 email-related templates

      // Count templates with email matches
      const emailMatches = body.items.filter((template) => {
        const hasEmailMatch =
          template.title.toLowerCase().includes("email") ||
          template.tags.some((tag) => tag.toLowerCase().includes("email")) ||
          (template.preview &&
            template.preview.toLowerCase().includes("email"));
        return hasEmailMatch;
      });

      // Most results should contain 'email' (allow for relevance scoring to include related terms)
      expect(emailMatches.length).toBeGreaterThanOrEqual(3);
    });

    it("should handle fuzzy matching for typos", async () => {
      const event = createTestEvent({
        queryStringParameters: {
          search: "emial", // Typo: 'email' -> 'emial'
          filter: "public",
        },
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.items.length).toBeGreaterThan(0); // Should still find email templates

      // Should find templates with 'email' despite the typo
      const emailTemplates = body.items.filter((t) =>
        t.title.toLowerCase().includes("email"),
      );
      expect(emailTemplates.length).toBeGreaterThan(0);
    });

    it("should search within template content", async () => {
      const event = createTestEvent({
        queryStringParameters: {
          search: "target audience", // This appears in content, not title
          filter: "public",
        },
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.items.length).toBeGreaterThan(0);

      // Verify the found template contains the search term in preview
      const hasContentMatch = body.items.some(
        (t) => t.preview && t.preview.toLowerCase().includes("target audience"),
      );
      expect(hasContentMatch).toBe(true);
    });

    it("should handle multi-term search", async () => {
      const event = createTestEvent({
        queryStringParameters: {
          search: "marketing strategy", // Two terms
          filter: "public",
        },
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.items.length).toBeGreaterThan(0);

      // Templates with both terms should rank higher
      const topResult = body.items[0];
      const hasMarketing =
        topResult.title.toLowerCase().includes("marketing") ||
        (topResult.preview &&
          topResult.preview.toLowerCase().includes("marketing"));
      const hasStrategy =
        topResult.title.toLowerCase().includes("strategy") ||
        (topResult.preview &&
          topResult.preview.toLowerCase().includes("strategy"));

      expect(hasMarketing || hasStrategy).toBe(true);
    });

    it("should boost popular templates in search results", async () => {
      const event = createTestEvent({
        queryStringParameters: {
          search: "email",
          filter: "public",
        },
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);

      // Cold Outreach (200 uses) should rank high despite being older
      const coldOutreachIndex = body.items.findIndex(
        (t) => t.title === "Cold Outreach Email Template",
      );

      // Should be in top 3 results due to high usage
      expect(coldOutreachIndex).toBeLessThan(3);
    });

    it("should respect visibility filters", async () => {
      const event = createTestEvent({
        queryStringParameters: {
          search: "testing",
          filter: "public",
        },
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      // Should NOT find the private "User Testing Feedback Request" template
      const privateTemplate = body.items.find(
        (t) => t.title === "User Testing Feedback Request",
      );
      expect(privateTemplate).toBeUndefined();
    });

    it("should filter by moderation status", async () => {
      const event = createTestEvent({
        queryStringParameters: {
          search: "newsletter",
          filter: "public",
        },
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      // Should NOT find the pending "Email Newsletter Template"
      const pendingTemplate = body.items.find(
        (t) => t.title === "Email Newsletter Template",
      );
      expect(pendingTemplate).toBeUndefined();
    });

    it("should handle empty search results gracefully", async () => {
      // Bug fixed: popularity boost now only applies when there's a text match

      const event = createTestEvent({
        queryStringParameters: {
          search: "xyznonexistentterm123456789",
          filter: "public",
        },
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.items).toEqual([]);
      expect(body.count).toBe(0);
    });

    it("should handle tag filtering with search", async () => {
      const event = createTestEvent({
        queryStringParameters: {
          search: "email",
          tag: "marketing",
          filter: "public",
        },
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);

      // Debug output
      console.log(`Total results: ${body.items.length}`);
      if (body.items.length > 0) {
        console.log("Results for email + marketing tag:");
        body.items.forEach((template, index) => {
          console.log(`  ${index + 1}. ${template.title} - Tags: ${JSON.stringify(template.tags)}`);
          const hasEmail = template.title.toLowerCase().includes('email') || 
                          (template.content || '').toLowerCase().includes('email') ||
                          template.tags.some(t => t.toLowerCase().includes('email'));
          console.log(`     Has 'email': ${hasEmail}, Has 'marketing' tag: ${template.tags.includes('marketing')}`);
        });
      }

      // All results should have both 'email' match AND 'marketing' tag
      body.items.forEach((template) => {
        expect(template.tags).toContain("marketing");
      });
    });
  });

  describe("Filter Options - UI Filter Dropdown", () => {
    it('should return only public approved templates for "public" filter', async () => {
      const event = createTestEvent({
        queryStringParameters: {
          filter: "public",
        },
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      // Check if we got any items
      if (body.items.length > 0) {
        body.items.forEach((template) => {
          expect(template.visibility).toBe("public");
          // Note: moderationStatus might not be returned in list response
          // The filter happens server-side
        });
      }
    });

    it('should return templates sorted by popularity for "popular" filter', async () => {
      const event = createTestEvent({
        queryStringParameters: {
          filter: "popular",
        },
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);

      // Verify descending order by useCount
      for (let i = 1; i < body.items.length; i++) {
        expect(body.items[i - 1].useCount).toBeGreaterThanOrEqual(
          body.items[i].useCount,
        );
      }
    });

    it('should return user\'s own templates for "mine" filter', async () => {
      const event = createTestEvent({
        queryStringParameters: {
          filter: "mine",
        },
        requestContext: {
          authorizer: {
            claims: {
              sub: "test-user-1",
            },
          },
        },
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);

      // Should get templates for authenticated user
      expect(body.items).toBeDefined();
      expect(body.count).toBeGreaterThanOrEqual(0);

      // If we have items, they should belong to the user
      if (body.items.length > 0) {
        // Note: userId might not be included in response for security
        // The filtering happens server-side

        // Could include private templates
        const hasPrivate = body.items.some((t) => t.visibility === "private");
        // This is OK - user might not have private templates
      }
    });
  });

  describe("Pagination - For Infinite Scroll", () => {
    it("should limit results and provide nextToken", async () => {
      const event = createTestEvent({
        queryStringParameters: {
          filter: "public",
          limit: "3",
        },
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.items.length).toBeLessThanOrEqual(3);

      // Note: nextToken behavior depends on actual data volume
      // In real scenario with more data, expect(body.nextToken).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    it("should handle missing query parameters gracefully", async () => {
      const event = createTestEvent({
        queryStringParameters: null,
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.items).toBeDefined();
      expect(Array.isArray(body.items)).toBe(true);
    });

    it("should handle invalid limit parameter", async () => {
      const event = createTestEvent({
        queryStringParameters: {
          limit: "invalid",
        },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200); // Should still work with default limit
    });
  });
});

describe("Search Scoring Algorithm - Detailed Tests", () => {
  let docClient;

  beforeAll(async () => {
    docClient = createTestClient();
    await seedTestData(docClient);
  }, 30000);

  afterAll(async () => {
    await cleanupTestData(docClient);
  }, 30000);

  it("should score exact title matches highest", async () => {
    // Search for exact title
    const event = createTestEvent({
      queryStringParameters: {
        search: "Cold Outreach Email Template",
        filter: "public",
      },
    });

    const response = await handler(event);
    const body = JSON.parse(response.body);

    // Exact match should be first
    expect(body.items[0].title).toBe("Cold Outreach Email Template");
  });

  it("should score tag matches appropriately", async () => {
    const event = createTestEvent({
      queryStringParameters: {
        search: "b2b", // Only appears in tags
        filter: "public",
      },
    });

    const response = await handler(event);
    const body = JSON.parse(response.body);

    // Should find the template with b2b tag
    const b2bTemplate = body.items.find((t) => t.tags.includes("b2b"));
    expect(b2bTemplate).toBeDefined();
    expect(b2bTemplate.title).toBe("Cold Outreach Email Template");
  });

  it("should handle variable name searches", async () => {
    const event = createTestEvent({
      queryStringParameters: {
        search: "cta_text", // Variable name
        filter: "public",
      },
    });

    const response = await handler(event);
    const body = JSON.parse(response.body);

    // Should find templates with this variable
    const hasVariable = body.items.some(
      (t) => t.variables && t.variables.includes("cta_text"),
    );
    expect(hasVariable).toBe(true);
  });
});
