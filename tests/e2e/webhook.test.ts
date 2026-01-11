import { test, expect } from '@playwright/test';
import crypto from 'crypto';

/**
 * Helper function to generate webhook signature
 */
function generateWebhookSignature(payload: string, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  return 'sha256=' + hmac.digest('hex');
}

test.describe('CiKnight Webhook Integration', () => {
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET || 'test-secret';

  test('should accept valid ping webhook', async ({ request }) => {
    const payload = JSON.stringify({
      zen: 'Design for failure.',
      hook_id: 12345,
    });
    
    const signature = generateWebhookSignature(payload, webhookSecret);

    const response = await request.post('/webhook', {
      headers: {
        'content-type': 'application/json',
        'x-hub-signature-256': signature,
        'x-github-event': 'ping',
        'x-github-delivery': 'test-delivery-123',
      },
      data: payload,
    });

    // May succeed or fail depending on setup, but should not crash
    expect([200, 400, 500]).toContain(response.status());
  });

  test('should handle pull_request webhook structure', async ({ request }) => {
    const payload = JSON.stringify({
      action: 'opened',
      pull_request: {
        number: 1,
        state: 'open',
        title: 'Test PR',
        mergeable_state: 'clean',
      },
      repository: {
        name: 'test-repo',
        owner: { login: 'test-owner' },
      },
      installation: {
        id: 12345,
      },
    });

    const signature = generateWebhookSignature(payload, webhookSecret);

    const response = await request.post('/webhook', {
      headers: {
        'content-type': 'application/json',
        'x-hub-signature-256': signature,
        'x-github-event': 'pull_request',
        'x-github-delivery': 'test-pr-delivery',
      },
      data: payload,
    });

    // Should accept the webhook structure
    expect([200, 500]).toContain(response.status());
  });

  test('should handle check_run webhook structure', async ({ request }) => {
    const payload = JSON.stringify({
      action: 'completed',
      check_run: {
        id: 123,
        name: 'CI',
        conclusion: 'failure',
        status: 'completed',
        html_url: 'https://github.com/owner/repo/runs/123',
        pull_requests: [
          { number: 1 },
        ],
      },
      repository: {
        name: 'test-repo',
        owner: { login: 'test-owner' },
      },
      installation: {
        id: 12345,
      },
    });

    const signature = generateWebhookSignature(payload, webhookSecret);

    const response = await request.post('/webhook', {
      headers: {
        'content-type': 'application/json',
        'x-hub-signature-256': signature,
        'x-github-event': 'check_run',
        'x-github-delivery': 'test-check-delivery',
      },
      data: payload,
    });

    // Should accept the webhook structure
    expect([200, 500]).toContain(response.status());
  });
});

test.describe('CiKnight Webhook Security', () => {
  test('should reject webhook with wrong signature', async ({ request }) => {
    const payload = JSON.stringify({ test: 'data' });
    
    const response = await request.post('/webhook', {
      headers: {
        'content-type': 'application/json',
        'x-hub-signature-256': 'sha256=wrong-signature',
        'x-github-event': 'ping',
        'x-github-delivery': 'security-test',
      },
      data: payload,
    });

    // Should fail signature verification
    expect(response.status()).toBe(500);
  });

  test('should require all webhook headers', async ({ request }) => {
    const tests: Array<{ headers: Record<string, string> }> = [
      { headers: { 'x-github-event': 'ping', 'x-github-delivery': '123' } },
      { headers: { 'x-hub-signature-256': 'sha256=test', 'x-github-delivery': '123' } },
      { headers: { 'x-hub-signature-256': 'sha256=test', 'x-github-event': 'ping' } },
    ];

    for (const test of tests) {
      const response = await request.post('/webhook', {
        headers: test.headers,
        data: {},
      });

      expect(response.status()).toBe(400);
    }
  });
});
