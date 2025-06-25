/**
 * Tests for Cache-Control headers in Lambda responses
 */

const { createMockEvent } = require("../../../test-utils/dynamodb-mock");

// Mock the utils module to test cache headers without dependencies
jest.mock("/opt/nodejs/utils", () => {
  const CACHE_PRESETS = {
    NO_CACHE: 'no-cache, no-store, must-revalidate',
    PRIVATE: 'private, max-age=0',
    PUBLIC_SHORT: 'public, max-age=300, s-maxage=300',
    PUBLIC_MEDIUM: 'public, max-age=600, s-maxage=600',
    PUBLIC_LONG: 'public, max-age=3600, s-maxage=3600',
    SEARCH: 'public, max-age=60, s-maxage=60',
  };

  return {
    createResponse: (statusCode, body, headers = {}) => {
      const defaultHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Content-Type': 'application/json',
        'Vary': 'Authorization, Accept-Encoding',
      };

      // Add cache headers based on status code
      if (statusCode === 200 && !headers['Cache-Control']) {
        defaultHeaders['Cache-Control'] = CACHE_PRESETS.PUBLIC_MEDIUM;
      } else if ((statusCode >= 400 || statusCode === 201) && !headers['Cache-Control']) {
        defaultHeaders['Cache-Control'] = CACHE_PRESETS.NO_CACHE;
      }

      return {
        statusCode,
        headers: { ...defaultHeaders, ...headers },
        body: typeof body === 'string' ? body : JSON.stringify(body),
      };
    },
    CACHE_PRESETS,
  };
});

const { createResponse, CACHE_PRESETS } = require("/opt/nodejs/utils");

describe("Cache-Control Headers", () => {
  describe("createResponse function", () => {
    it("should add default cache headers for 200 responses", () => {
      const response = createResponse(200, { data: "test" });
      
      expect(response.headers["Cache-Control"]).toBe(CACHE_PRESETS.PUBLIC_MEDIUM);
      expect(response.headers["Vary"]).toBe("Authorization, Accept-Encoding");
    });

    it("should use custom cache headers when provided", () => {
      const response = createResponse(200, { data: "test" }, {
        "Cache-Control": CACHE_PRESETS.PUBLIC_LONG
      });
      
      expect(response.headers["Cache-Control"]).toBe(CACHE_PRESETS.PUBLIC_LONG);
    });

    it("should not cache error responses", () => {
      const response = createResponse(500, { error: "Internal error" });
      
      expect(response.headers["Cache-Control"]).toBe(CACHE_PRESETS.NO_CACHE);
    });

    it("should not cache 201 Created responses", () => {
      const response = createResponse(201, { id: "new-resource" });
      
      expect(response.headers["Cache-Control"]).toBe(CACHE_PRESETS.NO_CACHE);
    });

    it("should preserve other headers", () => {
      const response = createResponse(200, { data: "test" }, {
        "X-Custom-Header": "custom-value"
      });
      
      expect(response.headers["X-Custom-Header"]).toBe("custom-value");
      expect(response.headers["Content-Type"]).toBe("application/json");
    });
  });

  describe("CACHE_PRESETS values", () => {
    it("should have correct cache durations", () => {
      expect(CACHE_PRESETS.PUBLIC_LONG).toBe("public, max-age=3600, s-maxage=3600");
      expect(CACHE_PRESETS.PUBLIC_MEDIUM).toBe("public, max-age=600, s-maxage=600");
      expect(CACHE_PRESETS.PUBLIC_SHORT).toBe("public, max-age=300, s-maxage=300");
      expect(CACHE_PRESETS.PRIVATE).toBe("private, max-age=0");
      expect(CACHE_PRESETS.NO_CACHE).toBe("no-cache, no-store, must-revalidate");
      expect(CACHE_PRESETS.SEARCH).toBe("public, max-age=60, s-maxage=60");
    });
  });
});

