import { createGitHubClient, getRepoInfo } from './client';
import { PullRequestPayload, OctokitInstance } from '../types';

export async function handlePullRequest(
  payload: PullRequestPayload,
  action: string
): Promise<void> {
  try {
    const { owner, repo, installationId } = getRepoInfo(payload);
    const octokit = createGitHubClient(installationId);
    const prNumber = payload.pull_request.number;

    console.log(`🔍 Processing PR #${prNumber} in ${owner}/${repo} (action: ${action})`);

    // Check if PR is mergeable
    const { data: pr } = await octokit.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });

    if (pr.mergeable_state === 'dirty') {
      console.log(`⚠️  PR #${prNumber} has merge conflicts`);
      await handleMergeConflicts(octokit, owner, repo, prNumber);
    } else if (pr.mergeable_state === 'unstable') {
      console.log(`⚠️  PR #${prNumber} has failing checks`);
      // Check for CI failures will be handled by check_run events
    } else {
      console.log(`✅ PR #${prNumber} is in good state (${pr.mergeable_state})`);
    }

    // Add a comment to let users know CiKnight is monitoring
    if (action === 'opened') {
      await octokit.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body: `🛡️ **CiKnight is now monitoring this PR**\n\nI'll help with:\n- 🔀 Resolving merge conflicts\n- 🔧 Fixing CI failures\n- 📝 Applying patches\n\nStay tuned!`,
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ Error handling pull request:`, errorMessage);
  }
}

async function handleMergeConflicts(
  octokit: OctokitInstance,
  owner: string,
  repo: string,
  prNumber: number
): Promise<void> {
  try {
    // Comment on the PR about merge conflicts
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: `🔀 **Merge Conflict Detected**\n\nThis PR has merge conflicts that need to be resolved. CiKnight will attempt to help resolve them automatically.\n\n_Note: Complex conflicts may require manual intervention._`,
    });

    console.log(`💬 Posted merge conflict comment on PR #${prNumber}`);

    // TODO: Implement automatic merge conflict resolution
    // This would involve:
    // 1. Fetching the base and head branches
    // 2. Attempting to merge with conflict markers
    // 3. Using AI/heuristics to resolve conflicts
    // 4. Creating a new commit with resolved conflicts
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ Error handling merge conflicts:`, errorMessage);
  }
}
