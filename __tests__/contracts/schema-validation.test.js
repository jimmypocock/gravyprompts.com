/**
 * Contract & Schema Validation Tests
 *
 * These tests verify that APIs, database schemas, and data structures
 * conform to their defined contracts and prevent breaking changes.
 */

// JSON Schema validation library
const Ajv = require("ajv");
const addFormats = require("ajv-formats");

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

// Define schemas for validation
const schemas = {
  template: {
    type: "object",
    properties: {
      templateId: { type: "string", pattern: "^[a-zA-Z0-9_-]+$" },
      title: { type: "string", minLength: 1, maxLength: 200 },
      content: { type: "string", minLength: 1, maxLength: 100000 },
      tags: {
        type: "array",
        items: { type: "string", minLength: 1, maxLength: 50 },
        maxItems: 20,
      },
      variables: {
        type: "array",
        items: { type: "string", pattern: "^[a-zA-Z][a-zA-Z0-9_]*$" },
        maxItems: 50,
      },
      visibility: { type: "string", enum: ["public", "private"] },
      status: { type: "string", enum: ["approved", "rejected", "pending"] },
      authorId: { type: "string", minLength: 1 },
      authorEmail: { type: "string", format: "email" },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
      views: { type: "integer", minimum: 0 },
      shares: { type: "integer", minimum: 0 },
      useCount: { type: "integer", minimum: 0 },
    },
    required: [
      "templateId",
      "title",
      "content",
      "tags",
      "visibility",
      "status",
      "authorId",
      "authorEmail",
      "createdAt",
    ],
    additionalProperties: false,
  },

  userPrompt: {
    type: "object",
    properties: {
      promptId: { type: "string", pattern: "^[a-zA-Z0-9_-]+$" },
      userId: { type: "string", minLength: 1 },
      templateId: { type: "string", pattern: "^[a-zA-Z0-9_-]+$" },
      title: { type: "string", minLength: 1, maxLength: 200 },
      content: { type: "string", minLength: 1, maxLength: 100000 },
      variables: {
        type: "object",
        patternProperties: {
          "^[a-zA-Z][a-zA-Z0-9_]*$": { type: "string" },
        },
        additionalProperties: false,
      },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
    required: [
      "promptId",
      "userId",
      "templateId",
      "title",
      "content",
      "variables",
      "createdAt",
    ],
    additionalProperties: false,
  },

  apiResponse: {
    type: "object",
    properties: {
      statusCode: { type: "integer", minimum: 100, maximum: 599 },
      headers: {
        type: "object",
        properties: {
          "Content-Type": { type: "string" },
          "Access-Control-Allow-Origin": { type: "string" },
          "X-Request-ID": { type: "string" },
        },
      },
      body: { type: "string" },
    },
    required: ["statusCode", "body"],
    additionalProperties: true,
  },

  errorResponse: {
    type: "object",
    properties: {
      error: {
        type: "object",
        properties: {
          code: { type: "string" },
          message: { type: "string" },
          details: { type: "object" },
          timestamp: { type: "string", format: "date-time" },
          requestId: { type: "string" },
        },
        required: ["code", "message", "timestamp"],
        additionalProperties: false,
      },
    },
    required: ["error"],
    additionalProperties: false,
  },

  paginatedResponse: {
    type: "object",
    properties: {
      items: { type: "array" },
      pagination: {
        type: "object",
        properties: {
          page: { type: "integer", minimum: 1 },
          limit: { type: "integer", minimum: 1, maximum: 100 },
          total: { type: "integer", minimum: 0 },
          hasNext: { type: "boolean" },
          hasPrevious: { type: "boolean" },
        },
        required: ["page", "limit", "total", "hasNext", "hasPrevious"],
        additionalProperties: false,
      },
    },
    required: ["items", "pagination"],
    additionalProperties: false,
  },
};

// Compile schemas
const validators = {};
Object.keys(schemas).forEach((key) => {
  validators[key] = ajv.compile(schemas[key]);
});

describe("Contract & Schema Validation Tests", () => {
  describe("API Contract Validation", () => {
    it("should validate template API response structure", () => {
      const validTemplateResponse = {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "https://gravyprompts.com",
        },
        body: JSON.stringify({
          template: {
            templateId: "template-123",
            title: "Email Marketing Template",
            content: "Hello {{name}}, welcome to {{company}}!",
            tags: ["email", "marketing"],
            variables: ["name", "company"],
            visibility: "public",
            status: "approved",
            authorId: "user-456",
            authorEmail: "author@example.com",
            createdAt: "2024-01-01T12:00:00Z",
            updatedAt: "2024-01-01T12:00:00Z",
            views: 150,
            shares: 25,
            useCount: 75,
          },
        }),
      };

      // Validate API response structure
      const isValidResponse = validators.apiResponse(validTemplateResponse);
      expect(isValidResponse).toBe(true);

      // Validate template data structure
      const responseBody = JSON.parse(validTemplateResponse.body);
      const isValidTemplate = validators.template(responseBody.template);
      expect(isValidTemplate).toBe(true);
    });

    it("should validate error response format", () => {
      const errorResponse = {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid template data provided",
            details: {
              field: "title",
              issue: "Title cannot be empty",
            },
            timestamp: "2024-01-01T12:00:00Z",
            requestId: "req-123",
          },
        }),
      };

      const isValidResponse = validators.apiResponse(errorResponse);
      expect(isValidResponse).toBe(true);

      const responseBody = JSON.parse(errorResponse.body);
      const isValidError = validators.errorResponse(responseBody);
      expect(isValidError).toBe(true);
    });

    it("should validate paginated response format", () => {
      const paginatedResponse = {
        statusCode: 200,
        body: JSON.stringify({
          items: [
            {
              templateId: "template-1",
              title: "Template 1",
              content: "Content 1",
              tags: ["tag1"],
              variables: ["var1"],
              visibility: "public",
              status: "approved",
              authorId: "user-1",
              authorEmail: "user1@example.com",
              createdAt: "2024-01-01T12:00:00Z",
            },
          ],
          pagination: {
            page: 1,
            limit: 20,
            total: 1,
            hasNext: false,
            hasPrevious: false,
          },
        }),
      };

      const isValidResponse = validators.apiResponse(paginatedResponse);
      expect(isValidResponse).toBe(true);

      const responseBody = JSON.parse(paginatedResponse.body);
      const isValidPagination = validators.paginatedResponse(responseBody);
      expect(isValidPagination).toBe(true);

      // Validate each template in the items array
      responseBody.items.forEach((template) => {
        const isValidTemplate = validators.template(template);
        expect(isValidTemplate).toBe(true);
      });
    });

    it("should reject invalid API responses", () => {
      const invalidResponses = [
        // Missing required fields
        { statusCode: 200 }, // Missing body
        { body: "test" }, // Missing statusCode

        // Invalid data types
        { statusCode: "200", body: "test" }, // statusCode should be number
        { statusCode: 200, body: 123 }, // body should be string

        // Invalid status codes
        { statusCode: 99, body: "test" }, // statusCode too low
        { statusCode: 600, body: "test" }, // statusCode too high
      ];

      invalidResponses.forEach((response) => {
        const isValid = validators.apiResponse(response);
        expect(isValid).toBe(false);
      });
    });
  });

  describe("Database Schema Validation", () => {
    it("should validate template database records", () => {
      const validTemplate = {
        templateId: "template-abc123",
        title: "Marketing Email Template",
        content:
          "Dear {{customerName}}, thank you for choosing {{companyName}}!",
        tags: ["email", "marketing", "customer"],
        variables: ["customerName", "companyName"],
        visibility: "public",
        status: "approved",
        authorId: "user-123",
        authorEmail: "marketer@company.com",
        createdAt: "2024-01-15T10:30:00Z",
        updatedAt: "2024-01-15T10:30:00Z",
        views: 245,
        shares: 12,
        useCount: 89,
      };

      const isValid = validators.template(validTemplate);
      expect(isValid).toBe(true);
    });

    it("should validate user prompt records", () => {
      const validUserPrompt = {
        promptId: "prompt-xyz789",
        userId: "user-456",
        templateId: "template-abc123",
        title: "My Customer Welcome Email",
        content: "Dear John Smith, thank you for choosing Acme Corp!",
        variables: {
          customerName: "John Smith",
          companyName: "Acme Corp",
        },
        createdAt: "2024-01-15T11:00:00Z",
        updatedAt: "2024-01-15T11:00:00Z",
      };

      const isValid = validators.userPrompt(validUserPrompt);
      expect(isValid).toBe(true);
    });

    it("should reject invalid template data", () => {
      const invalidTemplates = [
        // Missing required fields
        {
          title: "Test Template",
          content: "Test content",
          // Missing templateId, tags, visibility, etc.
        },

        // Invalid data types
        {
          templateId: "template-123",
          title: 123, // Should be string
          content: "Test content",
          tags: ["test"],
          visibility: "public",
          status: "approved",
          authorId: "user-123",
          authorEmail: "test@example.com",
          createdAt: "2024-01-01T12:00:00Z",
        },

        // Invalid enums
        {
          templateId: "template-123",
          title: "Test Template",
          content: "Test content",
          tags: ["test"],
          visibility: "invalid", // Should be 'public' or 'private'
          status: "approved",
          authorId: "user-123",
          authorEmail: "test@example.com",
          createdAt: "2024-01-01T12:00:00Z",
        },

        // Invalid formats
        {
          templateId: "template-123",
          title: "Test Template",
          content: "Test content",
          tags: ["test"],
          visibility: "public",
          status: "approved",
          authorId: "user-123",
          authorEmail: "invalid-email", // Should be valid email format
          createdAt: "2024-01-01T12:00:00Z",
        },

        // Invalid constraints
        {
          templateId: "template-123",
          title: "", // Should have minLength: 1
          content: "Test content",
          tags: ["test"],
          visibility: "public",
          status: "approved",
          authorId: "user-123",
          authorEmail: "test@example.com",
          createdAt: "2024-01-01T12:00:00Z",
        },
      ];

      invalidTemplates.forEach((template) => {
        const isValid = validators.template(template);
        expect(isValid).toBe(false);
      });
    });

    it("should validate field constraints", () => {
      // Test maximum array lengths
      const templateWithTooManyTags = {
        templateId: "template-123",
        title: "Test Template",
        content: "Test content",
        tags: Array.from({ length: 21 }, (_, i) => `tag${i}`), // Max 20 tags
        visibility: "public",
        status: "approved",
        authorId: "user-123",
        authorEmail: "test@example.com",
        createdAt: "2024-01-01T12:00:00Z",
      };

      const isValid = validators.template(templateWithTooManyTags);
      expect(isValid).toBe(false);

      // Test string length constraints
      const templateWithLongTitle = {
        templateId: "template-123",
        title: "A".repeat(201), // Max 200 characters
        content: "Test content",
        tags: ["test"],
        visibility: "public",
        status: "approved",
        authorId: "user-123",
        authorEmail: "test@example.com",
        createdAt: "2024-01-01T12:00:00Z",
      };

      const isValidLongTitle = validators.template(templateWithLongTitle);
      expect(isValidLongTitle).toBe(false);
    });
  });

  describe("Backward Compatibility Tests", () => {
    it("should maintain compatibility with v1 template format", () => {
      // Simulate old format (missing new fields)
      const v1Template = {
        templateId: "template-123",
        title: "Legacy Template",
        content: "Legacy content {{name}}",
        tags: ["legacy"],
        visibility: "public",
        status: "approved",
        authorId: "user-123",
        authorEmail: "legacy@example.com",
        createdAt: "2024-01-01T12:00:00Z",
        // Missing: variables, updatedAt, views, shares, useCount
      };

      // Should still be valid (only required fields checked)
      const isValid = validators.template(v1Template);
      expect(isValid).toBe(true);
    });

    it("should handle schema evolution gracefully", () => {
      // Test adding new optional fields doesn't break validation
      const extendedTemplate = {
        templateId: "template-123",
        title: "Extended Template",
        content: "Extended content {{name}}",
        tags: ["extended"],
        variables: ["name"],
        visibility: "public",
        status: "approved",
        authorId: "user-123",
        authorEmail: "extended@example.com",
        createdAt: "2024-01-01T12:00:00Z",
        updatedAt: "2024-01-01T12:00:00Z",
        views: 100,
        shares: 5,
        useCount: 25,
        // New fields that might be added in future
        category: "business", // Not in current schema
        difficulty: "beginner", // Not in current schema
      };

      // Should fail due to additionalProperties: false
      const isValid = validators.template(extendedTemplate);
      expect(isValid).toBe(false);
    });

    it("should validate API version compatibility", () => {
      const v1ApiResponse = {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "API-Version": "v1",
        },
        body: JSON.stringify({
          success: true,
          data: {
            templateId: "template-123",
            title: "V1 Template",
            content: "V1 content",
            tags: ["v1"],
            visibility: "public",
            status: "approved",
            authorId: "user-123",
            authorEmail: "v1@example.com",
            createdAt: "2024-01-01T12:00:00Z",
          },
        }),
      };

      // V1 response structure should still be processable
      const isValidResponse = validators.apiResponse(v1ApiResponse);
      expect(isValidResponse).toBe(true);
    });
  });

  describe("Event Schema Validation", () => {
    const eventSchemas = {
      templateCreated: {
        type: "object",
        properties: {
          eventType: { type: "string", const: "template.created" },
          eventId: { type: "string" },
          timestamp: { type: "string", format: "date-time" },
          source: { type: "string" },
          data: {
            type: "object",
            properties: {
              templateId: { type: "string" },
              authorId: { type: "string" },
              title: { type: "string" },
              visibility: { type: "string", enum: ["public", "private"] },
            },
            required: ["templateId", "authorId", "title", "visibility"],
            additionalProperties: false,
          },
        },
        required: ["eventType", "eventId", "timestamp", "source", "data"],
        additionalProperties: false,
      },

      templateViewed: {
        type: "object",
        properties: {
          eventType: { type: "string", const: "template.viewed" },
          eventId: { type: "string" },
          timestamp: { type: "string", format: "date-time" },
          source: { type: "string" },
          data: {
            type: "object",
            properties: {
              templateId: { type: "string" },
              viewerId: { type: "string" },
              sessionId: { type: "string" },
              userAgent: { type: "string" },
            },
            required: ["templateId", "sessionId"],
            additionalProperties: false,
          },
        },
        required: ["eventType", "eventId", "timestamp", "source", "data"],
        additionalProperties: false,
      },
    };

    const eventValidators = {};
    Object.keys(eventSchemas).forEach((key) => {
      eventValidators[key] = ajv.compile(eventSchemas[key]);
    });

    it("should validate template creation events", () => {
      const templateCreatedEvent = {
        eventType: "template.created",
        eventId: "event-123",
        timestamp: "2024-01-15T12:00:00Z",
        source: "template-service",
        data: {
          templateId: "template-456",
          authorId: "user-789",
          title: "New Marketing Template",
          visibility: "public",
        },
      };

      const isValid = eventValidators.templateCreated(templateCreatedEvent);
      expect(isValid).toBe(true);
    });

    it("should validate template view events", () => {
      const templateViewedEvent = {
        eventType: "template.viewed",
        eventId: "event-456",
        timestamp: "2024-01-15T12:30:00Z",
        source: "frontend-app",
        data: {
          templateId: "template-456",
          viewerId: "user-123",
          sessionId: "session-789",
          userAgent:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      };

      const isValid = eventValidators.templateViewed(templateViewedEvent);
      expect(isValid).toBe(true);
    });

    it("should reject invalid event structures", () => {
      const invalidEvents = [
        // Wrong event type
        {
          eventType: "template.deleted", // Not in enum
          eventId: "event-123",
          timestamp: "2024-01-15T12:00:00Z",
          source: "template-service",
          data: {},
        },

        // Missing required fields
        {
          eventType: "template.created",
          eventId: "event-123",
          // Missing timestamp, source, data
        },

        // Invalid data structure
        {
          eventType: "template.viewed",
          eventId: "event-456",
          timestamp: "2024-01-15T12:30:00Z",
          source: "frontend-app",
          data: {
            templateId: "template-456",
            // Missing required sessionId
          },
        },
      ];

      invalidEvents.forEach((event) => {
        const eventType = event.eventType?.split(".")[1];
        if (
          eventType &&
          eventValidators[
            `template${eventType.charAt(0).toUpperCase()}${eventType.slice(1)}`
          ]
        ) {
          const validator =
            eventValidators[
              `template${eventType.charAt(0).toUpperCase()}${eventType.slice(1)}`
            ];
          const isValid = validator(event);
          expect(isValid).toBe(false);
        }
      });
    });
  });

  describe("Data Migration Compatibility", () => {
    it("should validate data migration scripts", () => {
      const migrationSchema = {
        type: "object",
        properties: {
          version: { type: "string", pattern: "^\\d+\\.\\d+\\.\\d+$" },
          description: { type: "string", minLength: 1 },
          up: {
            type: "array",
            items: {
              type: "object",
              properties: {
                operation: {
                  type: "string",
                  enum: [
                    "add_field",
                    "remove_field",
                    "rename_field",
                    "update_index",
                  ],
                },
                table: { type: "string" },
                field: { type: "string" },
                details: { type: "object" },
              },
              required: ["operation", "table"],
              additionalProperties: false,
            },
          },
          down: {
            type: "array",
            items: {
              type: "object",
              properties: {
                operation: {
                  type: "string",
                  enum: [
                    "add_field",
                    "remove_field",
                    "rename_field",
                    "update_index",
                  ],
                },
                table: { type: "string" },
                field: { type: "string" },
                details: { type: "object" },
              },
              required: ["operation", "table"],
              additionalProperties: false,
            },
          },
        },
        required: ["version", "description", "up", "down"],
        additionalProperties: false,
      };

      const migrationValidator = ajv.compile(migrationSchema);

      const validMigration = {
        version: "1.2.0",
        description: "Add useCount field to templates table",
        up: [
          {
            operation: "add_field",
            table: "templates",
            field: "useCount",
            details: {
              type: "number",
              default: 0,
            },
          },
        ],
        down: [
          {
            operation: "remove_field",
            table: "templates",
            field: "useCount",
          },
        ],
      };

      const isValid = migrationValidator(validMigration);
      expect(isValid).toBe(true);
    });

    it("should validate schema versioning", () => {
      const schemaVersions = [
        { version: "1.0.0", schemas: { template: schemas.template } },
        {
          version: "1.1.0",
          schemas: {
            template: schemas.template,
            userPrompt: schemas.userPrompt,
          },
        },
      ];

      // Ensure newer versions are backward compatible
      schemaVersions.forEach((versionInfo, index) => {
        if (index > 0) {
          const previousVersion = schemaVersions[index - 1];

          // Check that all schemas from previous version still exist
          Object.keys(previousVersion.schemas).forEach((schemaName) => {
            expect(versionInfo.schemas[schemaName]).toBeDefined();
          });
        }
      });
    });
  });

  describe("Integration Contract Tests", () => {
    it("should validate third-party API contracts", () => {
      // Mock external service response schemas
      const cognitoUserSchema = {
        type: "object",
        properties: {
          Username: { type: "string" },
          UserAttributes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                Name: { type: "string" },
                Value: { type: "string" },
              },
              required: ["Name", "Value"],
            },
          },
          UserStatus: {
            type: "string",
            enum: ["CONFIRMED", "UNCONFIRMED", "ARCHIVED"],
          },
        },
        required: ["Username", "UserAttributes", "UserStatus"],
        additionalProperties: true,
      };

      const cognitoValidator = ajv.compile(cognitoUserSchema);

      const mockCognitoResponse = {
        Username: "user-123",
        UserAttributes: [
          { Name: "email", Value: "user@example.com" },
          { Name: "given_name", Value: "John" },
          { Name: "family_name", Value: "Doe" },
        ],
        UserStatus: "CONFIRMED",
      };

      const isValid = cognitoValidator(mockCognitoResponse);
      expect(isValid).toBe(true);
    });

    it("should validate webhook payload schemas", () => {
      const webhookSchema = {
        type: "object",
        properties: {
          id: { type: "string" },
          event: { type: "string" },
          data: { type: "object" },
          timestamp: { type: "string", format: "date-time" },
          signature: { type: "string" },
        },
        required: ["id", "event", "data", "timestamp"],
        additionalProperties: false,
      };

      const webhookValidator = ajv.compile(webhookSchema);

      const validWebhookPayload = {
        id: "webhook-123",
        event: "template.shared",
        data: {
          templateId: "template-456",
          sharedWith: "user@example.com",
          sharedBy: "author@example.com",
        },
        timestamp: "2024-01-15T12:00:00Z",
        signature: "sha256=abc123def456",
      };

      const isValid = webhookValidator(validWebhookPayload);
      expect(isValid).toBe(true);
    });
  });

  describe("Schema Evolution Testing", () => {
    it("should support additive schema changes", () => {
      // Original schema
      const originalSchema = {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
        },
        required: ["id", "name"],
        additionalProperties: false,
      };

      // Evolved schema (added optional field)
      const evolvedSchema = {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          description: { type: "string" }, // New optional field
        },
        required: ["id", "name"],
        additionalProperties: false,
      };

      const originalValidator = ajv.compile(originalSchema);
      const evolvedValidator = ajv.compile(evolvedSchema);

      const oldData = { id: "123", name: "Test" };
      const newData = {
        id: "123",
        name: "Test",
        description: "Test description",
      };

      // Old data should validate against both schemas
      expect(originalValidator(oldData)).toBe(true);
      expect(evolvedValidator(oldData)).toBe(true);

      // New data should validate against evolved schema
      expect(evolvedValidator(newData)).toBe(true);

      // New data should not validate against original schema due to additionalProperties: false
      expect(originalValidator(newData)).toBe(false);
    });

    it("should detect breaking schema changes", () => {
      const originalData = {
        templateId: "template-123",
        title: "Test Template",
        content: "Test content",
        tags: ["test"],
        visibility: "public",
        status: "approved",
        authorId: "user-123",
        authorEmail: "test@example.com",
        createdAt: "2024-01-01T12:00:00Z",
      };

      // Breaking change: make optional field required
      const breakingSchema = {
        ...schemas.template,
        required: [...schemas.template.required, "views"], // Make views required
      };

      const breakingValidator = ajv.compile(breakingSchema);

      // Original data should fail new schema validation
      const isValid = breakingValidator(originalData);
      expect(isValid).toBe(false);
    });
  });
});

// Helper function to generate schema validation errors in a readable format
function getValidationErrors(validator, data) {
  const isValid = validator(data);
  if (!isValid) {
    return validator.errors.map((error) => ({
      field: error.instancePath || error.schemaPath,
      message: error.message,
      value: error.data,
    }));
  }
  return [];
}

// Export validators for use in other tests
module.exports = {
  validators,
  schemas,
  getValidationErrors,
};
