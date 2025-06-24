/**
 * Tests for cache invalidation in Lambda functions
 */

const { 
  createMockDocClient,
  createMockEvent,
  createMockUser,
} = require("../../../test-utils/dynamodb-mock");

// Create mock client before mocking
const mockDocClient = createMockDocClient();

// Mock the cache module
const mockCache = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
  clear: jest.fn().mockResolvedValue(undefined),
  clearPattern: jest.fn().mockResolvedValue(undefined),
  keyGenerators: {
    template: jest.fn((id) => `templates:get:${id}`),
    templateList: jest.fn(() => 'templates:list:mock'),
    userTemplates: jest.fn((userId) => `templates:user:${userId}`),
  },
  DEFAULT_TTL: 5 * 60 * 1000,
  POPULAR_TTL: 30 * 60 * 1000,
  USER_TTL: 60 * 1000,
};

jest.mock('/opt/nodejs/cache', () => mockCache, { virtual: true });

// Mock uuid
jest.mock("uuid", () => ({
  v4: jest.fn(() => "test-id-123"),
}));

// Mock other dependencies
jest.mock('/opt/nodejs/utils', () => ({
  docClient: mockDocClient,
  createResponse: jest.fn((status, body) => ({ statusCode: status, body })),
  checkRateLimit: jest.fn(() => true),
  sanitizeHtml: jest.fn((html) => html),
  extractVariables: jest.fn(() => []),
  validateTemplate: jest.fn(() => []),
  moderateContent: jest.fn(() => ({ status: 'approved', details: {} })),
}), { virtual: true });

jest.mock('/opt/nodejs/auth', () => ({
  getUserFromEvent: jest.fn(() => ({ sub: 'test-user-id' })),
}), { virtual: true });

// Mock DynamoDB
jest.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => mockDocClient),
  },
  GetCommand: jest.fn((params) => params),
  PutCommand: jest.fn((params) => params),
  UpdateCommand: jest.fn((params) => params),
  DeleteCommand: jest.fn((params) => params),
}));

