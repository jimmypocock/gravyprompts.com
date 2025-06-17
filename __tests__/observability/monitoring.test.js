/**
 * Monitoring & Observability Tests
 * 
 * These tests verify that the application provides proper logging, metrics,
 * health checks, and monitoring capabilities for production operations.
 */

// Mock CloudWatch and monitoring services
const mockCloudWatch = {
  putMetricData: jest.fn(),
  putLogEvents: jest.fn(),
  createLogGroup: jest.fn(),
  createLogStream: jest.fn()
};

const mockXRay = {
  captureAsyncFunc: jest.fn(),
  captureHTTPsGlobal: jest.fn(),
  createSegment: jest.fn(),
  getSegment: jest.fn()
};

jest.mock('@aws-sdk/client-cloudwatch', () => ({
  CloudWatchClient: jest.fn(() => mockCloudWatch)
}));

jest.mock('@aws-sdk/client-cloudwatch-logs', () => ({
  CloudWatchLogsClient: jest.fn(() => mockCloudWatch)
}));

jest.mock('aws-xray-sdk-core', () => mockXRay);

describe('Monitoring & Observability Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.logEntries = [];
    global.metricData = [];
    global.healthChecks = {};
  });

  describe('Logging Tests', () => {
    it('should log structured messages with proper levels', () => {
      const logger = createMockLogger();
      
      logger.info('Template retrieved successfully', {
        templateId: 'template-123',
        userId: 'user-456',
        duration: 150,
        timestamp: '2024-01-15T12:00:00Z'
      });
      
      expect(global.logEntries).toHaveLength(1);
      
      const logEntry = global.logEntries[0];
      expect(logEntry.level).toBe('INFO');
      expect(logEntry.message).toBe('Template retrieved successfully');
      expect(logEntry.metadata.templateId).toBe('template-123');
      expect(logEntry.metadata.userId).toBe('user-456');
      expect(logEntry.metadata.duration).toBe(150);
      expect(logEntry.timestamp).toBeDefined();
    });

    it('should filter sensitive information from logs', () => {
      const logger = createMockLogger();
      
      const sensitiveData = {
        templateId: 'template-123',
        userId: 'user-456',
        email: 'user@example.com',
        password: 'secretpassword123',
        token: 'jwt-token-abc123',
        creditCard: '4111-1111-1111-1111',
        ssn: '123-45-6789',
        apiKey: 'sk-abc123def456'
      };
      
      logger.info('User authentication attempt', sensitiveData);
      
      const logEntry = global.logEntries[0];
      
      // Should include safe fields
      expect(logEntry.metadata.templateId).toBe('template-123');
      expect(logEntry.metadata.userId).toBe('user-456');
      expect(logEntry.metadata.email).toBe('user@example.com');
      
      // Should filter sensitive fields
      expect(logEntry.metadata.password).toBe('[REDACTED]');
      expect(logEntry.metadata.token).toBe('[REDACTED]');
      expect(logEntry.metadata.creditCard).toBe('[REDACTED]');
      expect(logEntry.metadata.ssn).toBe('[REDACTED]');
      expect(logEntry.metadata.apiKey).toBe('[REDACTED]');
    });

    it('should include correlation IDs for request tracing', () => {
      const logger = createMockLogger();
      const correlationId = 'corr-123-456-789';
      
      logger.setCorrelationId(correlationId);
      logger.info('Processing template request');
      
      const logEntry = global.logEntries[0];
      expect(logEntry.correlationId).toBe(correlationId);
      expect(logEntry.metadata.traceId).toBeDefined();
    });

    it('should log errors with stack traces', () => {
      const logger = createMockLogger();
      
      const error = new Error('Database connection failed');
      error.stack = 'Error: Database connection failed\n    at Function.connect\n    at processTemplates';
      
      logger.error('Failed to retrieve template', error, {
        templateId: 'template-123',
        operation: 'get'
      });
      
      const logEntry = global.logEntries[0];
      expect(logEntry.level).toBe('ERROR');
      expect(logEntry.error.message).toBe('Database connection failed');
      expect(logEntry.error.stack).toContain('at Function.connect');
      expect(logEntry.metadata.templateId).toBe('template-123');
    });

    it('should use appropriate log levels', () => {
      const logger = createMockLogger();
      
      // Different log levels
      logger.debug('Debug information', { detail: 'verbose' });
      logger.info('User action completed');
      logger.warn('Rate limit approaching', { currentRate: 90, limit: 100 });
      logger.error('Operation failed', new Error('Test error'));
      logger.fatal('Critical system failure', new Error('Fatal error'));
      
      expect(global.logEntries).toHaveLength(5);
      expect(global.logEntries[0].level).toBe('DEBUG');
      expect(global.logEntries[1].level).toBe('INFO');
      expect(global.logEntries[2].level).toBe('WARN');
      expect(global.logEntries[3].level).toBe('ERROR');
      expect(global.logEntries[4].level).toBe('FATAL');
    });

    it('should respect log level filtering', () => {
      const logger = createMockLogger({ level: 'WARN' });
      
      logger.debug('Debug message'); // Should be filtered
      logger.info('Info message');   // Should be filtered
      logger.warn('Warning message'); // Should be logged
      logger.error('Error message'); // Should be logged
      
      expect(global.logEntries).toHaveLength(2);
      expect(global.logEntries[0].level).toBe('WARN');
      expect(global.logEntries[1].level).toBe('ERROR');
    });
  });

  describe('Metrics Collection Tests', () => {
    it('should collect application performance metrics', () => {
      const metrics = createMockMetrics();
      
      // Simulate API request metrics
      metrics.incrementCounter('api.requests.total', {
        method: 'GET',
        endpoint: '/templates',
        status: '200'
      });
      
      metrics.recordTimer('api.request.duration', 150, {
        method: 'GET',
        endpoint: '/templates'
      });
      
      metrics.recordGauge('api.active_connections', 45);
      
      expect(global.metricData).toHaveLength(3);
      
      const counterMetric = global.metricData.find(m => m.name === 'api.requests.total');
      expect(counterMetric.value).toBe(1);
      expect(counterMetric.tags.method).toBe('GET');
      expect(counterMetric.tags.status).toBe('200');
      
      const timerMetric = global.metricData.find(m => m.name === 'api.request.duration');
      expect(timerMetric.value).toBe(150);
      
      const gaugeMetric = global.metricData.find(m => m.name === 'api.active_connections');
      expect(gaugeMetric.value).toBe(45);
    });

    it('should collect business metrics', () => {
      const metrics = createMockMetrics();
      
      // Template-related business metrics
      metrics.incrementCounter('templates.created');
      metrics.incrementCounter('templates.viewed', { templateId: 'template-123' });
      metrics.incrementCounter('templates.shared', { method: 'email' });
      metrics.recordGauge('templates.total_count', 1250);
      metrics.recordGauge('users.active_monthly', 450);
      
      expect(global.metricData).toHaveLength(5);
      
      const createdMetric = global.metricData.find(m => m.name === 'templates.created');
      expect(createdMetric.value).toBe(1);
      
      const totalCountMetric = global.metricData.find(m => m.name === 'templates.total_count');
      expect(totalCountMetric.value).toBe(1250);
    });

    it('should collect infrastructure metrics', () => {
      const metrics = createMockMetrics();
      
      // Lambda metrics
      metrics.recordGauge('lambda.duration', 2500, { function: 'template-list' });
      metrics.recordGauge('lambda.memory_used', 128, { function: 'template-list' });
      metrics.incrementCounter('lambda.cold_starts', { function: 'template-list' });
      
      // DynamoDB metrics
      metrics.recordTimer('dynamodb.query.duration', 45, { table: 'templates' });
      metrics.incrementCounter('dynamodb.throttled_requests', { table: 'templates' });
      metrics.recordGauge('dynamodb.consumed_read_capacity', 15.5, { table: 'templates' });
      
      expect(global.metricData).toHaveLength(6);
      
      const lambdaDuration = global.metricData.find(m => m.name === 'lambda.duration');
      expect(lambdaDuration.value).toBe(2500);
      expect(lambdaDuration.tags.function).toBe('template-list');
      
      const dbCapacity = global.metricData.find(m => m.name === 'dynamodb.consumed_read_capacity');
      expect(dbCapacity.value).toBe(15.5);
    });

    it('should batch metrics for efficient transmission', () => {
      const metrics = createMockMetrics({ batchSize: 3 });
      
      // Add multiple metrics
      for (let i = 0; i < 5; i++) {
        metrics.incrementCounter('test.metric', { iteration: i });
      }
      
      // Should batch metrics and send when batch size reached
      expect(mockCloudWatch.putMetricData).toHaveBeenCalledTimes(2); // 3 + 2 metrics
    });

    it('should handle metric collection errors gracefully', () => {
      const metrics = createMockMetrics();
      
      // Mock CloudWatch error
      mockCloudWatch.putMetricData.mockRejectedValueOnce(new Error('CloudWatch unavailable'));
      
      // Should not throw when metric submission fails
      expect(() => {
        metrics.incrementCounter('test.metric');
        metrics.flush(); // Force send
      }).not.toThrow();
      
      // Should log the error
      const logEntry = global.logEntries.find(e => e.level === 'ERROR');
      expect(logEntry).toBeDefined();
      expect(logEntry.message).toContain('metric submission failed');
    });
  });

  describe('Health Check Tests', () => {
    it('should provide comprehensive health status', async () => {
      const healthChecker = createMockHealthChecker();
      
      const healthStatus = await healthChecker.getHealth();
      
      expect(healthStatus.status).toBe('healthy');
      expect(healthStatus.timestamp).toBeDefined();
      expect(healthStatus.uptime).toBeGreaterThan(0);
      expect(healthStatus.version).toBeDefined();
      expect(healthStatus.environment).toBeDefined();
      
      expect(healthStatus.checks).toHaveProperty('database');
      expect(healthStatus.checks).toHaveProperty('external_services');
      expect(healthStatus.checks).toHaveProperty('memory');
      expect(healthStatus.checks).toHaveProperty('disk');
    });

    it('should check database connectivity', async () => {
      const healthChecker = createMockHealthChecker();
      
      // Mock successful database check
      global.healthChecks.database = { status: 'healthy', responseTime: 25 };
      
      const dbHealth = await healthChecker.checkDatabase();
      
      expect(dbHealth.status).toBe('healthy');
      expect(dbHealth.responseTime).toBeLessThan(100);
      expect(dbHealth.lastChecked).toBeDefined();
    });

    it('should detect unhealthy database connection', async () => {
      const healthChecker = createMockHealthChecker();
      
      // Mock database connection failure
      global.healthChecks.database = { 
        status: 'unhealthy', 
        error: 'Connection timeout',
        responseTime: 5000
      };
      
      const dbHealth = await healthChecker.checkDatabase();
      
      expect(dbHealth.status).toBe('unhealthy');
      expect(dbHealth.error).toBe('Connection timeout');
      expect(dbHealth.responseTime).toBeGreaterThan(1000);
    });

    it('should check external service dependencies', async () => {
      const healthChecker = createMockHealthChecker();
      
      const externalHealth = await healthChecker.checkExternalServices();
      
      expect(externalHealth).toHaveProperty('cognito');
      expect(externalHealth).toHaveProperty('s3');
      expect(externalHealth).toHaveProperty('cloudwatch');
      
      Object.values(externalHealth).forEach(service => {
        expect(service).toHaveProperty('status');
        expect(service).toHaveProperty('responseTime');
        expect(['healthy', 'unhealthy', 'degraded']).toContain(service.status);
      });
    });

    it('should monitor system resources', async () => {
      const healthChecker = createMockHealthChecker();
      
      const resourceHealth = await healthChecker.checkResources();
      
      expect(resourceHealth.memory.usage).toBeLessThan(90); // Under 90% usage
      expect(resourceHealth.memory.available).toBeGreaterThan(0);
      
      expect(resourceHealth.disk.usage).toBeLessThan(85); // Under 85% usage
      expect(resourceHealth.disk.available).toBeGreaterThan(0);
      
      expect(resourceHealth.cpu.usage).toBeLessThan(80); // Under 80% usage
    });

    it('should provide readiness and liveness probes', async () => {
      const healthChecker = createMockHealthChecker();
      
      // Readiness - can serve traffic
      const readiness = await healthChecker.checkReadiness();
      expect(readiness.ready).toBe(true);
      expect(readiness.checks).toHaveProperty('database');
      expect(readiness.checks).toHaveProperty('configuration');
      
      // Liveness - process is alive
      const liveness = await healthChecker.checkLiveness();
      expect(liveness.alive).toBe(true);
      expect(liveness.timestamp).toBeDefined();
    });

    it('should handle partial service degradation', async () => {
      const healthChecker = createMockHealthChecker();
      
      // Mock partial failure
      global.healthChecks.s3 = { status: 'unhealthy', error: 'Service unavailable' };
      global.healthChecks.database = { status: 'healthy', responseTime: 30 };
      
      const healthStatus = await healthChecker.getHealth();
      
      expect(healthStatus.status).toBe('degraded');
      expect(healthStatus.checks.s3.status).toBe('unhealthy');
      expect(healthStatus.checks.database.status).toBe('healthy');
    });
  });

  describe('Alerting Tests', () => {
    it('should trigger alerts for high error rates', () => {
      const alertManager = createMockAlertManager();
      
      // Simulate high error rate
      const errorRate = 0.15; // 15% error rate
      const threshold = 0.10; // 10% threshold
      
      const alert = alertManager.checkErrorRate(errorRate, threshold);
      
      expect(alert.triggered).toBe(true);
      expect(alert.severity).toBe('critical');
      expect(alert.message).toContain('Error rate exceeds threshold');
      expect(alert.metadata.current_rate).toBe(0.15);
      expect(alert.metadata.threshold).toBe(0.10);
    });

    it('should trigger alerts for slow response times', () => {
      const alertManager = createMockAlertManager();
      
      // Simulate slow response times
      const avgResponseTime = 3500; // 3.5 seconds
      const threshold = 2000; // 2 second threshold
      
      const alert = alertManager.checkResponseTime(avgResponseTime, threshold);
      
      expect(alert.triggered).toBe(true);
      expect(alert.severity).toBe('warning');
      expect(alert.message).toContain('Response time exceeds threshold');
      expect(alert.metadata.current_time).toBe(3500);
    });

    it('should trigger alerts for resource usage', () => {
      const alertManager = createMockAlertManager();
      
      // Memory usage alert
      const memoryAlert = alertManager.checkMemoryUsage(92, 90); // 92% usage, 90% threshold
      expect(memoryAlert.triggered).toBe(true);
      expect(memoryAlert.severity).toBe('warning');
      
      // Disk usage alert
      const diskAlert = alertManager.checkDiskUsage(88, 85); // 88% usage, 85% threshold
      expect(diskAlert.triggered).toBe(true);
      expect(diskAlert.severity).toBe('critical');
      
      // CPU usage within limits
      const cpuAlert = alertManager.checkCpuUsage(75, 80); // 75% usage, 80% threshold
      expect(cpuAlert.triggered).toBe(false);
    });

    it('should prevent alert flooding with rate limiting', () => {
      const alertManager = createMockAlertManager({ 
        rateLimitWindow: 300, // 5 minutes
        maxAlertsPerWindow: 3 
      });
      
      // Send multiple alerts of same type
      for (let i = 0; i < 5; i++) {
        alertManager.checkErrorRate(0.15, 0.10);
      }
      
      // Should only send 3 alerts within the rate limit window
      expect(global.sentAlerts.filter(a => a.type === 'error_rate')).toHaveLength(3);
    });

    it('should escalate alerts based on severity and duration', () => {
      const alertManager = createMockAlertManager();
      
      // Initial warning alert
      let alert = alertManager.checkResponseTime(2500, 2000);
      expect(alert.severity).toBe('warning');
      
      // Simulate issue persisting for 10 minutes
      jest.advanceTimersByTime(600000);
      
      // Should escalate to critical
      alert = alertManager.checkResponseTime(2500, 2000);
      expect(alert.severity).toBe('critical');
      expect(alert.escalated).toBe(true);
    });
  });

  describe('Distributed Tracing Tests', () => {
    it('should create trace spans for operations', () => {
      const tracer = createMockTracer();
      
      const span = tracer.startSpan('template.get', {
        templateId: 'template-123',
        userId: 'user-456'
      });
      
      expect(span.operationName).toBe('template.get');
      expect(span.tags.templateId).toBe('template-123');
      expect(span.tags.userId).toBe('user-456');
      expect(span.startTime).toBeDefined();
    });

    it('should trace nested operations', () => {
      const tracer = createMockTracer();
      
      const parentSpan = tracer.startSpan('api.request');
      const childSpan = tracer.startSpan('database.query', { parent: parentSpan });
      
      expect(childSpan.parentId).toBe(parentSpan.spanId);
      expect(childSpan.traceId).toBe(parentSpan.traceId);
    });

    it('should include correlation IDs in traces', () => {
      const tracer = createMockTracer();
      const correlationId = 'corr-abc-123';
      
      const span = tracer.startSpan('template.create', {
        correlationId: correlationId
      });
      
      expect(span.tags.correlationId).toBe(correlationId);
    });

    it('should record errors in traces', () => {
      const tracer = createMockTracer();
      
      const span = tracer.startSpan('template.create');
      const error = new Error('Validation failed');
      
      span.recordError(error);
      span.finish();
      
      expect(span.error).toBe(true);
      expect(span.errorMessage).toBe('Validation failed');
      expect(span.status).toBe('error');
    });
  });

  describe('Custom Dashboard Metrics', () => {
    it('should collect metrics for business dashboards', () => {
      const dashboard = createMockDashboard();
      
      dashboard.recordTemplateMetrics({
        totalTemplates: 1250,
        publicTemplates: 800,
        privateTemplates: 450,
        templatesCreatedToday: 25,
        topTags: ['email', 'marketing', 'business'],
        averageRating: 4.2
      });
      
      const metrics = dashboard.getMetrics();
      
      expect(metrics['templates.total']).toBe(1250);
      expect(metrics['templates.public']).toBe(800);
      expect(metrics['templates.created_today']).toBe(25);
      expect(metrics['templates.average_rating']).toBe(4.2);
    });

    it('should track user engagement metrics', () => {
      const dashboard = createMockDashboard();
      
      dashboard.recordUserMetrics({
        activeUsers: 325,
        newSignups: 15,
        templatesViewed: 1200,
        templatesShared: 89,
        searchQueries: 450
      });
      
      const metrics = dashboard.getMetrics();
      
      expect(metrics['users.active']).toBe(325);
      expect(metrics['users.new_signups']).toBe(15);
      expect(metrics['engagement.views']).toBe(1200);
      expect(metrics['engagement.shares']).toBe(89);
    });
  });
});

