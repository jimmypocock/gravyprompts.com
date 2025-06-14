// End-to-End Integration Tests for Admin/Approval Flow
// These tests verify the complete flow from authentication through admin operations

// Set up environment variables BEFORE requiring anything else
process.env.TEMPLATES_TABLE = 'local-templates';
process.env.USER_PERMISSIONS_TABLE = 'local-user-permissions';
process.env.APPROVAL_HISTORY_TABLE = 'local-approval-history';
process.env.RATE_LIMITS_TABLE = 'local-rate-limits';
process.env.AWS_ENDPOINT_URL_DYNAMODB = 'http://localhost:8000';
process.env.AWS_SAM_LOCAL = 'true';

// Set AWS credentials for the SDK
process.env.AWS_ACCESS_KEY_ID = 'test';
process.env.AWS_SECRET_ACCESS_KEY = 'test';
process.env.AWS_REGION = 'us-east-1';

// Mock the Lambda layer modules for integration tests
jest.mock('/opt/nodejs/utils', () => {
  const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
  const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
  
  const ddbClient = new DynamoDBClient({
    endpoint: 'http://localhost:8000',
    region: 'us-east-1',
    credentials: {
      accessKeyId: 'test',
      secretAccessKey: 'test'
    }
  });
  
  const docClient = DynamoDBDocumentClient.from(ddbClient);
  
  return {
    docClient,
    createResponse: (statusCode, body) => ({
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(body)
    }),
    getUserIdFromEvent: (event) => {
      if (event.requestContext?.authorizer?.claims?.sub) {
        return event.requestContext.authorizer.claims.sub;
      }
      return null;
    },
    checkRateLimit: async () => true
  };
});

jest.mock('/opt/nodejs/auth', () => ({
  getUserFromEvent: (event) => {
    if (event.requestContext?.authorizer?.claims) {
      return event.requestContext.authorizer.claims;
    }
    return null;
  },
  decodeJwtPayload: (token) => {
    // For integration tests, simulate JWT decoding
    if (token === 'admin-token') {
      return { sub: 'admin-user-123', email: 'admin@test.com', name: 'Admin User' };
    }
    if (token === 'approver-token') {
      return { sub: 'approver-user-456', email: 'approver@test.com', name: 'Approver User' };
    }
    if (token === 'regular-token') {
      return { sub: 'regular-user-789', email: 'user@test.com', name: 'Regular User' };
    }
    return null;
  }
}));

// Import handlers
const permissionsHandler = require('../permissions').handler;
const approvalHandler = require('../approval').handler;
const listHandler = require('../../templates/list').handler;

// Import test utilities
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, DeleteCommand, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

// Create real DynamoDB client
const ddbClient = new DynamoDBClient({
  endpoint: 'http://localhost:8000',
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'test',
    secretAccessKey: 'test'
  }
});
const docClient = DynamoDBDocumentClient.from(ddbClient);

// Test users
const testUsers = {
  admin: {
    sub: 'admin-user-123',
    email: 'admin@test.com',
    name: 'Admin User'
  },
  approver: {
    sub: 'approver-user-456',
    email: 'approver@test.com', 
    name: 'Approver User'
  },
  regularUser: {
    sub: 'regular-user-789',
    email: 'regular@test.com',
    name: 'Regular User'
  },
  templateAuthor: {
    sub: 'author-user-999',
    email: 'author@test.com',
    name: 'Template Author'
  }
};

