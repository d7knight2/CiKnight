import { Request, Response } from 'express';

// Set environment variable before importing webhook
process.env.GITHUB_WEBHOOK_SECRET = 'test-webhook-secret';

// Create mock verifyAndReceive function
const mockVerifyAndReceive = jest.fn().mockResolvedValue(undefined);

// Mock the webhooks verifyAndReceive
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
          '✅ Webhook verified and processed successfully: pull_request (test-delivery-id)'
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
          "🚫 Unauthorized webhook: Repository owner 'other-user' is not 'd7knight2'"
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
    });
  });

  describe('Invalid Payload Handling', () => {
    test('should return 400 for invalid JSON in pull_request payload', async () => {
      (mockRequest as any).rawBody = 'invalid json {not valid';

      await webhookHandler(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Invalid JSON payload' });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error parsing webhook payload:'),
        expect.any(Error)
      );
    });

    test('should return 400 for malformed JSON in pull_request payload', async () => {
      (mockRequest as any).rawBody = '{"incomplete": true';

      await webhookHandler(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Invalid JSON payload' });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error parsing webhook payload:'),
        expect.any(Error)
      );
    });

    test('should handle valid JSON but missing required fields', async () => {
      const payload = {
        pull_request: {
          number: 123,
        },
        // Missing repository field
      };

      (mockRequest as any).rawBody = JSON.stringify(payload);

      await webhookHandler(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Missing repository owner information' });
    });
  });

  describe('Error Resilience', () => {
    test('should handle errors in verifyAndReceive gracefully', async () => {
      mockVerifyAndReceive.mockRejectedValueOnce(new Error('Signature verification failed'));

      const payload = {
        pull_request: {
          number: 123,
        },
        repository: {
          owner: {
            login: 'd7knight2',
          },
          name: 'TestRepo',
        },
      };

      (mockRequest as any).rawBody = JSON.stringify(payload);

      await webhookHandler(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Internal server error',
        message: 'Signature verification failed',
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error processing webhook:'),
        expect.any(Error)
      );

      // Reset mock for other tests
      mockVerifyAndReceive.mockResolvedValue(undefined);
    });

    test('should handle async errors without double-sending response', async () => {
      mockVerifyAndReceive.mockRejectedValueOnce(new Error('Async processing error'));

      const payload = {
        push: {
          ref: 'refs/heads/main',
        },
        repository: {
          owner: {
            login: 'some-user',
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

      // Should only send response once
      expect(statusMock).toHaveBeenCalledTimes(1);
      expect(jsonMock).toHaveBeenCalledTimes(1);
      expect(statusMock).toHaveBeenCalledWith(500);

      // Reset mock for other tests
      mockVerifyAndReceive.mockResolvedValue(undefined);
    });

    test('should handle unhandled promise rejections in webhook processing', async () => {
      // Simulate an unhandled rejection
      mockVerifyAndReceive.mockRejectedValueOnce(
        Object.assign(new Error('Unhandled rejection'), { unhandledRejection: true })
      );

      const payload = {
        check_run: {
          name: 'Test Check',
          conclusion: 'success',
        },
        repository: {
          owner: {
            login: 'test-owner',
          },
          name: 'TestRepo',
        },
      };

      mockRequest.headers = {
        ...mockRequest.headers,
        'x-github-event': 'check_run',
      };

      (mockRequest as any).rawBody = JSON.stringify(payload);

      await webhookHandler(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Internal server error',
        message: 'Unhandled rejection',
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error processing webhook:'),
        expect.objectContaining({ message: 'Unhandled rejection' })
      );

      // Reset mock for other tests
      mockVerifyAndReceive.mockResolvedValue(undefined);
    });

    test('should not send response twice if error occurs after response sent', async () => {
      // This test ensures the response tracking prevents double-send
      const payload = {
        pull_request: {
          number: 123,
        },
        repository: {
          owner: {
            login: 'd7knight2',
          },
        },
      };

      (mockRequest as any).rawBody = JSON.stringify(payload);

      // Mock verifyAndReceive to succeed
      mockVerifyAndReceive.mockResolvedValueOnce(undefined);

      await webhookHandler(mockRequest as Request, mockResponse as Response);

      // Verify response sent exactly once
      expect(statusMock).toHaveBeenCalledTimes(1);
      expect(jsonMock).toHaveBeenCalledTimes(1);
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({ message: 'Webhook received' });
    });
  });

  describe('Debug Logging', () => {
    test('should log webhook debug information on successful request', async () => {
      const payload = {
        pull_request: {
          number: 123,
        },
        repository: {
          owner: {
            login: 'd7knight2',
          },
          name: 'CiKnight',
        },
      };

      (mockRequest as any).rawBody = JSON.stringify(payload);

      await webhookHandler(mockRequest as Request, mockResponse as Response);

      // Verify debug logs are present
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔍 [Webhook Debug] Delivery ID: test-delivery-id')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔍 [Webhook Debug] Payload length:')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔍 [Webhook Debug] Received signature: sha256=test-signature')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔍 [Webhook Debug] Webhook secret configured: Yes')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔍 [Webhook Debug] Signatures match:')
      );
    });

    test('should log signature verification failure details', async () => {
      mockVerifyAndReceive.mockRejectedValueOnce(
        new Error('[@octokit/webhooks] signature does not match event payload and secret')
      );

      const payload = {
        pull_request: {
          number: 123,
        },
        repository: {
          owner: {
            login: 'd7knight2',
          },
          name: 'TestRepo',
        },
      };

      (mockRequest as any).rawBody = JSON.stringify(payload);

      await webhookHandler(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error processing webhook:'),
        expect.any(Error)
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '🔍 [Webhook Debug] Signature verification failed!'
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔍 [Webhook Debug] Error details:')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith('🔍 [Webhook Debug] Possible causes:');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('1. Webhook secret mismatch')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('2. Payload was modified')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('3. Encoding issues'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('4. Trailing spaces or newlines')
      );

      // Reset mock for other tests
      mockVerifyAndReceive.mockResolvedValue(undefined);
    });

    test('should log error when headers are missing', async () => {
      mockRequest.headers = {};

      await webhookHandler(mockRequest as Request, mockResponse as Response);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ [Webhook Debug] Missing required headers:',
        expect.objectContaining({
          hasSignature: false,
          hasEvent: false,
          hasId: false,
        })
      );
    });

    test('should log error when rawBody is missing', async () => {
      (mockRequest as any).rawBody = undefined;

      await webhookHandler(mockRequest as Request, mockResponse as Response);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ [Webhook Debug] Missing raw body for verification'
      );
    });

    test('should log payload length and preview', async () => {
      const payload = {
        test: 'data',
        nested: {
          value: 123,
        },
      };
      const payloadStr = JSON.stringify(payload);

      mockRequest.headers = {
        ...mockRequest.headers,
        'x-github-event': 'push',
      };
      (mockRequest as any).rawBody = payloadStr;

      await webhookHandler(mockRequest as Request, mockResponse as Response);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        `🔍 [Webhook Debug] Payload length: ${payloadStr.length} bytes`
      );
    });

    test('should log computed signature only when signatures do not match', async () => {
      const payload = {
        test: 'data',
      };

      mockRequest.headers = {
        ...mockRequest.headers,
        'x-github-event': 'push',
      };
      (mockRequest as any).rawBody = JSON.stringify(payload);

      await webhookHandler(mockRequest as Request, mockResponse as Response);

      // Since this is a mismatch (test signature doesn't match computed), should log computed signature
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔍 [Webhook Debug] Signatures match: ❌ No')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔍 [Webhook Debug] Computed signature:')
      );
    });

    test('should log webhook secret configuration status', async () => {
      const payload = {
        repository: {
          owner: { login: 'test' },
        },
      };

      mockRequest.headers = {
        ...mockRequest.headers,
        'x-github-event': 'push',
      };
      (mockRequest as any).rawBody = JSON.stringify(payload);

      await webhookHandler(mockRequest as Request, mockResponse as Response);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔍 [Webhook Debug] Webhook secret configured: Yes')
      );
    });

    test('should only log computed signature when there is a mismatch', async () => {
      const payload = {
        pull_request: {
          number: 123,
        },
        repository: {
          owner: {
            login: 'd7knight2',
          },
          name: 'TestRepo',
        },
      };

      (mockRequest as any).rawBody = JSON.stringify(payload);

      await webhookHandler(mockRequest as Request, mockResponse as Response);

      // Should log that signatures don't match
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔍 [Webhook Debug] Signatures match: ❌ No')
      );
      // Should log the computed signature for comparison
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔍 [Webhook Debug] Computed signature:')
      );
    });
  });
});