// Helper functions for monitoring tests
function createMockLogger(config = {}) {
  const logLevel = config.level || 'DEBUG';
  const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];
  const minLevelIndex = levels.indexOf(logLevel);
  
  let correlationId = null;
  
  const sensitiveFields = ['password', 'token', 'creditCard', 'ssn', 'apiKey', 'secret'];
  
  function sanitizeMetadata(metadata) {
    if (!metadata || typeof metadata !== 'object') return metadata;
    
    const sanitized = { ...metadata };
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });
    return sanitized;
  }
  
  function log(level, message, metadataOrError, additionalMetadata = {}) {
    const levelIndex = levels.indexOf(level);
    if (levelIndex < minLevelIndex) return;
    
    let metadata = additionalMetadata;
    let error = null;
    
    if (metadataOrError instanceof Error) {
      error = {
        message: metadataOrError.message,
        stack: metadataOrError.stack,
        name: metadataOrError.name
      };
    } else if (metadataOrError) {
      metadata = { ...additionalMetadata, ...metadataOrError };
    }
    
    const logEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      metadata: sanitizeMetadata(metadata),
      correlationId,
      traceId: correlationId ? `trace-${correlationId}` : undefined,
      error
    };
    
    global.logEntries.push(logEntry);
  }
  
  return {
    debug: (message, metadata) => log('DEBUG', message, metadata),
    info: (message, metadata) => log('INFO', message, metadata),
    warn: (message, metadata) => log('WARN', message, metadata),
    error: (message, error, metadata) => log('ERROR', message, error, metadata),
    fatal: (message, error, metadata) => log('FATAL', message, error, metadata),
    setCorrelationId: (id) => { correlationId = id; }
  };
}

