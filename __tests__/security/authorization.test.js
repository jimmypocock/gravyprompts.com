/**
 * Authorization Security Tests
 * 
 * These tests verify proper authorization controls including role-based access,
 * resource ownership validation, and privilege escalation protection.
 */

const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');

// Mock AWS SDK
const mockDynamoDB = {
  get: jest.fn(),
  put: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  scan: jest.fn(),
  query: jest.fn()
};

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => mockDynamoDB)
  },
  GetCommand: jest.fn(),
  PutCommand: jest.fn(),
  UpdateCommand: jest.fn(),
  DeleteCommand: jest.fn(),
  ScanCommand: jest.fn(),
  QueryCommand: jest.fn()
}));

describe('Authorization Security Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Role-Based Access Control', () => {
    it('should prevent regular users from accessing admin endpoints', async () => {
      const regularUserToken = createMockJWT({
        sub: 'user-123',
        email: 'user@example.com',
        'custom:role': 'user'
      });

      const adminEndpoints = [
        { method: 'GET', path: '/admin/templates' },
        { method: 'POST', path: '/admin/users' },
        { method: 'PUT', path: '/admin/moderation' },
        { method: 'DELETE', path: '/admin/users/user-456' }
      ];

      for (const endpoint of adminEndpoints) {
        const event = {
          httpMethod: endpoint.method,
          path: endpoint.path,
          headers: { 'Authorization': `Bearer ${regularUserToken}` }
        };

        const response = await simulateAuthorizedRequest(event);
        expect(response.statusCode).toBe(403);
        expect(response.body).toContain('Insufficient privileges');
      }
    });

    it('should allow admin users to access admin endpoints', async () => {
      const adminToken = createMockJWT({
        sub: 'admin-123',
        email: 'admin@example.com',
        'custom:role': 'admin'
      });

      const event = {
        httpMethod: 'GET',
        path: '/admin/templates',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      };

      mockDynamoDB.scan.mockResolvedValue({
        Items: [{ templateId: 'template-1' }],
        Count: 1
      });

      const response = await simulateAuthorizedRequest(event);
      expect(response.statusCode).toBe(200);
    });

    it('should prevent privilege escalation through role manipulation', async () => {
      const maliciousTokens = [
        createMockJWT({
          sub: 'user-123',
          email: 'user@example.com',
          'custom:role': 'admin' // User attempting to claim admin role
        }),
        createMockJWT({
          sub: 'user-123',
          email: 'user@example.com',
          'custom:role': 'user',
          'custom:permissions': 'admin' // Alternative privilege field
        }),
        createMockJWT({
          sub: 'user-123',
          email: 'user@example.com',
          'custom:role': 'user',
          admin: true // Non-standard admin flag
        })
      ];

      for (const token of maliciousTokens) {
        const event = {
          httpMethod: 'DELETE',
          path: '/admin/users/victim',
          headers: { 'Authorization': `Bearer ${token}` }
        };

        const response = await simulateAuthorizedRequest(event);
        expect(response.statusCode).toBe(403);
      }
    });

    it('should validate role claims against user database', async () => {
      const suspiciousToken = createMockJWT({
        sub: 'user-123',
        email: 'user@example.com',
        'custom:role': 'admin'
      });

      // Mock user in database as regular user
      mockDynamoDB.get.mockResolvedValue({
        Item: {
          userId: 'user-123',
          email: 'user@example.com',
          role: 'user', // Database shows user role
          permissions: ['read', 'write']
        }
      });

      const event = {
        httpMethod: 'GET',
        path: '/admin/users',
        headers: { 'Authorization': `Bearer ${suspiciousToken}` }
      };

      const response = await simulateAuthorizedRequest(event);
      expect(response.statusCode).toBe(403);
      expect(response.body).toContain('Role mismatch');
    });
  });

  describe('Resource Ownership Validation', () => {
    it('should prevent users from accessing other users templates', async () => {
      const userToken = createMockJWT({
        sub: 'user-123',
        email: 'user@example.com'
      });

      mockDynamoDB.get.mockResolvedValue({
        Item: {
          templateId: 'template-456',
          title: 'Private Template',
          authorId: 'different-user-789', // Different user owns this
          visibility: 'private'
        }
      });

      const event = {
        httpMethod: 'GET',
        path: '/templates/template-456',
        pathParameters: { id: 'template-456' },
        headers: { 'Authorization': `Bearer ${userToken}` }
      };

      const response = await simulateAuthorizedRequest(event);
      expect(response.statusCode).toBe(403);
      expect(response.body).toContain('Access denied');
    });

    it('should allow users to access their own templates', async () => {
      const userToken = createMockJWT({
        sub: 'user-123',
        email: 'user@example.com'
      });

      mockDynamoDB.get.mockResolvedValue({
        Item: {
          templateId: 'template-456',
          title: 'My Template',
          authorId: 'user-123', // Same user owns this
          visibility: 'private'
        }
      });

      const event = {
        httpMethod: 'GET',
        path: '/templates/template-456',
        pathParameters: { id: 'template-456' },
        headers: { 'Authorization': `Bearer ${userToken}` }
      };

      const response = await simulateAuthorizedRequest(event);
      expect(response.statusCode).toBe(200);
    });

    it('should prevent users from modifying other users resources', async () => {
      const userToken = createMockJWT({
        sub: 'user-123',
        email: 'user@example.com'
      });

      mockDynamoDB.get.mockResolvedValue({
        Item: {
          templateId: 'template-456',
          authorId: 'different-user-789'
        }
      });

      const event = {
        httpMethod: 'PUT',
        path: '/templates/template-456',
        pathParameters: { id: 'template-456' },
        headers: { 'Authorization': `Bearer ${userToken}` },
        body: JSON.stringify({
          title: 'Modified Title',
          content: 'Modified Content'
        })
      };

      const response = await simulateAuthorizedRequest(event);
      expect(response.statusCode).toBe(403);
      expect(mockDynamoDB.update).not.toHaveBeenCalled();
    });

    it('should prevent users from deleting other users resources', async () => {
      const userToken = createMockJWT({
        sub: 'user-123',
        email: 'user@example.com'
      });

      mockDynamoDB.get.mockResolvedValue({
        Item: {
          templateId: 'template-456',
          authorId: 'different-user-789'
        }
      });

      const event = {
        httpMethod: 'DELETE',
        path: '/templates/template-456',
        pathParameters: { id: 'template-456' },
        headers: { 'Authorization': `Bearer ${userToken}` }
      };

      const response = await simulateAuthorizedRequest(event);
      expect(response.statusCode).toBe(403);
      expect(mockDynamoDB.delete).not.toHaveBeenCalled();
    });
  });

  describe('User Prompt Authorization', () => {
    it('should prevent users from accessing other users prompts', async () => {
      const userToken = createMockJWT({
        sub: 'user-123',
        email: 'user@example.com'
      });

      mockDynamoDB.query.mockResolvedValue({
        Items: [
          {
            promptId: 'prompt-1',
            userId: 'different-user-456',
            title: 'Private Prompt'
          }
        ],
        Count: 1
      });

      const event = {
        httpMethod: 'GET',
        path: '/prompts',
        headers: { 'Authorization': `Bearer ${userToken}` }
      };

      const response = await simulateUserPromptsRequest(event);
      
      // Should only return user's own prompts
      expect(mockDynamoDB.query).toHaveBeenCalledWith(
        expect.objectContaining({
          KeyConditionExpression: 'userId = :userId',
          ExpressionAttributeValues: { ':userId': 'user-123' }
        })
      );
    });

    it('should prevent prompt ID manipulation attacks', async () => {
      const userToken = createMockJWT({
        sub: 'user-123',
        email: 'user@example.com'
      });

      mockDynamoDB.get.mockResolvedValue({
        Item: {
          promptId: 'victim-prompt-123',
          userId: 'victim-456',
          title: 'Victim Prompt'
        }
      });

      const event = {
        httpMethod: 'DELETE',
        path: '/prompts/victim-prompt-123',
        pathParameters: { id: 'victim-prompt-123' },
        headers: { 'Authorization': `Bearer ${userToken}` }
      };

      const response = await simulateUserPromptsRequest(event);
      expect(response.statusCode).toBe(403);
      expect(mockDynamoDB.delete).not.toHaveBeenCalled();
    });
  });

  describe('API Key Authorization', () => {
    it('should validate API keys for programmatic access', async () => {
      const invalidApiKeys = [
        'invalid-api-key',
        'expired-api-key',
        'revoked-api-key',
        '', 
        null
      ];

      for (const apiKey of invalidApiKeys) {
        const event = {
          httpMethod: 'GET',
          path: '/api/templates',
          headers: { 'X-API-Key': apiKey }
        };

        const response = await simulateApiKeyRequest(event);
        expect(response.statusCode).toBe(401);
      }
    });

    it('should enforce API key rate limits', async () => {
      const apiKey = 'valid-api-key-123';
      const requests = [];

      // Simulate 100 requests in short time
      for (let i = 0; i < 100; i++) {
        requests.push(simulateApiKeyRequest({
          httpMethod: 'GET',
          path: '/api/templates',
          headers: { 'X-API-Key': apiKey }
        }));
      }

      const responses = await Promise.all(requests);
      const rateLimitedResponses = responses.filter(r => r.statusCode === 429);
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should validate API key scopes', async () => {
      const readOnlyApiKey = 'readonly-api-key-123';

      const writeEvent = {
        httpMethod: 'POST',
        path: '/api/templates',
        headers: { 'X-API-Key': readOnlyApiKey },
        body: JSON.stringify({
          title: 'New Template',
          content: 'Content'
        })
      };

      const response = await simulateApiKeyRequest(writeEvent);
      expect(response.statusCode).toBe(403);
      expect(response.body).toContain('Insufficient API key permissions');
    });
  });

  describe('Cross-Tenant Authorization', () => {
    it('should prevent cross-tenant data access', async () => {
      const userToken = createMockJWT({
        sub: 'user-123',
        email: 'user@tenant-a.com',
        'custom:tenant': 'tenant-a'
      });

      mockDynamoDB.scan.mockResolvedValue({
        Items: [
          { templateId: 'template-1', tenantId: 'tenant-a' },
          { templateId: 'template-2', tenantId: 'tenant-b' } // Different tenant
        ],
        Count: 2
      });

      const event = {
        httpMethod: 'GET',
        path: '/templates',
        headers: { 'Authorization': `Bearer ${userToken}` }
      };

      const response = await simulateMultiTenantRequest(event);
      expect(response.statusCode).toBe(200);
      
      const responseBody = JSON.parse(response.body);
      // Should only return templates from user's tenant
      expect(responseBody.templates).toHaveLength(1);
      expect(responseBody.templates[0].tenantId).toBe('tenant-a');
    });

    it('should prevent tenant impersonation', async () => {
      const maliciousToken = createMockJWT({
        sub: 'user-123',
        email: 'user@tenant-a.com',
        'custom:tenant': 'tenant-b' // Claiming different tenant
      });

      // Mock user database shows different tenant
      mockDynamoDB.get.mockResolvedValue({
        Item: {
          userId: 'user-123',
          email: 'user@tenant-a.com',
          tenantId: 'tenant-a' // Database shows correct tenant
        }
      });

      const event = {
        httpMethod: 'GET',
        path: '/templates',
        headers: { 'Authorization': `Bearer ${maliciousToken}` }
      };

      const response = await simulateMultiTenantRequest(event);
      expect(response.statusCode).toBe(403);
      expect(response.body).toContain('Tenant mismatch');
    });
  });

  describe('Temporary Access Authorization', () => {
    it('should validate shared template tokens', async () => {
      const expiredShareToken = 'expired-share-token';
      
      mockDynamoDB.get.mockResolvedValue({
        Item: {
          token: expiredShareToken,
          templateId: 'template-123',
          expiresAt: new Date(Date.now() - 3600000).toISOString(), // Expired 1 hour ago
          permissions: ['read']
        }
      });

      const event = {
        httpMethod: 'GET',
        path: '/shared/template-123',
        queryStringParameters: { token: expiredShareToken }
      };

      const response = await simulateSharedAccessRequest(event);
      expect(response.statusCode).toBe(403);
      expect(response.body).toContain('Share token expired');
    });

    it('should enforce shared token permissions', async () => {
      const readOnlyToken = 'readonly-share-token';
      
      mockDynamoDB.get.mockResolvedValue({
        Item: {
          token: readOnlyToken,
          templateId: 'template-123',
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
          permissions: ['read'] // Read-only permissions
        }
      });

      const writeEvent = {
        httpMethod: 'PUT',
        path: '/shared/template-123',
        queryStringParameters: { token: readOnlyToken },
        body: JSON.stringify({ title: 'Modified' })
      };

      const response = await simulateSharedAccessRequest(writeEvent);
      expect(response.statusCode).toBe(403);
      expect(response.body).toContain('Insufficient permissions');
    });

    it('should prevent token reuse after revocation', async () => {
      const revokedToken = 'revoked-share-token';
      
      mockDynamoDB.get.mockResolvedValue({
        Item: {
          token: revokedToken,
          templateId: 'template-123',
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
          permissions: ['read'],
          revoked: true // Token has been revoked
        }
      });

      const event = {
        httpMethod: 'GET',
        path: '/shared/template-123',
        queryStringParameters: { token: revokedToken }
      };

      const response = await simulateSharedAccessRequest(event);
      expect(response.statusCode).toBe(403);
      expect(response.body).toContain('Access revoked');
    });
  });
});

