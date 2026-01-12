// Mock dependencies before imports
jest.mock('../../src/github/client', () => ({
  createGitHubClient: jest.fn(),
  getRepoInfo: jest.fn(),
}));

import { handlePullRequest } from '../../src/github/pull-request';
import { createGitHubClient, getRepoInfo } from '../../src/github/client';

describe('Pull Request Handler', () => {
  let mockOctokit: any;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    // Mock Octokit
    mockOctokit = {
      pulls: {
        get: jest.fn(),
      },
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

  describe('handlePullRequest', () => {
    test('should log when PR is in good state (clean)', async () => {
      mockOctokit.pulls.get.mockResolvedValue({
        data: {
          number: 42,
          mergeable_state: 'clean',
        },
      });

      const payload = {
        pull_request: { number: 42 },
        repository: {
          owner: { login: 'test-owner' },
          name: 'test-repo',
        },
        installation: { id: 12345 },
      };

      await handlePullRequest(payload, 'synchronize');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '🔍 Processing PR #42 in test-owner/test-repo (action: synchronize)'
        )
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔍 Fetching PR details for #42')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('📊 PR #42 mergeable state: clean')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('✅ PR #42 is in good state (clean)')
      );
    });

    test('should log when PR has merge conflicts', async () => {
      mockOctokit.pulls.get.mockResolvedValue({
        data: {
          number: 43,
          mergeable_state: 'dirty',
        },
      });

      const payload = {
        pull_request: { number: 43 },
        repository: {
          owner: { login: 'test-owner' },
          name: 'test-repo',
        },
        installation: { id: 12345 },
      };

      await handlePullRequest(payload, 'synchronize');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('📊 PR #43 mergeable state: dirty')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️  PR #43 has merge conflicts')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔀 Processing merge conflicts for PR #43')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('💬 Posted merge conflict comment on PR #43')
      );

      expect(mockOctokit.issues.createComment).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 43,
        body: expect.stringContaining('🔀 **Merge Conflict Detected**'),
      });
    });

    test('should log when PR has failing checks', async () => {
      mockOctokit.pulls.get.mockResolvedValue({
        data: {
          number: 44,
          mergeable_state: 'unstable',
        },
      });

      const payload = {
        pull_request: { number: 44 },
        repository: {
          owner: { login: 'test-owner' },
          name: 'test-repo',
        },
        installation: { id: 12345 },
      };

      await handlePullRequest(payload, 'synchronize');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('📊 PR #44 mergeable state: unstable')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️  PR #44 has failing checks')
      );
    });

    test('should log and post welcome comment when PR is opened', async () => {
      mockOctokit.pulls.get.mockResolvedValue({
        data: {
          number: 45,
          mergeable_state: 'clean',
        },
      });

      const payload = {
        pull_request: { number: 45 },
        repository: {
          owner: { login: 'test-owner' },
          name: 'test-repo',
        },
        installation: { id: 12345 },
      };

      await handlePullRequest(payload, 'opened');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔍 Processing PR #45 in test-owner/test-repo (action: opened)')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('💬 Posting welcome comment on PR #45')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('💬 Posted welcome comment on PR #45')
      );

      expect(mockOctokit.issues.createComment).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 45,
        body: expect.stringContaining('🛡️ **CiKnight is now monitoring this PR**'),
      });
    });

    test('should not post welcome comment when PR is synchronized', async () => {
      mockOctokit.pulls.get.mockResolvedValue({
        data: {
          number: 46,
          mergeable_state: 'clean',
        },
      });

      const payload = {
        pull_request: { number: 46 },
        repository: {
          owner: { login: 'test-owner' },
          name: 'test-repo',
        },
        installation: { id: 12345 },
      };

      await handlePullRequest(payload, 'synchronize');

      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('💬 Posting welcome comment')
      );
      expect(mockOctokit.issues.createComment).not.toHaveBeenCalled();
    });

    test('should not post welcome comment when PR is reopened', async () => {
      mockOctokit.pulls.get.mockResolvedValue({
        data: {
          number: 47,
          mergeable_state: 'clean',
        },
      });

      const payload = {
        pull_request: { number: 47 },
        repository: {
          owner: { login: 'test-owner' },
          name: 'test-repo',
        },
        installation: { id: 12345 },
      };

      await handlePullRequest(payload, 'reopened');

      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('💬 Posting welcome comment')
      );
      expect(mockOctokit.issues.createComment).not.toHaveBeenCalled();
    });

    test('should log error when PR fetch fails', async () => {
      mockOctokit.pulls.get.mockRejectedValue(new Error('API Error'));

      const payload = {
        pull_request: { number: 48 },
        repository: {
          owner: { login: 'test-owner' },
          name: 'test-repo',
        },
        installation: { id: 12345 },
      };

      await handlePullRequest(payload, 'opened');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error handling pull request:'),
        'API Error',
        expect.any(Error)
      );
    });

    test('should log error when merge conflict comment creation fails', async () => {
      mockOctokit.pulls.get.mockResolvedValue({
        data: {
          number: 49,
          mergeable_state: 'dirty',
        },
      });
      mockOctokit.issues.createComment.mockRejectedValue(new Error('Comment API Error'));

      const payload = {
        pull_request: { number: 49 },
        repository: {
          owner: { login: 'test-owner' },
          name: 'test-repo',
        },
        installation: { id: 12345 },
      };

      await handlePullRequest(payload, 'synchronize');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔀 Processing merge conflicts for PR #49')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error handling merge conflicts for PR #49:'),
        'Comment API Error',
        expect.any(Error)
      );
    });

    test('should log error when welcome comment creation fails', async () => {
      mockOctokit.pulls.get.mockResolvedValue({
        data: {
          number: 50,
          mergeable_state: 'clean',
        },
      });
      mockOctokit.issues.createComment.mockRejectedValue(new Error('Comment API Error'));

      const payload = {
        pull_request: { number: 50 },
        repository: {
          owner: { login: 'test-owner' },
          name: 'test-repo',
        },
        installation: { id: 12345 },
      };

      await handlePullRequest(payload, 'opened');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('💬 Posting welcome comment on PR #50')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error handling pull request:'),
        'Comment API Error',
        expect.any(Error)
      );
    });

    test('should handle all mergeable states correctly', async () => {
      const states = ['clean', 'unstable', 'dirty', 'blocked', 'behind', 'unknown'];

      for (const state of states) {
        jest.clearAllMocks();
        consoleLogSpy.mockClear();

        mockOctokit.pulls.get.mockResolvedValue({
          data: {
            number: 100,
            mergeable_state: state,
          },
        });

        const payload = {
          pull_request: { number: 100 },
          repository: {
            owner: { login: 'test-owner' },
            name: 'test-repo',
          },
          installation: { id: 12345 },
        };

        await handlePullRequest(payload, 'synchronize');

        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining(`📊 PR #100 mergeable state: ${state}`)
        );

        if (state === 'dirty') {
          expect(consoleLogSpy).toHaveBeenCalledWith(
            expect.stringContaining('⚠️  PR #100 has merge conflicts')
          );
        } else if (state === 'unstable') {
          expect(consoleLogSpy).toHaveBeenCalledWith(
            expect.stringContaining('⚠️  PR #100 has failing checks')
          );
        } else {
          expect(consoleLogSpy).toHaveBeenCalledWith(
            expect.stringContaining(`✅ PR #100 is in good state (${state})`)
          );
        }
      }
    });

    test('should log all expected messages in correct order for opened PR with conflicts', async () => {
      mockOctokit.pulls.get.mockResolvedValue({
        data: {
          number: 200,
          mergeable_state: 'dirty',
        },
      });

      const payload = {
        pull_request: { number: 200 },
        repository: {
          owner: { login: 'test-owner' },
          name: 'test-repo',
        },
        installation: { id: 12345 },
      };

      await handlePullRequest(payload, 'opened');

      const logCalls = consoleLogSpy.mock.calls.map((call) => call[0]);
      expect(logCalls).toContainEqual(expect.stringContaining('🔍 Processing PR #200'));
      expect(logCalls).toContainEqual(expect.stringContaining('🔍 Fetching PR details for #200'));
      expect(logCalls).toContainEqual(expect.stringContaining('📊 PR #200 mergeable state: dirty'));
      expect(logCalls).toContainEqual(expect.stringContaining('⚠️  PR #200 has merge conflicts'));
      expect(logCalls).toContainEqual(
        expect.stringContaining('🔀 Processing merge conflicts for PR #200')
      );
      expect(logCalls).toContainEqual(
        expect.stringContaining('💬 Posted merge conflict comment on PR #200')
      );
      expect(logCalls).toContainEqual(
        expect.stringContaining('💬 Posting welcome comment on PR #200')
      );
      expect(logCalls).toContainEqual(
        expect.stringContaining('💬 Posted welcome comment on PR #200')
      );
    });
  });
});
