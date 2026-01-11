import { test, expect } from '@playwright/test';

test.describe('CiKnight API', () => {
  test('should respond with service information on root endpoint', async ({ request }) => {
    const response = await request.get('/');

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    const data = await response.json();

    expect(data).toHaveProperty('name', 'CiKnight');
    expect(data).toHaveProperty('version', '1.0.0');
    expect(data).toHaveProperty('status', 'running');
    expect(data).toHaveProperty('description');
  });

  test('should respond to health check endpoint', async ({ request }) => {
    const response = await request.get('/health');

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    const data = await response.json();

    expect(data).toHaveProperty('status', 'healthy');
  });

  test('should reject webhook requests without required headers', async ({ request }) => {
    const response = await request.post('/webhook', {
      data: { test: 'data' },
    });

    expect(response.status()).toBe(400);

    const data = await response.json();

    expect(data).toHaveProperty('error');
  });
});
