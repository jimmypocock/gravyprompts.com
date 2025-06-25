const cache = require('../cache');

// Mock Redis cache to avoid external dependencies
jest.mock('../redis-cache', () => null);

describe('Cache Module', () => {
  beforeEach(() => {
    // Clear cache before each test
    cache.clear();
  });

  describe('get/set operations', () => {
    it('should store and retrieve values', async () => {
      const key = 'test:key';
      const value = { data: 'test value' };
      
      await cache.set(key, value);
      const retrieved = await cache.get(key);
      
      expect(retrieved).toEqual(value);
    });

    it('should return null for non-existent keys', async () => {
      const result = await cache.get('non:existent');
      expect(result).toBeNull();
    });

    it('should expire values after TTL', async () => {
      const key = 'test:expire';
      const value = 'test data';
      const ttl = 100; // 100ms
      
      await cache.set(key, value, ttl);
      
      // Should exist immediately
      expect(await cache.get(key)).toBe(value);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should be expired
      expect(await cache.get(key)).toBeNull();
    });

    it('should track cache metrics', async () => {
      const metrics = cache.getMetrics();
      const initialHits = metrics.hits;
      const initialMisses = metrics.misses;
      const initialSets = metrics.sets;
      
      // Set a value
      await cache.set('metric:test', 'value');
      
      // Get existing value (hit)
      await cache.get('metric:test');
      
      // Get non-existent value (miss)
      await cache.get('metric:nonexistent');
      
      const newMetrics = cache.getMetrics();
      expect(newMetrics.sets).toBe(initialSets + 1);
      expect(newMetrics.hits).toBe(initialHits + 1);
      expect(newMetrics.misses).toBe(initialMisses + 1);
    });
  });

  describe('delete operations', () => {
    it('should delete cached values', async () => {
      const key = 'test:delete';
      await cache.set(key, 'value');
      
      expect(await cache.get(key)).toBe('value');
      
      await cache.del(key);
      
      expect(await cache.get(key)).toBeNull();
    });
  });

  describe('clear operations', () => {
    it('should clear all cache entries', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');
      
      await cache.clear();
      
      expect(await cache.get('key1')).toBeNull();
      expect(await cache.get('key2')).toBeNull();
      expect(await cache.get('key3')).toBeNull();
    });
  });

  describe('clearPattern operations', () => {
    it('should clear keys matching pattern', async () => {
      await cache.set('templates:list:public:20', 'data1');
      await cache.set('templates:list:public:10', 'data2');
      await cache.set('templates:list:popular:20', 'data3');
      await cache.set('templates:get:123', 'data4');
      
      await cache.clearPattern('templates:list:public:*');
      
      // Public list caches should be cleared
      expect(await cache.get('templates:list:public:20')).toBeNull();
      expect(await cache.get('templates:list:public:10')).toBeNull();
      
      // Other caches should remain
      expect(await cache.get('templates:list:popular:20')).toBe('data3');
      expect(await cache.get('templates:get:123')).toBe('data4');
    });

    it('should handle complex patterns', async () => {
      await cache.set('templates:list:all:20:abc', 'data1');
      await cache.set('templates:list:mine:20:xyz', 'data2');
      await cache.set('templates:list:public:20:123', 'data3');
      
      await cache.clearPattern('templates:list:*:20:*');
      
      // All should be cleared
      expect(await cache.get('templates:list:all:20:abc')).toBeNull();
      expect(await cache.get('templates:list:mine:20:xyz')).toBeNull();
      expect(await cache.get('templates:list:public:20:123')).toBeNull();
    });
  });

  describe('cached decorator', () => {
    it('should cache function results', async () => {
      let callCount = 0;
      const expensiveFunction = async (id) => {
        callCount++;
        return { id, data: `expensive data for ${id}` };
      };
      
      const cachedFunction = cache.cached(
        expensiveFunction,
        (id) => `test:${id}`,
        1000
      );
      
      // First call should execute function
      const result1 = await cachedFunction('123');
      expect(callCount).toBe(1);
      expect(result1.id).toBe('123');
      
      // Second call should use cache
      const result2 = await cachedFunction('123');
      expect(callCount).toBe(1); // Not incremented
      expect(result2).toEqual(result1);
      
      // Different parameter should execute function
      const result3 = await cachedFunction('456');
      expect(callCount).toBe(2);
      expect(result3.id).toBe('456');
    });

    it('should not cache errors', async () => {
      let callCount = 0;
      const failingFunction = async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('First call fails');
        }
        return { success: true };
      };
      
      const cachedFunction = cache.cached(
        failingFunction,
        () => 'error:test',
        1000
      );
      
      // First call should fail
      await expect(cachedFunction()).rejects.toThrow('First call fails');
      expect(callCount).toBe(1);
      
      // Second call should retry (not cached)
      const result = await cachedFunction();
      expect(callCount).toBe(2);
      expect(result.success).toBe(true);
    });
  });

  describe('key generators', () => {
    it('should generate correct template list keys', () => {
      const key1 = cache.keyGenerators.templateList({
        filter: 'public',
        search: 'test',
        limit: 20,
        lastEvaluatedKey: 'abc123',
        userId: 'user123'
      });
      
      expect(key1).toBe('templates:list:public:test:20:abc123:user123');
      
      const key2 = cache.keyGenerators.templateList({});
      expect(key2).toBe('templates:list:all::20::anonymous');
    });

    it('should generate correct template keys', () => {
      const key = cache.keyGenerators.template('template-123');
      expect(key).toBe('templates:get:template-123');
    });

    it('should generate correct user template keys', () => {
      const key = cache.keyGenerators.userTemplates('user-456');
      expect(key).toBe('templates:user:user-456');
    });

    it('should generate correct search keys', () => {
      const key = cache.keyGenerators.search('my query', 50);
      expect(key).toBe('search:my query:50');
    });

    it('should generate correct popular keys', () => {
      const key = cache.keyGenerators.popular(30);
      expect(key).toBe('templates:popular:30');
    });
  });

  describe('cache size limits', () => {
    it('should respect MAX_CACHE_SIZE limit', async () => {
      // This test would need access to internal cache Map
      // which is not exposed. In a real implementation,
      // we'd need to either expose it for testing or
      // test the behavior indirectly
      
      // Set many items (more than MAX_CACHE_SIZE)
      for (let i = 0; i < 150; i++) {
        await cache.set(`test:size:${i}`, `value${i}`);
      }
      
      const metrics = cache.getMetrics();
      expect(metrics.size).toBeLessThanOrEqual(100); // MAX_CACHE_SIZE
      expect(metrics.evictions).toBeGreaterThan(0);
    });
  });
});