// Test templates for approval flow
const testTemplates = [
  {
    templateId: uuidv4(),
    title: 'Pending Template for Approval',
    content: 'This template needs approval {{variable}}',
    tags: ['test', 'pending'],
    variables: ['variable'],
    userId: testUsers.templateAuthor.sub,
    authorEmail: testUsers.templateAuthor.email,
    visibility: 'public',
    moderationStatus: 'pending',
    useCount: 0,
    viewCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    templateId: uuidv4(),
    title: 'Template For Rejection Test',
    content: 'This template will be rejected in tests {{test}}',
    tags: ['review', 'waiting'],
    variables: ['test'],
    userId: testUsers.regularUser.sub,
    authorEmail: testUsers.regularUser.email,
    visibility: 'public',
    moderationStatus: 'pending',
    useCount: 0,
    viewCount: 0,
    createdAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    updatedAt: new Date(Date.now() - 3600000).toISOString()
  },
  {
    templateId: uuidv4(),
    title: 'Already Approved Template',
    content: 'This template is already approved {{approved}}',
    tags: ['approved', 'public'],
    variables: ['approved'],
    userId: testUsers.regularUser.sub,
    authorEmail: testUsers.regularUser.email,
    visibility: 'public',
    moderationStatus: 'approved',
    useCount: 10,
    viewCount: 50,
    createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    updatedAt: new Date(Date.now() - 86400000).toISOString()
  }
];

// Helper to create test event
const createTestEvent = (options = {}) => {
  const event = {
    httpMethod: options.method || 'GET',
    path: options.path || '/',
    headers: options.headers || {},
    queryStringParameters: options.queryStringParameters || null,
    pathParameters: options.pathParameters || null,
    body: options.body ? JSON.stringify(options.body) : null,
    requestContext: {}
  };

  // Add user authentication if provided
  if (options.user) {
    event.requestContext.authorizer = {
      claims: {
        sub: options.user.sub,
        email: options.user.email,
        name: options.user.name
      }
    };
  }

  return event;
};

// Helper to setup test data
const setupTestData = async () => {
  console.log('Setting up E2E test data...');
  
  // Add templates
  for (const template of testTemplates) {
    await docClient.send(new PutCommand({
      TableName: process.env.TEMPLATES_TABLE,
      Item: template
    }));
  }
  
  // Grant admin permission
  await docClient.send(new PutCommand({
    TableName: process.env.USER_PERMISSIONS_TABLE,
    Item: {
      userId: testUsers.admin.sub,
      permission: 'admin',
      email: testUsers.admin.email,
      grantedBy: 'system',
      grantedAt: new Date().toISOString()
    }
  }));
  
  // Grant approval permission
  await docClient.send(new PutCommand({
    TableName: process.env.USER_PERMISSIONS_TABLE,
    Item: {
      userId: testUsers.approver.sub,
      permission: 'approval',
      email: testUsers.approver.email,
      grantedBy: testUsers.admin.sub,
      grantedAt: new Date().toISOString()
    }
  }));
  
  console.log('✅ E2E test data setup complete');
};

// Helper to cleanup test data
const cleanupTestData = async () => {
  console.log('Cleaning up E2E test data...');
  
  // Clean templates
  const templates = await docClient.send(new ScanCommand({
    TableName: process.env.TEMPLATES_TABLE
  }));
  
  for (const item of templates.Items || []) {
    await docClient.send(new DeleteCommand({
      TableName: process.env.TEMPLATES_TABLE,
      Key: { templateId: item.templateId }
    }));
  }
  
  // Clean permissions
  const permissions = await docClient.send(new ScanCommand({
    TableName: process.env.USER_PERMISSIONS_TABLE
  }));
  
  for (const item of permissions.Items || []) {
    await docClient.send(new DeleteCommand({
      TableName: process.env.USER_PERMISSIONS_TABLE,
      Key: { 
        userId: item.userId,
        permission: item.permission 
      }
    }));
  }
  
  // Clean approval history
  const history = await docClient.send(new ScanCommand({
    TableName: process.env.APPROVAL_HISTORY_TABLE
  }));
  
  for (const item of history.Items || []) {
    await docClient.send(new DeleteCommand({
      TableName: process.env.APPROVAL_HISTORY_TABLE,
      Key: { historyId: item.historyId }
    }));
  }
  
  console.log('✅ E2E test data cleaned up');
};

