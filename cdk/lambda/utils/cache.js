/**
 * Simple in-memory cache for Lambda functions
 * Uses Lambda container reuse for caching between invocations
 */

// Global cache object - persists between Lambda invocations
const cache = new Map();
const cacheMetrics = {
  hits: 0,
  misses: 0,
  sets: 0,
  evictions: 0
};

// Configuration
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 100; // Maximum number of items
const MAX_CACHE_MEMORY = 50 * 1024 * 1024; // 50MB max cache size

/**
 * Get item from cache
 * @param {string} key - Cache key
 * @returns {any|null} - Cached value or null if not found/expired
 */
function get(key) {
  const item = cache.get(key);
  
  if (!item) {
    cacheMetrics.misses++;
    return null;
  }
  
  // Check if expired
  if (Date.now() > item.expires) {
    cache.delete(key);
    cacheMetrics.misses++;
    return null;
  }
  
  cacheMetrics.hits++;
  return item.value;
}

/**
 * Set item in cache
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {number} ttl - Time to live in milliseconds (optional)
 */
function set(key, value, ttl = DEFAULT_TTL) {
  // Estimate size (rough approximation)
  const size = JSON.stringify(value).length;
  
  // Check cache size limits
  if (cache.size >= MAX_CACHE_SIZE || getCacheSize() + size > MAX_CACHE_MEMORY) {
    evictOldest();
  }
  
  cache.set(key, {
    value,
    expires: Date.now() + ttl,
    size,
    accessed: Date.now()
  });
  
  cacheMetrics.sets++;
}

/**
 * Delete item from cache
 * @param {string} key - Cache key
 */
function del(key) {
  return cache.delete(key);
}

/**
 * Clear entire cache
 */
function clear() {
  cache.clear();
  resetMetrics();
}

/**
 * Get cache metrics
 * @returns {object} - Cache statistics
 */
function getMetrics() {
  const hitRate = cacheMetrics.hits + cacheMetrics.misses > 0
    ? (cacheMetrics.hits / (cacheMetrics.hits + cacheMetrics.misses) * 100).toFixed(2)
    : 0;
    
  return {
    ...cacheMetrics,
    hitRate: `${hitRate}%`,
    size: cache.size,
    memorySizeMB: (getCacheSize() / 1024 / 1024).toFixed(2)
  };
}

/**
 * Reset metrics
 */
function resetMetrics() {
  cacheMetrics.hits = 0;
  cacheMetrics.misses = 0;
  cacheMetrics.sets = 0;
  cacheMetrics.evictions = 0;
}

/**
 * Get approximate cache size in bytes
 */
function getCacheSize() {
  let totalSize = 0;
  for (const item of cache.values()) {
    totalSize += item.size || 0;
  }
  return totalSize;
}

/**
 * Evict oldest items from cache
 */
function evictOldest() {
  const sortedEntries = Array.from(cache.entries())
    .sort((a, b) => a[1].accessed - b[1].accessed);
  
  // Remove oldest 10% of items
  const removeCount = Math.max(1, Math.floor(cache.size * 0.1));
  
  for (let i = 0; i < removeCount && i < sortedEntries.length; i++) {
    cache.delete(sortedEntries[i][0]);
    cacheMetrics.evictions++;
  }
}

/**
 * Decorator function for caching function results
 * @param {Function} fn - Function to cache
 * @param {Function} keyGenerator - Function to generate cache key from arguments
 * @param {number} ttl - Time to live in milliseconds
 */
function cached(fn, keyGenerator, ttl = DEFAULT_TTL) {
  return async function(...args) {
    const key = keyGenerator(...args);
    
    // Check cache first
    const cachedResult = get(key);
    if (cachedResult !== null) {
      console.log(`Cache hit for key: ${key}`);
      return cachedResult;
    }
    
    // Execute function and cache result
    console.log(`Cache miss for key: ${key}`);
    const result = await fn(...args);
    
    // Only cache successful results
    if (result && !result.error) {
      set(key, result, ttl);
    }
    
    return result;
  };
}

/**
 * Cache key generators for common patterns
 */
const keyGenerators = {
  // For template listings
  templateList: (params = {}) => {
    const { filter = 'all', search = '', limit = 20, lastEvaluatedKey = '', userId = 'anonymous' } = params;
    return `templates:list:${filter}:${search}:${limit}:${lastEvaluatedKey}:${userId}`;
  },
  
  // For individual templates
  template: (templateId) => `templates:get:${templateId}`,
  
  // For user-specific data
  userTemplates: (userId) => `templates:user:${userId}`,
  
  // For search results
  search: (query, limit = 20) => `search:${query}:${limit}`,
  
  // For popular templates (can be cached longer)
  popular: (limit = 20) => `templates:popular:${limit}`
};

module.exports = {
  get,
  set,
  del,
  clear,
  getMetrics,
  cached,
  keyGenerators,
  
  // Cache configuration
  DEFAULT_TTL,
  POPULAR_TTL: 30 * 60 * 1000, // 30 minutes for popular content
  USER_TTL: 60 * 1000, // 1 minute for user-specific content
};