import { Request, Response } from 'express';
import { Webhooks } from '@octokit/webhooks';
import { handlePullRequest } from './github/pull-request';
import { handleCheckRun } from './github/check-run';

// Validate required environment variables
const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
if (!webhookSecret) {
  throw new Error('GITHUB_WEBHOOK_SECRET environment variable is required');
}

// Initialize webhooks
const webhooks = new Webhooks({
  secret: webhookSecret,
});

// Pull Request events
webhooks.on('pull_request.opened', async ({ payload }) => {
  try {
    console.log(`📬 Pull request opened: #${payload.pull_request.number}`);
    await handlePullRequest(payload, 'opened');
  } catch (error: any) {
    console.error(`❌ Error handling pull_request.opened event:`, error.message, error);
  }
});

webhooks.on('pull_request.synchronize', async ({ payload }) => {
  try {
    console.log(`🔄 Pull request synchronized: #${payload.pull_request.number}`);
    await handlePullRequest(payload, 'synchronize');
  } catch (error: any) {
    console.error(`❌ Error handling pull_request.synchronize event:`, error.message, error);
  }
});

webhooks.on('pull_request.reopened', async ({ payload }) => {
  try {
    console.log(`🔓 Pull request reopened: #${payload.pull_request.number}`);
    await handlePullRequest(payload, 'reopened');
  } catch (error: any) {
    console.error(`❌ Error handling pull_request.reopened event:`, error.message, error);
  }
});

// Check run events for CI failures
webhooks.on('check_run.completed', async ({ payload }) => {
  try {
    console.log(`✅ Check run completed: ${payload.check_run.name}`);
    await handleCheckRun(payload);
  } catch (error: any) {
    console.error(`❌ Error handling check_run.completed event:`, error.message, error);
  }
});

// Check suite events
webhooks.on('check_suite.completed', async ({ payload }) => {
  try {
    console.log(`📦 Check suite completed: ${payload.check_suite.head_branch}`);
    // Handle check suite completion if needed
  } catch (error: any) {
    console.error(`❌ Error handling check_suite.completed event:`, error.message, error);
  }
});

// Status events
webhooks.on('status', async ({ payload }) => {
  try {
    console.log(`📊 Status event: ${payload.context} - ${payload.state}`);
    // Handle status events if needed
  } catch (error: any) {
    console.error(`❌ Error handling status event:`, error.message, error);
  }
});

// Error handling
webhooks.onError((error) => {
  console.error('❌ Webhook error:', error);
});

// Webhook handler for Express
export const webhookHandler = async (req: Request, res: Response): Promise<Response> => {
  const startTime = new Date().toISOString();

  try {
    const signature = req.headers['x-hub-signature-256'] as string;
    const event = req.headers['x-github-event'] as string;
    const id = req.headers['x-github-delivery'] as string;

    console.log(`\n🔔 ===== WEBHOOK RECEIVED ===== ${startTime}`);
    console.log(`📨 Event Type: ${event || 'MISSING'}`);
    console.log(`🆔 Delivery ID: ${id || 'MISSING'}`);
    console.log(`🔐 Signature Present: ${signature ? 'YES' : 'NO'}`);

    if (!signature || !event || !id) {
      console.error('❌ Missing required webhook headers');
      console.log(`📋 Headers received: ${JSON.stringify(req.headers)}`);
      return res.status(400).json({ error: 'Missing required webhook headers' });
    }

    // Use rawBody for signature verification, req.body is already parsed JSON
    const rawBody = (req as any).rawBody;
    if (!rawBody) {
      console.error('❌ Missing raw body for verification');
      return res.status(400).json({ error: 'Missing raw body for verification' });
    }

    // Parse and log payload details
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
      console.log(`📦 Payload Structure Validation:`);
      console.log(`   - Repository: ${payload.repository?.full_name || 'MISSING'}`);
      console.log(`   - Repository Owner: ${payload.repository?.owner?.login || 'MISSING'}`);
      console.log(`   - Installation ID: ${payload.installation?.id || 'MISSING'}`);

      if (event.startsWith('pull_request')) {
        console.log(`   - PR Number: ${payload.pull_request?.number || 'MISSING'}`);
        console.log(`   - PR Action: ${payload.action || 'MISSING'}`);
        console.log(`   - PR State: ${payload.pull_request?.state || 'MISSING'}`);
        console.log(`   - PR Author: ${payload.pull_request?.user?.login || 'MISSING'}`);
      }
    } catch (parseError: any) {
      console.error(`❌ Failed to parse webhook payload: ${parseError.message}`);
      return res.status(400).json({ error: 'Invalid JSON payload' });
    }

    // Owner verification for pull_request events (before signature verification for efficiency)
    // Note: This check happens before signature verification to quickly reject unauthorized
    // webhooks and reduce processing overhead. GitHub's signature is still verified after this check.
    if (event.startsWith('pull_request')) {
      const repoOwner = payload.repository?.owner?.login;

      if (!repoOwner) {
        console.warn('⚠️  Missing repository owner in payload');
        return res.status(400).json({ error: 'Missing repository owner information' });
      }

      if (repoOwner !== 'd7knight2') {
        console.warn(`🚫 Unauthorized webhook: Repository owner '${repoOwner}' is not 'd7knight2'`);
        return res.status(403).json({
          error: 'Forbidden',
          message:
            'This GitHub App only processes pull requests for repositories owned by d7knight2',
        });
      }
      console.log(`✅ Owner verification passed: ${repoOwner}`);
    }

    console.log(`🔐 Verifying webhook signature...`);
    await webhooks.verifyAndReceive({
      id,
      name: event as any, // GitHub sends various event names, type system can't enumerate all
      signature,
      payload: rawBody,
    });

    console.log(`✅ Webhook verified and processed successfully: ${event} (${id})`);
    console.log(`🏁 ===== WEBHOOK PROCESSING COMPLETE =====\n`);
    return res.status(200).json({ message: 'Webhook received' });
  } catch (error: any) {
    console.error('\n❌ ===== WEBHOOK ERROR =====');
    console.error(`⏰ Timestamp: ${startTime}`);
    console.error(`🔴 Error Type: ${error.name || 'Unknown'}`);
    console.error(`📝 Error Message: ${error.message}`);
    console.error(`📚 Stack Trace:`, error.stack);
    console.error('🏁 ===== END WEBHOOK ERROR =====\n');
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

export { webhooks };
