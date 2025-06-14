const { getUserFromEvent } = require('/opt/nodejs/auth');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand, QueryCommand, PutCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

// Initialize DynamoDB client
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

const TEMPLATES_TABLE = process.env.TEMPLATES_TABLE;
const USER_PERMISSIONS_TABLE = process.env.USER_PERMISSIONS_TABLE;
const APPROVAL_HISTORY_TABLE = process.env.APPROVAL_HISTORY_TABLE;

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    const httpMethod = event.httpMethod;
    const path = event.path;
    
    // Get the current user
    const currentUser = await getUserFromEvent(event);
    if (!currentUser) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Unauthorized' })
      };
    }

    // Check if current user has approval permissions
    const hasApprovalPermission = await checkUserPermission(currentUser.sub, 'approval');
    const hasAdminPermission = await checkUserPermission(currentUser.sub, 'admin');
    
    if (!hasApprovalPermission && !hasAdminPermission) {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Forbidden: Approval permission required' })
      };
    }

    // Route based on method and path
    if (httpMethod === 'GET' && path === '/admin/approval/queue') {
      // Get templates pending approval
      return await getApprovalQueue(event);
    } else if (httpMethod === 'GET' && path === '/admin/approval/history') {
      // Get approval history
      return await getApprovalHistory(event);
    } else if (httpMethod === 'POST' && path.startsWith('/admin/approval/template/')) {
      // Approve or reject a template
      const templateId = path.split('/')[4];
      return await processApproval(templateId, event, currentUser);
    } else {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Not found' })
      };
    }
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error', details: error.message })
    };
  }
};

async function checkUserPermission(userId, permission) {
  try {
    const params = {
      TableName: USER_PERMISSIONS_TABLE,
      KeyConditionExpression: 'userId = :userId AND #permission = :permission',
      ExpressionAttributeNames: {
        '#permission': 'permission'
      },
      ExpressionAttributeValues: {
        ':userId': userId,
        ':permission': permission
      }
    };
    
    const response = await docClient.send(new QueryCommand(params));
    return response.Items && response.Items.length > 0;
  } catch (error) {
    console.error('Error checking permission:', error);
    return false;
  }
}

async function getApprovalQueue(event) {
  const status = event.queryStringParameters?.status || 'pending';
  const limit = parseInt(event.queryStringParameters?.limit) || 20;
  const lastEvaluatedKey = event.queryStringParameters?.lastKey ? 
    JSON.parse(Buffer.from(event.queryStringParameters.lastKey, 'base64').toString()) : undefined;

  try {
    const params = {
      TableName: TEMPLATES_TABLE,
      IndexName: 'visibility-moderationStatus-index',
      KeyConditionExpression: 'visibility = :visibility AND moderationStatus = :status',
      ExpressionAttributeValues: {
        ':visibility': 'public',
        ':status': status
      },
      Limit: limit
    };

    if (lastEvaluatedKey) {
      params.ExclusiveStartKey = lastEvaluatedKey;
    }

    const response = await docClient.send(new QueryCommand(params));
    
    const result = {
      templates: response.Items || [],
      count: response.Count || 0
    };

    if (response.LastEvaluatedKey) {
      result.lastKey = Buffer.from(JSON.stringify(response.LastEvaluatedKey)).toString('base64');
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('Error getting approval queue:', error);
    throw error;
  }
}

async function getApprovalHistory(event) {
  const templateId = event.queryStringParameters?.templateId;
  const reviewerId = event.queryStringParameters?.reviewerId;
  const limit = parseInt(event.queryStringParameters?.limit) || 50;

  try {
    let params;
    
    if (templateId) {
      // Query by template ID
      params = {
        TableName: APPROVAL_HISTORY_TABLE,
        IndexName: 'templateId-timestamp-index',
        KeyConditionExpression: 'templateId = :templateId',
        ExpressionAttributeValues: {
          ':templateId': templateId
        },
        ScanIndexForward: false, // Most recent first
        Limit: limit
      };
    } else if (reviewerId) {
      // Query by reviewer ID
      params = {
        TableName: APPROVAL_HISTORY_TABLE,
        IndexName: 'reviewerId-timestamp-index',
        KeyConditionExpression: 'reviewerId = :reviewerId',
        ExpressionAttributeValues: {
          ':reviewerId': reviewerId
        },
        ScanIndexForward: false, // Most recent first
        Limit: limit
      };
    } else {
      // Scan all (not recommended for production)
      params = {
        TableName: APPROVAL_HISTORY_TABLE,
        Limit: limit
      };
    }

    const response = await docClient.send(
      templateId || reviewerId 
        ? new QueryCommand(params)
        : new ScanCommand(params)
    );
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        history: response.Items || [],
        count: response.Count || 0
      })
    };
  } catch (error) {
    console.error('Error getting approval history:', error);
    throw error;
  }
}

async function processApproval(templateId, event, currentUser) {
  const body = JSON.parse(event.body);
  const { action, reason, notes } = body;

  if (!action || !['approve', 'reject'].includes(action)) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid action. Must be "approve" or "reject"' })
    };
  }

  if (action === 'reject' && !reason) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Reason is required for rejection' })
    };
  }

  try {
    // Update template moderation status
    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const timestamp = new Date().toISOString();

    const updateParams = {
      TableName: TEMPLATES_TABLE,
      Key: { templateId },
      UpdateExpression: 'SET moderationStatus = :status, moderationDetails = :details, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':status': newStatus,
        ':details': {
          reviewedBy: currentUser.sub,
          reviewedAt: timestamp,
          action,
          reason: reason || null,
          notes: notes || null
        },
        ':updatedAt': timestamp
      },
      ReturnValues: 'ALL_NEW'
    };

    const updateResponse = await docClient.send(new UpdateCommand(updateParams));

    // Record in approval history
    const historyParams = {
      TableName: APPROVAL_HISTORY_TABLE,
      Item: {
        historyId: uuidv4(),
        templateId,
        templateTitle: updateResponse.Attributes.title,
        templateAuthor: updateResponse.Attributes.userId,
        reviewerId: currentUser.sub,
        reviewerEmail: currentUser.email || 'unknown',
        action,
        previousStatus: updateResponse.Attributes.moderationStatus || 'pending',
        newStatus,
        reason: reason || null,
        notes: notes || null,
        timestamp
      }
    };

    await docClient.send(new PutCommand(historyParams));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Template ${action}${action === 'approve' ? 'd' : 'ed'} successfully`,
        templateId,
        moderationStatus: newStatus,
        template: updateResponse.Attributes
      })
    };
  } catch (error) {
    console.error('Error processing approval:', error);
    throw error;
  }
}