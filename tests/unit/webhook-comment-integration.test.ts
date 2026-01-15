import crypto from 'crypto';
import { Request, Response } from 'express';

/**
 * Integration tests for webhook invocations and PR comment posting
 * These tests simulate actual webhook requests and verify comment posting behavior
 */

// Set required environment variables
process.env.GITHUB_WEBHOOK_SECRET = 'test-webhook-secret';
process.env.GITHUB_APP_ID = '123456';
process.env.GITHUB_PRIVATE_KEY =
  '-----BEGIN RSA PRIVATE KEY-----\nMIIBogIBAAJBALRiMLAA\n-----END RSA PRIVATE KEY-----';
process.env.ENABLE_WEBHOOK_TEST_COMMENTS = 'true'; // Enable test comments for tests

// Mock octokit before importing webhook handler
const mockCreateComment = jest.fn().mockResolvedValue({ data: { id: 1 } });
const mockGetPR = jest.fn().mockResolvedValue({
  data: {
    number: 1,
    mergeable_state: 'clean',
  },
});

jest.mock('@octokit/rest', () => {
  return {
    Octokit: jest.fn().mockImplementation(() => ({
      pulls: {
        get: mockGetPR,
      },
      issues: {
        createComment: mockCreateComment,
      },
    })),
  };
});

jest.mock('@octokit/auth-app', () => ({
  createAppAuth: jest.fn().mockReturnValue(() =>
    Promise.resolve({
      token: 'test-token',
    })
  ),
}));

import { webhookHandler } from '../../src/webhook';

