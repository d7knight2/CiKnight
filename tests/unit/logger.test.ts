import { Logger } from '../../src/utils/logger';

describe('Logger', () => {
  let testLogger: Logger;
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  const originalDebug = process.env.DEBUG;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    process.env.DEBUG = originalDebug;
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('Debug Mode', () => {
    test('should enable debug mode when DEBUG=true', () => {
      process.env.DEBUG = 'true';
      // Need to reimport to pick up new env
      jest.resetModules();
      const { logger: newLogger } = require('../../src/utils/logger');
      expect(newLogger.isDebugEnabled()).toBe(true);
    });

    test('should enable debug mode in development environment', () => {
      process.env.DEBUG = undefined;
      process.env.NODE_ENV = 'development';
      jest.resetModules();
      const { logger: newLogger } = require('../../src/utils/logger');
      expect(newLogger.isDebugEnabled()).toBe(true);
    });

    test('should disable debug mode by default', () => {
      process.env.DEBUG = undefined;
      process.env.NODE_ENV = 'production';
      jest.resetModules();
      const { logger: newLogger } = require('../../src/utils/logger');
      expect(newLogger.isDebugEnabled()).toBe(false);
    });

    test('should allow programmatic debug mode control', () => {
      jest.resetModules();
      const { logger: newLogger } = require('../../src/utils/logger');

      newLogger.setDebugMode(true);
      expect(newLogger.isDebugEnabled()).toBe(true);

      newLogger.setDebugMode(false);
      expect(newLogger.isDebugEnabled()).toBe(false);
    });
  });

  describe('Logging Methods', () => {
    beforeEach(() => {
      jest.resetModules();
      const loggerModule = require('../../src/utils/logger');
      testLogger = loggerModule.logger;
    });

    test('should log info messages', () => {
      testLogger.info('Test message');
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const logOutput = consoleLogSpy.mock.calls[0][0];
      expect(logOutput).toContain('INFO');
      expect(logOutput).toContain('Test message');
      expect(logOutput).toContain('📝');
    });

    test('should log info messages with context', () => {
      testLogger.info('Test message', { userId: 123, action: 'login' });
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const logOutput = consoleLogSpy.mock.calls[0][0];
      expect(logOutput).toContain('Test message');
      expect(logOutput).toContain('userId');
      expect(logOutput).toContain('123');
      expect(logOutput).toContain('action');
      expect(logOutput).toContain('login');
    });

    test('should log warning messages', () => {
      testLogger.warn('Warning message');
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      const logOutput = consoleWarnSpy.mock.calls[0][0];
      expect(logOutput).toContain('WARN');
      expect(logOutput).toContain('Warning message');
      expect(logOutput).toContain('⚠️');
    });

    test('should log error messages', () => {
      testLogger.error('Error message');
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const logOutput = consoleErrorSpy.mock.calls[0][0];
      expect(logOutput).toContain('ERROR');
      expect(logOutput).toContain('Error message');
      expect(logOutput).toContain('❌');
    });

    test('should only log debug messages when debug mode is enabled', () => {
      testLogger.setDebugMode(false);
      testLogger.debug('Debug message');
      expect(consoleLogSpy).not.toHaveBeenCalled();

      testLogger.setDebugMode(true);
      testLogger.debug('Debug message');
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const logOutput = consoleLogSpy.mock.calls[0][0];
      expect(logOutput).toContain('DEBUG');
      expect(logOutput).toContain('Debug message');
      expect(logOutput).toContain('🔍');
    });
  });

  describe('Webhook Logging', () => {
    beforeEach(() => {
      jest.resetModules();
      const loggerModule = require('../../src/utils/logger');
      testLogger = loggerModule.logger;
    });

    test('should log webhook events with structured context', () => {
      testLogger.webhook('Pull request opened', {
        event: 'pull_request',
        deliveryId: 'test-123',
        action: 'opened',
        repoOwner: 'd7knight2',
        repoName: 'CiKnight',
        prNumber: 42,
      });

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const logOutput = consoleLogSpy.mock.calls[0][0];
      expect(logOutput).toContain('Webhook: Pull request opened');
      expect(logOutput).toContain('pull_request');
      expect(logOutput).toContain('test-123');
      expect(logOutput).toContain('opened');
      expect(logOutput).toContain('d7knight2');
      expect(logOutput).toContain('CiKnight');
      expect(logOutput).toContain('42');
      expect(logOutput).toContain('🔔');
    });

    test('should log webhook events without optional context', () => {
      testLogger.webhook('Webhook received', {});
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const logOutput = consoleLogSpy.mock.calls[0][0];
      expect(logOutput).toContain('Webhook: Webhook received');
    });
  });

  describe('Security Logging', () => {
    beforeEach(() => {
      jest.resetModules();
      const loggerModule = require('../../src/utils/logger');
      testLogger = loggerModule.logger;
    });

    test('should log security events', () => {
      testLogger.security('Unauthorized access attempt', {
        ip: '192.168.1.1',
        reason: 'invalid_signature',
      });

      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      const logOutput = consoleWarnSpy.mock.calls[0][0];
      expect(logOutput).toContain('Security: Unauthorized access attempt');
      expect(logOutput).toContain('192.168.1.1');
      expect(logOutput).toContain('invalid_signature');
      expect(logOutput).toContain('🔒');
    });
  });

  describe('Log Format', () => {
    beforeEach(() => {
      jest.resetModules();
      const loggerModule = require('../../src/utils/logger');
      testLogger = loggerModule.logger;
    });

    test('should include timestamp in ISO format', () => {
      testLogger.info('Test');
      const logOutput = consoleLogSpy.mock.calls[0][0];
      // Check for ISO timestamp pattern
      expect(logOutput).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);
    });

    test('should include log level', () => {
      testLogger.info('Test');
      const logOutput = consoleLogSpy.mock.calls[0][0];
      expect(logOutput).toContain('INFO');
    });

    test('should handle empty context', () => {
      testLogger.info('Test', {});
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const logOutput = consoleLogSpy.mock.calls[0][0];
      expect(logOutput).toContain('Test');
      // Empty context should not add extra JSON
      expect(logOutput).not.toMatch(/\|\s*{}/);
    });
  });
});
