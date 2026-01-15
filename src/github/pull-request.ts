import { createGitHubClient, getRepoInfo } from './client';

function createTestCommentBody(
  timestamp: string,
  action: string,
  prNumber: number,
  owner: string,
  repo: string
): string {
  return `✅ **CiKnight Webhook Test Comment**

🕐 Timestamp: \`${timestamp}\`
📬 Event: \`pull_request.${action}\`
🆔 PR: #${prNumber}
📦 Repository: \`${owner}/${repo}\`

_This comment confirms the webhook is triggering successfully._`;
}

export async function handlePullRequest(payload: any, action: string) {
  const timestamp = new Date().toISOString();

  try {
    const { owner, repo, installationId } = getRepoInfo(payload);
    console.log(`🔑 Authentication: Creating GitHub client for installation ${installationId}`);

    const octokit = createGitHubClient(installationId);
    const prNumber = payload.pull_request.number;

    console.log(`🔍 Processing PR #${prNumber} in ${owner}/${repo} (action: ${action})`);

    // Post test comment to verify webhook is working (if enabled)
    const enableTestComments = process.env.ENABLE_TEST_COMMENTS === 'true';
    if (enableTestComments) {
      console.log(`🧪 Posting test comment on PR #${prNumber} to verify webhook functionality`);
      try {
        const testCommentResponse = await octokit.issues.createComment({
          owner,
          repo,
          issue_number: prNumber,
          body: createTestCommentBody(timestamp, action, prNumber, owner, repo),
        });
        console.log(`✅ Test comment posted successfully`);
        console.log(`   - Comment ID: ${testCommentResponse.data.id}`);
        console.log(`   - Comment URL: ${testCommentResponse.data.html_url}`);
        console.log(`   - HTTP Status: ${testCommentResponse.status}`);
      } catch (commentError: any) {
        console.error(`❌ Failed to post test comment on PR #${prNumber}`);
        console.error(`   - Error Type: ${commentError.name || 'Unknown'}`);
        console.error(`   - Error Message: ${commentError.message}`);
        console.error(`   - HTTP Status: ${commentError.status || 'N/A'}`);
        console.error(`   - Response: ${JSON.stringify(commentError.response?.data || {})}`);
        // Continue processing even if test comment fails
      }
    } else {
      console.log(`ℹ️  Test comments disabled (ENABLE_TEST_COMMENTS not set to 'true')`);
    }

    // Check if PR is mergeable
    console.log(`🔍 Fetching PR details for #${prNumber}`);
    let pr;
    try {
      const prResponse = await octokit.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
      });
      pr = prResponse.data;
      console.log(`✅ Successfully fetched PR details`);
      console.log(`   - HTTP Status: ${prResponse.status}`);
      console.log(
        `   - Rate Limit Remaining: ${prResponse.headers['x-ratelimit-remaining'] || 'N/A'}`
      );
    } catch (prError: any) {
      console.error(`❌ Failed to fetch PR details for #${prNumber}`);
      console.error(`   - Error Message: ${prError.message}`);
      console.error(`   - HTTP Status: ${prError.status || 'N/A'}`);
      throw prError;
    }

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
      try {
        const welcomeResponse = await octokit.issues.createComment({
          owner,
          repo,
          issue_number: prNumber,
          body: `🛡️ **CiKnight is now monitoring this PR**\n\nI'll help with:\n- 🔀 Resolving merge conflicts\n- 🔧 Fixing CI failures\n- 📝 Applying patches\n\nStay tuned!`,
        });
        console.log(`💬 Posted welcome comment on PR #${prNumber}`);
        console.log(`   - HTTP Status: ${welcomeResponse.status}`);
      } catch (welcomeError: any) {
        console.error(`❌ Failed to post welcome comment on PR #${prNumber}`);
        console.error(`   - Error Message: ${welcomeError.message}`);
        console.error(`   - HTTP Status: ${welcomeError.status || 'N/A'}`);
        throw welcomeError;
      }
    }
  } catch (error: any) {
    console.error(`\n❌ ===== ERROR IN PULL REQUEST HANDLER =====`);
    console.error(`⏰ Timestamp: ${timestamp}`);
    console.error(`🔴 Error Type: ${error.name || 'Unknown'}`);
    console.error(`📝 Error Message: ${error.message}`);
    console.error(`📊 HTTP Status: ${error.status || 'N/A'}`);
    if (error.response?.data) {
      console.error(`📋 API Response: ${JSON.stringify(error.response.data)}`);
    }
    console.error(`📚 Stack Trace:`, error.stack);
    console.error('🏁 ===== END ERROR =====\n');
    throw error;
  }
}

async function handleMergeConflicts(octokit: any, owner: string, repo: string, prNumber: number) {
  try {
    console.log(`🔀 Processing merge conflicts for PR #${prNumber}`);
    // Comment on the PR about merge conflicts
    const conflictResponse = await octokit.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: `🔀 **Merge Conflict Detected**\n\nThis PR has merge conflicts that need to be resolved. CiKnight will attempt to help resolve them automatically.\n\n_Note: Complex conflicts may require manual intervention._`,
    });

    console.log(`💬 Posted merge conflict comment on PR #${prNumber}`);
    console.log(`   - Comment ID: ${conflictResponse.data.id}`);
    console.log(`   - HTTP Status: ${conflictResponse.status}`);

    // TODO: Implement automatic merge conflict resolution
    // This would involve:
    // 1. Fetching the base and head branches
    // 2. Attempting to merge with conflict markers
    // 3. Using AI/heuristics to resolve conflicts
    // 4. Creating a new commit with resolved conflicts
  } catch (error: any) {
    console.error(`\n❌ ===== ERROR HANDLING MERGE CONFLICTS =====`);
    console.error(`🔴 PR #${prNumber}`);
    console.error(`📝 Error Message: ${error.message}`);
    console.error(`📊 HTTP Status: ${error.status || 'N/A'}`);
    if (error.response?.data) {
      console.error(`📋 API Response: ${JSON.stringify(error.response.data)}`);
    }
    console.error(`📚 Stack Trace:`, error.stack);
    console.error('🏁 ===== END ERROR =====\n');
    throw error;
  }
}