describe('Admin/Approval End-to-End Integration Tests', () => {
  beforeAll(async () => {
    await setupTestData();
  }, 30000);
  
  afterAll(async () => {
    await cleanupTestData();
  }, 30000);
  
  describe('Complete Admin Workflow', () => {
    it('should handle the complete flow: grant permission → view queue → approve template → verify public', async () => {
      // Step 1: Admin grants approval permission to a new user
      console.log('Step 1: Admin granting approval permission...');
      const grantEvent = createTestEvent({
        method: 'POST',
        path: '/admin/permissions',
        user: testUsers.admin,
        body: {
          userId: 'new-approver-123',
          email: 'newapprover@test.com',
          permission: 'approval'
        }
      });
      
      const grantResponse = await permissionsHandler(grantEvent);
      expect(grantResponse.statusCode).toBe(201);
      console.log('✅ Permission granted successfully');
      
      // Step 2: New approver views approval queue
      console.log('Step 2: Approver viewing approval queue...');
      const queueEvent = createTestEvent({
        method: 'GET',
        path: '/admin/approval/queue',
        user: { sub: 'new-approver-123', email: 'newapprover@test.com' },
        queryStringParameters: {
          status: 'pending'
        }
      });
      
      const queueResponse = await approvalHandler(queueEvent);
      expect(queueResponse.statusCode).toBe(200);
      const queueBody = JSON.parse(queueResponse.body);
      expect(queueBody.templates.length).toBeGreaterThan(0);
      
      const pendingTemplate = queueBody.templates[0];
      console.log(`✅ Found ${queueBody.templates.length} pending templates`);
      
      // Step 3: Approver approves the template
      console.log('Step 3: Approving template...');
      const approveEvent = createTestEvent({
        method: 'POST',
        path: `/admin/approval/template/${pendingTemplate.templateId}`,
        user: { sub: 'new-approver-123', email: 'newapprover@test.com' },
        body: {
          action: 'approve',
          notes: 'Looks good, approved via E2E test'
        }
      });
      
      const approveResponse = await approvalHandler(approveEvent);
      expect(approveResponse.statusCode).toBe(200);
      const approveBody = JSON.parse(approveResponse.body);
      expect(approveBody.moderationStatus).toBe('approved');
      console.log('✅ Template approved successfully');
      
      // Step 4: Verify template appears in public search
      console.log('Step 4: Verifying template in public search...');
      const searchEvent = createTestEvent({
        method: 'GET',
        path: '/templates',
        queryStringParameters: {
          filter: 'public',
          search: pendingTemplate.title
        }
      });
      
      const searchResponse = await listHandler(searchEvent);
      expect(searchResponse.statusCode).toBe(200);
      const searchBody = JSON.parse(searchResponse.body);
      
      const approvedTemplate = searchBody.items.find(t => 
        t.templateId === pendingTemplate.templateId
      );
      expect(approvedTemplate).toBeDefined();
      console.log('✅ Approved template now visible in public search');
      
      // Step 5: Verify approval history was recorded
      console.log('Step 5: Checking approval history...');
      const historyQuery = await docClient.send(new QueryCommand({
        TableName: process.env.APPROVAL_HISTORY_TABLE,
        IndexName: 'templateId-timestamp-index',
        KeyConditionExpression: 'templateId = :templateId',
        ExpressionAttributeValues: {
          ':templateId': pendingTemplate.templateId
        }
      }));
      
      expect(historyQuery.Items.length).toBeGreaterThan(0);
      const historyRecord = historyQuery.Items[0];
      expect(historyRecord.action).toBe('approve');
      expect(historyRecord.reviewerId).toBe('new-approver-123');
      console.log('✅ Approval history recorded correctly');
    });
    
    it('should prevent non-admin users from granting permissions', async () => {
      const event = createTestEvent({
        method: 'POST',
        path: '/admin/permissions',
        user: testUsers.regularUser,
        body: {
          userId: 'someone-123',
          email: 'someone@test.com',
          permission: 'admin'
        }
      });
      
      const response = await permissionsHandler(event);
      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Admin permission required');
    });
    
    it('should prevent non-approvers from accessing approval queue', async () => {
      const event = createTestEvent({
        method: 'GET',
        path: '/admin/approval/queue',
        user: testUsers.regularUser
      });
      
      const response = await approvalHandler(event);
      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Approval permission required');
    });
  });
  
  describe('Rejection Workflow', () => {
    it('should handle template rejection with reason and verify it does not appear in public', async () => {
      // Get a pending template
      const queueEvent = createTestEvent({
        method: 'GET',
        path: '/admin/approval/queue',
        user: testUsers.approver,
        queryStringParameters: { status: 'pending' }
      });
      
      const queueResponse = await approvalHandler(queueEvent);
      expect(queueResponse.statusCode).toBe(200);
      const queueBody = JSON.parse(queueResponse.body);
      
      // The test template should be in the queue
      const templateToReject = queueBody.templates?.find(t => 
        t.title === 'Template For Rejection Test'
      );
      
      // If not found, let's check what we have
      if (!templateToReject) {
        console.log('Templates in queue:', queueBody.templates?.map(t => t.title));
      }
      
      expect(templateToReject).toBeDefined();
      
      // Reject the template
      const rejectEvent = createTestEvent({
        method: 'POST',
        path: `/admin/approval/template/${templateToReject.templateId}`,
        user: testUsers.approver,
        body: {
          action: 'reject',
          reason: 'Contains inappropriate content',
          notes: 'Please revise and resubmit'
        }
      });
      
      const rejectResponse = await approvalHandler(rejectEvent);
      expect(rejectResponse.statusCode).toBe(200);
      const rejectBody = JSON.parse(rejectResponse.body);
      expect(rejectBody.moderationStatus).toBe('rejected');
      
      // Verify it doesn't appear in public search
      const searchEvent = createTestEvent({
        method: 'GET',
        path: '/templates',
        queryStringParameters: {
          filter: 'public'
        }
      });
      
      const searchResponse = await listHandler(searchEvent);
      const searchBody = JSON.parse(searchResponse.body);
      
      const rejectedInPublic = searchBody.items.find(t => 
        t.templateId === templateToReject.templateId
      );
      expect(rejectedInPublic).toBeUndefined();
    });
    
    it('should require a reason when rejecting templates', async () => {
      const event = createTestEvent({
        method: 'POST',
        path: `/admin/approval/template/${testTemplates[0].templateId}`,
        user: testUsers.approver,
        body: {
          action: 'reject'
          // Missing reason
        }
      });
      
      const response = await approvalHandler(event);
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Reason is required for rejection');
    });
  });
  
  describe('Permission Management', () => {
    it('should list users with permissions correctly', async () => {
      const event = createTestEvent({
        method: 'GET',
        path: '/admin/permissions/users',
        user: testUsers.admin,
        queryStringParameters: {
          permission: 'approval'
        }
      });
      
      const response = await permissionsHandler(event);
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      // Should include our test approver
      const hasTestApprover = body.users.some(u => 
        u.userId === testUsers.approver.sub
      );
      expect(hasTestApprover).toBe(true);
    });
    
    it('should allow admin to revoke permissions', async () => {
      // First grant a permission
      const grantEvent = createTestEvent({
        method: 'POST',
        path: '/admin/permissions',
        user: testUsers.admin,
        body: {
          userId: 'temp-approver-999',
          email: 'temp@test.com',
          permission: 'approval'
        }
      });
      
      await permissionsHandler(grantEvent);
      
      // Then revoke it
      const revokeEvent = createTestEvent({
        method: 'DELETE',
        path: '/admin/permissions/temp-approver-999/approval',
        pathParameters: {
          userId: 'temp-approver-999',
          permission: 'approval'
        },
        user: testUsers.admin
      });
      
      const revokeResponse = await permissionsHandler(revokeEvent);
      expect(revokeResponse.statusCode).toBe(200);
      
      // Verify it's revoked
      const listEvent = createTestEvent({
        method: 'GET',
        path: '/admin/permissions/users',
        user: testUsers.admin,
        queryStringParameters: { permission: 'approval' }
      });
      
      const listResponse = await permissionsHandler(listEvent);
      const listBody = JSON.parse(listResponse.body);
      
      const stillHasPermission = listBody.users.some(u => 
        u.userId === 'temp-approver-999'
      );
      expect(stillHasPermission).toBe(false);
    });
    
    it('should prevent users from revoking their own admin permission', async () => {
      const event = createTestEvent({
        method: 'DELETE',
        path: `/admin/permissions/${testUsers.admin.sub}/admin`,
        pathParameters: {
          userId: testUsers.admin.sub,
          permission: 'admin'
        },
        user: testUsers.admin
      });
      
      const response = await permissionsHandler(event);
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Cannot revoke your own admin permission');
    });
  });
  
  describe('Edge Cases and Security', () => {
    it('should handle approval of already approved templates gracefully', async () => {
      const approvedTemplateId = testTemplates.find(t => 
        t.moderationStatus === 'approved'
      ).templateId;
      
      const event = createTestEvent({
        method: 'POST',
        path: `/admin/approval/template/${approvedTemplateId}`,
        user: testUsers.approver,
        body: {
          action: 'approve'
        }
      });
      
      const response = await approvalHandler(event);
      expect(response.statusCode).toBe(200); // Should still succeed
      const body = JSON.parse(response.body);
      expect(body.moderationStatus).toBe('approved');
    });
    
    it('should handle non-existent template IDs', async () => {
      const event = createTestEvent({
        method: 'POST',
        path: '/admin/approval/template/non-existent-id',
        user: testUsers.approver,
        body: {
          action: 'approve'
        }
      });
      
      const response = await approvalHandler(event);
      // Will succeed but update nothing (DynamoDB behavior)
      expect(response.statusCode).toBe(200);
    });
    
    it('should validate permission types', async () => {
      const event = createTestEvent({
        method: 'POST',
        path: '/admin/permissions',
        user: testUsers.admin,
        body: {
          userId: 'test-123',
          email: 'test@test.com',
          permission: 'invalid-permission'
        }
      });
      
      const response = await permissionsHandler(event);
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Invalid permission type');
    });
  });
});

