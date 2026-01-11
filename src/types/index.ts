// Re-export commonly used types from official Octokit webhooks
export type {
  PullRequestOpenedEvent,
  PullRequestSynchronizeEvent,
  PullRequestReopenedEvent,
  CheckRunCompletedEvent,
  CheckSuiteCompletedEvent,
} from '@octokit/webhooks-types';

// Custom helper types for the application
export interface RepoInfo {
  owner: string;
  repo: string;
  installationId: number;
}
