import { createGitHubClient, getRepoInfo } from '../../src/github/client';

describe('GitHub Client', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    // Spy on console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Set up environment variables for createGitHubClient tests
    process.env.GITHUB_APP_ID = '12345';
    process.env.GITHUB_PRIVATE_KEY = 'fake-private-key\\nwith\\nnewlines';
  });

  afterEach(() => {
    jest.clearAllMocks();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('getRepoInfo', () => {
    test('should extract repository information from payload and log', () => {
      const mockPayload = {
        repository: {
          owner: { login: 'testuser' },
          name: 'testrepo',
        },
        installation: {
          id: 12345,
        },
      };

      const result = getRepoInfo(mockPayload);

      expect(result).toEqual({
        owner: 'testuser',
        repo: 'testrepo',
        installationId: 12345,
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('📦 Extracted repo info: testuser/testrepo (installation: 12345)')
      );
    });

    test('should handle different repository structures and log', () => {
      const mockPayload = {
        repository: {
          owner: { login: 'orgname' },
          name: 'project-repo',
        },
        installation: {
          id: 99999,
        },
      };

      const result = getRepoInfo(mockPayload);

      expect(result.owner).toBe('orgname');
      expect(result.repo).toBe('project-repo');
      expect(result.installationId).toBe(99999);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '📦 Extracted repo info: orgname/project-repo (installation: 99999)'
        )
      );
    });
  });

  describe('createGitHubClient', () => {
    test('should create GitHub client and log creation', () => {
      const installationId = 54321;

      const client = createGitHubClient(installationId);

      expect(client).toBeDefined();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔑 Creating GitHub client for installation 54321')
      );
    });

    test('should throw error and log when GITHUB_APP_ID is missing', () => {
      delete process.env.GITHUB_APP_ID;

      expect(() => createGitHubClient(12345)).toThrow(
        'Missing GitHub App credentials (GITHUB_APP_ID or GITHUB_PRIVATE_KEY)'
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Missing GitHub App credentials')
      );
    });

    test('should throw error and log when GITHUB_PRIVATE_KEY is missing', () => {
      delete process.env.GITHUB_PRIVATE_KEY;

      expect(() => createGitHubClient(12345)).toThrow(
        'Missing GitHub App credentials (GITHUB_APP_ID or GITHUB_PRIVATE_KEY)'
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Missing GitHub App credentials')
      );
    });

    test('should throw error and log when both credentials are missing', () => {
      delete process.env.GITHUB_APP_ID;
      delete process.env.GITHUB_PRIVATE_KEY;

      expect(() => createGitHubClient(12345)).toThrow(
        'Missing GitHub App credentials (GITHUB_APP_ID or GITHUB_PRIVATE_KEY)'
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Missing GitHub App credentials')
      );
    });
  });
});
