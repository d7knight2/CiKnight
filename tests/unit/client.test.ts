import { getRepoInfo } from '../../src/github/client';

describe('GitHub Client', () => {
  describe('getRepoInfo', () => {
    test('should extract repository information from payload', () => {
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
    });

    test('should handle different repository structures', () => {
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
    });
  });
});
