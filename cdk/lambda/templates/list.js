const { QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const {
  docClient,
  createResponse,
  getUserIdFromEvent,
} = require('./utils');

exports.handler = async (event) => {
  try {
    // Get user ID from authorizer (might be null for public access)
    const userId = getUserIdFromEvent(event);
    
    // Parse query parameters
    const {
      filter = 'public', // public, mine, all
      tag,
      search,
      limit = '20',
      nextToken: nextTokenParam,
      sortBy = 'createdAt', // createdAt, viewCount, useCount
      sortOrder = 'desc', // asc, desc
    } = event.queryStringParameters || {};

    const limitNum = Math.min(parseInt(limit), 100); // Max 100 items

    let params;
    let items = [];
    let nextToken = nextTokenParam;

    // Build query based on filter
    if (filter === 'mine' && userId) {
      // Get user's own templates
      params = {
        TableName: process.env.TEMPLATES_TABLE,
        IndexName: 'userId-createdAt-index',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId,
        },
        Limit: limitNum,
        ScanIndexForward: sortOrder === 'asc',
      };
      
      if (nextToken) {
        params.ExclusiveStartKey = JSON.parse(Buffer.from(nextToken, 'base64').toString());
      }

      const result = await docClient.send(new QueryCommand(params));
      items = result.Items || [];
      
      if (result.LastEvaluatedKey) {
        nextToken = Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64');
      } else {
        nextToken = null;
      }

    } else if (filter === 'public') {
      // Get public approved templates
      params = {
        TableName: process.env.TEMPLATES_TABLE,
        IndexName: 'visibility-moderationStatus-index',
        KeyConditionExpression: 'visibility = :visibility AND moderationStatus = :status',
        ExpressionAttributeValues: {
          ':visibility': 'public',
          ':status': 'approved',
        },
        Limit: limitNum,
        ScanIndexForward: sortOrder === 'asc',
      };

      if (nextToken) {
        params.ExclusiveStartKey = JSON.parse(Buffer.from(nextToken, 'base64').toString());
      }

      const result = await docClient.send(new QueryCommand(params));
      items = result.Items || [];
      
      if (result.LastEvaluatedKey) {
        nextToken = Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64');
      } else {
        nextToken = null;
      }

    } else if (filter === 'all' && userId) {
      // Get all templates user has access to
      // This is more complex and would need multiple queries
      // For now, we'll get public + user's own
      
      // Get public templates
      const publicParams = {
        TableName: process.env.TEMPLATES_TABLE,
        IndexName: 'visibility-moderationStatus-index',
        KeyConditionExpression: 'visibility = :visibility AND moderationStatus = :status',
        ExpressionAttributeValues: {
          ':visibility': 'public',
          ':status': 'approved',
        },
        Limit: Math.floor(limitNum / 2),
      };

      // Get user's templates
      const userParams = {
        TableName: process.env.TEMPLATES_TABLE,
        IndexName: 'userId-createdAt-index',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId,
        },
        Limit: Math.floor(limitNum / 2),
      };

      const [publicResult, userResult] = await Promise.all([
        docClient.send(new QueryCommand(publicParams)),
        docClient.send(new QueryCommand(userParams)),
      ]);

      // Combine and deduplicate
      const allItems = [...(publicResult.Items || []), ...(userResult.Items || [])];
      const uniqueItems = Array.from(
        new Map(allItems.map(item => [item.templateId, item])).values()
      );
      
      items = uniqueItems.slice(0, limitNum);
    }

    // Filter by tag if provided
    if (tag && items.length > 0) {
      items = items.filter(item => 
        item.tags && item.tags.includes(tag.toLowerCase())
      );
    }

    // Search filter (basic implementation - in production, use OpenSearch)
    if (search && items.length > 0) {
      const searchLower = search.toLowerCase();
      items = items.filter(item => 
        item.title.toLowerCase().includes(searchLower) ||
        (item.tags && item.tags.some(t => t.includes(searchLower)))
      );
    }

    // Sort items if not using index sort
    if (sortBy !== 'createdAt') {
      items.sort((a, b) => {
        const aVal = a[sortBy] || 0;
        const bVal = b[sortBy] || 0;
        return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
      });
    }

    // Prepare response items
    const responseItems = items.map(item => ({
      templateId: item.templateId,
      title: item.title,
      tags: item.tags,
      visibility: item.visibility,
      authorEmail: item.authorEmail,
      createdAt: item.createdAt,
      viewCount: item.viewCount || 0,
      useCount: item.useCount || 0,
      variableCount: item.variables?.length || 0,
      isOwner: userId && item.userId === userId,
    }));

    return createResponse(200, {
      items: responseItems,
      nextToken,
      count: responseItems.length,
    });

  } catch (error) {
    console.error('Error listing templates:', error);
    return createResponse(500, { 
      error: 'Internal server error',
      message: process.env.ENVIRONMENT === 'development' ? error.message : undefined,
    });
  }
};