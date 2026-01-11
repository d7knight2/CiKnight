import { createGitHubClient, getRepoInfo } from '../../src/github/client';

// Mock environment variables
process.env.GITHUB_APP_ID = '123456';
process.env.GITHUB_PRIVATE_KEY = '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA\n-----END RSA PRIVATE KEY-----';

describe('GitHub Client', () => {
  describe('getRepoInfo', () => {
    it('should extract repository information from payload', () => {
      const mockPayload = {
        repository: {
          owner: { login: 'testowner' },
          name: 'testrepo',
        },
        installation: {
          id: 123,
        },
      };

      const result = getRepoInfo(mockPayload);

      expect(result).toEqual({
        owner: 'testowner',
        repo: 'testrepo',
        installationId: 123,
      });
    });

    it('should handle different payload structures', () => {
      const mockPayload = {
        repository: {
          owner: { login: 'anotherowner' },
          name: 'anotherrepo',
        },
        installation: {
          id: 456,
        },
      };

      const result = getRepoInfo(mockPayload);

      expect(result).toEqual({
        owner: 'anotherowner',
        repo: 'anotherrepo',
        installationId: 456,
      });
    });
  });

  describe('createGitHubClient', () => {
    it('should throw error when GITHUB_APP_ID is missing', () => {
      const originalAppId = process.env.GITHUB_APP_ID;
      delete process.env.GITHUB_APP_ID;

      expect(() => createGitHubClient(123)).toThrow(
        'Missing GitHub App credentials (GITHUB_APP_ID or GITHUB_PRIVATE_KEY)'
      );

      process.env.GITHUB_APP_ID = originalAppId;
    });

    it('should throw error when GITHUB_PRIVATE_KEY is missing', () => {
      const originalKey = process.env.GITHUB_PRIVATE_KEY;
      delete process.env.GITHUB_PRIVATE_KEY;

      expect(() => createGitHubClient(123)).toThrow(
        'Missing GitHub App credentials (GITHUB_APP_ID or GITHUB_PRIVATE_KEY)'
      );

      process.env.GITHUB_PRIVATE_KEY = originalKey;
    });

    it('should create a GitHub client with valid credentials', () => {
      const client = createGitHubClient(123);

      expect(client).toBeDefined();
      expect(client.rest).toBeDefined();
    });
  });
});
