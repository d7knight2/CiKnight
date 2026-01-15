/**
 * Retry utility with exponential backoff
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

/**
 * Executes a function with exponential backoff retry logic
 * @param fn Function to execute
 * @param options Retry options
 * @param context Context description for logging
 * @returns Result of the function
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
  context: string = 'operation'
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | undefined;
  let attempt = 0;

  while (attempt <= opts.maxRetries) {
    try {
      if (attempt > 0) {
        console.log(`🔄 [RETRY] Attempt ${attempt}/${opts.maxRetries} for ${context}`);
      }

      const result = await fn();

      if (attempt > 0) {
        console.log(`✅ [RETRY] ${context} succeeded after ${attempt} retry(ies)`);
      }

      return result;
    } catch (error: any) {
      lastError = error;
      attempt++;

      // Check if we should retry
      if (attempt > opts.maxRetries) {
        console.error(
          `❌ [RETRY] ${context} failed after ${opts.maxRetries} retry(ies): ${error.message}`
        );
        break;
      }

      // Check if error is retryable (rate limit, network errors, 5xx errors)
      const isRetryable = isRetryableError(error);
      if (!isRetryable) {
        console.error(`❌ [RETRY] ${context} failed with non-retryable error: ${error.message}`);
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.initialDelayMs * Math.pow(opts.backoffMultiplier, attempt - 1),
        opts.maxDelayMs
      );

      console.warn(
        `⚠️  [RETRY] ${context} failed (attempt ${attempt}/${opts.maxRetries}): ${error.message}. Retrying in ${delay}ms...`
      );

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // All retries exhausted
  throw lastError;
}

/**
 * Determines if an error is retryable
 */
function isRetryableError(error: any): boolean {
  // GitHub rate limit errors
  if (error.status === 403 && error.message?.includes('rate limit')) {
    return true;
  }

  // 429 Too Many Requests
  if (error.status === 429) {
    return true;
  }

  // 5xx server errors
  if (error.status >= 500 && error.status < 600) {
    return true;
  }

  // Network errors
  if (
    error.code === 'ECONNRESET' ||
    error.code === 'ETIMEDOUT' ||
    error.code === 'ENOTFOUND' ||
    error.message?.includes('network') ||
    error.message?.includes('timeout')
  ) {
    return true;
  }

  return false;
}