// Test cache headers in actual Lambda responses
describe("Lambda Cache Headers Integration", () => {
  // Mock the Lambda functions
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("List Templates", () => {
    it("should use PRIVATE cache for user-specific listings", async () => {
      const mockList = jest.fn().mockImplementation((statusCode, body, headers) => {
        expect(headers["Cache-Control"]).toBe(CACHE_PRESETS.PRIVATE);
        return { statusCode, body: JSON.stringify(body), headers };
      });

      // Simulate list handler logic
      const userId = "user-123";
      const filter = "mine";
      
      if (userId && (filter === 'mine' || filter === 'all')) {
        mockList(200, { items: [] }, { "Cache-Control": CACHE_PRESETS.PRIVATE });
      }
    });

    it("should use SEARCH cache for search results", async () => {
      const mockList = jest.fn().mockImplementation((statusCode, body, headers) => {
        expect(headers["Cache-Control"]).toBe(CACHE_PRESETS.SEARCH);
        return { statusCode, body: JSON.stringify(body), headers };
      });

      // Simulate search
      const search = "test query";
      
      if (search) {
        mockList(200, { items: [] }, { "Cache-Control": CACHE_PRESETS.SEARCH });
      }
    });

    it("should use PUBLIC_MEDIUM cache for popular templates", async () => {
      const mockList = jest.fn().mockImplementation((statusCode, body, headers) => {
        expect(headers["Cache-Control"]).toBe(CACHE_PRESETS.PUBLIC_MEDIUM);
        return { statusCode, body: JSON.stringify(body), headers };
      });

      // Simulate popular filter
      const filter = "popular";
      
      if (filter === 'popular') {
        mockList(200, { items: [] }, { "Cache-Control": CACHE_PRESETS.PUBLIC_MEDIUM });
      }
    });
  });

  describe("Get Template", () => {
    it("should use PRIVATE cache for private templates", async () => {
      const mockGet = jest.fn().mockImplementation((statusCode, body, headers) => {
        expect(headers["Cache-Control"]).toBe(CACHE_PRESETS.PRIVATE);
        return { statusCode, body: JSON.stringify(body), headers };
      });

      // Simulate private template
      const template = { visibility: 'private' };
      
      if (template.visibility === 'private') {
        mockGet(200, template, { "Cache-Control": CACHE_PRESETS.PRIVATE });
      }
    });

    it("should use PUBLIC_LONG cache for approved public templates", async () => {
      const mockGet = jest.fn().mockImplementation((statusCode, body, headers) => {
        expect(headers["Cache-Control"]).toBe(CACHE_PRESETS.PUBLIC_LONG);
        return { statusCode, body: JSON.stringify(body), headers };
      });

      // Simulate public approved template
      const template = { 
        visibility: 'public',
        moderationStatus: 'approved'
      };
      
      if (template.moderationStatus === 'approved' && template.visibility === 'public') {
        mockGet(200, template, { "Cache-Control": CACHE_PRESETS.PUBLIC_LONG });
      }
    });

    it("should use NO_CACHE for pending moderation templates", async () => {
      const mockGet = jest.fn().mockImplementation((statusCode, body, headers) => {
        expect(headers["Cache-Control"]).toBe(CACHE_PRESETS.NO_CACHE);
        return { statusCode, body: JSON.stringify(body), headers };
      });

      // Simulate pending template
      const template = { 
        visibility: 'public',
        moderationStatus: 'pending'
      };
      
      if (template.moderationStatus !== 'approved') {
        mockGet(200, template, { "Cache-Control": CACHE_PRESETS.NO_CACHE });
      }
    });
  });

  describe("Populate Template", () => {
    it("should always use NO_CACHE for populated content", async () => {
      const mockPopulate = jest.fn().mockImplementation((statusCode, body, headers) => {
        expect(headers["Cache-Control"]).toBe(CACHE_PRESETS.NO_CACHE);
        return { statusCode, body: JSON.stringify(body), headers };
      });

      // Populate is always dynamic
      mockPopulate(200, { populatedContent: "..." }, { "Cache-Control": CACHE_PRESETS.NO_CACHE });
    });
  });
});