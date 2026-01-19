import {
  isValidUrl,
  sleep,
  parsePrivateKey,
  computeWebhookSignature,
} from '../../src/utils/helpers';
import crypto from 'crypto';

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
      expect(duration).toBeGreaterThanOrEqual(95); // Allow small margin for system scheduling
      expect(duration).toBeLessThan(150); // Tighter upper bound to catch timing issues
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

  describe('computeWebhookSignature', () => {
    test('should compute correct HMAC SHA-256 signature', () => {
      const secret = 'test-secret';
      const payload = '{"test":"data"}';

      const signature = computeWebhookSignature(secret, payload);

      // Verify format
      expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);

      // Verify correctness by computing manually
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(payload, 'utf8');
      const expected = `sha256=${hmac.digest('hex')}`;

      expect(signature).toBe(expected);
    });

    test('should produce consistent signatures for same input', () => {
      const secret = 'my-webhook-secret';
      const payload = '{"event":"pull_request","action":"opened"}';

      const signature1 = computeWebhookSignature(secret, payload);
      const signature2 = computeWebhookSignature(secret, payload);

      expect(signature1).toBe(signature2);
    });

    test('should produce different signatures for different secrets', () => {
      const payload = '{"test":"data"}';

      const signature1 = computeWebhookSignature('secret1', payload);
      const signature2 = computeWebhookSignature('secret2', payload);

      expect(signature1).not.toBe(signature2);
    });

    test('should produce different signatures for different payloads', () => {
      const secret = 'test-secret';

      const signature1 = computeWebhookSignature(secret, '{"test":"data1"}');
      const signature2 = computeWebhookSignature(secret, '{"test":"data2"}');

      expect(signature1).not.toBe(signature2);
    });

    test('should handle payloads with special characters', () => {
      const secret = 'test-secret';
      const payload = '{"text":"Hello 世界! 🚀"}';

      const signature = computeWebhookSignature(secret, payload);

      expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);
    });
  });
});
