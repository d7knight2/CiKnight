import { createGitHubClient, getRepoInfo } from './client';
import { withRetry } from '../utils/retry';

export async function handlePullRequest(payload: any, action: string) {
  try {
    const { owner, repo, installationId } = getRepoInfo(payload);
    const octokit = createGitHubClient(installationId);
    const prNumber = payload.pull_request.number;

    console.log(`🔍 Processing PR #${prNumber} in ${owner}/${repo} (action: ${action})`);

    // Post a test comment to validate webhook operability (if enabled)
    const enableTestComments = process.env.ENABLE_WEBHOOK_TEST_COMMENTS === 'true';
    if (action === 'opened' && enableTestComments) {
      const timestamp = new Date().toISOString();
      const testComment = `🤖 **CiKnight Webhook Test**\n\n✅ Webhook received and processed successfully!\n\n**Details:**\n- Event: \`pull_request.${action}\`\n- Timestamp: ${timestamp}\n- PR: #${prNumber}\n- Repository: ${owner}/${repo}`;

      await postCommentWithRetry(
        octokit,
        owner,
        repo,
        prNumber,
        testComment,
        'webhook test comment'
      );
    }

    // Check if PR is mergeable
    console.log(`🔍 Fetching PR details for #${prNumber}`);
    const { data: pr } = await octokit.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });

    console.log(`📊 PR #${prNumber} mergeable state: ${pr.mergeable_state}`);

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
      console.log(`💬 Posting welcome comment on PR #${prNumber}`);
      const welcomeComment = `🛡️ **CiKnight is now monitoring this PR**\n\nI'll help with:\n- 🔀 Resolving merge conflicts\n- 🔧 Fixing CI failures\n- 📝 Applying patches\n\nStay tuned!`;

      await postCommentWithRetry(octokit, owner, repo, prNumber, welcomeComment, 'welcome comment');
      console.log(`💬 Posted welcome comment on PR #${prNumber}`);
    }
  } catch (error: any) {
    console.error(`❌ Error handling pull request:`, error.message);
    // Log stack trace for debugging
    if (error.stack) {
      console.error(`❌ [PR HANDLER DEBUG] Stack trace:`, error.stack);
    }
    throw error;
  }
}

/**
 * Posts a comment with retry logic
 */
async function postCommentWithRetry(
  octokit: any,
  owner: string,
  repo: string,
  prNumber: number,
  body: string,
  context: string
): Promise<void> {
  try {
    await withRetry(
      async () => {
        return await octokit.issues.createComment({
          owner,
          repo,
          issue_number: prNumber,
          body,
        });
      },
      { maxRetries: 3, initialDelayMs: 1000 },
      `posting ${context} on PR #${prNumber}`
    );
    console.log(`✅ [PR COMMENT] Successfully posted ${context} on PR #${prNumber}`);
  } catch (error: any) {
    console.error(`❌ [PR COMMENT] Failed to post ${context} on PR #${prNumber}: ${error.message}`);
    // Log stack trace for debugging
    if (error.stack) {
      console.error(`❌ [PR COMMENT DEBUG] Stack trace:`, error.stack);
    }
    throw error;
  }
}

async function handleMergeConflicts(octokit: any, owner: string, repo: string, prNumber: number) {
  try {
    console.log(`🔀 Processing merge conflicts for PR #${prNumber}`);
    // Comment on the PR about merge conflicts
    const conflictComment = `🔀 **Merge Conflict Detected**\n\nThis PR has merge conflicts that need to be resolved. CiKnight will attempt to help resolve them automatically.\n\n_Note: Complex conflicts may require manual intervention._`;

    await postCommentWithRetry(
      octokit,
      owner,
      repo,
      prNumber,
      conflictComment,
      'merge conflict notification'
    );

    console.log(`💬 Posted merge conflict comment on PR #${prNumber}`);

    // TODO: Implement automatic merge conflict resolution
    // This would involve:
    // 1. Fetching the base and head branches
    // 2. Attempting to merge with conflict markers
    // 3. Using AI/heuristics to resolve conflicts
    // 4. Creating a new commit with resolved conflicts
  } catch (error: any) {
    console.error(`❌ Error handling merge conflicts for PR #${prNumber}:`, error.message);
    // Log stack trace for debugging
    if (error.stack) {
      console.error(`❌ [MERGE CONFLICT DEBUG] Stack trace:`, error.stack);
    }
    throw error;
  }
}
