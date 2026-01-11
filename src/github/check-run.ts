import { createGitHubClient, getRepoInfo } from './client';

export async function handleCheckRun(payload: any) {
  try {
    const { owner, repo, installationId } = getRepoInfo(payload);
    const octokit = createGitHubClient(installationId);
    const checkRun = payload.check_run;

    console.log(
      `🔍 Processing check run: ${checkRun.name} - ${checkRun.conclusion || checkRun.status}`
    );

    // Only handle failed checks
    if (checkRun.conclusion !== 'failure') {
      console.log(`✅ Check run passed or is still running`);
      return;
    }

    // Find associated pull requests
    const pullRequests = checkRun.pull_requests || [];

    if (pullRequests.length === 0) {
      console.log(`ℹ️  No pull requests associated with this check run`);
      return;
    }

    for (const pr of pullRequests) {
      await handleCIFailure(octokit, owner, repo, pr.number, checkRun);
    }
  } catch (error: any) {
    console.error(`❌ Error handling check run:`, error.message);
  }
}

async function handleCIFailure(
  octokit: any,
  owner: string,
  repo: string,
  prNumber: number,
  checkRun: any
) {
  try {
    console.log(`🔧 Handling CI failure for PR #${prNumber}`);

    // Comment on the PR about the CI failure
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: `🔧 **CI Failure Detected**\n\n**Failed Check:** ${checkRun.name}\n**Conclusion:** ${checkRun.conclusion}\n\nCiKnight is analyzing the failure and will attempt to fix it automatically.\n\n[View Check Run](${checkRun.html_url})`,
    });

    console.log(`💬 Posted CI failure comment on PR #${prNumber}`);

    // TODO: Implement automatic CI failure fixes
    // This would involve:
    // 1. Analyzing the check run logs
    // 2. Identifying common failure patterns (linting, tests, build errors)
    // 3. Generating fixes based on the failure type
    // 4. Creating a commit with the fixes
    // 5. Pushing to the PR branch
  } catch (error: any) {
    console.error(`❌ Error handling CI failure:`, error.message);
  }
}
