// GitHub Webhook Payload Types
export interface PullRequestPayload {
  action: string;
  pull_request: {
    number: number;
    title: string;
    state: string;
    mergeable_state: string;
    head: {
      ref: string;
      sha: string;
    };
    base: {
      ref: string;
      sha: string;
    };
  };
  repository: {
    name: string;
    owner: {
      login: string;
    };
  };
  installation: {
    id: number;
  };
}

export interface CheckRunPayload {
  action: string;
  check_run: {
    name: string;
    status: string;
    conclusion: string | null;
    html_url: string;
    pull_requests: Array<{
      number: number;
    }>;
  };
  repository: {
    name: string;
    owner: {
      login: string;
    };
  };
  installation: {
    id: number;
  };
}

export interface RepoInfo {
  owner: string;
  repo: string;
  installationId: number;
}
