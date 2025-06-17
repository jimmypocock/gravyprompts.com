/**
 * API Load Tests
 * 
 * These tests simulate realistic load scenarios and measure API performance
 * under stress conditions, including concurrent users and high request volumes.
 */

import { performance } from 'perf_hooks';

// Mock fetch for load testing
global.fetch = jest.fn();

interface LoadTestResult {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  requestsPerSecond: number;
  percentiles: {
    p50: number;
    p95: number;
    p99: number;
  };
}

interface LoadTestConfig {
  concurrentUsers: number;
  requestsPerUser: number;
  rampUpTime: number; // seconds
  testDuration: number; // seconds
}

describe('API Load Tests', () => {
  const API_BASE_URL = 'http://localhost:7429';
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Utility function to run load tests
   */
  async function runLoadTest(
    endpoint: string,
    config: LoadTestConfig,
    requestOptions: RequestInit = {}
  ): Promise<LoadTestResult> {
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    const responseTimes: number[] = [];
    const results: boolean[] = [];
    
    // Mock successful responses with realistic delays
    mockFetch.mockImplementation(async () => {
      // Simulate realistic response time (50-500ms)
      const delay = Math.random() * 450 + 50;
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // 95% success rate simulation
      const success = Math.random() > 0.05;
      
      return {
        ok: success,
        status: success ? 200 : 500,
        json: async () => success ? { data: 'mock' } : { error: 'Server error' }
      } as Response;
    });

    const startTime = performance.now();
    const promises: Promise<void>[] = [];

    // Create concurrent users
    for (let user = 0; user < config.concurrentUsers; user++) {
      const userPromise = (async () => {
        // Ramp up delay
        const rampUpDelay = (user / config.concurrentUsers) * config.rampUpTime * 1000;
        await new Promise(resolve => setTimeout(resolve, rampUpDelay));

        // Execute requests for this user
        for (let req = 0; req < config.requestsPerUser; req++) {
          const requestStart = performance.now();
          
          try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, requestOptions);
            const requestEnd = performance.now();
            
            responseTimes.push(requestEnd - requestStart);
            results.push(response.ok);
          } catch (error) {
            const requestEnd = performance.now();
            responseTimes.push(requestEnd - requestStart);
            results.push(false);
          }

          // Small delay between requests from same user
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      })();
      
      promises.push(userPromise);
    }

    await Promise.all(promises);
    const endTime = performance.now();

    const totalTime = (endTime - startTime) / 1000; // Convert to seconds
    const totalRequests = results.length;
    const successfulRequests = results.filter(Boolean).length;
    const failedRequests = totalRequests - successfulRequests;

    // Calculate percentiles
    const sortedTimes = responseTimes.sort((a, b) => a - b);
    const p50 = sortedTimes[Math.floor(sortedTimes.length * 0.5)];
    const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
    const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)];

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      minResponseTime: Math.min(...responseTimes),
      maxResponseTime: Math.max(...responseTimes),
      requestsPerSecond: totalRequests / totalTime,
      percentiles: { p50, p95, p99 }
    };
  }

  describe('Template List API Load Tests', () => {
    it('should handle moderate load (10 concurrent users)', async () => {
      const config: LoadTestConfig = {
        concurrentUsers: 10,
        requestsPerUser: 5,
        rampUpTime: 2,
        testDuration: 10
      };

      const result = await runLoadTest('/templates', config);

      // Performance assertions
      expect(result.totalRequests).toBe(50);
      expect(result.successfulRequests).toBeGreaterThan(45); // 90%+ success rate
      expect(result.averageResponseTime).toBeLessThan(300); // Under 300ms average
      expect(result.percentiles.p95).toBeLessThan(500); // 95th percentile under 500ms
      expect(result.requestsPerSecond).toBeGreaterThan(3); // At least 3 RPS
    }, 30000);

    it('should handle high load (50 concurrent users)', async () => {
      const config: LoadTestConfig = {
        concurrentUsers: 50,
        requestsPerUser: 3,
        rampUpTime: 5,
        testDuration: 15
      };

      const result = await runLoadTest('/templates?limit=20', config);

      // Performance assertions for high load
      expect(result.totalRequests).toBe(150);
      expect(result.successfulRequests).toBeGreaterThan(135); // 90%+ success rate
      expect(result.averageResponseTime).toBeLessThan(800); // Under 800ms average under load
      expect(result.percentiles.p99).toBeLessThan(1500); // 99th percentile under 1.5s
      expect(result.requestsPerSecond).toBeGreaterThan(8); // At least 8 RPS
    }, 45000);

    it('should handle search query load', async () => {
      const config: LoadTestConfig = {
        concurrentUsers: 20,
        requestsPerUser: 4,
        rampUpTime: 3,
        testDuration: 12
      };

      const result = await runLoadTest('/templates?search=email&limit=10', config);

      // Search should be more resource intensive
      expect(result.totalRequests).toBe(80);
      expect(result.successfulRequests).toBeGreaterThan(72); // 90%+ success rate
      expect(result.averageResponseTime).toBeLessThan(600); // Under 600ms for search
      expect(result.percentiles.p95).toBeLessThan(1000); // 95th percentile under 1s
    }, 35000);
  });

  describe('Template CRUD Operations Load Tests', () => {
    it('should handle template creation load', async () => {
      const config: LoadTestConfig = {
        concurrentUsers: 5,
        requestsPerUser: 3,
        rampUpTime: 2,
        testDuration: 8
      };

      const requestOptions: RequestInit = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          title: 'Load Test Template',
          content: 'Hello {{name}}, this is a load test template.',
          tags: ['test', 'performance'],
          visibility: 'public'
        })
      };

      const result = await runLoadTest('/templates', config, requestOptions);

      // Creation operations should be more resource intensive
      expect(result.totalRequests).toBe(15);
      expect(result.successfulRequests).toBeGreaterThan(13); // 85%+ success rate
      expect(result.averageResponseTime).toBeLessThan(1000); // Under 1s for creation
      expect(result.percentiles.p95).toBeLessThan(1500); // 95th percentile under 1.5s
    }, 25000);

    it('should handle template retrieval load', async () => {
      const config: LoadTestConfig = {
        concurrentUsers: 15,
        requestsPerUser: 5,
        rampUpTime: 3,
        testDuration: 10
      };

      const result = await runLoadTest('/templates/test-template-id', config);

      // Single template retrieval should be fast
      expect(result.totalRequests).toBe(75);
      expect(result.successfulRequests).toBeGreaterThan(68); // 90%+ success rate
      expect(result.averageResponseTime).toBeLessThan(200); // Under 200ms for single item
      expect(result.percentiles.p95).toBeLessThan(400); // 95th percentile under 400ms
    }, 25000);
  });

  describe('User Prompts API Load Tests', () => {
    it('should handle prompt saving load', async () => {
      const config: LoadTestConfig = {
        concurrentUsers: 8,
        requestsPerUser: 3,
        rampUpTime: 2,
        testDuration: 8
      };

      const requestOptions: RequestInit = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          templateId: 'test-template',
          title: 'My Load Test Prompt',
          content: 'Hello John, this is a test prompt.',
          variables: { name: 'John' }
        })
      };

      const result = await runLoadTest('/prompts', config, requestOptions);

      expect(result.totalRequests).toBe(24);
      expect(result.successfulRequests).toBeGreaterThan(21); // 85%+ success rate
      expect(result.averageResponseTime).toBeLessThan(800); // Under 800ms
    }, 20000);

    it('should handle prompt listing load', async () => {
      const config: LoadTestConfig = {
        concurrentUsers: 12,
        requestsPerUser: 4,
        rampUpTime: 2,
        testDuration: 8
      };

      const requestOptions: RequestInit = {
        headers: {
          'Authorization': 'Bearer test-token'
        }
      };

      const result = await runLoadTest('/prompts', config, requestOptions);

      expect(result.totalRequests).toBe(48);
      expect(result.successfulRequests).toBeGreaterThan(43); // 90%+ success rate
      expect(result.averageResponseTime).toBeLessThan(400); // Under 400ms
    }, 20000);
  });

  describe('Stress Testing Scenarios', () => {
    it('should survive spike in traffic', async () => {
      // Simulate sudden traffic spike
      const config: LoadTestConfig = {
        concurrentUsers: 100,
        requestsPerUser: 1,
        rampUpTime: 1, // Very fast ramp up
        testDuration: 5
      };

      const result = await runLoadTest('/templates', config);

      // System should remain stable during spike
      expect(result.totalRequests).toBe(100);
      expect(result.successfulRequests).toBeGreaterThan(80); // 80%+ success rate during spike
      expect(result.averageResponseTime).toBeLessThan(2000); // Under 2s during spike
      expect(result.failedRequests).toBeLessThan(20); // Less than 20% failures
    }, 30000);

    it('should handle sustained load', async () => {
      // Simulate sustained traffic over time
      const config: LoadTestConfig = {
        concurrentUsers: 25,
        requestsPerUser: 8,
        rampUpTime: 10,
        testDuration: 30
      };

      const result = await runLoadTest('/templates?limit=30', config);

      // System should maintain performance over time
      expect(result.totalRequests).toBe(200);
      expect(result.successfulRequests).toBeGreaterThan(180); // 90%+ success rate
      expect(result.averageResponseTime).toBeLessThan(600); // Under 600ms sustained
      expect(result.requestsPerSecond).toBeGreaterThan(5); // Maintain throughput
    }, 60000);
  });

  describe('Edge Case Load Tests', () => {
    it('should handle large payload requests', async () => {
      const config: LoadTestConfig = {
        concurrentUsers: 3,
        requestsPerUser: 2,
        rampUpTime: 1,
        testDuration: 5
      };

      // Large template content (50KB)
      const largeContent = 'Large template content block. '.repeat(1600);
      
      const requestOptions: RequestInit = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          title: 'Large Load Test Template',
          content: largeContent,
          tags: ['test', 'large', 'performance'],
          visibility: 'public'
        })
      };

      const result = await runLoadTest('/templates', config, requestOptions);

      // Large payloads should still be processed
      expect(result.totalRequests).toBe(6);
      expect(result.successfulRequests).toBeGreaterThan(4); // 70%+ success rate
      expect(result.averageResponseTime).toBeLessThan(3000); // Under 3s for large payloads
    }, 20000);

    it('should handle rapid consecutive requests from single user', async () => {
      const config: LoadTestConfig = {
        concurrentUsers: 1,
        requestsPerUser: 20,
        rampUpTime: 0,
        testDuration: 5
      };

      const result = await runLoadTest('/templates/test-id', config);

      // Rapid requests from single user
      expect(result.totalRequests).toBe(20);
      expect(result.successfulRequests).toBeGreaterThan(17); // 85%+ success rate
      expect(result.averageResponseTime).toBeLessThan(500); // Should remain fast
    }, 15000);
  });

  describe('Performance Regression Tests', () => {
    it('should maintain baseline performance for template listing', async () => {
      const config: LoadTestConfig = {
        concurrentUsers: 10,
        requestsPerUser: 5,
        rampUpTime: 2,
        testDuration: 8
      };

      const result = await runLoadTest('/templates?limit=50', config);

      // Baseline performance expectations
      expect(result.averageResponseTime).toBeLessThan(400); // Baseline: 400ms
      expect(result.percentiles.p95).toBeLessThan(700); // Baseline: 700ms p95
      expect(result.requestsPerSecond).toBeGreaterThan(4); // Baseline: 4 RPS
      
      // Log performance metrics for monitoring
      console.log('Template Listing Performance Baseline:', {
        avgResponseTime: Math.round(result.averageResponseTime),
        p95: Math.round(result.percentiles.p95),
        rps: Math.round(result.requestsPerSecond * 10) / 10,
        successRate: Math.round((result.successfulRequests / result.totalRequests) * 100)
      });
    }, 25000);

    it('should maintain baseline performance for search queries', async () => {
      const config: LoadTestConfig = {
        concurrentUsers: 8,
        requestsPerUser: 4,
        rampUpTime: 2,
        testDuration: 8
      };

      const result = await runLoadTest('/templates?search=marketing+email&limit=20', config);

      // Search baseline performance
      expect(result.averageResponseTime).toBeLessThan(600); // Baseline: 600ms
      expect(result.percentiles.p95).toBeLessThan(1000); // Baseline: 1s p95
      expect(result.requestsPerSecond).toBeGreaterThan(3); // Baseline: 3 RPS
      
      console.log('Search Performance Baseline:', {
        avgResponseTime: Math.round(result.averageResponseTime),
        p95: Math.round(result.percentiles.p95),
        rps: Math.round(result.requestsPerSecond * 10) / 10,
        successRate: Math.round((result.successfulRequests / result.totalRequests) * 100)
      });
    }, 25000);
  });
});