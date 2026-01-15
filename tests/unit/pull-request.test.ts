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
    // Enable test comments for tests
    process.env.ENABLE_TEST_COMMENTS = 'true';

    // Mock Octokit
    mockOctokit = {
      pulls: {
        get: jest.fn(),
      },
      issues: {
        createComment: jest.fn().mockResolvedValue({
          data: { id: 12345, html_url: 'https://github.com/test/comment' },
          status: 201,
        }),
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
    delete process.env.ENABLE_TEST_COMMENTS;
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
        status: 200,
        headers: { 'x-ratelimit-remaining': '5000' },
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
        status: 200,
        headers: { 'x-ratelimit-remaining': '5000' },
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
        status: 200,
        headers: { 'x-ratelimit-remaining': '5000' },
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
        status: 200,
        headers: { 'x-ratelimit-remaining': '5000' },
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
        status: 200,
        headers: { 'x-ratelimit-remaining': '5000' },
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
      // Test comment should be posted
      expect(mockOctokit.issues.createComment).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining('CiKnight Webhook Test Comment'),
        })
      );
      // But welcome comment should not be posted
      expect(mockOctokit.issues.createComment).not.toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining('CiKnight is now monitoring'),
        })
      );
    });

    test('should not post welcome comment when PR is reopened', async () => {
      mockOctokit.pulls.get.mockResolvedValue({
        data: {
          number: 47,
          mergeable_state: 'clean',
        },
        status: 200,
        headers: { 'x-ratelimit-remaining': '5000' },
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
      // Test comment should be posted
      expect(mockOctokit.issues.createComment).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining('CiKnight Webhook Test Comment'),
        })
      );
      // But welcome comment should not be posted
      expect(mockOctokit.issues.createComment).not.toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining('CiKnight is now monitoring'),
        })
      );
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

      await expect(handlePullRequest(payload, 'opened')).rejects.toThrow('API Error');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Failed to fetch PR details for #48')
      );
    });

    test('should log error when merge conflict comment creation fails', async () => {
      mockOctokit.pulls.get.mockResolvedValue({
        data: {
          number: 49,
          mergeable_state: 'dirty',
        },
        status: 200,
        headers: { 'x-ratelimit-remaining': '5000' },
      });
      // First call is test comment (succeeds), second call is conflict comment (fails)
      mockOctokit.issues.createComment
        .mockResolvedValueOnce({
          data: { id: 1, html_url: 'https://github.com/test/comment1' },
          status: 201,
        })
        .mockRejectedValueOnce(new Error('Comment API Error'));

      const payload = {
        pull_request: { number: 49 },
        repository: {
          owner: { login: 'test-owner' },
          name: 'test-repo',
        },
        installation: { id: 12345 },
      };

      await expect(handlePullRequest(payload, 'synchronize')).rejects.toThrow('Comment API Error');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔀 Processing merge conflicts for PR #49')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ ===== ERROR HANDLING MERGE CONFLICTS =====')
      );
    });

    test('should log error when welcome comment creation fails', async () => {
      mockOctokit.pulls.get.mockResolvedValue({
        data: {
          number: 50,
          mergeable_state: 'clean',
        },
        status: 200,
        headers: { 'x-ratelimit-remaining': '5000' },
      });
      // First call is test comment (succeeds), second call is welcome comment (fails)
      mockOctokit.issues.createComment
        .mockResolvedValueOnce({
          data: { id: 1, html_url: 'https://github.com/test/comment1' },
          status: 201,
        })
        .mockRejectedValueOnce(new Error('Comment API Error'));

      const payload = {
        pull_request: { number: 50 },
        repository: {
          owner: { login: 'test-owner' },
          name: 'test-repo',
        },
        installation: { id: 12345 },
      };

      await expect(handlePullRequest(payload, 'opened')).rejects.toThrow('Comment API Error');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('💬 Posting welcome comment on PR #50')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Failed to post welcome comment on PR #50')
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
          status: 200,
          headers: { 'x-ratelimit-remaining': '5000' },
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
        status: 200,
        headers: { 'x-ratelimit-remaining': '5000' },
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

    test('should post test comment with timestamp on every webhook invocation', async () => {
      mockOctokit.pulls.get.mockResolvedValue({
        data: {
          number: 300,
          mergeable_state: 'clean',
        },
        status: 200,
        headers: { 'x-ratelimit-remaining': '5000' },
      });

      const payload = {
        pull_request: { number: 300 },
        repository: {
          owner: { login: 'test-owner' },
          name: 'test-repo',
        },
        installation: { id: 12345 },
      };

      await handlePullRequest(payload, 'synchronize');

      // Verify test comment was posted
      expect(mockOctokit.issues.createComment).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: 'test-owner',
          repo: 'test-repo',
          issue_number: 300,
          body: expect.stringContaining('CiKnight Webhook Test Comment'),
        })
      );

      // Verify the test comment contains required information
      const testCommentCall = mockOctokit.issues.createComment.mock.calls.find((call: any) =>
        call[0].body.includes('CiKnight Webhook Test Comment')
      );
      expect(testCommentCall).toBeDefined();
      expect(testCommentCall[0].body).toContain('Timestamp:');
      expect(testCommentCall[0].body).toContain('Event: `pull_request.synchronize`');
      expect(testCommentCall[0].body).toContain('PR: #300');
      expect(testCommentCall[0].body).toContain('Repository: `test-owner/test-repo`');
    });

    test('should log authentication and API response details', async () => {
      mockOctokit.pulls.get.mockResolvedValue({
        data: {
          number: 400,
          mergeable_state: 'clean',
        },
        status: 200,
        headers: { 'x-ratelimit-remaining': '5000' },
      });

      const payload = {
        pull_request: { number: 400 },
        repository: {
          owner: { login: 'test-owner' },
          name: 'test-repo',
        },
        installation: { id: 12345 },
      };

      await handlePullRequest(payload, 'opened');

      // Check authentication logging
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔑 Authentication: Creating GitHub client for installation 12345')
      );

      // Check API response logging
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('✅ Successfully fetched PR details')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('HTTP Status: 200'));
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Rate Limit Remaining: 5000')
      );

      // Check test comment logging
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('✅ Test comment posted successfully')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Comment ID: 12345'));
    });

    test('should continue processing even if test comment fails', async () => {
      mockOctokit.pulls.get.mockResolvedValue({
        data: {
          number: 500,
          mergeable_state: 'clean',
        },
        status: 200,
        headers: { 'x-ratelimit-remaining': '5000' },
      });

      // Test comment fails, but processing continues
      mockOctokit.issues.createComment
        .mockRejectedValueOnce(new Error('Test comment failed'))
        .mockResolvedValueOnce({
          data: { id: 2, html_url: 'https://github.com/test/comment2' },
          status: 201,
        });

      const payload = {
        pull_request: { number: 500 },
        repository: {
          owner: { login: 'test-owner' },
          name: 'test-repo',
        },
        installation: { id: 12345 },
      };

      await handlePullRequest(payload, 'opened');

      // Verify test comment failure was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Failed to post test comment on PR #500')
      );

      // Verify welcome comment was still posted
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('💬 Posting welcome comment on PR #500')
      );
    });

    test('should not post test comment when ENABLE_TEST_COMMENTS is not set', async () => {
      // Disable test comments
      delete process.env.ENABLE_TEST_COMMENTS;

      mockOctokit.pulls.get.mockResolvedValue({
        data: {
          number: 600,
          mergeable_state: 'clean',
        },
        status: 200,
        headers: { 'x-ratelimit-remaining': '5000' },
      });

      const payload = {
        pull_request: { number: 600 },
        repository: {
          owner: { login: 'test-owner' },
          name: 'test-repo',
        },
        installation: { id: 12345 },
      };

      await handlePullRequest(payload, 'synchronize');

      // Verify test comment was not posted
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "ℹ️  Test comments disabled (ENABLE_TEST_COMMENTS not set to 'true')"
        )
      );

      // Verify no test comment was created
      const testCommentCall = mockOctokit.issues.createComment.mock.calls.find((call: any) =>
        call[0].body?.includes('CiKnight Webhook Test Comment')
      );
      expect(testCommentCall).toBeUndefined();
    });
  });
});
