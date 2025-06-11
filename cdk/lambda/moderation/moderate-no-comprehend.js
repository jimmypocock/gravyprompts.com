const { UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const crypto = require('crypto');
const {
  docClient,
  stripHtml,
} = require('utils');

/**
 * Simple content moderation without AWS Comprehend
 * This version performs basic checks and auto-approves most content
 * You can enhance this with your own moderation logic
 */

// Basic list of inappropriate words (you can expand this)
const BLOCKED_WORDS = [
  // Add words you want to block here
  // This is just a basic example
];

// Basic content checking without external APIs
function checkContent(title, content) {
  const fullText = `${title} ${stripHtml(content)}`.toLowerCase();
  
  // Check for blocked words
  for (const word of BLOCKED_WORDS) {
    if (fullText.includes(word.toLowerCase())) {
      return {
        status: 'rejected',
        reason: 'Inappropriate content detected',
      };
    }
  }
  
  // Check for excessive caps (potential spam)
  const upperCaseRatio = (fullText.match(/[A-Z]/g) || []).length / fullText.length;
  if (upperCaseRatio > 0.7 && fullText.length > 20) {
    return {
      status: 'review',
      reason: 'Excessive capitalization detected',
    };
  }
  
  // Check for repetitive content (potential spam)
  const words = fullText.split(/\s+/);
  const uniqueWords = new Set(words);
  if (words.length > 10 && uniqueWords.size < words.length * 0.3) {
    return {
      status: 'review',
      reason: 'Repetitive content detected',
    };
  }
  
  // Default: approve
  return {
    status: 'approved',
    reason: 'Passed basic content checks',
  };
}

exports.handler = async (event) => {
  console.log('Content moderation event received (Comprehend-free version):', {
    recordCount: event.Records.length,
    eventName: event.Records.map(r => r.eventName),
  });
  
  // Process DynamoDB stream records
  for (const record of event.Records) {
    try {
      console.log('Processing record:', {
        eventName: record.eventName,
        eventID: record.eventID,
      });

      if (record.eventName === 'INSERT' || record.eventName === 'MODIFY') {
        const newImage = record.dynamodb.NewImage;
        const oldImage = record.dynamodb.OldImage;
        
        // Only process public templates
        if (newImage.visibility?.S !== 'public') {
          console.log('Skipping non-public template');
          continue;
        }
        
        const templateId = newImage.templateId.S;
        const content = newImage.content.S;
        const title = newImage.title.S;
        
        // Skip if this is a moderation update (prevent loops)
        const isModificationUpdate = record.eventName === 'MODIFY' && 
          newImage.moderatedAt?.S && 
          (!oldImage?.moderatedAt?.S || newImage.moderatedAt.S !== oldImage.moderatedAt.S);
          
        if (isModificationUpdate) {
          console.log(`Skipping template ${templateId} - this is a moderation update`);
          continue;
        }
        
        // Skip if already has moderation status
        const currentModerationStatus = newImage.moderationStatus?.S;
        if (currentModerationStatus && currentModerationStatus !== 'pending') {
          console.log(`Skipping template ${templateId} - already has moderation status: ${currentModerationStatus}`);
          continue;
        }
        
        // Create content hash
        const contentHash = crypto.createHash('md5')
          .update(`${title}::${content}`)
          .digest('hex');
        
        console.log(`Moderating template ${templateId} with basic checks`);
        
        try {
          // Perform basic content check
          const moderationResult = checkContent(title, content);
          
          // Update template with moderation results
          await docClient.send(new UpdateCommand({
            TableName: process.env.TEMPLATES_TABLE,
            Key: { templateId },
            UpdateExpression: 'SET moderationStatus = :status, moderationDetails = :details, moderatedAt = :moderatedAt, #contentHash = :contentHash',
            ExpressionAttributeNames: {
              '#contentHash': 'contentHash',
            },
            ExpressionAttributeValues: {
              ':status': moderationResult.status,
              ':details': {
                method: 'basic-checks',
                reason: moderationResult.reason,
                moderatedAt: new Date().toISOString(),
                moderationVersion: 'no-comprehend-1.0',
              },
              ':moderatedAt': new Date().toISOString(),
              ':contentHash': contentHash,
            },
            // Only update if content hash is different (prevents re-moderation)
            ConditionExpression: 'attribute_not_exists(#contentHash) OR #contentHash <> :contentHash',
            ReturnValues: 'ALL_NEW',
          }));
          
          console.log(`Successfully moderated template ${templateId}: ${moderationResult.status}`);
          
        } catch (error) {
          if (error.name === 'ConditionalCheckFailedException') {
            console.log(`Template ${templateId} was already processed`);
          } else {
            console.error(`Error moderating template ${templateId}:`, error);
          }
        }
      }
    } catch (recordError) {
      console.error('Error processing record:', {
        error: recordError.message,
        eventName: record.eventName,
        eventID: record.eventID,
      });
      // Continue processing other records even if one fails
    }
  }
  
  return { statusCode: 200 };
};