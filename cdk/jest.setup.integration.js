// Setup for integration tests - NO MOCKS, real AWS clients
// Set up environment variables for integration tests
process.env.AWS_ENDPOINT_URL_DYNAMODB = "http://localhost:8000";
process.env.AWS_REGION = "us-east-1";
process.env.AWS_ACCESS_KEY_ID = "test";
process.env.AWS_SECRET_ACCESS_KEY = "test";
process.env.CI = "true";
process.env.AWS_SAM_LOCAL = "true";

// For integration tests, we don't mock anything except the cache layer
// The tests will create real AWS SDK clients

// Mock the cache module for integration tests since Redis isn't available in CI
jest.mock('/opt/nodejs/cache', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(true),
  clear: jest.fn().mockResolvedValue(undefined),
  clearPattern: jest.fn().mockResolvedValue(undefined),
  getMetrics: jest.fn().mockReturnValue({
    hits: 0,
    misses: 0,
    sets: 0,
    evictions: 0,
    hitRate: '0%',
    size: 0,
    memorySizeMB: '0.00'
  }),
  keyGenerators: {
    templateList: jest.fn((params) => `templates:list:${JSON.stringify(params)}`),
    template: jest.fn((id) => `templates:get:${id}`),
    userTemplates: jest.fn((userId) => `templates:user:${userId}`),
    search: jest.fn((query, limit) => `search:${query}:${limit}`),
    popular: jest.fn((limit) => `templates:popular:${limit}`)
  },
  DEFAULT_TTL: 300000,
  POPULAR_TTL: 1800000,
  USER_TTL: 60000
}));
