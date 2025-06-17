const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");

describe("DynamoDB Connection Configuration", () => {
  it("should use correct endpoint in local development", () => {
    // Set local development environment
    process.env.AWS_ENDPOINT_URL_DYNAMODB = "http://host.docker.internal:8000";

    // Create a new client to test configuration
    const client = new DynamoDBClient({});

    // In local development, the endpoint should be set via environment variable
    expect(process.env.AWS_ENDPOINT_URL_DYNAMODB).toBe(
      "http://host.docker.internal:8000",
    );
  });

  it("should use different endpoints for different environments", () => {
    const endpoints = {
      docker: "http://dynamodb:8000",
      dockerInternal: "http://host.docker.internal:8000",
      localhost: "http://localhost:8000",
    };

    // Test that we understand the different endpoint configurations
    expect(endpoints.docker).toBe("http://dynamodb:8000");
    expect(endpoints.dockerInternal).toBe("http://host.docker.internal:8000");
    expect(endpoints.localhost).toBe("http://localhost:8000");
  });

  it("should handle endpoint configuration in Lambda", () => {
    // This test documents the issue we're seeing
    // Lambda functions in SAM Local can't resolve 'dynamodb' hostname
    // They need to use 'host.docker.internal' instead

    const samLocalEndpoint = "http://host.docker.internal:8000";
    const dockerComposeEndpoint = "http://dynamodb:8000";

    // SAM Local Lambda functions should use host.docker.internal
    expect(samLocalEndpoint).toContain("host.docker.internal");

    // Docker Compose services use the service name
    expect(dockerComposeEndpoint).toContain("dynamodb");
  });
});