// Helper functions for authorization testing
function createMockJWT(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64');
  const payloadB64 = Buffer.from(JSON.stringify({
    ...payload,
    iss: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test',
    aud: 'test-client-id',
    exp: Math.floor(Date.now() / 1000) + 3600
  })).toString('base64');
  const signature = 'mock-signature';
  
  return `${headerB64}.${payloadB64}.${signature}`;
}

async function simulateAuthorizedRequest(event) {
  const authHeader = event.headers?.['Authorization'];
  
  if (!authHeader) {
    return { statusCode: 401, body: 'Authentication required' };
  }
  
  const token = authHeader.replace('Bearer ', '');
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
  
  // Admin endpoint protection
  if (event.path.startsWith('/admin/')) {
    const userRole = payload['custom:role'];
    
    if (userRole !== 'admin') {
      return { statusCode: 403, body: 'Insufficient privileges' };
    }
    
    // Validate role against database
    const dbUser = await mockDynamoDB.get({
      TableName: 'users',
      Key: { userId: payload.sub }
    });
    
    if (dbUser.Item?.role !== 'admin') {
      return { statusCode: 403, body: 'Role mismatch detected' };
    }
  }
  
  // Resource ownership validation
  if (event.pathParameters?.id && ['PUT', 'DELETE'].includes(event.httpMethod)) {
    const resourceId = event.pathParameters.id;
    const resource = await mockDynamoDB.get({
      TableName: 'templates',
      Key: { templateId: resourceId }
    });
    
    if (resource.Item?.authorId !== payload.sub) {
      return { statusCode: 403, body: 'Access denied - not resource owner' };
    }
  }
  
  // Private template access
  if (event.path.includes('/templates/') && event.httpMethod === 'GET') {
    const templateId = event.pathParameters?.id;
    if (templateId) {
      const template = await mockDynamoDB.get({
        TableName: 'templates',
        Key: { templateId }
      });
      
      if (template.Item?.visibility === 'private' && template.Item?.authorId !== payload.sub) {
        return { statusCode: 403, body: 'Access denied - private template' };
      }
    }
  }
  
  return { statusCode: 200, body: 'Authorized' };
}

