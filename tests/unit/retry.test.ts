import { withRetry } from '../../src/utils/retry';

describe('Retry Utility', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('withRetry', () => {
    test('should succeed on first attempt without retry', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');

      const result = await withRetry(mockFn, { maxRetries: 3 }, 'test operation');

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('[RETRY] Attempt'));
    });

    test('should retry on retryable errors and succeed', async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce({ status: 500, message: 'Server error' })
        .mockResolvedValueOnce('success');

      const result = await withRetry(
        mockFn,
        { maxRetries: 3, initialDelayMs: 10 },
        'test operation'
      );

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️  [RETRY] test operation failed (attempt 1/3)')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('✅ [RETRY] test operation succeeded after 1 retry(ies)')
      );
    });

    test('should fail after max retries exhausted', async () => {
      const mockFn = jest.fn().mockRejectedValue({ status: 500, message: 'Server error' });

      await expect(
        withRetry(mockFn, { maxRetries: 2, initialDelayMs: 10 }, 'test operation')
      ).rejects.toEqual({ status: 500, message: 'Server error' });

      expect(mockFn).toHaveBeenCalledTimes(3); // Initial + 2 retries
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ [RETRY] test operation failed after 2 retry(ies)')
      );
    });

    test('should not retry on non-retryable errors', async () => {
      const mockFn = jest.fn().mockRejectedValue({ status: 404, message: 'Not found' });

      await expect(withRetry(mockFn, { maxRetries: 3 }, 'test operation')).rejects.toEqual({
        status: 404,
        message: 'Not found',
      });

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ [RETRY] test operation failed with non-retryable error')
      );
    });

    test('should use exponential backoff', async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce({ status: 500, message: 'Error 1' })
        .mockRejectedValueOnce({ status: 500, message: 'Error 2' })
        .mockResolvedValueOnce('success');

      const result = await withRetry(
        mockFn,
        { maxRetries: 3, initialDelayMs: 10, backoffMultiplier: 2 },
        'test operation'
      );

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(3);
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Retrying in 10ms'));
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Retrying in 20ms'));
    });

    test('should respect max delay', async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce({ status: 500, message: 'Error 1' })
        .mockRejectedValueOnce({ status: 500, message: 'Error 2' })
        .mockResolvedValueOnce('success');

      const result = await withRetry(
        mockFn,
        { maxRetries: 3, initialDelayMs: 10, maxDelayMs: 15, backoffMultiplier: 2 },
        'test operation'
      );

      expect(result).toBe('success');
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Retrying in 15ms'));
    });

    test('should handle rate limit errors (403)', async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce({ status: 403, message: 'rate limit exceeded' })
        .mockResolvedValueOnce('success');

      const result = await withRetry(
        mockFn,
        { maxRetries: 2, initialDelayMs: 10 },
        'test operation'
      );

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    test('should handle 429 Too Many Requests', async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce({ status: 429, message: 'Too many requests' })
        .mockResolvedValueOnce('success');

      const result = await withRetry(
        mockFn,
        { maxRetries: 2, initialDelayMs: 10 },
        'test operation'
      );

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    test('should handle network errors (ECONNRESET)', async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce({ code: 'ECONNRESET', message: 'Connection reset' })
        .mockResolvedValueOnce('success');

      const result = await withRetry(
        mockFn,
        { maxRetries: 2, initialDelayMs: 10 },
        'test operation'
      );

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    test('should handle network errors (ETIMEDOUT)', async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce({ code: 'ETIMEDOUT', message: 'Connection timed out' })
        .mockResolvedValueOnce('success');

      const result = await withRetry(
        mockFn,
        { maxRetries: 2, initialDelayMs: 10 },
        'test operation'
      );

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    test('should use default options when not provided', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');

      const result = await withRetry(mockFn);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    test('should use default context when not provided', async () => {
      const mockFn = jest.fn().mockRejectedValue({ status: 500, message: 'Error' });

      await expect(withRetry(mockFn, { maxRetries: 0 })).rejects.toEqual({
        status: 500,
        message: 'Error',
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('operation failed after 0 retry(ies)')
      );
    });
  });
});
