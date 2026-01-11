import { test, expect } from '@playwright/test';

test.describe('CiKnight API Endpoints', () => {
  test('should return service information on root endpoint', async ({ request }) => {
    const response = await request.get('/');
    
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.name).toBe('CiKnight');
    expect(data.status).toBe('running');
    expect(data.version).toBeDefined();
    expect(data.description).toContain('GitHub App');
  });

  test('should return healthy status on health endpoint', async ({ request }) => {
    const response = await request.get('/health');
    
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.status).toBe('healthy');
  });

  test('should handle missing webhook headers', async ({ request }) => {
    const response = await request.post('/webhook', {
      data: { test: 'data' },
    });
    
    expect(response.status()).toBe(400);
    
    const data = await response.json();
    expect(data.error).toContain('Missing required webhook headers');
  });

  test('should reject webhook with invalid signature', async ({ request }) => {
    const response = await request.post('/webhook', {
      headers: {
        'x-hub-signature-256': 'sha256=invalid',
        'x-github-event': 'ping',
        'x-github-delivery': '12345',
      },
      data: { test: 'data' },
    });
    
    // Should fail verification
    expect(response.status()).toBe(500);
  });

  test('should handle rate limiting', async ({ request }) => {
    // Make multiple requests quickly to trigger rate limit
    const requests = [];
    for (let i = 0; i < 101; i++) {
      requests.push(
        request.post('/webhook', {
          headers: {
            'x-hub-signature-256': 'sha256=test',
            'x-github-event': 'ping',
            'x-github-delivery': `delivery-${i}`,
          },
          data: {},
        })
      );
    }

    const responses = await Promise.all(requests);
    
    // At least one should be rate limited (429)
    const rateLimited = responses.some(r => r.status() === 429);
    expect(rateLimited).toBeTruthy();
  });
});

test.describe('CiKnight Error Handling', () => {
  test('should handle malformed JSON', async ({ request }) => {
    const response = await request.post('/webhook', {
      headers: {
        'content-type': 'application/json',
        'x-hub-signature-256': 'sha256=test',
        'x-github-event': 'ping',
        'x-github-delivery': '12345',
      },
      data: 'not-json',
    });
    
    // Should handle error gracefully
    expect([400, 500]).toContain(response.status());
  });

  test('should respond to non-existent routes', async ({ request }) => {
    const response = await request.get('/non-existent-route');
    
    expect(response.status()).toBe(404);
  });
});
