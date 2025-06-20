// Setup for integration tests - NO MOCKS, real AWS clients
// Set up environment variables for integration tests
process.env.AWS_ENDPOINT_URL_DYNAMODB = "http://localhost:8000";
process.env.AWS_REGION = "us-east-1";
process.env.AWS_ACCESS_KEY_ID = "test";
process.env.AWS_SECRET_ACCESS_KEY = "test";

// For integration tests, we don't mock anything
// The tests will create real AWS SDK clients
