import { Request, Response } from 'express';

// Set environment variable before importing webhook
process.env.GITHUB_WEBHOOK_SECRET = 'test-webhook-secret';

// Mock crypto for signature testing
jest.mock('crypto', () => {
  const actualCrypto = jest.requireActual('crypto');
  return {
    ...actualCrypto,
    createHmac: jest.fn((algorithm: string, secret: string) => {
      const hmac = actualCrypto.createHmac(algorithm, secret);
      return hmac;
    }),
  };
});

// Mock the webhooks verifyAndReceive
const mockVerifyAndReceive = jest.fn().mockResolvedValue(undefined);
jest.mock('@octokit/webhooks', () => {
  return {
    Webhooks: jest.fn().mockImplementation(() => ({
      on: jest.fn(),
      onError: jest.fn(),
      verifyAndReceive: mockVerifyAndReceive,
    })),
  };
});

// Mock the handler functions
jest.mock('../../src/github/pull-request', () => ({
  handlePullRequest: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/github/check-run', () => ({
  handleCheckRun: jest.fn().mockResolvedValue(undefined),
}));

import { webhookHandler } from '../../src/webhook';

describe('Webhook Handler', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

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

    // Spy on console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    // Reset environment variable
    delete process.env.WEBHOOK_DEBUG;
  });

  describe('Owner Verification', () => {
    test('should accept pull_request webhook from d7knight2 repository and log success', async () => {
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
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '📬 Webhook received: event=pull_request, delivery_id=test-delivery-id'
        )
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '✅ Webhook verified and processed: event=pull_request, delivery_id=test-delivery-id'
        )
      );
    });

    test('should reject pull_request webhook from non-d7knight2 repository with 403 and log warning', async () => {
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
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '🚫 Unauthorized webhook: event=pull_request, delivery_id=test-delivery-id, owner=other-user (expected: d7knight2)'
        )
      );
    });

    test('should return 400 when repository owner is missing in pull_request payload and log warning', async () => {
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
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️  Missing repository owner in payload')
      );
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
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Missing raw body for verification' });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Missing raw body for verification')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('💡 Ensure express.json() uses the "verify" option')
      );
    });

    test('should log missing headers with details', async () => {
      mockRequest.headers = {
        'x-github-event': 'push',
        'x-github-delivery': 'test-id',
      };

      await webhookHandler(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('signature=false'));
    });
  });

  describe('Enhanced Logging', () => {
    test('should log event name and delivery ID for all webhook attempts', async () => {
      const payload = {
        repository: {
          owner: {
            login: 'd7knight2',
          },
        },
      };

      mockRequest.headers = {
        ...mockRequest.headers,
        'x-github-event': 'push',
      };

      (mockRequest as any).rawBody = JSON.stringify(payload);

      await webhookHandler(mockRequest as Request, mockResponse as Response);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('📬 Webhook received: event=push, delivery_id=test-delivery-id')
      );
    });

    test('should log structured success message with event and delivery ID', async () => {
      const payload = {
        repository: {
          owner: {
            login: 'd7knight2',
          },
        },
      };

      mockRequest.headers = {
        ...mockRequest.headers,
        'x-github-event': 'check_run',
      };

      (mockRequest as any).rawBody = JSON.stringify(payload);

      await webhookHandler(mockRequest as Request, mockResponse as Response);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '✅ Webhook verified and processed: event=check_run, delivery_id=test-delivery-id'
        )
      );
    });
  });

  describe('Debug Mode', () => {
    test('should log debug information when WEBHOOK_DEBUG is enabled', async () => {
      process.env.WEBHOOK_DEBUG = 'true';

      const payload = {
        repository: {
          owner: {
            login: 'd7knight2',
          },
        },
      };

      mockRequest.headers = {
        ...mockRequest.headers,
        'x-github-event': 'push',
      };

      (mockRequest as any).rawBody = JSON.stringify(payload);

      await webhookHandler(mockRequest as Request, mockResponse as Response);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔍 [DEBUG] Webhook Verification Details:')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Event: push'));
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Delivery ID: test-delivery-id')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Received Signature:'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Expected Signature:'));
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Payload Hash (SHA-256):')
      );
    });

    test('should not log debug information when WEBHOOK_DEBUG is disabled', async () => {
      delete process.env.WEBHOOK_DEBUG;

      const payload = {
        repository: {
          owner: {
            login: 'd7knight2',
          },
        },
      };

      mockRequest.headers = {
        ...mockRequest.headers,
        'x-github-event': 'push',
      };

      (mockRequest as any).rawBody = JSON.stringify(payload);

      await webhookHandler(mockRequest as Request, mockResponse as Response);

      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('🔍 [DEBUG] Webhook Verification Details:')
      );
    });
  });

  describe('Signature Verification Failures', () => {
    test('should provide actionable suggestions on signature mismatch', async () => {
      const payload = {
        repository: {
          owner: {
            login: 'd7knight2',
          },
        },
      };

      mockRequest.headers = {
        ...mockRequest.headers,
        'x-github-event': 'push',
      };

      (mockRequest as any).rawBody = JSON.stringify(payload);

      // Simulate signature verification failure
      mockVerifyAndReceive.mockRejectedValueOnce(
        new Error('signature does not match event payload and secret')
      );

      await webhookHandler(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '❌ Webhook processing failed: event=push, delivery_id=test-delivery-id'
        )
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Signature mismatch detected')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('💡 Possible causes:'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Incorrect GITHUB_WEBHOOK_SECRET')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('💡 Enable WEBHOOK_DEBUG=true')
      );
    });

    test('should detect empty payload and suggest double-parsing issue when signature fails', async () => {
      mockRequest.headers = {
        ...mockRequest.headers,
        'x-github-event': 'push',
      };

      // Empty rawBody should return 400 before signature check
      (mockRequest as any).rawBody = '';

      await webhookHandler(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Missing raw body for verification')
      );
    });

    test('should log error details with event and delivery ID', async () => {
      const payload = {
        repository: {
          owner: {
            login: 'd7knight2',
          },
        },
      };

      mockRequest.headers = {
        ...mockRequest.headers,
        'x-github-event': 'push',
      };

      (mockRequest as any).rawBody = JSON.stringify(payload);

      mockVerifyAndReceive.mockRejectedValueOnce(new Error('Some error occurred'));

      await webhookHandler(mockRequest as Request, mockResponse as Response);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '❌ Webhook processing failed: event=push, delivery_id=test-delivery-id'
        )
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error: Some error occurred')
      );
    });
  });
});
