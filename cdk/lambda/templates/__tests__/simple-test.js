// Simple test to check imports
describe("Simple Import Test", () => {
  it("should import AWS SDK correctly", () => {
    try {
      const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
      console.log("DynamoDBClient:", DynamoDBClient);
      console.log("DynamoDBClient constructor:", typeof DynamoDBClient);

      const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");
      console.log("DynamoDBDocumentClient:", DynamoDBDocumentClient);
      console.log(
        "DynamoDBDocumentClient.from:",
        typeof DynamoDBDocumentClient.from,
      );

      expect(DynamoDBClient).toBeDefined();
      expect(DynamoDBDocumentClient).toBeDefined();
    } catch (error) {
      console.error("Import error:", error);
      throw error;
    }
  });
});
