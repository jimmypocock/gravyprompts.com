const { UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { 
  DetectSentimentCommand,
  DetectToxicContentCommand,
  DetectPiiEntitiesCommand 
} = require('@aws-sdk/client-comprehend');
const {
  docClient,
  comprehendClient,
  stripHtml,
  createResponse,
} = require('/opt/nodejs/utils');

exports.handler = async (event) => {
  console.log('Moderation event:', JSON.stringify(event));
  
  // Process DynamoDB stream records
  for (const record of event.Records) {
    if (record.eventName === 'INSERT' || record.eventName === 'MODIFY') {
      const newImage = record.dynamodb.NewImage;
      
      // Only process public templates
      if (newImage.visibility?.S !== 'public') {
        continue;
      }
      
      // Skip if already moderated (unless content changed)
      if (record.eventName === 'MODIFY') {
        const oldImage = record.dynamodb.OldImage;
        const contentChanged = oldImage.content?.S !== newImage.content?.S;
        const alreadyModerated = newImage.moderationStatus?.S === 'approved' || 
                               newImage.moderationStatus?.S === 'rejected';
        
        if (!contentChanged && alreadyModerated) {
          continue;
        }
      }
      
      const templateId = newImage.templateId.S;
      const content = newImage.content.S;
      const title = newImage.title.S;
      
      try {
        // Moderate the content
        const moderationResult = await moderateContent(title, content);
        
        // Update template with moderation results
        await docClient.send(new UpdateCommand({
          TableName: process.env.TEMPLATES_TABLE,
          Key: { templateId },
          UpdateExpression: 'SET moderationStatus = :status, moderationDetails = :details, moderatedAt = :moderatedAt',
          ExpressionAttributeValues: {
            ':status': moderationResult.status,
            ':details': moderationResult.details,
            ':moderatedAt': new Date().toISOString(),
          },
        }));
        
        console.log(`Moderated template ${templateId}: ${moderationResult.status}`);
        
        // TODO: If rejected, you might want to:
        // 1. Send notification to the user
        // 2. Log to a moderation audit trail
        // 3. Update metrics
        
      } catch (error) {
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
  
  return { statusCode: 200 };
};

async function moderateContent(title, content) {
  // Combine title and content for analysis
  const fullText = `${title}\n\n${stripHtml(content)}`;
  
  // Limit text length for Comprehend (5000 UTF-8 bytes)
  const textForAnalysis = fullText.substring(0, 4500);
  
  try {
    // Run all analyses in parallel
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
    
    // Analyze results
    const moderationDetails = {
      sentiment: sentimentResult.Sentiment,
      sentimentScores: sentimentResult.SentimentScore,
      toxicityLabels: [],
      piiEntities: piiResult.Entities?.map(e => e.Type) || [],
      moderatedAt: new Date().toISOString(),
      moderationVersion: '1.0',
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