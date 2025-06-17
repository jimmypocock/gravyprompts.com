/**
 * DynamoDB Mock Utilities for Testing
 */

const createMockDocClient = () => {
  const mockSend = jest.fn();

  return {
    send: mockSend,
    mockSend,

    // Helper methods for common operations
    mockQuery: (items = []) => {
      mockSend.mockResolvedValueOnce({ Items: items });
    },

    mockGet: (item = null) => {
      mockSend.mockResolvedValueOnce({ Item: item });
    },

    mockPut: () => {
      mockSend.mockResolvedValueOnce({});
    },

    mockDelete: () => {
      mockSend.mockResolvedValueOnce({});
    },

    mockScan: (items = [], lastEvaluatedKey = null) => {
      mockSend.mockResolvedValueOnce({
        Items: items,
        ...(lastEvaluatedKey && { LastEvaluatedKey: lastEvaluatedKey }),
      });
    },

    mockError: (error) => {
      mockSend.mockRejectedValueOnce(error);
    },
  };
};

const createDynamoDBError = (code, message) => {
  const error = new Error(message);
  error.code = code;
  error.$metadata = { attempts: 1, totalRetryDelay: 0 };
  return error;
};

const createMockEvent = (overrides = {}) => {
  return {
    httpMethod: "GET",
    path: "/test",
    headers: {
      "Content-Type": "application/json",
    },
    body: null,
    queryStringParameters: null,
    pathParameters: null,
    requestContext: {
      authorizer: {},
      requestId: "test-request-id",
    },
    ...overrides,
  };
};

const createMockUser = (overrides = {}) => {
  return {
    sub: "test-user-123",
    email: "test@example.com",
    name: "Test User",
    email_verified: true,
    username: "testuser",
    ...overrides,
  };
};

module.exports = {
  createMockDocClient,
  createDynamoDBError,
  createMockEvent,
  createMockUser,
};
