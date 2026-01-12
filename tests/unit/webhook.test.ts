import { Request, Response } from 'express';

// Set environment variable before importing webhook
process.env.GITHUB_WEBHOOK_SECRET = 'test-webhook-secret';

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    webhook: jest.fn(),
    security: jest.fn(),
    isDebugEnabled: jest.fn().mockReturnValue(false),
  },
}));

// Mock the webhooks verifyAndReceive
jest.mock('@octokit/webhooks', () => {
  return {
    Webhooks: jest.fn().mockImplementation(() => ({
      on: jest.fn(),
      onError: jest.fn(),
      verifyAndReceive: jest.fn().mockResolvedValue(undefined),
    })),
  };
});

import { webhookHandler } from '../../src/webhook';
import { logger } from '../../src/utils/logger';

describe('Webhook Handler', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn().mockReturnThis();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    mockResponse = {
      status: statusMock,
      json: jsonMock,
    };

    mockRequest = {
      headers: {
        'x-hub-signature-256': 'sha256=test-signature',
        'x-github-event': 'pull_request',
        'x-github-delivery': 'test-delivery-id',
      },
    };

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('Owner Verification', () => {
    test('should accept pull_request webhook from d7knight2 repository', async () => {
      const payload = {
        pull_request: {
          number: 123,
          user: {
            login: 'some-contributor',
          },
        },
        repository: {
          owner: {
            login: 'd7knight2',
          },
          name: 'CiKnight',
        },
        installation: {
          id: 12345,
        },
      };

      (mockRequest as any).rawBody = JSON.stringify(payload);

      await webhookHandler(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({ message: 'Webhook received' });
    });

    test('should reject pull_request webhook from non-d7knight2 repository with 403', async () => {
      const payload = {
        pull_request: {
          number: 123,
          user: {
            login: 'some-contributor',
          },
        },
        repository: {
          owner: {
            login: 'other-user',
          },
          name: 'SomeRepo',
        },
        installation: {
          id: 12345,
        },
      };

      (mockRequest as any).rawBody = JSON.stringify(payload);

      await webhookHandler(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'This GitHub App only processes pull requests for repositories owned by d7knight2',
      });
    });

    test('should return 400 when repository owner is missing in pull_request payload', async () => {
      const payload = {
        pull_request: {
          number: 123,
        },
        repository: {
          name: 'SomeRepo',
        },
      };

      (mockRequest as any).rawBody = JSON.stringify(payload);

      await webhookHandler(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Missing repository owner information' });
    });

    test('should allow non-pull_request events regardless of owner', async () => {
      const payload = {
        repository: {
          owner: {
            login: 'other-user',
          },
          name: 'SomeRepo',
        },
      };

      mockRequest.headers = {
        ...mockRequest.headers,
        'x-github-event': 'push',
      };

      (mockRequest as any).rawBody = JSON.stringify(payload);

      await webhookHandler(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({ message: 'Webhook received' });
    });

    test('should handle pull_request.opened event with d7knight2 owner', async () => {
      const payload = {
        pull_request: {
          number: 456,
          user: {
            login: 'contributor',
          },
        },
        repository: {
          owner: {
            login: 'd7knight2',
          },
          name: 'TestRepo',
        },
        installation: {
          id: 99999,
        },
      };

      mockRequest.headers = {
        ...mockRequest.headers,
        'x-github-event': 'pull_request.opened',
      };

      (mockRequest as any).rawBody = JSON.stringify(payload);

      await webhookHandler(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({ message: 'Webhook received' });
    });

    test('should handle pull_request.synchronize event with non-d7knight2 owner', async () => {
      const payload = {
        pull_request: {
          number: 789,
          user: {
            login: 'attacker',
          },
        },
        repository: {
          owner: {
            login: 'malicious-user',
          },
          name: 'BadRepo',
        },
        installation: {
          id: 11111,
        },
      };

      mockRequest.headers = {
        ...mockRequest.headers,
        'x-github-event': 'pull_request.synchronize',
      };

      (mockRequest as any).rawBody = JSON.stringify(payload);

      await webhookHandler(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'This GitHub App only processes pull requests for repositories owned by d7knight2',
      });
    });
  });

  describe('Basic Webhook Validation', () => {
    test('should return 400 when required headers are missing', async () => {
      mockRequest.headers = {};

      await webhookHandler(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Missing required webhook headers' });
    });

    test('should return 400 when rawBody is missing', async () => {
      (mockRequest as any).rawBody = undefined;

      await webhookHandler(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Missing raw body for verification',
        })
      );
      expect(logger.security).toHaveBeenCalled();
    });
  });

  describe('Signature Verification', () => {
    test('should log webhook with event name and delivery ID', async () => {
      const payload = {
        pull_request: { number: 123 },
        repository: {
          owner: { login: 'd7knight2' },
          name: 'CiKnight',
        },
      };

      (mockRequest as any).rawBody = JSON.stringify(payload);

      await webhookHandler(mockRequest as Request, mockResponse as Response);

      expect(logger.webhook).toHaveBeenCalledWith(
        'Incoming webhook',
        expect.objectContaining({
          event: 'pull_request',
          deliveryId: 'test-delivery-id',
        })
      );
    });

    test('should handle signature verification errors with enhanced logging', async () => {
      const payload = {
        pull_request: { number: 123 },
        repository: {
          owner: { login: 'd7knight2' },
          name: 'CiKnight',
        },
      };

      (mockRequest as any).rawBody = JSON.stringify(payload);

      // We need to reimport to get a fresh mock
      jest.resetModules();

      // Mock Webhooks with signature error
      jest.mock('@octokit/webhooks', () => ({
        Webhooks: jest.fn().mockImplementation(() => ({
          on: jest.fn(),
          onError: jest.fn(),
          verifyAndReceive: jest.fn().mockRejectedValue(new Error('signature does not match')),
        })),
      }));

      const { webhookHandler: testHandler } = require('../../src/webhook');

      await testHandler(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Webhook signature verification failed',
          suggestions: expect.any(Array),
        })
      );
    });

    test('should log debug information when debug mode is enabled', async () => {
      (logger.isDebugEnabled as jest.Mock).mockReturnValue(true);

      const payload = {
        pull_request: { number: 123 },
        repository: {
          owner: { login: 'd7knight2' },
          name: 'CiKnight',
        },
      };

      (mockRequest as any).rawBody = JSON.stringify(payload);

      await webhookHandler(mockRequest as Request, mockResponse as Response);

      expect(logger.debug).toHaveBeenCalledWith(
        'Webhook signature verification details',
        expect.objectContaining({
          receivedSignature: expect.any(String),
          expectedSignature: expect.any(String),
          payloadHash: expect.any(String),
        })
      );
    });
  });
});
