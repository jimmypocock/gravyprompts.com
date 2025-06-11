const { QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const {
  docClient,
  createResponse,
  getUserIdFromEvent,
} = require('./utils');

// Simple fuzzy matching for typos (Levenshtein distance)
function levenshteinDistance(str1, str2) {
  const matrix = [];
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[str2.length][str1.length];
}

// Check if two strings are similar (within 2 character edits)
function isFuzzyMatch(str1, str2, maxDistance = 2) {
  if (Math.abs(str1.length - str2.length) > maxDistance) return false;
  return levenshteinDistance(str1.toLowerCase(), str2.toLowerCase()) <= maxDistance;
}

exports.handler = async (event) => {
  try {
    // Get user ID from authorizer (might be null for public access)
    const userId = getUserIdFromEvent(event);
    
    // Parse query parameters
    const {
      filter = 'public', // public, mine, all, popular
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

    } else if (filter === 'public' || filter === 'popular') {
      // Check if we're in local development
      const isLocal = process.env.IS_LOCAL === 'true' || process.env.AWS_SAM_LOCAL === 'true';
      
      if (isLocal) {
        // In local development, use scan to get all public templates regardless of moderation status
        const { ScanCommand } = require('@aws-sdk/lib-dynamodb');
        params = {
          TableName: process.env.TEMPLATES_TABLE,
          FilterExpression: 'visibility = :visibility',
          ExpressionAttributeValues: {
            ':visibility': 'public',
          },
          Limit: filter === 'popular' ? limitNum * 3 : limitNum * 2, // Get more for filtering
        };
        
        const result = await docClient.send(new ScanCommand(params));
        items = result.Items || [];
        nextToken = null; // Simplify for local dev
      } else {
        // Production: Get public approved templates
        params = {
          TableName: process.env.TEMPLATES_TABLE,
          IndexName: 'visibility-moderationStatus-index',
          KeyConditionExpression: 'visibility = :visibility AND moderationStatus = :status',
          ExpressionAttributeValues: {
            ':visibility': 'public',
            ':status': 'approved',
          },
          Limit: filter === 'popular' ? limitNum * 2 : limitNum, // Get more for popular to sort
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
      }
      
      // For popular filter, force sort by useCount
      if (filter === 'popular') {
        items.sort((a, b) => (b.useCount || 0) - (a.useCount || 0));
        items = items.slice(0, limitNum);
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
      items = items.filter(item => {
        if (!item.tags) return false;
        const tags = Array.isArray(item.tags) ? item.tags : [item.tags];
        return tags.includes(tag.toLowerCase());
      });
    }

    // Enhanced search with relevance scoring
    if (search && items.length > 0) {
      const searchTerms = search.toLowerCase().split(/\s+/).filter(term => term.length > 0);
      
      // Score and filter items
      const scoredItems = items.map(item => {
        let score = 0;
        const titleLower = item.title.toLowerCase();
        const contentLower = (item.content || '').toLowerCase();
        const tags = Array.isArray(item.tags) ? item.tags : (item.tags ? [item.tags] : []);
        const tagsLower = tags.map(t => (t || '').toLowerCase()).join(' ');
        
        searchTerms.forEach(term => {
          // Title matches (highest weight)
          if (titleLower === term) score += 100; // Exact title match
          else if (titleLower.includes(term)) {
            score += 50; // Title contains term
            // Bonus for word boundary matches
            const wordBoundaryRegex = new RegExp(`\\b${term}\\b`, 'i');
            if (wordBoundaryRegex.test(item.title)) score += 25;
          } else {
            // Fuzzy match for typos in title words
            const titleWords = item.title.toLowerCase().split(/\s+/);
            for (const word of titleWords) {
              if (term.length > 3 && isFuzzyMatch(word, term, 1)) {
                score += 30; // Fuzzy match in title
                break;
              }
            }
          }
          
          // Tag matches (high weight)
          if (tags.some(tag => tag && tag.toLowerCase() === term)) score += 40; // Exact tag match
          else if (tagsLower.includes(term)) score += 20; // Tag contains term
          
          // Content matches (lower weight)
          if (contentLower.includes(term)) {
            score += 10;
            // Bonus for early matches (more relevant if term appears early)
            const position = contentLower.indexOf(term);
            if (position < 100) score += 10;
            else if (position < 300) score += 5;
            
            // Count occurrences (up to 5)
            const matches = (contentLower.match(new RegExp(term, 'g')) || []).length;
            score += Math.min(matches * 2, 10);
          }
          
          // Variable name matches
          if (item.variables && item.variables.length > 0) {
            const variablesLower = item.variables.join(' ').toLowerCase();
            if (variablesLower.includes(term)) score += 15;
          }
        });
        
        // Boost by popularity metrics
        score += Math.min(item.useCount || 0, 50) / 10; // Up to 5 points for popularity
        score += Math.min(item.viewCount || 0, 100) / 50; // Up to 2 points for views
        
        return { item, score };
      })
      .filter(({ score }) => score > 0) // Only include items with matches
      .sort((a, b) => b.score - a.score); // Sort by relevance
      
      items = scoredItems.map(({ item }) => item);
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
      content: item.content, // Include content for preview
      variables: item.variables || [], // Include variables
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