const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  QueryCommand,
} = require("@aws-sdk/lib-dynamodb");
const { getUserFromEvent } = require("/opt/nodejs/auth");

// Initialize DynamoDB client
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Get table name from environment
const TABLE_NAME = process.env.USER_PROMPTS_TABLE || "user-prompts";

exports.handler = async (event) => {
  console.log("List prompts event:", JSON.stringify(event, null, 2));

  try {
    // Extract user information from event
    const user = await getUserFromEvent(event);
    if (!user || !user.sub) {
      return {
        statusCode: 401,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ error: "Unauthorized" }),
      };
    }

    const userId = user.sub;

    // Parse query parameters
    const rawLimit = parseInt(event.queryStringParameters?.limit);
    const limit = (rawLimit > 0 ? rawLimit : null) || 20;

    let lastEvaluatedKey;
    if (event.queryStringParameters?.lastKey) {
      try {
        lastEvaluatedKey = JSON.parse(
          decodeURIComponent(event.queryStringParameters.lastKey),
        );
      } catch (e) {
        // Ignore invalid lastKey
        console.warn("Invalid lastKey parameter:", e.message);
      }
    }

    // Query user's prompts
    const params = {
      TableName: TABLE_NAME,
      IndexName: "userId-createdAt-index",
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": userId,
      },
      ScanIndexForward: false, // Most recent first
      Limit: limit,
    };

    if (lastEvaluatedKey) {
      params.ExclusiveStartKey = lastEvaluatedKey;
    }

    const result = await docClient.send(new QueryCommand(params));

    console.log(
      `Found ${result.Items?.length || 0} prompts for user ${userId}`,
    );

    const response = {
      items: result.Items || [],
      count: result.Items?.length || 0,
    };

    if (result.LastEvaluatedKey) {
      response.lastKey = encodeURIComponent(
        JSON.stringify(result.LastEvaluatedKey),
      );
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error("Error listing prompts:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: "Failed to list prompts" }),
    };
  }
};
