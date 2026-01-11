import { Octokit } from '@octokit/rest';

// Custom helper types for the application
export interface RepoInfo {
  owner: string;
  repo: string;
  installationId: number;
}

// Webhook payload types
export interface WebhookRepository {
  name: string;
  full_name: string;
  owner: {
    login: string;
    id: number;
  };
}

export interface WebhookInstallation {
  id: number;
}

export interface WebhookPayloadBase {
  repository: WebhookRepository;
  installation: WebhookInstallation;
  sender: {
    login: string;
  };
}

export interface PullRequestPayload extends WebhookPayloadBase {
  action: string;
  number: number;
  pull_request: {
    id: number;
    number: number;
    state: string;
    title: string;
    user: {
      login: string;
    };
    head: {
      ref: string;
      sha: string;
    };
    base: {
      ref: string;
      sha: string;
    };
    mergeable: boolean | null;
    mergeable_state: string;
    merged: boolean;
    html_url: string;
  };
}

export interface CheckRunPayload extends WebhookPayloadBase {
  action: string;
  check_run: {
    id: number;
    name: string;
    status: string;
    conclusion: string | null;
    html_url: string;
    pull_requests: Array<{
      id: number;
      number: number;
      url: string;
    }>;
  };
}

export type WebhookPayload = PullRequestPayload | CheckRunPayload | WebhookPayloadBase;

export type OctokitInstance = InstanceType<typeof Octokit>;