describe('Cache Invalidation in Lambda Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDocClient.mockSend.mockReset();
    process.env.TEMPLATES_TABLE = "test-templates";
    process.env.TEMPLATE_VIEWS_TABLE = "test-template-views";
    process.env.ENVIRONMENT = "test";
  });

  describe('Update Template Cache Invalidation', () => {
    const { handler } = require('../update');

    it('should invalidate template cache when updating', async () => {
      const event = createMockEvent({
        pathParameters: { templateId: 'template-123' },
        body: JSON.stringify({
          title: 'Updated Title',
        }),
      });

      // Mock DynamoDB responses
      mockDocClient.mockSend
        .mockResolvedValueOnce({ // GetCommand - existing template
          Item: {
            templateId: 'template-123',
            userId: 'test-user-id',
            title: 'Old Title',
            visibility: 'public',
          }
        })
        .mockResolvedValueOnce({ // UpdateCommand
          Attributes: {
            templateId: 'template-123',
            title: 'Updated Title',
            visibility: 'public',
          },
        });

      await handler(event);

      // Verify template cache was invalidated
      expect(mockCache.del).toHaveBeenCalledWith('templates:get:template-123');
      expect(mockCache.clearPattern).not.toHaveBeenCalled(); // No visibility change
    });

    it('should invalidate list caches when visibility changes', async () => {
      const event = createMockEvent({
        pathParameters: { templateId: 'template-123' },
        body: JSON.stringify({
          visibility: 'private',
        }),
      });

      mockDocClient.mockSend
        .mockResolvedValueOnce({ // GetCommand - existing template
          Item: {
            templateId: 'template-123',
            userId: 'test-user-id',
            title: 'My Template',
            visibility: 'public',
          }
        })
        .mockResolvedValueOnce({ // UpdateCommand
          Attributes: {
            templateId: 'template-123',
            visibility: 'private',
          },
        });

      await handler(event);

      // Verify both template and list caches were invalidated
      expect(mockCache.del).toHaveBeenCalledWith('templates:get:template-123');
      expect(mockCache.clearPattern).toHaveBeenCalledWith('templates:list:*');
      expect(mockCache.del).toHaveBeenCalledWith('templates:user:test-user-id');
    });

    it('should invalidate list caches when moderation status changes', async () => {
      const event = createMockEvent({
        pathParameters: { templateId: 'template-123' },
        body: JSON.stringify({
          visibility: 'public', // Changing from private to public triggers moderation
        }),
      });

      mockDocClient.mockSend
        .mockResolvedValueOnce({ // GetCommand - existing template
          Item: {
            templateId: 'template-123',
            userId: 'test-user-id',
            title: 'My Template',
            visibility: 'private', // Was private
          }
        })
        .mockResolvedValueOnce({ // UpdateCommand
          Attributes: {
            templateId: 'template-123',
            visibility: 'public',
            moderationStatus: 'pending', // Set by the update handler
          },
        });

      await handler(event);

      // Verify list caches were invalidated due to visibility change (which includes moderation)
      expect(mockCache.clearPattern).toHaveBeenCalledWith('templates:list:*');
    });
  });

  describe('Delete Template Cache Invalidation', () => {
    const { handler } = require('../delete');

    it('should invalidate all relevant caches when deleting', async () => {
      const event = createMockEvent({
        pathParameters: { templateId: 'template-123' },
      });

      // Mock successful deletion
      mockDocClient.mockSend
        .mockResolvedValueOnce({ // GetCommand - verify ownership
          Item: {
            templateId: 'template-123',
            userId: 'test-user-id',
            title: 'My Template',
          }
        })
        .mockResolvedValueOnce({}); // DeleteCommand

      await handler(event);

      // Verify all caches were invalidated
      expect(mockCache.del).toHaveBeenCalledWith('templates:get:template-123');
      expect(mockCache.clearPattern).toHaveBeenCalledWith('templates:list:*');
      expect(mockCache.del).toHaveBeenCalledWith('templates:user:test-user-id');
    });
  });

  describe('Create Template Cache Invalidation', () => {
    const { handler } = require('../create');

    it('should not invalidate public list caches for new public templates (pending moderation)', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          title: 'New Template',
          content: '<p>Content</p>',
          visibility: 'public',
          tags: ['test'],
        }),
      });

      // Mock successful creation
      mockDocClient.mockSend.mockResolvedValueOnce({}); // PutCommand

      await handler(event);

      // Verify public list caches were NOT invalidated (template is pending)
      expect(mockCache.clearPattern).not.toHaveBeenCalledWith('templates:list:public:*');
      expect(mockCache.clearPattern).not.toHaveBeenCalledWith('templates:list:popular:*');
      // But user cache should be invalidated
      expect(mockCache.del).toHaveBeenCalledWith('templates:user:test-user-id');
    });

    it('should only invalidate user cache for private templates', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          title: 'Private Template',
          content: '<p>Content</p>',
          visibility: 'private',
          tags: ['test'],
        }),
      });

      mockDocClient.mockSend.mockResolvedValueOnce({}); // PutCommand

      await handler(event);

      // Verify only user cache was invalidated
      expect(mockCache.clearPattern).not.toHaveBeenCalledWith('templates:list:public:*');
      expect(mockCache.clearPattern).not.toHaveBeenCalledWith('templates:list:popular:*');
      expect(mockCache.del).toHaveBeenCalledWith('templates:user:test-user-id');
    });

    it('should only invalidate user cache for pending moderation templates', async () => {
      const utils = require('/opt/nodejs/utils');
      
      const event = createMockEvent({
        body: JSON.stringify({
          title: 'Pending Template',
          content: '<p>Content pending review</p>',
          visibility: 'public',
          tags: ['test'],
        }),
      });

      // Mock moderation to return review status
      utils.moderateContent.mockReturnValueOnce({
        status: 'review',
        details: { reason: 'Manual review required' },
      });

      mockDocClient.mockSend.mockResolvedValueOnce({}); // PutCommand

      await handler(event);

      // Verify public caches were NOT invalidated (template not approved)
      expect(mockCache.clearPattern).not.toHaveBeenCalledWith('templates:list:public:*');
      expect(mockCache.del).toHaveBeenCalledWith('templates:user:test-user-id');
    });
  });

  describe('Cache Usage in List and Get Functions', () => {
    beforeEach(() => {
      mockCache.get.mockResolvedValue(null); // Default to cache miss
      mockCache.set.mockResolvedValue(undefined);
    });

    describe('List Templates with Caching', () => {
      const { handler } = require('../list');

      it('should use cache for public template listings', async () => {
        // Mock as anonymous user
        require('/opt/nodejs/auth').getUserFromEvent.mockResolvedValueOnce(null);
        
        const cachedData = {
          items: [{ templateId: '123', title: 'Cached' }],
          nextToken: null,
          count: 1,
        };
        
        mockCache.get.mockResolvedValueOnce(cachedData);

        const event = createMockEvent({
          queryStringParameters: {
            filter: 'public',
            limit: '20',
          },
        });

        const result = await handler(event);

        // Verify cache was checked
        expect(mockCache.get).toHaveBeenCalled();
        expect(result.body).toEqual(cachedData);
        
        // Verify no DB call was made (would throw error if called)
        expect(mockCache.set).not.toHaveBeenCalled();
      });

    });

    describe('Get Template with Caching', () => {
      const { handler } = require('../get');

      it('should use cache for anonymous users', async () => {
        const cachedTemplate = {
          templateId: 'template-123',
          title: 'Cached Template',
          content: 'Content',
          visibility: 'public',
          tags: ['test'],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          authorEmail: 'test@example.com',
          viewCount: 10,
          useCount: 5,
          variables: [],
          isOwner: false
        };
        
        mockCache.get.mockResolvedValueOnce(cachedTemplate);

        // Mock anonymous user
        require('/opt/nodejs/auth').getUserFromEvent.mockResolvedValueOnce(null);

        const event = createMockEvent({
          pathParameters: { templateId: 'template-123' },
        });

        const result = await handler(event);

        // Verify cache was used
        expect(mockCache.get).toHaveBeenCalledWith('templates:get:template-123');
        expect(result.body).toEqual(cachedTemplate);
      });

      it('should not use cache for authenticated users', async () => {
        // Mock authenticated user
        require('/opt/nodejs/auth').getUserFromEvent.mockResolvedValueOnce({ 
          sub: 'user-123' 
        });

        const event = createMockEvent({
          pathParameters: { templateId: 'template-123' },
        });

        // Mock DynamoDB response for authenticated user
        mockDocClient.mockSend.mockResolvedValueOnce({
          Item: {
            templateId: 'template-123',
            userId: 'user-123',
            title: 'My Template',
            visibility: 'public',
            moderationStatus: 'approved',
          }
        });

        await handler(event);

        // Verify cache was NOT checked (authenticated user)
        expect(mockCache.get).not.toHaveBeenCalled();
      });

      it('should not use cache when share token provided', async () => {
        const event = createMockEvent({
          pathParameters: { templateId: 'template-123' },
          queryStringParameters: { token: 'share-token-xyz' },
        });

        // Mock DynamoDB response with share token
        mockDocClient.mockSend.mockResolvedValueOnce({
          Item: {
            templateId: 'template-123',
            userId: 'other-user',
            title: 'Shared Template',
            visibility: 'private',
            shareTokens: {
              'share-token-xyz': {
                createdAt: '2024-01-01T00:00:00Z',
                expiresAt: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
              }
            }
          }
        });

        await handler(event);

        // Verify cache was NOT used (share token present)
        expect(mockCache.get).not.toHaveBeenCalled();
      });
    });
  });
});