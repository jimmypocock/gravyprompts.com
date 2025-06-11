const { UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const crypto = require('crypto');
const {
  docClient,
} = require('utils');

/**
 * TEMPORARY SIMPLE MODERATION LAMBDA
 * This version auto-approves all public templates to avoid infinite loops and API costs
 * Replace with moderate-fixed.js when ready to re-enable content moderation
 */

exports.handler = async (event) => {
  console.log('Simple moderation event received:', {
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
        
        // CRITICAL: Skip if this is a moderation update
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
        
        console.log(`Auto-approving template ${templateId}`);
        
        try {
          // Auto-approve the template
          await docClient.send(new UpdateCommand({
            TableName: process.env.TEMPLATES_TABLE,
            Key: { templateId },
            UpdateExpression: 'SET moderationStatus = :status, moderationDetails = :details, moderatedAt = :moderatedAt, #contentHash = :contentHash',
            ExpressionAttributeNames: {
              '#contentHash': 'contentHash',
            },
            ExpressionAttributeValues: {
              ':status': 'approved',
              ':details': {
                autoApproved: true,
                reason: 'Temporary auto-approval while moderation is being fixed',
                moderatedAt: new Date().toISOString(),
                moderationVersion: 'simple-1.0',
              },
              ':moderatedAt': new Date().toISOString(),
              ':contentHash': contentHash,
            },
            // Only update if content hash is different
            ConditionExpression: 'attribute_not_exists(#contentHash) OR #contentHash <> :contentHash',
            ReturnValues: 'ALL_NEW',
          }));
          
          console.log(`Successfully auto-approved template ${templateId}`);
          
        } catch (error) {
          if (error.name === 'ConditionalCheckFailedException') {
            console.log(`Template ${templateId} was already processed`);
          } else {
            console.error(`Error auto-approving template ${templateId}:`, error);
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