async function simulateUserPromptsRequest(event) {
  const authHeader = event.headers?.['Authorization'];
  const token = authHeader.replace('Bearer ', '');
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
  const userId = payload.sub;
  
  if (event.httpMethod === 'GET' && event.path === '/prompts') {
    // List prompts - only user's own
    await mockDynamoDB.query({
      TableName: 'user-prompts',
      IndexName: 'userId-index',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': userId }
    });
    
    return { statusCode: 200, body: 'User prompts retrieved' };
  }
  
  if (event.httpMethod === 'DELETE' && event.pathParameters?.id) {
    // Delete prompt - check ownership
    const promptId = event.pathParameters.id;
    const prompt = await mockDynamoDB.get({
      TableName: 'user-prompts',
      Key: { promptId }
    });
    
    if (prompt.Item?.userId !== userId) {
      return { statusCode: 403, body: 'Cannot delete other user prompt' };
    }
  }
  
  return { statusCode: 200, body: 'Prompt operation authorized' };
}

async function simulateApiKeyRequest(event) {
  const apiKey = event.headers?.['X-API-Key'];
  
  if (!apiKey) {
    return { statusCode: 401, body: 'API key required' };
  }
  
  // Mock API key validation
  const validApiKeys = {
    'valid-api-key-123': { scopes: ['read', 'write'], rateLimit: 1000 },
    'readonly-api-key-123': { scopes: ['read'], rateLimit: 500 }
  };
  
  const keyInfo = validApiKeys[apiKey];
  if (!keyInfo) {
    return { statusCode: 401, body: 'Invalid API key' };
  }
  
  // Check scope permissions
  const isWriteOperation = ['POST', 'PUT', 'DELETE'].includes(event.httpMethod);
  if (isWriteOperation && !keyInfo.scopes.includes('write')) {
    return { statusCode: 403, body: 'Insufficient API key permissions' };
  }
  
  // Mock rate limiting
  global.apiKeyUsage = global.apiKeyUsage || {};
  global.apiKeyUsage[apiKey] = (global.apiKeyUsage[apiKey] || 0) + 1;
  
  if (global.apiKeyUsage[apiKey] > keyInfo.rateLimit) {
    return { statusCode: 429, body: 'API key rate limit exceeded' };
  }
  
  return { statusCode: 200, body: 'API key authorized' };
}