describe('Authentication Flow', () => {
  beforeAll(async () => {
    await setupTestData();
  }, 30000);
  
  afterAll(async () => {
    await cleanupTestData();
  }, 30000);
  
  it('should reject requests without authentication', async () => {
    // No user in event
    const event = createTestEvent({
      method: 'GET',
      path: '/admin/approval/queue'
    });
    
    const response = await approvalHandler(event);
    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Unauthorized');
  });
  
  it('should handle admin having both admin and approval permissions', async () => {
    // Grant approval permission to admin (who already has admin)
    await docClient.send(new PutCommand({
      TableName: process.env.USER_PERMISSIONS_TABLE,
      Item: {
        userId: testUsers.admin.sub,
        permission: 'approval',
        email: testUsers.admin.email,
        grantedBy: 'system',
        grantedAt: new Date().toISOString()
      }
    }));
    
    // Admin should be able to access approval queue
    const event = createTestEvent({
      method: 'GET',
      path: '/admin/approval/queue',
      user: testUsers.admin
    });
    
    const response = await approvalHandler(event);
    expect(response.statusCode).toBe(200);
    
    // Clean up the extra permission
    await docClient.send(new DeleteCommand({
      TableName: process.env.USER_PERMISSIONS_TABLE,
      Key: {
        userId: testUsers.admin.sub,
        permission: 'approval'
      }
    }));
  });
});