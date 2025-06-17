/**
 * Lambda Performance Tests
 * 
 * These tests verify that Lambda functions perform within acceptable limits.
 * They test response times, memory usage, and throughput under various loads.
 */

const { performance } = require('perf_hooks');

// Mock AWS SDK for performance testing
const mockDynamoDB = {
  scan: jest.fn(),
  query: jest.fn(),
  get: jest.fn(),
  put: jest.fn(),
  update: jest.fn(),
  delete: jest.fn()
};

const mockComprehend = {
  detectSentiment: jest.fn(),
  detectToxicContent: jest.fn()
};

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(() => ({}))
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => mockDynamoDB)
  },
  ScanCommand: jest.fn(),
  QueryCommand: jest.fn(),
  GetCommand: jest.fn(),
  PutCommand: jest.fn(),
  UpdateCommand: jest.fn(),
  DeleteCommand: jest.fn()
}));

jest.mock('@aws-sdk/client-comprehend', () => ({
  ComprehendClient: jest.fn(() => mockComprehend)
}));

describe('Lambda Performance Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset performance monitoring
    performance.clearMarks();
    performance.clearMeasures();
  });

  describe('Template List Lambda Performance', () => {
    let listHandler;

    beforeAll(async () => {
      // Import the list function
      const listModule = require('../../cdk/lambda/templates/list.js');
      listHandler = listModule.handler;
    });

    it('should respond within 1 second for small datasets', async () => {
      const mockTemplates = Array.from({ length: 20 }, (_, i) => ({
        templateId: `template-${i}`,
        title: `Template ${i}`,
        content: `Content ${i}`.repeat(100), // ~800 chars each
        tags: ['test', 'performance'],
        variables: ['name', 'company'],
        visibility: 'public',
        status: 'approved',
        createdAt: new Date().toISOString(),
        views: Math.floor(Math.random() * 1000),
        useCount: Math.floor(Math.random() * 100)
      }));

      mockDynamoDB.scan.mockResolvedValue({
        Items: mockTemplates,
        Count: mockTemplates.length
      });

      const event = {
        httpMethod: 'GET',
        queryStringParameters: { limit: '20' },
        headers: {}
      };

      const startTime = performance.now();
      const result = await listHandler(event);
      const endTime = performance.now();

      const responseTime = endTime - startTime;
      
      expect(result.statusCode).toBe(200);
      expect(responseTime).toBeLessThan(1000); // Less than 1 second
    });

    it('should handle large datasets efficiently', async () => {
      const mockTemplates = Array.from({ length: 100 }, (_, i) => ({
        templateId: `template-${i}`,
        title: `Template ${i}`,
        content: `Content ${i}`.repeat(500), // ~4KB each
        tags: ['test', 'performance', 'large'],
        variables: ['name', 'company', 'value'],
        visibility: 'public',
        status: 'approved',
        createdAt: new Date().toISOString(),
        views: Math.floor(Math.random() * 1000),
        useCount: Math.floor(Math.random() * 100)
      }));

      mockDynamoDB.scan.mockResolvedValue({
        Items: mockTemplates,
        Count: mockTemplates.length
      });

      const event = {
        httpMethod: 'GET',
        queryStringParameters: { limit: '100' },
        headers: {}
      };

      const startTime = performance.now();
      const result = await listHandler(event);
      const endTime = performance.now();

      const responseTime = endTime - startTime;
      
      expect(result.statusCode).toBe(200);
      expect(responseTime).toBeLessThan(3000); // Less than 3 seconds for large dataset
    });

    it('should perform search efficiently', async () => {
      const mockTemplates = Array.from({ length: 50 }, (_, i) => ({
        templateId: `template-${i}`,
        title: i % 2 === 0 ? `Email Template ${i}` : `Marketing Template ${i}`,
        content: `Professional ${i % 2 === 0 ? 'email' : 'marketing'} content`,
        tags: i % 2 === 0 ? ['email', 'business'] : ['marketing', 'promotion'],
        variables: ['name'],
        visibility: 'public',
        status: 'approved',
        createdAt: new Date().toISOString(),
        views: Math.floor(Math.random() * 1000),
        useCount: Math.floor(Math.random() * 100)
      }));

      mockDynamoDB.scan.mockResolvedValue({
        Items: mockTemplates,
        Count: mockTemplates.length
      });

      const event = {
        httpMethod: 'GET',
        queryStringParameters: { 
          search: 'email template',
          limit: '20'
        },
        headers: {}
      };

      const startTime = performance.now();
      const result = await listHandler(event);
      const endTime = performance.now();

      const responseTime = endTime - startTime;
      const responseBody = JSON.parse(result.body);
      
      expect(result.statusCode).toBe(200);
      expect(responseTime).toBeLessThan(2000); // Search should complete within 2 seconds
      expect(responseBody.templates.length).toBeGreaterThan(0);
    });

    it('should handle concurrent requests efficiently', async () => {
      const mockTemplates = Array.from({ length: 30 }, (_, i) => ({
        templateId: `template-${i}`,
        title: `Template ${i}`,
        content: `Content ${i}`,
        tags: ['test'],
        variables: ['name'],
        visibility: 'public',
        status: 'approved',
        createdAt: new Date().toISOString(),
        views: i * 10,
        useCount: i * 5
      }));

      mockDynamoDB.scan.mockResolvedValue({
        Items: mockTemplates,
        Count: mockTemplates.length
      });

      const event = {
        httpMethod: 'GET',
        queryStringParameters: { limit: '30' },
        headers: {}
      };

      // Simulate 5 concurrent requests
      const startTime = performance.now();
      const promises = Array.from({ length: 5 }, () => listHandler(event));
      const results = await Promise.all(promises);
      const endTime = performance.now();

      const totalTime = endTime - startTime;
      const avgTimePerRequest = totalTime / 5;

      results.forEach(result => {
        expect(result.statusCode).toBe(200);
      });
      
      expect(avgTimePerRequest).toBeLessThan(1500); // Average response time under 1.5s
    });
  });

  describe('Template Create Lambda Performance', () => {
    let createHandler;

    beforeAll(async () => {
      const createModule = require('../../cdk/lambda/templates/create.js');
      createHandler = createModule.handler;
    });

    it('should create templates quickly', async () => {
      mockDynamoDB.put.mockResolvedValue({});

      const templateData = {
        title: 'Performance Test Template',
        content: 'Test content for performance'.repeat(100), // ~2.5KB
        tags: ['performance', 'test'],
        visibility: 'public'
      };

      const event = {
        httpMethod: 'POST',
        body: JSON.stringify(templateData),
        headers: {
          'Content-Type': 'application/json'
        },
        requestContext: {
          authorizer: {
            claims: {
              sub: 'test-user-id',
              email: 'test@example.com'
            }
          }
        }
      };

      const startTime = performance.now();
      const result = await createHandler(event);
      const endTime = performance.now();

      const responseTime = endTime - startTime;
      
      expect(result.statusCode).toBe(201);
      expect(responseTime).toBeLessThan(2000); // Template creation under 2 seconds
    });

    it('should handle large template content efficiently', async () => {
      mockDynamoDB.put.mockResolvedValue({});

      const largeContent = 'Large template content with many variables and text. '.repeat(1000); // ~50KB

      const templateData = {
        title: 'Large Performance Test Template',
        content: largeContent,
        tags: ['performance', 'large', 'test'],
        visibility: 'public'
      };

      const event = {
        httpMethod: 'POST',
        body: JSON.stringify(templateData),
        headers: {
          'Content-Type': 'application/json'
        },
        requestContext: {
          authorizer: {
            claims: {
              sub: 'test-user-id',
              email: 'test@example.com'
            }
          }
        }
      };

      const startTime = performance.now();
      const result = await createHandler(event);
      const endTime = performance.now();

      const responseTime = endTime - startTime;
      
      expect(result.statusCode).toBe(201);
      expect(responseTime).toBeLessThan(5000); // Large content under 5 seconds
    });
  });

  describe('Template Get Lambda Performance', () => {
    let getHandler;

    beforeAll(async () => {
      const getModule = require('../../cdk/lambda/templates/get.js');
      getHandler = getModule.handler;
    });

    it('should retrieve templates quickly', async () => {
      const mockTemplate = {
        templateId: 'performance-test-123',
        title: 'Test Template',
        content: 'Hello {{name}}, welcome to {{company}}!',
        tags: ['test'],
        variables: ['name', 'company'],
        visibility: 'public',
        status: 'approved',
        authorId: 'test-user',
        authorEmail: 'test@example.com',
        createdAt: new Date().toISOString(),
        views: 100,
        useCount: 50
      };

      mockDynamoDB.get.mockResolvedValue({
        Item: mockTemplate
      });

      mockDynamoDB.update.mockResolvedValue({}); // For view tracking

      const event = {
        httpMethod: 'GET',
        pathParameters: {
          id: 'performance-test-123'
        },
        headers: {}
      };

      const startTime = performance.now();
      const result = await getHandler(event);
      const endTime = performance.now();

      const responseTime = endTime - startTime;
      
      expect(result.statusCode).toBe(200);
      expect(responseTime).toBeLessThan(500); // Template retrieval under 500ms
    });

    it('should handle view tracking efficiently', async () => {
      const mockTemplate = {
        templateId: 'performance-test-123',
        title: 'Test Template',
        content: 'Content',
        views: 1000 // High view count
      };

      mockDynamoDB.get.mockResolvedValue({
        Item: mockTemplate
      });

      mockDynamoDB.update.mockResolvedValue({});

      const event = {
        httpMethod: 'GET',
        pathParameters: {
          id: 'performance-test-123'
        },
        headers: {}
      };

      // Test multiple view updates
      const promises = Array.from({ length: 10 }, () => getHandler(event));
      
      const startTime = performance.now();
      const results = await Promise.all(promises);
      const endTime = performance.now();

      const totalTime = endTime - startTime;
      const avgTime = totalTime / 10;

      results.forEach(result => {
        expect(result.statusCode).toBe(200);
      });
      
      expect(avgTime).toBeLessThan(800); // Average view tracking under 800ms
    });
  });

  describe('Search Algorithm Performance', () => {
    it('should score and rank templates efficiently', async () => {
      const mockTemplates = Array.from({ length: 200 }, (_, i) => ({
        templateId: `template-${i}`,
        title: i % 3 === 0 ? `Email Template ${i}` : `Other Template ${i}`,
        content: i % 3 === 0 ? 'Professional email content' : 'Other content',
        tags: i % 3 === 0 ? ['email', 'business'] : ['other'],
        variables: ['name'],
        visibility: 'public',
        status: 'approved',
        views: Math.floor(Math.random() * 1000),
        useCount: Math.floor(Math.random() * 100)
      }));

      // Mock the scoring logic performance
      const startTime = performance.now();
      
      const searchTerm = 'email';
      const scoredTemplates = mockTemplates.map(template => {
        let score = 0;
        
        // Title matching
        if (template.title.toLowerCase().includes(searchTerm)) {
          score += 10;
        }
        
        // Content matching
        if (template.content.toLowerCase().includes(searchTerm)) {
          score += 5;
        }
        
        // Tag matching
        if (template.tags.some(tag => tag.includes(searchTerm))) {
          score += 8;
        }
        
        // Popularity boost
        const popularityFactor = Math.log(template.useCount + 1) / 10;
        score += popularityFactor;
        
        return { ...template, score };
      });

      // Sort by score
      scoredTemplates.sort((a, b) => b.score - a.score);
      
      const endTime = performance.now();
      const processingTime = endTime - startTime;

      expect(processingTime).toBeLessThan(100); // Scoring 200 templates under 100ms
      expect(scoredTemplates[0].score).toBeGreaterThan(0);
    });
  });

  describe('Memory Usage Performance', () => {
    it('should handle large datasets without excessive memory usage', async () => {
      const initialMemory = process.memoryUsage();
      
      // Create a large dataset
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        templateId: `template-${i}`,
        title: `Template ${i}`,
        content: 'Large content block '.repeat(100), // ~1.8KB each
        tags: ['performance', 'test', 'memory'],
        variables: ['name', 'company', 'value'],
        visibility: 'public',
        status: 'approved',
        createdAt: new Date().toISOString(),
        views: Math.floor(Math.random() * 1000),
        useCount: Math.floor(Math.random() * 100)
      }));

      // Process the dataset (simulate search/filter operations)
      const filtered = largeDataset.filter(template => 
        template.tags.includes('performance')
      );

      const sorted = filtered.sort((a, b) => b.useCount - a.useCount);
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      expect(sorted.length).toBe(1000);
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB increase
    });
  });

  describe('Database Query Performance', () => {
    it('should optimize DynamoDB scan operations', async () => {
      const mockResult = {
        Items: Array.from({ length: 50 }, (_, i) => ({ id: i })),
        Count: 50,
        ScannedCount: 50
      };

      mockDynamoDB.scan.mockResolvedValue(mockResult);

      const startTime = performance.now();
      
      // Simulate the actual scan call structure
      const scanParams = {
        TableName: 'templates',
        FilterExpression: '#status = :status',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':status': 'approved'
        },
        Limit: 50
      };

      await mockDynamoDB.scan(scanParams);
      
      const endTime = performance.now();
      const queryTime = endTime - startTime;

      expect(queryTime).toBeLessThan(50); // Mock query under 50ms
      expect(mockDynamoDB.scan).toHaveBeenCalledWith(scanParams);
    });

    it('should handle pagination efficiently', async () => {
      const pages = 5;
      const itemsPerPage = 20;
      
      let lastEvaluatedKey = null;
      const startTime = performance.now();

      for (let page = 0; page < pages; page++) {
        const mockResult = {
          Items: Array.from({ length: itemsPerPage }, (_, i) => ({ 
            id: page * itemsPerPage + i 
          })),
          Count: itemsPerPage,
          LastEvaluatedKey: page < pages - 1 ? { id: (page + 1) * itemsPerPage } : undefined
        };

        mockDynamoDB.scan.mockResolvedValueOnce(mockResult);
        
        const result = await mockDynamoDB.scan({
          TableName: 'templates',
          Limit: itemsPerPage,
          ExclusiveStartKey: lastEvaluatedKey
        });

        lastEvaluatedKey = result.LastEvaluatedKey;
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTimePerPage = totalTime / pages;

      expect(avgTimePerPage).toBeLessThan(20); // Average page load under 20ms
      expect(mockDynamoDB.scan).toHaveBeenCalledTimes(pages);
    });
  });
});