function createMockMetrics(config = {}) {
  const batchSize = config.batchSize || 20;
  const batch = [];
  
  function submitBatch() {
    if (batch.length > 0) {
      try {
        mockCloudWatch.putMetricData({ MetricData: [...batch] });
        batch.length = 0;
      } catch (error) {
        const logger = createMockLogger();
        logger.error('CloudWatch metric submission failed', error);
      }
    }
  }
  
  function addMetric(name, value, tags = {}, type = 'counter') {
    const metric = {
      name,
      value,
      tags,
      type,
      timestamp: new Date().toISOString()
    };
    
    global.metricData.push(metric);
    batch.push(metric);
    
    if (batch.length >= batchSize) {
      submitBatch();
    }
  }
  
  return {
    incrementCounter: (name, tags = {}) => addMetric(name, 1, tags, 'counter'),
    recordTimer: (name, duration, tags = {}) => addMetric(name, duration, tags, 'timer'),
    recordGauge: (name, value, tags = {}) => addMetric(name, value, tags, 'gauge'),
    flush: submitBatch
  };
}

function createMockHealthChecker() {
  return {
    async getHealth() {
      const checks = {
        database: await this.checkDatabase(),
        external_services: await this.checkExternalServices(),
        memory: (await this.checkResources()).memory,
        disk: (await this.checkResources()).disk
      };
      
      const allHealthy = Object.values(checks).every(check => 
        check.status === 'healthy' || (check.status !== 'unhealthy' && Object.values(check).every(s => s.status === 'healthy'))
      );
      
      const anyUnhealthy = Object.values(checks).some(check =>
        check.status === 'unhealthy' || (check.status !== 'healthy' && Object.values(check).some(s => s.status === 'unhealthy'))
      );
      
      return {
        status: allHealthy ? 'healthy' : anyUnhealthy ? 'degraded' : 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '1.0.0',
        environment: 'test',
        checks
      };
    },
    
    async checkDatabase() {
      const dbCheck = global.healthChecks.database || { status: 'healthy', responseTime: 25 };
      return {
        status: dbCheck.status,
        responseTime: dbCheck.responseTime,
        lastChecked: new Date().toISOString(),
        error: dbCheck.error
      };
    },
    
    async checkExternalServices() {
      return {
        cognito: global.healthChecks.cognito || { status: 'healthy', responseTime: 45 },
        s3: global.healthChecks.s3 || { status: 'healthy', responseTime: 60 },
        cloudwatch: global.healthChecks.cloudwatch || { status: 'healthy', responseTime: 35 }
      };
    },
    
    async checkResources() {
      return {
        memory: { usage: 65, available: 512, status: 'healthy' },
        disk: { usage: 40, available: 2048, status: 'healthy' },
        cpu: { usage: 45, status: 'healthy' }
      };
    },
    
    async checkReadiness() {
      const dbHealth = await this.checkDatabase();
      return {
        ready: dbHealth.status === 'healthy',
        checks: {
          database: dbHealth.status,
          configuration: 'loaded'
        }
      };
    },
    
    async checkLiveness() {
      return {
        alive: true,
        timestamp: new Date().toISOString()
      };
    }
  };
}

