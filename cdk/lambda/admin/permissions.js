const { getUserFromEvent } = require("/opt/nodejs/auth");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  PutCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
} = require("@aws-sdk/lib-dynamodb");

// Initialize DynamoDB client
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

const USER_PERMISSIONS_TABLE = process.env.USER_PERMISSIONS_TABLE;
const ALLOWED_PERMISSIONS = ["approval", "admin"];

exports.handler = async (event) => {
  console.log("Event:", JSON.stringify(event, null, 2));

  try {
    const httpMethod = event.httpMethod;
    const path = event.path;

    // Get the current user
    const currentUser = await getUserFromEvent(event);
    if (!currentUser) {
      return {
        statusCode: 401,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Unauthorized" }),
      };
    }

    // Route based on method and path
    // Allow users to check their own permissions without admin access
    if (httpMethod === "GET" && path === "/admin/permissions/me") {
      // In local development with SAM Local, auto-grant admin to specific user
      // This is ONLY for local development and will not work in production
      if (
        process.env.AWS_SAM_LOCAL === "true" &&
        process.env.LOCAL_ADMIN_USER_ID &&
        currentUser.sub === process.env.LOCAL_ADMIN_USER_ID
      ) {
        console.log("Local development: Auto-granting admin permissions");
        return {
          statusCode: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ permissions: ["admin", "approval"] }),
        };
      }

      // Get current user's permissions from database
      return await getUserPermissions(currentUser.sub);
    }

    // Check if current user has admin permissions for other operations
    const hasAdminPermission = await checkUserPermission(
      currentUser.sub,
      "admin",
    );

    // Allow users to check their own permissions even without admin access
    if (httpMethod === "GET" && path.startsWith("/admin/permissions/user/")) {
      const userId = path.split("/").pop();
      if (userId === currentUser.sub) {
        // User checking their own permissions
        return await getUserPermissions(userId);
      }
      // Checking another user's permissions requires admin
      if (!hasAdminPermission) {
        return {
          statusCode: 403,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            error:
              "Forbidden: Admin permission required to view other users' permissions",
          }),
        };
      }
      return await getUserPermissions(userId);
    }

    // All other operations require admin permission
    if (!hasAdminPermission) {
      return {
        statusCode: 403,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Forbidden: Admin permission required" }),
      };
    }

    // Admin-only routes
    if (httpMethod === "GET" && path === "/admin/permissions/users") {
      // List all users with permissions
      return await listUsersWithPermissions(event);
    } else if (
      httpMethod === "GET" &&
      path.startsWith("/admin/permissions/user/")
    ) {
      // Get permissions for a specific user
      const userId = path.split("/").pop();
      return await getUserPermissions(userId);
    } else if (httpMethod === "POST" && path === "/admin/permissions") {
      // Grant permission to user
      return await grantPermission(event);
    } else if (
      httpMethod === "DELETE" &&
      path.startsWith("/admin/permissions/")
    ) {
      // Revoke permission from user
      const pathParts = path.split("/");
      const userId = pathParts[3];
      const permission = pathParts[4];
      return await revokePermission(userId, permission, currentUser);
    } else {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Not found" }),
      };
    }
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Internal server error",
        details: error.message,
      }),
    };
  }
};

async function checkUserPermission(userId, permission) {
  try {
    const params = {
      TableName: USER_PERMISSIONS_TABLE,
      Key: {
        userId,
        permission,
      },
    };

    const response = await docClient.send(
      new QueryCommand({
        TableName: USER_PERMISSIONS_TABLE,
        KeyConditionExpression:
          "userId = :userId AND #permission = :permission",
        ExpressionAttributeNames: {
          "#permission": "permission",
        },
        ExpressionAttributeValues: {
          ":userId": userId,
          ":permission": permission,
        },
      }),
    );

    return response.Items && response.Items.length > 0;
  } catch (error) {
    console.error("Error checking permission:", error);
    return false;
  }
}

async function listUsersWithPermissions(event) {
  const permission = event.queryStringParameters?.permission;

  if (permission && !ALLOWED_PERMISSIONS.includes(permission)) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Invalid permission type" }),
    };
  }

  try {
    let params;
    if (permission) {
      // Query by specific permission
      params = {
        TableName: USER_PERMISSIONS_TABLE,
        IndexName: "permission-userId-index",
        KeyConditionExpression: "#permission = :permission",
        ExpressionAttributeNames: {
          "#permission": "permission",
        },
        ExpressionAttributeValues: {
          ":permission": permission,
        },
      };
    } else {
      // Scan all permissions
      params = {
        TableName: USER_PERMISSIONS_TABLE,
      };
    }

    const response = await docClient.send(
      permission ? new QueryCommand(params) : new ScanCommand(params),
    );

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        users: response.Items || [],
      }),
    };
  } catch (error) {
    console.error("Error listing users:", error);
    throw error;
  }
}

async function getUserPermissions(userId) {
  try {
    const params = {
      TableName: USER_PERMISSIONS_TABLE,
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": userId,
      },
    };

    const response = await docClient.send(new QueryCommand(params));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        permissions: response.Items?.map((item) => item.permission) || [],
      }),
    };
  } catch (error) {
    console.error("Error getting user permissions:", error);
    throw error;
  }
}

async function grantPermission(event) {
  const body = JSON.parse(event.body);
  const { userId, permission, grantedBy } = body;

  if (!userId || !permission) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "userId and permission are required" }),
    };
  }

  if (!ALLOWED_PERMISSIONS.includes(permission)) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Invalid permission type" }),
    };
  }

  try {
    const params = {
      TableName: USER_PERMISSIONS_TABLE,
      Item: {
        userId,
        permission,
        grantedAt: new Date().toISOString(),
        grantedBy: grantedBy || "system",
      },
    };

    await docClient.send(new PutCommand(params));

    return {
      statusCode: 201,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Permission granted successfully",
        userId,
        permission,
      }),
    };
  } catch (error) {
    console.error("Error granting permission:", error);
    throw error;
  }
}

async function revokePermission(userId, permission, currentUser) {
  if (!userId || !permission) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "userId and permission are required" }),
    };
  }

  // Prevent users from revoking their own admin permission
  if (userId === currentUser.sub && permission === "admin") {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Cannot revoke your own admin permission",
      }),
    };
  }

  try {
    const params = {
      TableName: USER_PERMISSIONS_TABLE,
      Key: {
        userId,
        permission,
      },
    };

    await docClient.send(new DeleteCommand(params));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Permission revoked successfully",
        userId,
        permission,
      }),
    };
  } catch (error) {
    console.error("Error revoking permission:", error);
    throw error;
  }
}

// Export checkUserPermission for use in other Lambda functions
exports.checkUserPermission = checkUserPermission;
