import { computeWebhookSignature } from '../../src/utils/helpers';
import crypto from 'crypto';

describe('Webhook Signature Validation', () => {
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

    test('should handle empty payload', () => {
      const secret = 'test-secret';
      const payload = '';

      const signature = computeWebhookSignature(secret, payload);

      expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);

      // Verify by computing manually
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(payload, 'utf8');
      const expected = `sha256=${hmac.digest('hex')}`;
      expect(signature).toBe(expected);
    });

    test('should handle payloads with special characters', () => {
      const secret = 'test-secret';
      const payload = '{"text":"Hello 世界! 🚀"}';

      const signature = computeWebhookSignature(secret, payload);

      expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);
    });

    test('should handle payloads with newlines and whitespace', () => {
      const secret = 'test-secret';
      const payload = '{\n  "test": "data",\n  "nested": {\n    "value": 123\n  }\n}';

      const signature = computeWebhookSignature(secret, payload);

      expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);
    });

    test('should handle very long payloads', () => {
      const secret = 'test-secret';
      const payload = JSON.stringify({ data: 'x'.repeat(10000) });

      const signature = computeWebhookSignature(secret, payload);

      expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);
    });

    test('should match GitHub webhook signature format', () => {
      // Simulate a real GitHub webhook scenario
      const secret = 'my-github-secret';
      const payload = JSON.stringify({
        action: 'opened',
        pull_request: {
          number: 123,
          title: 'Test PR',
        },
        repository: {
          owner: { login: 'd7knight2' },
          name: 'CiKnight',
        },
      });

      const computedSignature = computeWebhookSignature(secret, payload);

      // Verify signature can be validated
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(payload, 'utf8');
      const expectedHex = hmac.digest('hex');

      expect(computedSignature).toBe(`sha256=${expectedHex}`);
    });

    test('should handle secrets with special characters', () => {
      const secret = 'test!@#$%^&*()_+-=[]{}|;:,.<>?';
      const payload = '{"test":"data"}';

      const signature = computeWebhookSignature(secret, payload);

      expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);
    });

    test('should be case-sensitive for payload', () => {
      const secret = 'test-secret';

      const signature1 = computeWebhookSignature(secret, '{"Test":"Data"}');
      const signature2 = computeWebhookSignature(secret, '{"test":"data"}');

      expect(signature1).not.toBe(signature2);
    });

    test('should detect trailing spaces in payload', () => {
      const secret = 'test-secret';

      const signature1 = computeWebhookSignature(secret, '{"test":"data"}');
      const signature2 = computeWebhookSignature(secret, '{"test":"data"} ');

      expect(signature1).not.toBe(signature2);
    });

    test('should detect whitespace differences in payload', () => {
      const secret = 'test-secret';

      const signature1 = computeWebhookSignature(secret, '{"test":"data"}');
      const signature2 = computeWebhookSignature(secret, '{"test": "data"}');

      expect(signature1).not.toBe(signature2);
    });
  });

  describe('Signature Validation Scenarios', () => {
    test('should validate that signature mismatch is detected', () => {
      const secret = 'correct-secret';
      const payload = '{"test":"data"}';

      const correctSignature = computeWebhookSignature(secret, payload);
      const wrongSignature = computeWebhookSignature('wrong-secret', payload);

      expect(correctSignature).not.toBe(wrongSignature);
    });

    test('should validate that payload modification is detected', () => {
      const secret = 'test-secret';
      const originalPayload = '{"test":"data"}';
      const modifiedPayload = '{"test":"modified"}';

      const originalSignature = computeWebhookSignature(secret, originalPayload);
      const modifiedSignature = computeWebhookSignature(secret, modifiedPayload);

      expect(originalSignature).not.toBe(modifiedSignature);
    });

    test('should validate timing-safe comparison concept', () => {
      // This test verifies that signatures are consistent for timing-safe comparison
      const secret = 'test-secret';
      const payload = '{"test":"data"}';

      // Compute signature multiple times
      const signatures = Array.from({ length: 100 }, () =>
        computeWebhookSignature(secret, payload)
      );

      // All signatures should be identical
      const unique = new Set(signatures);
      expect(unique.size).toBe(1);
    });
  });
});
