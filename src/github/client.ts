import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';

// Create an authenticated GitHub App client
export function createGitHubClient(installationId: number): Octokit {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_PRIVATE_KEY;

  if (!appId || !privateKey) {
    throw new Error('Missing GitHub App credentials (GITHUB_APP_ID or GITHUB_PRIVATE_KEY)');
  }

  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId,
      privateKey: privateKey.replace(/\\n/g, '\n'),
      installationId,
    },
  });
}

// Get repository information from payload
export function getRepoInfo(payload: any) {
  return {
    owner: payload.repository.owner.login,
    repo: payload.repository.name,
    installationId: payload.installation.id,
  };
}