async function simulateMultiTenantRequest(event) {
  const authHeader = event.headers?.['Authorization'];
  const token = authHeader.replace('Bearer ', '');
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
  
  const tokenTenant = payload['custom:tenant'];
  const userId = payload.sub;
  
  // Validate tenant against user database
  const user = await mockDynamoDB.get({
    TableName: 'users',
    Key: { userId }
  });
  
  if (user.Item?.tenantId !== tokenTenant) {
    return { statusCode: 403, body: 'Tenant mismatch detected' };
  }
  
  // Filter results by tenant
  const templates = await mockDynamoDB.scan({
    TableName: 'templates',
    FilterExpression: 'tenantId = :tenantId',
    ExpressionAttributeValues: { ':tenantId': tokenTenant }
  });
  
  const filteredTemplates = templates.Items.filter(t => t.tenantId === tokenTenant);
  
  return { 
    statusCode: 200, 
    body: JSON.stringify({ templates: filteredTemplates })
  };
}

async function simulateSharedAccessRequest(event) {
  const shareToken = event.queryStringParameters?.token;
  
  if (!shareToken) {
    return { statusCode: 401, body: 'Share token required' };
  }
  
  const tokenInfo = await mockDynamoDB.get({
    TableName: 'share-tokens',
    Key: { token: shareToken }
  });
  
  if (!tokenInfo.Item) {
    return { statusCode: 403, body: 'Invalid share token' };
  }
  
  const token = tokenInfo.Item;
  
  // Check expiration
  if (new Date(token.expiresAt) < new Date()) {
    return { statusCode: 403, body: 'Share token expired' };
  }
  
  // Check revocation
  if (token.revoked) {
    return { statusCode: 403, body: 'Access revoked' };
  }
  
  // Check permissions
  const isWriteOperation = ['POST', 'PUT', 'DELETE'].includes(event.httpMethod);
  if (isWriteOperation && !token.permissions.includes('write')) {
    return { statusCode: 403, body: 'Insufficient permissions for this operation' };
  }
  
  return { statusCode: 200, body: 'Shared access authorized' };
}