describe('Webhook Integration Tests', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  const webhookSecret = 'test-webhook-secret';

  beforeEach(() => {
    jsonMock = jest.fn().mockReturnThis();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    mockResponse = {
      status: statusMock,
      json: jsonMock,
    };

    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  /**
   * Helper to compute webhook signature
   */
  function computeSignature(payload: string): string {
    const hmac = crypto.createHmac('sha256', webhookSecret);
    hmac.update(payload, 'utf8');
    return `sha256=${hmac.digest('hex')}`;
  }

  describe('Pull Request Comment Integration', () => {
    test('should post test comment and welcome comment when PR is opened', async () => {
      const payload = {
        action: 'opened',
        pull_request: {
          number: 123,
          title: 'Test PR',
          user: {
            login: 'testuser',
          },
        },
        repository: {
          name: 'test-repo',
          owner: {
            login: 'd7knight2',
          },
        },
        installation: {
          id: 12345,
        },
      };

      const rawBody = JSON.stringify(payload);
      const signature = computeSignature(rawBody);

      mockRequest = {
        headers: {
          'x-hub-signature-256': signature,
          'x-github-event': 'pull_request',
          'x-github-delivery': 'test-delivery-id',
        },
        rawBody,
      } as any;

      await webhookHandler(mockRequest as Request, mockResponse as Response);

      // Verify webhook was accepted
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({ message: 'Webhook received' });

      // Verify debug logs were created
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔍 [WEBHOOK DEBUG] Received webhook')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔍 [WEBHOOK DEBUG] Verifying signature')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('✅ [WEBHOOK DEBUG] Signature verified successfully')
      );

      // Wait for async comment posting to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify comments were posted (test comment + welcome comment)
      expect(mockCreateComment).toHaveBeenCalledTimes(2);

      // Verify test comment was posted
      const testCommentCall = mockCreateComment.mock.calls[0][0];
      expect(testCommentCall.owner).toBe('d7knight2');
      expect(testCommentCall.repo).toBe('test-repo');
      expect(testCommentCall.issue_number).toBe(123);
      expect(testCommentCall.body).toContain('🤖 **CiKnight Webhook Test**');
      expect(testCommentCall.body).toContain('pull_request.opened');
      expect(testCommentCall.body).toContain('Timestamp:');

      // Verify welcome comment was posted
      const welcomeCommentCall = mockCreateComment.mock.calls[1][0];
      expect(welcomeCommentCall.body).toContain('🛡️ **CiKnight is now monitoring this PR**');
    });

    test('should only post test comment on PR synchronize (no welcome comment)', async () => {
      const payload = {
        action: 'synchronize',
        pull_request: {
          number: 456,
          title: 'Test PR',
          user: {
            login: 'testuser',
          },
        },
        repository: {
          name: 'test-repo',
          owner: {
            login: 'd7knight2',
          },
        },
        installation: {
          id: 12345,
        },
      };

      const rawBody = JSON.stringify(payload);
      const signature = computeSignature(rawBody);

      mockRequest = {
        headers: {
          'x-hub-signature-256': signature,
          'x-github-event': 'pull_request',
          'x-github-delivery': 'test-delivery-id',
        },
        rawBody,
      } as any;

      await webhookHandler(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(200);

      // Wait for async comment posting to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify no comments were posted on synchronize
      expect(mockCreateComment).not.toHaveBeenCalled();
    });

    test('should post merge conflict comment when PR has conflicts', async () => {
      mockGetPR.mockResolvedValueOnce({
        data: {
          number: 789,
          mergeable_state: 'dirty',
        },
      });

      const payload = {
        action: 'synchronize',
        pull_request: {
          number: 789,
          title: 'Test PR with conflicts',
          user: {
            login: 'testuser',
          },
        },
        repository: {
          name: 'test-repo',
          owner: {
            login: 'd7knight2',
          },
        },
        installation: {
          id: 12345,
        },
      };

      const rawBody = JSON.stringify(payload);
      const signature = computeSignature(rawBody);

      mockRequest = {
        headers: {
          'x-hub-signature-256': signature,
          'x-github-event': 'pull_request',
          'x-github-delivery': 'test-delivery-id',
        },
        rawBody,
      } as any;

      await webhookHandler(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(200);

      // Wait for async comment posting to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify merge conflict comment was posted
      expect(mockCreateComment).toHaveBeenCalledTimes(1);
      const commentCall = mockCreateComment.mock.calls[0][0];
      expect(commentCall.body).toContain('🔀 **Merge Conflict Detected**');
    });

    test('should handle comment posting failures with retry and log errors', async () => {
      mockCreateComment
        .mockRejectedValueOnce({ status: 500, message: 'Server error' })
        .mockRejectedValueOnce({ status: 500, message: 'Server error' })
        .mockResolvedValueOnce({ data: { id: 1 } });

      const payload = {
        action: 'opened',
        pull_request: {
          number: 999,
          title: 'Test PR',
          user: {
            login: 'testuser',
          },
        },
        repository: {
          name: 'test-repo',
          owner: {
            login: 'd7knight2',
          },
        },
        installation: {
          id: 12345,
        },
      };

      const rawBody = JSON.stringify(payload);
      const signature = computeSignature(rawBody);

      mockRequest = {
        headers: {
          'x-hub-signature-256': signature,
          'x-github-event': 'pull_request',
          'x-github-delivery': 'test-delivery-id',
        },
        rawBody,
      } as any;

      await webhookHandler(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(200);

      // Wait for async comment posting with retries to complete
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Verify retry logs were created
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('[RETRY] Attempt'));

      // Verify comments were eventually posted after retries
      expect(mockCreateComment).toHaveBeenCalled();
    });
  });

  describe('Webhook Signature Verification', () => {
    test('should reject webhook with invalid signature', async () => {
      const payload = {
        action: 'opened',
        pull_request: {
          number: 123,
        },
        repository: {
          owner: {
            login: 'd7knight2',
          },
        },
      };

      const rawBody = JSON.stringify(payload);
      const invalidSignature = 'sha256=invalid-signature';

      mockRequest = {
        headers: {
          'x-hub-signature-256': invalidSignature,
          'x-github-event': 'pull_request',
          'x-github-delivery': 'test-delivery-id',
        },
        rawBody,
      } as any;

      await webhookHandler(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error processing webhook:'),
        expect.any(Error)
      );
    });

    test('should accept webhook with valid signature and log verification', async () => {
      const payload = {
        action: 'synchronize',
        pull_request: {
          number: 111,
        },
        repository: {
          owner: {
            login: 'd7knight2',
          },
        },
        installation: {
          id: 12345,
        },
      };

      const rawBody = JSON.stringify(payload);
      const validSignature = computeSignature(rawBody);

      mockRequest = {
        headers: {
          'x-hub-signature-256': validSignature,
          'x-github-event': 'pull_request',
          'x-github-delivery': 'test-delivery-id',
        },
        rawBody,
      } as any;

      await webhookHandler(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔍 [WEBHOOK DEBUG] Verifying signature')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('✅ [WEBHOOK DEBUG] Signature verified successfully')
      );
    });
  });

  describe('Debug Logging', () => {
    test('should log payload preview for debugging', async () => {
      const payload = {
        action: 'opened',
        pull_request: {
          number: 222,
        },
        repository: {
          owner: {
            login: 'd7knight2',
          },
        },
        installation: {
          id: 12345,
        },
      };

      const rawBody = JSON.stringify(payload);
      const signature = computeSignature(rawBody);

      mockRequest = {
        headers: {
          'x-hub-signature-256': signature,
          'x-github-event': 'pull_request',
          'x-github-delivery': 'test-delivery-id',
        },
        rawBody,
      } as any;

      await webhookHandler(mockRequest as Request, mockResponse as Response);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔍 [WEBHOOK DEBUG] Payload preview')
      );
    });

    test('should log received signature (truncated)', async () => {
      const payload = {
        action: 'opened',
        pull_request: {
          number: 333,
        },
        repository: {
          owner: {
            login: 'd7knight2',
          },
        },
        installation: {
          id: 12345,
        },
      };

      const rawBody = JSON.stringify(payload);
      const signature = computeSignature(rawBody);

      mockRequest = {
        headers: {
          'x-hub-signature-256': signature,
          'x-github-event': 'pull_request',
          'x-github-delivery': 'test-delivery-id',
        },
        rawBody,
      } as any;

      await webhookHandler(mockRequest as Request, mockResponse as Response);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔍 [WEBHOOK DEBUG] Received signature:')
      );
    });

    test('should log stack traces when errors occur', async () => {
      const payload = {
        action: 'opened',
        pull_request: {
          number: 444,
        },
        repository: {
          owner: {
            login: 'd7knight2',
          },
        },
        installation: {
          id: 12345,
        },
      };

      const rawBody = JSON.stringify(payload);
      const invalidSignature = 'sha256=wrong';

      mockRequest = {
        headers: {
          'x-hub-signature-256': invalidSignature,
          'x-github-event': 'pull_request',
          'x-github-delivery': 'test-delivery-id',
        },
        rawBody,
      } as any;

      await webhookHandler(mockRequest as Request, mockResponse as Response);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ [WEBHOOK DEBUG] Stack trace:'),
        expect.any(String)
      );
    });
  });
});
