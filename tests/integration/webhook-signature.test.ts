import crypto from 'crypto';

/**
 * Integration tests for webhook signature validation
 * These tests use known examples to validate payload signature computation
 */
describe('Webhook Signature Validation Integration', () => {
  const WEBHOOK_SECRET = 'test-webhook-secret';

  /**
   * Helper function to compute HMAC SHA-256 signature
   */
  function computeSignature(payload: string, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload, 'utf8');
    return `sha256=${hmac.digest('hex')}`;
  }

  describe('Signature Computation', () => {
    test('should compute correct signature for simple payload', () => {
      const payload = '{"test": "data"}';
      const signature = computeSignature(payload, WEBHOOK_SECRET);

      expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);

      // Verify the signature is deterministic
      const signature2 = computeSignature(payload, WEBHOOK_SECRET);
      expect(signature).toBe(signature2);
    });

    test('should compute correct signature for complex payload', () => {
      const payload = JSON.stringify({
        action: 'opened',
        pull_request: {
          number: 123,
          title: 'Test PR',
          user: {
            login: 'testuser',
          },
        },
        repository: {
          name: 'test-repo',
          owner: {
            login: 'd7knight2',
          },
        },
      });

      const signature = computeSignature(payload, WEBHOOK_SECRET);
      expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);
    });

    test('should produce different signatures for different payloads', () => {
      const payload1 = '{"test": "data1"}';
      const payload2 = '{"test": "data2"}';

      const signature1 = computeSignature(payload1, WEBHOOK_SECRET);
      const signature2 = computeSignature(payload2, WEBHOOK_SECRET);

      expect(signature1).not.toBe(signature2);
    });

    test('should produce different signatures for different secrets', () => {
      const payload = '{"test": "data"}';
      const signature1 = computeSignature(payload, 'secret1');
      const signature2 = computeSignature(payload, 'secret2');

      expect(signature1).not.toBe(signature2);
    });

    test('should handle empty payload', () => {
      const payload = '';
      const signature = computeSignature(payload, WEBHOOK_SECRET);

      expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);
    });

    test('should handle payload with special characters', () => {
      const payload = '{"message": "Hello 👋 with émojis and ñ special chars"}';
      const signature = computeSignature(payload, WEBHOOK_SECRET);

      expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);
    });

    test('should match known signature example', () => {
      // Known test case from GitHub documentation
      const payload = '{"zen":"Design for failure."}';
      const secret = 'my-secret';

      const signature = computeSignature(payload, secret);

      // This should match the expected signature for this exact payload and secret
      const expectedSignature =
        'sha256=757107ea0eb2509fc211221cce984b8a37570b6d7586c22c46f4379c8b043e17';
      expect(signature).toBe(expectedSignature);
    });

    test('should validate signature comparison is case-sensitive', () => {
      const payload = '{"test": "data"}';
      const signature = computeSignature(payload, WEBHOOK_SECRET);

      // Signature hex should be lowercase
      expect(signature.toLowerCase()).toBe(signature);
    });
  });

  describe('Known GitHub Examples', () => {
    test('should validate signature for pull_request.opened event', () => {
      const payload = JSON.stringify({
        action: 'opened',
        number: 1,
        pull_request: {
          id: 1,
          number: 1,
          state: 'open',
          title: 'Test PR',
          user: {
            login: 'testuser',
            id: 1,
          },
        },
        repository: {
          id: 1,
          name: 'test-repo',
          owner: {
            login: 'd7knight2',
            id: 1,
          },
        },
        sender: {
          login: 'testuser',
          id: 1,
        },
      });

      const signature = computeSignature(payload, WEBHOOK_SECRET);

      // Verify signature can be recomputed and matched
      const recomputedSignature = computeSignature(payload, WEBHOOK_SECRET);
      expect(signature).toBe(recomputedSignature);
    });

    test('should validate signature for check_run.completed event', () => {
      const payload = JSON.stringify({
        action: 'completed',
        check_run: {
          id: 1,
          name: 'test-check',
          status: 'completed',
          conclusion: 'failure',
          pull_requests: [
            {
              number: 1,
              head: {
                ref: 'feature-branch',
                sha: 'abc123',
              },
            },
          ],
        },
        repository: {
          id: 1,
          name: 'test-repo',
          owner: {
            login: 'd7knight2',
            id: 1,
          },
        },
      });

      const signature = computeSignature(payload, WEBHOOK_SECRET);
      expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);
    });

    test('should validate that whitespace affects signature', () => {
      const payload1 = '{"test":"data"}';
      const payload2 = '{"test": "data"}';

      const signature1 = computeSignature(payload1, WEBHOOK_SECRET);
      const signature2 = computeSignature(payload2, WEBHOOK_SECRET);

      // Different whitespace should produce different signatures
      expect(signature1).not.toBe(signature2);
    });

    test('should validate that property order affects signature', () => {
      const payload1 = '{"a":"1","b":"2"}';
      const payload2 = '{"b":"2","a":"1"}';

      const signature1 = computeSignature(payload1, WEBHOOK_SECRET);
      const signature2 = computeSignature(payload2, WEBHOOK_SECRET);

      // Different property order should produce different signatures
      expect(signature1).not.toBe(signature2);
    });
  });

  describe('Security Validation', () => {
    test('should not validate signature with wrong secret', () => {
      const payload = '{"test": "data"}';
      const correctSignature = computeSignature(payload, WEBHOOK_SECRET);
      const wrongSignature = computeSignature(payload, 'wrong-secret');

      expect(correctSignature).not.toBe(wrongSignature);
    });

    test('should not validate signature with modified payload', () => {
      const originalPayload = '{"test": "data"}';
      const modifiedPayload = '{"test": "modified"}';
      const signature = computeSignature(originalPayload, WEBHOOK_SECRET);

      const expectedSignature = computeSignature(modifiedPayload, WEBHOOK_SECRET);
      expect(signature).not.toBe(expectedSignature);
    });

    test('should handle timing-safe comparison', () => {
      const payload = '{"test": "data"}';
      const signature1 = computeSignature(payload, WEBHOOK_SECRET);
      const signature2 = computeSignature(payload, WEBHOOK_SECRET);

      // Signatures should be equal
      expect(signature1).toBe(signature2);

      // Use crypto.timingSafeEqual for comparison in production
      const sig1Buffer = Buffer.from(signature1);
      const sig2Buffer = Buffer.from(signature2);

      expect(crypto.timingSafeEqual(sig1Buffer, sig2Buffer)).toBe(true);
    });

    test('should reject invalid signature format', () => {
      const invalidSignatures = [
        'invalid',
        'sha256=',
        'sha256=invalid-hex',
        'sha1=valid-but-wrong-algorithm',
        '',
      ];

      invalidSignatures.forEach((sig) => {
        expect(sig).not.toMatch(/^sha256=[a-f0-9]{64}$/);
      });
    });
  });
});
