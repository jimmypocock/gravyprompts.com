const { UpdateCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { 
  DetectSentimentCommand,
  DetectToxicContentCommand,
  DetectPiiEntitiesCommand 
} = require('@aws-sdk/client-comprehend');
const crypto = require('crypto');
const {
  docClient,
  comprehendClient,
  stripHtml,
  createResponse,
} = require('/opt/nodejs/utils');

exports.handler = async (event) => {
  console.log('Moderation event received:', {
    recordCount: event.Records.length,
    eventName: event.Records.map(r => r.eventName),
  });
  
  // Process DynamoDB stream records
  for (const record of event.Records) {
    try {
      console.log('Processing record:', {
        eventName: record.eventName,
        eventID: record.eventID,
        eventSourceARN: record.eventSourceARN,
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
        
        // Create content hash to detect if content actually changed
        const contentHash = crypto.createHash('md5')
          .update(`${title}::${content}`)
          .digest('hex');
        
        // Skip if already moderated with same content
        if (record.eventName === 'MODIFY') {
          const oldContentHash = oldImage?.content?.S && oldImage?.title?.S
            ? crypto.createHash('md5')
                .update(`${oldImage.title.S}::${oldImage.content.S}`)
                .digest('hex')
            : null;
          
          const currentModerationStatus = newImage.moderationStatus?.S;
          const hasModeration = currentModerationStatus === 'approved' || 
                              currentModerationStatus === 'rejected' ||
                              currentModerationStatus === 'review';
          
          // Skip if content hasn't changed and already moderated
          if (contentHash === oldContentHash && hasModeration) {
            console.log(`Skipping template ${templateId} - content unchanged and already moderated`);
            continue;
          }
          
          // Also skip if this update was from the moderation itself
          // Check if moderatedAt was just set (within last 5 seconds)
          const moderatedAt = newImage.moderatedAt?.S;
          if (moderatedAt) {
            const moderatedTime = new Date(moderatedAt).getTime();
            const now = Date.now();
            if (now - moderatedTime < 5000) { // 5 seconds
              console.log(`Skipping template ${templateId} - just moderated ${(now - moderatedTime) / 1000}s ago`);
              continue;
            }
          }
        }
        
        console.log(`Starting moderation for template ${templateId}`, {
          eventName: record.eventName,
          contentHash,
          currentStatus: newImage.moderationStatus?.S,
          contentLength: content.length,
        });
        
        try {
          // Moderate the content
          const moderationResult = await moderateContent(title, content, templateId);
          
          console.log(`Moderation complete for template ${templateId}`, {
            status: moderationResult.status,
            sentiment: moderationResult.details?.sentiment,
          });
          
          // Update template with moderation results
          // Use conditional update to prevent race conditions
          await docClient.send(new UpdateCommand({
            TableName: process.env.TEMPLATES_TABLE,
            Key: { templateId },
            UpdateExpression: 'SET moderationStatus = :status, moderationDetails = :details, moderatedAt = :moderatedAt, #contentHash = :contentHash',
            ExpressionAttributeNames: {
              '#contentHash': 'contentHash',
            },
            ExpressionAttributeValues: {
              ':status': moderationResult.status,
              ':details': moderationResult.details,
              ':moderatedAt': new Date().toISOString(),
              ':contentHash': contentHash,
              ':expectedHash': contentHash,
            },
            // Only update if content hash matches (prevents race conditions)
            ConditionExpression: 'attribute_not_exists(#contentHash) OR #contentHash <> :expectedHash',
            ReturnValues: 'ALL_NEW',
          }));
          
          console.log(`Successfully updated moderation for template ${templateId}`);
          
          // TODO: If rejected, you might want to:
          // 1. Send notification to the user
          // 2. Log to a moderation audit trail
          // 3. Update metrics
          
        } catch (error) {
          if (error.name === 'ConditionalCheckFailedException') {
            console.log(`Template ${templateId} was already moderated for this content`);
          } else {
            console.error(`Error moderating template ${templateId}:`, error);
            
            // Mark as needing review if moderation fails
            await docClient.send(new UpdateCommand({
              TableName: process.env.TEMPLATES_TABLE,
              Key: { templateId },
              UpdateExpression: 'SET moderationStatus = :status, moderationDetails = :details',
              ExpressionAttributeValues: {
                ':status': 'review',
                ':details': {
                  error: error.message,
                  timestamp: new Date().toISOString(),
                },
              },
            }));
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

async function moderateContent(title, content, templateId) {
  // Combine title and content for analysis
  const fullText = `${title}\n\n${stripHtml(content)}`;
  
  // Limit text length for Comprehend (5000 UTF-8 bytes)
  const textForAnalysis = fullText.substring(0, 4500);
  
  console.log(`Calling Comprehend APIs for template ${templateId} (${textForAnalysis.length} chars)`);
  
  try {
    // Run all analyses in parallel
    const startTime = Date.now();
    const [sentimentResult, toxicityResult, piiResult] = await Promise.all([
      comprehendClient.send(new DetectSentimentCommand({
        Text: textForAnalysis,
        LanguageCode: 'en',
      })),
      comprehendClient.send(new DetectToxicContentCommand({
        Text: textForAnalysis,
        LanguageCode: 'en',
      })),
      comprehendClient.send(new DetectPiiEntitiesCommand({
        Text: textForAnalysis,
        LanguageCode: 'en',
      })),
    ]);
    
    const apiDuration = Date.now() - startTime;
    console.log(`Comprehend APIs completed in ${apiDuration}ms for template ${templateId}`);
    
    // Analyze results
    const moderationDetails = {
      sentiment: sentimentResult.Sentiment,
      sentimentScores: sentimentResult.SentimentScore,
      toxicityLabels: [],
      piiEntities: piiResult.Entities?.map(e => e.Type) || [],
      moderatedAt: new Date().toISOString(),
      moderationVersion: '1.1', // Updated version
      apiCallDuration: apiDuration,
    };
    
    // Process toxicity results
    if (toxicityResult.ResultList && toxicityResult.ResultList.length > 0) {
      const toxicLabels = toxicityResult.ResultList[0].Labels || [];
      moderationDetails.toxicityLabels = toxicLabels
        .filter(label => label.Score > 0.5)
        .map(label => ({
          name: label.Name,
          score: label.Score,
        }));
    }
    
    // Determine moderation status
    let status = 'approved';
    const reasons = [];
    
    // Check for high toxicity
    const highToxicity = moderationDetails.toxicityLabels.some(
      label => label.score > 0.7
    );
    if (highToxicity) {
      status = 'rejected';
      reasons.push('High toxicity detected');
    }
    
    // Check for sensitive PII
    const sensitivePII = ['SSN', 'CREDIT_DEBIT_NUMBER', 'BANK_ACCOUNT_NUMBER', 
                         'BANK_ROUTING', 'PASSPORT_NUMBER', 'DRIVER_ID'];
    const hasSensitivePII = moderationDetails.piiEntities.some(
      entity => sensitivePII.includes(entity)
    );
    if (hasSensitivePII) {
      status = 'rejected';
      reasons.push('Sensitive personal information detected');
    }
    
    // Check for medium toxicity or negative sentiment
    const mediumToxicity = moderationDetails.toxicityLabels.some(
      label => label.score > 0.5 && label.score <= 0.7
    );
    const veryNegativeSentiment = sentimentResult.SentimentScore.Negative > 0.8;
    
    if ((mediumToxicity || veryNegativeSentiment) && status === 'approved') {
      status = 'review';
      reasons.push('Requires manual review');
    }
    
    moderationDetails.moderationReasons = reasons;
    
    return {
      status,
      details: moderationDetails,
    };
    
  } catch (error) {
    console.error('Comprehend analysis error:', error);
    
    // If Comprehend fails, mark for manual review
    return {
      status: 'review',
      details: {
        error: 'Automated moderation failed',
        message: error.message,
        moderatedAt: new Date().toISOString(),
      },
    };
  }
}