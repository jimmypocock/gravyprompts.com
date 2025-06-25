/**
 * Redis cache adapter for local development
 * Provides persistent caching across Lambda invocations
 */

const Redis = require('ioredis');

let redisClient = null;
let connectionPromise = null;

/**
 * Get or create Redis connection
 * Uses connection pooling to avoid creating multiple connections
 */
async function getRedisClient() {
  // If we already have a connected client, return it
  if (redisClient && redisClient.status === 'ready') {
    return redisClient;
  }

  // If we're already connecting, wait for that connection
  if (connectionPromise) {
    return connectionPromise;
  }

  // Create new connection
  connectionPromise = createRedisConnection();
  redisClient = await connectionPromise;
  connectionPromise = null;
  
  return redisClient;
}

/**
 * Create Redis connection with retry logic
 */
async function createRedisConnection() {
  const client = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    retryStrategy: (times) => {
      if (times > 3) {
        console.error('Redis connection failed after 3 retries');
        return null; // Stop retrying
      }
      return Math.min(times * 100, 3000); // Exponential backoff
    },
    maxRetriesPerRequest: 3,
    enableOfflineQueue: true,
    connectTimeout: 5000,
    lazyConnect: true,
  });

  // Set up error handlers
  client.on('error', (err) => {
    console.error('Redis error:', err.message);
  });

  client.on('connect', () => {
    console.log('Redis connected successfully');
  });

  // Attempt to connect
  try {
    await client.connect();
    return client;
  } catch (error) {
    console.error('Failed to connect to Redis:', error.message);
    throw error;
  }
}

/**
 * Redis cache implementation
 */
const redisCache = {
  /**
   * Get item from Redis
   * @param {string} key - Cache key
   * @returns {Promise<any|null>} - Cached value or null
   */
  async get(key) {
    try {
      const client = await getRedisClient();
      const value = await client.get(key);
      
      if (!value) {
        return null;
      }

      // Parse JSON and check expiration
      const item = JSON.parse(value);
      
      if (Date.now() > item.expires) {
        await client.del(key);
        return null;
      }

      return item.value;
    } catch (error) {
      console.error(`Redis get error for key ${key}:`, error.message);
      return null;
    }
  },

  /**
   * Set item in Redis
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in milliseconds
   */
  async set(key, value, ttl = 300000) { // Default 5 minutes
    try {
      const client = await getRedisClient();
      const item = {
        value,
        expires: Date.now() + ttl,
      };

      // Set with expiration
      await client.setex(
        key,
        Math.ceil(ttl / 1000), // Convert to seconds
        JSON.stringify(item)
      );
    } catch (error) {
      console.error(`Redis set error for key ${key}:`, error.message);
    }
  },

  /**
   * Delete item from Redis
   * @param {string} key - Cache key
   */
  async del(key) {
    try {
      const client = await getRedisClient();
      await client.del(key);
    } catch (error) {
      console.error(`Redis del error for key ${key}:`, error.message);
    }
  },

  /**
   * Clear all cache entries with a pattern
   * @param {string} pattern - Key pattern to match (e.g., "templates:*")
   */
  async clear(pattern = '*') {
    try {
      const client = await getRedisClient();
      const keys = await client.keys(pattern);
      
      if (keys.length > 0) {
        await client.del(...keys);
      }
    } catch (error) {
      console.error(`Redis clear error for pattern ${pattern}:`, error.message);
    }
  },

  /**
   * Check if Redis is available
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    try {
      const client = await getRedisClient();
      await client.ping();
      return true;
    } catch (error) {
      return false;
    }
  },

  /**
   * Get cache statistics
   * @returns {Promise<object>}
   */
  async getStats() {
    try {
      const client = await getRedisClient();
      const info = await client.info('stats');
      const dbSize = await client.dbsize();
      
      return {
        connected: true,
        totalKeys: dbSize,
        info: info,
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message,
      };
    }
  },

  /**
   * Close Redis connection (for cleanup)
   */
  async close() {
    if (redisClient) {
      await redisClient.quit();
      redisClient = null;
    }
  }
};

module.exports = redisCache;