function createMockAlertManager(config = {}) {
  const rateLimitWindow = config.rateLimitWindow || 300000; // 5 minutes
  const maxAlertsPerWindow = config.maxAlertsPerWindow || 5;
  
  global.sentAlerts = global.sentAlerts || [];
  global.alertCounts = global.alertCounts || {};
  
  function shouldSendAlert(alertType) {
    const now = Date.now();
    const windowStart = now - rateLimitWindow;
    
    // Clean old alerts
    global.sentAlerts = global.sentAlerts.filter(alert => alert.timestamp > windowStart);
    
    const recentAlerts = global.sentAlerts.filter(alert => alert.type === alertType);
    return recentAlerts.length < maxAlertsPerWindow;
  }
  
  function sendAlert(alert) {
    if (shouldSendAlert(alert.type)) {
      global.sentAlerts.push({
        ...alert,
        timestamp: Date.now()
      });
      return true;
    }
    return false;
  }
  
  return {
    checkErrorRate(currentRate, threshold) {
      const triggered = currentRate > threshold;
      const alert = {
        type: 'error_rate',
        triggered,
        severity: currentRate > threshold * 1.5 ? 'critical' : 'warning',
        message: `Error rate exceeds threshold: ${(currentRate * 100).toFixed(1)}%`,
        metadata: {
          current_rate: currentRate,
          threshold: threshold
        }
      };
      
      if (triggered) {
        sendAlert(alert);
      }
      
      return alert;
    },
    
    checkResponseTime(currentTime, threshold) {
      const triggered = currentTime > threshold;
      const alert = {
        type: 'response_time',
        triggered,
        severity: currentTime > threshold * 2 ? 'critical' : 'warning',
        message: `Response time exceeds threshold: ${currentTime}ms`,
        metadata: {
          current_time: currentTime,
          threshold: threshold
        }
      };
      
      if (triggered) {
        sendAlert(alert);
      }
      
      return alert;
    },
    
    checkMemoryUsage(currentUsage, threshold) {
      const triggered = currentUsage > threshold;
      return {
        type: 'memory_usage',
        triggered,
        severity: 'warning',
        message: `Memory usage exceeds threshold: ${currentUsage}%`,
        metadata: { current_usage: currentUsage, threshold }
      };
    },
    
    checkDiskUsage(currentUsage, threshold) {
      const triggered = currentUsage > threshold;
      return {
        type: 'disk_usage',
        triggered,
        severity: 'critical',
        message: `Disk usage exceeds threshold: ${currentUsage}%`,
        metadata: { current_usage: currentUsage, threshold }
      };
    },
    
    checkCpuUsage(currentUsage, threshold) {
      const triggered = currentUsage > threshold;
      return {
        type: 'cpu_usage',
        triggered,
        severity: 'warning',
        message: `CPU usage exceeds threshold: ${currentUsage}%`,
        metadata: { current_usage: currentUsage, threshold }
      };
    }
  };
}

