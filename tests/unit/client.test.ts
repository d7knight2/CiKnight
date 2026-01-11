import { getRepoInfo } from '../../src/github/client';

describe('GitHub Client', () => {
  describe('getRepoInfo', () => {
    test('should extract repository information from payload', () => {
      const mockPayload = {
        repository: {
          owner: { login: 'testuser', id: 1 },
          name: 'testrepo',
          full_name: 'testuser/testrepo',
        },
        installation: {
          id: 12345,
        },
        sender: {
          login: 'testuser',
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
          owner: { login: 'orgname', id: 2 },
          name: 'project-repo',
          full_name: 'orgname/project-repo',
        },
        installation: {
          id: 99999,
        },
        sender: {
          login: 'contributor',
        },
      };

      const result = getRepoInfo(mockPayload);

      expect(result.owner).toBe('orgname');
      expect(result.repo).toBe('project-repo');
      expect(result.installationId).toBe(99999);
    });
  });
});
