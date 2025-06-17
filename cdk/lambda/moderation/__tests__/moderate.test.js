const { createMockDocClient } = require('../../../test-utils/dynamodb-mock');

// Create mock client before mocking
const mockDocClient = createMockDocClient();

// Mock the utils module
jest.mock('/opt/nodejs/utils', () => ({
  docClient: mockDocClient,
  stripHtml: jest.fn((html) => html.replace(/<[^>]*>/g, ''))
}));

// Mock DynamoDB
jest.mock('@aws-sdk/lib-dynamodb', () => ({
  UpdateCommand: jest.fn((params) => params)
}));

// Now require the handler
const { handler } = require('../moderate');

describe('Moderation Lambda', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDocClient.mockSend.mockReset();
    process.env.TEMPLATES_TABLE = 'test-templates';
    
    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.log.mockRestore();
    console.error.mockRestore();
  });

  describe('Basic functionality', () => {
    it('should process INSERT event for public template', async () => {
      const event = {
        Records: [{
          eventName: 'INSERT',
          eventID: 'event-123',
          dynamodb: {
            NewImage: {
              templateId: { S: 'template-123' },
              title: { S: 'Clean Template' },
              content: { S: 'This is clean content' },
              visibility: { S: 'public' }
            }
          }
        }]
      };

      mockDocClient.mockSend.mockResolvedValueOnce({ Attributes: {} });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      expect(mockDocClient.mockSend).toHaveBeenCalledTimes(1);
      
      const updateCall = mockDocClient.mockSend.mock.calls[0][0];
      expect(updateCall).toMatchObject({
        TableName: 'test-templates',
        Key: { templateId: 'template-123' },
        UpdateExpression: 'SET moderationStatus = :status, moderationDetails = :details, moderatedAt = :moderatedAt, #contentHash = :contentHash',
        ExpressionAttributeValues: {
          ':status': 'approved',
          ':details': expect.objectContaining({
            method: 'basic-checks',
            reason: 'Passed basic content checks'
          })
        }
      });
    });

    it('should process MODIFY event for public template', async () => {
      const event = {
        Records: [{
          eventName: 'MODIFY',
          eventID: 'event-124',
          dynamodb: {
            OldImage: {
              templateId: { S: 'template-123' },
              title: { S: 'Old Title' },
              content: { S: 'Old content' },
              visibility: { S: 'private' }
            },
            NewImage: {
              templateId: { S: 'template-123' },
              title: { S: 'New Title' },
              content: { S: 'New content' },
              visibility: { S: 'public' }
            }
          }
        }]
      };

      mockDocClient.mockSend.mockResolvedValueOnce({ Attributes: {} });

      await handler(event);

      expect(mockDocClient.mockSend).toHaveBeenCalledTimes(1);
    });

    it('should skip private templates', async () => {
      const event = {
        Records: [{
          eventName: 'INSERT',
          eventID: 'event-125',
          dynamodb: {
            NewImage: {
              templateId: { S: 'template-123' },
              title: { S: 'Private Template' },
              content: { S: 'Private content' },
              visibility: { S: 'private' }
            }
          }
        }]
      };

      await handler(event);

      expect(mockDocClient.mockSend).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('Skipping non-public template');
    });

    it('should skip templates without visibility field', async () => {
      const event = {
        Records: [{
          eventName: 'INSERT',
          eventID: 'event-126',
          dynamodb: {
            NewImage: {
              templateId: { S: 'template-123' },
              title: { S: 'No Visibility' },
              content: { S: 'Content' }
              // No visibility field
            }
          }
        }]
      };

      await handler(event);

      expect(mockDocClient.mockSend).not.toHaveBeenCalled();
    });
  });

  describe('Content moderation logic', () => {
    it('should approve clean content', async () => {
      const event = {
        Records: [{
          eventName: 'INSERT',
          eventID: 'event-127',
          dynamodb: {
            NewImage: {
              templateId: { S: 'template-123' },
              title: { S: 'Professional Email' },
              content: { S: 'Dear {{name}}, Thank you for your business.' },
              visibility: { S: 'public' }
            }
          }
        }]
      };

      mockDocClient.mockSend.mockResolvedValueOnce({ Attributes: {} });

      await handler(event);

      const updateCall = mockDocClient.mockSend.mock.calls[0][0];
      expect(updateCall.ExpressionAttributeValues[':status']).toBe('approved');
    });

    it('should flag excessive capitalization', async () => {
      const event = {
        Records: [{
          eventName: 'INSERT',
          eventID: 'event-128',
          dynamodb: {
            NewImage: {
              templateId: { S: 'template-123' },
              title: { S: 'SHOUTING TEMPLATE' },
              content: { S: 'THIS IS ALL IN CAPS AND VERY SHOUTY!!!' },
              visibility: { S: 'public' }
            }
          }
        }]
      };

      mockDocClient.mockSend.mockResolvedValueOnce({ Attributes: {} });

      await handler(event);

      const updateCall = mockDocClient.mockSend.mock.calls[0][0];
      expect(updateCall.ExpressionAttributeValues[':status']).toBe('review');
      expect(updateCall.ExpressionAttributeValues[':details'].reason).toBe('Excessive capitalization detected');
    });

    it('should flag repetitive content', async () => {
      const event = {
        Records: [{
          eventName: 'INSERT',
          eventID: 'event-129',
          dynamodb: {
            NewImage: {
              templateId: { S: 'template-123' },
              title: { S: 'Spam Template' },
              content: { S: 'spam spam spam spam spam spam spam spam spam spam spam' },
              visibility: { S: 'public' }
            }
          }
        }]
      };

      mockDocClient.mockSend.mockResolvedValueOnce({ Attributes: {} });

      await handler(event);

      const updateCall = mockDocClient.mockSend.mock.calls[0][0];
      expect(updateCall.ExpressionAttributeValues[':status']).toBe('review');
      expect(updateCall.ExpressionAttributeValues[':details'].reason).toBe('Repetitive content detected');
    });

    it('should strip HTML before checking content', async () => {
      const event = {
        Records: [{
          eventName: 'INSERT',
          eventID: 'event-130',
          dynamodb: {
            NewImage: {
              templateId: { S: 'template-123' },
              title: { S: 'HTML Template' },
              content: { S: '<p>This is <strong>HTML</strong> content</p>' },
              visibility: { S: 'public' }
            }
          }
        }]
      };

      mockDocClient.mockSend.mockResolvedValueOnce({ Attributes: {} });

      await handler(event);

      expect(mockDocClient.mockSend).toHaveBeenCalled();
      const updateCall = mockDocClient.mockSend.mock.calls[0][0];
      expect(updateCall.ExpressionAttributeValues[':status']).toBe('approved');
    });
  });

  describe('Duplicate prevention', () => {
    it('should skip moderation updates to prevent loops', async () => {
      const event = {
        Records: [{
          eventName: 'MODIFY',
          eventID: 'event-131',
          dynamodb: {
            OldImage: {
              templateId: { S: 'template-123' },
              title: { S: 'Template' },
              content: { S: 'Content' },
              visibility: { S: 'public' }
            },
            NewImage: {
              templateId: { S: 'template-123' },
              title: { S: 'Template' },
              content: { S: 'Content' },
              visibility: { S: 'public' },
              moderatedAt: { S: '2024-01-01T00:00:00Z' },
              moderationStatus: { S: 'approved' }
            }
          }
        }]
      };

      await handler(event);

      expect(mockDocClient.mockSend).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        'Skipping template template-123 - this is a moderation update'
      );
    });

    it('should skip already moderated templates', async () => {
      const event = {
        Records: [{
          eventName: 'INSERT',
          eventID: 'event-132',
          dynamodb: {
            NewImage: {
              templateId: { S: 'template-123' },
              title: { S: 'Already Moderated' },
              content: { S: 'Content' },
              visibility: { S: 'public' },
              moderationStatus: { S: 'approved' }
            }
          }
        }]
      };

      await handler(event);

      expect(mockDocClient.mockSend).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        'Skipping template template-123 - already has moderation status: approved'
      );
    });

    it('should process templates with pending status', async () => {
      const event = {
        Records: [{
          eventName: 'INSERT',
          eventID: 'event-133',
          dynamodb: {
            NewImage: {
              templateId: { S: 'template-123' },
              title: { S: 'Pending Template' },
              content: { S: 'Content' },
              visibility: { S: 'public' },
              moderationStatus: { S: 'pending' }
            }
          }
        }]
      };

      mockDocClient.mockSend.mockResolvedValueOnce({ Attributes: {} });

      await handler(event);

      expect(mockDocClient.mockSend).toHaveBeenCalled();
    });

    it('should handle conditional check failures', async () => {
      const event = {
        Records: [{
          eventName: 'INSERT',
          eventID: 'event-134',
          dynamodb: {
            NewImage: {
              templateId: { S: 'template-123' },
              title: { S: 'Template' },
              content: { S: 'Content' },
              visibility: { S: 'public' }
            }
          }
        }]
      };

      const error = new Error('Conditional check failed');
      error.name = 'ConditionalCheckFailedException';
      mockDocClient.mockSend.mockRejectedValueOnce(error);

      await handler(event);

      expect(console.log).toHaveBeenCalledWith('Template template-123 was already processed');
    });
  });

  describe('Error handling', () => {
    it('should handle DynamoDB errors gracefully', async () => {
      const event = {
        Records: [{
          eventName: 'INSERT',
          eventID: 'event-135',
          dynamodb: {
            NewImage: {
              templateId: { S: 'template-123' },
              title: { S: 'Template' },
              content: { S: 'Content' },
              visibility: { S: 'public' }
            }
          }
        }]
      };

      mockDocClient.mockSend.mockRejectedValueOnce(new Error('DynamoDB error'));

      await handler(event);

      expect(console.error).toHaveBeenCalledWith(
        'Error moderating template template-123:',
        expect.any(Error)
      );
    });

    it('should continue processing other records on error', async () => {
      const event = {
        Records: [
          {
            eventName: 'INSERT',
            eventID: 'event-136',
            dynamodb: {
              NewImage: {
                templateId: { S: 'template-123' },
                title: { S: 'Error Template' },
                content: { S: 'Content' },
                visibility: { S: 'public' }
              }
            }
          },
          {
            eventName: 'INSERT',
            eventID: 'event-137',
            dynamodb: {
              NewImage: {
                templateId: { S: 'template-456' },
                title: { S: 'Good Template' },
                content: { S: 'Content' },
                visibility: { S: 'public' }
              }
            }
          }
        ]
      };

      mockDocClient.mockSend
        .mockRejectedValueOnce(new Error('DynamoDB error'))
        .mockResolvedValueOnce({ Attributes: {} });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      expect(mockDocClient.mockSend).toHaveBeenCalledTimes(2);
    });

    it('should handle malformed records', async () => {
      const event = {
        Records: [{
          eventName: 'INSERT',
          eventID: 'event-138',
          dynamodb: {
            NewImage: {
              // Missing required fields
              visibility: { S: 'public' }
            }
          }
        }]
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      expect(console.error).toHaveBeenCalledWith(
        'Error processing record:',
        expect.objectContaining({
          error: expect.any(String),
          eventName: 'INSERT',
          eventID: 'event-138'
        })
      );
    });
  });

  describe('Event types', () => {
    it('should ignore REMOVE events', async () => {
      const event = {
        Records: [{
          eventName: 'REMOVE',
          eventID: 'event-139',
          dynamodb: {
            OldImage: {
              templateId: { S: 'template-123' }
            }
          }
        }]
      };

      await handler(event);

      expect(mockDocClient.mockSend).not.toHaveBeenCalled();
    });

    it('should process multiple records', async () => {
      const event = {
        Records: [
          {
            eventName: 'INSERT',
            eventID: 'event-140',
            dynamodb: {
              NewImage: {
                templateId: { S: 'template-123' },
                title: { S: 'Template 1' },
                content: { S: 'Content 1' },
                visibility: { S: 'public' }
              }
            }
          },
          {
            eventName: 'INSERT',
            eventID: 'event-141',
            dynamodb: {
              NewImage: {
                templateId: { S: 'template-456' },
                title: { S: 'Template 2' },
                content: { S: 'Content 2' },
                visibility: { S: 'public' }
              }
            }
          }
        ]
      };

      mockDocClient.mockSend
        .mockResolvedValueOnce({ Attributes: {} })
        .mockResolvedValueOnce({ Attributes: {} });

      await handler(event);

      expect(mockDocClient.mockSend).toHaveBeenCalledTimes(2);
    });
  });

  describe('Content hash', () => {
    it('should create consistent content hash', async () => {
      const event = {
        Records: [{
          eventName: 'INSERT',
          eventID: 'event-142',
          dynamodb: {
            NewImage: {
              templateId: { S: 'template-123' },
              title: { S: 'Test Title' },
              content: { S: 'Test Content' },
              visibility: { S: 'public' }
            }
          }
        }]
      };

      mockDocClient.mockSend.mockResolvedValueOnce({ Attributes: {} });

      await handler(event);

      const updateCall = mockDocClient.mockSend.mock.calls[0][0];
      expect(updateCall.ExpressionAttributeValues[':contentHash']).toBeDefined();
      expect(updateCall.ExpressionAttributeValues[':contentHash']).toHaveLength(32); // MD5 hash length
    });
  });

  describe('Moderation details', () => {
    it('should include comprehensive moderation details', async () => {
      const event = {
        Records: [{
          eventName: 'INSERT',
          eventID: 'event-143',
          dynamodb: {
            NewImage: {
              templateId: { S: 'template-123' },
              title: { S: 'Test' },
              content: { S: 'Content' },
              visibility: { S: 'public' }
            }
          }
        }]
      };

      mockDocClient.mockSend.mockResolvedValueOnce({ Attributes: {} });

      await handler(event);

      const updateCall = mockDocClient.mockSend.mock.calls[0][0];
      const details = updateCall.ExpressionAttributeValues[':details'];
      
      expect(details).toMatchObject({
        method: 'basic-checks',
        reason: expect.any(String),
        moderatedAt: expect.any(String),
        moderationVersion: 'basic-1.0'
      });
    });
  });

  describe('Environment variables', () => {
    it('should use TEMPLATES_TABLE environment variable', async () => {
      process.env.TEMPLATES_TABLE = 'custom-templates-table';
      
      const event = {
        Records: [{
          eventName: 'INSERT',
          eventID: 'event-144',
          dynamodb: {
            NewImage: {
              templateId: { S: 'template-123' },
              title: { S: 'Test' },
              content: { S: 'Content' },
              visibility: { S: 'public' }
            }
          }
        }]
      };

      mockDocClient.mockSend.mockResolvedValueOnce({ Attributes: {} });

      await handler(event);

      const updateCall = mockDocClient.mockSend.mock.calls[0][0];
      expect(updateCall.TableName).toBe('custom-templates-table');
    });
  });
});