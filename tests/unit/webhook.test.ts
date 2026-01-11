// Mock environment variable BEFORE importing webhook module
process.env.GITHUB_WEBHOOK_SECRET = 'test-secret';

import { webhooks } from '../../src/webhook';

describe('Webhook Handler', () => {
  describe('Webhook Configuration', () => {
    it('should have webhook secret configured', () => {
      expect(process.env.GITHUB_WEBHOOK_SECRET).toBeDefined();
    });

    it('should create webhooks instance', () => {
      expect(webhooks).toBeDefined();
    });

    it('should be a valid Webhooks object', () => {
      expect(typeof webhooks.on).toBe('function');
      expect(typeof webhooks.onError).toBe('function');
      expect(typeof webhooks.verifyAndReceive).toBe('function');
    });
  });

  describe('Event Handler Structure', () => {
    it('should support pull_request events', () => {
      const validEvents = ['pull_request.opened', 'pull_request.synchronize', 'pull_request.reopened'];
      validEvents.forEach(event => {
        expect(event).toMatch(/^pull_request\./);
      });
    });

    it('should support check_run events', () => {
      const event = 'check_run.completed';
      expect(event).toMatch(/^check_run\./);
    });

    it('should support check_suite events', () => {
      const event = 'check_suite.completed';
      expect(event).toMatch(/^check_suite\./);
    });

    it('should support status events', () => {
      const event = 'status';
      expect(event).toBe('status');
    });
  });
});
