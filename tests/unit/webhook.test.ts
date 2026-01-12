import { Request, Response } from 'express';

// Set environment variable before importing webhook
process.env.GITHUB_WEBHOOK_SECRET = 'test-webhook-secret';

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
});
