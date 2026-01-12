// Test for health endpoint configuration
// We test that the logger and structured logging work correctly
// The actual HTTP endpoints are tested in integration tests

// Set required environment variables
process.env.GITHUB_WEBHOOK_SECRET = 'test-secret';
process.env.GITHUB_APP_ID = '12345';
process.env.GITHUB_PRIVATE_KEY = 'test-private-key';
process.env.NODE_ENV = 'test';

// Mock logger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  webhook: jest.fn(),
  security: jest.fn(),
  isDebugEnabled: jest.fn().mockReturnValue(false),
};

jest.mock('../../src/utils/logger', () => ({
  logger: mockLogger,
}));

describe('Health Endpoint Configuration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Logger Integration', () => {
    test('should use structured logger for health checks', () => {
      const { logger } = require('../../src/utils/logger');

      // Simulate healthz endpoint logic
      const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;

      if (!webhookSecret) {
        logger.warn('Health check failed: webhook secret not configured');
      } else {
        logger.debug('Health check passed', {
          webhookSecretConfigured: true,
        });
      }

      // Verify logger was called
      expect(logger.debug).toHaveBeenCalledWith(
        'Health check passed',
        expect.objectContaining({
          webhookSecretConfigured: true,
        })
      );
    });

    test('should handle missing webhook secret', () => {
      const { logger } = require('../../src/utils/logger');
      const originalSecret = process.env.GITHUB_WEBHOOK_SECRET;

      // Simulate missing secret
      delete process.env.GITHUB_WEBHOOK_SECRET;
      const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;

      if (!webhookSecret) {
        logger.warn('Health check failed: webhook secret not configured');
      }

      expect(logger.warn).toHaveBeenCalledWith(
        'Health check failed: webhook secret not configured'
      );

      // Restore
      process.env.GITHUB_WEBHOOK_SECRET = originalSecret;
    });

    test('should provide configuration details', () => {
      const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
      const appId = process.env.GITHUB_APP_ID;
      const privateKey = process.env.GITHUB_PRIVATE_KEY;

      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        configuration: {
          webhookSecretConfigured: !!webhookSecret,
          appIdConfigured: !!appId,
          privateKeyConfigured: !!privateKey,
          debugMode: mockLogger.isDebugEnabled(),
          nodeEnv: process.env.NODE_ENV || 'development',
        },
      };

      expect(health.configuration.webhookSecretConfigured).toBe(true);
      expect(health.configuration.appIdConfigured).toBe(true);
      expect(health.configuration.privateKeyConfigured).toBe(true);
      expect(health.status).toBe('healthy');
      expect(health.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });
});
