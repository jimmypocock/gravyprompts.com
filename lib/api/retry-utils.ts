// Retry utilities with circuit breaker pattern

interface RetryOptions {
  maxRetries?: number;
  maxRetryTime?: number; // Maximum total time to retry in ms
  baseDelay?: number; // Base delay in ms
  maxDelay?: number; // Maximum delay between retries in ms
  shouldRetry?: (error: unknown, attemptNumber: number) => boolean;
  onRetry?: (error: unknown, attemptNumber: number, delay: number) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  maxRetryTime: 30000, // 30 seconds total
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds max between retries
  shouldRetry: (error) => {
    // Only retry on network errors or 5xx server errors
    if (error instanceof Error && error.message === 'Failed to fetch') return true;
    if (error && typeof error === 'object' && 'status' in error) {
      const status = (error as { status: number }).status;
      return status === 0 || (status >= 500 && status < 600);
    }
    return false;
  },
  onRetry: (error, attemptNumber, delay) => {
    console.log(`Retry attempt ${attemptNumber} after ${delay}ms delay`, error);
  },
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const startTime = Date.now();
  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we've exceeded max retry time
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime >= opts.maxRetryTime) {
        console.error(`Max retry time (${opts.maxRetryTime}ms) exceeded`);
        throw error;
      }

      // Check if we should retry
      if (attempt === opts.maxRetries || !opts.shouldRetry(error, attempt + 1)) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const exponentialDelay = Math.min(
        opts.baseDelay * Math.pow(2, attempt),
        opts.maxDelay
      );
      
      // Add jitter to prevent thundering herd
      const jitter = Math.random() * 0.3 * exponentialDelay;
      const delay = Math.round(exponentialDelay + jitter);

      // Check if delay would exceed max retry time
      if (elapsedTime + delay >= opts.maxRetryTime) {
        console.error(`Next retry would exceed max retry time`);
        throw error;
      }

      // Call retry callback
      opts.onRetry(error, attempt + 1, delay);

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// Circuit breaker to prevent cascading failures
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private readonly threshold = 5,
    private readonly resetTimeout = 60000 // 1 minute
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit should be reset
    if (
      this.state === 'open' &&
      Date.now() - this.lastFailureTime > this.resetTimeout
    ) {
      this.state = 'half-open';
      this.failures = 0;
    }

    // If circuit is open, fail fast
    if (this.state === 'open') {
      throw new Error('Circuit breaker is open - service unavailable');
    }

    try {
      const result = await fn();
      
      // Success - reset failures if in half-open state
      if (this.state === 'half-open') {
        this.state = 'closed';
        this.failures = 0;
      }
      
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();

      // Open circuit if threshold exceeded
      if (this.failures >= this.threshold) {
        this.state = 'open';
        console.error(`Circuit breaker opened after ${this.failures} failures`);
      }

      throw error;
    }
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
    };
  }
}