// Mock dependencies before imports
jest.mock('../../src/github/client', () => ({
  createGitHubClient: jest.fn(),
  getRepoInfo: jest.fn(),
}));

import { handleCheckRun } from '../../src/github/check-run';
import { createGitHubClient, getRepoInfo } from '../../src/github/client';

describe('Check Run Handler', () => {
  let mockOctokit: any;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    // Mock Octokit
    mockOctokit = {
      issues: {
        createComment: jest.fn().mockResolvedValue({}),
      },
    };

    // Mock the client functions
    (createGitHubClient as jest.Mock).mockReturnValue(mockOctokit);
    (getRepoInfo as jest.Mock).mockReturnValue({
      owner: 'test-owner',
      repo: 'test-repo',
      installationId: 12345,
    });

    // Spy on console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('handleCheckRun', () => {
    test('should log when check run passes', async () => {
      const payload = {
        check_run: {
          name: 'CI Tests',
          conclusion: 'success',
          status: 'completed',
          html_url: 'https://github.com/test/test/runs/123',
          pull_requests: [],
        },
        repository: {
          owner: { login: 'test-owner' },
          name: 'test-repo',
        },
        installation: { id: 12345 },
      };

      await handleCheckRun(payload);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔍 Processing check run: CI Tests - success')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('✅ Check run passed or is still running')
      );
      expect(mockOctokit.issues.createComment).not.toHaveBeenCalled();
    });

    test('should log when check run is still running', async () => {
      const payload = {
        check_run: {
          name: 'Build',
          conclusion: null,
          status: 'in_progress',
          html_url: 'https://github.com/test/test/runs/123',
          pull_requests: [],
        },
        repository: {
          owner: { login: 'test-owner' },
          name: 'test-repo',
        },
        installation: { id: 12345 },
      };

      await handleCheckRun(payload);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔍 Processing check run: Build - in_progress')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('✅ Check run passed or is still running')
      );
    });

    test('should log when check run has no associated PRs', async () => {
      const payload = {
        check_run: {
          name: 'Linting',
          conclusion: 'failure',
          status: 'completed',
          html_url: 'https://github.com/test/test/runs/456',
          pull_requests: [],
        },
        repository: {
          owner: { login: 'test-owner' },
          name: 'test-repo',
        },
        installation: { id: 12345 },
      };

      await handleCheckRun(payload);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔍 Processing check run: Linting - failure')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('ℹ️  No pull requests associated with this check run')
      );
      expect(mockOctokit.issues.createComment).not.toHaveBeenCalled();
    });

    test('should handle check run failure with associated PR and log appropriately', async () => {
      const payload = {
        check_run: {
          name: 'Unit Tests',
          conclusion: 'failure',
          status: 'completed',
          html_url: 'https://github.com/test/test/runs/789',
          pull_requests: [{ number: 42 }],
        },
        repository: {
          owner: { login: 'test-owner' },
          name: 'test-repo',
        },
        installation: { id: 12345 },
      };

      await handleCheckRun(payload);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔍 Processing check run: Unit Tests - failure')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('📝 Found 1 pull request(s) associated with failed check')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔧 Handling CI failure for PR #42')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('💬 Creating comment on PR #42 about CI failure')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('💬 Posted CI failure comment on PR #42')
      );

      expect(mockOctokit.issues.createComment).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 42,
        body: expect.stringContaining('🔧 **CI Failure Detected**'),
      });
    });

    test('should handle multiple PRs associated with failed check', async () => {
      const payload = {
        check_run: {
          name: 'Integration Tests',
          conclusion: 'failure',
          status: 'completed',
          html_url: 'https://github.com/test/test/runs/999',
          pull_requests: [{ number: 1 }, { number: 2 }, { number: 3 }],
        },
        repository: {
          owner: { login: 'test-owner' },
          name: 'test-repo',
        },
        installation: { id: 12345 },
      };

      await handleCheckRun(payload);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('📝 Found 3 pull request(s) associated with failed check')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔧 Handling CI failure for PR #1')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔧 Handling CI failure for PR #2')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔧 Handling CI failure for PR #3')
      );

      expect(mockOctokit.issues.createComment).toHaveBeenCalledTimes(3);
    });

    test('should log error when handleCheckRun throws', async () => {
      (getRepoInfo as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid payload structure');
      });

      const payload = {
        check_run: {
          name: 'Test',
          conclusion: 'failure',
          status: 'completed',
        },
      };

      await handleCheckRun(payload);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error handling check run:'),
        'Invalid payload structure',
        expect.any(Error)
      );
    });

    test('should log error when comment creation fails', async () => {
      mockOctokit.issues.createComment.mockRejectedValue(new Error('API Error'));

      const payload = {
        check_run: {
          name: 'Tests',
          conclusion: 'failure',
          status: 'completed',
          html_url: 'https://github.com/test/test/runs/111',
          pull_requests: [{ number: 10 }],
        },
        repository: {
          owner: { login: 'test-owner' },
          name: 'test-repo',
        },
        installation: { id: 12345 },
      };

      await handleCheckRun(payload);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔧 Handling CI failure for PR #10')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error handling CI failure for PR #10:'),
        'API Error',
        expect.any(Error)
      );
    });

    test('should log all expected messages for successful CI failure handling', async () => {
      const payload = {
        check_run: {
          name: 'E2E Tests',
          conclusion: 'failure',
          status: 'completed',
          html_url: 'https://github.com/test/test/runs/222',
          pull_requests: [{ number: 99 }],
        },
        repository: {
          owner: { login: 'test-owner' },
          name: 'test-repo',
        },
        installation: { id: 12345 },
      };

      await handleCheckRun(payload);

      // Verify the sequence of log messages
      const logCalls = consoleLogSpy.mock.calls.map((call) => call[0]);
      expect(logCalls).toContainEqual(
        expect.stringContaining('🔍 Processing check run: E2E Tests - failure')
      );
      expect(logCalls).toContainEqual(expect.stringContaining('📝 Found 1 pull request(s)'));
      expect(logCalls).toContainEqual(expect.stringContaining('🔧 Handling CI failure for PR #99'));
      expect(logCalls).toContainEqual(expect.stringContaining('💬 Creating comment on PR #99'));
      expect(logCalls).toContainEqual(
        expect.stringContaining('💬 Posted CI failure comment on PR #99')
      );
    });
  });
});