function createMockTracer() {
  const spans = [];
  
  return {
    startSpan(operationName, options = {}) {
      const span = {
        spanId: `span-${Math.random().toString(36).substr(2, 9)}`,
        traceId: options.parent?.traceId || `trace-${Math.random().toString(36).substr(2, 9)}`,
        parentId: options.parent?.spanId,
        operationName,
        startTime: Date.now(),
        tags: { ...options },
        error: false,
        status: 'ok'
      };
      
      spans.push(span);
      
      return {
        ...span,
        recordError(error) {
          span.error = true;
          span.errorMessage = error.message;
          span.status = 'error';
        },
        finish() {
          span.endTime = Date.now();
          span.duration = span.endTime - span.startTime;
        }
      };
    }
  };
}

function createMockDashboard() {
  const metrics = {};
  
  return {
    recordTemplateMetrics(data) {
      metrics['templates.total'] = data.totalTemplates;
      metrics['templates.public'] = data.publicTemplates;
      metrics['templates.private'] = data.privateTemplates;
      metrics['templates.created_today'] = data.templatesCreatedToday;
      metrics['templates.average_rating'] = data.averageRating;
    },
    
    recordUserMetrics(data) {
      metrics['users.active'] = data.activeUsers;
      metrics['users.new_signups'] = data.newSignups;
      metrics['engagement.views'] = data.templatesViewed;
      metrics['engagement.shares'] = data.templatesShared;
      metrics['engagement.searches'] = data.searchQueries;
    },
    
    getMetrics() {
      return { ...metrics };
    }
  };
}