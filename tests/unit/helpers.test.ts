import { isValidUrl, sleep, parsePrivateKey } from '../../src/utils/helpers';

describe('Helper Functions', () => {
  describe('isValidUrl', () => {
    test('should return true for valid HTTP URLs', () => {
      expect(isValidUrl('https://github.com')).toBe(true);
      expect(isValidUrl('http://localhost:3000')).toBe(true);
    });

    test('should return true for valid URLs with paths', () => {
      expect(isValidUrl('https://github.com/user/repo')).toBe(true);
    });

    test('should return false for invalid URLs', () => {
      expect(isValidUrl('not a url')).toBe(false);
      expect(isValidUrl('')).toBe(false);
      expect(isValidUrl('//invalid')).toBe(false);
    });
  });

  describe('sleep', () => {
    test('should delay execution for specified milliseconds', async () => {
      const start = Date.now();
      await sleep(100);
      const duration = Date.now() - start;
      expect(duration).toBeGreaterThanOrEqual(95); // Allow small margin
      expect(duration).toBeLessThan(200);
    });

    test('should return a Promise', () => {
      const result = sleep(10);
      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe('parsePrivateKey', () => {
    test('should replace escaped newlines with actual newlines', () => {
      const input = 'line1\\nline2\\nline3';
      const expected = 'line1\nline2\nline3';
      expect(parsePrivateKey(input)).toBe(expected);
    });

    test('should handle keys without escaped newlines', () => {
      const input = 'line1\nline2\nline3';
      expect(parsePrivateKey(input)).toBe(input);
    });

    test('should handle empty strings', () => {
      expect(parsePrivateKey('')).toBe('');
    });
  });
});
